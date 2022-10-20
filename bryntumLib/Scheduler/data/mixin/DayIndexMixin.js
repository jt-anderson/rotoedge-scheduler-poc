import DayTime from '../../../Core/util/DayTime.js';
import EventDayIndex from '../util/EventDayIndex.js';

/**
 * @module Scheduler/data/mixin/DayIndexMixin
 */

const { MIDNIGHT } = DayTime;

/**
 * Mixing handling Calendars day indices.
 *
 * Consumed by EventStore in Scheduler & Scheduler Pro and TaskStore in Gantt.
 *
 * @mixin
 * @internal
 */
export default Target => class DayIndexMixin extends Target {

    static $name = 'DayIndexMixin';

    construct(config) {
        super.construct(config);

        this.dayIndices = null;
    }

    //region Keeping index in sync

    // Override to syncIndices on initial load
    afterLoadData() {
        this.syncIndices('splice', this.storage.allValues);
        super.afterLoadData?.();
    }

    /**
     * Responds to mutations of the underlying storage Collection.
     *
     * Maintain indices for fast finding of events by date.
     * @param {Object} event
     * @private
     */
    onDataChange({ action, added, removed, replaced }) {
        // Indices must be synced before responding to change
        this.syncIndices(action, added, removed, replaced);

        super.onDataChange(...arguments);
    }

    onDataReplaced(action, data) {
        // Indices must be synced before responding to change
        this.syncIndices('clear');
        this.syncIndices('splice', this.storage.values);

        super.onDataReplaced(action, data);
    }

    onModelChange(record, toSet, wasSet, silent, fromRelationUpdate) {
        // Ensure by-date indices are up to date.
        if (('startDate' in wasSet) || ('endDate' in wasSet)) {
            this.syncIndices('reschedule', [record], null, null, wasSet);
        }

        super.onModelChange(...arguments);
    }

    //endregion

    //region Index

    /**
     * Invalidates associated day indices.
     * @internal
     */
    invalidateDayIndices() {
        this.dayIndices?.forEach(dayIndex => dayIndex.invalidate());
    }

    /**
     * Registers a `DayTime` instance, creating an `EventDayIndex` for each distinct `startShift`. This index is
     * maintained until all instances with a matching `startShift` are {@link #function-unregisterDayIndex unregistered}.
     * @param {Core.util.DayTime} dayTime The instance to register.
     * @internal
     * @category Indexing
     */
    registerDayIndex(dayTime) {
        const
            me = this,
            dayIndices = me.dayIndices || (me.dayIndices = []);

        let dayIndex, i;

        for (i = 0; !dayIndex && i < dayIndices.length; ++i) {
            if (dayIndices[i].matches(dayTime)) {
                (dayIndex = dayIndices[i]).register(dayTime);
            }
        }

        !dayIndex && dayIndices.push(dayIndex = new EventDayIndex(me, dayTime));

        return dayIndex;
    }

    syncIndices(...args) {
        this.dayIndices?.forEach(dayIndex => dayIndex.sync(...args));
    }

    /**
     * Removes a registered `DayTime` instance. If this is the last instance registered to an `EventDayIndex`, that
     * index is removed.
     * @param {Core.util.DayTime} dayTime The instance to unregister.
     * @internal
     * @category Indexing
     */
    unregisterDayIndex(dayTime) {
        const
            me = this,
            { dayIndices } = me;

        for (let i = dayIndices?.length; i-- > 0; /* empty */) {
            if (dayIndices[i].matches(dayTime)) {
                if (dayIndices[i].unregister(dayTime)) {
                    dayIndices.splice(i, 1);
                }

                break;
            }
        }
    }

    /**
     * Returns the `EventDayIndex` to use for the given `DayTime` instance. This may be the primary instance or a
     * child instance created by {@link #function-registerDayIndex}.
     * @param {Core.util.DayTime} dayTime The `DayTime` of the desired index.
     * @returns {Scheduler.data.util.EventDayIndex}
     * @private
     * @category Indexing
     */
    useDayIndex(dayTime) {
        const
            me             = this,
            { dayIndices } = me;

        dayTime = dayTime || MIDNIGHT;

        for (let i = 0; dayIndices && i < dayIndices.length; ++i) {
            if (dayIndices[i].matches(dayTime)) {
                return dayIndices[i];
            }
        }

        if (dayTime.startShift) {
            throw new Error(`No day index registered for ${dayTime} on ${me.id}`);
        }

        return me.registerDayIndex(MIDNIGHT);
    }

    //endregion
};
