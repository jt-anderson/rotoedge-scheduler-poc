import BrowserHelper from '../../../Core/helper/BrowserHelper.js';
import DomSync from '../../../Core/helper/DomSync.js';
import Base from '../../../Core/Base.js';
import Model from '../../../Core/data/Model.js';
import ArrayHelper from '../../../Core/helper/ArrayHelper.js';
import DomHelper from '../../../Core/helper/DomHelper.js';
import Rectangle from '../../../Core/helper/util/Rectangle.js';
import DateHelper from '../../../Core/helper/DateHelper.js';
import AttachToProjectMixin from '../../data/mixin/AttachToProjectMixin.js';

/**
 * @module Scheduler/view/orientation/HorizontalRendering
 */

/**
 * @typedef HorizontalRenderData
 * @property {Scheduler.model.EventModel} eventRecord
 * @property {Date} start Span start
 * @property {Date} end Span end
 * @property {String} rowId Id of the resource row
 * @property {Object[]} children Child elements
 * @property {Number} startMS Wrap element start in milliseconds
 * @property {Number} endMS Span Wrap element end in milliseconds
 * @property {Number} durationMS Wrap duration in milliseconds (not just a difference between start and end)
 * @property {Number} innerStartMS Actual event start in milliseconds
 * @property {Number} innerEndMS Actual event end in milliseconds
 * @property {Number} innerDurationMS Actual event duration in milliseconds
 * @property {Boolean} startsOutsideView True if span starts before time axis start
 * @property {Boolean} endsOutsideView True if span ends after time axis end
 * @property {Number} left Absolute left coordinate of the wrap element
 * @property {Number} width
 * @property {Number} top Absolute top coordinate of the wrap element (can be changed by layout)
 * @property {Number} height
 * @property {Boolean} clippedStart True if start is clipped
 * @property {Boolean} clippedEnd True if end is clipped
 * @private
 */

const
    releaseEventActions = {
        releaseElement : 1, // Not used at all at the moment
        reuseElement   : 1  // Used by some other element
    },
    renderEventActions  = {
        newElement      : 1,
        reuseOwnElement : 1,
        reuseElement    : 1
    },
    MAX_WIDTH           = 9999999,
    heightEventSorter   = ({ startDateMS : lhs }, { startDateMS : rhs }) => lhs - rhs,
    chronoFields        = {
        startDate : 1,
        endDate   : 1,
        duration  : 1
    };

function getStartEnd(scheduler, eventRecord, useEnd, fieldName, useEventBuffer) {
    // Must use Model.get in order to get latest values in case we are inside a batch.
    // EventResize changes the endDate using batching to enable a tentative change
    // via the batchedUpdate event which is triggered when changing a field in a batch.
    // Fall back to accessor if propagation has not populated date fields.
    const
        { timeAxis }     = scheduler,
        date             = eventRecord.isBatchUpdating && !useEventBuffer ? eventRecord.get(fieldName) : eventRecord[fieldName],
        hasBatchedChange = eventRecord.hasBatchedChange?.(fieldName),
        // fillTicks shouldn't be used during resizing for changing date for smooth animation.
        // correct date will be applied after resize, when `isResizing` will be falsy
        useTickDates     = scheduler.fillTicks && (!eventRecord.meta.isResizing || !hasBatchedChange);

    if (useTickDates) {
        let tick = timeAxis.getTickFromDate(date);

        if (tick >= 0) {
            // If date matches a tick start/end, use the earlier tick
            if (useEnd && tick === Math.round(tick) && tick > 0) {
                tick--;
            }

            const
                tickIndex  = Math.floor(tick),
                tickRecord = timeAxis.getAt(tickIndex);

            return tickRecord[fieldName].getTime();
        }
    }

    return date?.getTime();
}

/**
 * Handles event rendering in Schedulers horizontal mode. Reacts to project/store changes to keep the UI up to date.
 *
 * @internal
 */
export default class HorizontalRendering extends Base.mixin(AttachToProjectMixin) {
    //region Config & Init

    static $name = 'HorizontalRendering';

    static get configurable() {
        return {
            // It's needed to adjust visible date range in Export. Set to 100 to render additional 100px
            // worth of ticks which helps to scroll faster during export and fixes
            // issue when scrollToDate cannot reach panel end date on exceptionally narrow view
            scrollBuffer : 0,

            /**
             * Amount of pixels to extend the current visible range at both ends with when deciding which events to
             * render. Only applies when using labels or for milestones
             * @config {Number}
             * @default
             */
            bufferSize : 150,

            verticalBufferSize : 150
        };
    }

    static get properties() {
        return {
            // Map with event DOM configs, keyed by resource id
            resourceMap            : new Map(),
            // Map with visible events DOM configs, keyed by row instance
            rowMap                 : new Map(),
            eventConfigs           : [],
            // Flag to avoid transitioning on first refresh
            isFirstRefresh         : true,
            toDrawOnProjectRefresh : new Set(),
            toDrawOnDataReady      : new Set()
        };
    }

    construct(scheduler) {
        const me = this;

        me.client = me.scheduler = scheduler;

        me.eventSorter = me.eventSorter.bind(scheduler);

        // Catch scroll before renderers are called
        scheduler.scrollable.on({
            scroll  : 'onEarlyScroll',
            prio    : 1,
            thisObj : me
        });

        scheduler.rowManager.on({
            name            : 'rowManager',
            renderDone      : 'onRenderDone',
            removeRows      : 'onRemoveRows',
            translateRow    : 'onTranslateRow',
            beforeRowHeight : 'onBeforeRowHeightChange',
            thisObj         : me
        });

        super.construct({});
    }

    init() {}

    updateVerticalBufferSize() {
        const { rowManager } = this.scheduler;

        if (this.scheduler.isPainted) {
            // Refresh rows when vertical buffer size changes to trigger event repaint. Required for the export feature.
            rowManager.renderRows(rowManager.rows);
        }
    }

    //endregion

    //region Region, dates & coordinates

    get visibleDateRange() {
        return this._visibleDateRange;
    }

    getDateFromXY(xy, roundingMethod, local, allowOutOfRange = false) {
        const { scheduler } = this;

        let coord = xy[0];

        if (!local) {
            coord = this.translateToScheduleCoordinate(coord);
        }

        coord = scheduler.getRtlX(coord);

        return scheduler.timeAxisViewModel.getDateFromPosition(coord, roundingMethod, allowOutOfRange);
    }

    translateToScheduleCoordinate(x) {
        // Get rid of fractional pixels, to not end up with negative fractional values for pos
        const pos = x - this.scheduler.timeAxisSubGridElement.getBoundingClientRect().left;

        // Because we use getBoundingClientRect's left, we have to adjust for page scroll.
        // The vertical counterpart uses the _bodyRectangle which was created with that adjustment.
        return pos + this.scheduler.scrollLeft - globalThis.pageXOffset;
    }

    translateToPageCoordinate(x) {
        const element = this.scheduler.timeAxisSubGridElement;
        return x + element.getBoundingClientRect().left - element.scrollLeft;
    }

    /**
     * Gets the region, relative to the page, represented by the schedule and optionally only for a single resource.
     * This method will call getDateConstraints to allow for additional resource/event based constraints. By overriding
     * that method you can constrain events differently for different resources.
     * @param {Scheduler.model.ResourceModel} [resourceRecord] (optional) The row record
     * @param {Scheduler.model.EventModel} [eventRecord] (optional) The event record
     * @returns {Core.helper.util.Rectangle} The region of the schedule
     */
    getScheduleRegion(resourceRecord, eventRecord, local = true, dateConstraints, stretch = false) {
        const
            me                                   = this,
            { scheduler }                        = me,
            { timeAxisSubGridElement, timeAxis } = scheduler,
            resourceMargin                       = (!stretch || resourceRecord) && scheduler.getResourceMargin(resourceRecord) || 0;

        let region;

        if (resourceRecord) {
            const eventElement = eventRecord && scheduler.getElementsFromEventRecord(eventRecord, resourceRecord)[0];

            region = Rectangle.from(scheduler.getRowById(resourceRecord.id).getElement('normal'), timeAxisSubGridElement);

            if (eventElement) {
                const eventRegion = Rectangle.from(eventElement, timeAxisSubGridElement);

                region.y = eventRegion.y;
                region.bottom = eventRegion.bottom;
            }
            else {
                region.y = region.y + resourceMargin;
                region.bottom = region.bottom - resourceMargin;
            }
        }
        else {
            // TODO: This is what the function that was removed here did.
            // The coordinate space needs to be sorted out here!
            region = Rectangle.from(timeAxisSubGridElement).moveTo(null, 0);
            region.width = timeAxisSubGridElement.scrollWidth;

            region.y = region.y + resourceMargin;
            region.bottom = region.bottom - resourceMargin;
        }

        const
            taStart         = timeAxis.startDate,
            taEnd           = timeAxis.endDate;

        dateConstraints = (dateConstraints?.start && dateConstraints) || scheduler.getDateConstraints?.(resourceRecord, eventRecord) || {
            start : taStart,
            end   : taEnd
        };

        let startX          = scheduler.getCoordinateFromDate(dateConstraints.start ? DateHelper.max(taStart, dateConstraints.start) : taStart),
            endX            = scheduler.getCoordinateFromDate(dateConstraints.end ? DateHelper.min(taEnd, dateConstraints.end) : taEnd);

        if (!local) {
            startX = me.translateToPageCoordinate(startX);
            endX = me.translateToPageCoordinate(endX);
        }

        region.left = Math.min(startX, endX);
        region.right = Math.max(startX, endX);

        return region;
    }

