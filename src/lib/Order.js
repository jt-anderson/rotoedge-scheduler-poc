import { EventModel } from "@bryntum/scheduler";

export default class Order extends EventModel {
  static get defaults() {
    return {
      durationUnit: "ms",
      resizable: false,
    };
  }

  // Use this method to map fields in your data objects to the fields needed by the scheduler
  // static get fields() {
  //   return [
  //     { name: "startDate", dataSource: "scheduled_start_date" },
  //     { name: "duration", dataSource: "scheduled_duration_adjusted" },
  //     { name: "resourceId", dataSource: "scheduled_resource_id" },
  //     { name: "originalDuration", dataSource: "scheduled_duration" },
  //   ];
  // }
}
