import VersionHelper from '../../Core/helper/VersionHelper.js';
import ProjectModelMixin from './mixin/ProjectModelMixin.js';
import ProjectCurrentConfig from './mixin/ProjectCurrentConfig.js';
import ModelPersistencyManager from '../data/util/ModelPersistencyManager.js';

import { SchedulerCoreProjectMixin } from '../../Engine/quark/model/scheduler_core/SchedulerCoreProjectMixin.js';
import EventModel from './EventModel.js';
import DependencyModel from './DependencyModel.js';
import ResourceModel from './ResourceModel.js';
import AssignmentModel from './AssignmentModel.js';
import EventStore from '../data/EventStore.js';
import DependencyStore from '../data/DependencyStore.js';
import ResourceStore from '../data/ResourceStore.js';
import AssignmentStore from '../data/AssignmentStore.js';

const EngineMixin = SchedulerCoreProjectMixin;

/**
 * @module Scheduler/model/ProjectModel
 */

/**
 * This class represents a global project of your Scheduler - a central place for all data.
 *
 * It holds and links the stores usually used by Scheduler:
 *
 * - {@link Scheduler.data.EventStore}
 * - {@link Scheduler.data.ResourceStore}
 * - {@link Scheduler.data.AssignmentStore}
 * - {@link Scheduler.data.DependencyStore}
 * - {@link #config-timeRangeStore TimeRangeStore}
 * - {@link Scheduler.data.ResourceTimeRangeStore}
 *
 * The project uses a calculation engine to normalize dates and durations. It is also responsible for
 * handling references between models, for example to link an event via an assignment to a resource. These operations
 * are asynchronous, a fact that is hidden when working in the Scheduler UI but which you must know about when performing
 * more advanced operations on the data level.
 *
 * When there is a change to data that requires something else to be recalculated, the project schedules a calculation (a
 * commit) which happens moments later. It is also possible to trigger these calculations directly. This snippet illustrate
 * the process:
 *
 1. Something changes which requires the project to recalculate, for example adding a new task:
 *
 * ```javascript
 * const [event] = project.eventStore.add({ startDate, endDate });
 * ```
 *
 * 2. A recalculation is scheduled, thus:
 *
 * ```javascript
 * event.duration; // <- Not yet calculated
 * ```
 *
 * 3. Calculate now instead of waiting for the scheduled calculation
 *
 * ```javascript
 * await project.commitAsync();
 *
 * event.duration; // <- Now available
 * ```
 *
 * ## Using inline data
 *
 * The project provides settable property {@link Scheduler.crud.AbstractCrudManager#property-inlineData} that can
 * be used to get data from all its stores at once and to set this data as well. Populating the stores this way can
 * be useful if you cannot or you do not want to use CrudManager for server requests but you pull the data by other
 * means and have it ready outside of ProjectModel. Also, the data from all stores is available in a single
 * assignment statement.
 *
 * ### Getting data
 * ```javascript
 * const data = scheduler.project.inlineData;
 *
 * // use the data in your application
 * ```
 *
 * ### Setting data
 * ```javascript
 * const data = // your function to pull server data
 *
 * scheduler.project.inlineData = data;
 * ```
 *
 * ## Monitoring data changes
 *
 * While it is possible to listen for data changes on the projects individual stores, it is sometimes more convenient
 * to have a centralized place to handle all data changes. By listening for the {@link #event-change change event} your
 * code gets notified when data in any of the stores changes. Useful for example to keep an external data model up to
 * date:
 *
 * ```javascript
 * const scheduler = new Scheduler({
 *     project: {
 *         listeners : {
 *             change({ store, action, records }) {
 *                 const { $name } = store.constructor;
 *
 *                 if (action === 'add') {
 *                     externalDataModel.add($name, records);
 *                 }
 *
 *                 if (action === 'remove') {
 *                     externalDataModel.remove($name, records);
 *                 }
 *             }
 *         }
 *     }
 * });
 * ```
 *
 * ## Built in StateTrackingManager
 *
 * The project also has a built in {@link Core.data.stm.StateTrackingManager StateTrackingManager} (STM for short), that
 * handles undo/redo for the project stores (additional stores can also be added). You can enable it to track all
 * project store changes:
 *
 * ```javascript
 * // Turn on auto recording when you create your Scheduler:
 * const scheduler = new Scheduler({
 *    project : {
 *        stm : {
 *            autoRecord : true
 *        }
 *    }
 * });
 *
 * // Undo a transaction
 * project.stm.undo();
 *
 * // Redo
 * project.stm.redo();
 * ```
 *
 * Check out the `undoredo` demo to see it in action.
 *
 * @extends Core/data/Model
 * @mixes Scheduler/model/mixin/ProjectModelMixin
 * @uninherit Core/data/mixin/TreeNode
 */
