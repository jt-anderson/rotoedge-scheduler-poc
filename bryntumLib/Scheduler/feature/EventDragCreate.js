import DragCreateBase from './base/DragCreateBase.js';
import GridFeatureManager from '../../Grid/feature/GridFeatureManager.js';
import DateHelper from '../../Core/helper/DateHelper.js';
import ObjectHelper from '../../Core/helper/ObjectHelper.js';

/**
 * @module Scheduler/feature/EventDragCreate
 */

/**
 * Feature that allows the user to create new events by dragging in empty parts of the scheduler rows.
 *
 * {@inlineexample Scheduler/feature/EventDragCreate.js}
 *
 * This feature is **enabled** by default.
 *
 * <div class="note">Incompatible with the {@link Scheduler.feature.EventDragSelect EventDragSelect} and
 * {@link Scheduler.feature.Pan Pan} features. If either of those features are enabled, this feature has no effect.
 * </div>
 *
 * ## Conditionally preventing drag creation
 *
 * To conditionally prevent drag creation for a certain resource or a certain timespan, you listen for the
 * {@link #event-beforeDragCreate} event, add your custom logic to it and return `false` to prevent the operation
 * from starting. For example to not allow drag creation on the topmost resource:
 *
 * ```javascript
 * const scheduler = new Scheduler({
 *     listeners : {
 *         beforeDragCreate({ resource }) {
 *             // Prevent drag creating on the topmost resource
 *             if (resource === scheduler.resourceStore.first) {
 *                 return false;
 *             }
 *         }
 *     }
 * });
 * ```
 *
 * @extends Scheduler/feature/base/DragCreateBase
 * @demo Scheduler/basic
 * @classtype eventDragCreate
 * @feature
 */
export default class EventDragCreate extends DragCreateBase {
    //region Config

    static get $name() {
        return 'EventDragCreate';
    }

    static get configurable() {
        return {
            /**
             * An empty function by default, but provided so that you can perform custom validation on the event being
             * created. Return `true` if the new event is valid, `false` to prevent an event being created.
             * @param {Object} context A drag create context
             * @param {Date} context.startDate Event start date
             * @param {Date} context.endDate Event end date
             * @param {Scheduler.model.EventModel} context.record Event record
             * @param {Scheduler.model.ResourceModel} context.resourceRecord Resource record
             * @param {Event} event The event object
             * @returns {Boolean} `true` if this validation passes
             * @config {function}
             */
            validatorFn : () => true,

            /**
             * Locks the layout during drag create, overriding the default behaviour that uses the same rendering
             * pathway for drag creation as for already existing events.
             *
             * This more closely resembles the behaviour of versions prior to 4.2.0.
             *
             * @config {Boolean}
             * @default
             */
            lockLayout : false
        };
    }

    //endregion

    //region Events

    /**
     * Fires on the owning Scheduler after the new event has been created.
     * @event dragCreateEnd
     * @on-owner
     * @param {Scheduler.view.Scheduler} source
     * @param {Scheduler.model.EventModel} eventRecord The new `EventModel` record.
     * @param {Scheduler.model.ResourceModel} resourceRecord The resource for the row in which the event is being
     * created.
     * @param {MouseEvent} event The ending mouseup event.
     * @param {HTMLElement} eventElement The DOM element representing the newly created event un the UI.
     */

    /**
     * Fires on the owning Scheduler at the beginning of the drag gesture. Returning `false` from a listener prevents
     * the drag create operation from starting.
     *
     * ```javascript
     * const scheduler = new Scheduler({
     *     listeners : {
     *         beforeDragCreate({ date }) {
     *             // Prevent drag creating on odd dates
     *             if (date.getDate() % 2 === 1) {
     *                 return false;
     *             }
     *         }
     *     }
     * });
     * ```
     *
     * @event beforeDragCreate
     * @on-owner
     * @preventable
     * @param {Scheduler.view.Scheduler} source
     * @param {Scheduler.model.ResourceModel} resourceRecord
     * @param {Date} date The datetime associated with the drag start point.
     */

