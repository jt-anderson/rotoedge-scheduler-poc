import { Mixin } from "../../ChronoGraph/class/BetterMixin.js";
import { CalendarIntervalMixin } from "./CalendarIntervalMixin.js";
import { AbstractPartOfProjectStoreMixin } from "../quark/store/mixin/AbstractPartOfProjectStoreMixin.js";
/*
 * This a collection of {@link #CalendarIntervalMixin} items. Its a dumb collection though, the "real" calendar
 * is a [[AbstractCalendarMixin]] model, which is part of the [[AbstractCalendarManagerStoreMixin]].
 *
 */
export class CalendarIntervalStore extends Mixin([AbstractPartOfProjectStoreMixin], (base) => {
    const superProto = base.prototype;
    class CalendarIntervalStore extends base {
        static get defaultConfig() {
            return {
                modelClass: CalendarIntervalMixin
            };
        }
    }
    return CalendarIntervalStore;
}) {
}
