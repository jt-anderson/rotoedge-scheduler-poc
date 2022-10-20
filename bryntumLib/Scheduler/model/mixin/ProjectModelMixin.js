import Model from '../../../Core/data/Model.js';
import ResourceTimeRangeModel from '../ResourceTimeRangeModel.js';
import TimeSpan from '../TimeSpan.js';
import Store from '../../../Core/data/Store.js';
import StringHelper from '../../../Core/helper/StringHelper.js';
import ResourceTimeRangeStore from '../../data/ResourceTimeRangeStore.js';

/**
 * @module Scheduler/model/mixin/ProjectModelMixin
 */

/**
 * Mixin that holds configuration shared between projects in Scheduler and Scheduler Pro.
 * @mixin
 */
export default Target => class ProjectModelMixin extends (Target || Model) {
    static get $name() {
        return 'ProjectModelMixin';
    }

    //region Config

    static get defaultConfig() {
        return {
            /**
             * State tracking manager instance the project relies on
             * @member {Core.data.stm.StateTrackingManager} stm
             * @category Advanced
             */
            /**
             * Configuration options to provide to the STM manager
             *
             * @config {Object|Core.data.stm.StateTrackingManager}
             * @category Advanced
             */
            stm : {},

            timeRangeModelClass         : TimeSpan,
            resourceTimeRangeModelClass : ResourceTimeRangeModel,

            /**
             * The constructor to create a time range store instance with. Should be a class subclassing the
             * {@link Core.data.Store}
             * @config {Core.data.Store|Object}
             * @typings {typeof Store|object}
             * @category Models & Stores
             */
            timeRangeStoreClass : Store,

            /**
             * The constructor to create a resource time range store instance with. Should be a class subclassing the
             * {@link Scheduler.data.ResourceTimeRangeStore}
             * @config {Scheduler.data.ResourceTimeRangeStore|Object}
             * @typings {typeof ResourceTimeRangeStore|object}
             * @category Models & Stores
             */
            resourceTimeRangeStoreClass : ResourceTimeRangeStore,

            /**
             * The initial data, to fill the {@link #property-timeRangeStore timeRangeStore} with.
             * Should be an array of {@link Scheduler.model.TimeSpan TimeSpan} or its configuration objects.
             *
             * @config {Scheduler.model.TimeSpan[]} [timeRangesData]
             * @category Legacy inline data
             */

            /**
             * The initial data, to fill the {@link #property-resourceTimeRangeStore resourceTimeRangeStore} with.
             * Should be an array of {@link Scheduler.model.ResourceTimeRangeModel ResourceTimeRangeModel} or it's
             * configuration objects.
             *
             * @config {Scheduler.model.ResourceTimeRangeModel[]} [resourceTimeRangesData]
             * @category Legacy inline data
             */

            eventStore      : {},
            assignmentStore : {},
            dependencyStore : {},
            resourceStore   : {},
            timeRangesData  : null
        };
    }

    static get configurable() {
        return {
            /**
             * Project data as a JSON string, used to populate its stores.
             *
             * ```javascript
             * const project = new ProjectModel({
             *     json : '{"eventsData":[...],"resourcesData":[...],...}'
             * }
             * ```
             *
             * @config {String}
             * @category Inline data
             */
            json : null,

            /**
             * The {@link Core.data.Store store} holding the time ranges information.
             *
             * See also {@link Scheduler.model.TimeSpan}
             *
             * @member {Core.data.Store} timeRangeStore
             * @category Models & Stores
             */
            /**
             * A {@link Core.data.Store} instance or a config object.
             * @config {Core.data.Store|Object}
             * @category Models & Stores
             */
            timeRangeStore : {
                value : {
                    id         : 'timeRanges', // no-sanity
                    modelClass : TimeSpan
                },
                $config : 'nullify'
            },

            /**
             * The {@link Scheduler.data.ResourceTimeRangeStore store} holding the resource time ranges information.
             *
             * See also {@link Scheduler.model.ResourceTimeRangeModel}
             *
             * @member {Scheduler.data.ResourceTimeRangeStore} resourceTimeRangeStore
             * @category Models & Stores
             */
            /**
             * A {@link Scheduler.data.ResourceTimeRangeStore} instance or a config object.
             * @config {Scheduler.data.ResourceTimeRangeStore|Object}
             * @category Models & Stores
             */
            resourceTimeRangeStore : {
                value   : {},
                $config : 'nullify'
            },

            // Documented in Scheduler/model/ProjectModel and SchedulerPro/model/ProjectModel since types differ
            events             : null,
            resources          : null,
            assignments        : null,
            dependencies       : null,
            timeRanges         : null,
            resourceTimeRanges : null
        };
    }

    //endregion

    //region Properties

    /**
     * Returns current Project changes as an object consisting of added/modified/removed arrays of records for every
     * managed store. Returns `null` if no changes exist. Format:
     *
     * ```javascript
     * {
     *     resources : {
     *         added    : [{ name : 'New guy' }],
     *         modified : [{ id : 2, name : 'Mike' }],
     *         removed  : [{ id : 3 }]
     *     },
     *     events : {
     *         modified : [{  id : 12, name : 'Cool task' }]
     *     },
     *     ...
     * }
     * ```
     *
     * @member {Object} changes
     * @readonly
     * @category Models & Stores
     */

    /**
     * Get or set data of project stores. The returned data is identical to what
     * {@link #function-toJSON} returns:
     *
     * ```javascript
     *
     * const data = scheduler.project.inlineData;
     *
     * // data:
     * {
     *     eventsData             : [...],
     *     resourcesData          : [...],
     *     dependenciesData       : [...],
     *     assignmentsData        : [...],
     *     resourceTimeRangesData : [...],
     *     timeRangesData         : [...]
     * }
     *
     *
     * // Plug it back in later
     * scheduler.project.inlineData = data;
     * ```
     *
     * @property {Object}
     * @category Inline data
     */
    get inlineData() {
        return StringHelper.safeJsonParse(super.json);
    }

    set inlineData(inlineData) {
        this.json = inlineData;
    }

    //endregion

    //region Functions

    /**
     * Accepts a "data package" consisting of data for the projects stores, which is then loaded into the stores.
     *
     * The package can hold data for `EventStore`, `AssignmentStore`, `ResourceStore`, `DependencyStore`,
     * `TimeRangeStore` and `ResourceTimeRangeStore`. It uses the same format as when creating a project with inline
     * data:
     *
     * ```javascript
     * await project.loadInlineData({
     *     eventsData             : [...],
     *     resourcesData          : [...],
     *     assignmentsData        : [...],
     *     dependenciesData       : [...],
     *     resourceTimeRangesData : [...],
     *     timeRangesData         : [...]
     * });
     * ```
     *
     * After populating the stores it commits the project, starting its calculations. By awaiting `loadInlineData()` you
     * can be sure that project calculations are finished.
     *
     * @function loadInlineData
     * @param {Object} dataPackage A data package as described above
     * @fires load
     * @async
     * @category Inline data
     */

    /**
     * Project changes (CRUD operations to records in its stores) are automatically committed on a buffer to the
     * underlying graph based calculation engine. The engine performs it calculations async.
     *
     * By calling this function, the commit happens right away. And by awaiting it you are sure that project
     * calculations are finished and that references between records are up to date.
     *
     * The returned promise is resolved with an object. If that object has `rejectedWith` set, there has been a conflict and the calculation failed.
     *
     * ```javascript
     * // Move an event in time
     * eventStore.first.shift(1);
     *
     * // Trigger calculations directly and wait for them to finish
     * const result = await project.commitAsync();
     *
     * if (result.rejectedWith) {
     *     // there was a conflict during the scheduling
     * }
     * ```
     *
     * @async
     * @function commitAsync
     * @category Common
     */

    //endregion

    //region Init

    construct(config = {}) {
        super.construct(...arguments);

        // These stores are not handled by engine, but still held on project

        if (config.timeRangesData) {
            this.timeRangeStore.data = config.timeRangesData;
        }

        if (config.resourceTimeRangesData) {
            this.resourceTimeRangeStore.data = config.resourceTimeRangesData;
        }
    }

    afterConstruct() {
        super.afterConstruct();

        const me = this;

        !me.timeRangeStore.stm && me.stm.addStore(me.timeRangeStore);
        !me.resourceTimeRangeStore.stm && me.stm.addStore(me.resourceTimeRangeStore);
    }

    //endregion

    //region Attaching stores

    // Attach to a store, relaying its change events
    attachStore(store) {
        store?.on({
            name    : store.$$name,
            change  : 'relayStoreChange',
            thisObj : this
        });
    }

    // Detach a store, stop relaying its change events
    detachStore(store) {
        store && this.detachListeners(store.$$name);
    }

    relayStoreChange(event) {
        /**
         * Fired when data in any of the projects stores changes.
         *
         * Basically a relayed version of each stores own change event, decorated with which store it originates from.
         * See the {@link Core.data.Store#event-change store change event} documentation for more information.
         *
         * @event change
         * @param {Scheduler.model.ProjectModel} source This project
         * @param {Core.data.Store} store Affected store
         * @param {'remove'|'removeAll'|'add'|'updatemultiple'|'clearchanges'|'filter'|'update'|'dataset'|'replace'} action
         * Name of action which triggered the change. May be one of:
         * * `'remove'`
         * * `'removeAll'`
         * * `'add'`
         * * `'updatemultiple'`
         * * `'clearchanges'`
         * * `'filter'`
         * * `'update'`
         * * `'dataset'`
         * * `'replace'`
         * @param {Core.data.Model} record Changed record, for actions that affects exactly one record (`'update'`)
         * @param {Core.data.Model[]} records Changed records, passed for all actions except `'removeAll'`
         * @param {Object} changes Passed for the `'update'` action, info on which record fields changed
         */
        return this.trigger('change', { store : event.source, ...event, source : this });
    }

    updateTimeRangeStore(store, oldStore) {
        this.detachStore(oldStore);
        this.attachStore(store);
    }

    setTimeRangeStore(store) {
        this.timeRangeStore = store;
    }

    changeTimeRangeStore(store) {
        // If it's not being nullified, upgrade a config object to be a full store
        if (store && !store.isStore) {
            store = this.timeRangeStoreClass.new({
                modelClass : this.timeRangeModelClass
            }, store);
        }
        return store;
    }

    updateResourceTimeRangeStore(store, oldStore) {
        this.detachStore(oldStore);
        this.attachStore(store);
    }

    changeResourceTimeRangeStore(store) {
        // If it's not being nullified, upgrade a config object to be a full store
        if (store && !store.isStore) {
            store = this.resourceTimeRangeStoreClass.new({
                modelClass : this.resourceTimeRangeModelClass
            }, store);
        }
        return store;
    }

    setResourceTimeRangeStore(store) {
        this.resourceTimeRangeStore = store;
    }

    //endregion

    //region Inline data

    get events() {
        return this.eventStore.records;
    }

    updateEvents(events) {
        this.eventStore.data = events;
    }

    get resources() {
        return this.resourceStore.records;
    }

    updateResources(resources) {
        this.resourceStore.data = resources;
    }

    get assignments() {
        return this.assignmentStore.records;
    }

    updateAssignments(assignments) {
        this.assignmentStore.data = assignments;
    }

    get dependencies() {
        return this.dependencyStore.records;
    }

    updateDependencies(dependencies) {
        this.dependencyStore.data = dependencies;
    }

    get timeRanges() {
        return this.timeRangeStore.records;
    }

    updateTimeRanges(timeRanges) {
        this.timeRangeStore.data = timeRanges;
    }

    get resourceTimeRanges() {
        return this.resourceTimeRangeStore.records;
    }

    updateResourceTimeRanges(resourceTimeRanges) {
        this.resourceTimeRangeStore.data = resourceTimeRanges;
    }

    async loadInlineData(data) {
        // Flag reset in super
        this.isLoadingInlineData = true;

        // Stores not handled by engine
        if (data.resourceTimeRangesData) {
            this.resourceTimeRangeStore.data = data.resourceTimeRangesData;
        }

        if (data.timeRangesData) {
            this.timeRangeStore.data = data.timeRangesData;
        }

        return super.loadInlineData(data);
    }

    //endregion

    //region JSON

    /**
     * Returns the data from the records of the projects stores, in a format that can be consumed by `loadInlineData()`.
     *
     * Used by JSON.stringify to correctly convert this record to json.
     *
     *
     * ```javascript
     * const project = new ProjectModel({
     *     eventsData             : [...],
     *     resourcesData          : [...],
     *     assignmentsData        : [...],
     *     dependenciesData       : [...],
     *     resourceTimeRangesData : [...],
     *     timeRangesData         : [...]
     * });
     *
     * const json = project.toJSON();
     *
     * // json:
     * {
     *     eventsData             : [...],
     *     resourcesData          : [...],
     *     dependenciesData       : [...],
     *     assignmentsData        : [...],
     *     resourceTimeRangesData : [...],
     *     timeRangesData         : [...]
     * }
     * ```
     *
     * Output can be consumed by `loadInlineData()`:
     *
     * ```javascript
     * const json = project.toJSON();
     *
     * // Plug it back in later
     * project.loadInlineData(json);
     * ```
     *
     * @returns {Object}
     * @category Inline data
     */
    toJSON() {
        const
            me = this,
            result = {
                eventsData             : me.eventStore.toJSON(),
                resourcesData          : me.resourceStore.toJSON(),
                dependenciesData       : me.dependencyStore.toJSON(),
                timeRangesData         : me.timeRangeStore.toJSON(),
                resourceTimeRangesData : me.resourceTimeRangeStore.toJSON()
            };

        if (!me.eventStore.usesSingleAssignment) {
            result.assignmentsData = me.assignmentStore.toJSON();
        }

        return result;
    }

    /**
     * Get or set project data (records from its stores) as a JSON string.
     *
     * Get a JSON string:
     *
     * ```javascript
     * const project = new ProjectModel({
     *     eventsData             : [...],
     *     resourcesData          : [...],
     *     assignmentsData        : [...],
     *     dependenciesData       : [...],
     *     resourceTimeRangesData : [...],
     *     timeRangesData         : [...]
     * });
     *
     * const jsonString = project.json;
     *
     * // jsonString:
     * '{"eventsData":[...],"resourcesData":[...],...}'
     * ```
     *
     * Set a JSON string (to populate the project stores):
     *
     * ```javascript
     * project.json = '{"eventsData":[...],"resourcesData":[...],...}'
     * ```
     *
     * @property {String}
     * @category Inline data
     */
    get json() {
        return super.json;
    }

    changeJson(json) {
        if (typeof json === 'string') {
            json = StringHelper.safeJsonParse(json);
        }

        return json;
    }

    updateJson(json) {
        json && this.loadInlineData(json);
    }

    //endregion

    afterChange(toSet, wasSet) {
        super.afterChange(...arguments);

        if (wasSet.calendar) {
            this.trigger('calendarChange');
        }
    }

    doDestroy() {
        this.timeRangeStore.destroy();
        this.resourceTimeRangeStore.destroy();

        super.doDestroy();
    }
};
