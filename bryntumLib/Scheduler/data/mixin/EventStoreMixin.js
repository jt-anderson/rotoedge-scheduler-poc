import Base from '../../../Core/Base.js';
import Model from '../../../Core/data/Model.js';
import DateHelper from '../../../Core/helper/DateHelper.js';
import FunctionHelper from '../../../Core/helper/FunctionHelper.js';

/**
 * @module Scheduler/data/mixin/EventStoreMixin
 */

/**
 * This is a mixin, containing functionality related to managing events.
 *
 * It is consumed by the regular {@link Scheduler.data.EventStore} class and the Scheduler Pro's `EventStore` class.
 *
 * @mixin
 */
export default Target => class EventStoreMixin extends (Target || Base) {
    static get $name() {
        return 'EventStoreMixin';
    }

    //region Init & destroy

    construct(config) {
        super.construct(config);

        this.autoTree = true;
    }

    //endregion

    //region Events records, iteration etc.

    set filtersFunction(filtersFunction) {
        super.filtersFunction = filtersFunction;
    }

    get filtersFunction() {
        // Generate the real filterFn.
        const result = super.filtersFunction;

        // We always filter *in* records which are being created by the UI.
        if (result && result !== FunctionHelper.returnTrue) {
            return r => r.isCreating || result(r);
        }
        return result;
    }

    /**
     * Returns a `Map`, keyed by `YYYY-MM-DD` date keys containing event counts for all the days
     * between the passed `startDate` and `endDate`. Occurrences of recurring events are included.
     *
     * Example:
     *
     * ```javascript
     *  eventCounts = eventStore.getEventCounts({
     *      startDate : scheduler.timeAxis.startDate,
     *      endDate   : scheduler.timeAxis.endDate
     *  });
     * ```
     *
     * @param {Object} options An options object determining which events to return
     * @param {Date} options.startDate The start date for the range of events to include.
     * @param {Date} [options.endDate] The end date for the range of events to include.
     * @category Events
     */
    getEventCounts(options) {
        const
            me     = this,
            {
                filtersFunction,
                added
            }      = me,
            // Must use getEvents so that the loadDateRange event is triggered.
            result = me.getEvents({
                ...options,
                storeFilterFn : me.isFiltered ? (me.reapplyFilterOnAdd ? filtersFunction : eventRecord => added.includes(eventRecord) ? me.indexOf(eventRecord) > -1 : filtersFunction(eventRecord)) : null,
                dateMap       : options.dateMap || true
            });

        result.forEach((value, key) => result.set(key, value.length));
        return result;
    }

    /**
     * Calls the supplied iterator function once for every scheduled event, providing these arguments
     * - event : the event record
     * - startDate : the event start date
     * - endDate : the event end date
     *
     * Returning false cancels the iteration.
     *
     * @param {Function} fn iterator function
     * @param {Object} [thisObj] `this` reference for the function
     * @category Events
     */
    forEachScheduledEvent(fn, thisObj = this) {
        this.forEach(event => {
            const { startDate, endDate } = event;

            if (startDate && endDate) {
                return fn.call(thisObj, event, startDate, endDate);
            }
        });
    }

    /**
     * Returns an object defining the earliest start date and the latest end date of all the events in the store.
     *
     * @returns {Object} An object with 'start' and 'end' Date properties (or null values if data is missing).
     * @category Events
     */
    getTotalTimeSpan() {
        let earliest = new Date(9999, 0, 1),
            latest   = new Date(0);

        this.forEach(event => {
            if (event.startDate) {
                earliest = DateHelper.min(event.startDate, earliest);
            }
            if (event.endDate) {
                latest = DateHelper.max(event.endDate, latest);
            }
        });

        // TODO: this will fail in programs designed to work with events in the past (after Jan 1, 1970)
        earliest = earliest < new Date(9999, 0, 1) ? earliest : null;
        latest   = latest > new Date(0) ? latest : null;

        // keep last calculated value to be able to track total timespan changes
        return (this.lastTotalTimeSpan = {
            startDate : earliest || null,
            endDate   : latest || earliest || null
        });
    }

    /**
     * Checks if given event record is persistable. By default it always is, override EventModels `isPersistable` if you
     * need custom logic.
     *
     * @param {Scheduler.model.EventModel} event
     * @returns {Boolean}
     * @category Events
     */
    isEventPersistable(event) {
        return event.isPersistable;
    }

    //endregion

    //region Resource

    /**
     * Checks if a date range is allocated or not for a given resource.
     * @param {Date} start The start date
     * @param {Date} end The end date
     * @param {Scheduler.model.EventModel|null} excludeEvent An event to exclude from the check (or null)
     * @param {Scheduler.model.ResourceModel} resource The resource
     * @returns {Boolean} True if the timespan is available for the resource
     * @category Resource
     */
    isDateRangeAvailable(start, end, excludeEvent, resource) {
        // NOTE: Also exists in TaskStore.js

        // This should be a collection of unique event records
        const allEvents = new Set(this.getEventsForResource(resource));

        // In private mode we can pass an AssignmentModel. In this case, we assume that multi-assignment is used.
        // So we need to make sure that other resources are available for this time too.
        // No matter if the event retrieved from the assignment belongs to the target resource or not.
        // We gather all events from from the resources the event is assigned to except of the one from the assignment record.
        // Note, events from the target resource are added above.
        if (excludeEvent?.isAssignment) {
            const
                currentEvent = excludeEvent.event,
                resources    = currentEvent.resources;

            resources.forEach(resource => {
                // Ignore events for the resource which is passed as an AssignmentModel to excludeEvent
                if (resource.id !== excludeEvent.resourceId) {
                    this.getEventsForResource(resource).forEach(event => allEvents.add(event));
                }
            });
        }

        if (excludeEvent) {
            const eventToRemove = excludeEvent.isAssignment ? excludeEvent.event : excludeEvent;
            allEvents.delete(eventToRemove);
        }

        return !Array.from(allEvents).some(event => event.isScheduled && DateHelper.intersectSpans(start, end, event.startDate, event.endDate));
    }

    /**
     * Filters the events associated with a resource, based on the function provided. An array will be returned for those
     * events where the passed function returns true.
     * @param {Scheduler.model.ResourceModel} resource
     * @param {Function} fn The function
     * @param {Object} [thisObj] `this` reference for the function
     * @returns {Scheduler.model.EventModel[]} the events in the time span
     * @private
     * @category Resource
     */
    filterEventsForResource(resource, fn, thisObj = this) {
        return resource.getEvents(this).filter(fn.bind(thisObj));
    }

    /**
     * Returns all resources assigned to an event.
     *
     * @param {Scheduler.model.EventModel|String|Number} event
     * @returns {Scheduler.model.ResourceModel[]}
     * @category Resource
     */
    getResourcesForEvent(event) {
        // If we are sent an occurrence, use its parent
        if (event.isOccurrence) {
            event = event.recurringTimeSpan;
        }

        return this.assignmentStore.getResourcesForEvent(event);
    }

    /**
     * Returns all events assigned to a resource.
     * *NOTE:* this does not include occurrences of recurring events. Use the
     * {@link Scheduler/data/mixin/GetEventsMixin#function-getEvents} API to include occurrences of recurring events.
     * @param {Scheduler.model.ResourceModel|String|Number} resource Resource or resource id.
     * @returns {Scheduler.model.EventModel[]}
     * @category Resource
     */
    getEventsForResource(resource) {
        return this.assignmentStore.getEventsForResource(resource);
    }

    //endregion

    //region Assignment

    /**
     * Returns all assignments for a given event.
     *
     * @param {Scheduler.model.EventModel|String|Number} event
     * @returns {Scheduler.model.AssignmentModel[]}
     * @category Assignment
     */
    getAssignmentsForEvent(event) {
        return this.assignmentStore.getAssignmentsForEvent(event) || [];
    }

    /**
     * Returns all assignments for a given resource.
     *
     * @param {Scheduler.model.ResourceModel|String|Number} resource
     * @returns {Scheduler.model.AssignmentModel[]}
     * @category Assignment
     */
    getAssignmentsForResource(resource) {
        return this.assignmentStore.getAssignmentsForResource(resource) || [];
    }

    /**
     * Creates and adds assignment record for a given event and a resource.
     *
     * @param {Scheduler.model.EventModel|String|Number} event
     * @param {Scheduler.model.ResourceModel|String|Number|Scheduler.model.ResourceModel[]|String[]|Number[]} resource The resource(s) to assign to the event
     * @param {Boolean} [removeExistingAssignments] `true` to first remove existing assignments
     * @returns {Scheduler.model.AssignmentModel[]} An array with the created assignment(s)
     * @category Assignment
     */
    assignEventToResource(event, resource, removeExistingAssignments = false) {
        return this.assignmentStore.assignEventToResource(event, resource, undefined, removeExistingAssignments);
    }

    /**
     * Removes assignment record for a given event and a resource.
     *
     * @param {Scheduler.model.EventModel|String|Number} event
     * @param {Scheduler.model.ResourceModel|String|Number} resource
     * @category Assignment
     */
    unassignEventFromResource(event, resource) {
        this.assignmentStore.unassignEventFromResource(event, resource);
    }

    /**
     * Reassigns an event from an old resource to a new resource
     *
     * @param {Scheduler.model.EventModel}    event    An event or id of the event to reassign
     * @param {Scheduler.model.ResourceModel|Scheduler.model.ResourceModel[]} oldResource A resource or id to unassign from
     * @param {Scheduler.model.ResourceModel|Scheduler.model.ResourceModel[]} newResource A resource or id to assign to
     * @category Assignment
     */
    reassignEventFromResourceToResource(event, oldResource, newResource) {
        const
            me            = this,
            newResourceId = Model.asId(newResource),
            assignment    = me.assignmentStore.getAssignmentForEventAndResource(event, oldResource);

        if (assignment) {
            assignment.resourceId = newResourceId;
        }
        else {
            me.assignmentStore.assignEventToResource(event, newResource);
        }

    }

    /**
     * Checks whether an event is assigned to a resource.
     *
     * @param {Scheduler.model.EventModel|String|Number} event
     * @param {Scheduler.model.ResourceModel|String|Number} resource
     * @returns {Boolean}
     * @category Assignment
     */
    isEventAssignedToResource(event, resource) {
        return this.assignmentStore.isEventAssignedToResource(event, resource);
    }

    /**
     * Removes all assignments for given event
     *
     * @param {Scheduler.model.EventModel|String|Number} event
     * @category Assignment
     */
    removeAssignmentsForEvent(event) {
        this.assignmentStore.removeAssignmentsForEvent(event);
    }

    /**
     * Removes all assignments for given resource
     *
     * @param {Scheduler.model.ResourceModel|String|Number} resource
     * @category Assignment
     */
    removeAssignmentsForResource(resource) {
        this.assignmentStore.removeAssignmentsForResource(resource);
    }

    //endregion
};