    /**
     * Gets the Region, relative to the timeline view element, representing the passed row and optionally just for a
     * certain date interval.
     * @param {Core.data.Model} rowRecord The row record
     * @param {Date} startDate A start date constraining the region
     * @param {Date} endDate An end date constraining the region
     * @returns {Core.helper.util.Rectangle} The Rectangle which encapsulates the row
     */
    getRowRegion(rowRecord, startDate, endDate) {
        const
            { scheduler } = this,
            { timeAxis }  = scheduler,
            row           = scheduler.getRowById(rowRecord.id);

        // might not be rendered
        if (!row) {
            return null;
        }

        const
            taStart    = timeAxis.startDate,
            taEnd      = timeAxis.endDate,
            start      = startDate ? DateHelper.max(taStart, startDate) : taStart,
            end        = endDate ? DateHelper.min(taEnd, endDate) : taEnd,
            startX     = scheduler.getCoordinateFromDate(start),
            endX       = scheduler.getCoordinateFromDate(end, true, true),
            y          = row.top,
            x          = Math.min(startX, endX),
            bottom     = y + row.offsetHeight;

        return new Rectangle(x, y, Math.max(startX, endX) - x, bottom - y);
    }

    getResourceEventBox(eventRecord, resourceRecord, includeOutside, roughly = false) {
        const resourceData = this.resourceMap.get(resourceRecord.id);

        let eventLayout  = null,
            approx       = false;

        if (resourceData) {
            eventLayout = resourceData.eventsData.find(d => d.eventRecord === eventRecord);
        }

        // Outside of view, layout now if supposed to be included
        if (!eventLayout) {
            eventLayout = this.getTimeSpanRenderData(
                eventRecord,
                resourceRecord,
                { viewport : true, timeAxis : includeOutside }
            );

            approx = true;
        }

        if (eventLayout) {
            // Event layout is relative to row, need to make to absolute before returning
            const
                rowBox      = this.scheduler.rowManager.getRecordCoords(resourceRecord, true, roughly),
                absoluteTop = eventLayout.top + rowBox.top,
                box         = new Rectangle(eventLayout.left, absoluteTop, eventLayout.width, eventLayout.height);

            // Flag informing other parts of the code that this box is approximated
            box.layout = !approx;
            box.rowTop = rowBox.top;
            box.rowBottom = rowBox.bottom;

            box.resourceId = resourceRecord.id;

            return box;
        }

        return null;
    }

    //endregion

    //region Element <-> Record mapping

    resolveRowRecord(elementOrEvent) {
        const
            me             = this,
            { scheduler }  = me,
            element        = elementOrEvent.nodeType ? elementOrEvent : elementOrEvent.target,
            // Fix for FF on Linux having text nodes as event.target
            el             = element.nodeType === Element.TEXT_NODE ? element.parentElement : element,
            eventNode      = DomHelper.up(el, scheduler.eventSelector);

        if (eventNode) {
            return me.resourceStore.getById(eventNode.dataset.resourceId);
        }

        return scheduler.getRecordFromElement(el);
    }

    //endregion

    //region Project

    attachToProject(project) {
        super.attachToProject(project);

        this.refreshAllWhenReady = true;

        // Perform a full clear when replacing the project, to not leave any references to old project in DOM
        if (!this.scheduler.isConfiguring) {
            this.clearAll({ clearDom : true });
        }

        project?.on({
            name            : 'project',
            refresh         : 'onProjectRefresh',
            commitFinalized : 'onProjectCommitFinalized',
            thisObj         : this
        });
    }

    onProjectCommitFinalized() {
        const { scheduler, toDrawOnDataReady } = this;

        // Only update the UI immediately if we are visible
        if (scheduler.isVisible) {
            if (scheduler.isPainted && !scheduler.refreshSuspended) {
                if (toDrawOnDataReady.size) {
                    this.clearResources(toDrawOnDataReady);
                    this.refreshResources(toDrawOnDataReady);
                }

                toDrawOnDataReady.clear();
            }
        }
        // Otherwise wait till next time we get painted (shown, or a hidden ancestor shown)
        else {
            scheduler.whenVisible('refreshRows');
        }
    }

    onProjectRefresh({ isCalculated, isInitialCommit }) {
        const
            me                                    = this,
            { scheduler, toDrawOnProjectRefresh } = me;

        // Only update the UI immediately if we are visible
        if (scheduler.isVisible) {
            if (scheduler.isPainted && !scheduler.isConfiguring && !scheduler.refreshSuspended) {
                // Either refresh all rows (on for example dataset or when delayed calculations are finished)
                if (me.refreshAllWhenReady || (isInitialCommit && isCalculated)) {
                    scheduler.calculateAllRowHeights(true);
                    const { rowManager } = scheduler;

                    // Rows rendered? Refresh
                    if (rowManager.topRow) {
                        me.clearAll();

                        // Refresh only if it won't be refreshed elsewhere (SchedulerStore#onProjectRefresh())
                        if (!scheduler.refreshAfterProjectRefresh) {
                            // If refresh was suspended when replacing the dataset in a scrolled view we might end up with a
                            // topRow outside of available range -> reset it. Call renderRows() to mimic what normally happens
                            // when refresh is not suspended
                            if (rowManager.topRow.dataIndex >= scheduler.store.count) {
                                scheduler.renderRows(false);
                            }
                            else {
                                // Dont transition first refresh / early render
                                scheduler.refreshWithTransition(false, !me.isFirstRefresh && isCalculated && !isInitialCommit);
                            }
                        }

                        me.isFirstRefresh = false;
                    }
                    // No rows yet, reinitialize (happens if initial project empty and then non empty project assigned)
                    else {
                        rowManager.reinitialize();
                    }

                    me.refreshAllWhenReady = false;
                }
                // Or only affected rows (if any)
                else if (toDrawOnProjectRefresh.size) {
                    //me.clearResources(toDrawOnProjectRefresh);
                    me.refreshResources(toDrawOnProjectRefresh);
                }

                toDrawOnProjectRefresh.clear();
            }
        }
        // Otherwise wait till next time we get painted (shown, or a hidden ancestor shown)
        else {
            scheduler.whenVisible('refresh', scheduler, [true]);
        }
    }

    //endregion

    //region AssignmentStore

    attachToAssignmentStore(assignmentStore) {
        this.refreshAllWhenReady = true;

        super.attachToAssignmentStore(assignmentStore);

        if (assignmentStore) {
            assignmentStore.on({
                name             : 'assignmentStore',
                changePreCommit  : 'onAssignmentStoreChange',
                refreshPreCommit : 'onAssignmentStoreRefresh',
                thisObj          : this
            });
        }
    }

