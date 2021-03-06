import { db, playlistTable } from './db';
import { wrapTracks, getIndexedTrack } from './helpers';

/**
 * @typedef {import('./helpers').TrackWithIndex} PlaylistRecord
 */

export function clear() {
    return playlistTable.clear();
}

/**
 * @param {Models.Track[]} tracks 
 */
export function replace(tracks) {
    return db.transaction('rw', playlistTable, async () => {
        await playlistTable.clear();
        await playlistTable.bulkAdd(wrapTracks(tracks));
    });
}

/**
 * @param {number} index
 * @param {Models.Track[]} tracks
 */
export function insert(index, tracks) {
    return db.transaction('rw', playlistTable, async () => {
        /** @type {PlaylistRecord[]} */
        const exists = await playlistTable
            .where('track.id')
            .anyOf(tracks.map(t => t.id))
            .toArray();
        const uniq = tracks.filter(track => exists.findIndex(e => track.id === e.track.id) < 0);
        const count = uniq.length;
        if (count <= 0) return;
        /** @type {PlaylistRecord[]} */
        const pendingItems = await playlistTable
            .where('index')
            .aboveOrEqual(index)
            .toArray();
        for (const item of pendingItems) {
            item.index += count;
        }
        await playlistTable.bulkPut(pendingItems);
        await playlistTable.bulkAdd(wrapTracks(uniq, index));
    });
}

/**
 * @param {number} index
 * @param {number} count
 */
export function remove(index, count = 1) {
    const range = [[index, index + count]];
    return db.transaction('rw', playlistTable, async () => {
        await playlistTable
            .where('index')
            .inAnyRange(range)
            .delete();
        /** @type {PlaylistRecord[]} */
        const pendingItems = await playlistTable
            .where('index')
            .aboveOrEqual(index)
            .toArray();
        for (const item of pendingItems) {
            item.index -= count;
        }
        await playlistTable.bulkPut(pendingItems);
    });
}

/**
 * @returns {Promise<Models.Track[]>}
 */
export function get() {
    return getIndexedTrack(playlistTable);
}