export default class ProjectModel extends ProjectCurrentConfig(ProjectModelMixin(EngineMixin)) {
    static get $name() {
        return 'ProjectModel';
    }

    //region Inline data configs & properties

    /**
     * @hidefields id, readOnly, children, parentId, parentIndex
     */

    /**
     * Get/set {@link #property-eventStore} data.
     *
     * Always returns an array of {@link Scheduler.model.EventModel EventModels} but also accepts an array of
     * its configuration objects as input.
     *
     * @member {Scheduler.model.EventModel[]} events
     * @accepts {Scheduler.model.EventModel[]|Object[]}
     * @category Inline data
     */
    /**
     * Data use to fill the {@link #property-eventStore}. Should be an array of
     * {@link Scheduler.model.EventModel EventModels} or its configuration objects.
     *
     * @config {Scheduler.model.EventModel[]|Object[]} events
     * @category Inline data
     */

    /**
     * Get/set {@link #property-resourceStore} data.
     *
     * Always returns an array of {@link Scheduler.model.ResourceModel ResourceModels} but also accepts an array
     * of its configuration objects as input.
     *
     * @member {Scheduler.model.ResourceModel[]} resources
     * @accepts {Scheduler.model.ResourceModel[]|Object[]}
     * @category Inline data
     */
    /**
     * Data use to fill the {@link #property-resourceStore}. Should be an array of
     * {@link Scheduler.model.ResourceModel ResourceModels} or its configuration objects.
     *
     * @config {Scheduler.model.ResourceModel[]|Object[]} resources
     * @category Inline data
     */

    /**
     * Get/set {@link #property-assignmentStore} data.
     *
     * Always returns an array of {@link Scheduler.model.AssignmentModel AssignmentModels} but also accepts an
     * array of its configuration objects as input.
     *
     * @member {Scheduler.model.AssignmentModel[]} assignments
     * @accepts {Scheduler.model.AssignmentModel[]|Object[]}
     * @category Inline data
     */
    /**
     * Data use to fill the {@link #property-assignmentStore}. Should be an array of
     * {@link Scheduler.model.AssignmentModel AssignmentModels} or its configuration objects.
     *
     * @config {Scheduler.model.AssignmentModel[]|Object[]} assignments
     * @category Inline data
     */

    /**
     * Get/set {@link #property-dependencyStore} data.
     *
     * Always returns an array of {@link Scheduler.model.DependencyModel DependencyModels} but also accepts an
     * array of its configuration objects as input.
     *
     * @member {Scheduler.model.DependencyModel[]} dependencies
     * @accepts {Scheduler.model.DependencyModel[]|Object[]}
     * @category Inline data
     */
    /**
     * Data use to fill the {@link #property-dependencyStore}. Should be an array of
     * {@link Scheduler.model.DependencyModel DependencyModels} or its configuration objects.
     *
     * @config {Scheduler.model.DependencyModel[]|Object[]} dependencies
     * @category Inline data
     */

    /**
     * Get/set {@link #property-timeRangeStore} data.
     *
     * Always returns an array of {@link Scheduler.model.TimeSpan TimeSpans} but also accepts an
     * array of its configuration objects as input.
     *
     * @member {Scheduler.model.TimeSpan[]} timeRanges
     * @accepts {Scheduler.model.TimeSpan[]|Object[]}
     * @category Inline data
     */
    /**
     * Data use to fill the {@link #property-timeRangeStore}. Should be an array of
     * {@link Scheduler.model.TimeSpan TimeSpans} or its configuration objects.
     *
     * @config {Scheduler.model.TimeSpan[]|Object[]} timeRanges
     * @category Inline data
     */

