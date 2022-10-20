import Base from '../../Base.js';
import ObjectHelper from '../../helper/ObjectHelper.js';

/**
 * @module Core/data/mixin/StoreChanges
 */

/**
 * Mixin for Store that handles applying changes (presumable from a backend)
 *
 * @mixin
 */
export default Target => class StoreChanges extends (Target || Base) {
    static get $name() {
        return 'StoreChanges';
    }

    /**
     * Applies changes from another store to this store. Useful if cloning records in one store to display in a
     * grid in a popup etc. to reflect back changes.
     * @param {Core.data.Store} otherStore
     * @category CRUD
     */
    applyChangesFromStore(otherStore) {
        const
            me          = this,
            { changes } = otherStore;

        if (!changes) {
            return;
        }

        if (changes.added) {
            me.add(changes.added);
        }

        if (changes.removed) {
            // Remove using id, otherwise indexOf in remove fn won't yield correct result
            me.remove(changes.removed.map(r => r.id));
        }

        if (changes.modified) {
            changes.modified.forEach(record => {
                const localRecord = me.getById(record.id);
                localRecord.set(record.modifications);
            });
        }
    }

    /**
     * Applies a set of changes (presumable from a backend) expressed as an object matching the format outputted by the
     * {@link Core/data/Store#property-changes} property: `{ added : [], modified/updated : [], removed : [] }`
     *
     * `added` is expected to be an array of raw data objects consumable by the stores model class for records to add to
     * the store (see example snippet below).
     *
     * `modified` (or `updated` for compatibility with Schedulers CrudManager) is expected to have the same format as
     * `added`, but should always include the `id` of the record to update.
     *
     * Records that have been created locally and gets assigned a proper id by the backend are expected to also pass a
     * `phantomId` field (name of the field is configurable using the `phantomIdField` arg, more info on phantom ids
     * below), to match it with the current id of a local record (`id` will contain the new id).
     *
     * Note that it is also possible to pass this `phantomId` -> `id` mapping in the `added` array. When encountering a
     * record in that array that already exists in the local store, it will be treated the same was as a record in the
     * `modified` array.
     *
     * `removed` is expected to be an array of objects with the `{ id : xx }` shape. Any matches on an id in the store
     * will be removed, those and any non matches will also be cleared from the change tracking of the store.
     *
     * As an example, consider a store with the following initial state and some operations performed on it:
     *
     * ```javascript
     * // Load some data into the store
     * store.data = [
     *     { id : 1, name : 'Minerva' },
     *     { id : 2, name : 'Mars' },
     *     { id : 3, name : 'Jupiter' }
     * ];
     * // Add a new record. It gets assigned a generated id,
     * // for example 'generated56'
     * store.add({ name : 'Artemis' });
     * // Remove Jupiter
     * store.remove(3);
     * ```
     *
     * After syncing those operations to a custom backend (however you chose to solve it in your application) we might
     * get the following response (see "Transforming a response to the correct format" below if your backend responds
     * in another format):
     *
     * ```javascript
     * const serverResponse = {
     *     added : [
     *         // Added by the backend, will be added locally
     *         { id : 5, name : 'Demeter' }
     *     ],
     *
     *     updated : [
     *         // Will change the name of Minerva -> Athena
     *         { id : 1, name : 'Athena' },
     *         // Will set proper id 4 for Artemis
     *         { $PhantomId : 'generated56', id : 4 }
     *     ],
     *
     *     removed : [
     *         // Confirmed remove of Jupiter
     *         { id : 3 },
     *         // Removed by the backend, Mars will be removed locally
     *         { id : 2 }
     *     ]
     * };
     * ```
     *
     * If that response is then passed to this function:
     *
     * ```javascript
     * store.applyChangeSet(serverResponse);
     * ```
     *
     * The end result will be the following data in the store:
     *
     * ```javascript
     * [
     *     { id : 1, name : 'Athena' }, // Changed name
     *     { id : 4, name : 'Artemis' }, // Got a proper id
     *     { id : 5, name : 'Demeter' } // Added by the backend
     * ]
     * ```
     *
     * ### Phantom ids
     *
     * When a record is created locally, it is always assigned a generated id. That id is called a phantom id (note that
     * it is assigned to the normal id field). When passing the new record to the backend, the id is sent with it. When
     * the backend inserts the record into the database, it (normally) gets a proper id assigned. That id then needs to
     * be passed back in the response, to update the local record with the correct id. Making sure that future updates
     * match the correct row in the database.
     *
     * For example a newly created record should be passed similar to this to the backend (pseudo format, up to the
     * application/backend to decide):
     *
     * ```json
     * {
     *     "added" : {
     *         "id" : "generated79",
     *         "name" : "Hercules",
     *         ...
     *     }
     * }
     * ```
     *
     * For the backend response to be applicable for this function, it should then respond with:
     *
     * ```json
     * {
     *     "updated" : {
     *         {
     *             "$PhantomId" : "generated79",
     *             "id" : 465
     *         }
     *     }
     * }
     * ```
     *
     * (Or, as stated above, it can also be passed in the "added" array. Which ever suits your backend best).
     *
     * This function will then change the id of the local record using the phantom id `generated79` to `465`.
     *
     * ### Transforming a response to the correct format
     *
     * This function optionally accepts a `transformFn`, a function that will be called with the `changes`. It is
     * expected to return a changeset in the format described above (`{ added : [], updated : [], removed : [] }`),
     * which then will be used to apply the changes.
     *
     * Consider the following "non standard" (made up) changeset:
     *
     * ```javascript
     * const changes = {
     *     // Database ids for records previously added locally
     *     assignedIds : {
     *         'phantom1' : 10,
     *         'phantom2' : 15
     *     },
     *     // Ids records removed by the backend
     *     removed : [11, 27],
     *     // Modified records, keyed by id
     *     altered : {
     *         12 : { name : 'Changed' }
     *     },
     *     // New records, keyed by id
     *     inserted : {
     *         20  : { name : 'New' }
     *     }
     * }
     * ```
     *
     * Since it does not match the expected format it has to be transformed:
     *
     * ```javascript
     * store.applyChangeset(changes, ({ assignedIds, inserted, altered, removed }) => ({
     *    // Convert inserted to [{ id : 20, name : 'New' }]
     *    added : Object.entries(inserted).map(([id, data] => ({ id, ...data }),
     *    updated : [
     *        // Convert assignedIds to [{ $PhantomId : 'phantom1', id : 10 }, ...]
     *       ...Object.entries(assignedIds).map(([phantomId, id])) => ({ $PhantomId : phantomId, id }),
     *       // Convert altered to [{ id : 12, name : 'Changed' }]
     *       ...Object.entries(modified).map(([id, data] => ({ id, ...data })
     *    ],
     *    // Convert removed to [{ id : 11 }, ...]
     *    removed : removed.map(id => ({ id }))
     * }));
     * ```
     *
     * The transform function above would output:
     *
     * ```javascript
     * {
     *     added : [
     *         {  id : 20, name : 'New' }
     *     ],
     *     updated : [
     *         { $PhantomId : 'phantom1', id : 10 },
     *         { $PhantomId : 'phantom2', id : 15 },
     *         {  id : 12, name : 'Changed' }
     *     ],
     *     removed : [
     *        { id : 11 },
     *        { id : 12 }
     *     ]
     * }
     * ```
     *
     * And that format can then be applied.
     *
     * @param {Object} changes Changeset to apply to the store, see specification above
     * @param {Function} [transformFn] Optional function used to preprocess a changeset in a different format,
     * should return an object with the format expected by this function (see above)
     * @param {String} [phantomIdField] Field used by the backend when communicating a record being assigned a proper id
     * instead of a phantom id (see above)
     * @privateparam {Boolean} [remote] Set to true to indicate changes are from the remote source. Remote changes have
     * precedence over local.
     * @privateparam {Boolean} [logChanges] Used by CrudManager to be able to revert specific changes later
     * @category CRUD
     */
    applyChangeset(changes, transformFn = null, phantomIdField = '$PhantomId', remote = true, logChanges = false) {
        const
            me                                    = this,
            { added, updated, modified, removed } = transformFn?.(changes, me) ?? changes,
            // To support both updated & modified (store uses modified, CM updated)
            altered                               = updated ?? modified ?? [],
            idDataSource                          = me.modelClass.getFieldDataSource('id'),
            log                                   = logChanges ? new Map() : null;

        // Process added records
        if (added?.length > 0) {
            const
                toUpdate = [],
                toAdd    = [];

            // Separate actually new records from added records that get a proper id set up, to match more backends
            for (const data of added) {
                if (me.getById(data[phantomIdField] ?? ObjectHelper.getPath(data, idDataSource))) {
                    // we need to keep order of the added records
                    // https://github.com/bryntum/support/issues/5189
                    toUpdate.push(data);
                }
                else {
                    toAdd.push(data);
                }
            }

            altered.unshift.apply(altered, toUpdate);

            // Create new records in the store, and clear them out of the added bag
            const addedRecords = me.add(toAdd) ?? [];

            for (const record of addedRecords) {
                log?.set(record.id, record.data);
                record.clearChanges();
            }
        }

        // Process modified records
        if (altered?.length > 0) {
            for (const data of altered) {
                const
                    phantomId = data[phantomIdField],
                    id        = ObjectHelper.getPath(data, idDataSource),
                    record    = me.getById(phantomId ?? id);

                // Matching an existing record -> update it
                if (record) {
                    const changes = record.applyChangeset(data, phantomIdField, remote);
                    log?.set(id, changes);
                }
            }
        }

        // Process removed records
        if (removed?.length > 0) {
            me.applyRemovals(removed);
        }

        return log;
    }

    // Apply removals, removing records and updating the `removed` bag to match.
    //
    // Accepts an array of objects containing an `id` property. Records in the store matching an entry in the array
    // will be removed from the store and the `removed` bag. Unmatched entries will be removed from the `removed` bag.
    applyRemovals(removals) {
        const
            me                         = this,
            { removed : removedStash } = me,
            idDataSource               = me.modelClass.getFieldDataSource(me.modelClass.idField),
            toRemove                   = [];

        for (const removedEntry of removals) {
            const id = ObjectHelper.getPath(removedEntry, idDataSource);

            // Removed locally and confirmed by server, just remove the record from the removed stash
            if (removedStash.includes(id)) {
                removedStash.remove(id);
            }
            // Server driven removal (most likely), collect for removal locally too
            else  {
                toRemove.push(id);
            }
        }

        // Remove collected records in one go
        me.remove(toRemove);

        // Leave no trace of them at all
        for (const record of toRemove) {
            removedStash.remove(record);
        }
    }
};
