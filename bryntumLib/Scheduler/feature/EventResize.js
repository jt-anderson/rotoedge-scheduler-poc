import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import Draggable from '../../Core/mixin/Draggable.js';
import Droppable from '../../Core/mixin/Droppable.js';
import DateHelper from '../../Core/helper/DateHelper.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import StringHelper from '../../Core/helper/StringHelper.js';
import Rectangle from '../../Core/helper/util/Rectangle.js';
import Tooltip from '../../Core/widget/Tooltip.js';
import ClockTemplate from '../tooltip/ClockTemplate.js';
import EventHelper from '../../Core/helper/EventHelper.js';
import BrowserHelper from '../../Core/helper/BrowserHelper.js';
import TimeSpan from '../../Scheduler/model/TimeSpan.js';
import GridFeatureManager from '../../Grid/feature/GridFeatureManager.js';

/**
 * @module Scheduler/feature/EventResize
 */

const tipAlign = {
    top    : 'b-t',
    right  : 'b100-t100',
    bottom : 't-b',
    left   : 'b100-t100'
};

/**
 * Feature that allows resizing an event by dragging its end.
 *
 * By default it displays a tooltip with the new start and end dates, formatted using
 * {@link Scheduler/view/mixin/TimelineViewPresets#config-displayDateFormat}.
 *
 * ## Customizing the resize tooltip
 *
 * To show custom HTML in the tooltip, please see the {@link #config-tooltipTemplate} config. Example:
 *
 * ```javascript
 * eventResize : {
 *     // A minimal end date tooltip
 *     tooltipTemplate : ({ record, endDate }) => {
 *         return DateHelper.format(endDate, 'MMM D');
 *     }
 * }
 * ```
 * This feature is **enabled** by default
 *
 * This feature is extended with a few overrides by the Gantt's `TaskResize` feature.
 *
 * This feature updates the event's `startDate` or `endDate` live in order to leverage the
 * rendering pathway to always yield a correct appearance. The changes are done in
 * {@link Core.data.Model#function-beginBatch batched} mode so that changes do not become
 * eligible for data synchronization or propagation until the operation is completed.
 *
 * @extends Core/mixin/InstancePlugin
 * @demo Scheduler/basic
 * @inlineexample Scheduler/feature/EventResize.js
 * @classtype eventResize
 * @feature
 */
export default class EventResize extends InstancePlugin.mixin(Draggable, Droppable) {
    //region Events

    /**
     * Fired on the owning Scheduler before resizing starts. Return `false` to prevent the action.
     * @event beforeEventResize
     * @on-owner
     * @preventable
     * @param {Scheduler.view.Scheduler} source Scheduler instance
     * @param {Scheduler.model.EventModel} eventRecord Event record being resized
     * @param {Scheduler.model.ResourceModel} resourceRecord Resource record the resize starts within
     * @param {MouseEvent} event Browser event
     */

    /**
     * Fires on the owning Scheduler when event resizing starts
     * @event eventResizeStart
     * @on-owner
     * @param {Scheduler.view.Scheduler} source Scheduler instance
     * @param {Scheduler.model.EventModel} eventRecord Event record being resized
     * @param {Scheduler.model.ResourceModel} resourceRecord Resource record the resize starts within
     * @param {MouseEvent} event Browser event
     */

    /**
     * Fires on the owning Scheduler on each resize move event
     * @event eventPartialResize
     * @on-owner
     * @param {Scheduler.view.Scheduler} source Scheduler instance
     * @param {Scheduler.model.EventModel} eventRecord Event record being resized
     * @param {Date} startDate
     * @param {Date} endDate
     * @param {HTMLElement} element
     */

    /**
     * Fired on the owning Scheduler to allow implementer to prevent immediate finalization by setting
     * `data.context.async = true` in the listener, to show a confirmation popup etc
     *
     * ```javascript
     *  scheduler.on('beforeeventresizefinalize', ({context}) => {
     *      context.async = true;
     *      setTimeout(() => {
     *          // async code don't forget to call finalize
     *          context.finalize();
     *      }, 1000);
     *  })
     * ```
     *
     * @event beforeEventResizeFinalize
     * @on-owner
     * @param {Scheduler.view.Scheduler} source Scheduler instance
     * @param {Object} context
     * @param {Scheduler.model.EventModel} context.eventRecord Event record being resized
     * @param {Date} context.startDate New startDate (changed if resizing start side)
     * @param {Date} context.endDate New endDate (changed if resizing end side)
     * @param {Boolean} context.async Set true to handle resize asynchronously (e.g. to wait for user confirmation)
     * @param {Function} context.finalize Call this method to finalize resize. This method accepts one argument:
     *                   pass `true` to update records, or `false`, to ignore changes
     */

    /**
     * Fires on the owning Scheduler after the resizing gesture has finished.
     * @event eventResizeEnd
     * @on-owner
     * @param {Scheduler.view.Scheduler} source Scheduler instance
     * @param {Boolean} changed Shows if the record has been changed by the resize action
     * @param {Scheduler.model.EventModel} eventRecord Event record being resized
     */

    //endregion

    //region Config

    static get $name() {
        return 'EventResize';
    }

