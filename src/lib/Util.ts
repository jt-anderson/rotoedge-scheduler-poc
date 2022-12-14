import { DateHelper } from "@bryntum/scheduler";
import { start } from "repl";
import {
  // ONLY_WORKING_HOURS,
  // WORKING_START_DAY,
  // WORKING_END_DAY,
  // START_DATE,
  WORKING_START_HOUR,
  WORKING_END_HOUR,
} from "./SchedulerConfig";

// The orders that are CURRENTLY MOLDING have a different structure returned than the
// the enhanced-loadqueue
const normalizeOrder = (order: any) => ({
  ...order,
  item_takt: order.takt,
  work_order_number: order.order,
});

// Helper function that adds the Scheduler's required fields to the order object. We want
// to avoid storing as much unecessary data as possible.
const mapToOrderModel = (orders: any) => {
  return orders.map((order: any) => ({
    ...order,
    duration: DateHelper.asMilliseconds(
      order.balance * order.item_takt,
      "minute"
    ),
    resourceId: order.scheduled_resource_id,
    name: `WO: ${order.work_order_number} (${order.balance} Parts) `,
    draggable: order.item_currently_molding ? false : true,
    previousLoadOrder: order.load_after ? order.load_after.split(";")[0] : null,
    resizable: false,
    cls: `scheduler-bar ${
      order.item_currently_molding ? "scheduler-bar-currently-molding" : ""
    }`,
  }));
};

// Helper function the maps counter_weights to the model needed by the scheduler
const mapToCounterWeightModel = (counterWeight: any) => {
  return {
    ...counterWeight,
    duration: DateHelper.asMilliseconds(
      counterWeight.duration,
      counterWeight.duration_unit
    ),
    resourceId: counterWeight.scheduled_resource_id,
    name: "Counter Weight",
    previousLoadOrder: counterWeight.load_after
      ? counterWeight.load_after.split(";")[0]
      : null,
    draggable: true,
    resizable: true,
    type: "counter_weight",
    cls: "scheduler-bar scheduler-bar-counter-weight",
  };
};

// Helper function to map a hardbreak to the model needed by the scheduler
const mapToHardBreakModel = (hardBreak: any) => {
  return {
    ...hardBreak,
    startDate: hardBreak.start,
    name: "Hard Break",
    cls: "hard-break-scheduler",
  };
};

// Helper function that will return a flat array of orders with their start dates. We use the
// priority queue to sync orders to start when their parent order ends
const getOrdersWithStartDates = (allOrders: any) => {
  /**
   * @Description Get all orders into a temp dictionary based off their respective resource groups.
   * @Key ResourceGroupId
   * @Value Order[]
   */
  const ordersByResourceGroups = allOrders.reduce(
    (resourceDict: any, order: any, index: number) => {
      if (!resourceDict[order.scheduled_resource_id]) {
        resourceDict[order.scheduled_resource_id] = [];
      }
      resourceDict[order.scheduled_resource_id].push(order);
      return resourceDict;
    },
    {}
  );

  // Our return array
  const tempOrdersArr: any[] = [];

  // Iterate over each respective resource group
  Object.keys(ordersByResourceGroups).forEach((key: string) => {
    const resourceArray = ordersByResourceGroups[key];

    // Sort each array of orders by their parentIds
    const sortedArray = resourceArray.reduce(
      (accumulator: any, currentValue: any) => {
        let item = accumulator.find(
          (x: any) => x.work_order_number === currentValue.previousLoadOrder
        );
        let index = accumulator.indexOf(item);
        index = index !== -1 ? index + 1 : accumulator.length;
        accumulator.splice(index, 0, currentValue);
        return accumulator;
      },
      []
    );

    // Sanity check:
    const allItemsWithNullLoadAfter = sortedArray.filter(
      (item: any) => item.previousLoadOrder === null
    );
    if (allItemsWithNullLoadAfter.length > 1) {
      // There are multiple items with load-after = null. We still plot these items on the scheduler but they will overlap.
      console.error(
        `Util.ts - There are multiple items in row: ${key} that have a null load_after property. Each row should only have one item with load_after = null`
      );
    } else if (allItemsWithNullLoadAfter.length === 0) {
      // There are no elements that can act as the root. This case is bad because it won't plot the items on the scheduler.
      console.error(
        `Util.ts - In row: ${key}, there are items in the list but none of them have property load_after = null. Each row should have one item with load_after = null`
      );
    }

    // Apply start dates. If the order is the root item, set it's start to the current date
    sortedArray.forEach((sortedOrder: any, i: number) => {
      // if (i === 0) {
      if (sortedOrder.previousLoadOrder === null) {
        // If the element doesn't have an item to load after, we assume it's the root element
        tempOrdersArr.push({ ...sortedOrder, startDate: new Date() });
      } else {
        // We have to find the previous order because we need it's created startTime. Won't
        // be accessible through sortedArray[i-1]
        const previousOrder = tempOrdersArr.find(
          (ord: any) => ord.work_order_number === sortedOrder.previousLoadOrder
        );
        if (previousOrder) {
          const startDate = DateHelper.add(
            previousOrder.startDate,
            previousOrder.duration
          );
          tempOrdersArr.push({ ...sortedOrder, startDate });
        } else {
          console.error(
            `Util.ts - In row: ${key}, The scheduler was unable to plot an order (ID: ${sortedOrder.id}) because the previous loaded order (load_after: ${sortedOrder.previousLoadOrder}) doesn't exist. `
          );
        }
      }
    });
  });
  return tempOrdersArr;
};

