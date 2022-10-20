import AbstractTimeRanges from './AbstractTimeRanges.js';
import GridFeatureManager from '../../Grid/feature/GridFeatureManager.js';
import DateHelper from '../../Core/helper/DateHelper.js';
import AttachToProjectMixin from '../data/mixin/AttachToProjectMixin.js';

/**
 * @module Scheduler/feature/TimeRanges
 */

/**
 * Feature that renders global ranges of time in the timeline. Use this feature to visualize a `range` like a 1 hr lunch or some important point in time
 * (a `line`, i.e. a range with 0 duration). This feature can also show a current time indicator if you set {@link #config-showCurrentTimeLine} to true. To style
 * the rendered elements, use the {@link Scheduler.model.TimeSpan#field-cls cls} field of the `TimeSpan` class.
 *
 * Each time range is represented by an instances of {@link Scheduler.model.TimeSpan}, held in a simple {@link Core.data.Store}.
 * The feature uses {@link Scheduler/model/ProjectModel#property-timeRangeStore} defined on the project.
 * The store/persisting loading is handled by Crud Manager (if it's used by the component).
 *
 * This feature is **off** by default. For info on enabling it, see {@link Grid.view.mixin.GridFeatures}.
 *
 * ## Showing an icon in the time range header
 *
 * You can use Font Awesome icons easily (or set any other icon using CSS) by using the {@link Scheduler.model.TimeSpan#field-cls cls}
 * field. The JSON data below will show a flag icon:
 *
 * ```json
 * {
 *     "id"        : 5,
 *     "cls"       : "b-fa b-fa-flag",
 *     "name"      : "v5.0",
 *     "startDate" : "2019-02-07 15:45"
 * },
 * ```
 *
 * ## Recurring time ranges
 *
 * The feature supports recurring ranges in case the provided store and models
 * have {@link Scheduler/data/mixin/RecurringTimeSpansMixin} and {@link Scheduler/model/mixin/RecurringTimeSpan}
 * mixins applied:
 *
 * ```javascript
 * // We want to use recurring time ranges so we make a special model extending standard TimeSpan model with
 * // RecurringTimeSpan which adds recurrence support
 * class MyTimeRange extends RecurringTimeSpan(TimeSpan) {}
 *
 * // Define a new store extending standard Store with RecurringTimeSpansMixin mixin to add recurrence support to the
 * // store. This store will contain time ranges.
 * class MyTimeRangeStore extends RecurringTimeSpansMixin(Store) {
 *     static get defaultConfig() {
 *         return {
 *             // use our new MyResourceTimeRange model
 *             modelClass : MyTimeRange
 *         };
 *     }
 * };
 *
 * // Instantiate store for timeRanges using our new classes
 * const timeRangeStore = new MyTimeRangeStore({
 *     data : [{
 *         id             : 1,
 *         resourceId     : 'r1',
 *         startDate      : '2019-01-01T11:00',
 *         endDate        : '2019-01-01T13:00',
 *         name           : 'Lunch',
 *         // this time range should repeat every day
 *         recurrenceRule : 'FREQ=DAILY'
 *     }]
 * });
 *
 * const scheduler = new Scheduler({
 *     ...
 *     features : {
 *         timeRanges : true
 *     },
 *
 *     crudManager : {
 *         // store for "timeRanges" feature
 *         timeRangeStore
 *     }
 * });
 * ```
 *
 * @extends Scheduler/feature/AbstractTimeRanges
 * @classtype timeRanges
 * @feature
 * @demo Scheduler/timeranges
 * @inlineexample Scheduler/feature/TimeRanges.js
 */
export default class TimeRanges extends AbstractTimeRanges.mixin(AttachToProjectMixin) {
    //region Config

    static get $name() {
        return 'TimeRanges';
    }

    static get defaultConfig() {
        return {
            store : true,

            /**
             * The interval (as amount of ms) defining how frequently the current timeline will be updated
             * @config {Number}
             * @default
             */
            currentTimeLineUpdateInterval : 10000,

            /**
             * The date format to show in the header for the current time line (when {@link #config-showCurrentTimeLine} is configured).
             * See {@link Core.helper.DateHelper} for the possible formats to use.
             * @config {String}
             * @default
             */
            currentDateFormat : 'HH:mm',

            /**
             * Show a line indicating current time. Either `true` or `false` or a {@link Scheduler.model.TimeSpan} configuration object to apply to this
             * special time range (allowing you to provide a custom text):
             *
             * ```javascript
             * showCurrentTimeLine : {
             *     name : 'Now'
             * }
             * ```
             *
             * The line carries the CSS class name `b-sch-current-time`, and this may be used to add custom styling to the current time line.
             *
             * @config {Boolean|Object}
             * @default
             */
            showCurrentTimeLine : false
        };
    }

    //endregion

    //region Init & destroy

