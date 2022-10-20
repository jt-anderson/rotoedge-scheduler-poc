/* eslint-disable no-unused-expressions */
import InstancePlugin from '../../../Core/mixin/InstancePlugin.js';
import DateHelper from '../../../Core/helper/DateHelper.js';
import DomHelper from '../../../Core/helper/DomHelper.js';
import DragHelper from '../../../Core/helper/DragHelper.js';
import Rectangle from '../../../Core/helper/util/Rectangle.js';
import ClockTemplate from '../../tooltip/ClockTemplate.js';
import Tooltip from '../../../Core/widget/Tooltip.js';
import Objects from '../../../Core/helper/util/Objects.js';
import Widget from '../../../Core/widget/Widget.js';

/**
 * @module Scheduler/feature/base/DragBase
 */

//TODO: shift to copy

/**
 * Base class for EventDrag (Scheduler) and TaskDrag (Gantt) features. Contains shared code. Not to be used directly.
 *
 * @extends Core/mixin/InstancePlugin
 * @abstract
 */
export default class DragBase extends InstancePlugin {
    //region Config

    static get defaultConfig() {
        return {
            // documented on Schedulers EventDrag feature and Gantt's TaskDrag
            tooltipTemplate : data => `
                <div class="b-sch-tip-${data.valid ? 'valid' : 'invalid'}">
                    ${data.startClockHtml}
                    ${data.endClockHtml}
                    <div class="b-sch-tip-message">${data.message}</div>
                </div>
            `,

            /**
             * Specifies whether or not to show tooltip while dragging event
             * @config {Boolean}
             * @default
             */
            showTooltip : true,

            /**
             * When enabled, the event being dragged always "snaps" to the exact start date that it will have after drop.
             * @config {Boolean}
             * @default
             */
            showExactDropPosition : false,

            /*
             * The store from which the dragged items are mapped to the UI.
             * In Scheduler's implementation of this base class, this will be
             * an EventStore, in Gantt's implementations, this will be a TaskStore.
             * Because both derive from this base, we must refer to it as this.store.
             * @private
             */
            store : null,

            /**
             * An object used to configure the internal {@link Core.helper.DragHelper} class
             * @config {DragHelperConfig}
             */
            dragHelperConfig : null,

            tooltipCls : 'b-eventdrag-tooltip'
        };
    }

    static get configurable() {
        return {
            /**
             * Set to `false` to allow dragging tasks outside the client Scheduler.
             * Useful when you want to drag tasks between multiple Scheduler instances
             * @config {Boolean}
             * @default
             */
            constrainDragToTimeline : true,

            // documented on Schedulers EventDrag feature, not used for Gantt
            constrainDragToResource : true,

            /**
             * Yields the {@link Core.widget.Tooltip} which tracks the event during a drag operation.
             * @member {Core.widget.Tooltip} tip
             */
            /**
             * A config object to allow customization of the {@link Core.widget.Tooltip} which tracks
             * the event during a drag operation.
             * @config {TooltipConfig}
             */
            tip : {
                $config : ['lazy', 'nullify'],
                value   : {
                    align : {
                        align          : 'b-t',
                        allowTargetOut : true
                    },
                    autoShow                 : true,
                    updateContentOnMouseMove : true
                }
            },

            /**
             * The `eventDrag`and `taskDrag` events are normally only triggered when the drag operation will lead to a
             * change in date or assignment. By setting this config to `false`, that logic is bypassed to trigger events
             * for each native mouse move event.
             * @prp {Boolean}
             */
            throttleDragEvent : true
        };
    }

    // Plugin configuration. This plugin chains some of the functions in Grid.
    static get pluginConfig() {
        return {
            chain : ['onPaint']
        };
    }

    //endregion

    //region Init