    onAssignmentStoreChange({ action, records : assignmentRecords = [], replaced, changes }) {
        const
            me                = this,
            { scheduler }     = me,
            resourceIds       = new Set(assignmentRecords.map(assignmentRecord => assignmentRecord.resourceId));

        // Ignore assignment changes caused by removing resources, the remove will redraw things anyway
        // Also ignore case when resource id is changed. In this case row will be refreshed by the grid
        if (me.resourceStore.isRemoving || me.resourceStore.isChangingId) {
            return;
        }

        switch (action) {
            // These operations will invalidate the graph, need to draw later
            case 'dataset': {
                // Ignore dataset when using single assignment mode
                if (!me.eventStore.usesSingleAssignment) {
                    if (resourceIds.size) {
                        me.refreshResourcesWhenReady(resourceIds);
                    }
                    else {
                        me.clearAll();
                        scheduler.refreshWithTransition();
                    }
                }
                return;
            }

            case 'add':
            case 'remove':
            case 'updateMultiple': // TODO: Dont think updateMultiple is covered by any test...
                me.refreshResourcesWhenReady(resourceIds);
                return;

            case 'removeall':
                me.refreshAllWhenReady = true;
                return;

            case 'replace':
                // Gather resources from both the old record and the new one
                replaced.forEach(([oldAssignment, newAssignment]) => {
                    resourceIds.add(oldAssignment.resourceId);
                    resourceIds.add(newAssignment.resourceId);
                });
                // And refresh them
                me.refreshResourcesWhenReady(resourceIds);
                return;

            // These operations wont invalidate the graph, redraw now
            case 'filter':
                me.clearAll();
                scheduler.calculateAllRowHeights(true);
                scheduler.refreshWithTransition();
                return;

            case 'update': {
                if ('eventId' in changes || 'resourceId' in changes || 'id' in changes) {
                    // When reassigning, clear old resource also
                    if ('resourceId' in changes) {
                        resourceIds.add(changes.resourceId.oldValue);
                    }

                    me.refreshResourcesOnDataReady(resourceIds);
                }
                break;
            }

            case 'clearchanges': {
                const { added, modified, removed } = changes;

                // If modified records appear in the clearchanges action we need to refresh entire view
                // because we have not enough information about previously assigned resource
                if (modified) {
                    scheduler.refreshWithTransition();
                }
                else {
                    added.forEach(r => resourceIds.add(r.resourceId));
                    removed.forEach(r => resourceIds.add(r.resourceId));

                    me.refreshResourcesOnDataReady(resourceIds);

                }
            }
        }
    }

    onAssignmentStoreRefresh({ action, records }) {
        if (action === 'batch') {
            this.clearAll();
            this.scheduler.refreshWithTransition();
        }
    }

    //endregion

    //region EventStore

    attachToEventStore(eventStore) {
        this.refreshAllWhenReady = true;

        super.attachToEventStore(eventStore);

        if (eventStore) {
            eventStore.on({
                name             : 'eventStore',
                refreshPreCommit : 'onEventStoreRefresh',
                thisObj          : this
            });
        }
    }

    onEventStoreRefresh({ action }) {
        if (action === 'batch') {
            const { scheduler } = this;
            if (scheduler.isEngineReady && scheduler.isPainted) {
                this.clearAll();
                scheduler.refreshWithTransition();
            }
            // else {
            //     this.refreshAllWhenReady = true;
            // }
        }
    }

    onEventStoreChange({ action, records : eventRecords = [], record, replaced, changes, source }) {
        const
            me                  = this,
            { scheduler }       = me,
            isResourceTimeRange = source.isResourceTimeRangeStore,
            resourceIds         = new Set();

        if (!scheduler.isPainted) {
            return;
        }

        eventRecords.forEach(eventRecord => {
            // When rendering a Gantt project, the project model also passes through here -> no `resources`
            eventRecord.resources?.forEach(resourceRecord => resourceIds.add(resourceRecord.id));
        });

        if (isResourceTimeRange) {
            switch (action) {
                // - dataset cant pass through same path as events, which relies on project being invalidated. and
                // resource time ranges does not pass through engine
                // - removeall also needs special path, since no resources to redraw will be collected
                case 'removeall':
                case 'dataset':
                    me.clearAll();
                    scheduler.refreshWithTransition();
                    return;
            }

            me.refreshResources(resourceIds);
        }
        else {
            switch (action) {
                // No-ops
                case 'batch': // Handled elsewhere, dont want it to clear again
                case 'sort':  // Order in EventStore does not matter, so these actions are no-ops
                case 'group':
                case 'move':
                    return;

                case 'remove':
                    // Remove is a no-op since assignment will also be removed
                    return;

                case 'clearchanges':
                    me.clearAll();
                    scheduler.refreshWithTransition();
                    return;

                case 'dataset':
                    me.clearAll();
                    me.refreshAllWhenReady = true;
                    return;

                case 'add':
                case 'updateMultiple':
                    // Just refresh below
                    break;

                case 'replace':
                    // Gather resources from both the old record and the new one
                    replaced.forEach(([, newEvent]) => {
                        // Old cleared by changed assignment
                        newEvent.resources.map(resourceRecord => resourceIds.add(resourceRecord.id));
                    });
                    break;

                case 'removeall':
                case 'filter':
                    // Filter might be caused by add retriggering filters, in which case we need to refresh later
                    if (!scheduler.isEngineReady) {
                        me.refreshAllWhenReady = true;
                        return;
                    }

                    // Clear all when filtering for simplicity. If that turns out to give bad performance, one would need to
                    // figure out which events was filtered out and only clear their resources.
                    me.clearAll();
                    scheduler.calculateAllRowHeights(true);
                    scheduler.refreshWithTransition();
                    return;

                case 'update': {
                    // Check if changes are graph related or not
                    const allChrono = record.$entity
                        ? !Object.keys(changes).some(name => !record.$entity.getField(name))
                        : !Object.keys(changes).some(name => !chronoFields[name]);

                    let dateChanges = 0;
                    'startDate' in changes && dateChanges++;
                    'endDate' in changes && dateChanges++;
                    'duration' in changes && dateChanges++;

                    if ('resourceId' in changes) {
                        resourceIds.add(changes.resourceId.oldValue);
                    }

                    // Always redraw non chrono changes (name etc) and chrono changes that can affect appearance
                    if (
                        !allChrono ||
                        // skip case when changed "duration" only (w/o start/end affected)
                        dateChanges && !('duration' in changes && dateChanges === 1) ||
                        'percentDone' in changes ||
                        'inactive' in changes
                    ) {
                        // if we are finalizing data loading let's delay the resources refresh till all the
                        // propagation results get into stores
                        if (me.project?.propagatingLoadChanges || me.project?.isWritingData) {
                            me.refreshResourcesOnDataReady(resourceIds);
                        }
                        else {
                            me.refreshResources(resourceIds);
                        }
                    }
                    return;
                }
            }

            me.refreshResourcesWhenReady(resourceIds);
        }
    }

    //endregion

    //region ResourceStore

    attachToResourceStore(resourceStore) {

        this.refreshAllWhenReady = true;

        super.attachToResourceStore(resourceStore);

        if (resourceStore) {
            this.clearAll({ clearLayoutCache : true });

            resourceStore.on({
                name            : 'resourceStore',
                changePreCommit : 'onResourceStoreChange',
                thisObj         : this
            });
        }
    }

    onResourceStoreChange({ action, isExpand, records, changes }) {
        const
            me          = this,
            resourceIds = records?.map(r => r.id);

        if (!me.scheduler.isPainted) {
            return;
        }

        switch (action) {
            case 'add':
                // #635 Events disappear when toggling other node
                // If we are expanding project won't fire refresh event
                if (!isExpand) {
                    me.refreshResourcesWhenReady(resourceIds);
                }
                return;
            case 'update': {
                // Ignore changes from project commit, if they affect events they will be redrawn anyway
                // Also ignore explicit transformation of leaf <-> parent
                if (!me.project.isBatchingChanges && !changes.isLeaf) {
                    // Resource changes might affect events, refresh
                    me.refreshResources(resourceIds);
                }
                return;
            }
            case 'filter':
                // Bail out on filter action. Map was already updated on `refresh` event triggered before this `change`
                // one. And extra records are removed from rowMap by `onRemoveRows`
                return;
            case 'removeall':
                me.clearAll({ clearLayoutCache : true });
                return;

                // We must not clear all resources when whole dataset changes
                // https://github.com/bryntum/support/issues/3292
            case 'dataset':
                return;
        }

        resourceIds && me.clearResources(resourceIds);
    }

    //endregion

    //region RowManager

    onTranslateRow({ row }) {
        // Newly added rows are translated prior to having an id, rule those out since they will be rendered later
        if (row.id != null) {
            // Event layouts are stored relative to the resource, only need to rerender the row to have its absolute
            // position updated to match new translation
            this.refreshEventsForResource(row, false);
        }
    }