    static get configurable() {
        return {
            draggingItemCls : 'b-sch-event-wrap-resizing',

            resizingItemInnerCls : 'b-sch-event-resizing',

            /**
             * Use left handle when resizing. Only applies when owning client's `direction` is 'horizontal'
             * @config {Boolean}
             * @default
             */
            leftHandle : true,

            /**
             * Use right handle when resizing. Only applies when owning client's `direction` is 'horizontal'
             * @config {Boolean}
             * @default
             */
            rightHandle : true,

            /**
             * Use top handle when resizing. Only applies when owning client's direction` is 'vertical'
             * @config {Boolean}
             * @default
             */
            topHandle : true,

            /**
             * Use bottom handle when resizing. Only applies when owning client's `direction` is 'vertical'
             * @config {Boolean}
             * @default
             */
            bottomHandle : true,

            /**
             * Resizing handle size
             * @config {Number}
             * @default
             */
            handleSize : 10,

            /**
             * Automatically shrink virtual handles when available space < handleSize. The virtual handles will
             * decrease towards width/height 1, reserving space between opposite handles to for example leave room for
             * dragging. To configure reserved space, see {@link #config-reservedSpace}.
             * @config {Boolean}
             * @default false
             */
            dynamicHandleSize : true,

            /**
             * Set to true to allow resizing to a zero-duration span
             * @config {Boolean}
             * @default false
             */
            allowResizeToZero : null,

            /**
             * Room in px to leave unoccupied by handles when shrinking them dynamically (see
             * {@link #config-dynamicHandleSize}).
             * @config {Number}
             * @default
             */
            reservedSpace : 5,

            /**
             * Resizing handle size on touch devices
             * @config {Number}
             * @default
             */
            touchHandleSize : 30,

            /**
             * The amount of pixels to move pointer/mouse before it counts as a drag operation.
             * @config {Number}
             * @default
             */
            dragThreshold : 0,

            dragTouchStartDelay : 0,

            draggingClsSelector : '.b-timeline-base',

            /**
             * `false` to not show a tooltip while resizing
             * @config {Boolean}
             * @default
             */
            showTooltip : true,

            /**
             * true to see exact event length during resizing
             * @config {Boolean}
             * @default
             */
            showExactResizePosition : false,

            /**
             * An empty function by default, but provided so that you can perform custom validation on
             * the item being resized. Return true if the new duration is valid, false to signal that it is not.
             * @param {Object} context The resize context, contains the record & dates.
             * @param {Scheduler.model.TimeSpan} context.record The record being resized.
             * @param {Date} context.startDate The new start date.
             * @param {Date} context.endDate The new start date.
             * @param {Event} event The browser Event object
             * @returns {Boolean}
             * @config {Function}
             */
            validatorFn : () => true,

            /**
             * `this` reference for the validatorFn
             * @config {Object}
             */
            validatorFnThisObj : null,

            /**
             * Setting this property may change the configuration of the {@link #config-tip}, or
             * cause it to be destroyed if `null` is passed.
             *
             * Reading this property returns the Tooltip instance.
             * @member {Core.widget.Tooltip|Object} tip
             */
            /**
             * If a tooltip is required to illustrate the resize, specify this as `true`, or a config
             * object for the {@link Core.widget.Tooltip}.
             * @config {Core.widget.Tooltip|Object}
             */
            tip : {
                $config : ['lazy', 'nullify'],
                value   : {
                    autoShow                 : false,
                    axisLock                 : true,
                    trackMouse               : false,
                    updateContentOnMouseMove : true,
                    hideDelay                : 0
                }
            },

            /**
             * A template function returning the content to show during a resize operation.
             * @param {Object} context A context object
             * @param {Date} context.startDate New start date
             * @param {Date} context.endDate New end date
             * @param {Scheduler.model.TimeSpan} context.record The record being resized
             * @config {Function} tooltipTemplate
             */
            tooltipTemplate : context => `
                <div class="b-sch-tip-${context.valid ? 'valid' : 'invalid'}">
                    ${context.startClockHtml}
                    ${context.endClockHtml}
                    <div class="b-sch-tip-message">${context.message}</div>
                </div>
            `,

            ignoreSelector : '.b-sch-terminal',
            dragActiveCls  : 'b-resizing-event'
        };
    }

    static get pluginConfig() {
        return {
            chain : ['render', 'onEventDataGenerated']
        };
    }

    //endregion

    //region Init & destroy

    doDestroy() {
        super.doDestroy();

        this.dragging?.destroy();
    }

    render() {
        const
            me         = this,
            { client } = me;

        // Only active when in these items
        me.dragSelector = me.dragItemSelector = client.eventSelector;

        // Set up elements and listeners
        me.dragRootElement = me.dropRootElement = client.timeAxisSubGridElement;

        // Larger draggable zones on pure touch devices with no mouse
        if (!me.handleSelector && !BrowserHelper.isHoverableDevice) {
            me.handleSize = me.touchHandleSize;
        }

        me.handleVisibilityThreshold = me.handleVisibilityThreshold || 2 * me.handleSize;

        // Drag only in time dimension
        me.dragLock = client.isVertical ? 'y' : 'x';
    }

    // Called for each event during render, allows manipulation of render data.
    onEventDataGenerated({ eventRecord, wrapperCls, cls }) {
        if (eventRecord === this.dragging?.context?.eventRecord) {
            wrapperCls['b-active'] =
                wrapperCls[this.draggingItemCls] =
                wrapperCls['b-over-resize-handle'] =
                cls['b-resize-handle'] =
                cls[this.resizingItemInnerCls] = 1;
        }
    }

    // Sneak a first peek at the drag event to put necessary date values into the context
    onDragPointerMove(event) {
        const
            {
                client,
                dragging
            }          = this,
            {
                visibleDateRange,
                isHorizontal
            }          = client,
            rtl        = isHorizontal && client.rtl,
            dimension  = isHorizontal ? 'X' : 'Y',
            pageScroll = globalThis[`page${dimension}Offset`],
            coord      = event[`page${dimension}`] + (dragging.context?.offset || 0),
            clientRect = Rectangle.from(client.timeAxisSubGridElement, null, true),
            startCoord = clientRect.getStart(rtl, isHorizontal),
            endCoord   = clientRect.getEnd(rtl, isHorizontal);

        let date = client.getDateFromCoord({ coord, local : false });

        if (rtl) {
            // If we're dragging off the start side, fix at the visible startDate
            if (coord - pageScroll > startCoord) {
                date = visibleDateRange.startDate;
            }
            // If we're dragging off the end side, fix at the visible endDate
            else if (coord < endCoord) {
                date = visibleDateRange.endDate;
            }
        }
        // If we're dragging off the start side, fix at the visible startDate
        else if (coord - pageScroll < startCoord) {
            date = visibleDateRange.startDate;
        }
        // If we're dragging off the end side, fix at the visible endDate
        else if (coord - pageScroll > endCoord) {
            date = visibleDateRange.endDate;
        }

        dragging.clientStartCoord = startCoord;
        dragging.clientEndCoord = endCoord;
        dragging.date = date;

        super.onDragPointerMove(event);
    }