    /**
     * Fires on the owning Scheduler after the drag start has created a proxy element.
     * @event dragCreateStart
     * @on-owner
     * @param {Scheduler.view.Scheduler} source
     * @param {Scheduler.model.EventModel} eventRecord The event record being created
     * @param {Scheduler.model.ResourceModel} resourceRecord The resource record
     * @param {HTMLElement} eventElement The element representing the new event.
     */

    /**
     * Fires on the owning Scheduler to allow implementer to prevent immediate finalization by setting
     * `data.context.async = true` in the listener, to show a confirmation popup etc
     * ```javascript
     *  scheduler.on('beforedragcreatefinalize', ({context}) => {
     *      context.async = true;
     *      setTimeout(() => {
     *          // async code don't forget to call finalize
     *          context.finalize();
     *      }, 1000);
     *  })
     * ```
     * @event beforeDragCreateFinalize
     * @on-owner
     * @param {Scheduler.view.Scheduler} source Scheduler instance
     * @param {Scheduler.model.EventModel} eventRecord The event record being created
     * @param {Scheduler.model.ResourceModel} resourceRecord The resource record
     * @param {HTMLElement} eventElement Proxy element, representing future event
     * @param {Object} context
     * @param {Boolean} context.async Set true to handle drag create asynchronously (e.g. to wait for user
     * confirmation)
     * @param {Function} context.finalize Call this method to finalize drag create. This method accepts one
     * argument: pass true to update records, or false, to ignore changes
     */

    /**
     * Fires on the owning Scheduler at the end of the drag create gesture whether or not
     * a new event was created by the gesture.
     * @event afterDragCreate
     * @on-owner
     * @param {Scheduler.view.Scheduler} source
     * @param {Scheduler.model.EventModel} eventRecord The event record being created
     * @param {Scheduler.model.ResourceModel} resourceRecord The resource record
     * @param {HTMLElement} eventElement The element representing the created event record
     */

    //endregion

    //region Init

    /* @private */
    construct(scheduler, config) {
        this.scheduler = scheduler;

        super.construct(scheduler, config);
    }

    get store() {
        return this.scheduler.eventStore;
    }

    updateLockLayout(lock) {
        this.dragActiveCls = 'b-dragcreating' + (lock ? ' b-dragcreate-lock' : '');
    }

    //endregion

    //region Scheduler specific implementation

    handleBeforeDragCreate(drag, eventRecord, event) {
        const
            { resourceRecord } = drag,
            { scheduler }      = this,
            // For resources with a calendar, ensure the date is inside a working time range
            isWorkingTime      = !scheduler.isSchedulerPro || resourceRecord.isWorkingTime(drag.mousedownDate),
            result             = isWorkingTime && scheduler.trigger('beforeDragCreate', {
                resourceRecord,
                date : drag.mousedownDate,
                event
            });

        // Save date constraints
        this.dateConstraints = scheduler.getDateConstraints?.(resourceRecord, eventRecord);

        return result;
    }

    dragStart(drag) {
        const
            me               = this,
            { client }       = me,
            {
                eventStore,
                assignmentStore,
                enableEventAnimations
            }                  = client,
            { resourceRecord } = drag,
            eventRecord        = me.createEventRecord(drag),
            resourceRecords    = [resourceRecord];

        eventRecord.set('duration', DateHelper.diff(eventRecord.startDate, eventRecord.endDate, eventRecord.durationUnit, true));

        // It's only a provisional event until gesture is completed (possibly longer if an editor dialog is shown after)
        eventRecord.isCreating = true;

        // Flag used by rendering to not draw a zero length event being drag created as a milestone
        eventRecord.meta.isDragCreating = true;

        // Date to flip around when changing direction
        drag.initialDate = eventRecord.get(this.draggingEnd ? 'startDate' : 'endDate');

        // This presents the event to be scheduled for validation at the proposed mouse/date point
        // If rejected, we cancel operation
        if (me.handleBeforeDragCreate(drag, eventRecord, drag.event) === false) {
            return false;
        }

        let assignmentRecords = [];

        if (resourceRecord) {
            assignmentRecords = assignmentStore.assignEventToResource(eventRecord, resourceRecord);
        }

        // Vetoable beforeEventAdd allows cancel of this operation
        if (client.trigger('beforeEventAdd', { eventRecord, resourceRecords, assignmentRecords }) === false) {
            assignmentStore.remove(assignmentRecords);
            return false;
        }

        // When configured to lock layout during drag create, set a flag that HorizontalRendering will pick up to
        // exclude the new event from the layout calculations. It will then be at the topmost position in the "cell"
        if (me.lockLayout) {
            eventRecord.meta.excludeFromLayout = true;
        }

        client.onEventCreated?.(eventRecord);

        client.enableEventAnimations = false;
        eventStore.addAsync(eventRecord).then(() => client.enableEventAnimations = enableEventAnimations);

        // Element must be created synchronously, not after the project's normalizing delays.
        // Overrides the check for isEngineReady in VerticalRendering so that the newly added record
        // will be rendered when we call refreshRows.
        client.isCreating = true;
        client.refreshRows();
        client.isCreating = false;

        // Set the element we are dragging
        drag.itemElement = drag.element = client.getElementFromEventRecord(eventRecord);

        return super.dragStart(drag);
    }