// Helper function to remove resources that have no events in them- except for the last resource
// in the scheduler. We leave the last row as empty to allow new rows to be added when an order is
// dropped on it.
const cleanupResources = (resourceStore: any) => {
  const resourceIdMap = resourceStore.idMap;
  const toDelete: any = [];
  Object.keys(resourceIdMap).forEach((resourceId) => {
    const resourceDetail = resourceIdMap[resourceId];
    const resourceEvents = resourceDetail.record.events;
    const resourcesCount = Object.keys(resourceIdMap).length;
    if (
      resourceEvents.length === 0 && // There are no events in this resource
      resourcesCount - 1 !== resourceDetail.index // Its not the last row
    ) {
      // resourceStore.remove(resourceId);
      toDelete.push(resourceId);
    }
  });
  if (toDelete.length > 0) {
    resourceStore.remove(toDelete);
  }
};

// Helper function to grab the resources off of list of all scheduled orders. Used to build the
// ResourceStore on the scheduler.
const getResourcesFromOrders = (events: any[], armId: number) => {
  // Get unique resources from events
  let rows = events.reduce((accumulator: any, order: any) => {
    if (!accumulator.includes(order.scheduled_resource_id)) {
      accumulator.push(order.scheduled_resource_id);
    }
    return accumulator;
  }, []);
  // Push a default resource because we always want one more than the initial length
  rows.push(`${armId}-r${rows.length + 1}`);
  // Map to objects with the resource as the id. Needed for resource store
  return rows.map((res: any) => ({ id: res }));
};

// NOTE: This is deprecated as of now. The goal was that if we used the Schedulers working days config,
// we'd have to extend the visual duration of orders to extend past 'out of work' hours. I'm keeping
// it here temporarily as the logic wasn't incorrect, but we're just not using it anymore for simplicity.

// Helper function that adjusts the duration of the order based off the cofigurations for
// WORKING_START_HOUR and WORKING_END_HOUR
// To-Do: Add handling for weekends using the WORKING_START_DAY and WORKING_END_DAY values
const getEventAdjustedDuration = (event: any) => {
  const startDate = event.startDate;

  // Get the ending work hour in ms (default to 17 or 5:00 pm)
  const workingEndHourInMs = DateHelper.asMilliseconds(
    WORKING_END_HOUR,
    "hour"
  );
  // Get the start time in MS (NOT the start date)
  const startTimeInMs = DateHelper.getTimeOfDay(startDate);
  // Find the working-hour duration that the event can be scheduled in
  // the first day (amount of MS from startTime to pre-configured var
  // for the end of the work day)
  const initialDelta = workingEndHourInMs - startTimeInMs;
  // Find the remaining duration that needs to be adjusted for this event (MS)
  const durationToAllocateMs = event.scheduled_duration - initialDelta;
  // Convert previous value to hours
  const remainingHoursToAllocate = DateHelper.as("hour", durationToAllocateMs);
  // Get one full day in MS
  const oneDayInMs = DateHelper.asMilliseconds(1, "day");
  // Find the amount of working hours set by schedule config (default 9 hours) in hours
  const workingHours = WORKING_END_HOUR - WORKING_START_HOUR;
  // Find the duration of non-working hours (5:00PM - 8:00AM, 15 hrs) in MS
  const nonWorkingHoursMs =
    oneDayInMs - DateHelper.asMilliseconds(workingHours, "hour");
  // Find how many days we need to fill
  const numberOfDaysToFill = Math.ceil(remainingHoursToAllocate / workingHours);
  // Calculate the total amount of MS that need to be added to the initial duration
  const totalDaysFilledInMs = numberOfDaysToFill * nonWorkingHoursMs;

  return event.duration + totalDaysFilledInMs;
};

export {
  getEventAdjustedDuration,
  mapToOrderModel,
  normalizeOrder,
  mapToCounterWeightModel,
  getOrdersWithStartDates,
  cleanupResources,
  getResourcesFromOrders,
  mapToHardBreakModel,
};