    get isResizing() {
        return Boolean(this.dragging);
    }

    beforeDrag(drag) {
        const
            { client }     = this,
            eventRecord    = client.resolveTimeSpanRecord(drag.itemElement),
            resourceRecord = !client.isGanttBase && client.resolveResourceRecord(client.isVertical ? drag.startEvent : drag.itemElement);

        if (this.disabled || client.readOnly || eventRecord?.readOnly || resourceRecord?.readOnly || super.beforeDrag(drag) === false) {
            return false;
        }

        drag.mousedownDate = drag.date = client.getDateFromCoordinate(drag.event[`page${client.isHorizontal ? 'X' : 'Y'}`], null, false);

        // trigger beforeEventResize or beforeTaskResize depending on product
        return this.triggerBeforeResize(drag);
    }

    dragStart(drag) {
        const
            me             = this,
            {
                client,
                tip
            }              = me,
            {
                startEvent,
                itemElement
            }              = drag,
            name           = client.scheduledEventName,
            eventRecord    = client.resolveEventRecord(itemElement),
            {
                isBatchUpdating,
                wrapStartDate,
                wrapEndDate
            } = eventRecord,
            useEventBuffer = client.features.eventBuffer?.enabled,
            eventStartDate = isBatchUpdating ? eventRecord.get('startDate') : eventRecord.startDate,
            eventEndDate   = isBatchUpdating ? eventRecord.get('endDate') : eventRecord.endDate,
            horizontal     = me.dragLock === 'x',
            rtl            = horizontal && client.rtl,
            draggingEnd    = me.isOverEndHandle(startEvent, itemElement),
            toSet          = draggingEnd ? 'endDate' : 'startDate',
            wrapToSet      = !useEventBuffer ? null : draggingEnd ? 'wrapEndDate' : 'wrapStartDate',
            otherEnd       = draggingEnd ? 'startDate' : 'endDate',
            setMethod      = draggingEnd ? 'setEndDate' : 'setStartDate',
            setOtherMethod = draggingEnd ? 'setStartDate' : 'setEndDate',
            elRect         = Rectangle.from(itemElement),
            startCoord     = horizontal ? startEvent.clientX : startEvent.clientY,
            endCoord       = draggingEnd ? elRect.getEnd(rtl, horizontal) : elRect.getStart(rtl, horizontal),
            context        = drag.context = {
                eventRecord,
                element        : itemElement,
                timespanRecord : eventRecord,
                taskRecord     : eventRecord,
                owner          : me,
                valid          : true,
                oldValue       : draggingEnd ? eventEndDate : eventStartDate,
                startDate      : eventStartDate,
                endDate        : eventEndDate,
                offset         : useEventBuffer ? 0 : endCoord - startCoord,
                edge           : horizontal ? (draggingEnd ? 'right' : 'left') : (draggingEnd ? 'bottom' : 'top'),
                finalize       : me.finalize,
                event          : drag.event,

                originalStartDate : eventStartDate,
                originalEndDate   : eventEndDate,
                wrapStartDate,
                wrapEndDate,
                draggingEnd,
                toSet,
                wrapToSet,
                otherEnd,
                setMethod,
                setOtherMethod
            };

        // The record must know that it is being resized.
        eventRecord.meta.isResizing = true;

        client.element.classList.add(...me.dragActiveCls.split(' '));

        // During this batch we want the client's UI to update itself using the proposed changes
        // Only if startDrag has not already done it
        if (!client.listenToBatchedUpdates) {
            client.beginListeningForBatchedUpdates();
        }

        // No changes must get through to data.
        // Only if startDrag has not already started the batch
        if (!isBatchUpdating) {
            eventRecord.beginBatch();
        }

        // Let products do their specific stuff
        me.setupProductResizeContext(context, startEvent);

        // Trigger eventResizeStart or taskResizeStart depending on product
        // Subclasses (like EventDragCreate) won't actually fire this event.
        me.triggerEventResizeStart(`${name}ResizeStart`, {
            [`${name}Record`] : eventRecord,
            event             : startEvent,
            ...me.getResizeStartParams(context)
        }, context);

        // Scheduler renders assignments, Gantt renders Tasks
        context.resizedRecord = client.resolveAssignmentRecord?.(context.element) || eventRecord;

        if (tip) {
            // Tip needs to be shown first for getTooltipTarget to be able to measure anchor size
            tip.show();
            tip.align = tipAlign[context.edge];
            tip.showBy(me.getTooltipTarget(drag));
        }
    }

    // Subclasses may override this
    triggerBeforeResize(drag) {
        const
            { client }  = this,
            eventRecord = client.resolveTimeSpanRecord(drag.itemElement);

        return client.trigger(
            `before${client.capitalizedEventName}Resize`,
            {
                [`${client.scheduledEventName}Record`] : eventRecord,
                event                                  : drag.event,
                ...this.getBeforeResizeParams({ event : drag.startEvent, element : drag.itemElement })
            }
        );
    }

    // Subclasses may override this
    triggerEventResizeStart(eventType, event, context) {
        this.client.trigger(eventType, event);

        // Hook for features that needs to react on resize start
        this.client[`after${StringHelper.capitalize(eventType)}`]?.(context, event);
    }