    /**
     * Get/set {@link #property-resourceTimeRangeStore} data.
     *
     * Always returns an array of {@link Scheduler.model.ResourceTimeRangeModel ResourceTimeRangeModels} but
     * also accepts an array of its configuration objects as input.
     *
     * @member {Scheduler.model.ResourceTimeRangeModel[]} resourceTimeRanges
     * @accepts {Scheduler.model.ResourceTimeRangeModel[]|Object[]}
     * @category Inline data
     */
    /**
     * Data use to fill the {@link #property-resourceTimeRangeStore}. Should be an array
     * of {@link Scheduler.model.ResourceTimeRangeModel ResourceTimeRangeModels} or its configuration objects.
     *
     * @config {Scheduler.model.ResourceTimeRangeModel[]|Object[]} resourceTimeRanges
     * @category Inline data
     */

    //endregion

    //region Legacy inline data configs & properties

    /**
     * The initial data, to fill the {@link #property-eventStore eventStore} with.
     * Should be an array of {@link Scheduler.model.EventModel EventModels} or its configuration objects.
     *
     * @config {Scheduler.model.EventModel[]} eventsData
     * @category Legacy inline data
     */

    /**
     * The initial data, to fill the {@link #property-dependencyStore dependencyStore} with.
     * Should be an array of {@link Scheduler.model.DependencyModel DependencyModels} or its configuration
     * objects.
     *
     * @config {Scheduler.model.DependencyModel[]} [dependenciesData]
     * @category Legacy inline data
     */

    /**
     * The initial data, to fill the {@link #property-resourceStore resourceStore} with.
     * Should be an array of {@link Scheduler.model.ResourceModel ResourceModels} or its configuration objects.
     *
     * @config {Scheduler.model.ResourceModel[]} [resourcesData]
     * @category Legacy inline data
     */

    /**
     * The initial data, to fill the {@link #property-assignmentStore assignmentStore} with.
     * Should be an array of {@link Scheduler.model.AssignmentModel AssignmentModels} or its configuration
     * objects.
     *
     * @config {Scheduler.model.AssignmentModel[]} [assignmentsData]
     * @category Legacy inline data
     */

    //endregion

    //region Store configs & properties

    /**
     * The {@link Scheduler.data.EventStore store} holding the events information.
     *
     * See also {@link Scheduler.model.EventModel}
     *
     * @member {Scheduler.data.EventStore} eventStore
     * @category Models & Stores
     */
    /**
     * An {@link Scheduler.data.EventStore} instance or a config object.
     * @config {Scheduler.data.EventStore|Object} eventStore
     * @category Models & Stores
     */

    /**
     * The {@link Scheduler.data.DependencyStore store} holding the dependencies information.
     *
     * See also {@link Scheduler.model.DependencyModel}
     *
     * @member {Scheduler.data.DependencyStore} dependencyStore
     * @category Models & Stores
     */
    /**
     * A {@link Scheduler.data.DependencyStore} instance or a config object.
     * @config {Scheduler.data.DependencyStore|Object} dependencyStore
     * @category Models & Stores
     */

    /**
     * The {@link Scheduler.data.ResourceStore store} holding the resources that can be assigned to the events in the event store.
     *
     * See also {@link Scheduler.model.ResourceModel}
     *
     * @member {Scheduler.data.ResourceStore} resourceStore
     * @category Models & Stores
     */
    /**
     * A {@link Scheduler.data.ResourceStore} instance or a config object.
     * @config {Scheduler.data.ResourceStore|Object} resourceStore
     * @category Models & Stores
     */

    /**
     * The {@link Scheduler.data.AssignmentStore store} holding the assignments information.
     *
     * See also {@link Scheduler.model.AssignmentModel}
     *
     * @member {Scheduler.data.AssignmentStore} assignmentStore
     * @category Models & Stores
     */
    /**
     * An {@link Scheduler.data.AssignmentStore} instance or a config object.
     * @config {Scheduler.data.AssignmentStore|Object} assignmentStore
     * @category Models & Stores
     */

    //endregion

    //region Configs