    // Used to pre-calculate row heights
    calculateRowHeight(resourceRecord) {
        const
            { scheduler } = this,
            rowHeight     = scheduler.getResourceHeight(resourceRecord),
            eventLayout   = scheduler.getEventLayout(resourceRecord),
            layoutType    = eventLayout.type;

        if (
            layoutType === 'stack' &&
            scheduler.isEngineReady &&
            !resourceRecord.isSpecialRow &&
            resourceRecord.assigned.size > 1
        ) {
            const
                {
                    assignmentStore,
                    eventStore,
                    timeAxis
                }               = scheduler,
                {
                    barMargin,
                    resourceMargin,
                    contentHeight
                }               = scheduler.getResourceLayoutSettings(resourceRecord),
                // When using an AssignmentStore we will get all events for the resource even if the EventStore is
                // filtered
                eventFilter     = (eventStore.isFiltered || assignmentStore.isFiltered) && (eventRecord =>
                    eventRecord.assignments.some(a => a.resource === resourceRecord && assignmentStore.includes(a))),
                events          = eventStore
                    .getEvents({
                        resourceRecord,
                        includeOccurrences : scheduler.enableRecurringEvents,
                        startDate          : timeAxis.startDate,
                        endDate            : timeAxis.endDate,
                        filter             : eventFilter
                    })
                    .sort(heightEventSorter)
                    .map(eventRecord => {
                        const
                            // Must use Model.get in order to get latest values in case we are inside a batch.
                            // EventResize changes the endDate using batching to enable a tentative change
                            // via the batchedUpdate event which is triggered when changing a field in a batch.
                            // Fall back to accessor if propagation has not populated date fields.
                            startDate = eventRecord.isBatchUpdating ? eventRecord.get('startDate') : eventRecord.startDate,
                            endDate   = eventRecord.isBatchUpdating ? eventRecord.get('endDate') : eventRecord.endDate || startDate;

                        return {
                            eventRecord,
                            resourceRecord,
                            startMS : startDate.getTime(),
                            endMS   : endDate.getTime()
                        };
                    }),
                layoutHandler = scheduler.getEventLayoutHandler(eventLayout),
                nbrOfBandsRequired = layoutHandler.layoutEventsInBands(events, true);

            if (layoutHandler.type === 'layoutFn') {
                return nbrOfBandsRequired;
            }

            return (nbrOfBandsRequired * contentHeight) + ((nbrOfBandsRequired - 1) * barMargin) + resourceMargin * 2;
        }

        return rowHeight;
    }

    //endregion

    //region TimeAxis

    doUpdateTimeView() {
        const { scrollable } = this.scheduler.timeAxisSubGrid;

        // scrollLeft is the DOM's concept which is -ve in RTL mode.
        // scrollX i always the +ve scroll offset from the origin.
        // Both may be needed for different calculations.
        this.updateFromHorizontalScroll(scrollable.x);
    }

    onTimeAxisViewModelUpdate() {
        const
            me            = this,
            { scheduler } = me;

        me.clearAll();

        // If refresh is suspended, update timeView as soon as refresh gets unsuspended
        if (scheduler.refreshSuspended) {
            me.detachListeners('renderingSuspend');

            scheduler.on({
                name : 'renderingSuspend',
                resumeRefresh({ trigger }) {
                    // This code will try to refresh rows, but resumeRefresh event doesn't guarantee rowManager rows are
                    // in actual state. e.g. if resources were removed during a suspended refresh rowManager won't get a
                    // chance to update them until `refresh` event from the project. We can safely update the view only
                    // if engine in ready (not committing), otherwise we leave refresh a liability of normal project refresh
                    // logic. Covered by SchedulerRendering.t.js
                    // https://github.com/bryntum/support/issues/1462
                    if (scheduler.isEngineReady && trigger) {
                        me.doUpdateTimeView();
                    }
                },
                thisObj : me,
                once    : true
            });
        }

        // Call update anyway. If refresh is suspended this call will only update visible date range and will not redraw rows
        me.doUpdateTimeView();
    }

    //endregion

    //region Dependency connectors

    /**
     * Gets displaying item start side
     *
     * @param {Scheduler.model.EventModel} eventRecord
     * @returns {'start'|'end'|'top'|'bottom'} 'start' / 'end' / 'top' / 'bottom'
     */
    getConnectorStartSide(eventRecord) {
        return 'start';
    }

    /**
     * Gets displaying item end side
     *
     * @param {Scheduler.model.EventModel} eventRecord
     * @returns {'start'|'end'|'top'|'bottom'} 'start' / 'end' / 'top' / 'bottom'
     */
    getConnectorEndSide(eventRecord) {
        return 'end';
    }

    //endregion

    //region Scheduler hooks

    refreshRows(reLayoutEvents) {
        if (reLayoutEvents) {
            this.clearAll();
        }
    }

    // Clear events in case they use date as part of displayed info
    onLocaleChange() {
        this.clearAll();
    }

    // Called when viewport size changes
    onViewportResize(width, height, oldWidth, oldHeight) {
        // We dont draw events for all rendered rows, "refresh" when height changes to make sure events in previously
        // invisible rows gets displayed
        if (height > oldHeight) {
            this.onRenderDone();
        }
    }

    // Called from EventDrag
    onDragAbort({ context, dragData }) {
        // Aborted a drag in a scrolled scheduler, with origin now out of view. Element is no longer needed
        if (this.resourceStore.indexOf(dragData.record.resource) < this.scheduler.topRow.dataIndex) {
            context.element.remove();
        }
    }

    // Called from EventSelection
    toggleCls(assignmentRecord, cls, add = true, useWrapper = false) {
        const
            element      = this.client.getElementFromAssignmentRecord(assignmentRecord, useWrapper),
            // TODO: Should be assignmentRecord.resourceId, but breaks engine. Hoping https://github.com/bryntum/bryntum-suite/pull/1252 will fix it
            resourceData = this.resourceMap.get(assignmentRecord.isModel ? assignmentRecord.get('resourceId') : assignmentRecord.resourceId),
            eventData    = resourceData?.eventsData.find(d => d.eventId === assignmentRecord.eventId);

        // Update cached config
        if (eventData) {
            eventData[useWrapper ? 'wrapperCls' : 'cls'][cls] = add;
        }

        // Live update element
        if (element) {
            // Update element
            element.classList[add ? 'add' : 'remove'](cls);
            // And its DOM config
            element.lastDomConfig.className[cls] = add;
        }
    }

    // React to rows being removed, refreshes view without any relayouting needed since layout is cached relative to row
    onRemoveRows({ rows }) {
        rows.forEach(row => this.rowMap.delete(row));
        this.onRenderDone();
    }

    // Reset renderer flag before any renderers are called
    onEarlyScroll() {
        this.rendererCalled = false;
    }

    // If vertical scroll did not cause a renderer to be called we still want to update since we only draw events in
    // view, "independent" from their rows
    updateFromVerticalScroll() {
        if (!this.rendererCalled) {
            this.onRenderDone();
        }
    }

    // Update header range on horizontal scroll. No need to draw any tasks, Gantt only cares about vertical scroll
    updateFromHorizontalScroll(scrollX) {
        const
            me            = this,
            {
                scheduler,
                // scrollBuffer is an export only thing
                scrollBuffer
            } = me,
            {
                timeAxisSubGrid,
                timeAxis,
                rtl
            }             = scheduler,
            { width }     = timeAxisSubGrid,
            { totalSize } = scheduler.timeAxisViewModel,
            start         = scrollX,
            // If there are few pixels left from the right most position then just render all remaining ticks,
            // there wouldn't be many. It makes end date reachable with more page zoom levels while not having any poor
            // implications.
            // 5px to make TimeViewRangePageZoom test stable in puppeteer.
            returnEnd     = Math.abs(timeAxisSubGrid.scrollable.maxX) <= Math.round(start) + 5,
            startDate     = scheduler.getDateFromCoord({ coord : Math.max(0, start - scrollBuffer), ignoreRTL : true }),
            endDate       = returnEnd ? timeAxis.endDate : (scheduler.getDateFromCoord({ coord : start + width + scrollBuffer, ignoreRTL : true }) || timeAxis.endDate);

        if (startDate && !scheduler._viewPresetChanging) {
            me._visibleDateRange = { startDate, endDate, startMS : startDate.getTime(), endMS : endDate.getTime() };
            me.viewportCoords  = rtl
                // RTL starts all the way to the right (and goes in opposite direction)
                ? { left : totalSize - scrollX - width + scrollBuffer, right : totalSize - scrollX - scrollBuffer }
                // LTR all the way to the left
                : { left : scrollX - scrollBuffer, right : scrollX + width + scrollBuffer };

            // Update timeaxis header making it display the new dates
            const range = scheduler.timeView.range = { startDate, endDate };

            scheduler.onVisibleDateRangeChange(range);

            // If refresh is suspended, someone else is responsible for updating the UI later
            if (!scheduler.refreshSuspended && scheduler.rowManager.rows.length) {
                // Gets here too early in Safari for ResourceHistogram. ResizeObserver triggers a scroll before rows are
                // rendered first time. Could not track down why, bailing out
                if (scheduler.rowManager.rows[0].id === null) {
                    return;
                }

                scheduler.rowManager.rows.forEach(row => me.refreshEventsForResource(row, false));

                me.onRenderDone();
            }
        }
    }