    dragEnter(drag) {
        // We only respond to our own DragContexts
        return drag.context?.owner === this;
    }

    // Override the draggable interface so that we can update the bar while dragging outside
    // the Draggable's rootElement (by default it stops notifications when outside rootElement)
    moveDrag(drag) {
        const
            me          = this,
            {
                client,
                tip
            }           = me,
            horizontal  = me.dragLock === 'x',
            dimension   = horizontal ? 'X' : 'Y',
            name        = client.scheduledEventName,
            {
                visibleDateRange,
                enableEventAnimations,
                timeAxis,
                weekStartDay
            }           = client,
            rtl         = horizontal && client.rtl,
            {
                resolutionUnit,
                resolutionIncrement
            }           = timeAxis,
            {
                event,
                context
            }           = drag,
            {
                eventRecord
            }           = context,
            offset      = context.offset * (rtl ? -1 : 1),
            {
                isOccurrence
            }           = eventRecord,
            eventStart  = eventRecord.get('startDate'),
            eventEnd    = eventRecord.get('endDate'),
            coord       = event[`client${dimension}`] + offset,
            clientRect  = Rectangle.from(client.timeAxisSubGridElement, null, true),
            startCoord  = clientRect.getStart(rtl, horizontal),
            endCoord    = clientRect.getEnd(rtl, horizontal);

        context.event = event;

        // If this is the last move event recycled because of a scroll, refresh the date
        if (event.isScroll) {
            drag.date = client.getDateFromCoordinate(event[`page${dimension}`] + offset, null, false);
        }

        let crossedOver, avoidedZeroSize,
            // Use the value set up in onDragPointerMove by default
            { date } = drag,
            {
                toSet,
                otherEnd,
                draggingEnd
            } = context;

        if (rtl) {
            // If we're dragging off the start side, fix at the visible startDate
            if (coord > startCoord) {
                date = drag.date = visibleDateRange.startDate;
            }
            // If we're dragging off the end side, fix at the visible endDate
            else if (coord < endCoord) {
                date = drag.date = visibleDateRange.endDate;
            }

        }
        // If we're dragging off the start side, fix at the visible startDate
        else if (coord < startCoord) {
            date = drag.date = visibleDateRange.startDate;
        }
        // If we're dragging off the end side, fix at the visible endDate
        else if (coord > endCoord) {
            date = drag.date = visibleDateRange.endDate;
        }

        // Detect crossover which some subclasses might need to process
        if (toSet === 'endDate') {
            if (date < eventStart) {
                crossedOver = -1;
            }
        }
        else {
            if (date > eventEnd) {
                crossedOver = 1;
            }
        }

        // If we dragged the dragged end over to the opposite side of the start end.
        // Some subclasses allow this and need to respond. EventDragCreate does this.
        if (crossedOver && me.onDragEndSwitch) {
            me.onDragEndSwitch(context, date, crossedOver);
            otherEnd = context.otherEnd;
            toSet = context.toSet;
        }

        if (client.snapRelativeToEventStartDate) {
            date = timeAxis.roundDate(date, context.oldValue);
        }

        // The displayed and eventual data value
        context.snappedDate = DateHelper.round(date, timeAxis.resolution, null, weekStartDay);

        const duration = DateHelper.diff(date, context[otherEnd], resolutionUnit) * (draggingEnd ? -1 : 1);

        // Narrower than half resolutionIncrement will abort drag creation, set flag to have UI reflect this
        if (me.isEventDragCreate) {
            context.tooNarrow = duration < resolutionIncrement / 2;
        }
        // The mousepoint date means that the duration is less than resolutionIncrement resolutionUnits.
        // Ensure that the dragged end is at least resolutionIncrement resolutionUnits from the other end.
        else if (duration < resolutionIncrement) {
            // Snap to zero if allowed
            if (me.allowResizeToZero) {
                context.snappedDate = date = context[otherEnd];
            }
            else {
                const sign = otherEnd === 'startDate' ? 1 : -1;
                context.snappedDate = date = timeAxis.roundDate(DateHelper.add(eventRecord.get(otherEnd), resolutionIncrement * sign, resolutionUnit));
                avoidedZeroSize = true;
            }
        }

        // Keep desired date within constraints
        if (context.dateConstraints) {
            date = DateHelper.constrain(date, context.dateConstraints.start, context.dateConstraints.end);
            context.snappedDate = DateHelper.constrain(context.snappedDate, context.dateConstraints.start, context.dateConstraints.end);
        }

        // If the mouse move has changed the detected date
        if (!context.date || date - context.date || avoidedZeroSize) {
            context.date = date;

            // The validityFn needs to see the proposed value.
            // Consult our snap config to see if we should be dragging in snapped mode
            context[toSet] = me.showExactResizePosition || client.timeAxisViewModel.snap ? context.snappedDate : date;

            // Snapping would take it to zero size - this is not allowed in drag resizing.
            if (!(context[toSet] - context[toSet === 'startDate' ? 'endDate' : 'startDate']) && !me.allowResizeToZero) {
                context.valid = false;
                return;
            }

            // If the date to push into the record is new...
            if (eventRecord.get(toSet) - context[toSet]) {
                context.valid = me.checkValidity(context, event);
                context.message = '';

                if (context.valid && typeof context.valid !== 'boolean') {
                    context.message = context.valid.message;
                    context.valid = context.valid.valid;
                }

                // If users returns nothing, that's interpreted as valid
                context.valid = (context.valid !== false);

                // Only update the event if the validation passed.
                if (context.valid) {
                    const partialResizeEvent = {
                        [`${name}Record`] : eventRecord,
                        startDate         : eventStart,
                        endDate           : eventEnd,
                        element           : drag.itemElement,
                        context
                    };

                    // Update the event we are about to fire and the context *before* we update the record
                    partialResizeEvent[toSet] = context[toSet];

                    // Trigger eventPartialResize or taskPartialResize depending on product
                    client.trigger(`${name}PartialResize`, partialResizeEvent);

                    // An occurrence must have a store to announce its batched changes through.
                    // They must usually never have a store - they are transient, but we
                    // need to update the UI.
                    if (isOccurrence) {
                        eventRecord.stores.push(client.eventStore);
                    }

                    // Update the eventRecord.
                    // Use setter rather than accessor so that in a Project, the entity's
                    // accessor doesn't propagate the change to the whole project.
                    // Scheduler must not animate this.
                    client.enableEventAnimations = false;
                    if (client.features.eventBuffer?.enabled) {
                        if (toSet === 'startDate') {
                            const diff = context.startDate.getTime() - context.originalStartDate.getTime();
                            eventRecord.wrapStartDate = new Date(context.wrapStartDate.getTime() + diff);
                        }

                        if (toSet === 'endDate') {
                            const diff = context.endDate.getTime() - context.originalEndDate.getTime();
                            eventRecord.wrapEndDate = new Date(context.wrapEndDate.getTime() + diff);
                        }
                    }
                    eventRecord.set(toSet, context[toSet]);
                    client.enableEventAnimations = enableEventAnimations;

                    if (isOccurrence) {
                        eventRecord.stores.length = 0;
                    }
                }

                // Flag drag created too narrow events as invalid late, want all code above to execute for them
                // to get the proper size rendered
                if (context.tooNarrow) {
                    context.valid = false;
                }
            }
        }

        if (tip) {
            // In case of edge flip (EventDragCreate), the align point may change
            tip.align = tipAlign[context.edge];
            tip.alignTo(me.getTooltipTarget(drag));
        }

        super.moveDrag(drag);
    }

