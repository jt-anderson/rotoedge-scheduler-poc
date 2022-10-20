import GridSummary from '../../Grid/feature/Summary.js';
import Tooltip from '../../Core/widget/Tooltip.js';

/**
 * @module Scheduler/feature/TimelineSummary
 */

// noinspection JSClosureCompilerSyntax
/**
 * Base class, not to be used directly.
 * @extends Grid/feature/Summary
 * @abstract
 */
export default class TimelineSummary extends GridSummary {
    //region Config

    static get $name() {
        return 'TimelineSummary';
    }

    static get configurable() {
        return {
            /**
             * Show tooltip containing summary values and labels
             * @config {Boolean}
             * @default
             */
            showTooltip : true
        };
    }

    // Plugin configuration. This plugin chains some of the functions in Grid.
    static get pluginConfig() {
        return {
            chain : ['renderRows', 'updateProject']
        };
    }

    //endregion

    //region Init

    construct(client, config) {
        const me = this;

        super.construct(client, config);

        if (!me.summaries) {
            me.summaries = [{ renderer : me.renderer }];
        }

        // Feature might be run from Grid (in docs), should not crash
        // https://app.assembla.com/spaces/bryntum/tickets/6801/details
        if (client.isTimelineBase) {
            me.updateProject(client.project);

            client.on({
                timeAxisViewModelUpdate : me.renderRows,
                thisObj                 : me
            });
        }
    }

    //endregion

    //region Render

    updateProject(project) {
        this.detachListeners('summaryProject');

        project.on({
            name      : 'summaryProject',
            dataReady : 'updateTimelineSummaries',
            thisObj   : this
        });
    }

    renderRows() {
        if (this.client.isHorizontal) {
            this.client.timeAxisSubGrid.footer.element.querySelector('.b-grid-footer').classList.add('b-sch-summarybar');
        }

        super.renderRows();

        if (!this.disabled) {
            this.render();
        }
    }

    get summaryBarElement() {
        return this.client.element.querySelector('.b-sch-summarybar');
    }

    render() {
        const
            me                   = this,
            { client: timeline } = me,
            sizeProp             = timeline.isHorizontal ? 'width' : 'height',
            colCfg               = timeline.timeAxisViewModel.columnConfig,
            summaryContainer     = me.summaryBarElement;

        if (summaryContainer) {
            // if any sum config has a label, init tooltip
            if (!me._tip && me.showTooltip && me.summaries.some(config => config.label)) {
                me._tip = new Tooltip({
                    id             : `${timeline.id}-summary-tip`,
                    cls            : 'b-timeaxis-summary-tip',
                    hoverDelay     : 0,
                    hideDelay      : 100,
                    forElement     : summaryContainer,
                    anchorToTarget : true,
                    trackMouse     : false,
                    forSelector    : '.b-timeaxis-tick',
                    getHtml        : ({ activeTarget }) => activeTarget._tipHtml
                });
            }

            summaryContainer.innerHTML = colCfg[colCfg.length - 1].map(col => `<div class="b-timeaxis-tick" style="${sizeProp}: ${col.width}px"></div>`).join('');

            me.updateTimelineSummaries();
        }
    }

    //endregion

    /**
     * Refreshes the summaries
     */
    refresh() {
        super.refresh();
        this.updateTimelineSummaries();
    }

    doDisable(disable) {
        const { isConfiguring } = this.client;

        super.doDisable(disable);

        this.summaryColumn?.toggle(!disable);

        if (!isConfiguring && !disable) {
            this.render();
        }
    }

    doDestroy() {
        this._tip?.destroy();
        super.doDestroy();
    }
}
