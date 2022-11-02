import { DateHelper, EventStore } from "@bryntum/scheduler";
import Order from "./Order.js";
import { getEventAdjustedDuration, cleanupResources } from "./Util";

export default class OrderStore extends EventStore {
  static get defaultConfig() {
    return {
      modelClass: Order,
    };
  }

  // We set a static date here so that we can reference it as our current date. If the page was left open for 15 min,
  // we can't use new Date() inline because it wont align with the data model.
  currentDate = new Date();

  // Override add to reschedule any overlapping events caused by the add
  add(records, silent = false) {
    const me = this;

    // Flag to avoid rescheduling during in-progress rescheduling
    me.isRescheduling = true;
    me.beginBatch();

    if (!Array.isArray(records)) {
      records = [records];
    }

    super.add(records, silent);

    me.endBatch();
    me.isRescheduling = false;
  }

  // Auto called when triggering the update event.
  // Reschedule if the update caused the event to overlap any others.
  onUpdate({ record, changes }) {
    // Only update if we aren't currently rescheduling and if we have vlaid data
    if (!this.isRescheduling && record && record.resource !== undefined) {
      this.beginBatch();
      // If we find that an event has changed resources, we want to add a flag so that the rescheduling
      // process will reschedule both resources (to eliminate empty spaces in each row)
      const resMods = changes.resourceId;
      if (resMods && resMods.oldValue !== resMods.value) {
        record.previousResource = resMods.oldValue;
      } else {
        record.previousResource = null;
      }
      this.rescheduleOverlappingTasks(record);
      this.endBatch();
    }
  }

  onRemove(obj) {
    const resourceIds = obj.records.reduce((accum, removedEvent) => {
      if (!accum.includes(removedEvent.resourceId)) {
        accum.push(removedEvent.resourceId);
      }
      return accum;
    }, []);
    resourceIds.forEach((resId) => {
      const resourceRec = this.resourceStore.idMap[resId];
      if (resourceRec) {
        this.shiftEventsLeft(resourceRec.record.events);
      }
    });
  }

  rescheduleOverlappingTasks(eventRecord) {
    if (eventRecord.resource) {
      const me = this;

      // ---------------------- ADDING NEW RESOURCE ON DROP ----------------------
      const targtedResourceId = eventRecord.resource.id;
      const resourceIdMap = eventRecord.resourceStore.idMap;
      const resourcesCount = Object.keys(resourceIdMap).length;

      // To-Do: We should combine both of these processes so there's no 'flicker' when you
      // add and remove orders. However, we have to be careful to still handle multi-order selection.
      // This approach handles multi-select but it's kind of brute force. I think we could add
      // a condition in the if statement to check how many rows are empty and prevent the addition
      // of a new resource.

      // We're adding the first element to a resource so we want to expand the bottom line
      // to make room for more resources to be added.
      if (
        eventRecord.resource.events.length > 0 && // Theres one or more events in this resource
        resourceIdMap[targtedResourceId].index === resourcesCount - 1 // We're on the last row
      ) {
        const parsedResourceId = targtedResourceId.split("r");
        me.resourceStore.add({
          id: `${parsedResourceId[0]}r${+parsedResourceId[1] + 1}`,
        });
      }

      // Clean up resources and events in them if they're empty
      cleanupResources(me.resourceStore);

      // -------------------- AUTO SCHEDULE OVERLAPPING ORDERS -------------------
      let futureEvents = [],
        earlierEvents = [];

      // If we should also clean up the previous resource that this order moved from (move all of the orders left)
      if (
        eventRecord.previousResource &&
        me.resourceStore.idMap[eventRecord.previousResource]
      ) {
        const { record: previousResourceRow } =
          me.resourceStore.idMap[eventRecord.previousResource];

        this.shiftEventsLeft(previousResourceRow.events);
      }

      // Split events into future and earlier events
      eventRecord.resource.events.forEach((event) => {
        if (event.data.id !== eventRecord.data.id) {
          if (event.startDate >= eventRecord.startDate) {
            futureEvents.push(event);
          } else {
            earlierEvents.push(event);
          }
        }
      });

      // To-Do: If this event was dropped before the current date marker, we need to shift items right
      if (eventRecord.startDate < this.currentDate) {
        // const rootElement = futureEvents.find(
        //   (ev) => ev.startDate < this.currentDate
        // );
        // if (rootElement) {
        //   // eventRecord.startDate = this.currentDate;
        //   const newEndDate = DateHelper.add(
        //     rootElement.endDate,
        //     eventRecord.duration,
        //     "ms"
        //   );
        //   // Second param means that the event keeps it's duration
        //   eventRecord.setEndDate(newEndDate, true);
        //   // futureEvents = futureEvents.filter((ev) => ev.id !== rootElement.id);
        //   // earlierEvents.push(rootElement);
        // }
      }

      // Get all orders into one array and shift them left.
      const allEvents = [...earlierEvents, eventRecord, ...futureEvents];

      this.shiftEventsLeft(allEvents);

      this.isRescheduling = false;
    }
  }

  revertChanges() {
    const resourceIdMap = this.resourceStore.idMap;
    Object.keys(resourceIdMap).forEach((resourceId) => {
      const resourceDetail = resourceIdMap[resourceId];
      const resourceEvents = resourceDetail.record.events;

      // To-Do: There is a bug where multiple items are unassigned and when changes are reverted, strange behavior occurs.
      // The order (like item 2 removed, then item 3 removed) of how items are removed is important. We might have to manually
      // handle the revert changes process by using the modified items to reconstruct the priority queue and reinsert.
      this.shiftEventsLeft(resourceEvents);
    });
    super.revertChanges();
  }

  // Helper function that shifts items to the left.
  shiftEventsLeft = (events) => {
    if (events.length) {
      events.sort((a, b) => (a.startDate > b.startDate ? 1 : -1));

      events.forEach((ev, i, all) => {
        const prev = all[i - 1];
        // if this is the first element and the startDate is before the current date.
        if (!prev && ev.startDate > this.currentDate) {
          const newEndDate = DateHelper.add(
            this.currentDate,
            ev.duration,
            "ms"
          );
          ev.setEndDate(newEndDate, true);
        } else {
          // Normal shift
          this.shiftEvents(prev, ev);
        }
      });
    }
  };

  shiftEvents(event1, event2) {
    if (event1) {
      const newStartDate = event1.endDate;
      const newEndDate = DateHelper.add(newStartDate, event2.duration, "ms");
      // Second param means that the event keeps it's duration
      event2.setEndDate(newEndDate, true);
    }
  }

  adjustTaskDuration(events) {
    events.forEach((event) => {
      const totalDaysFilledInMs = getEventAdjustedDuration(event);
      event.duration += totalDaysFilledInMs;
    });
  }
}