    /**
     * Called when scheduler is rendered. Sets up drag and drop and hover tooltip.
     * @private
     */
    onPaint({ firstPaint }) {
        const
            me                                  = this,
            {
                client,
                constrainDragToTimeline,
                constrainDragToResource,
                constrainDragToTimeSlot,
                dragHelperConfig = {}
            }                                   = me,
            { timeAxisViewModel, isHorizontal } = client,
            lockY                               = isHorizontal ? constrainDragToResource : constrainDragToTimeSlot,
            lockX                               = isHorizontal ? constrainDragToTimeSlot : constrainDragToResource;

        me.drag?.destroy();

        // If implementer wants to allow users dragging outside the timeline element, setup the internal dropTargetSelector
        if (me.externalDropTargetSelector) {
            dragHelperConfig.dropTargetSelector = `.b-timeaxissubgrid,${me.externalDropTargetSelector}`;
        }

        me.drag = DragHelper.new({
            name                 : me.constructor.name, // useful when debugging with multiple draggers
            positioning          : 'absolute',
            lockX,
            lockY,
            minX                 : true, // Allows dropping with start before time axis
            maxX                 : true, // Allows dropping with end after time axis
            constrain            : false,
            cloneTarget          : !constrainDragToTimeline,
            // If we clone event dragged bars, we assume ownership upon drop so we can reuse the element and have animations
            removeProxyAfterDrop : false,
            dragWithin           : constrainDragToTimeline ? null : document.body,
            hideOriginalElement  : true,
            dropTargetSelector   : '.b-timelinebase',

            // A CSS class added to drop target while dragging events
            dropTargetCls : me.externalDropTargetSelector ?  'b-drop-target' : '',

            outerElement   : client.timeAxisSubGridElement,
            targetSelector : client.eventSelector,
            scrollManager  : constrainDragToTimeline ? client.scrollManager : null,
            createProxy    : el => {
                const proxy = el.cloneNode(true);
                delete proxy.id;

                proxy.classList.add(`b-sch-${client.mode}`);
                return proxy;
            },
            snapCoordinates : ({ element, newX, newY }) => {
                const { dragData } = me;
                // Snapping not supported when dragging outside a scheduler
                if (me.constrainDragToTimeline && !me.constrainDragToTimeSlot && (me.showExactDropPosition || timeAxisViewModel.snap)) {
                    const
                        draggedEventRecord = dragData.draggedEntities[0],
                        coordinate         = me.getCoordinate(draggedEventRecord, element, [newX, newY]),
                        snappedDate        = timeAxisViewModel.getDateFromPosition(coordinate, 'round'),
                        { calendar }       = draggedEventRecord;

                    if (!calendar || snappedDate && calendar.isWorkingTime(snappedDate, DateHelper.add(snappedDate, draggedEventRecord.fullDuration))) {
                        const snappedPosition = snappedDate && timeAxisViewModel.getPositionFromDate(snappedDate);

                        if (snappedDate && snappedDate >= client.startDate && snappedPosition != null) {
                            if (isHorizontal) {
                                newX = snappedPosition;
                            }
                            else {
                                newY = snappedPosition;
                            }
                            me.lastSnappedPosition = snappedPosition;
                        }
                    }
                }

                const snapTo = { x : newX, y : newY };

                me.snapToPosition?.({
                    assignmentRecord : dragData.assignmentRecord,
                    eventRecord      : dragData.eventRecord,
                    resourceRecord   : dragData.newResource || dragData.resourceRecord,
                    startDate        : dragData.startDate,
                    endDate          : dragData.endDate,
                    snapTo
                });

                return snapTo;
            },
            listeners : {
                beforedragstart : 'onBeforeDragStart',
                dragstart       : 'onDragStart',
                drag            : 'onDrag',
                drop            : 'onDrop',
                abort           : 'onDragAbort',
                abortFinalized  : 'onDragAbortFinalized',
                reset           : 'onDragReset',
                thisObj         : me
            }
        }, dragHelperConfig, {
            isElementDraggable : (el, event) => {
                return (!dragHelperConfig || !dragHelperConfig.isElementDraggable || dragHelperConfig.isElementDraggable(el, event)) &&
                    me.isElementDraggable(el, event);
            }
        });

        if (firstPaint) {
            client.rowManager.on({
                changeTotalHeight : () => me.updateYConstraint(me.dragData?.[`${client.scheduledEventName}Record`]),
                thisObj           : me
            });
        }

        if (me.showTooltip) {
            me.clockTemplate = new ClockTemplate({
                scheduler : client
            });
        }
    }

    doDestroy() {
        this.drag?.destroy();
        this.clockTemplate?.destroy();
        this.tip?.destroy();
        super.doDestroy();
    }