    dragEnd(drag) {
        const { context } = drag;

        if (context) {
            context.event = drag.event;
        }

        if (drag.aborted) {
            context?.finalize(false);
        }
        // 062_resize.t.js specifies that if drag was not started but the mouse has moved,
        // the eventresizestart and eventresizeend must fire
        else if (!this.isEventDragCreate && !drag.started && !EventHelper.getPagePoint(drag.event).equals(EventHelper.getPagePoint(drag.startEvent))) {
            this.dragStart(drag);
            this.cleanup(drag.context, false);
        }
    }

    async dragDrop({ context, event }) {
        // Set the start/end date, whichever we were dragging
        // to the correctly rounded value before updating.
        context[context.toSet] = context.snappedDate;

        const
            {
                client
            } = this,
            {
                startDate,
                endDate
            } = context;

        let modified;

        this.tip?.hide();

        context.valid = startDate && endDate && (this.allowResizeToZero || (endDate - startDate > 0)) && // Input sanity check
            (context[context.toSet] - context.oldValue) && // Make sure dragged end end changed
            context.valid !== false;

        if (context.valid) {
            // Seems to be a valid resize operation, ask outside world if anyone wants to take control over the finalizing,
            // to show a confirm dialog prior to applying the new values. Triggers beforeEventResizeFinalize or
            // beforeTaskResizeFinalize depending on product
            client.trigger(`before${client.capitalizedEventName}ResizeFinalize`, { context, event, [`${client.scheduledEventName}Record`] : context.eventRecord });
            modified = true;
        }

        // If a handler has set the async flag, it means that they are going to finalize
        // the operation at some time in the future, so we should not call it.
        if (!context.async) {
            await context.finalize(modified);
        }
    }

    // This is called with a thisObj of the context object
    // We set "me" to the owner, and "context" to the thisObj so that it
    // reads as if it were a method of this class.
    async finalize(updateRecord) {
        const
            me      = this.owner,
            context = this,
            {
                eventRecord,
                oldValue,
                toSet
            }       = context,
            {
                snapRelativeToEventStartDate,
                timeAxis
            }       = me.client;

        let wasChanged = false;

        if (updateRecord) {
            if (snapRelativeToEventStartDate) {
                context[toSet] = context.snappedDate = timeAxis.roundDate(context.date, oldValue);
            }

            // Each product updates the record differently
            wasChanged = await me.internalUpdateRecord(context, eventRecord);
        }
        else {
            // Reverts the changes, a batchedUpdate event will fire which will reset the UI
            eventRecord.cancelBatch();

            // Manually trigger redraw of occurrences since they are not part of any stores
            if (eventRecord.isOccurrence) {
                eventRecord.resources.forEach(resource => me.client.repaintEventsForResource(resource));
            }
        }

        me.cleanup(context, wasChanged);
    }

    // This is always called on drop or abort.
    cleanup(context, changed) {
        const
            me               = this,
            { client }       = me,
            {
                element,
                eventRecord
            }                = context,
            name             = client.scheduledEventName;

        // The record must know that it is being resized.
        eventRecord.meta.isResizing = false;

        client.endListeningForBatchedUpdates();
        me.tip?.hide();
        me.unHighlightHandle(element);
        client.element.classList.remove(...me.dragActiveCls.split(' '));
        // if (dependencies) {
        //     // When resizing is done and mouse is over element, we show terminals
        //     if (element.matches(':hover')) {
        //         dependencies.showTerminals(eventRecord, element);
        //     }
        // }

        // Triggers eventResizeEnd or taskResizeEnd depending on product
        client.trigger(`${name}ResizeEnd`, {
            changed,
            [`${name}Record`] : eventRecord,
            ...me.getResizeEndParams(context)
        });
    }