    // Called from SchedulerEventRendering
    repaintEventsForResource(resourceRecord) {
        this.refreshResources([resourceRecord.id]);
    }

    onBeforeRowHeightChange() {
        // Row height is cached per resource, all have to be re-laid out
        this.clearAll();
    }

    //endregion

    //region Refresh resources

    refreshResourcesOnDataReady(resourceIds) {
        resourceIds.forEach(id => this.toDrawOnDataReady.add(id));
    }

    /**
     * Clears resources directly and redraws them on next project refresh
     * @param {Number[]|String[]} resourceIds
     * @private
     */
    refreshResourcesWhenReady(resourceIds) {
        this.clearResources(resourceIds);
        resourceIds.forEach(id => this.toDrawOnProjectRefresh.add(id));
    }

    /**
     * Clears and redraws resources directly. Respects schedulers refresh suspension
     * @param {Number[]|String[]} ids Resource ids
     * @param {Boolean} [transition] Use transition or not
     * @private
     */
    refreshResources(ids, transition = true) {
        const
            me            = this,
            { scheduler } = me,
            rows          = [],
            noRows        = [];

        me.clearResources(ids);

        if (!scheduler.refreshSuspended) {
            ids.forEach(id => {
                const row = scheduler.getRowById(id);
                if (row) {
                    rows.push(row);
                }
                else {
                    noRows.push(row);
                }
            });

            scheduler.runWithTransition(() => {
                // Rendering rows populates row heights, but not all resources might have a row in view
                scheduler.calculateRowHeights(noRows.map(id => this.resourceStore.getById(id)), true);

                // Render those that do
                scheduler.rowManager.renderRows(rows);
            }, transition);
        }
    }

    //endregion

    //region Stack & pack

    layoutEventVerticallyStack(bandIndex, eventRecord, resourceRecord) {
        const { barMargin, resourceMargin, contentHeight } = this.scheduler.getResourceLayoutSettings(resourceRecord, eventRecord.parent);

        return bandIndex === 0
            ? resourceMargin
            : resourceMargin + bandIndex * contentHeight + bandIndex * barMargin;
    }

    layoutEventVerticallyPack(topFraction, heightFraction, eventRecord, resourceRecord) {
        const
            {
                barMargin,
                resourceMargin,
                contentHeight
            }               = this.scheduler.getResourceLayoutSettings(resourceRecord, eventRecord.parent),
            count           = 1 / heightFraction,
            bandIndex       = topFraction * count, // "y" within row
            height          = (contentHeight - ((count - 1) * barMargin)) * heightFraction,
            top             = resourceMargin + bandIndex * height + bandIndex * barMargin;

        return {
            top, height
        };
    }

    //endregion

    //region Render

    /**
     * Used by event drag features to bring into existence event elements that are outside of the rendered block.
     * @param {Scheduler.model.TimeSpan} eventRecord The event to render
     * @param {Scheduler.model.ResourceModel} [resourceRecord] The event to render
     * @private
     */
    addTemporaryDragElement(eventRecord, resourceRecord = eventRecord.resource) {
        const
            { scheduler } = this,
            renderData    = scheduler.generateRenderData(eventRecord, resourceRecord, { timeAxis : true, viewport : true });

        renderData.absoluteTop = renderData.row
            ? (renderData.top + renderData.row.top)
            : scheduler.getResourceEventBox(eventRecord, resourceRecord, true).top;

        const
            domConfig = this.renderEvent(renderData),
            { dataset } = domConfig;

        delete domConfig.tabIndex;
        delete dataset.eventId;
        delete dataset.resourceId;
        delete dataset.assignmentId;
        delete dataset.syncId;
        dataset.transient = true;
        domConfig.parent = this.scheduler.foregroundCanvas;

        // So that the regular DomSyncing which may happen during scroll does not
        // sweep up and reuse the temporary element.
        domConfig.retainElement = true;

        const result = DomHelper.createElement(domConfig);

        result.innerElement = result.firstChild;

        eventRecord.instanceMeta(scheduler).hasTemporaryDragElement = true;

        return result;
    }

    // Earlier start dates are above later tasks
    // If same start date, longer tasks float to top
    // If same start + duration, sort by name
    // Fn can be called with layout date or event records (from EventNavigation)
    eventSorter(a, b) {
        if (this.overlappingEventSorter) {
            return this.overlappingEventSorter(a.eventRecord || a, b.eventRecord || b);
        }

        const
            // TODO: Rename startMS -> startDateMS to not have to have isModel check here (and to be consistent)
            startA    = a.isModel ? a.startDateMS : a.dataStartMS || a.startMS, // dataXX are used if configured with fillTicks
            endA      = a.isModel ? a.endDateMS : a.dataEndMS || a.endMS,
            startB    = b.isModel ? b.startDateMS : b.dataStartMS || b.startMS,
            endB      = b.isModel ? b.endDateMS :  b.dataEndMS || b.endMS,
            nameA     = a.isModel ? a.name : a.eventRecord.name,
            nameB     = b.isModel ? b.name : b.eventRecord.name;

        return startA - startB || endB - endA || (nameA < nameB ? -1 : nameA == nameB ? 0 : 1);
    }

    /**
     * Converts a start/endDate into a MS value used when rendering the event. If scheduler is configured with
     * `fillTicks: true` the value returned will be snapped to tick start/end.
     * @private
     * @param {Scheduler.model.TimeSpan} eventRecord
     * @param {String} startDateField
     * @param {String} endDateField
     * @param {Boolean} useEventBuffer
     * @returns {Object} Object of format { startMS, endMS, durationMS }
     */
    calculateMS(eventRecord, startDateField, endDateField, useEventBuffer) {
        const
            me                    = this,
            { scheduler }         = me,
            { timeAxisViewModel } = scheduler;

        let startMS    = getStartEnd(scheduler, eventRecord, false, startDateField, useEventBuffer),
            endMS      = getStartEnd(scheduler, eventRecord, true, endDateField, useEventBuffer),
            durationMS = endMS - startMS;

        if (scheduler.milestoneLayoutMode !== 'default' && durationMS === 0) {
            const
                pxPerMinute = timeAxisViewModel.getSingleUnitInPixels('minute'),
                lengthInPx  = scheduler.getMilestoneLabelWidth(eventRecord),
                duration    = lengthInPx * (1 / pxPerMinute);

            durationMS = duration * 60 * 1000;

            switch (scheduler.milestoneAlign) {
                case 'start':
                case 'left':
                    endMS = startMS + durationMS;
                    break;
                case 'end':
                case 'right':
                    endMS = startMS;
                    startMS = endMS - durationMS;
                    break;
                default: // using center as default
                    endMS = startMS + durationMS / 2;
                    startMS = endMS - durationMS;
                    break;
            }
        }

        return {
            startMS,
            endMS,
            durationMS
        };
    }