    changeTip(tip, oldTip) {
        const me = this;

        if (tip) {
            const result = Tooltip.reconfigure(oldTip, Tooltip.mergeConfigs({
                forElement : me.element,
                id         : `${me.client.id}-event-drag-tip`,
                getHtml    : me.getTipHtml.bind(me),
                cls        : me.tooltipCls,
                owner      : me.client
            }, tip), {
                owner    : me.client,
                defaults : {
                    type : 'tooltip'
                }
            });

            result.on('innerhtmlupdate', me.updateDateIndicator, me);

            return result;
        }
        else {
            oldTip?.destroy();
        }
    }

    //endregion

    //region Drag events

    onBeforeDragStart({ context, event }) {
        const
            me             = this,
            { client }     = me,
            dragData       = me.getMinimalDragData(context, event),
            eventRecord    = dragData?.[`${client.scheduledEventName}Record`],
            resourceRecord = dragData.resourceRecord;

        if (client.readOnly || me.disabled || !eventRecord || eventRecord.isDraggable === false || eventRecord.readOnly || resourceRecord?.readOnly) {
            return false;
        }

        // Cache the date corresponding to the drag start point so that on drag, we can always
        // perform the same calculation to then find the time delta without having to calculate
        // the new start end end times from the position that the element is.
        context.pointerStartDate = client.getDateFromXY([context.startClientX, context.startPageY], null, false);

        const result = client.trigger(
            `before${client.capitalizedEventName}Drag`,
            {
                ...dragData,
                event,
                // to be deprecated
                context : {
                    ...context,
                    ...dragData
                }
            }
        ) !== false;

        if (result) {
            me.updateYConstraint(eventRecord, resourceRecord);

            // Hook for features that need to react to drag starting, used by NestedEvents
            client[`before${client.capitalizedEventName}DragStart`]?.(context, dragData);
        }

        return result;
    }

    /**
     * Returns true if a drag operation is active
     * @property {Boolean}
     * @readonly
     */
    get isDragging() {
        return this.drag.isDragging;
    }

    // Checked by dependencies to determine if live redrawing is needed
    get isActivelyDragging() {
        return this.isDragging && !this.finalizing;
    }

    /**
     * Triggered when dragging of an event starts. Initializes drag data associated with the event being dragged.
     * @private
     */
    onDragStart({ context, event }) {
        const
            me     = this,
            // When testing with Selenium, it simulates drag and drop with a single mousemove event, we might be over
            // another client already
            client = me.findClientFromTarget(event, context) ?? me.client;

        me.currentOverClient = client;
        me.drag.unifiedProxy = me.unifiedDrag;

        me.onMouseOverNewTimeline(client, true);

        const dragData = me.dragData = me.getDragData(context);

        // Do not let DomSync reuse the element
        context.element.retainElement = true;

        if (me.showTooltip && me.tip) {
            const tipTarget = dragData.context.dragProxy ? dragData.context.dragProxy.firstChild : context.element;

            me.tip.showBy(tipTarget);
        }

        // me.copyKeyPressed = me.isCopyKeyPressed();
        //
        // if (me.copyKeyPressed) {
        //     dragData.refElements.addCls('sch-event-copy');
        //     dragData.originalHidden = true;
        // }

        me.triggerDragStart(dragData);

        // Hook for features that need to take action after drag starts
        client[`after${client.capitalizedEventName}DragStart`]?.(context, dragData);

        const
            {
                eventMenu,
                taskMenu
            }           = client.features,
            menuFeature = eventMenu || taskMenu;

        // If this is a touch action, hide the context menu which may have shown
        menuFeature?.hideContextMenu?.(false);
    }

    updateDateIndicator() {
        const
            { startDate, endDate } = this.dragData,
            { tip, clockTemplate } = this,
            endDateElement         = tip.element.querySelector('.b-sch-tooltip-enddate');

        clockTemplate.updateDateIndicator(tip.element, startDate);

        endDateElement && clockTemplate.updateDateIndicator(endDateElement, endDate);
    }

    findClientFromTarget(event, context) {
        let { target } = event;

        // Can't detect target under a touch event
        if (/^touch/.test(event.type)) {
            const center = Rectangle.from(context.element, null, true).center;

            target = DomHelper.elementFromPoint(center.x, center.y);
        }

        const client = Widget.fromElement(target, 'timelinebase');
        // Do not allow drops on histogram widgets
        return client?.isResourceHistogram ? null : client;
    }

