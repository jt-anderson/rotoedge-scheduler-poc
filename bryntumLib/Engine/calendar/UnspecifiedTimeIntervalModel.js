import { Mixin } from "../../ChronoGraph/class/BetterMixin.js";
import { CalendarIntervalMixin } from "./CalendarIntervalMixin.js";
// TODO if we would be doing just:
//      export class UnspecifiedTimeIntervalModel extends CalendarIntervalMixin ...
// then an instance of the `CalendarIntervalMixin` `c` would : `c instanceof UnspecifiedTimeIntervalModel`,
// because it inherit the `hasInstance` symbol
// need to figure out how it can be handled
// Calendar interval model denoting unspecified interval
export class UnspecifiedTimeIntervalModel extends Mixin([CalendarIntervalMixin], (base) => {
    const superProto = base.prototype;
    class UnspecifiedTimeIntervalModel extends base {
        // TODO: why it overrides the method, is it configured with calendar instance directly?
        getCalendar() {
            return this.calendar;
        }
        // NOTE: See parent class implementation for further comments
        getPriorityField() {
            if (this.priorityField != null)
                return this.priorityField;
            return this.priorityField = this.getCalendar().getDepth();
        }
    }
    return UnspecifiedTimeIntervalModel;
}) {
}