    /**
     * Returns event render data except actual position information.
     * @param timeSpan
     * @param rowRecord
     * @returns {HorizontalRenderData}
     * @private
     */
    setupRenderData(timeSpan, rowRecord) {
        const
            me                             = this,
            { scheduler }                  = me,
            {
                timeAxis,
                timeAxisViewModel
            }                              = scheduler,
            {
                preamble,
                postamble
            }                              = timeSpan,
            useEventBuffer                 = me.isProHorizontalRendering && scheduler.features.eventBuffer?.enabled &&
                (preamble || postamble) && !timeSpan.isMilestone,
            pxPerMinute                    = timeAxisViewModel.getSingleUnitInPixels('minute'),
            { isBatchUpdating }            = timeSpan,
            startDateField                 = useEventBuffer ? 'wrapStartDate' : 'startDate',
            endDateField                   = useEventBuffer ? 'wrapEndDate' : 'endDate',
            // Must use Model.get in order to get latest values in case we are inside a batch.
            // EventResize changes the endDate using batching to enable a tentative change
            // via the batchedUpdate event which is triggered when changing a field in a batch.
            // Fall back to accessor if propagation has not populated date fields.
            // Use endDate accessor if duration has not been propagated to create endDate
            timespanStart                  = isBatchUpdating && !useEventBuffer ? timeSpan.get(startDateField) : timeSpan[startDateField],
            // Allow timespans to be rendered even when they are missing an end date
            timespanEnd                    = isBatchUpdating && !useEventBuffer ? timeSpan.get(endDateField) : timeSpan[endDateField] || timespanStart,
            viewStartMS                    = timeAxis.startMS,
            viewEndMS                      = timeAxis.endMS,
            { startMS, endMS, durationMS } = me.calculateMS(timeSpan, startDateField, endDateField, useEventBuffer),
            // These flags have two components because includeOutsideViewport
            // means that we can be calculating data for events either side of
            // the TimeAxis.
            // The start is outside of the view if it's before *or after* the TimeAxis range.
            // 1 set means the start is before the TimeAxis
            // 2 set means the start is after the TimeAxis
            // Either way, a truthy value means that the start is outside of the TimeAxis.
            startsOutsideView              = startMS < viewStartMS | ((startMS > viewEndMS) << 1),
            // The end is outside of the view if it's before *or after* the TimeAxis range.
            // 1 set means the end is after the TimeAxis
            // 2 set means the end is before the TimeAxis
            // Either way, a truthy value means that the end is outside of the TimeAxis.
            endsOutsideView                = endMS > viewEndMS | ((endMS <= viewStartMS) << 1),
            durationMinutes                = durationMS / (1000 * 60),
            width                          = endsOutsideView ? pxPerMinute * durationMinutes : null,
            row                            = scheduler.getRowById(rowRecord);

        return {
            eventRecord : timeSpan,
            taskRecord  : timeSpan, // Helps with using Gantt projects in Scheduler Pro
            start       : timespanStart,
            end         : timespanEnd,
            rowId       : rowRecord.id,
            children    : [],
            startMS,
            endMS,
            durationMS,
            startsOutsideView,
            endsOutsideView,
            width,
            row,
            useEventBuffer
        };
    }

    /**
     * Populates render data with information about width and horizontal position of the wrap.
     * @param {HorizontalRenderData} renderData
     * @returns {Boolean}
     * @private
     */
    fillTimeSpanHorizontalPosition(renderData) {
        const
            { startMS, endMS, durationMS } = renderData,
            // With delayed calculation there is no guarantee data is normalized, might be missing a crucial component
            result = startMS != null && endMS != null && this.calculateHorizontalPosition(renderData, startMS, endMS, durationMS);

        if (result) {
            Object.assign(renderData, result);
            return true;
        }

        return false;
    }

    /**
     * Fills render data with `left` and `width` properties
     * @param {HorizontalRenderData} renderData
     * @param {Number} startMS
     * @param {Number} endMS
     * @param {Number} durationMS
     * @returns {{left: number, width: number, clippedStart: boolean, clippedEnd: boolean}|null}
     * @private
     */
    calculateHorizontalPosition(renderData, startMS, endMS, durationMS) {
        const
            { scheduler }   = this,
            {
                timeAxis,
                timeAxisViewModel
            }               = scheduler,
            {
                startsOutsideView,
                endsOutsideView,
                eventRecord
            }               = renderData,
            viewStartMS     = timeAxis.startMS,
            pxPerMinute     = timeAxisViewModel.getSingleUnitInPixels('minute'),
            durationMinutes = durationMS / (1000 * 60),
            width           = endsOutsideView ? pxPerMinute * durationMinutes : null;

        let endX = scheduler.getCoordinateFromDate(endMS, {
                local            : true,
                respectExclusion : true,
                isEnd            : true
            }), startX, clippedStart = false, clippedEnd = false;

        // If event starts outside of view, estimate where.
        if (startsOutsideView) {
            startX = (startMS - viewStartMS) / (1000 * 60) * pxPerMinute;

            // Flip -ve startX to being to the right of the viewport end
            if (scheduler.rtl) {
                startX = scheduler.timeAxisSubGrid.scrollable.scrollWidth - startX;
            }
        }
        // Starts in view, calculate exactly
        else {
            // If end date is included in time axis but start date is not (when using time axis exclusions), snap start date to next included data
            startX = scheduler.getCoordinateFromDate(startMS, {
                local              : true,
                respectExclusion   : true,
                isEnd              : false,
                snapToNextIncluded : endX !== -1
            });

            clippedStart = startX === -1;
        }

        if (endsOutsideView) {
            // Have to clip the events in Safari when using stickyEvents, it does not support `overflow: clip`
            if (BrowserHelper.isSafari && scheduler.features.stickyEvents) {
                endX = scheduler.getCoordinateFromDate(timeAxis.endMS);
            }
            else {
                // Parentheses needed
                endX = startX + width * (scheduler.rtl ? -1 : 1);
            }
        }
        else {
            clippedEnd = endX === -1;
        }

        if (clippedEnd && !clippedStart) {
            // We know where to start but not where to end, snap it (the opposite is already handled by the
            // snapToNextIncluded flag when calculating startX above)
            endX = scheduler.getCoordinateFromDate(endMS, {
                local              : true,
                respectExclusion   : true,
                isEnd              : true,
                snapToNextIncluded : true
            });
        }

        // If the element is very wide there's no point in displaying it all.
        // Indeed the element may not be displayable at extremely large widths.
        if (width > MAX_WIDTH) {
            // The start is before the TimeAxis start
            if (startsOutsideView === 1) {
                // Both ends outside - spans TimeAxis
                if (endsOutsideView === 1) {
                    startX = -100;
                    endX = scheduler.timeAxisColumn.width + 100;
                }
                // End is in view
                else {
                    startX = endX - MAX_WIDTH;
                }
            }
            // The end is after, but the start is in view
            else if (endsOutsideView === 1) {
                endX = startX + MAX_WIDTH;
            }
        }

        if (clippedStart && clippedEnd) {
            // Both ends excluded, but there might be some part in between that should be displayed...
            startX = scheduler.getCoordinateFromDate(startMS, {
                local              : true,
                respectExclusion   : true,
                isEnd              : false,
                snapToNextIncluded : true,
                max                : endMS
            });

            endX = scheduler.getCoordinateFromDate(endMS, {
                local              : true,
                respectExclusion   : true,
                isEnd              : true,
                snapToNextIncluded : true,
                min                : startMS
            });

            if (startX === endX) {
                // Raise flag on instance meta to avoid duplicating this logic
                eventRecord.instanceMeta(scheduler).excluded = true;
                // Excluded by time axis exclusion rules, render nothing
                return null;
            }
        }

        return {
            left  : Math.min(startX, endX),
            // Use min width 5 for normal events, 0 for milestones (wont have width specified at all in the
            // end). During drag create a normal event can get 0 duration, in this case we still want it to
            // get a min width of 5 (6px for wrapper, -1 px for event element
            width : Math.abs(endX - startX) || (eventRecord.isMilestone && !eventRecord.meta.isDragCreating ? 0 : 6),
            clippedStart,
            clippedEnd
        };
    }

    fillTimeSpanVerticalPosition(renderData, rowRecord) {
        const
            { scheduler }  = this,
            { start, end } = renderData,
            {
                resourceMargin,
                contentHeight
            }              = scheduler.getResourceLayoutSettings(rowRecord);

        // If filling ticks we need to also keep data's MS values, since they are used for sorting timespans
        if (scheduler.fillTicks) {
            renderData.dataStartMS = start.getTime();
            renderData.dataEndMS = end.getTime();
        }

        renderData.top = Math.max(0, resourceMargin);

        if (scheduler.managedEventSizing) {
            // Timespan height should be at least 1px
            renderData.height = contentHeight;
        }
    }

