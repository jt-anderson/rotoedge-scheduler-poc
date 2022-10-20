import { CorePartOfProjectModelMixin } from '../mixin/CorePartOfProjectModelMixin.js';
import { Mixin } from "../../../../ChronoGraph/class/BetterMixin.js";
import { AbstractCalendarMixin } from "../AbstractCalendarMixin.js";
/**
 * The calendar for project scheduling, it is used to mark certain time intervals as "non-working" and ignore them during scheduling.
 *
 * The calendar consists from several [[CalendarIntervalMixin|intervals]]. The intervals can be either static or recurrent.
 */
export class CoreCalendarMixin extends Mixin([AbstractCalendarMixin, CorePartOfProjectModelMixin], (base) => {
    const superProto = base.prototype;
    class CoreCalendarMixin extends base {
    }
    return CoreCalendarMixin;
}) {
}