    /**
     * Triggered while dragging an event. Updates drag data, validation etc.
     * @private
     */
    onDrag({ context, event }) {
        const
            me    = this,
            dd    = me.dragData,
            start = dd.startDate;

        let client;

        if (me.constrainDragToTimeline) {
            client = me.client;
        }
        else {
            client = me.findClientFromTarget(event, dd.context);
        }

        me.updateDragContext(context, event);

        if (!client) {
            return;
        }

        if (client !== me.currentOverClient) {
            me.onMouseOverNewTimeline(client);
        }

        //this.checkShiftChange();

        // Let product specific implementations trigger drag event (eventDrag, taskDrag)
        if (dd.dirty || !me.throttleDragEvent) {
            const valid = dd.valid;

            me.triggerEventDrag(dd, start);

            if (valid !== dd.valid) {
                dd.externalDragValidity = dd.valid;
            }
        }

        if (me.showTooltip && me.tip) {
            // If we've an error message to show, force the tip to be visible
            // even if the target is not in view.
            me.tip.lastAlignSpec.allowTargetOut = !dd.valid;
            me.tip.realign();
        }
    }

    onMouseOverNewTimeline(newTimeline, initial) {
        const
            me                          = this,
            { drag : { lockX, lockY } } = me,
            scrollables                 = [];

        me.currentOverClient.element.classList.remove('b-dragging-' + me.currentOverClient.scheduledEventName);

        newTimeline.element.classList.add('b-dragging-' + newTimeline.scheduledEventName);

        if (!initial) {
            me.currentOverClient.scrollManager.stopMonitoring();
        }

        if (!lockX) {
            scrollables.push({
                element   : newTimeline.timeAxisSubGrid.scrollable.element,
                direction : 'horizontal'
            });
        }

        if (!lockY) {
            scrollables.push({
                element   : newTimeline.scrollable.element,
                direction : 'vertical'
            });
        }

        newTimeline.scrollManager.startMonitoring({
            scrollables,
            callback : me.drag.onScrollManagerScrollCallback
        });

        me.currentOverClient = newTimeline;
    }

    /**
     * Triggered when dropping an event. Finalizes the operation.
     * @private
     */
    onDrop({ context, event }) {
        const
            me                              = this,
            { currentOverClient, dragData } = me;

        let modified = false;

        me.tip?.hide();

        context.valid = context.valid && me.isValidDrop(dragData);

        // If dropping outside scheduler, we opt in on DragHelper removing the proxy element
        me.drag.removeProxyAfterDrop = Boolean(dragData.externalDropTarget);

        if (context.valid && dragData.startDate && dragData.endDate) {
            dragData.finalize = async(...params) => {
                await me.finalize(...params);
            };

            // Allow implementer to take control of the flow, by returning false from this listener,
            // to show a confirmation popup etc. This event is documented in EventDrag and TaskDrag
            currentOverClient.trigger(`before${currentOverClient.capitalizedEventName}DropFinalize`, {
                context : dragData,
                event
            });

            context.async = dragData.async;

            // Internal validation, making sure all dragged records fit inside the view
            if (!context.async && !dragData.externalDropTarget) {
                modified = (dragData.startDate - dragData.origStart) !== 0 || dragData.newResource !== dragData.resourceRecord;
            }
        }

        if (!context.async) {
            me.finalize(dragData.valid && context.valid && modified);
        }
    }

    onDragAbort({ context }) {
        const me = this;

        me.client.currentOrientation.onDragAbort({ context, dragData : me.dragData });

        // otherwise the event disappears on next refresh (#62)
        me.resetDraggedElements();

        me.tip?.hide();

        // Trigger eventDragAbort / taskDragAbort depending on product
        me.triggerDragAbort(me.dragData);
    }

    // Fired after any abort animation has completed (the point where we want to trigger redraw of progress lines etc)
    onDragAbortFinalized({ context }) {
        const me = this;

        me.triggerDragAbortFinalized(me.dragData);

        // Hook for features that need to react on drag abort, used by NestedEvents
        me.client[`after${me.client.capitalizedEventName}DragAbortFinalized`]?.(context, me.dragData);
    }

    // For the drag across multiple schedulers, tell all involved scroll managers to stop monitoring
    onDragReset({ source : dragHelper }) {
        const
            me = this,
            currentTimeline = me.currentOverClient;

        currentTimeline?.scrollManager.stopMonitoring();

        if (dragHelper.context?.started) {
            me.resetDraggedElements();

            currentTimeline.trigger(`${currentTimeline.scheduledEventName}DragReset`);
        }

        currentTimeline?.element.classList.remove('b-dragging-' + me.currentOverClient.scheduledEventName);

        me.dragData = null;
    }

