/**
 * @module Scheduler/model/mixin/ProjectCurrentConfig
 */

/**
 * Mixin that makes sure current config for a project includes store data and is cleaned up properly.
 *
 * @mixin
 * @private
 */
export default Target => class ProjectCurrentConfig extends Target {

    // This function is not meant to be called by any code other than Base#getCurrentConfig().
    // It extracts the current configs/fields for the project, with special handling for inline data
    getCurrentConfig(options) {
        const
            me     = this,
            result = super.getCurrentConfig(options);

        if (result) {
            for (const storeName of ['eventStore', 'resourceStore', 'assignmentStore', 'dependencyStore', 'timeRangeStore', 'resourceTimeRangeStore']) {
                const store = me[storeName];

                if (store) {
                    if (store.count) {
                        result[store.id + 'Data'] = store.getInlineData(options);
                    }

                    // Get stores current state, in case it has filters etc added at runtime
                    const storeState = store.getCurrentConfig(options);
                    if (storeState && Object.keys(storeState).length > 0) {
                        result[storeName] = Object.assign(result[storeName] || {}, storeState);
                    }
                    // Remove empty store configs
                    else if (result[storeName] && Object.keys(result[storeName]).length === 0) {
                        delete result[storeName];
                    }
                }
            }

            if (result.timeRangeStore) {
                // Exclude default time range modelClass (it is a plain store), spam
                if (me.timeRangeStore.originalModelClass === me.timeRangeModelClass || me.timeRangeStore.originalModelClass.$name === 'TimeSpan') {
                    delete result.timeRangeStore.modelClass;
                }

                // Same for default storeId
                if (result.timeRangeStore.storeId === 'timeRanges') {
                    delete result.timeRangeStore.storeId;
                }

                // Since timeRangeStore is a plain store it is always configured with id, spam
                if (Object.keys(result.timeRangeStore).length === 1) {
                    delete result.timeRangeStore;
                }
            }

            // Gantt specifics
            if (me.taskStore.isTaskStore) {
                delete result.eventModelClass;
                delete result.eventStoreClass;
                delete result.children;
            }

            return result;
        }
    }
};