    /**
     * Gets timespan coordinates etc. Relative to containing row. If the timespan is outside of the zone in
     * which timespans are rendered, that is outside of the TimeAxis, or outside of the vertical zone in which timespans
     * are rendered, then `undefined` is returned.
     * @private
     * @param {Scheduler.model.TimeSpan} timeSpan TimeSpan record
     * @param {Core.data.Model} rowRecord Row record
     * @param {Boolean|Object} includeOutside Specify true to get boxes for timespans outside of the rendered zone in both
     * dimensions. This option is used when calculating dependency lines, and we need to include routes from timespans
     * which may be outside the rendered zone.
     * @param {Boolean} includeOutside.timeAxis Pass as `true` to include timespans outside of the TimeAxis's bounds
     * @param {Boolean} includeOutside.viewport Pass as `true` to include timespans outside of the vertical timespan viewport's bounds.
     * @returns {{event/task: *, left: number, width: number, start: (Date), end: (Date), startMS: number, endMS: number, startsOutsideView: boolean, endsOutsideView: boolean}}
     */
    getTimeSpanRenderData(timeSpan, rowRecord, includeOutside = false) {
        const
            me                     = this,
            { scheduler }          = me,
            { timeAxis }           = scheduler,
            includeOutsideTimeAxis = includeOutside === true || includeOutside.timeAxis,
            includeOutsideViewport = includeOutside === true || includeOutside.viewport;

        // If timespan is outside the TimeAxis, give up trying to calculate a layout (Unless we're including timespans
        // outside our zone)
        if (includeOutsideTimeAxis || timeAxis.isTimeSpanInAxis(timeSpan)) {
            const row = scheduler.getRowById(rowRecord);

            if (row || includeOutsideViewport) {
                const data = me.setupRenderData(timeSpan, rowRecord);

                if (!me.fillTimeSpanHorizontalPosition(data)) {
                    return null;
                }

                me.fillTimeSpanVerticalPosition(data, rowRecord);

                return data;
            }
        }
    }

    // Layout a set of events, code shared by normal event render path and nested events
    layoutEvents(resourceRecord, allEvents, includeOutside = false, parentEventRecord, eventSorter) {
        const
            me                   = this,
            { scheduler }        = me,
            { timeAxis }         = scheduler,
            // Generate layout data
            eventsData           = allEvents.reduce((result, eventRecord) => {
                // Only those in time axis (by default)
                if ((includeOutside || timeAxis.isTimeSpanInAxis(eventRecord))) {
                    const eventBox = scheduler.generateRenderData(eventRecord, resourceRecord, false);

                    // Collect layouts of visible events
                    if (eventBox) {
                        result.push(eventBox);
                    }
                }

                return result;
            }, []);

        // Ensure the events are rendered in natural order so that navigation works.
        eventsData.sort(eventSorter ?? me.eventSorter);

        let rowHeight = scheduler.getAppliedResourceHeight(resourceRecord, parentEventRecord);

        const
            // Only events and tasks should be considered during layout (not resource time ranges if any, or events
            // being drag created when configured with lockLayout)
            layoutEventData = eventsData.filter(({ eventRecord }) => eventRecord.isEvent && !eventRecord.meta.excludeFromLayout),
            eventLayout     = scheduler.getEventLayout(resourceRecord, parentEventRecord),
            layoutHandler   = scheduler.getEventLayoutHandler(eventLayout);

        if (layoutHandler) {
            const
                {
                    barMargin,
                    resourceMargin,
                    contentHeight
                }              = scheduler.getResourceLayoutSettings(resourceRecord, parentEventRecord),
                bandsRequired  = layoutHandler.applyLayout(layoutEventData, resourceRecord) || 1;

            if (layoutHandler.type === 'layoutFn') {
                rowHeight = bandsRequired;
            }
            else {
                rowHeight = (bandsRequired * contentHeight) + ((bandsRequired - 1) * barMargin) + resourceMargin * 2;
            }
        }
        // Apply z-index when event elements might overlap, to keep "overlap order" consistent
        else if (layoutEventData.length > 0) {
            for (let i = 0; i < layoutEventData.length; i++) {
                const data = layoutEventData[i];
                // $event-zindex scss var is 5
                data.wrapperStyle += `;z-index:${i + 5}`;
            }
        }

        return { rowHeight, eventsData };
    }

    // Lay out events within a resource, relative to the resource
    layoutResourceEvents(resourceRecord, includeOutside = false) {
        const
            me                   = this,
            { scheduler }        = me,
            {
                eventStore,
                assignmentStore,
                timeAxis
            }                    = scheduler,
            // Events for this resource
            resourceEvents = eventStore.getEvents({
                includeOccurrences : scheduler.enableRecurringEvents,
                resourceRecord,
                startDate          : timeAxis.startDate,
                endDate            : timeAxis.endDate,
                filter             : (assignmentStore.isFiltered || eventStore.isFiltered) && (eventRecord =>
                    eventRecord.assignments.some(a => a.resource === resourceRecord && assignmentStore.includes(a)))
            }),
            // Call a chainable template function on scheduler to allow features to add additional "events" to render
            // Currently used by ResourceTimeRanges, CalendarHighlight & NestedEvents
            allEvents            = scheduler.getEventsToRender(resourceRecord, resourceEvents) || [];

        return me.layoutEvents(resourceRecord, allEvents, includeOutside);
    }

    // Generates a DOMConfig for an EventRecord
    renderEvent(data, rowHeight) {
        const
            { scheduler }                                     = this,
            { resourceRecord, assignmentRecord, eventRecord } = data,
            // Sync using assignment id for events and event id for ResourceTimeRanges. Add eventId for occurrences to make them unique
            syncId                                            = assignmentRecord
                // Assignment, might be an occurrence
                ? this.assignmentStore.getOccurrence(assignmentRecord, eventRecord).id
                // Something else, probably a ResourceTimeRange
                : data.eventId,
            eventElementConfig = {
                className : data.cls,
                style     : data.style || '',
                children  : data.children,
                dataset   : {
                    // Each feature putting contents in the event wrap should have this to simplify syncing and
                    // element retrieval after sync
                    taskFeature : 'event'
                },
                syncOptions : {
                    syncIdField : 'taskBarFeature'
                }
            },
            // Event element config, applied to existing element or used to create a new one below
            elementConfig                        = {
                className : data.wrapperCls,
                tabIndex  : ('tabIndex' in data) ? data.tabIndex : -1,
                children  : [
                    eventElementConfig,
                    ...data.wrapperChildren
                ],
                style : {
                    top      : data.absoluteTop,
                    left     : data.left,
                    // ResourceTimeRanges fill row height, cannot be done earlier than this since row height is not
                    // known initially
                    height   : data.fillSize ? rowHeight : data.height,
                    // DomHelper appends px to dimensions when using numbers.
                    // Do not ignore width for milestones, use height value. It is required to properly center
                    // pseudo element with top/bottom labels
                    width    : data.width || data.height,
                    style    : data.wrapperStyle,
                    fontSize : data.height + 'px'
                },
                dataset : {
                    // assignmentId is set in this function conditionally
                    resourceId : resourceRecord.id,
                    eventId    : data.eventId, // Not using eventRecord.id to distinguish between Event and ResourceTimeRange
                    syncId
                },
                // Will not be part of DOM, but attached to the element
                elementData   : data,
                // Dragging etc. flags element as retained, to not reuse/release it during that operation. Events
                // always use assignments, but ResourceTimeRanges does not
                retainElement : assignmentRecord?.instanceMeta(scheduler).retainElement || eventRecord.instanceMeta(scheduler).retainElement,
                // Options for this level of sync, lower levels can have their own
                syncOptions   : {
                    syncIdField      : 'taskFeature',
                    // Remove instead of release when a feature is disabled
                    releaseThreshold : 0
                }
            };

        // Write back the correct height for elements filling the row, to not derender them later based on wrong height
        if (data.fillSize) {
            data.height = rowHeight;
        }

        // Some browsers throw warnings on zIndex = ''
        if (data.zIndex) {
            elementConfig.zIndex = data.zIndex;
        }

        // Do not want to spam dataset with empty prop when not using assignments (ResourceTimeRanges)
        if (assignmentRecord) {
            elementConfig.dataset.assignmentId = assignmentRecord.id;
        }

        data.elementConfig = elementConfig;

        scheduler.trigger('beforeRenderEvent', { renderData : data, domConfig : elementConfig });

        return elementConfig;
    }

