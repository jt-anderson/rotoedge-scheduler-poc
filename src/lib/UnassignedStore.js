import { EventStore } from "@bryntum/scheduler";
import Order from "./Order.js";

export default class UnassignedStore extends EventStore {
  static get defaultConfig() {
    return {
      modelClass: Order,
    };
  }

  getRecords() {
    return this.records.map((rec) => rec.originalData);
  }
}
