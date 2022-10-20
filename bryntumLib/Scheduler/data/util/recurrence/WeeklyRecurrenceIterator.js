/**
 * @module Scheduler/data/util/recurrence/WeeklyRecurrenceIterator
 */

import AbstractRecurrenceIterator from './AbstractRecurrenceIterator.js';
import DateHelper from '../../../../Core/helper/DateHelper.js';
import DayRuleEncoder from './RecurrenceDayRuleEncoder.js';

/**
 * A class which provides iteration to call a function for dates specified by a
 * {@link Scheduler.model.RecurrenceModel RecurrenceModel} over a specified date range.
 * @private
 */
export default class WeeklyRecurrenceIterator extends AbstractRecurrenceIterator {

    static get frequency() {
        return 'WEEKLY';
    }

    /**
     * Iterates over the passed date range, calling the passed callback on each date on which
     * starts an event which matches the passed recurrence rule and overlaps the start and end dates.
     * @param {Object} config An object which describes how to iterate.
     * @param {Date} config.startDate The point in time to begin iteration.
     * @param {Date} config.endDate The point in time to end iteration.
     * @param {Boolean} [config.startOnly] By default, all occurrences which intersect the date range
     * will be visited. Pass `true` to only visit occurrences which *start* in the date range.
     * @param {Scheduler.model.RecurrenceModel} config.recurrence The point in time to end iteration.
     * @param {Function} config.fn The function to call for each date which matches the recurrence in the date range.
     * @param {Date} config.fn.date The occurrence date.
     * @param {Number} config.fn.counter A counter of how many dates have been visited in this iteration.
     * @param {Boolean} config.fn.isFirst A flag which is `true` if the date is the first occurrence in the specified recurrence rule.
     * @param {Array} [config.extraArgs] Extra arguments to pass to the callback after the `isFirst` argument.
     */
    static forEachDate(config) {
        const
            {
                startOnly,
                startDate,
                endDateMS,
                timeSpan,
                timeSpanStart,
                timeSpanStartMS,
                earliestVisibleDateMS,
                durationMS,
                spansStart,
                recurrence,
                fn,
                extraArgs,
                scope = this
            }                     = this.processIterationConfig(config),
            {
                interval,
                days
            }                     = recurrence,
            { weekStartDay }      = DateHelper,
            startHours            = timeSpanStart.getHours(),
            startMinutes          = timeSpanStart.getMinutes(),
            startSeconds          = timeSpanStart.getSeconds(),
            startMS               = timeSpanStart.getMilliseconds();

        let counter    = 0,
            { count }  = recurrence,
            weekDays   = DayRuleEncoder.decode(days),
            weekStartDate, occurrenceDate;

        // "Days" might be skipped then we use the event start day
        if (!weekDays?.length) {
            weekDays = [[timeSpanStart.getDay()]];
        }

        // If week start day is not zero (Sunday)
        // we need to normalize weekDays array since its values are used
        // to calculate real dates as: date = week_start_date + weekDay_entry
        // which does not work when week starts on non-Sunday
        if (weekStartDay > 0) {
            for (let i = 0; i < weekDays.length; i++) {
                if (weekStartDay > weekDays[i][0]) {
                    weekDays[i][0] = 7 - weekStartDay - weekDays[i][0];
                }
                else {
                    weekDays[i][0] -= weekStartDay;
                }
            }
        }

        // days could be provided in any order so it's important to sort them
        weekDays.sort((a, b) => a[0] - b[0]);

        // if the recurrence is limited w/ "Count" or not every interval should match
        // we need to 1st count passed occurrences so we always start iteration from the event start date
        weekStartDate = DateHelper.getNext(count || interval > 1 ? timeSpanStart : startDate, 'week', 0);

        if (!endDateMS && !count) {
            count = this.MAX_OCCURRENCES_COUNT;
        }

        while (!endDateMS || weekStartDate.getTime() <= endDateMS) {

            for (let i = 0; i < weekDays.length; i++) {
                // Faster than chaining multiple DateHelper calls
                occurrenceDate = new Date(
                    weekStartDate.getFullYear(),
                    weekStartDate.getMonth(),
                    weekStartDate.getDate() + weekDays[i][0],
                    startHours,
                    startMinutes,
                    startSeconds,
                    startMS
                );

                const occurrenceDateMS = occurrenceDate.getTime();

                if (occurrenceDateMS >= timeSpanStartMS) {
                    const inView = this.isInViewMS(startOnly, occurrenceDate, occurrenceDateMS, earliestVisibleDateMS, durationMS, timeSpan);

                    counter++;

                    if (inView &&
                        ((endDateMS && occurrenceDateMS > endDateMS) ||
                        (fn.apply(scope, [occurrenceDate, counter, counter === 1 && spansStart, timeSpan, ...extraArgs]) === false) ||
                        (count && counter >= count))
                    ) {
                        return;
                    }
                }
            }

            // get next week start
            weekStartDate = DateHelper.getNext(weekStartDate, 'week', interval);
        }
    }

}