    /**
     * Refresh events for resource record (or Row), clearing its cache and forcing DOM refresh.
     * @param {Scheduler.model.ResourceModel} recordOrRow Record or row to refresh
     * @param {Boolean} [force] Specify `false` to prevent clearing cache and forcing DOM refresh
     * @internal
     */
    refreshEventsForResource(recordOrRow, force = true, draw = true) {
        let row, record;

        if (recordOrRow.isModel) {
            row    = this.scheduler.rowManager.getRowFor(recordOrRow);
            record = recordOrRow;
        }
        else {
            row    = recordOrRow;
            record = this.resourceStore.getById(recordOrRow.id);
        }

        if (force) {
            this.clearResources([recordOrRow]);
        }

        if (row && record) {
            this.renderer({ row, record });

            if (force && draw) {
                this.onRenderDone();
            }
        }
    }

    // Called per row in "view", collect configs
    renderer({ row, record : resourceRecord, size = {} }) {
        // Bail out for group headers/footers
        if (resourceRecord.isSpecialRow) {
            // Clear any cached layout for row retooled to special row, and bail out
            this.rowMap.delete(row);
            return;
        }

        const
            me                        = this,
            { bufferSize, scheduler } = me,
            { labels, eventBuffer }   = scheduler.features,
            // Left/right labels and event buffer elements require using a buffer to not derender too early
            usesLabels                = (eventBuffer && !eventBuffer.disabled) || (labels && !labels.disabled && (labels.left || labels.right || labels.before || labels.after)),
            { left, right }           = me.viewportCoords,
            eventDOMConfigs           = [];

        let useLeft, useRight,
            // Used stored layouts if available
            resourceLayout = me.resourceMap.get(resourceRecord.id);

        if (!resourceLayout || resourceLayout.invalid) {
            // Previously we would bail out here if engine wasn't ready. Now we instead allow drawing in most cases,
            // since data can be read and written during commit (previously it could not)
            if (me.suspended) {
                return;
            }

            resourceLayout = me.layoutResourceEvents(resourceRecord, false);
            me.resourceMap.set(resourceRecord.id, resourceLayout);
        }

        // Size row to fit events
        size.height = resourceLayout.rowHeight;
        // Avoid storing our calculated height as the rows max height, to not affect next round of calculations
        size.transient = true;

        // Only collect configs for those actually in view
        resourceLayout.eventsData.forEach(layout => {
            useLeft = left;
            useRight = right;

            // Labels/milestones requires keeping events rendered longer
            if (usesLabels || layout.width === 0) {
                useLeft -= bufferSize;
                useRight += bufferSize;
            }

            if ((layout.left + layout.width) >= useLeft && layout.left <= useRight) {
                layout.absoluteTop = layout.top + row.top;
                eventDOMConfigs.push(me.renderEvent(layout, resourceLayout.rowHeight));
            }
        });

        me.rowMap.set(row, eventDOMConfigs);

        // Keep track if we need to draw on vertical scroll or not, to not get multiple onRenderDone() calls
        me.rendererCalled = true;
    }

    // Called when the current row rendering "pass" is complete, sync collected configs to DOM
    onRenderDone() {
        const
            { scheduler, rowMap, verticalBufferSize }  = this,
            visibleEventDOMConfigs                     = [],
            bodyTop                                    = scheduler._scrollTop ?? 0,
            viewTop                                    = bodyTop - verticalBufferSize,
            viewBottom                                 = bodyTop + scheduler._bodyRectangle.height + verticalBufferSize,
            unbuffered                                 = verticalBufferSize < 0,
            unmanagedSize                              = !scheduler.managedEventSizing;

        // Event configs are collected when rows are rendered, but we do not want to waste resources on rendering
        // events far out of view. Especially with many events per row giving large row heights, rows in the RowManagers
        // buffer might far away -> collect events for rows within viewport + small vertical buffer
        rowMap.forEach((eventDOMConfigs, row) => {
            // Render events "in view". Export specifies a negative verticalBufferSize to disable it
            if (unbuffered || (row.bottom > viewTop && row.top < viewBottom)) {
                for (let i = 0; i < eventDOMConfigs.length; i++) {
                    const
                        config = eventDOMConfigs[i],
                        data   = config.elementData;

                    if (unbuffered || unmanagedSize || (data.absoluteTop + data.height > viewTop && data.absoluteTop < viewBottom)) {
                        visibleEventDOMConfigs.push(config);
                    }
                }
            }

            // We are using cached DomConfigs. When DomSync releases an element, it also flags the config as released.
            // Next time we pass it that very same config, it says it is released and nothing shows up.
            //
            // We are breaching the DomSync contract a bit with the cached approach. DomSync expects new configs on each
            // call, so to facilitate that we clone the configs shallowly (nothing deep is affected by sync releasing).
            // That way we can always pass it fresh unreleased configs.
            for (let i = 0; i < eventDOMConfigs.length; i++) {
                eventDOMConfigs[i] = { ...eventDOMConfigs[i] };
            }
        });

        this.visibleEventDOMConfigs = visibleEventDOMConfigs;

        DomSync.sync({
            domConfig : {
                onlyChildren : true,
                children     : visibleEventDOMConfigs
            },
            targetElement : scheduler.foregroundCanvas,
            syncIdField   : 'syncId',

            // Called by DomHelper when it creates, releases or reuses elements
            callback({ action, domConfig, lastDomConfig, targetElement }) {

                if (action === 'none' || !domConfig?.elementData?.isWrap) {
                    return;
                }

                const
                    // Some actions are considered first a release and then a render (reusing another element).
                    // This gives clients code a chance to clean up before reusing an element
                    isRelease = releaseEventActions[action],
                    isRender  = renderEventActions[action];

                // Trigger release for events (it might be a proxy element, skip those)
                if (isRelease && lastDomConfig?.elementData) {
                    const
                        { eventRecord, resourceRecord, assignmentRecord } = lastDomConfig.elementData,
                        event = {
                            renderData : lastDomConfig.elementData,
                            element    : targetElement,
                            eventRecord,
                            resourceRecord,
                            assignmentRecord
                        };

                    // Some browsers do not blur on set to display:none, so releasing the active element
                    // must *explicitly* move focus outwards to the view.
                    if (targetElement === DomHelper.getActiveElement(targetElement)) {
                        scheduler.focusElement.focus();
                    }

                    // This event is documented on Scheduler
                    scheduler.trigger('releaseEvent', event);
                }

                if (isRender) {
                    const
                        { eventRecord, resourceRecord, assignmentRecord } = domConfig.elementData,
                        event = {
                            renderData       : domConfig.elementData,
                            element          : targetElement,
                            isReusingElement : action === 'reuseElement',
                            isRepaint        : action === 'reuseOwnElement',
                            eventRecord,
                            resourceRecord,
                            assignmentRecord
                        };

                    // This event is documented on Scheduler
                    scheduler.trigger('renderEvent', event);
                }
            }
        });
    }

    //endregion

    //region Cache

    // Clears cached resource layout
    clearResources(recordsOrIds) {
        recordsOrIds = ArrayHelper.asArray(recordsOrIds);

        const resourceIds = recordsOrIds.map(Model.asId);



        resourceIds.forEach(resourceId => {
            // Invalidate resourceLayout, keeping it around in case we need it before next refresh
            const cached = this.resourceMap.get(resourceId);
            if (cached) {
                cached.invalid = true;
            }

            const row = this.scheduler.getRowById(resourceId);
            row && this.rowMap.delete(row);
        });
    }

    clearAll({ clearDom = false, clearLayoutCache = false } = {}) {
        const { layouts } = this.scheduler;



        if (clearLayoutCache && layouts) {
            for (const layout in layouts) {
                layouts[layout].clearCache();
            }
        }

        if (clearDom) {
            const { foregroundCanvas } = this.scheduler;

            // Start from scratch when replacing the project, to not retain anything in maps or released elements
            foregroundCanvas.syncIdMap = foregroundCanvas.lastDomConfig = null;

            for (const child of foregroundCanvas.children) {
                // child.remove();
                child.lastDomConfig = child.elementData = null;
            }
        }

        this.resourceMap.clear();
        this.rowMap.clear();
    }

    //endregion
}
