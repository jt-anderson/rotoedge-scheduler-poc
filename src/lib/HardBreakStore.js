import { RecurringTimeSpansMixin, Store } from "@bryntum/scheduler";
import HardBreak from "./HardBreak";

export default class HardBreakStore extends RecurringTimeSpansMixin(Store) {
  static get defaultConfig() {
    return {
      // use our new MyResourceTimeRange model
      modelClass: HardBreak,
    };
  }
}
