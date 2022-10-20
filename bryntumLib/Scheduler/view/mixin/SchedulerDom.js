import Base from '../../../Core/Base.js';
import DomHelper from '../../../Core/helper/DomHelper.js';

/**
 * @module Scheduler/view/mixin/SchedulerDom
 */

/**
 * Mixin with EventModel and ResourceModel <-> HTMLElement mapping functions
 *
 * @mixin
 */
export default Target => class SchedulerDom extends (Target || Base) {
    static get $name() {
        return 'SchedulerDom';
    }

    //region Get

    /**
     * Returns a single HTMLElement representing an event record assigned to a specific resource.
     * @param {Scheduler.model.AssignmentModel} assignmentRecord An assignment record
     * @returns {HTMLElement} The element representing the event record
     */
    getElementFromAssignmentRecord(assignmentRecord, returnWrapper = false) {
        if (this.isPainted && assignmentRecord) {
            const wrapper = this.foregroundCanvas.syncIdMap?.[assignmentRecord.id];

            // Wrapper wont have syncIdMap when saving dragcreated event from editor
            return returnWrapper ? wrapper : wrapper?.syncIdMap?.event;
        }

        return null;
    }

    /**
     * Returns a single HTMLElement representing an event record assigned to a specific resource.
     * @param {Scheduler.model.EventModel} eventRecord An event record
     * @param {Scheduler.model.ResourceModel} resourceRecord A resource record
     * @returns {HTMLElement} The element representing the event record
     */
    getElementFromEventRecord(eventRecord, resourceRecord = eventRecord.resources?.[0], returnWrapper = false) {
        if (eventRecord.isResourceTimeRange) {
            const wrapper = this.foregroundCanvas.syncIdMap?.[eventRecord.domId];

            return returnWrapper ? wrapper : wrapper?.syncIdMap.event;
        }

        const assignmentRecord = this.assignmentStore.getAssignmentForEventAndResource(eventRecord, resourceRecord);
        return this.getElementFromAssignmentRecord(assignmentRecord, returnWrapper);
    }

    /**
     * Returns all the HTMLElements representing an event record.
     *
     * @param {Scheduler.model.EventModel} eventRecord An event record
     * @param {Scheduler.model.ResourceModel} [resourceRecord] A resource record
     *
     * @returns {HTMLElement[]} The element(s) representing the event record
     */
    getElementsFromEventRecord(eventRecord, resourceRecord, returnWrapper = false) {
        // Single event instance, as array
        if (resourceRecord) {
            return [this.getElementFromEventRecord(eventRecord, resourceRecord, returnWrapper)];
        }
        // All instances
        else {
            return eventRecord.resources.reduce((result, resourceRecord) => {
                const el = this.getElementFromEventRecord(eventRecord, resourceRecord, returnWrapper);

                el && result.push(el);

                return result;
            }, []);
        }
    }

    //endregion

    //region Resolve

    /**
     * Resolves the resource based on a dom element or event. In vertical mode, if resolving from an element higher up in
     * the hierarchy than event elements, then it is required to supply an coordinates since resources are virtual
     * columns.
     * @param {HTMLElement|Event} elementOrEvent The HTML element or DOM event to resolve a resource from
     * @param {Number[]} [xy] X and Y coordinates, required in some cases in vertical mode, disregarded in horizontal
     * @returns {Scheduler.model.ResourceModel} The resource corresponding to the element, or null if not found.
     */
    resolveResourceRecord(elementOrEvent, xy) {
        return this.currentOrientation.resolveRowRecord(elementOrEvent, xy);
    }

    /**
     * Product agnostic method which yields the {@link Scheduler.model.ResourceModel} record which underpins the row which
     * encapsulates the passed element. The element can be a grid cell, or an event element, and the result
     * will be a {@link Scheduler.model.ResourceModel}
     * @param {HTMLElement|Event} elementOrEvent The HTML element or DOM event to resolve a record from
     * @returns {Scheduler.model.ResourceModel} The resource corresponding to the element, or null if not found.
     */
    resolveRowRecord(elementOrEvent) {
        return this.resolveResourceRecord(elementOrEvent);
    }

    /**
     * Returns the event record for a DOM element
     * @param {HTMLElement|Event} elementOrEvent The DOM node to lookup
     * @returns {Scheduler.model.EventModel} The event record
     */
    resolveEventRecord(elementOrEvent) {
        if (elementOrEvent instanceof Event) {
            elementOrEvent = elementOrEvent.target;
        }

        const element = DomHelper.up(elementOrEvent, this.eventSelector);

        if (element) {
            if (element.dataset.eventId) {
                return this.eventStore.getById(element.dataset.eventId);
            }

            if (element.dataset.assignmentId) {
                return this.assignmentStore.getById(element.dataset.assignmentId).event;
            }
        }

        return null;
    }

    // Used by shared features to resolve an event or task
    resolveTimeSpanRecord(element) {
        return this.resolveEventRecord(element);
    }

    /**
     * Returns an assignment record for a DOM element
     * @param {HTMLElement} element The DOM node to lookup
     * @returns {Scheduler.model.AssignmentModel} The assignment record
     */
    resolveAssignmentRecord(element) {
        const
            eventElement     = DomHelper.up(element, this.eventSelector),
            assignmentRecord = eventElement && this.assignmentStore.getById(eventElement.dataset.assignmentId),
            eventRecord      = eventElement && this.eventStore.getById(eventElement.dataset.eventId);

        // When resolving a recurring event, we might be resolving an occurrence
        return this.assignmentStore.getOccurrence(assignmentRecord, eventRecord);
    }

    //endregion

    // Decide if a record is inside a collapsed tree node, or inside a collapsed group (using grouping feature)
    isRowVisible(resourceRecord) {
        // records in collapsed groups/branches etc are removed from processedRecords
        return this.store.indexOf(resourceRecord) >= 0;
    }

    // This does not need a className on Widgets.
    // Each *Class* which doesn't need 'b-' + constructor.name.toLowerCase() automatically adding
    // to the Widget it's mixed in to should implement thus.
    get widgetClass() {}
};
