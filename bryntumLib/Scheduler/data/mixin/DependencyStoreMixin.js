import ArrayHelper from '../../../Core/helper/ArrayHelper.js';
import Model from '../../../Core/data/Model.js';

/**
 * @module Scheduler/data/mixin/DependencyStoreMixin
 */

/**
 * This is a mixin, containing functionality related to managing dependencies.
 *
 * It is consumed by the regular {@link Scheduler.data.DependencyStore} class and Scheduler Pros counterpart.
 *
 * @mixin
 */
export default Target => class DependencyStoreMixin extends Target {
    static get $name() {
        return 'DependencyStoreMixin';
    }

    /**
     * Add dependencies to the store.
     *
     * NOTE: References (fromEvent, toEvent) on the dependencies are determined async by a calculation engine. Thus they
     * cannot be directly accessed after using this function.
     *
     * For example:
     *
     * ```javascript
     * const [dependency] = dependencyStore.add({ from, to });
     * // dependency.fromEvent is not yet available
     * ```
     *
     * To guarantee references are set up, wait for calculations for finish:
     *
     * ```javascript
     * const [dependency] = dependencyStore.add({ from, to });
     * await dependencyStore.project.commitAsync();
     * // dependency.fromEvent is available (assuming EventStore is loaded and so on)
     * ```
     *
     * Alternatively use `addAsync()` instead:
     *
     * ```javascript
     * const [dependency] = await dependencyStore.addAsync({ from, to });
     * // dependency.fromEvent is available (assuming EventStore is loaded and so on)
     * ```
     *
     * @param {Scheduler.model.DependencyModel|Scheduler.model.DependencyModel[]|Object|Object[]} records
     * Array of records/data or a single record/data to add to store
     * @param {Boolean} [silent] Specify `true` to suppress events
     * @returns {Scheduler.model.DependencyModel[]} Added records
     * @function add
     * @category CRUD
     */

    /**
     * Add dependencies to the store and triggers calculations directly after. Await this function to have up to date
     * references on the added dependencies.
     *
     * ```javascript
     * const [dependency] = await dependencyStore.addAsync({ from, to });
     * // dependency.fromEvent is available (assuming EventStore is loaded and so on)
     * ```
     *
     * @param {Scheduler.model.DependencyModel|Scheduler.model.DependencyModel[]|Object|Object[]} records
     * Array of records/data or a single record/data to add to store
     * @param {Boolean} [silent] Specify `true` to suppress events
     * @returns {Scheduler.model.DependencyModel[]} Added records
     * @function addAsync
     * @category CRUD
     * @async
     */

    /**
     * Applies a new dataset to the DependencyStore. Use it to plug externally fetched data into the store.
     *
     * NOTE: References (fromEvent, toEvent) on the dependencies are determined async by a calculation engine. Thus
     * they cannot be directly accessed after assigning the new dataset.
     *
     * For example:
     *
     * ```javascript
     * dependencyStore.data = [{ from, to }];
     * // dependencyStore.first.fromEvent is not yet available
     * ```
     *
     * To guarantee references are available, wait for calculations for finish:
     *
     * ```javascript
     * dependencyStore.data = [{ from, to }];
     * await dependencyStore.project.commitAsync();
     * // dependencyStore.first.fromEvent is available
     * ```
     *
     * Alternatively use `loadDataAsync()` instead:
     *
     * ```javascript
     * await dependencyStore.loadDataAsync([{ from, to }]);
     * // dependencyStore.first.fromEvent is available
     * ```
     *
     * @member {Object[]} data
     * @category Records
     */

    /**
     * Applies a new dataset to the DependencyStore and triggers calculations directly after. Use it to plug externally
     * fetched data into the store.
     *
     * ```javascript
     * await dependencyStore.loadDataAsync([{ from, to }]);
     * // dependencyStore.first.fromEvent is available
     * ```
     *
     * @param {Object[]} data Array of DependencyModel data objects
     * @function loadDataAsync
     * @category CRUD
     * @async
     */

    static get defaultConfig() {
        return {
            /**
             * CrudManager must load stores in the correct order. Lowest first.
             * @private
             */
            loadPriority : 400,
            /**
             * CrudManager must sync stores in the correct order. Lowest first.
             * @private
             */
            syncPriority : 400,

            storeId : 'dependencies'
        };
    }

    // TODO: document
    reduceEventDependencies(event, reduceFn, result, flat = true, depsGetterFn) {
        depsGetterFn = depsGetterFn || (event => this.getEventDependencies(event));

        event = ArrayHelper.asArray(event);

        event.reduce((result, event) => {
            if (event.children && !flat) {
                event.traverse(evt => {
                    result = depsGetterFn(evt).reduce(reduceFn, result);
                });
            }
            else {
                result = depsGetterFn(event).reduce(reduceFn, result);
            }
        }, result);

        return result;
    }

    // TODO: document
    mapEventDependencies(event, fn, filterFn, flat, depsGetterFn) {
        return this.reduceEventDependencies(event, (result, dependency) => {
            filterFn(dependency) && result.push(dependency);
            return result;
        }, [], flat, depsGetterFn);
    }

    // TODO: document
    mapEventPredecessors(event, fn, filterFn, flat) {
        return this.reduceEventPredecessors(event, (result, dependency) => {
            filterFn(dependency) && result.push(dependency);
            return result;
        }, [], flat);
    }

    // TODO: document
    mapEventSuccessors(event, fn, filterFn, flat) {
        return this.reduceEventSuccessors(event, (result, dependency) => {
            filterFn(dependency) && result.push(dependency);
            return result;
        }, [], flat);
    }

    /**
     * Returns all dependencies for a certain event (both incoming and outgoing)
     *
     * @param {Scheduler.model.EventModel} event
     * @returns {Scheduler.model.DependencyModel[]}
     */
    getEventDependencies(event) {
        return [].concat(event.predecessors || [], event.successors || []);
    }

    // TODO: document
    removeEventDependencies(event) {
        this.remove(this.getEventDependencies(event));
    }

    // TODO: document
    removeEventPredecessors(event) {
        this.remove(event.predecessors);
    }

    // TODO: document
    removeEventSuccessors(event, flat) {
        this.remove(event.successors);
    }

    getBySourceTargetId(key) {
        //TODO: in original code this uses a keymap
        return this.records.find(r =>
            key == this.constructor.makeDependencySourceTargetCompositeKey(r.from, r.to)
        );
    }

    /**
     * Returns dependency model instance linking tasks with given ids. The dependency can be forward (from 1st
     * task to 2nd) or backward (from 2nd to 1st).
     *
     * @param {Scheduler.model.EventModel|String} sourceEvent 1st event
     * @param {Scheduler.model.EventModel|String} targetEvent 2nd event
     * @returns {Scheduler.model.DependencyModel}
     */
    getDependencyForSourceAndTargetEvents(sourceEvent, targetEvent) {
        sourceEvent = Model.asId(sourceEvent);
        targetEvent = Model.asId(targetEvent);

        return this.getBySourceTargetId(this.constructor.makeDependencySourceTargetCompositeKey(sourceEvent, targetEvent));
    }

    /**
     * Returns a dependency model instance linking given events if such dependency exists in the store.
     * The dependency can be forward (from 1st event to 2nd) or backward (from 2nd to 1st).
     *
     * @param {Scheduler.model.EventModel|String} sourceEvent
     * @param {Scheduler.model.EventModel|String} targetEvent
     * @returns {Scheduler.model.DependencyModel}
     */
    getEventsLinkingDependency(sourceEvent, targetEvent) {
        return this.getDependencyForSourceAndTargetEvents(sourceEvent, targetEvent) ||
            this.getDependencyForSourceAndTargetEvents(targetEvent, sourceEvent);
    }

    /**
     * Validation method used to validate a dependency. Override and return `true` to indicate that an
     * existing dependency between two tasks is valid. For a new dependency being created please see
     * {@link #function-isValidDependencyToCreate}.
     *
     * @param {Scheduler.model.DependencyModel|Scheduler.model.TimeSpan|Number|String} dependencyOrFromId The dependency
     * model, the from task/event or the id of the from task/event
     * @param {Scheduler.model.TimeSpan|Number|String} [toId] To task/event or id thereof if the first parameter is not
     * a dependency record
     * @param {Number} [type] Dependency {@link Scheduler.model.DependencyBaseModel#property-Type-static} if the first
     * parameter is not a dependency model instance.
     * @returns {Boolean}
     */
    async isValidDependency(dependencyOrFromId, toId, type) {
        let fromEvent = dependencyOrFromId, toEvent = toId;

        if (dependencyOrFromId == null) {
            return false;
        }

        // Accept dependency model
        if (dependencyOrFromId.isDependencyModel) {
            ({ fromEvent, toEvent } = dependencyOrFromId);
        }

        // Accept from as id
        fromEvent = this.eventStore.getById(fromEvent);

        // Accept to as id
        toEvent = this.eventStore.getById(toEvent);

        // This condition is supposed to map all model instances to be validated by project. Lowest common ancestor
        // for scheduler event, scheduler pro event and gantt task is TimeSpan
        if (fromEvent && toEvent) {
            // Not asserting dependency type here. Default value should normally suffice.
            return this.project.isValidDependency(fromEvent, toEvent, type);
        }

        return dependencyOrFromId !== toId;
    }

    /**
     * Validation method used to validate a dependency while creating. Override and return `true` to indicate that
     * a new dependency is valid to be created.
     *
     * @param {Scheduler.model.TimeSpan|Number|String} fromId From event/task or id
     * @param {Scheduler.model.TimeSpan|Number|String} toId To event/task or id
     * @param {Number} type Dependency {@link Scheduler.model.DependencyBaseModel#property-Type-static}
     * @returns {Boolean}
     */
    isValidDependencyToCreate(fromId, toId, type) {
        return this.isValidDependency(fromId, toId, type);
    }

    /**
     * Returns all dependencies highlighted with the given CSS class
     *
     * @param {String} cls
     * @returns {Scheduler.model.DependencyBaseModel[]}
     */
    getHighlightedDependencies(cls) {
        return this.records.reduce((result, dep) => {
            if (dep.isHighlightedWith(cls)) result.push(dep);
            return result;
        }, []);
    }

    static makeDependencySourceTargetCompositeKey(from, to) {
        return `source(${from})-target(${to})`;
    }

    //region Product neutral

    getTimeSpanDependencies(record) {
        return this.getEventDependencies(record);
    }

    //endregion
};
