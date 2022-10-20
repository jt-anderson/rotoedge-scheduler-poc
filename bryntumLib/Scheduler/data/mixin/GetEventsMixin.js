import DateHelper from '../../../Core/helper/DateHelper.js';
import Objects from '../../../Core/helper/util/Objects.js';

/**
 * @module Scheduler/data/mixin/GetEventsMixin
 */

const
    returnTrue   = () => true,
    notRecurring = event => !event.isRecurring;

/**
 * Mixing containing functionality for retrieving a range of events, mainly used during rendering.
 *
 * Consumed by EventStore in Scheduler & Scheduler Pro and TaskStore in Gantt.
 *
 * @mixin
 */
export default Target => class GetEventsMixin extends Target {

    static $name = 'GetEventsMixin';

    /**
     * Returns an array of events for the date range specified by the `startDate` and `endDate` options.
     *
     * By default, for any date, this includes any event which *intersects* that date.
     *
     * To only include events that are fully contained *within* the date range, pass the `allowPartial`
     * option as `false`.
     *
     * By default, any occurrences of recurring events are included in the resulting array (not applicable in Gantt). If
     * that is not required, pass the `includeOccurrences` option as `false`. **Note that if `includeOccurrences` is
     * `true`, the start date and end date options are mandatory. The method must know what range of occurrences needs
     * to be generated and returned.**
     *
     * Example:
     *
     * ```javascript
     *  visibleEvents = eventStore.getEvents({
     *      resourceRecord : myResource,
     *      startDate      : scheduler.timeAxis.startDate,
     *      endDate        : scheduler.timeAxis.endDate
     *  });
     * ```
     *
     * @param {Object} options An options object determining which events to return
     * @param {Date} [options.date] If only one date is required, pass this option instead of the
     * `startDate` and `endDate` options.
     * @param {Date} options.startDate The start date for the range of events to include.
     * @param {Date} [options.endDate] The end date for the range of events to include.
     * @param {Scheduler.model.ResourceModel} options.resourceRecord Pass a resource to only return events assigned to
     *   this resource. Not supported when using the `dateMap` option (see below)
     * @param {Function} [options.filter] A function to filter out events which are not required.
     * @param {Boolean} [options.includeOccurrences=true] Occurrences of recurring events are included by default.
     * @param {Boolean} [options.allowPartial=true] Events which start before or after the range, but *intersect* the
     *   range are included by default.
     * @param {Boolean} [options.startOnly] Pass `true` to only include events which *start on* each date in the range.
     * @param {Boolean} [options.onlyAssigned] Pass `true` to only include events that are assigned to a resource
     * @param {Boolean|Map} [options.dateMap] Populates the passed `Map`, or if passed as `true`, creates and
     * returns a new `Map`. The keys are `YYYY-MM-DD` date strings and the entries are arrays of
     * {@link Scheduler.model.EventModel EventModel}s.
     * @returns {Scheduler.model.EventModel[]|Map} Events which match the passed configuration.
     * @category Events
     */
    getEvents({
        filter,
        date,
        startDate,                  // Events which intersect the startDate/endDate
        endDate,                    // will be returned
        startOnly,                  // Only events which start on each date will be returned
        includeOccurrences,         // Interpolate occurrences into the returned event set
        allowPartial,               // Include events which *intersect* the date range
        onlyAssigned = false,       // Only include events that are assigned to a resource
        dateMap = false,            // Return a Map keyed by date each value being an array of events
        dayTime = null,

        // Private option. Select which date index to look up events in depending on the date
        // we are examining in the date iteration process. Some callers may want to use
        // different indices depending on the stage through the date iteration.
        // See Calendar package for usage.
        getDateIndex
    }) {
        const
            me                = this,
            options           = arguments[0],
            {
                lastDateRange,
                added,
                filtersFunction
            } = me,
            passedFilter      = filter;

        // Add filtering for only assigned events if requested.
        if (onlyAssigned) {
            options.filter = passedFilter ? e => passedFilter(e) && e.resources.length : e => e.resources.length;
        }

        // Note that we cannot use defaulting in the argument block because we pass
        // the incoming options object down into implementations.
        if (!('startDate' in options)) {
            startDate = options.startDate = date;
        }
        if (!('includeOccurrences' in options)) {
            includeOccurrences = options.includeOccurrences = true;
        }
        if (!('allowPartial' in options)) {
            allowPartial = options.allowPartial = !startOnly;
        }

        // We can't use me.filtersFunction if reapplyFilterOnAdd is false because there may be newly
        // added events which may not be subject to the filter. Records which are still in
        // the added bag must be tested for presence using indexOf so as to be always in sync
        // with the store being refiltered. Parens help readability.
        // eslint-disable-next-line no-extra-parens
        options.storeFilterFn = me.isFiltered ? (me.reapplyFilterOnAdd ? filtersFunction : (eventRecord => added.includes(eventRecord) ? me.indexOf(eventRecord) > -1 : filtersFunction(eventRecord))) : null;

        // Default to a one day range if only startDate passed
        if (!endDate) {
            if (startDate) {
                endDate = options.endDate = DateHelper.clearTime(startDate);
                endDate.setDate(endDate.getDate() + 1);
            }
            // If no dates passed, the dateFilter will include all.
            else {
                // We need to know what occurrences to generate.
                if (includeOccurrences) {
                    throw new Error('getEvents MUST be passed startDate and endDate if recurring occurrences are requested');
                }
                options.dateFilter = returnTrue;
            }
        }

        if (!options.dateFilter) {
            // Must start in the date range
            if (startOnly) {
                options.dateFilter = e => {
                    // Avoid hitting getter twice. Use batched value if present.
                    const eventStartDate = e.hasBatchedChange('startDate') ? e.get('startDate') : e.startDate;

                    return eventStartDate && !(DateHelper.clearTime(eventStartDate) - startDate);
                };
            }
            // Any intersection with our date range
            else if (allowPartial) {
                options.dateFilter = e => {
                    // Avoid hitting getter twice. Use batched value if present.
                    const
                        eventStartDate = e.hasBatchedChange('startDate') ? e.get('startDate') : e.startDate,
                        eventEndDate   = e.hasBatchedChange('endDate') ? e.get('endDate') : e.endDate || eventStartDate,
                        isMilestone    = !(eventStartDate - eventEndDate);

                    return eventStartDate && (isMilestone ? DateHelper.betweenLesserEqual(eventStartDate, startDate, endDate) : DateHelper.intersectSpans(eventStartDate, eventEndDate, startDate, endDate));
                };
            }
            // Must be wholly contained with the our range
            else {
                options.dateFilter = e => {
                    // Avoid hitting getter twice. Use batched value if present.
                    const
                        eventStartDate = e.hasBatchedChange('startDate') ? e.get('startDate') : e.startDate,
                        eventEndDate   = e.hasBatchedChange('endDate') ? e.get('endDate') : e.endDate || eventStartDate;

                    return eventStartDate && eventStartDate >= startDate && eventEndDate <= endDate;
                };
            }
        }

        const
            newDateRange    = {
                startDate,
                endDate
            },
            dateRangeChange = !lastDateRange || (lastDateRange.startDate - newDateRange.startDate || lastDateRange.endDate - newDateRange.endDate);

        if (dateRangeChange) {
            // Ensure the listeners are present
            me.processConfiguredListeners();

            /**
             * Fired when a range of events is requested from the {@link #function-getEvents} method.
             * @event loadDateRange
             * @param {Scheduler.data.EventStore} source This EventStore
             * @param {Object} old The old date range
             * @param {Date} old.startDate the old start date.
             * @param {Date} old.endDate the old end date.
             * @param {Object} new The new date range
             * @param {Date} new.startDate the new start date.
             * @param {Date} new.endDate the new end date.
             */
            me.trigger('loadDateRange', {
                old : lastDateRange || {},
                new : Objects.clone(newDateRange)
            });
            // Dates are mutable, so we must keep our own copy.
            me.lastDateRange = Objects.clone(newDateRange);
        }

        return dateMap ? me.getEventsAsMap(options) : me.getEventsAsArray(options);
    }

    /**
     * Internal implementation for {@link #function-getEvents} to use when not using dateMap.
     * @private
     */
    getEventsAsArray({
        filter,
        date,
        resourceRecord,
        startDate = date,           // Events which intersect the startDate/endDate
        endDate,                    // will be returned
        startOnly,                  // Only events which start on each date will be returned
        includeOccurrences = true,  // Interpolate occurrences into the returned event set
        dayTime = null,

        // Injected by the getEvents master method
        dateFilter,

        storeFilterFn,

        // Private option. Select which date index to look up events in depending on the date
        // we are examining in the date iteration process. Some callers may want to use
        // different indices depending on the stage through the date iteration.
        // See Calendar package for usage.
        getDateIndex
    }) {
        const
            me     = this,
            events = [];

        if (me.count) {
            let candidateEvents = resourceRecord ? me.getEventsForResource(resourceRecord) : null;

            // If there *was* a resourceRecord, candidateEvents will already be set up using me.getEventsForResource.
            // If no resourceRecord specified, we are gathering by date, so use the indices.
            if (!resourceRecord) {
                const
                    dateIndex = me.useDayIndex(dayTime),
                    eventSet  = new Set(),
                    indexName = startOnly ? 'startDate' : 'date';

                // Add all recurring events which started on or before our date range.
                me.recurringEvents.forEach(e => {
                    if (dateIndex.dayTime.startOfDay(e.startDate) <= startDate) {
                        eventSet.add(e);
                    }
                });

                // Iterate the date range, using the indices to find qualified events.
                for (const date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
                    const coincidingEvents = dateIndex.get(getDateIndex ? getDateIndex(date) : indexName, date);

                    coincidingEvents?.forEach(e => eventSet.add(e));
                }

                // We gathered all events which *coincide* with each date.
                // We also added in all recurring events which started on or before our date range.
                // All these were made unique by the Set.
                // Return it to array form.
                candidateEvents = [...eventSet];
            }

            // Events found from the date indices won't be filtered.
            // On the other side, when using getEventForResource we will get all events for
            // the resource even if the EventStore is filtered, handle this by excluding "invisible" events here
            if (storeFilterFn) {
                candidateEvents = candidateEvents.filter(storeFilterFn);
            }

            // Go through candidates.
            // For a recurring event, and we are including recurrences, add date-qualifying occurrences.
            // For a non-recurring event, add it if it's date-qualified.
            for (let i = 0, { length } = candidateEvents; i < length; i++) {
                const e = candidateEvents[i];

                // For recurring events, add date-qualifying occurrences, not the base
                if (includeOccurrences && e.isRecurring) {
                    events.push.apply(events, e.getOccurrencesForDateRange(startDate, endDate).filter(dateFilter));
                }
                // For ordinary events, add if it's date-qualified
                else if (dateFilter(e)) {
                    events.push(e);
                }
            }
        }

        return filter ? events.filter(filter) : events;
    }

    /**
     * Internal implementation for {@link #function-getEvents} to use when using dateMap.
     * @private
     */
    getEventsAsMap({
        filter : passedFilter,
        date,
        resourceRecord,             // Not supported yet. Will add if ever requested.
        startDate = date,           // Events which intersect the startDate/endDate
        endDate,                    // will be returned
        startOnly,                  // Only events which start on each date will be returned
        includeOccurrences = true,  // Interpolate occurrences into the returned event set
        dateMap,                    // Return a Map keyed by date each value being an array of events
        dayTime = null,

        storeFilterFn,

        // Private option. Select which date index to look up events in depending on the date
        // we are examining in the date iteration process. Some callers may want to use
        // different indices depending on the stage through the date iteration.
        // See Calendar package for usage.
        getDateIndex
    }) {
        const me = this;

        // Convert `true` to a Map.
        if (dateMap?.clear) {
            dateMap.clear();
        }
        else {
            dateMap = new Map();
        }

        if (me.count) {
            const
                dateIndex       = me.useDayIndex(dayTime),
                indexName       = startOnly ? 'startDate' : 'date',
                recurringEvents = [],
                filter          = e => (!passedFilter || passedFilter(e)) && (!storeFilterFn || storeFilterFn(e)),
                baseEventFilter = e => notRecurring(e) && filter(e);

            dayTime = dateIndex.dayTime;  // dayTime=null becomes DayTime instance for midnight

            // We can't yet do this for just a resource.
            if (resourceRecord) {
                throw new Error('Querying for events for a resource and returning a date-keyed Map is not supported');
            }
            else {
                // Add all recurring events which started before the end of our date range.
                // There are none in Gantt projects
                me.recurringEvents?.forEach(e => {
                    if (dayTime.startOfDay(e.startDate) < endDate) {
                        recurringEvents.push(e);
                    }
                });

                // Iterate the date range, using the indices to find qualified events.
                for (const date = new Date(startDate); date < endDate; date.setDate(date.getDate() + 1)) {
                    let [coincidingEvents, key] = dateIndex.get(getDateIndex ? getDateIndex(date) : indexName, date, true);

                    // The index entry may be there, but it could be empty.
                    if (coincidingEvents?.size) {
                        // Convert Set which index holds into an Array.
                        // A recurring event doesn't go into the Map, its occurrences do.
                        // Then filter by the passed filter and this Store's filter function
                        // because events found from the date indices won't be filtered.
                        coincidingEvents = [...coincidingEvents].filter(baseEventFilter);

                        // Only create the entry for the day if there are events found
                        if (coincidingEvents.length) {
                            (dateMap.get(key) || (dateMap.set(key, []).get(key))).push(...coincidingEvents);
                        }
                    }
                }
            }

            // Go through matching recurring events.
            for (let i = 0, { length } = recurringEvents; i < length; i++) {
                const
                    e = recurringEvents[i],
                    // For each recurring event, add occurrences if we are including occurrences else, add the base.
                    // Then filter by the passed filter and this Store's filter function
                    // because events found from the date indices won't be filtered.
                    occurrences = (includeOccurrences ? e.getOccurrencesForDateRange(startDate, endDate) : [e]).filter(filter),
                    lastDate    = DateHelper.add(endDate, 1, 'day');

                // Add occurrences to dateMap
                for (let bucket, i = 0, { length } = occurrences; i < length; i++) {
                    const
                        occurrence = occurrences[i],
                        date = dayTime.startOfDay(occurrence.startDate),
                        indexName = getDateIndex ? getDateIndex(date) : (startOnly ? 'startDate' : 'date'),
                        lastInteresctingDate = (indexName === 'startDate') || occurrence.allDay
                            ? DateHelper.add(date, 1, 'day')
                            : DateHelper.min(occurrence.endDate || DateHelper.add(occurrence.startDate, occurrence.duration, occurrence.durationUnit), lastDate);

                    // Loop through covered dates, adding to dateMap if required
                    for (; date < lastInteresctingDate; date.setDate(date.getDate() + 1)) {
                        const key = dayTime.dateKey(date);

                        (bucket = dateMap.get(key)) || dateMap.set(key, bucket = []);

                        bucket.push(occurrence);
                    }
                }
            }
        }

        return dateMap;
    }

};
