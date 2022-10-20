import Column from '../../Grid/column/Column.js';
import ColumnStore from '../../Grid/data/ColumnStore.js';
import VerticalTimeAxis from '../view/VerticalTimeAxis.js';

/**
 * @module Scheduler/column/VerticalTimeAxisColumn
 */

/**
 * A special column containing the time axis labels when the Scheduler is used in vertical mode. You can configure,
 * it using the {@link Scheduler.view.Scheduler#config-verticalTimeAxisColumn} config object.
 *
 * **Note**: this column is sized by flexing to consume full width of its containing {@link Grid.view.SubGrid}. To
 * change width of this column, instead size the subgrid like so:
 *
 * ```javascript
 * const scheduler = new Scheduler({
 *     mode           : 'vertical',
 *     subGridConfigs : {
 *         locked : {
 *             width : 300
 *         }
 *     }
 * });
 * ```
 *
 * @extends Grid/column/Column
 */
export default class VerticalTimeAxisColumn extends Column {

    static $name = 'VerticalTimeAxisColumn';

    static get type() {
        return 'verticalTimeAxis';
    }

    static get defaults() {
        return {
            /**
             * @hideconfigs autoWidth, autoHeight
             */

            /**
             * Set to false to prevent this column header from being dragged.
             * @config {Boolean} draggable
             * @category Interaction
             * @default false
             * @hide
             */
            draggable : false,

            /**
             * Set to false to prevent grouping by this column.
             * @config {Boolean} groupable
             * @category Interaction
             * @default false
             * @hide
             */
            groupable : false,

            /**
             * Allow column visibility to be toggled through UI.
             * @config {Boolean} hideable
             * @default false
             * @category Interaction
             * @hide
             */
            hideable : false,

            /**
             * Show column picker for the column.
             * @config {Boolean} showColumnPicker
             * @default false
             * @category Menu
             * @hide
             */
            showColumnPicker : false,

            /**
             * Allow filtering data in the column (if Filter feature is enabled)
             * @config {Boolean} filterable
             * @default false
             * @category Interaction
             * @hide
             */
            filterable : false,

            /**
             * Allow sorting of data in the column
             * @config {Boolean} sortable
             * @category Interaction
             * @default false
             * @hide
             */
            sortable : false,

            // /**
            //  * Set to `false` to prevent the column from being drag-resized when the ColumnResize plugin is enabled.
            //  * @config {Boolean} resizable
            //  * @default false
            //  * @category Interaction
            //  * @hide
            //  */
            // resizable : false,

            /**
             * Allow searching in the column (respected by QuickFind and Search features)
             * @config {Boolean} searchable
             * @default false
             * @category Interaction
             * @hide
             */
            searchable : false,

            /**
             * Specifies if this column should be editable, and define which editor to use for editing cells in the column (if CellEdit feature is enabled)
             * @config {String} editor
             * @default false
             * @category Interaction
             * @hide
             */
            editor : false,

            /**
             * Set to `true` to show a context menu on the cell elements in this column
             * @config {Boolean} enableCellContextMenu
             * @default false
             * @category Menu
             * @hide
             */
            enableCellContextMenu : false,

            /**
             * @config {Function} tooltipRenderer
             * @hide
             */
            tooltipRenderer : false,

            /**
             * Column minimal width. If value is Number then minimal width is in pixels
             * @config {Number|String} minWidth
             * @default 0
             * @category Layout
             */
            minWidth : 0,

            resizable : false,

            cellCls : 'b-verticaltimeaxiscolumn',

            flex : 1
        };
    }

    get isFocusable() {
        return false;
    }

    construct(data) {
        super.construct(...arguments);

        this.view = new VerticalTimeAxis({
            model  : this.grid.timeAxisViewModel,
            client : this.grid
        });
    }

    renderer({ cellElement, size }) {
        this.view.render(cellElement);

        size.height = this.view.height;
    }

    // This function is not meant to be called by any code other than Base#getCurrentConfig().
    // It extracts the current configs (fields) for the column, removing irrelevant ones
    getCurrentConfig(options) {
        const result = super.getCurrentConfig(options);

        // Remove irrelevant configs
        delete result.id;
        delete result.region;
        delete result.type;
        delete result.field;
        delete result.ariaLabel;
        delete result.cellAriaLabel;

        return result;
    }
}

ColumnStore.registerColumnType(VerticalTimeAxisColumn);