    async internalUpdateRecord(context, timespanRecord) {
        const
            { client }     = this,
            { generation } = timespanRecord;

        // Special handling of occurrences, they need normalization since that is not handled by engine at the moment
        if (timespanRecord.isOccurrence) {
            client.endListeningForBatchedUpdates();

            // If >1 level deep, just unwind one level.
            timespanRecord[timespanRecord.batching > 1 ? 'endBatch' : 'cancelBatch']();
            timespanRecord.set(TimeSpan.prototype.inSetNormalize.call(timespanRecord, {
                startDate : context.startDate,
                endDate   : context.endDate
            }));
        }
        else {
            const toSet = {
                [context.toSet] : context[context.toSet]
            };

            // If we have the Engine available, consult it to calculate a corrected duration.
            // Adjust the dragged date point to conform with the calculated duration.
            if (timespanRecord.isEntity) {
                const
                    {
                        startDate,
                        endDate,
                        draggingEnd
                    } = context;

                // Fix the duration according to the Entity's rules.
                context.duration = toSet.duration = timespanRecord.run('calculateProjectedDuration', startDate, endDate);

                // Fix the dragged date point according to the Entity's rules.
                toSet[context.toSet] = timespanRecord.run('calculateProjectedXDateWithDuration', draggingEnd ? startDate : endDate, draggingEnd, context.duration);

                const setOtherEnd = !timespanRecord[context.otherEnd];

                // Set all values, start and end in case they had never been set
                // ie, we're now scheduling a previously unscheduled event.
                if (setOtherEnd) {
                    toSet[context.otherEnd] = context[context.otherEnd];
                }

                // Update the record to its final correct state using *batched changes*
                // These will *not* be propagated, it's just to force the dragged event bar
                // into its corrected shape before the real changes which will propagate are applied below.
                // We MUST do it like this because the final state may not be a net change if the changes
                // got rejected, and in that case, the engine will not end up firing any change events.
                timespanRecord.set(toSet);

                // Quit listening for batchedUpdate *before* we cancel the batch so that the
                // change events from the revert do not update the UI.
                client.endListeningForBatchedUpdates();
                timespanRecord.cancelBatch();

                // Clear estimated wrap date, exact wrap date will be calculated when referred to from renderer
                if (client.features.eventBuffer?.enabled) {
                    timespanRecord[context.wrapToSet] = null;
                }

                const promisesToWait = [];

                // Really update the data after cancelling the batch
                if (setOtherEnd) {
                    promisesToWait.push(timespanRecord[context.setOtherMethod](toSet[context.otherEnd], false));
                }

                promisesToWait.push(timespanRecord[context.setMethod](toSet[context.toSet], false));

                await Promise.all(promisesToWait);

                timespanRecord.endBatch();
            }
            else {
                // Collect any changes (except the start/end date) that happened during the resize operation
                const batchChanges = Object.assign({}, timespanRecord.meta.batchChanges);
                delete batchChanges[context.toSet];
                client.endListeningForBatchedUpdates();

                timespanRecord.cancelBatch();

                timespanRecord.set(batchChanges);
                timespanRecord[context.setMethod](toSet[context.toSet], false);
            }
        }

        // If the record has been changed
        return timespanRecord.generation !== generation;
    }

    onDragItemMouseMove(event) {
        if (event.pointerType !== 'touch' && !this.handleSelector) {
            this.checkResizeHandles(event);
        }
    }

    /**
     * Check if mouse is over a resize handle (virtual). If so, highlight.
     * @private
     * @param {MouseEvent} event
     */
    checkResizeHandles(event) {
        const
            me           = this,
            { overItem } = me;

        // mouse over a target element and allowed to resize?
        if (overItem && !me.client.readOnly && (!me.allowResize || me.allowResize(overItem, event))) {
            const eventRecord = me.client.resolveTimeSpanRecord(overItem);

            if (eventRecord?.readOnly) {
                return;
            }

            if (me.isOverAnyHandle(event, overItem)) {
                me.highlightHandle(); // over handle
            }
            else {
                me.unHighlightHandle(); // not over handle
            }
        }
    }

    onDragItemMouseLeave(event, oldOverItem) {
        this.unHighlightHandle(oldOverItem);
    }

    /**
     * Highlights handles (applies css that changes cursor).
     * @private
     */
    highlightHandle() {
        const
            {
                overItem : item,
                client
            }      = this,
            inner  = item.syncIdMap?.[client.scheduledEventName] ?? item.querySelector(client.eventInnerSelector);

        // over a handle, add cls to change cursor
        inner.classList.add('b-resize-handle');
        item.classList.add('b-over-resize-handle');
    }

    /**
     * Unhighlight handles (removes css).
     * @private
     */
    unHighlightHandle(item = this.overItem) {
        if (item) {
            const
                me    = this,
                inner = item.syncIdMap?.[me.client.scheduledEventName] ?? item.querySelector(me.client.eventInnerSelector);

            inner.classList.remove('b-resize-handle', me.resizingItemInnerCls);
            item.classList.remove('b-over-resize-handle', me.draggingItemCls);
        }
    }

    isOverAnyHandle(event, target) {
        return this.isOverStartHandle(event, target) || this.isOverEndHandle(event, target);
    }

    isOverStartHandle(event, target) {
        return this.dragLock === 'x' ? this[`isOver${this.client.rtl ? 'Right' : 'Left'}Handle`](event, target) : this.isOverTopHandle(event, target);
    }

    isOverEndHandle(event, target) {
        return this.dragLock === 'x' ? this[`isOver${this.client.rtl ? 'Left' : 'Right'}Handle`](event, target) : this.isOverBottomHandle(event, target);
    }

    getDynamicHandleSize(opposite, offsetSize) {
        const
            handleCount    = opposite ? 2 : 1,
            { handleSize } = this;

        // Shrink handle size when configured to do so, preserving reserved space between handles
        if (this.dynamicHandleSize && handleSize * handleCount > offsetSize - this.reservedSpace) {
            return Math.max(Math.floor((offsetSize - this.reservedSpace) / handleCount), 0);
        }

        return handleSize;
    }

