import { stripDuplicates } from "../util/StripDuplicates.js";
/**
 * A class, that represent a cached set of availability intervals. One can use the [[getIsWorking]] method
 * to determine if this set intervals represents working time or non-working.
 */
export class CalendarCacheInterval {
    constructor(config) {
        this.intervals = [];
        config && Object.assign(this, config);
        if (!this.calendar)
            throw new Error("Required attribute `calendar` is missing");
    }
    includeInterval(interval) {
        if (this.intervals.indexOf(interval) == -1) {
            const copy = this.intervals.slice();
            copy.push(interval);
            return new CalendarCacheInterval({ intervals: copy, calendar: this.calendar });
        }
        else
            return this;
    }
    combineWith(interval) {
        return new CalendarCacheInterval({ intervals: this.intervals.concat(interval.intervals), calendar: this.calendar });
    }
    /**
     * Returns the working status of this intervals set. It is determined as a working status
     * of the most prioritized interval (intervals are prioritized from child to parent)
     */
    getIsWorking() {
        if (this.isWorking != null)
            return this.isWorking;
        const intervals = this.intervals = this.normalizeIntervals(this.intervals);
        // return the value of the interval with the highest priority
        return this.isWorking = intervals[0].isWorking;
    }
    normalizeIntervals(intervals) {
        const filtered = stripDuplicates(intervals);
        // sort in decreasing order
        filtered.sort((interval1, interval2) => interval2.getPriorityField() - interval1.getPriorityField());
        return filtered;
    }
}