    resetDraggedElements() {
        const
            { dragData }                     = this,
            { eventBarEls, draggedEntities } = dragData;

        this.resumeElementRedrawing(dragData.record);

        draggedEntities.forEach((record, i) => {
            this.resumeElementRedrawing(record);

            // TODO why?
            eventBarEls[i].classList.remove(this.drag.draggingCls);
            eventBarEls[i].retainElement = false;
        });
    }

    /**
     * Triggered internally on invalid drop.
     * @private
     */
    onInternalInvalidDrop(abort) {
        const
            me          = this,
            { context } = me.drag;

        me.tip?.hide();

        me.triggerAfterDrop(me.dragData, false);

        context.valid = false;
        if (abort) {
            me.drag.abort();
        }
    }

    //endregion

    //region Finalization & validation

    /**
     * Called on drop to update the record of the event being dropped.
     * @private
     * @param {Boolean} updateRecords Specify true to update the record, false to treat as invalid
     */
    async finalize(updateRecords) {
        const
            me           = this,
            { dragData } = me;

        // Drag could've been aborted by window blur event. If it is aborted - we have nothing to finalize.
        if (!dragData) {
            return;
        }

        const { context, draggedEntities, externalDropTarget } = dragData;

        let result;

        me.finalizing = true;

        draggedEntities.forEach((record, i) => {
            me.resumeElementRedrawing(record);

            // TODO Why is this needed? EventResize.t.js fails without it
            dragData.eventBarEls[i].classList.remove(me.drag.draggingCls);
            dragData.eventBarEls[i].retainElement = false;
        });

        if ((externalDropTarget && dragData.valid) || updateRecords) {
            // updateRecords may or may not be async.
            // We see if it returns a Promise.
            result = me.updateRecords(dragData);

            // If updateRecords is async, the calling DragHelper must know this and
            // go into a awaitingFinalization state.
            if (!externalDropTarget && Objects.isPromise(result)) {
                context.async = true;
                await result;
            }

            // If the finalize handler decided to change the dragData's validity...
            if (!dragData.valid) {
                me.onInternalInvalidDrop(true);
            }
            else {
                if (context.async) {
                    context.finalize();
                }
                if (externalDropTarget) {
                    // Force a refresh early so that removed events will not temporary be visible while engine is
                    // recalculating (the row below clears the 'b-hidden' CSS class of the original drag element)
                    me.client.refreshRows(false);
                }
                me.triggerAfterDrop(dragData, true);
            }
        }
        else {
            me.onInternalInvalidDrop(context.async || dragData.async);
        }

        me.finalizing = false;

        return result;
    }

    //endregion

    //region Drag data

