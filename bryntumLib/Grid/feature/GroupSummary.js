import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from '../feature/GridFeatureManager.js';
import SummaryFormatter from './mixin/SummaryFormatter.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import ObjectHelper from '../../Core/helper/ObjectHelper.js';

/**
 * @module Grid/feature/GroupSummary
 */

/**
 * Displays a summary row as a group footer in a grouped grid. Uses same configuration options on columns as
 * {@link Grid.feature.Summary}.
 *
 * This feature is <strong>disabled</strong> by default.
 *
 * ```
 * features : {
 *     group        : 'city',
 *     groupSummary : true
 * }
 * ```
 *
 * @extends Core/mixin/InstancePlugin
 *
 * @demo Grid/groupsummary
 * @classtype groupSummary
 * @feature
 *
 * @inlineexample Grid/feature/GroupSummary.js
 */
export default class GroupSummary extends SummaryFormatter(InstancePlugin) {
    //region Init

    static get $name() {
        return 'GroupSummary';
    }

    static get configurable() {
        return {
            /**
             * Set to `true` to have group summaries rendered in the group header when a group is collapsed.
             *
             * Only applies when {@link #config-target} is `'footer'` (the default).
             *
             * @member {Boolean} collapseToHeader
             */
            /**
             * Configure as `true` to have group summaries rendered in the group header when a group is collapsed.
             *
             * ```javascript
             * const grid = new Grid({
             *    features : {
             *        groupSummary : {
             *            collapseToHeader : true
             *        }
             *    }
             * });
             * ```
             *
             * Only applies when {@link #config-target} is `'footer'` (the default).
             *
             * @config {Boolean}
             */
            collapseToHeader : null,

            /**
             * Where to render the group summaries to, either `header` to display them in the group header or `footer`
             * to display them in the group footer (the default).
             *
             * @member {'header'|'footer'} target
             */
            /**
             * Where to render the group summaries to, either `header` to display them in the group header or `footer`
             * to display them in the group footer (the default).
             *
             * ```javascript
             * const grid = new Grid({
             *    features : {
             *        groupSummary : {
             *            target : 'header'
             *        }
             *    }
             * });
             * ```
             *
             * @config {'header'|'footer'}
             * @default
             */
            target : 'footer'
        };
    }

    construct(grid, config) {
        this.grid = grid;

        super.construct(grid, config);

        if (!grid.features.group) {
            throw new Error('Requires Group feature to work, please enable');
        }

        this.bindStore(grid.store);

        grid.rowManager.on({
            beforeRenderRow : 'onBeforeRenderRow',
            renderCell      : 'renderCell',

            // The feature gets to see cells being rendered after the Group feature
            // because the Group feature injects header content into group header rows
            // and adds rendering info to the cells renderData which we must comply with.
            // In particular, it calculates the isFirstColumn flag which it adds to
            // the cell renderData which we interrogate.
            prio    : 1000,
            thisObj : this
        });
    }

    bindStore(store) {
        this.detachListeners('store');

        store.on({
            name    : 'store',
            update  : 'onStoreUpdate',
            // need to run before grids listener, to flag for full refresh
            prio    : 1,
            thisObj : this
        });
    }

    get store() {
        return this.grid.store;
    }

    doDisable(disable) {
        // Toggle footers if needed
        this.updateTarget(this.target);

        super.doDisable(disable);
    }

    changeTarget(target) {
        ObjectHelper.assertString(target, 'target');

        return target;
    }

    updateTarget(target) {
        // Flag that will make the Store insert rows for group footers
        this.store.useGroupFooters = !this.disabled && target === 'footer';

        // Refresh groups to show/hide footers
        if (!this.isConfiguring) {
            this.store.group();
        }
    }

    changeCollapseToHeader(collapseToHeader) {
        ObjectHelper.assertBoolean(collapseToHeader, 'collapseToHeader');

        return collapseToHeader;
    }

    updateCollapseToHeader() {
        if (!this.isConfiguring) {
            this.store.group();
        }
    }

    //endregion

    //region Plugin config

    // Plugin configuration. This plugin chains some of the functions in Grid.
    static get pluginConfig() {
        return {
            chain : ['bindStore']
        };
    }

    //endregion

    //region Render

    /**
     * Called before rendering row contents, used to reset rows no longer used as group summary rows
     * @private
     */
    onBeforeRenderRow({ row, record }) {
        if (row.isGroupFooter && !('groupFooterFor' in record.meta)) {
            // not a group row.
            row.isGroupFooter = false;
            // force full "redraw" when rendering cells
            row.forceInnerHTML = true;
        }
        else if (row.isGroupHeader && !record.meta.collapsed) {
            // remove any summary elements
            row.eachElement(this.removeSummaryElements);
        }
    }

