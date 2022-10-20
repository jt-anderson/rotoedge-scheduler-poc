import Base from '../../../Core/Base.js';
import Store from '../../../Core/data/Store.js';
import GlobalEvents from '../../../Core/GlobalEvents.js';
import DomHelper from '../../../Core/helper/DomHelper.js';
import ProjectConsumer from '../../data/mixin/ProjectConsumer.js';

/**
 * @module Scheduler/view/mixin/SchedulerStores
 */

/**
 * Functions for store assignment and store event listeners.
 *
 * @mixin
 * @extends Scheduler/data/mixin/ProjectConsumer
 */
export default Target => class SchedulerStores extends ProjectConsumer(Target || Base) {
    static get $name() {
        return 'SchedulerStores';
    }

    //region Default config

    // This is the static definition of the Stores we consume from the project, and
    // which we must provide *TO* the project if we or our CrudManager is configured
    // with them.
    // The property name is the store name, and within that there is the dataName which
    // is the property which provides static data definition. And there is a listeners
    // definition which specifies the listeners *on this object* for each store.
    //
    // To process incoming stores, implement an updateXxxxxStore method such
    // as `updateEventStore(eventStore)`.
    //
    // To process an incoming Project implement `updateProject`. __Note that
    // `super.updateProject(...arguments)` must be called first.__
    static get projectStores() {
        return {
            resourceStore : {
                dataName : 'resources'
            },

            eventStore : {
                dataName  : 'events',
                listeners : {
                    batchedUpdate   : 'onEventStoreBatchedUpdate',
                    changePreCommit : 'onInternalEventStoreChange',
                    commitStart     : 'onEventCommitStart',
                    commit          : 'onEventCommit',
                    exception       : 'onEventException',
                    idchange        : 'onEventIdChange',
                    beforeLoad      : 'applyStartEndParameters'
                }
            },

            assignmentStore : {
                dataName  : 'assignments',
                listeners : {
                    changePreCommit : 'onAssignmentChange', // In EventSelection.js
                    commitStart     : 'onAssignmentCommitStart',
                    commit          : 'onAssignmentCommit',
                    exception       : 'onAssignmentException',
                    beforeRemove    : {
                        fn   : 'onAssignmentBeforeRemove',
                        // We must go last in case an app vetoes a remove
                        // by returning false from a handler.
                        prio : -1000
                    }
                }
            },

            dependencyStore : {
                dataName : 'dependencies'
            },

            calendarManagerStore   : {},
            timeRangeStore         : {},
            resourceTimeRangeStore : {}
        };
    }

    static get configurable() {
        return {
            /**
             * Overridden to *not* auto create a store at the Scheduler level.
             * The store is the {@link Scheduler.data.ResourceStore} of the backing project
             * @config {Core.data.Store}
             * @private
             */
            store : null,

            /**
             * The name of the start date parameter that will be passed to in every `eventStore` load request.
             * @config {String}
             * @category Data
             */
            startParamName : 'startDate',

            /**
             * The name of the end date parameter that will be passed to in every `eventStore` load request.
             * @config {String}
             * @category Data
             */
            endParamName : 'endDate',

            /**
             * true to apply start and end dates of the current view to any `eventStore` load requests.
             * @config {Boolean}
             * @category Data
             */
            passStartEndParameters : false,

            /**
             * Class that should be used to instantiate a CrudManager in case it's provided as a simple object to
             * {@link #config-crudManager} config.
             * @config {Scheduler.data.CrudManager}
             * @typings {typeof CrudManager}
             * @category Data
             */
            crudManagerClass : null,

            /**
             * Get/set the CrudManager instance
             * @member {Scheduler.data.CrudManager} crudManager
             * @category Data
             */
            /**
             * Supply a {@link Scheduler.data.CrudManager CrudManager} instance or a config object if you want to use
             * CrudManager for handling data.
             * @config {Object|Scheduler.data.CrudManager}
             * @category Data
             */
            crudManager : null
        };
    }

    //endregion

    //region Project

    updateProject(project, oldProject) {
        super.updateProject(project, oldProject);

        this.detachListeners('schedulerStores');

        project.on({
            name    : 'schedulerStores',
            refresh : 'onProjectRefresh',
            thisObj : this
        });
    }

    // Called when project changes are committed, before data is written back to records (but still ready to render
    // since data is fetched from engine)
    onProjectRefresh({ isInitialCommit }) {
        const me = this;

        // Only update the UI immediately if we are visible
        if (me.isVisible) {
            if (isInitialCommit) {
                if (me.isVertical) {
                    me.refreshAfterProjectRefresh = false;
                    me.refreshWithTransition();
                }
            }

            if (me.navigateToAfterRefresh) {
                me.navigateTo(me.navigateToAfterRefresh);
                me.navigateToAfterRefresh = null;
            }

            if (me.refreshAfterProjectRefresh) {
                me.refreshWithTransition(false, !isInitialCommit);
                me.refreshAfterProjectRefresh = false;
            }
        }
        // Otherwise wait till next time we get painted (shown, or a hidden ancestor shown)
        else {
            me.whenVisible('refresh', me, [true]);
        }
    }

    //endregion

    //region CrudManager

    changeCrudManager(crudManager) {
        const me = this;

        if (crudManager && !crudManager.isCrudManager) {


            // CrudManager injects itself into is Scheduler's _crudManager property
            // because code it triggers needs to access it through its getter.
            crudManager = me.crudManagerClass.new({
                scheduler : me
            }, crudManager);
        }
        // config setter will veto because of above described behaviour
        // of setting the property early on creation
        me._crudManager = crudManager;

        me.bindCrudManager(crudManager);
    }

    //endregion

    //region Row store

    get store() {
        // Vertical uses a dummy store
        if (!this._store && this.isVertical) {
            // TODO: Make this store readonly, since we are using single cell approach
            this._store = new Store({
                data : [
                    {
                        // Quoted to avoid commit-hook check:
                        'id' : 'verticalTimeAxisRow', // eslint-disable-line quote-props
                        cls  : 'b-verticaltimeaxis-row'
                    }
                ]
            });
        }

        return super.store;
    }

    set store(store) {
        super.store = store;
    }

    // Wrap w/ transition refreshFromRowOnStoreAdd() inherited from Grid
    refreshFromRowOnStoreAdd(row, { isExpand }) {
        const args = arguments;

        this.runWithTransition(() => {
            // Postpone drawing of events for a new resource until the following project refresh. Previously the draw
            // would not happen because engine was not ready, but now when we allow commits and can read values during
            // commit that block is no longer there
            this.currentOrientation.suspended = !isExpand;

            super.refreshFromRowOnStoreAdd(row, ...args);

            this.currentOrientation.suspended = false;
        }, !isExpand);
    }

    onStoreAdd(event) {
        super.onStoreAdd(event);

        if (this.isPainted) {
            this.calculateRowHeights(event.records);
        }
    }

    onStoreUpdateRecord({ source : store, record, changes }) {
        // Ignore engine changes that do not affect row rendering
        let ignoreCount = 0;

        if ('assigned' in changes) {
            ignoreCount++;
        }

        if ('calendar' in changes) {
            ignoreCount++;
        }

        if (ignoreCount !== Object.keys(changes).length) {
            super.onStoreUpdateRecord(...arguments);
        }
    }

    //endregion

    //region ResourceStore

    updateResourceStore(resourceStore) {
        // Reconfigure grid if resourceStore is backing the rows
        if (resourceStore && this.isHorizontal) {
            resourceStore.metaMapId = this.id;
            this.store = resourceStore;
        }
    }

    //endregion

    //region Events

    onEventIdChange(params) {
        this.currentOrientation.onEventStoreIdChange && this.currentOrientation.onEventStoreIdChange(params);
    }

    /**
     * Listener to the batchedUpdate event which fires when a field is changed on a record which
     * is batch updating. Occasionally UIs must keep in sync with batched changes.
     * For example, the EventResize feature performs batched updating of the startDate/endDate
     * and it tells its client to listen to batchedUpdate.
     * @private
     */
    onEventStoreBatchedUpdate(event) {
        if (this.listenToBatchedUpdates) {
            return this.onInternalEventStoreChange(event);
        }
    }

    /**
     * Calls appropriate functions for current event layout when the event store is modified.
     * @private
     */
    // Named as Internal to avoid naming collision with wrappers that relay events
    onInternalEventStoreChange(params) {
        // Too early, bail out
        // Also bail out if this is a reassign using resourceId, any updates will be handled by AssignmentStore instead
        if (!this.isPainted || !this._mode || params.isAssign || this.assignmentStore.isRemovingAssignment) {
            return;
        }

        this.currentOrientation.onEventStoreChange(params);
    }

    /**
     * Refreshes committed events, to remove dirty/committing flag.
     * CSS is added
     * @private
     */
    onEventCommit({ changes }) {
        let resourcesToRepaint = [...changes.added, ...changes.modified].map(
            eventRecord => this.eventStore.getResourcesForEvent(eventRecord)
        );

        // getResourcesForEvent returns an array, so need to flatten resourcesToRepaint
        resourcesToRepaint = Array.prototype.concat.apply([], resourcesToRepaint);

        // repaint relevant resource rows
        new Set(resourcesToRepaint).forEach(
            resourceRecord => this.repaintEventsForResource(resourceRecord)
        );
    }

    /**
     * Adds the committing flag to changed events before commit.
     * @private
     */
    onEventCommitStart({ changes }) {
        const { currentOrientation, committingCls } = this;
        // Committing sets a flag in meta that during event rendering applies a CSS class. But to not mess up drag and
        // drop between resources no redraw is performed before committing, so class is never applied to the element(s).
        // Applying here instead
        [...changes.added, ...changes.modified].forEach(eventRecord =>
            eventRecord.assignments.forEach(
                assignmentRecord => currentOrientation.toggleCls(assignmentRecord, committingCls, true)
            )
        );
    }

    // Clear committing flag
    onEventException({ action }) {
        if (action === 'commit') {
            const { changes } = this.eventStore;

            [...changes.added, ...changes.modified, ...changes.removed].forEach(eventRecord =>
                this.repaintEvent(eventRecord)
            );
        }
    }

    onAssignmentCommit({ changes }) {
        this.repaintEventsForAssignmentChanges(changes);
    }

    onAssignmentCommitStart({ changes }) {
        const { currentOrientation, committingCls } = this;

        [...changes.added, ...changes.modified].forEach(assignmentRecord => {
            currentOrientation.toggleCls(assignmentRecord, committingCls, true);
        });
    }

    // Clear committing flag
    onAssignmentException({ action }) {
        if (action === 'commit') {
            this.repaintEventsForAssignmentChanges(this.assignmentStore.changes);
        }
    }

    repaintEventsForAssignmentChanges(changes) {
        const resourcesToRepaint = [...changes.added, ...changes.modified, ...changes.removed].map(
            assignmentRecord => assignmentRecord.getResource()
        );

        // repaint relevant resource rows
        new Set(resourcesToRepaint).forEach(
            resourceRecord => this.repaintEventsForResource(resourceRecord)
        );
    }

    onAssignmentBeforeRemove({ records, removingAll }) {
        if (removingAll) {
            return;
        }

        const me = this;

        let moveTo;

        // Deassigning the active assignment
        if (!me.isConfiguring &&
            // If we have current active assignment or we scheduled navigating to an assignment, we should check
            // if we're removing that assignment in order to avoid navigating to it
            (me.navigateToAfterRefresh || me.activeAssignment && records.includes(me.activeAssignment))
        ) {
            // If next navigation target is removed, clean up the flag
            if (records.includes(me.navigateToAfterRefresh)) {
                me.navigateToAfterRefresh = null;
            }
            // If being done by a keyboard gesture then look for a close target until we find an existing record, not
            // scheduled for removal. Otherwise, push focus outside of the Scheduler.
            // This condition will react not only on meaningful keyboard action - like pressing DELETE key on selected
            // event - but also in case user started dragging and pressed CTRL (or any other key) in process.
            // https://github.com/bryntum/support/issues/3479
            if (GlobalEvents.lastInteractionType === 'key') {
                // Look for a close target until we find an existing record, not scheduled for removal. Provided
                // assignment position in store is arbitrary as well as order of removed records, it does not make much
                // sense trying to apply any specific order to them. Existing assignment next to any removed one is as
                // good as any.
                for (let i = 0, l = records.length; i < l && !moveTo; i++) {
                    const assignment = records[i];

                    if (assignment.resource && assignment.resource.isModel) {
                        // Find next record
                        let next = me.getNext(assignment);

                        // If next record is not found or also removed, look for previous. This should not become a
                        // performance bottleneck because we only can get to this code if project is committing, if
                        // records are removed on a dragdrop listener and user pressed any key after mousedown, or if
                        // user is operating with a keyboard and pressed [DELETE] to remove multiple records.
                        if (!next || records.includes(next)) {
                            next = me.getPrevious(assignment);
                        }

                        if (next && !records.includes(next)) {
                            moveTo = next;
                        }
                    }
                }
            }

            // Move focus away from the element which will soon have no backing data.
            if (moveTo) {
                // Although removing records from assignment store will trigger project commit and consequently
                // `refresh` event on the project which will use this record to navigate to, some tests expect
                // immediate navigation
                me.navigateTo(moveTo);
                me.navigateToAfterRefresh = moveTo;
            }
            // Focus must exit the Scheduler's subgrid, otherwise, if a navigation
            // key gesture is delivered before the outgoing event's element has faded
            // out and been removed, navigation will be attempted from a deleted
            // event. Animated hiding is problematic.
            //
            // We cannot just revertFocus() because that might move focus back to an
            // element in a floating EventEditor which is not yet faded out and
            // been removed. Animated hiding is problematic.
            //
            // We cannot focus scheduler.timeAxisColumn.element because the browser
            // would scroll it in some way if we have horizontal overflow.
            //
            // The only thing we can know about to focus here is the Scheduler itself.
            else {
                DomHelper.focusWithoutScrolling(me.focusElement);
            }
        }
    }

    //endregion

    //region TimeRangeStore & TimeRanges

    /**
     * Inline time ranges, will be loaded into an internally created store if {@link Scheduler.feature.TimeRanges}
     * is enabled.
     * @config {Scheduler.model.TimeSpan[]|Object[]} timeRanges
     * @category Data
     */

    /**
     * Get/set time ranges, applies to the backing project's TimeRangeStore.
     * @member {Scheduler.model.TimeSpan[]} timeRanges
     * @accepts {Scheduler.model.TimeSpan[]|Object[]}
     * @category Data
     */

    /**
     * Get/set the time ranges store instance or config object for {@link Scheduler.feature.TimeRanges} feature.
     * @member {Core.data.Store} timeRangeStore
     * @accepts {Core.data.Store|Object}
     * @category Data
     */

    /**
     * The time ranges store instance for {@link Scheduler.feature.TimeRanges} feature.
     * @config {Core.data.Store|Object} timeRangeStore
     * @category Data
     */

    set timeRanges(timeRanges) {
        this.project.timeRanges = timeRanges;
    }

    get timeRanges() {
        return this.project.timeRanges;
    }

    //endregion

    //region ResourceTimeRangeStore

    /**
     * Inline resource time ranges, will be loaded into an internally created store if
     * {@link Scheduler.feature.ResourceTimeRanges ResourceTimeRanges} is enabled.
     * @config {Scheduler.model.ResourceTimeRangeModel[]|Object[]} resourceTimeRanges
     * @category Data
     */

    /**
     * Get/set time ranges, applies to the backing project's ResourceTimeRangeStore.
     * @member {Scheduler.model.ResourceTimeRangeModel[]} resourceTimeRanges
     * @accepts {Scheduler.model.ResourceTimeRangeModel[]|Object[]}
     * @category Data
     */

    /**
     * Get/set the resource time ranges store instance for {@link Scheduler.feature.ResourceTimeRanges} feature.
     * @member {Scheduler.data.ResourceTimeRangeStore} resourceTimeRangeStore
     * @accepts {Scheduler.data.ResourceTimeRangeStore|Object}
     * @category Data
     */

    /**
     * Resource time ranges store instance or config object for {@link Scheduler.feature.ResourceTimeRanges} feature.
     * @config {Scheduler.data.ResourceTimeRangeStore|Object} resourceTimeRangeStore
     * @category Data
     */

    set resourceTimeRanges(resourceTimeRanges) {
        this.project.resourceTimeRanges = resourceTimeRanges;
    }

    get resourceTimeRanges() {
        return this.project.resourceTimeRanges;
    }

    //endregion

    //region Other functions

    /**
     * Applies the start and end date to each event store request (formatted in the same way as the start date, defined
     * in the EventStore Model class).
     * @category Data
     */
    applyStartEndParameters({ source : eventStore, params }) {
        const
            me = this,
            field = eventStore.modelClass.fieldMap.startDate;

        if (me.passStartEndParameters) {
            params[me.startParamName] = field.print(me.startDate);
            params[me.endParamName] = field.print(me.endDate);
        }
    }

    /**
     * Get events grouped by timeAxis ticks from resources array
     * @category Data
     * @param {Scheduler.model.ResourceModel[]} resources An array of resources to process. If not passed, all resources
     * will be used.
     * @param {Function} filterFn filter function to filter events if required. Optional.
     * @private
     */
    getResourcesEventsPerTick(resources, filterFn) {
        const
            { timeAxis, resourceStore } = this,
            eventsByTick                = [];

        resources = resources || resourceStore.records;
        resources.forEach(resource => {
            resource.events.forEach(event => {
                if (!timeAxis.isTimeSpanInAxis(event) || (filterFn && !filterFn.call(this, { resource, event }))) {
                    return;
                }
                // getTickFromDate may return float if event starts/ends in a middle of a tick
                let startTick = Math.floor(timeAxis.getTickFromDate(event.startDate)),
                    endTick = Math.ceil(timeAxis.getTickFromDate(event.endDate));

                // if startDate/endDate of the event is out of timeAxis' bounds, use first/last tick id instead
                if (startTick == -1) {
                    startTick = 0;
                }

                if (endTick === -1) {
                    endTick = timeAxis.ticks.length;
                }

                do {
                    if (!eventsByTick[startTick]) {
                        eventsByTick[startTick] = [event];
                    }
                    else {
                        eventsByTick[startTick].push(event);
                    }
                } while (++startTick < endTick);
            });
        });

        return eventsByTick;
    }

    //endregion

    //region WidgetClass

    // This does not need a className on Widgets.
    // Each *Class* which doesn't need 'b-' + constructor.name.toLowerCase() automatically adding
    // to the Widget it's mixed in to should implement thus.
    get widgetClass() {}

    //endregion
};