    /**
     * Updates drag data's dates and validity (calls #validatorFn if specified)
     * @private
     */
    updateDragContext(info, event) {
        const
            me                  = this,
            { drag }            = me,
            dd                  = me.dragData,
            client              = me.currentOverClient,
            { isHorizontal }    = client,
            [record]            = dd.draggedEntities,
            eventRecord         = record.isAssignment ? record.event : record,
            lastDragStartDate   = dd.startDate,
            constrainToTimeSlot = me.constrainDragToTimeSlot || (isHorizontal ? drag.lockX : drag.lockY);

        dd.browserEvent = event;

        // getProductDragContext may switch valid flag, need to keep it here
        Object.assign(dd, me.getProductDragContext(dd));

        if (constrainToTimeSlot) {
            dd.timeDiff = 0;
        }
        else {
            if (client.timeAxis.isContinuous) {
                const
                    { dateConstraints } = dd,
                    { timeAxisSubGrid } = client,
                    { scrollable }      = timeAxisSubGrid,
                    timeAxisRegion      = scrollable.viewport,
                    timeAxisPosition    = client.isHorizontal
                        ? client.getRtlX((info.pageX ?? info.startPageX) - timeAxisRegion.x + scrollable.x)
                        : (info.pageY ?? info.startPageY) - timeAxisRegion.y + scrollable.y,

                    // Use the localized coordinates to ask the TimeAxisViewModel what date the mouse is at.
                    // Pass allowOutOfRange as true in case we have dragged out of either side of the timeline viewport.
                    pointerDate         = client.timeAxisViewModel.getDateFromPosition(timeAxisPosition, null, true),
                    timeDiff            = dd.timeDiff = pointerDate - info.pointerStartDate;

                // calculate and round new startDate based on actual dd.timeDiff
                dd.startDate = me.adjustStartDate(dd.origStart, timeDiff);

                if (dateConstraints) {
                    dd.startDate = DateHelper.constrain(dd.startDate, dateConstraints.start, new Date(dateConstraints.end - eventRecord.durationMS));
                }

                dd.endDate = DateHelper.add(dd.startDate, eventRecord.fullDuration);
            }
            else {
                const range = me.resolveStartEndDates(info.element);

                // if dragging is out of timeAxis rect bounds, we will not be able to get dates
                dd.valid = Boolean(range.startDate && range.endDate);

                if (dd.valid) {
                    dd.startDate = range.startDate;
                    dd.endDate = range.endDate;
                }
            }
            if (dd.valid) {
                dd.timeDiff = dd.startDate - dd.origStart;
            }
        }

        const positionDirty = dd.dirty = dd.dirty || lastDragStartDate - dd.startDate !== 0;

        if (dd.valid) {
            // If it's fully outside, we don't allow them to drop it - the event would disappear from their control.
            if (me.constrainDragToTimeline && (dd.endDate <= client.timeAxis.startDate || dd.startDate >= client.timeAxis.endDate)) {
                dd.valid = false;
                dd.context.message = me.L('L{EventDrag.noDropOutsideTimeline}');
            }
            else if (positionDirty || dd.externalDropTarget) {
                // Used to rely on faulty code above that would not be valid initially. With that changed we ignore
                // checking validity here on drag start, which is detected by not having a pageX
                const result = dd.externalDragValidity = !event || (info.pageX && me.checkDragValidity(dd, event));

                if (!result || typeof result === 'boolean') {
                    dd.valid = result !== false;
                    dd.context.message = '';
                }
                else {
                    dd.valid = result.valid !== false;
                    dd.context.message = result.message;
                }
            }
            else {
                // Apply cached value from external drag validation
                dd.valid = dd.externalDragValidity !== false && dd.externalDragValidity?.valid !== false;
            }
        }
        else {
            dd.valid = false;
        }

        dd.context.valid = dd.valid;
    }

    suspendElementRedrawing(record, suspend = true) {
        const element = this.getRecordElement(record);

        if (element) {
            element.retainElement = suspend;
        }

        record.instanceMeta(this.client).retainElement = suspend;
    }

    resumeElementRedrawing(record) {
        this.suspendElementRedrawing(record, false);
    }

    /**
     * Initializes drag data (dates, constraints, dragged events etc). Called when drag starts.
     * @private
     * @param info
     * @returns {*}
     */
    getDragData(info) {
        const
            me                = this,
            { client, drag }  = me,
            productDragData   = me.setupProductDragData(info),
            {
                record,
                eventBarEls,
                draggedEntities
            }                 = productDragData,
            { startEvent }    = drag,
            timespan          = record.isAssignment ? record.event : record,
            origStart         = timespan.startDate,
            origEnd           = timespan.endDate,
            timeAxis          = client.timeAxis,
            startsOutsideView = origStart < timeAxis.startDate,
            endsOutsideView   = origEnd > timeAxis.endDate,
            multiSelect       = client.isSchedulerBase ? client.multiEventSelect : client.selectionMode.multiSelect,
            coordinate        = me.getCoordinate(timespan, info.element, [info.elementStartX, info.elementStartY]),
            clientCoordinate  = me.getCoordinate(timespan, info.element, [info.startClientX, info.startClientY]);

        // prevent elements from being released when out of view
        draggedEntities.forEach(record => me.suspendElementRedrawing(record));

        // Make sure the dragged event is selected (no-op for already selected)
        // Preserve other selected events if ctrl/meta is pressed
        if (record.isAssignment) {
            client.selectAssignment(record, startEvent.ctrlKey && multiSelect);
        }
        else {
            client.selectEvent(record, startEvent.ctrlKey && multiSelect);
        }

        const dragData = {
            context : info,
            ...productDragData,

            sourceDate       : startsOutsideView ? origStart : client.getDateFromCoordinate(coordinate),
            screenSourceDate : client.getDateFromCoordinate(clientCoordinate, null, false),

            startDate : origStart,
            endDate   : origEnd,
            timeDiff  : 0,

            origStart,
            origEnd,
            startsOutsideView,
            endsOutsideView,

            duration     : origEnd - origStart,
            browserEvent : startEvent // So we can know if SHIFT/CTRL was pressed
        };

        eventBarEls.forEach(el => el.classList.remove('b-sch-event-hover', 'b-active'));

        if (eventBarEls.length > 1) {
            // RelatedElements are secondary elements moved by the same delta as the grabbed element
            info.relatedElements = eventBarEls.slice(1);
        }

        return dragData;
    }