    checkValidity(context, event) {
        const
            me         = this,
            { client } = me;

        // Nicer for users of validatorFn
        context.resourceRecord = me.dragging.resourceRecord;
        return (
            client.allowOverlap ||
            client.isDateRangeAvailable(context.startDate, context.endDate, context.eventRecord, context.resourceRecord)
        ) && me.createValidatorFn.call(me.validatorFnThisObj || me, context, event);
    }

    // Determine if resource already has events or not
    isRowEmpty(resourceRecord) {
        const events = this.store.getEventsForResource(resourceRecord);
        return !events || !events.length;
    }

    //endregion

    triggerBeforeFinalize(event) {
        this.client.trigger(`beforeDragCreateFinalize`, event);
    }

    /**
     * Creates an event by the event object coordinates
     * @param {Object} drag The Bryntum event object
     * @private
     */
    createEventRecord(drag) {
        const
            me          = this,
            { client }  = me,
            dimension   = client.isHorizontal ? 'X' : 'Y',
            {
                timeAxis,
                eventStore,
                weekStartDay
            }           = client,
            {
                event,
                mousedownDate
            }           = drag,
            draggingEnd = me.draggingEnd = event[`page${dimension}`] > drag.startEvent[`page${dimension}`],
            eventConfig = {
                name      : eventStore.modelClass.fieldMap.name.defaultValue || me.L('L{Object.newEvent}'),
                startDate : draggingEnd ? DateHelper.floor(mousedownDate, timeAxis.resolution, null, weekStartDay) : mousedownDate,
                endDate   : draggingEnd ? mousedownDate : DateHelper.ceil(mousedownDate, timeAxis.resolution, null, weekStartDay)
            };

        // if project model has been imported from Gantt, we have to define constraint data directly to correct
        // auto-scheduling while dragCreate
        if (client.project.isGanttProjectMixin) {
            ObjectHelper.assign(eventConfig, {
                constraintDate : eventConfig.startDate,
                constraintType : 'startnoearlierthan'
            });
        }

        return eventStore.createRecord(eventConfig);
    }

    async finalizeDragCreate(context) {
        const
            { meta }        = context.eventRecord;

        // Remove the layout lock flag, event will jump into place as part of the finalization
        meta.excludeFromLayout = false;
        // Also allow new event to become a milestone now
        meta.isDragCreating    = false;

        if (!this.client.hasEventEditor) {
            context.eventRecord.isCreating = false;
        }
        return super.finalizeDragCreate(context);
    }

    getTipHtml(...args) {
        const
            html        = super.getTipHtml(...args),
            { element } = this.tip;

        element.classList.add('b-sch-dragcreate-tooltip');
        element.classList.toggle('b-too-narrow', this.dragging.context.tooNarrow);

        return html;
    }

    onAborted(context) {
        const { eventRecord, resourceRecord } = context;

        // The product this is being used in may not have resources.
        this.store.unassignEventFromResource?.(eventRecord, resourceRecord);
        this.store.remove(eventRecord);
    }
}

GridFeatureManager.registerFeature(EventDragCreate, true, 'Scheduler');
GridFeatureManager.registerFeature(EventDragCreate, false, 'ResourceHistogram');
