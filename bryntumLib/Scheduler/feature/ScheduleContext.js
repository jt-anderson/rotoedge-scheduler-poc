import DomHelper from '../../Core/helper/DomHelper.js';
import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from '../../Grid/feature/GridFeatureManager.js';
import Delayable from '../../Core/mixin/Delayable.js';

/**
 * @module Scheduler/feature/ScheduleContext
 */

/**
 * Allow visually selecting a schedule "cell" by clicking, or {@link #config-triggerEvent any other pointer gesture}.
 *
 * This feature is **disabled** by default
 *
 * ```javascript
 * const scheduler = new Scheduler({
 *     features : {
 *         // Configure as a truthy value to enable the feature
 *         scheduleContext : {
 *             triggerEvent : 'hover',
 *             renderer     : (context, element) => {
 *                 element.innerText = '😎';
 *             }
 *         }
 *     }
 * });
 * ```
 *
 * The contextual details are available in the {@link #property-context} property.
 * 
 * **Note that the context is cleared upon change of {@link Scheduler.view.Scheduler#property-viewPreset}
 * such as when zooming in or out.**
 *
 * @extends Core/mixin/InstancePlugin
 * @inlineexample Scheduler/feature/ScheduleContext.js
 * @classtype scheduleContext
 * @feature
 */
export default class ScheduleContext extends InstancePlugin.mixin(Delayable) {
    static get $name() {
        return 'ScheduleContext';
    }

    static delayable = {
        syncContextElement : 'raf'
    }

    static configurable = {
        /**
         * The pointer event type to use to update the context. May be `'hover'` to highlight the
         * tick context when moving the mouse across the timeline.
         * @config {'click'|'hover'|'contextmenu'|'mousedown'}
         * @default
         */
        triggerEvent : 'click',

        /**
         * A function (or the name of a function) which may mutate the contents of the context overlay
         * element which tracks the active resource/tick context.
         * @config {String|Function}
         * @param {TimelineContext} context The context being highlighted.
         * @param {HTMLElement} element The context highlight element. This will be empty each time.
         */
        renderer : null,

        /**
         * The active context.
         * @member {TimelineContext} timelineContext
         * @readonly
         */
        context : {
            $config : {
                // Reject non-changes so that when using mousemove, we only update the context
                // when it changes.
                equal(c1, c2) {
                    return c1?.index === c2?.index &&
                        c1?.tickParentIndex === c2?.tickParentIndex &&
                        !((c1?.tickStartDate || 0) - (c2?.tickStartDate || 0));
                }
            }
        }
    }

    /**
     * The contextual information about which cell was clicked on and highlighted.
     *
     * When the {@link Scheduler.view.Scheduler#property-viewPreset} is changed (such as when zooming)
     * the context is cleared and the highlight is removed.
     *
     * @member {Object} context
     * @property {Scheduler.view.TimelineBase} context.source The owning Scheduler
     * @property {Date} context.date Date at mouse position
     * @property {Scheduler.model.TimeSpan} context.tick A record which encapsulates the time axis tick clicked on.
     * @property {Number} context.tickIndex The index of the time axis tick clicked on.
     * @property {Date} context.tickStartDate The start date of the current time axis tick
     * @property {Date} context.tickEndDate The end date of the current time axis tick
     * @property {Grid.row.Row} context.row Clicked row (in horizontal mode only)
     * @property {Number} context.index Index of clicked resource
     * @property {Scheduler.model.ResourceModel} context.resourceRecord Resource record
     * @property {MouseEvent} context.event Browser event
     */