    //endregion

    //region Constraints

    // private
    setupConstraints(constrainRegion, elRegion, tickSize, constrained) {
        const
            me        = this,
            xTickSize = !me.showExactDropPosition && tickSize > 1 ? tickSize : 0,
            yTickSize = 0;

        // If `constrained` is false then we have no date constraints and should constrain mouse position to scheduling area
        // else we have specified date constraints and so we should limit mouse position to smaller region inside of constrained region using offsets and width.
        if (constrained) {
            me.setXConstraint(constrainRegion.left, constrainRegion.right - elRegion.width, xTickSize);
        }
        // And if not constrained, release any constraints from the previous drag.
        else {
            // minX being true means allow the start to be before the time axis.
            // maxX being true means allow the end to be after the time axis.
            me.setXConstraint(true, true, xTickSize);
        }
        me.setYConstraint(constrainRegion.top, constrainRegion.bottom - elRegion.height, yTickSize);
    }

    updateYConstraint(eventRecord, resourceRecord) {
        const
            me          = this,
            { client }  = me,
            { context } = me.drag,
            tickSize    = client.timeAxisViewModel.snapPixelAmount;

        // If we're dragging when the vertical size is recalculated by the host grid,
        // we must update our Y constraint unless we are locked in the Y axis.
        if (context && !me.drag.lockY) {
            let constrainRegion;

            // This calculates a relative region which the DragHelper uses within its outerElement
            if (me.constrainDragToTimeline) {
                constrainRegion = client.getScheduleRegion(resourceRecord, eventRecord);
            }
            // Not constraining to timeline.
            // Unusual configuration, but this must mean no Y constraining.
            else {
                me.setYConstraint(null, null, tickSize);
                return;
            }

            me.setYConstraint(
                constrainRegion.top,
                constrainRegion.bottom - context.element.offsetHeight,
                tickSize
            );
        }
        else {
            me.setYConstraint(null, null, tickSize);
        }
    }

    setXConstraint(iLeft, iRight, iTickSize) {
        const { drag } = this;

        drag.minX = iLeft;
        drag.maxX = iRight;
    }

    setYConstraint(iUp, iDown, iTickSize) {
        const { drag } = this;

        drag.minY = iUp;
        drag.maxY = iDown;
    }

    //endregion

    //region Other stuff

    adjustStartDate(startDate, timeDiff) {
        return this.client.timeAxis.roundDate(
            new Date(startDate - 0 + timeDiff),
            this.client.snapRelativeToEventStartDate ? startDate : false
        );
    }

    resolveStartEndDates(draggedElement) {
        const
            timeline        = this.currentOverClient,
            { timeAxis }    = timeline,
            proxyRect       = Rectangle.from(draggedElement, timeline.timeAxisSubGridElement),
            dd              = this.dragData,
            [record]        = dd.draggedEntities,
            { fullDuration } = record.isAssignment ? record.event : record;

        // Non continuous time axis will return null instead of date for a rectangle outside of the view unless
        // told to estimate date
        let { start : startDate, end : endDate } = timeline.getStartEndDatesFromRectangle(proxyRect, 'round', fullDuration, !timeAxis.isContinuous);

        // if dragging is out of timeAxis rect bounds, we will not be able to get dates
        if (startDate && endDate) {
            startDate = this.adjustStartDate(startDate, 0);

            if (!dd.startsOutsideView) {
                // Make sure we didn't target a start date that is filtered out, if we target last hour cell (e.g. 21:00) of
                // the time axis, and the next tick is 08:00 following day. Trying to drop at end of 21:00 cell should target start of next cell
                if (!timeAxis.dateInAxis(startDate, false)) {
                    const tick = timeAxis.getTickFromDate(startDate);

                    if (tick >= 0) {
                        startDate = timeAxis.getDateFromTick(tick);
                    }
                }

                endDate = startDate && DateHelper.add(startDate, fullDuration);
            }
            else if (!dd.endsOutsideView) {
                startDate = endDate && DateHelper.add(endDate, -fullDuration);
            }
        }

        return {
            startDate,
            endDate
        };
    }