    /**
     * Check if over left handle (virtual).
     * @private
     * @param {MouseEvent} event MouseEvent
     * @param {HTMLElement} target The current target element
     * @returns {Boolean} Returns true if mouse is over left handle, otherwise false
     */
    isOverLeftHandle(event, target) {
        const me = this;

        // Use inner element if buffers are enabled, since by default inner element is 1 px shorter than wrap
        if (me.client.features.eventBuffer?.enabled) {
            target = target.querySelector(`.${me.client.eventCls}`);
        }

        const
            { offsetWidth } = target,
            timespanRecord  = me.client.resolveTimeSpanRecord(target),
            resizable       = timespanRecord?.isResizable;

        if (!me.disabled && me.leftHandle && (offsetWidth >= me.handleVisibilityThreshold || me.dynamicHandleSize) && (resizable === true || resizable === 'start')) {
            const leftHandle = Rectangle.from(target);

            leftHandle.width = me.getDynamicHandleSize(me.rightHandle, offsetWidth);

            return leftHandle.width > 0 && leftHandle.contains(EventHelper.getPagePoint(event));
        }
        return false;
    }

    /**
     * Check if over right handle (virtual).
     * @private
     * @param {MouseEvent} event MouseEvent
     * @param {HTMLElement} target The current target element
     * @returns {Boolean} Returns true if mouse is over left handle, otherwise false
     */
    isOverRightHandle(event, target) {
        const me = this;

        // Use inner element if buffers are enabled, since by default inner element is 1 px shorter than wrap
        if (me.client.features.eventBuffer?.enabled) {
            target = target.querySelector(`.${me.client.eventCls}`);
        }

        const
            { offsetWidth } = target,
            timespanRecord  = me.client.resolveTimeSpanRecord(target),
            resizable       = timespanRecord?.isResizable;

        if (!me.disabled && me.rightHandle && (offsetWidth >= me.handleVisibilityThreshold || me.dynamicHandleSize) && (resizable === true || resizable === 'end')) {
            const rightHandle = Rectangle.from(target);

            rightHandle.x = Math.floor(rightHandle.right - me.getDynamicHandleSize(me.leftHandle, offsetWidth));

            return rightHandle.width > 0 && rightHandle.contains(EventHelper.getPagePoint(event));
        }
        return false;
    }

    /**
     * Check if over top handle (virtual).
     * @private
     * @param {MouseEvent} event MouseEvent
     * @param {HTMLElement} target The current target element
     * @returns {Boolean} Returns true if mouse is over top handle, otherwise false
     */
    isOverTopHandle(event, target) {
        const me = this;

        // Use inner element if buffers are enabled, since by default inner element is 1 px shorter than wrap
        if (me.client.features.eventBuffer?.enabled) {
            target = target.querySelector(`.${me.client.eventCls}`);
        }

        const
            { offsetHeight } = target,
            timespanRecord   = me.client.resolveTimeSpanRecord(target),
            resizable        = timespanRecord?.isResizable;

        if (!me.disabled && me.topHandle && (offsetHeight >= me.handleVisibilityThreshold || me.dynamicHandleSize) && (resizable === true || resizable === 'start')) {
            const topHandle = Rectangle.from(target);

            topHandle.height = me.getDynamicHandleSize(me.bottomHandle, offsetHeight);

            return topHandle.height > 0 && topHandle.contains(EventHelper.getPagePoint(event));
        }
        return false;
    }

    /**
     * Check if over bottom handle (virtual).
     * @private
     * @param {MouseEvent} event MouseEvent
     * @param {HTMLElement} target The current target element
     * @returns {Boolean} Returns true if mouse is over bottom handle, otherwise false
     */
    isOverBottomHandle(event, target) {
        const me = this;

        // Use inner element if buffers are enabled, since by default inner element is 1 px shorter than wrap
        if (me.client.features.eventBuffer?.enabled) {
            target = target.querySelector(`.${me.client.eventCls}`);
        }

        const
            { offsetHeight } = target,
            timespanRecord   = me.client.resolveTimeSpanRecord(target),
            resizable        = timespanRecord?.isResizable;

        if (!me.disabled && me.bottomHandle && (offsetHeight >= me.handleVisibilityThreshold || me.dynamicHandleSize) && (resizable === true || resizable === 'end')) {
            const bottomHandle = Rectangle.from(target);

            bottomHandle.y = Math.floor(bottomHandle.bottom - me.getDynamicHandleSize(me.bottomHandle, offsetHeight));

            return bottomHandle.height > 0 && bottomHandle.contains(EventHelper.getPagePoint(event));
        }
        return false;
    }

    setupDragContext(event) {
        const me = this;

        // Only start a drag if we are over a handle zone.
        if (me.overItem && me.isOverAnyHandle(event, me.overItem) && me.isElementResizable(me.overItem, event)) {
            const result = super.setupDragContext(event);

            result.scrollManager = me.client.scrollManager;

            return result;
        }
    }

    changeTip(tip, oldTip) {
        const me = this;

        if (!me.showTooltip) {
            return null;
        }

        if (tip) {
            if (tip.isTooltip) {
                tip.owner = me;
            }
            else {
                tip = Tooltip.reconfigure(oldTip, Tooltip.mergeConfigs({
                    id : `${me.client.id}-event-resize-tip`
                }, tip, {
                    getHtml : me.getTipHtml.bind(me),
                    owner   : me.client
                }, me.tip), {
                    owner    : me,
                    defaults : {
                        type : 'tooltip'
                    }
                });
            }

            tip.on({
                innerhtmlupdate : 'updateDateIndicator',
                thisObj         : me
            });

            me.clockTemplate = new ClockTemplate({
                scheduler : me.client
            });
        }
        else if (oldTip) {
            oldTip.destroy();
            me.clockTemplate?.destroy();
        }

        return tip;
    }

