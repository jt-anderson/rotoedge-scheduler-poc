/**
 * Custom Task store
 *
 * Taken from the original dragfromgrid example
 */
import { DateHelper, EventStore } from "@bryntum/scheduler";
import Order from "./Order.js";
import { getEventAdjustedDuration, cleanupResources } from "./Util";
import { ONLY_WORKING_HOURS } from "./SchedulerConfig";

export default class OrderStore extends EventStore {
  static get defaultConfig() {
    return {
      modelClass: Order,
    };
  }

  // Override add to reschedule any overlapping events caused by the add
  add(records, silent = false) {
    const me = this;

    // Flag to avoid rescheduling during rescheduling
    me.isRescheduling = true;
    me.beginBatch();

    if (!Array.isArray(records)) {
      records = [records];
    }

    // If we only allow working hours, adjust the task duration
    // if (ONLY_WORKING_HOURS) {
    //   this.adjustTaskDuration(records);
    // }

    super.add(records, silent);

    // if (me.autoRescheduleTasks) {
    me.endBatch();
    me.isRescheduling = false;
    // }
  }

  // Auto called when triggering the update event.
  // Reschedule if the update caused the event to overlap any others.
  onUpdate({ record }) {
    if (!this.isRescheduling && record && record.resource !== undefined) {
      this.rescheduleOverlappingTasks(record);
    }
  }

  rescheduleOverlappingTasks(eventRecord) {
    if (eventRecord.resource) {
      const me = this;

      // ---------------------- ADDING NEW RESOURCE ON DROP ----------------------
      const targtedResourceId = eventRecord.resource.id;
      const resourceIdMap = eventRecord.resourceStore.idMap;
      const resourcesCount = Object.keys(resourceIdMap).length;

      // To-Do: We should combine both of these processes so there's no 'flicker' when you
      // add and remove orders. However, we have to be careful to handle multi-order selection.
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
      const futureEvents = [],
        earlierEvents = [];

      // Split events into future and earlier events
      eventRecord.resource.events.forEach((event) => {
        // if (event !== eventRecord) {
        if (event.data.id !== eventRecord.data.id) {
          if (event.startDate >= eventRecord.startDate) {
            futureEvents.push(event);
          } else {
            earlierEvents.push(event);
          }
        }
      });

      const allEvents = [...earlierEvents, eventRecord, ...futureEvents];
      if (allEvents.length) {
        allEvents.sort((a, b) => (a.startDate > b.startDate ? 1 : -1));

        allEvents.forEach((ev, i, all) => {
          const prev = all[i - 1];
          // Normal shift
          this.shiftEvents(prev, ev);
        });
      }

      this.isRescheduling = false;
    }
  }

  doEventsOverlap(event1, event2) {
    if (!event1 || !event2) {
      return false;
    }
    const e1start = event1.startDate;
    const e1end = event1.endDate;
    const e2start = event2.startDate;
    const e2end = event2.endDate;
    return (
      (e1start >= e2start && e1start < e2end) ||
      (e2start >= e1start && e2start < e1end)
    );
  }

  areDatesTheSame(date1, date2) {
    const date1InMs = Date.parse(date1);
    const date2InMs = Date.parse(date2);
    return date1InMs === date2InMs;
  }

  shiftEvents(event1, event2) {
    if (event1 && this.doEventsOverlap(event1, event2)) {
      const newStartDate = event1.endDate;
      const newEndDateMs = event2.duration + Date.parse(newStartDate);
      const newEndDate = new Date(newEndDateMs);
      event2.startDate = newStartDate;
      // event2.setEndDate(newEndDate, true);

      //   ev.endDate = newEndDate;
    }
  }

  // rescheduleOverlappingTasks(eventRecord) {
  //   if (eventRecord.resource) {
  //     const futureEvents = [],
  //       earlierEvents = [];

  //     // Split tasks into future and earlier tasks
  //     eventRecord.resource.events.forEach((event) => {
  //       // if (event !== eventRecord) {
  //       if (event.data.id !== eventRecord.data.id) {
  //         if (event.startDate >= eventRecord.startDate) {
  //           futureEvents.push(event);
  //         } else {
  //           earlierEvents.push(event);
  //         }
  //       }
  //     });

  //     if (futureEvents.length || earlierEvents.length) {
  //       futureEvents.sort((a, b) => (a.startDate > b.startDate ? 1 : -1));
  //       earlierEvents.sort((a, b) => (a.startDate > b.startDate ? -1 : 1));

  //       futureEvents.forEach((ev, i) => {
  //         const prev = futureEvents[i - 1] || eventRecord;

  //         ev.startDate = DateHelper.max(prev.endDate, ev.startDate);
  //       });

  //       // Walk backwards and remove any overlap
  //       [eventRecord, ...earlierEvents].forEach((ev, i, all) => {
  //         const prev = all[i - 1];
  //         //   const tempNowDate = new Date(2022, 2, 20, 8);
  //         // && ev.endDate > tempNowDate
  //         // ev.endDate > Date.now() &&
  //         if (ev !== eventRecord && prev) {
  //           ev.setEndDate(DateHelper.min(prev.startDate, ev.endDate), true);
  //         }
  //       });
  //       this.isRescheduling = false;
  //     }
  //   }
  // }

  adjustTaskDuration(events) {
    events.forEach((event) => {
      const startDate = event.startDate;
      // Get end date based off the events original duration (not adjusted)
      const endDateMs = event.scheduled_duration + Date.parse(startDate);
      const endDate = new Date(endDateMs);

      // const nonWorkingDaysDict = DateHelper.nonWorkingDays;
      // const nonWorkingDays = Object.keys(nonWorkingDaysDict).map((dow) => +dow);

      // const durationInHours = DateHelper.getDurationInUnit(
      //   startDate,
      //   endDate,
      //   "hour"
      // );

      const totalDaysFilledInMs = getEventAdjustedDuration(event);
      event.duration += totalDaysFilledInMs;

      // return {
      //   ...event,
      //   originalData: { ...event.originalData, color: "red" },
      // };

      // get the day of the week [0-6], 0 = Sunday, etc...
      // let iteratedDay = startDate;
      // while (!nonWorkingDays.includes(iteratedDay.getDay())) {
      //   nonWorkingDays.includes(iteratedDay.getDay());
      //   iteratedDay = DateHelper.getStartOfNextDay(iteratedDay);
      // }

      // // get hour of day
      // const hourOfDay = DateHelper.format(endDate, "HH.mm");
      // const hourOfDayToFloat = parseFloat(hourOfDay);
      // const test = false;
    });
  }
}