    //endregion

    //region Dragtip

    /**
     * Gets html to display in tooltip while dragging event. Uses clockTemplate to display start & end dates.
     */
    getTipHtml() {
        const
            me                                      = this,
            { dragData, client, tooltipTemplate }   = me,
            { startDate, endDate, draggedEntities } = dragData,
            startText                               = client.getFormattedDate(startDate),
            endText                                 = client.getFormattedEndDate(endDate, startDate),
            { valid, message, element, dragProxy }  = dragData.context,
            tipTarget                               = dragProxy ? dragProxy.firstChild : element,
            dragged                                 = draggedEntities[0],
            // Scheduler always drags assignments
            timeSpanRecord                          = dragged.isTask ? dragged : dragged.event;

        // Keep align target up to date in case of derendering the target when
        // dragged outside render window, and re-entry into the render window.
        me.tip.lastAlignSpec.target = tipTarget;

        return tooltipTemplate({
            valid,
            startDate,
            endDate,
            startText,
            endText,
            dragData,
            message                                : message || '',
            [client.scheduledEventName + 'Record'] : timeSpanRecord,
            startClockHtml                         : me.clockTemplate.template({
                date : startDate,
                text : startText,
                cls  : 'b-sch-tooltip-startdate'
            }),
            endClockHtml : timeSpanRecord.isMilestone
                ? ''
                : me.clockTemplate.template({
                    date : endDate,
                    text : endText,
                    cls  : 'b-sch-tooltip-enddate'
                })
        });
    }

    //endregion

    //region Configurable

    // Constrain to time slot means lockX if we're horizontal, otherwise lockY
    set constrainDragToTimeSlot(value) {
        const axis = this.client.isHorizontal ? 'lockX' : 'lockY';

        this._constrainDragToTimeSlot = value;

        if (this.drag) {
            this.drag[axis] = value;
        }
    }

    get constrainDragToTimeSlot() {
        return this._constrainDragToTimeSlot;
    }

    // Constrain to resource means lockY if we're horizontal, otherwise lockX
    updateConstrainDragToResource(constrainDragToResource) {
        const me = this;

        if (me.drag) {
            const
                { constrainDragToTimeSlot } = me,
                { isHorizontal }            = me.client;

            if (constrainDragToResource) {
                me.constrainDragToTimeline = true;
            }
            me.drag.lockY = isHorizontal ? constrainDragToResource : constrainDragToTimeSlot;
            me.drag.lockX = isHorizontal ? constrainDragToTimeSlot : constrainDragToResource;
        }
    }

    updateConstrainDragToTimeline(constrainDragToTimeline) {
        if (!this.isConfiguring) {
            Object.assign(this.drag, {
                cloneTarget   : !constrainDragToTimeline,
                dragWithin    : constrainDragToTimeline ? null : document.body,
                scrollManager : constrainDragToTimeline ? this.client.scrollManager : null
            });
        }
    }

    //endregion

    //region Product specific, implemented in subclasses
    getElementFromContext(context) {
        return context.grabbed || context.dragProxy || context.element;
    }

    // Provide your custom implementation of this to allow additional selected records to be dragged together with the original one.
    getRelatedRecords(record) {
        return [];
    }

    getMinimalDragData(info, event) {
        // Can be overridden in subclass
        return {};
    }

    // Check if element can be dropped at desired location
    isValidDrop(dragData) {
        throw new Error('Implement in subclass');
    }

    // Similar to the fn above but also calls validatorFn
    checkDragValidity(dragData) {
        throw new Error('Implement in subclass');
    }

    // Update records being dragged
    updateRecords(context) {
        throw new Error('Implement in subclass');
    }

    // Determine if an element can be dragged
    isElementDraggable(el, event) {
        throw new Error('Implement in subclass');
    }

    // Get coordinate for correct axis
    getCoordinate(record, element, coord) {
        throw new Error('Implement in subclass');
    }

    // Product specific drag data
    setupProductDragData(info) {
        throw new Error('Implement in subclass');
    }

    // Product specific data in drag context
    getProductDragContext(dd) {
        throw new Error('Implement in subclass');
    }

    getRecordElement(record) {
        throw new Error('Implement in subclass');
    }

    //endregion
}
