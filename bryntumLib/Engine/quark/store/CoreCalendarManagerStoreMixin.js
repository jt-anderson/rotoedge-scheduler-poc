import { Mixin } from "../../../ChronoGraph/class/BetterMixin.js";
import { CorePartOfProjectStoreMixin } from './mixin/CorePartOfProjectStoreMixin.js';
import { CoreCalendarMixin } from '../model/scheduler_core/CoreCalendarMixin.js';
import { AbstractCalendarManagerStoreMixin } from "./AbstractCalendarManagerStoreMixin.js";
/**
 * A store mixin class, that represent collection of all calendars in the [[SchedulerCoreProjectMixin|project]].
 */
export class CoreCalendarManagerStoreMixin extends Mixin([AbstractCalendarManagerStoreMixin, CorePartOfProjectStoreMixin], (base) => {
    const superProto = base.prototype;
    class CoreCalendarManagerStoreMixin extends base {
        static get defaultConfig() {
            return {
                tree: true,
                modelClass: CoreCalendarMixin
            };
        }
    }
    return CoreCalendarManagerStoreMixin;
}) {
}