    removeSummaryElements(rowEl) {}

    /**
     * Called when a cell is rendered, styles the group rows first cell.
     * @private
     */
    renderCell({ column, cellElement, row, record, size, isFirstColumn }) {
        const
            me            = this,
            { meta }      = record,
            { rowHeight } = me.grid,
            isGroupHeader = 'groupRowFor' in meta,
            isGroupFooter = 'groupFooterFor' in meta,
            targetsHeader = me.target === 'header',
            rowClasses    = {
                'b-group-footer'   : 0,
                'b-header-summary' : 0
            },
            isSummaryTarget =
                // Header cell should have summary content if we are targeting the header or if the group is collapsed
                // and we are configured with collapseToHeader, excluding the first column which holds the group title
                (isGroupHeader && (targetsHeader || me.collapseToHeader && meta.collapsed) && !isFirstColumn) ||
                // Footer cell should have summary content if we are targeting the footer (wont render if collapsed)
                (isGroupFooter && !targetsHeader);

        // Needed to restore height when summary is no longer displayed
        if (isGroupHeader || isGroupFooter) {
            size.height = rowHeight;
        }

        if (me.store.isGrouped && isSummaryTarget && !me.disabled) {
            // clear cell before add any HTML in it. if the cell contained widgets, they will be properly destroyed.
            column.clearCell(cellElement);

            const groupRecord = isGroupHeader ? record : meta.groupRecord;

            row.isGroupFooter = isGroupFooter;
            row.isGroupHeader = isGroupHeader;

            // This is a group footer row, add css
            if (isGroupFooter) {
                rowClasses['b-group-footer'] = 1;
            }
            // This is a group header row, add css
            else {
                rowClasses['b-header-summary'] = 1;
            }

            // returns height config or count. config format is { height, count }. where `height is in px and should be
            // added to value calculated from `count
            const
                heightSetting = me.updateSummaryHtml(cellElement, column, groupRecord),
                count         = typeof heightSetting === 'number' ? heightSetting : heightSetting.count;

            // number of summaries returned, use to calculate cell height
            if (count > 1) {
                size.height += (meta.collapsed && !targetsHeader ? 0 : count * rowHeight * 0.1);
            }

            // height config with height specified, added to cell height
            if (heightSetting.height) {
                size.height += heightSetting.height;
            }
        }

        // Sync row's classes with its status as a group header or footer.
        row.assignCls(rowClasses);
    }

    updateSummaryHtml(cellElement, column, groupRecord) {
        const records = groupRecord.groupChildren.slice();

        // Group footers should not be included in summary calculations
        if (records[records.length - 1].isGroupFooter) {
            records.pop();
        }

        const html = this.generateHtml(column, records, 'b-grid-group-summary', groupRecord, groupRecord.meta.groupField, groupRecord.meta.groupRowFor);

        // First time, set table
        if (!cellElement.children.length) {
            cellElement.innerHTML = html;
        }
        // Following times, sync changes
        else {
            DomHelper.sync(html, cellElement.firstElementChild);
        }

        // return summary "count", used to set row height
        return column.summaries ? column.summaries.length : column.sum ? 1 : 0;
    }

    //endregion

    //region Events

    /**
     * Updates summaries on store changes (except record update, handled below)
     * @private
     */
    onStoreUpdate({ source : store, changes }) {
        if (!this.disabled && store.isGrouped) {
            // If a grouping field is among the changes, StoreGroup#onDataChanged will
            // take care of the update by re-sorting.
            if (changes && store.groupers.find(grouper => grouper.field in changes)) {
                return;
            }
            // only update summary when a field that affects summary is changed
            // TODO: this should maybe be removed, another column might depend on the value for its summary?
            const shouldUpdate = Object.keys(changes).some(field => {
                const colField = this.grid.columns.get(field);
                // check existence, since a field not used in a column might have changed
                return Boolean(colField) && (Boolean(colField.sum) || Boolean(colField.summaries));
            });

            if (shouldUpdate) {
                this.grid.forceFullRefresh = true;
            }
        }
    }

    //endregion

    /**
     * Refreshes the summaries
     */
    refresh() {
        this.grid.columns.visibleColumns.forEach(column => {
            if (this.hasSummary(column)) {
                this.grid.refreshColumn(column);
            }
        });
    }

    hasSummary(column) {
        return column.sum || column.summaries;
    }
}

GroupSummary.featureClass = 'b-group-summary';

GridFeatureManager.registerFeature(GroupSummary);