    //endregion

    //region Events

    isElementResizable(element, event) {
        const
            me             = this,
            { client }     = me,
            timespanRecord = client.resolveTimeSpanRecord(element);

        if (client.readOnly) {
            return false;
        }

        let resizable = timespanRecord?.isResizable;

        // go up from "handle" to resizable element
        element = DomHelper.up(event.target, client.eventSelector);

        // Not resizable if the mousedown is on a resizing handle of
        // a percent bar.
        const
            handleHoldingElement = element ? element.syncIdMap[client.scheduledEventName] : element,
            handleEl             = event.target.closest('[class$="-handle"]');

        if (!resizable || (handleEl && handleEl !== handleHoldingElement)) {
            return false;
        }

        const
            startsOutside = element.classList.contains('b-sch-event-startsoutside'),
            endsOutside   = element.classList.contains('b-sch-event-endsoutside');

        if (resizable === true) {
            if (startsOutside && endsOutside) {
                return false;
            }
            else if (startsOutside) {
                resizable = 'end';
            }
            else if (endsOutside) {
                resizable = 'start';
            }
            else {
                return me.isOverStartHandle(event, element) || me.isOverEndHandle(event, element);
            }
        }

        if (
            (startsOutside && resizable === 'start') ||
            (endsOutside && resizable === 'end')
        ) {
            return false;
        }

        if (
            (me.isOverStartHandle(event, element) && resizable === 'start') ||
            (me.isOverEndHandle(event, element) && resizable === 'end')
        ) {
            return true;
        }

        return false;
    }

    updateDateIndicator() {
        const
            { clockTemplate } = this,
            {
                eventRecord,
                draggingEnd,
                snappedDate
            }                 = this.dragging.context,
            startDate         = draggingEnd ? eventRecord.get('startDate') : snappedDate,
            endDate           = draggingEnd ? snappedDate : eventRecord.get('endDate'),
            { element }       = this.tip;

        clockTemplate.updateDateIndicator(element.querySelector('.b-sch-tooltip-startdate'), startDate);
        clockTemplate.updateDateIndicator(element.querySelector('.b-sch-tooltip-enddate'), endDate);
    }

    getTooltipTarget({ itemElement, context }) {
        const
            me      = this,
            { rtl } = me.client,
            target  = Rectangle.from(itemElement, null, true);

        if (me.dragLock === 'x') {
            // Align to the dragged edge of the proxy, and then bump right so that the anchor aligns perfectly.
            if ((!rtl && context.edge === 'right') || (rtl && context.edge === 'left')) {
                target.x = target.right - 1;
            }
            target.width = me.tip.anchorSize[0] / 2;
        }
        else {
            // Align to the dragged edge of the proxy, and then bump bottom so that the anchor aligns perfectly.
            if (context.edge === 'bottom') {
                target.y = target.bottom - 1;
            }
            target.height = me.tip.anchorSize[1] / 2;
        }

        return { target };
    }

    basicValidityCheck(context, event) {
        return context.startDate &&
            (context.endDate > context.startDate || this.allowResizeToZero) &&
            this.validatorFn.call(this.validatorFnThisObj || this, context, event);
    }

    //endregion

    //region Tooltip

    getTipHtml({ tip }) {
        const
            me = this,
            {
                startDate,
                endDate,
                toSet,
                snappedDate,
                valid,
                message = '',
                timespanRecord
            }  = me.dragging.context;

        // Empty string hides the tip - we get called before the Resizer, so first call will be empty
        if (!startDate || !endDate) {
            return tip.html;
        }

        // Set whichever one we are moving
        const tipData = {
            record  : timespanRecord,
            valid,
            message,
            startDate,
            endDate,
            [toSet] : snappedDate
        };

        // Format the two ends. This has to be done outside of the object initializer
        // because they use properties that are only in the tipData object.
        tipData.startText = me.client.getFormattedDate(tipData.startDate);
        tipData.endText = me.client.getFormattedDate(tipData.endDate);
        tipData.startClockHtml = me.clockTemplate.template({
            date : tipData.startDate,
            text : tipData.startText,
            cls  : 'b-sch-tooltip-startdate'
        });
        tipData.endClockHtml = me.clockTemplate.template({
            date : tipData.endDate,
            text : tipData.endText,
            cls  : 'b-sch-tooltip-enddate'
        });

        return me.tooltipTemplate(tipData);
    }

    //endregion

    //region Product specific, may be overridden in subclasses

    getBeforeResizeParams(context) {
        const { client } = this;

        return {
            resourceRecord : client.resolveResourceRecord(client.isVertical ? context.event : context.element)
        };
    }

    getResizeStartParams(context) {
        return {
            resourceRecord : context.resourceRecord
        };
    }

    getResizeEndParams(context) {
        return {
            resourceRecord : context.resourceRecord,
            event          : context.event
        };
    }

    setupProductResizeContext(context, event) {
        const
            { client }       = this,
            { element }      = context,
            eventRecord      = client.resolveEventRecord(element),
            resourceRecord   = client.resolveResourceRecord?.(element),
            assignmentRecord = client.resolveAssignmentRecord?.(element);

        Object.assign(context, {
            eventRecord,
            taskRecord      : eventRecord,
            resourceRecord,
            assignmentRecord,
            dateConstraints : client.getDateConstraints?.(resourceRecord, eventRecord)
        });
    }

    checkValidity(context, event) {
        return (
            this.client.allowOverlap ||
            this.client.isDateRangeAvailable(context.startDate, context.endDate, context.eventRecord, context.resourceRecord)
        ) && this.basicValidityCheck(context, event);
    }

    //endregion
}

GridFeatureManager.registerFeature(EventResize, true, 'Scheduler');
GridFeatureManager.registerFeature(EventResize, false, 'ResourceHistogram');