    static get defaultConfig() {
        return {
            /**
             * The constructor of the event model class, to be used in the project. Will be set as the
             * {@link Core.data.Store#config-modelClass modelClass} property of the {@link #property-eventStore}
             *
             * @config {Scheduler.model.EventModel}
             * @typings {typeof EventModel}
             * @category Models & Stores
             */
            eventModelClass : EventModel,

            /**
             * The constructor of the dependency model class, to be used in the project. Will be set as the
             * {@link Core.data.Store#config-modelClass modelClass} property of the {@link #property-dependencyStore}
             *
             * @config {Scheduler.model.DependencyModel}
             * @typings {typeof DependencyModel}
             * @category Models & Stores
             */
            dependencyModelClass : DependencyModel,

            /**
             * The constructor of the resource model class, to be used in the project. Will be set as the
             * {@link Core.data.Store#config-modelClass modelClass} property of the {@link #property-resourceStore}
             *
             * @config {Scheduler.model.ResourceModel}
             * @typings {typeof ResourceModel}
             * @category Models & Stores
             */
            resourceModelClass : ResourceModel,

            /**
             * The constructor of the assignment model class, to be used in the project. Will be set as the
             * {@link Core.data.Store#config-modelClass modelClass} property of the {@link #property-assignmentStore}
             *
             * @config {Scheduler.model.AssignmentModel}
             * @typings {typeof AssignmentModel}
             * @category Models & Stores
             */
            assignmentModelClass : AssignmentModel,

            /**
             * The constructor to create an event store instance with. Should be a class, subclassing the
             * {@link Scheduler.data.EventStore}
             * @config {Scheduler.data.EventStore|Object}
             * @typings {typeof EventStore|object}
             * @category Models & Stores
             */
            eventStoreClass : EventStore,

            /**
             * The constructor to create a dependency store instance with. Should be a class, subclassing the
             * {@link Scheduler.data.DependencyStore}
             * @config {Scheduler.data.DependencyStore|Object}
             * @typings {typeof DependencyStore|object}
             * @category Models & Stores
             */
            dependencyStoreClass : DependencyStore,

            /**
             * The constructor to create a resource store instance with. Should be a class, subclassing the
             * {@link Scheduler.data.ResourceStore}
             * @config {Scheduler.data.ResourceStore|Object}
             * @typings {typeof ResourceStore|object}
             * @category Models & Stores
             */
            resourceStoreClass : ResourceStore,

            /**
             * The constructor to create an assignment store instance with. Should be a class, subclassing the
             * {@link Scheduler.data.AssignmentStore}
             * @config {Scheduler.data.AssignmentStore|Object}
             * @typings {typeof AssignmentStore|object}
             * @category Models & Stores
             */
            assignmentStoreClass : AssignmentStore
        };
    }

    //endregion

    //region Events

    /**
     * Fired when the engine has finished its calculations and the results has been written back to the records.
     *
     * ```javascript
     * scheduler.project.on({
     *     dataReady() {
     *        console.log('Calculations finished');
     *     }
     * });
     *
     * scheduler.eventStore.first.duration = 10;
     *
     * // At some point a bit later it will log 'Calculations finished'
     * ```
     *
     * @event dataReady
     * @param {Scheduler.model.ProjectModel} source The project
     */

    //endregion

    /**
     * Silences propagations caused by the project loading.
     *
     * Applying the loaded data to the project occurs in two basic stages:
     *
     * 1. Data gets into the engine graph which triggers changes propagation
     * 2. The changes caused by the propagation get written to related stores
     *
     * Setting this flag to `true` makes the component perform step 2 silently without triggering events causing reactions on those changes
     * (like sending changes back to the server if `autoSync` is enabled) and keeping stores in unmodified state.
     *
     * This is safe if the loaded data is consistent so propagation doesn't really do any adjustments.
     * By default the system treats the data as consistent so this option is `true`.
     *
     * ```js
     * new Scheduler({
     *     project : {
     *         // We want scheduling engine to recalculate the data properly
     *         // so then we could save it back to the server
     *         silenceInitialCommit : false
     *     }
     *     ...
     * })
     * ```
     *
     * @config {Boolean} silenceInitialCommit
     * @default true
     * @category Advanced
     */

    construct(...args) {
        super.construct(...args);

        if (VersionHelper.isTestEnv) {
            globalThis.bryntum.testProject = this;
        }

        // Moved here from EventStore, since project is now the container instead of it
        this.modelPersistencyManager = this.createModelPersistencyManager();
    }

    /**
     * Creates and returns model persistency manager
     *
     * @returns {Scheduler.data.util.ModelPersistencyManager}
     * @internal
     */
    createModelPersistencyManager() {
        return new ModelPersistencyManager({
            eventStore      : this,
            resourceStore   : this.resourceStore,
            assignmentStore : this.assignmentStore,
            dependencyStore : this.dependencyStore
        });
    }

    doDestroy() {
        this.modelPersistencyManager.destroy();
        super.doDestroy();
    }

    // To comply with TaskBoards expectations
    get taskStore() {
        return this.eventStore;
    }
}

ProjectModel.applyConfigs = true;

ProjectModel.initClass();
