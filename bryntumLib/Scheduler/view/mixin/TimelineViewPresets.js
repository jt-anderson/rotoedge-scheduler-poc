import Base from '../../../Core/Base.js';
import PresetManager from '../../preset/PresetManager.js';
import ObjectHelper from '../../../Core/helper/ObjectHelper.js';
import PresetStore from '../../preset/PresetStore.js';

/**
 * @module Scheduler/view/mixin/TimelineViewPresets
 */

const
    datesDiffer = (d1 = 0, d2 = 0) => d2 - d1;

/**
 * View preset handling.
 *
 * A Scheduler's {@link #config-presets} are loaded with a default set of {@link Scheduler.preset.ViewPreset ViewPresets}
 * which are defined by the system in the {@link Scheduler.preset.PresetManager PresetManager}.
 *
 * The zooming feature works by reconfiguring the Scheduler with a new {@link Scheduler.preset.ViewPreset ViewPreset} selected
 * from the {@link #config-presets} store.
 *
 * {@link Scheduler.preset.ViewPreset ViewPresets} can be added and removed from the store to change the amount of available steps.
 * Range of zooming in/out can be also modified with {@link Scheduler.view.mixin.TimelineZoomable#config-maxZoomLevel} / {@link Scheduler.view.mixin.TimelineZoomable#config-minZoomLevel} properties.
 *
 * This mixin adds additional methods to the column : {@link Scheduler.view.mixin.TimelineZoomable#property-maxZoomLevel}, {@link Scheduler.view.mixin.TimelineZoomable#property-minZoomLevel}, {@link Scheduler.view.mixin.TimelineZoomable#function-zoomToLevel}, {@link Scheduler.view.mixin.TimelineZoomable#function-zoomIn},
 * {@link Scheduler.view.mixin.TimelineZoomable#function-zoomOut}, {@link Scheduler.view.mixin.TimelineZoomable#function-zoomInFull}, {@link Scheduler.view.mixin.TimelineZoomable#function-zoomOutFull}.
 *
 * **Notice**: Zooming is not supported when `forceFit` option is set to true for the Scheduler or for filtered timeaxis.
 *
 * @mixin
 */
