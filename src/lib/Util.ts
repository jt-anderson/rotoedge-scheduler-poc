import { DateHelper } from "@bryntum/scheduler";
import {
  ONLY_WORKING_HOURS,
  WORKING_START_DAY,
  WORKING_END_DAY,
  WORKING_START_HOUR,
  WORKING_END_HOUR,
  START_DATE,
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
  }));
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
  const tempScheduledArmOrders: any[] = [];

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

    // Apply start dates. If the order is the root item, set it's start to the current date
    sortedArray.forEach((sortedOrder: any, i: number) => {
      if (i === 0) {
        tempScheduledArmOrders.push({ ...sortedOrder, startDate: new Date() });
      } else {
        // We have to find the previous order because we need it's created startTime. Won't
        // be accessible through sortedArray[i-1]
        const previousOrder = tempScheduledArmOrders.find(
          (ord: any) => ord.work_order_number === sortedOrder.previousLoadOrder
        );
        if (previousOrder) {
          const startDate = DateHelper.add(
            previousOrder.startDate,
            previousOrder.duration
          );
          tempScheduledArmOrders.push({ ...sortedOrder, startDate });
        }
      }
    });
  });
  return tempScheduledArmOrders;
};

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

// Helper function to remove resources that have no events in them- except for the last resource
// in the scheduler. We leave the last row as empty to allow new rows to be dragged.
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
  resourceStore.remove(toDelete);
};

export {
  getEventAdjustedDuration,
  mapToOrderModel,
  normalizeOrder,
  getOrdersWithStartDates,
  cleanupResources,
};
