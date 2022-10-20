import { Mixin } from "../../ChronoGraph/class/BetterMixin.js";
import later from "../vendor/later/later.js";
import { AbstractPartOfProjectModelMixin } from "../quark/model/mixin/AbstractPartOfProjectModelMixin.js";
/**
 * This is a calendar interval mixin.
 *
 * Can be either a static time interval (if [[startDate]]/[[endDate]] are specified) or recurrent time interval
 * ([[recurrentStartDate]]/[[recurrentEndDate]]).
 *
 * By default it defines a non-working period ([[isWorking]] field has default value `false`),
 * but can also define an explicit working time, for example to override some previous period.
 *
 * You probably don't need to create instances of this mixin directly, instead you pass its configuration object to the [[AbstractCalendarMixin.addInterval]]
 */
export class CalendarIntervalMixin extends Mixin([AbstractPartOfProjectModelMixin], (base) => {
    const superProto = base.prototype;
    class CalendarIntervalMixin extends base {
        static get fields() {
            return [
                'name',
                { name: 'startDate', type: 'date', format: 'YYYY-MM-DDTHH:mm:ssZ' },
                { name: 'endDate', type: 'date', format: 'YYYY-MM-DDTHH:mm:ssZ' },
                'recurrentStartDate',
                'recurrentEndDate',
                'cls',
                'iconCls',
                { name: 'isWorking', type: 'boolean', defaultValue: false },
                { name: 'priority', type: 'number' }
            ];
        }
        getCalendar() {
            return this.stores[0].calendar;
        }
        resetPriority() {
            this.priorityField = null;
            this.getCalendar().getDepth();
        }
        // not just `getPriority` to avoid clash with auto-generated getter in the subclasses
        getPriorityField() {
            if (this.priorityField != null)
                return this.priorityField;
            // 0 - 10000 interval is reserved for "unspecified time" intervals
            // then 10000 - 10100, 10100-10200, ... etc intervals are for the calendars at depth 0, 1, ... etc
            let base = 10000 + this.getCalendar().getDepth() * 100;
            let priority = this.priority;
            if (priority == null) {
                // recurrent intervals are considered "base" and have lower priority
                // static intervals are considered special case overrides and have higher priority
                priority = this.isRecurrent() ? 20 : 30;
            }
            // intervals from parent calendars will have lower priority
            return this.priorityField = base + priority;
        }
        /**
         * Whether this interval is recurrent (both [[recurrentStartDate]] and [[recurrentEndDate]] are present and parsed correctly
         * by the `later` library)
         */
        isRecurrent() {
            return Boolean(this.recurrentStartDate && this.recurrentEndDate && this.getStartDateSchedule() && this.getEndDateSchedule());
        }
        /**
         * Whether this interval is static - both [[startDate]] and [[endDate]] are present.
         */
        isStatic() {
            return Boolean(this.startDate && this.endDate);
        }
        /**
         * Helper method to parse [[recurrentStartDate]] and [[recurrentEndDate]] field values.
         * @param {Object|String} schedule Recurrence schedule
         * @returns {Object} Processed schedule ready to be used by later.schedule() method.
         * @private
         */
        parseDateSchedule(value) {
            let schedule = value;
            if (value && value !== Object(value)) {
                schedule = later.parse.text(value);
                if (schedule !== Object(schedule) || schedule.error >= 0) {
                    // can be provided as JSON text
                    try {
                        schedule = JSON.parse(value);
                    }
                    catch (e) {
                        return null;
                    }
                }
            }
            return schedule;
        }
        getStartDateSchedule() {
            if (this.startDateSchedule)
                return this.startDateSchedule;
            const schedule = this.parseDateSchedule(this.recurrentStartDate);
            return this.startDateSchedule = later.schedule(schedule);
        }
        getEndDateSchedule() {
            if (this.endDateSchedule)
                return this.endDateSchedule;
            if (this.recurrentEndDate === 'EOD')
                return 'EOD';
            const schedule = this.parseDateSchedule(this.recurrentEndDate);
            return this.endDateSchedule = later.schedule(schedule);
        }
    }
    return CalendarIntervalMixin;
}) {
}