export default Target => class TimelineViewPresets extends (Target || Base) {
    static get $name() {
        return 'TimelineViewPresets';
    }

    //region Default config

    static get configurable() {
        return {
            /**
             * A string key used to lookup a predefined {@link Scheduler.preset.ViewPreset} (e.g. 'weekAndDay', 'hourAndDay'),
             * managed by {@link Scheduler.preset.PresetManager}. See {@link Scheduler.preset.PresetManager} for more information.
             * Or a config object for a viewPreset.
             *
             * Options:
             * - 'secondAndMinute'
             * - 'minuteAndHour'
             * - 'hourAndDay'
             * - 'dayAndWeek'
             * - 'weekAndDay'
             * - 'weekAndMonth',
             * - 'monthAndYear'
             * - 'year'
             * - 'manyYears'
             * - 'weekAndDayLetter'
             * - 'weekDateAndMonth'
             * - 'day'
             * - 'week'
             *
             * If passed as a config object, the settings from the viewPreset with the provided `base` property will be used along
             * with any overridden values in your object.
             *
             * To override:
             * ```javascript
             * viewPreset : {
             *   base    : 'hourAndDay',
             *   id      : 'myHourAndDayPreset',
             *   headers : [
             *       {
             *           unit      : "hour",
             *           increment : 12,
             *           renderer  : (startDate, endDate, headerConfig, cellIdx) => {
             *               return "";
             *           }
             *       }
             *   ]
             * }
             * ```
             * or set a new valid preset config if the preset is not registered in the {@link Scheduler.preset.PresetManager}.
             *
             * When you use scheduler in weekview mode, this config is used to pick view preset. If passed view preset is not
             * supported by weekview (only 2 supported by default - 'day' and 'week') default preset will be used - 'week'.
             * @config {String|Object}
             * @default
             * @category Common
             */
            viewPreset : 'weekAndDayLetter',

            /**
             * Get the {@link Scheduler.preset.PresetStore PresetStore} created for the Scheduler,
             * or set an array of {@link Scheduler.preset.ViewPreset ViewPreset} config objects.
             * @member {Scheduler.preset.PresetStore|Object[]} presets
             * @category Common
             */
            /**
             * An array of {@link Scheduler.preset.ViewPreset ViewPreset} config objects
             * which describes the available timeline layouts for this scheduler.
             *
             * By default, a predefined set is loaded from the {@link Scheduler.preset.PresetManager PresetManager}.
             *
             * A {@link Scheduler.preset.ViewPreset ViewPreset} describes the granularity of the
             * timeline view and the layout and subdivisions of the timeline header.
             * @config {Object[]} presets
             *
             * @category Common
             */
            presets : true
        };
    }

    static get defaultConfig() {
        return {
            /**
             * Defines how dates will be formatted in tooltips etc. This config has priority over similar config on the
             * view preset. For allowed values see {@link Core.helper.DateHelper#function-format-static}.
             * @config {String}
             * @category Scheduled events
             */
            displayDateFormat : null
        };
    }

    //endregion

    /**
     * Get/set the current view preset
     * @member {Scheduler.preset.ViewPreset|String} viewPreset
     * @param [viewPreset.options]
     * @param {Date} [viewPreset.options.startDate] A new start date for the time axis
     * @param {Date} [viewPreset.options.endDate] A new end date for the time axis
     * @param {Date} [viewPreset.options.centerDate] Where to center the new time axis
     * @category Common
    */

    //region Get/set

    changePresets(presets) {
        const config = {
            owner : this
        };

        // By default includes all presets
        if (presets === true) {
            config.data = PresetManager.allRecords;
        }
        // Accepts an array of presets
        else if (Array.isArray(presets)) {
            config.data = presets;
        }
        // Or a store config object
        else {
            ObjectHelper.assign(config, presets);
        }

        return new PresetStore(config);
    }

    changeViewPreset(viewPreset, oldViewPreset) {
        const
            me           = this,
            { presets } = me;

        if (viewPreset) {
            viewPreset = presets.createRecord(viewPreset);

            // If an existing ViewPreset id is used, this will replace it.
            presets.add(viewPreset);
        }
        else {
            viewPreset = presets.first;
        }

        const
            lastOpts = me.lastViewPresetOptions || {},
            options  = viewPreset.options || (viewPreset.options = {}),
            event    = options.event = {
                startDate : options.startDate,
                endDate   : options.endDate,
                from      : oldViewPreset,
                to        : viewPreset,
                preset    : viewPreset
            },
            presetChanged  = !me._viewPreset || !me._viewPreset.equals(viewPreset),
            optionsChanged = datesDiffer(options.startDate, lastOpts.startDate) ||
                datesDiffer(options.endDate, lastOpts.endDate) ||
                datesDiffer(options.centerDate, lastOpts.centerDate) ||
                (options.startDate && datesDiffer(options.startDate, me.startDate)) ||
                (options.endDate && datesDiffer(options.endDate, me.endDate));

        // Only return the value for onward processing if there's a change
        if (presetChanged || optionsChanged) {

            // Bypass the no-change check if the viewPreset is the same and we only got in here
            // because different options were asked for.
            if (!presetChanged) {
                me._viewPreset = null;
            }

            /**
             * Fired before the {@link #config-viewPreset} is changed.
             * @event beforePresetChange
             * @param {Scheduler.view.Scheduler} source This Scheduler instance.
             * @param {Date} startDate The new start date of the timeline.
             * @param {Date} endDate The new end date of the timeline.
             * @param {Scheduler.preset.ViewPreset} from The outgoing ViewPreset.
             * @param {Scheduler.preset.ViewPreset} to The ViewPreset being switched to.
             * @preventable
             */
            // Do not trigger events for the initial preset
            if (me.isConfiguring || me.trigger('beforePresetChange', event) !== false) {
                return viewPreset;
            }
        }
    }

    updateViewPreset(preset) {
        const
            me          = this,
            { options } = preset,
            {
                event,
                startDate,
                endDate
            }           = options,
            {
                isHorizontal,
                _timeAxis : timeAxis,    // Do not tickle the getter, we are just peeking to see if it's there yet.
                _timeAxisViewModel : timeAxisViewModel // Ditto
            } = me;

        let { centerDate } = options,
            forceUpdate    = false;

        // Raise flag to prevent partner from changing view preset if one is in progress
        me._viewPresetChanging = true;

        // prefer to use displayDateFormat configured on the panel
        me.displayDateFormat = me.config.displayDateFormat || preset.displayDateFormat;

        if (timeAxis && !me.isConfiguring) {
            // Cache options only when they are applied so that non-change vetoing in changeViewPreset is accurate
            me.lastViewPresetOptions = options;

            // Timeaxis may already be configured (in case of sharing with the timeline partner), no need to reconfigure it
            if (timeAxis.isConfigured) {
                // None of this reconfiguring should cause a refresh
                me.suspendRefresh();

                const timeAxisCfg = {
                    weekStartDay : me.weekStartDay,
                    startTime    : me.startTime,
                    endTime      : me.endTime
                };

                if (me.infiniteScroll) {
                    Object.assign(timeAxisCfg, timeAxisViewModel.calculateInfiniteScrollingDateRange(
                        centerDate,
                        true,
                        preset
                    ));
                }
                // if startDate is provided we use it and the provided endDate
                else if (startDate) {
                    timeAxisCfg.startDate = startDate;
                    timeAxisCfg.endDate = endDate;

                    // if both dates are provided we can calculate centerDate for the viewport
                    if (!centerDate && endDate) {
                        centerDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
                    }

                    // when no start/end dates are provided we use the current timespan
                }
                else {
                    timeAxisCfg.startDate = timeAxis.startDate;
                    timeAxisCfg.endDate = endDate || timeAxis.endDate;

                    if (!centerDate) {
                        centerDate = me.viewportCenterDate;
                    }
                }

                timeAxis.isConfigured = false;
                timeAxis.viewPreset = preset;
                timeAxis.reconfigure(timeAxisCfg, true);

                timeAxisViewModel.reconfigure({
                    viewPreset : preset,
                    headers    : preset.headers,

                    // This was hardcoded to 'middle' prior to the Preset refactor.
                    // In the old code, the default headers were 'top' and 'middle', which
                    // meant that 'middle' meant the lowest header.
                    // So this is now length - 1.
                    columnLinesFor : preset.columnLinesFor != null ? preset.columnLinesFor : preset.headers.length - 1,

                    tickSize : isHorizontal ? preset.tickWidth : preset.tickHeight || preset.tickWidth || 60
                });

                // Allow refresh to run after the reconfiguring, without refreshing since we will do that below anyway
                me.resumeRefresh(false);
            }

            me.refresh();

            // if view is rendered and scroll is not disabled by "notScroll" option
            if (!options.notScroll && me.isPainted) {
                // and we have centerDate to scroll to
                if (centerDate) {
                    // remember the central date we scroll to (it gets reset after user scroll)
                    me.cachedCenterDate = centerDate;

                    // setViewPreset method on a partner panels should be executed with same arguments.
                    // if one partner was provided with a centerDate, other one has to be too to generate exact
                    // header and set same scroll
                    event.centerDate = centerDate;

                    const
                        viewportSize = me.isHorizontal ? me.timeAxisSubGrid.width : me.scrollable.clientHeight,
                        coord        = Math.max(me.getCoordinateFromDate(centerDate, true) - viewportSize / 2, 0);

                    // The horizontal scroll handler must not invalidate the cached center
                    // when this scroll event rolls round on the next frame.
                    me.scrollingToCenter = true;

                    // If preset change does not lead to a scroll we have to "refresh" manually at the end
                    if (coord === (me.isHorizontal ? me.scrollLeft : me.scrollTop)) {
                        forceUpdate = true;
                    }
                    else if (me.isHorizontal) {
                        me.scrollHorizontallyTo(coord, false);
                    }
                    else {
                        me.scrollVerticallyTo(coord, false);
                    }

                    // Release the lock on scrolling invalidating the cached center.
                    me.setTimeout(() => {
                        me.scrollingToCenter = false;
                    }, 100);
                }
                else {
                    // If preset change does not lead to a scroll we have to "refresh" manually at the end
                    if ((me.isHorizontal ? me.scrollLeft : me.scrollTop) === 0) {
                        forceUpdate = true;
                    }
                    // If we don't have a center date to scroll to, we reset scroll (this is bw compatible behavior)
                    else {
                        me.timelineScroller.scrollTo(0);
                    }
                }
            }
        }

        // Update Scheduler element showing what preset is applied
        me.dataset.presetId = preset.id;

        /**
         * Fired after the {@link #config-viewPreset} has changed.
         * @event presetChange
         * @param {Scheduler.view.Scheduler} source This Scheduler instance.
         * @param {Date} startDate The new start date of the timeline.
         * @param {Date} centerDate The new center date of the timeline.
         * @param {Date} endDate The new end date of the timeline.
         * @param {Scheduler.preset.ViewPreset} from The outgoing ViewPreset.
         * @param {Scheduler.preset.ViewPreset} to The ViewPreset being switched to.
         * @preventable
         */
        me.trigger('presetChange', event);

        me._viewPresetChanging = false;

        if (forceUpdate) {
            if (me.isHorizontal) {
                me.currentOrientation.updateFromHorizontalScroll(me.scrollLeft, me.scrollX);
            }
            else {
                me.currentOrientation.updateFromVerticalScroll(me.scrollTop);
            }
        }
    }

    //endregion

    doDestroy() {
        if (this._presets.owner === this) {
            this._presets.destroy();
        }
        super.doDestroy();
    }

    // This function is not meant to be called by any code other than Base#getCurrentConfig().
    getCurrentConfig(options) {
        const result = super.getCurrentConfig(options);

        // Cannot store name, will not be allowed when reapplying
        if (result.viewPreset && result.viewPreset.name && !result.viewPreset.base) {
            delete result.viewPreset.name;
        }

        return result;
    }

    // This does not need a className on Widgets.
    // Each *Class* which doesn't need 'b-' + constructor.name.toLowerCase() automatically adding
    // to the Widget it's mixed in to should implement thus.
    get widgetClass() {}
};