    construct(client, config = {}) {
        super.construct(client, config);

        if (!client._timeRangesExposed) {
            // expose getter/setter for timeRanges on scheduler/gantt
            Object.defineProperty(client, 'timeRanges', {
                get : () => this.timeRanges,
                set : timeRanges => client.project.timeRangeStore.data = timeRanges
            });
            client._timeRangesExposed = true;
        }

        // Pull in the timeRanges config before the store config if it exists.
        this.getConfig('timeRanges');
    }

    /**
     * Returns the TimeRanges which occur within the client Scheduler's time axis.
     * @property {Scheduler.model.TimeSpan[]}
     */
    get timeRanges() {
        const
            { store }   = this,
            { records } = store;

        if (store.recurringEvents) {
            const
                result = [],
                {
                    startDate,
                    endDate
                } = this.client.timeAxis;

            // Collect occurrences for the recurring events in the record set
            records.forEach(timeSpan => {
                if (timeSpan.isRecurring) {
                    result.push.apply(result, timeSpan.getOccurrencesForDateRange(startDate, endDate));
                }
                else {
                    result.push(timeSpan);
                }
            });

            return result;
        }

        return records;
    }
    //endregion

    //region Current time line

    initCurrentTimeLine() {
        const me = this;

        if (me.currentTimeLine || !me.showCurrentTimeLine) {
            return;
        }

        const data = typeof me.showCurrentTimeLine === 'object' ? me.showCurrentTimeLine : {};

        me.currentTimeLine = me.store.modelClass.new({
            // eslint-disable-next-line quote-props
            'id' : 'currentTime',
            cls  : 'b-sch-current-time'
        }, data);

        me.updateCurrentTimeLine = me.updateCurrentTimeLine.bind(me);

        me.currentTimeInterval = me.setInterval(me.updateCurrentTimeLine, me.currentTimeLineUpdateInterval);
        me.updateCurrentTimeLine();

        if (me.client.isPainted) {
            me.renderRanges();
        }
    }

    updateCurrentTimeLine() {
        const
            me                = this,
            currentTimeRecord = me.currentTimeLine;

        currentTimeRecord.startDate = new Date();

        if (!currentTimeRecord.originalData.name) {
            currentTimeRecord.name = DateHelper.format(currentTimeRecord.startDate, me.currentDateFormat);
        }

        me.onStoreChanged({ action : 'update', record : currentTimeRecord, changes : {} });
    }

    hideCurrentTimeLine() {
        const me = this;

        if (!me.currentTimeLine) {
            return;
        }

        me.clearInterval(me.currentTimeInterval);
        me.currentTimeLine = null;

        if (me.client.isPainted) {
            me.renderRanges();
        }
    }

    renderRanges() {
        const me = this;

        super.renderRanges();

        if (me.showCurrentTimeLine && !me.disabled) {
            me.renderRange(me.currentTimeLine, true);
        }
    }

    /**
     * Get/set the current time line display state
     * @property {Boolean}
     */
    get showCurrentTimeLine() {
        return this._showCurrentTimeLine;
    }

    set showCurrentTimeLine(show) {
        this._showCurrentTimeLine = show;

        if (show) {
            this.initCurrentTimeLine();
        }
        else {
            this.hideCurrentTimeLine();
        }
    }

    //endregion

    //region Menu items

    /**
     * Adds a menu item to show/hide current time line.
     * @param {Object} options Contains menu items and extra data retrieved from the menu target.
     * @param {Grid.column.Column} options.column Column for which the menu will be shown
     * @param {Object} options.items A named object to describe menu items
     * @internal
     */
    populateTimeAxisHeaderMenu({ column, items }) {
        items.currentTimeLine = {
            weight   : 400,
            text     : this.L('L{showCurrentTimeLine}'),
            checked  : this.showCurrentTimeLine,
            onToggle : ({ checked }) => {
                this.showCurrentTimeLine = checked;
            }
        };
    }

    //endregion

    //region Disable

    /**
     * Get/set the features disabled state
     * @property {Boolean}
     */
    get disabled() {
        return this._disabled;
    }

    set disabled(disabled) {
        this._disabled = disabled;

        if (this.client.isPainted) {
            this.renderRanges();
        }
    }

    attachToProject(project) {
        // If the client's project has a timeRangeStore, we must use that
        // unless we've configured feature with a store (e.g. with recurrence mixin)
        if (!this.hasOwnStore) {
            this.store = project.timeRangeStore;
        }
    }

    get store() {
        return this.client.project.timeRangeStore;
    }

    set store(store) {
        const
            me          = this,
            { client }  = me,
            { project } = client;

        store = project.timeRangeStore;

        me.attachToStore(store);

        // timeRanges can be set on scheduler/gantt, for convenience. Should only be processed by the TimeRanges and not
        // any subclasses
        if (client.timeRanges && !client._timeRangesExposed) {
            store.add(client.timeRanges);
            delete client.timeRanges;
        }
    }

    // Called by ProjectConsumer after a new store is assigned at runtime
    attachToTimeRangeStore(store) {
        this.store = store;
    }

    //endregion
}

GridFeatureManager.registerFeature(TimeRanges, false, ['Scheduler', 'Gantt']);
