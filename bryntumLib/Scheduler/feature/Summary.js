import TimelineSummary from './TimelineSummary.js';
import GridFeatureManager from '../../Grid/feature/GridFeatureManager.js';
import ObjectHelper from '../../Core/helper/ObjectHelper.js';
import SchedulerBase from '../view/SchedulerBase.js';

/**
 * @module Scheduler/feature/Summary
 */

// noinspection JSClosureCompilerSyntax
/**
 * A special version of the Grid Summary feature. This feature displays a summary row in the grid footer.
 * For regular columns in the locked section - specify type of summary on columns, available types are:
 * <dl class="wide">
 * <dt>sum <dd>Sum of all values in the column
 * <dt>add <dd>Alias for sum
 * <dt>count <dd>Number of rows
 * <dt>countNotEmpty <dd>Number of rows containing a value
 * <dt>average <dd>Average of all values in the column
 * <dt>function <dd>A custom function, used with store.reduce. Should take arguments (sum, record)
 * </dl>
 * Columns can also specify a summaryRender to format the calculated sum.
 *
 * To summarize events, either provide a {@link #config-renderer} or use {@link #config-summaries}
 *
 * This feature is <strong>disabled</strong> by default.
 *
 * @extends Scheduler/feature/TimelineSummary
 * @classtype summary
 * @feature
 * @inlineexample Scheduler/feature/Summary.js
 * @demo Scheduler/summary
 * @typings Grid/feature/Summary -> Grid/feature/GridSummary
 */
export default class Summary extends TimelineSummary {
    //region Config

    static get $name() {
        return 'Summary';
    }

    static get configurable() {
        return {
            /**
             * Array of summary configs which consists of a label and a {@link #config-renderer} function
             *
             * ```javascript
             * new Scheduler({
             *     features : {
             *         summary : {
             *             summaries : [
             *                 {
             *                     label : 'Label',
             *                     renderer : ({ startDate, endDate, eventStore, resourceStore, events, element }) => {
             *                         // return display value
             *                         returns '<div>Renderer output</div>';
             *                     }
             *                 }
             *             ]
             *         }
             *     }
             * });
             * ```
             *
             * @config {Object[]}
             */
            summaries : null,

            /**
             * Renderer function for a single time axis tick. Should calculate a sum and return HTML as a result.
             *
             * ```javascript
             * new Scheduler({
             *     features : {
             *         summary : {
             *             renderer : ({ startDate, endDate, eventStore, resourceStore, events, element }) => {
             *                 // return display value
             *                 returns '<div>Renderer output</div>';
             *             }
             *         }
             *     }
             * });
             * ```
             *
             * @param {Date} startDate Tick start date
             * @param {Date} endDate Tick end date
             * @param {Scheduler.model.EventModel[]} events Events which belong to the group
             * @param {Scheduler.data.EventStore} eventStore Event store
             * @param {Scheduler.data.ResourceStore} resourceStore Resource store
             * @param {HTMLElement} element Summary tick container
             * @returns {String} Html content
             * @config {Function}
             */
            renderer : null,

            /**
             * A config object for the {@link Grid.column.Column} used to contain the summary bar.
             * @config {ColumnConfig}
             */
            verticalSummaryColumnConfig : null
        };
    }

    // Plugin configuration. This plugin chains some of the functions in Grid.
    static get pluginConfig() {
        const config = super.pluginConfig;

        config.chain.push('bindStore', 'updateEventStore', 'updateResourceStore');

        return config;
    }

    //endregion

    //region Init

    construct(scheduler, config) {
        const me = this;

        me.scheduler = scheduler;

        if (scheduler.isVertical) {
            scheduler.timeAxisSubGrid.resizable = false;

            config.hideFooters = true;

            scheduler.add(scheduler.createSubGrid('right'));

            me.summaryColumn = scheduler.columns.add(ObjectHelper.assign({
                filterable              : null,
                region                  : 'right',
                cellCls                 : 'b-grid-footer b-sch-summarybar',
                align                   : 'center',
                sortable                : false,
                groupable               : false,
                htmlEncode              : false,
                enableHeaderContextMenu : false,
                hidden                  : me.disabled
            }, me.verticalSummaryColumnConfig))[0];
        }

        super.construct(scheduler, config);

        // Feature might be run from Grid (in docs), should not crash
        // https://app.assembla.com/spaces/bryntum/tickets/6801/details
        if (scheduler instanceof SchedulerBase) {
            me.updateEventStore(scheduler.eventStore);
            me.updateResourceStore(scheduler.resourceStore);
        }
    }

    //endregion

    //region Render

    updateEventStore(eventStore) {
        this.detachListeners('summaryEventStore');

        eventStore.on({
            name    : 'summaryEventStore',
            filter  : 'updateTimelineSummaries',
            thisObj : this
        });
    }

    updateResourceStore(resourceStore) {
        this.detachListeners('summaryResourceStore');

        resourceStore.on({
            name    : 'summaryResourceStore',
            filter  : 'updateTimelineSummaries',
            thisObj : this
        });
    }

    /**
     * Updates summaries.
     * @private
     */
    updateTimelineSummaries() {
        const
            me                       = this,
            { client: timeline }     = me,
            { eventStore, timeAxis } = timeline,
            summaryContainer         = me.summaryBarElement,
            forResources             = (me.selectedOnly && timeline.selectedRecords.length)
                ? timeline.selectedRecords : timeline.resourceStore.records;

        if (summaryContainer && timeline.isEngineReady) {
            // group events by ticks info once here to avoid performance lags
            // should be inside `scheduler.isEngineReady` check to make sure all events were calculated
            // https://github.com/bryntum/support/issues/2977
            const eventsByTick = timeline.getResourcesEventsPerTick(forResources, ({ event }) => {
                return !eventStore.isFiltered || eventStore.records.includes(event);
            });

            Array.from(summaryContainer.children).forEach((element, i) => {
                const
                    tick   = timeAxis.getAt(i),
                    events = eventsByTick[i] || [];

                let html    = '',
                    tipHtml = `<header>${me.L('L{Summary for}', timeline.getFormattedDate(tick.startDate))}</header>`;

                me.summaries.forEach(config => {
                    const value     = config.renderer({
                            startDate     : tick.startDate,
                            endDate       : tick.endDate,
                            resourceStore : timeline.resourceStore,
                            eventStore,
                            events,
                            element
                        }),
                        valueHtml = value ? `<div class="b-timeaxis-summary-value">${value}</div>` : '';

                    if (me.summaries.length > 1 || value) {
                        html += valueHtml;
                    }

                    tipHtml += valueHtml ? (`<label>${config.label || ''}</label>` + valueHtml) : '';
                });

                element.innerHTML = html;
                // Only show tooltips for summary cells with content
                element._tipHtml  = html ? tipHtml : '';
            });
        }
    }
}

// Override Grids Summary with this improved version
GridFeatureManager.registerFeature(Summary, false, 'Scheduler');
