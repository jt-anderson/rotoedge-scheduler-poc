import { Mixin } from "../../../../ChronoGraph/class/BetterMixin.js";
import { CorePartOfProjectModelMixin } from "../mixin/CorePartOfProjectModelMixin.js";
import DateHelper from "../../../../Core/helper/DateHelper.js";
/**
 * Core event entity mixin type.
 *
 * At this level event is only aware about its dates
 * The functionality, related to the assignments etc is provided in other mixins.
 */
export class CoreEventMixin extends Mixin([CorePartOfProjectModelMixin], (base) => {
    const superProto = base.prototype;
    class CoreEventMixin extends base {
        constructor() {
            super(...arguments);
            this._startDate = null;
            this._endDate = null;
            this._duration = null;
        }
        // Proper engine defines these fields since they enter graph, thus we need them
        static get fields() {
            return [
                { name: 'startDate', type: 'date' },
                { name: 'endDate', type: 'date' },
                { name: 'duration', type: 'number' },
                { name: 'durationUnit', type: 'durationunit', defaultValue: 'day' }
            ];
        }
        // Getters return current or proposed value
        get startDate() { return this._startDate ?? this.get('startDate') ?? null; }
        get endDate() { return this._endDate ?? this.get('endDate') ?? null; }
        get duration() { return this._duration ?? this.get('duration') ?? null; }
        // Route all setting through applyXX (setStartDate, startDate = , set('startDate'), batching)
        set startDate(value) { this.proposeStartDate(value); }
        set endDate(value) { this.proposeEndDate(value); }
        set duration(value) { this.proposeDuration(value); }
        //region Edge case normalization
        inSet(field, ...args) {
            const me = this;
            if (me.project && typeof field !== 'string') {
                const setStartDate = 'startDate' in field;
                const setEndDate = 'endDate' in field;
                const setDuration = 'duration' in field;
                // When given a start and end date but no duration we expect the duration to be calculated, but if
                // the supplied end date equals the current end date it will be considered a no-op and it will
                // erroneously keep the duration
                if (setStartDate && setEndDate && !setDuration) {
                    // @ts-ignore
                    const startDate = CoreEventMixin.processField('startDate', field.startDate, me);
                    // @ts-ignore
                    const endDate = CoreEventMixin.processField('endDate', field.endDate, me);
                    if (startDate?.getTime() !== me.startDate?.getTime() && endDate?.getTime() === me.endDate?.getTime()) {
                        me.proposeDuration(null);
                        me.proposeEndDate(field.endDate);
                    }
                }
                // When given a duration and end date but no start we expect the duration to be calculated, but if
                // the supplied end date equals the current end date it will be considered a no-op and it will
                // erroneously keep the start date
                if (!setStartDate && setEndDate && setDuration) {
                    // @ts-ignore
                    const endDate = CoreEventMixin.processField('endDate', field.endDate, me);
                    if (field.duration !== me.duration && endDate?.getTime() === me.endDate?.getTime()) {
                        me.proposeStartDate(null);
                        me.proposeEndDate(field.endDate);
                    }
                }
            }
            // @ts-ignore
            return superProto.inSet.call(me, field, ...args);
        }
        //endregion
        //region StartDate
        getStartDate() {
            return this.startDate;
        }
        proposeStartDate(startDate, keepDuration = true) {
            this._startDate = startDate;
            this.propose({ startDate, keepDuration });
        }
        async setStartDate(startDate, keepDuration = true) {
            this.proposeStartDate(startDate, keepDuration);
            return this.project?.commitAsync();
        }
        //endregion
        //region EndDate
        getEndDate() {
            return this.endDate;
        }
        proposeEndDate(endDate, keepDuration = false) {
            this._endDate = endDate;
            this.propose({ endDate, keepDuration });
        }
        async setEndDate(endDate, keepDuration = false) {
            this.proposeEndDate(endDate, keepDuration);
            return this.project?.commitAsync();
        }
        //endregion
        //region Duration
        getDuration() {
            return this.duration;
        }
        proposeDuration(duration, unit, keepStart = true) {
            this._duration = duration;
            this.propose({ duration, keepStart });
            if (unit)
                this.propose({ durationUnit: unit });
        }
        async setDuration(duration, unit, keepStart = true) {
            this.proposeDuration(duration, unit, keepStart);
            return this.project?.commitAsync();
        }
        getDurationUnit() {
            return this.durationUnit;
        }
        //endregion
        // When joining as part of inline data, store is available. If joining through load, it is passed
        joinProject() {
            const me = this;
            const changed = me.$changed;
            const startDate = me.getCurrentOrProposed('startDate');
            const endDate = me.getCurrentOrProposed('endDate');
            const duration = me.getCurrentOrProposed('duration');
            // Initial values should be considered changed, to be normalized
            if (startDate != null)
                changed.startDate = me._startDate = startDate;
            if (endDate != null)
                changed.endDate = me._endDate = endDate;
            if (duration != null)
                changed.duration = me._duration = duration;
            // Resolve assignments when event joins project after load
            if (me.eventStore && !me.eventStore.isLoadingData) {
                const unresolved = me.assignmentStore?.storage.findItem('event', null);
                if (unresolved) {
                    // To avoid n² iterations over raw assignments we cache them by raw eventId, which saves us
                    // some iterations over the storage
                    // https://github.com/bryntum/support/issues/3141
                    const cachedAssignments = me.assignmentStore?.storage.findItem('eventId', me.id);
                    if (cachedAssignments) {
                        for (const assignment of cachedAssignments) {
                            assignment.setChanged('event', me);
                        }
                    }
                    else {
                        for (const assignment of unresolved) {
                            if (assignment.getCurrentOrProposed('event') === me.id) {
                                assignment.setChanged('event', me);
                            }
                        }
                    }
                }
            }
            superProto.joinProject.call(me);
        }
        // Mimic how proper engine applies values
        applyValue(useProp, key, value, skipAccessors, field) {
            // @ts-ignore
            if (this.project || this.recurringTimeSpan?.project) {
                if (key === 'startDate' || key == 'duration' || key === 'endDate') {
                    useProp = true;
                    // Update cached value
                    this['_' + key] = value;
                }
                if (skipAccessors) {
                    useProp = false;
                }
            }
            superProto.applyValue.call(this, useProp, key, value, skipAccessors, field);
        }
        // Catch changes from batches etc. In which case it is sometimes expected for data to be available directly
        afterChange(toSet, wasSet, silent, fromRelationUpdate, skipAccessors) {
            if (!this.$isCalculating && !skipAccessors) {
                // In certain scenarios data is expected to be available of the bat, messy!
                this.setData(this.$changed);
            }
            superProto.afterChange.call(this, toSet, wasSet, silent, fromRelationUpdate, skipAccessors);
        }
        // Normalizes dates & duration
        calculateInvalidated() {
            const me = this;
            const changed = me.$changed;
            const changedStart = 'startDate' in changed;
            const changedEnd = 'endDate' in changed;
            const changedDuration = 'duration' in changed;
            const { startDate, endDate, duration, keepDuration, keepStart } = changed;
            let calculate = null;
            // Only start changed
            if (changedStart && !changedEnd && !changedDuration) {
                // Also null end when nulling start (keeping duration)
                if (startDate === null) {
                    changed.endDate = null;
                }
                // Start after end without keeping duration -> move end to start
                else if (me.hasCurrentOrProposed('endDate') && startDate > me.getCurrentOrProposed('endDate') && !keepDuration) {
                    changed.endDate = startDate;
                    changed.duration = 0;
                }
                // Start changed and we either have a duration that we want to keep or no end -> calculate end
                else if (me.hasCurrentOrProposed('duration') && (keepDuration || !me.hasCurrentOrProposed('endDate'))) {
                    calculate = 'endDate';
                }
                // Start change and we have an end already -> calculate duration
                else if (me.hasCurrentOrProposed('endDate')) {
                    calculate = 'duration';
                }
            }
            // Only end changed
            else if (!changedStart && changedEnd && !changedDuration) {
                // Also null start when nulling end (keeping duration)
                if (endDate === null) {
                    changed.startDate = null;
                }
                // End before start without keeping duration -> move start to end
                else if (me.hasCurrentOrProposed('startDate') && endDate < me.getCurrentOrProposed('startDate') && !keepDuration) {
                    changed.startDate = endDate;
                    changed.duration = 0;
                }
                // End changed and we either have a duration that we want to keep or no start -> calculate start
                else if (me.hasCurrentOrProposed('duration') && (keepDuration || !me.hasCurrentOrProposed('startDate'))) {
                    calculate = 'startDate';
                }
                // End changed and we have a start already -> calculate duration
                else if (me.hasCurrentOrProposed('startDate')) {
                    calculate = 'duration';
                }
            }
            // Only duration changed
            else if (!changedStart && !changedEnd && changedDuration) {
                // Also null end when nulling duration (keeping start)
                if (duration === null) {
                    changed.endDate = null;
                }
                // Duration changed and we either have a start that we want to keep or no end -> calculate end
                else if (me.hasCurrentOrProposed('startDate') && (keepStart || !me.hasCurrentOrProposed('endDate'))) {
                    if (keepStart && changed.duration < 0) {
                        changed.duration = 0;
                    }
                    calculate = 'endDate';
                }
                // Duration changed and we have an end already -> calculate start
                else if (me.hasCurrentOrProposed('endDate')) {
                    calculate = 'startDate';
                }
            }
            // Start and end change, affect duration
            else if (changedStart && changedEnd && !changedDuration) {
                // Both nulled, null duration
                if (startDate === null && endDate === null) {
                    changed.duration = null;
                }
                // Other cases -> calculate duration
                else {
                    calculate = 'duration';
                }
            }
            // Start and duration change -> calculate end
            else if (changedStart && !changedEnd && changedDuration) {
                calculate = 'endDate';
            }
            // End and duration changed -> calculate start
            else if (!changedStart && changedEnd && changedDuration) {
                calculate = 'startDate';
            }
            // All changed -> calculate whichever is null or by default end to be sure things add up
            else if (changedStart && changedEnd && changedDuration) {
                if (duration == null) {
                    calculate = 'duration';
                }
                else if (startDate == null) {
                    calculate = 'startDate';
                }
                else {
                    calculate = 'endDate';
                }
            }
            // Normalize if needed
            const currentOrProposedStartDate = me.getCurrentOrProposed('startDate');
            const currentOrProposedEndDate = me.getCurrentOrProposed('endDate');
            const currentOrProposedDuration = me.getCurrentOrProposed('duration');
            const currentOrProposedDurationUnit = me.getCurrentOrProposed('durationUnit');
            let hourDuration, targetDuration;
            switch (calculate) {
                case 'startDate':
                    changed.startDate = DateHelper.add(currentOrProposedEndDate, -currentOrProposedDuration, currentOrProposedDurationUnit);
                    break;
                case 'endDate':
                    // convert proposed duration to hours to safely add over DST
                    hourDuration = DateHelper.as('hour', currentOrProposedDuration, currentOrProposedDurationUnit);
                    // convert calculated duration to task duration in task duration unit
                    targetDuration = DateHelper.as(currentOrProposedDurationUnit, hourDuration, 'h');
                    changed.endDate = DateHelper.add(currentOrProposedStartDate, targetDuration, currentOrProposedDurationUnit);
                    break;
                case 'duration':
                    // convert proposed duration to hours to safely add over DST
                    hourDuration = DateHelper.diff(currentOrProposedStartDate, currentOrProposedEndDate, 'h');
                    // convert calculated duration to task duration in task duration unit
                    changed.duration = DateHelper.as(currentOrProposedDurationUnit, hourDuration, 'h');
                    break;
            }
            if (changed.startDate !== undefined)
                this._startDate = changed.startDate;
            if (changed.endDate !== undefined)
                this._endDate = changed.endDate;
            if (changed.duration !== undefined)
                this._duration = changed.duration;
            delete changed.keepDuration;
            delete changed.keepStart;
        }
    }
    return CoreEventMixin;
}) {
}