    construct(client, config) {
        super.construct(client, config);

        const
            { triggerEvent } = this,
            listeners        = {
                datachange              : 'syncContextElement',
                timeaxisviewmodelupdate : 'onTimeAxisViewModelUpdate',
                presetchange            : 'clearContext',
                thisObj                 : this
            };

        // If mousemove is our trigger, we cab use the client's timelineContextChange event
        if (triggerEvent === 'mouseover') {
            listeners.timelineContextChange = 'onTimelineContextChange';
        }
        // Otherwise, we have to listen for the required events on Schedule and events
        else {
            // Context menu will be expected to update the context if click or mousedown
            // is the triggerEvent. Context menu is a mousedown gesture.
            if (triggerEvent === 'click' || triggerEvent === 'mousedown') {
                listeners.schedulecontextmenu = 'onScheduleContextGesture';
            }
            
            Object.assign(listeners, {
                [`schedule${triggerEvent}`] : 'onScheduleContextGesture',
                [`event${triggerEvent}`]    : 'onScheduleContextGesture',
                ...listeners
            });
        }

        // required to work
        client.useBackgroundCanvas = true;

        client.on(listeners);
        client.rowManager.on({
            rowheight : 'syncContextElement',
            thisObj   : this
        });
    }

    changeTriggerEvent(triggerEvent) {
        // Both these things should route through to using the client's timelineContextChange event
        if (triggerEvent === 'hover' || triggerEvent === 'mousemove') {
            triggerEvent = 'mouseover';
        }
        return triggerEvent;
    }

    get element() {
        return this._element || (this._element = DomHelper.createElement({
            parent    : this.client.backgroundCanvas,
            className : 'b-schedule-selected-tick'
        }));
    }

    // Handle the Client's own timelineContextChange event which it maintains on mousemove
    onTimelineContextChange({ context }) {
        this.context = context;
    }

    // Handle the scheduleclick or eventclick Scheduler events if we re not using mouseover
    onScheduleContextGesture(context) {
        this.context = context;
    }

    onTimeAxisViewModelUpdate({ source : timeAxisViewModel }) {
        // Just a mutation of existing tick details, sync the element
        if (timeAxisViewModel.timeAxis.includes(this.context?.tick)) {
            this.syncContextElement();
        }
        // The tick has gone, we have moved to a new ViewPreset, so clear the context.
        else {
            this.clearContext();
        }
    }

    clearContext() {
        this.context = null;
    }

    updateContext(context, oldContext) {
        this.syncContextElement();
    }

    syncContextElement() {
        if (this.context) {
            const
                me  = this,
                {
                    client,
                    element,
                    context,
                    renderer
                }   = me,
                {
                    isVertical
                }   = client,
                {
                    style
                }   = element,
                row = isVertical ? client.rowManager.rows[0] : client.getRowFor(context.resourceRecord);

            if (row) {
                const
                    {
                        tickStartDate,
                        tickEndDate,
                        resourceRecord
                    } = context,
                    // get the position clicked based on dates
                    renderData = client.currentOrientation.getTimeSpanRenderData({
                        startDate   : tickStartDate,
                        endDate     : tickEndDate,
                        startDateMS : tickStartDate.getTime(),
                        endDateMS   : tickEndDate.getTime()
                    }, resourceRecord);

                let top, width, height;

                if (isVertical) {
                    top = renderData.top;
                    width = renderData.resourceWidth;
                    height = renderData.height;
                }
                else {
                    top = row.top;
                    width = renderData.width;
                    height = row.height;
                }

                // Move to current cell
                style.display = '';
                style.width = `${width}px`;
                style.height = `${height}px`;
                DomHelper.setTranslateXY(element, renderData.left, top);

                // In case we updated on a datachange action : 'remove' or 'add' event.
                context.index = row.index;

                // Undo any contents added by the renderer last time round.
                element.innerHTML = '';

                // Show the context and the element to the renderer
                renderer && me.callback(renderer, me, [context, element]);
            }
            // No row for resource might mean it's scrolled out of view or filtered out
            // so just hide so that the next valid sync can restore it to visibility
            else {
                style.display = 'none';
            }
        }
        else {
            this.element.style.display = 'none';
        }
    }
}

ScheduleContext.featureClass = 'b-scheduler-context';

GridFeatureManager.registerFeature(ScheduleContext, false, ['Scheduler']);
