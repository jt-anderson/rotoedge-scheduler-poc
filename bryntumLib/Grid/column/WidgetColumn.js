//TODO: Currently widgets reuse elements already in cell, but performance would improve if entire widget was reused

//TODO: Leaking widget on rerender of row, since the old one is not destroyed

import WidgetHelper from '../../Core/helper/WidgetHelper.js';
import Column from './Column.js';
import ColumnStore from '../data/ColumnStore.js';

/**
 * @module Grid/column/WidgetColumn
 */

/**
 * A column that displays widgets in the grid cells.
 *
 * {@inlineexample Grid/column/WidgetColumn.js}
 *
 * ```javascript
 * new Grid({
 *     appendTo : document.body,
 *
 *     columns : [
 *         {
 *              type: 'widget',
 *              text: 'Name',
 *              widgets: [
 *                  { type: 'textfield', name : 'firstName' },
 *                  { type: 'textfield', name : 'lastName' }
 *               ]
 *         }
 *     ]
 * });
 * ```
 *
 * If you use {@link Core.widget.Field Fields} inside this column, the field widget can optionally bind its value to a
 * field in the data model using the {@link Core/widget/Field#config-name} (as shown in the snippet above). This will
 * provide two-way data binding and update the underlying row record as you make changes in the field.
 *
 * If you use a {@link Core.widget.Button} and want it to display the value from the cell as its text, set its
 * {@link Core/widget/Widget#config-defaultBindProperty} to `'text'`:
 *
 * ```javascript
 * new Grid({
 *     columns : [
 *         {
 *              type: 'widget',
 *              widgets: [
 *                  { type: 'button', name : 'age', defaultBindProperty : 'text' },
 *               ]
 *         }
 *     ]
 * });
 * ```
 *
 * There is no `editor` provided. It is the configured widget's responsibility to provide editing if needed.
 *
 * @extends Grid/column/Column
 * @classType widget
 */
export default class WidgetColumn extends Column {

    //region Config

    static get type() {
        return 'widget';
    }

    static get fields() {
        return [
            /**
             * An array of {@link Core.widget.Widget} config objects
             * @config {Object[]} widgets
             * @category Common
             */
            'widgets'
        ];
    }

    /**
     * A renderer function, which gives you access to render data like the current `record`, `cellElement` and the
     * {@link #config-widgets} of the column. See {@link #config-renderer}
     * for more information.
     *
     * ```javascript
     * new Grid({
     *     columns : [
     *         {
     *              type: 'check',
     *              field: 'allow',
     *              // In the column renderer, we get access to the record and column widgets
     *              renderer({ record, widgets }) {
     *                  // Hide checkboxes in certain rows
     *                  widgets[0].hidden = record.readOnly;
     *              }
     *         }
     *     ]
     * });
     * ```
     *
     * @param {Object} renderData Object containing renderer parameters
     * @param {HTMLElement|null} [renderData.cellElement] Cell element, for adding CSS classes, styling etc.
     *        Can be `null` in case of export
     * @param {*} renderData.value Value to be displayed in the cell
     * @param {Core.data.Model} renderData.record Record for the row
     * @param {Grid.column.Column} renderData.column This column
     * @param {Core.widget.Widget[]} renderData.widgets An array of the widgets rendered into this cell
     * @param {Grid.view.Grid} renderData.grid This grid
     * @param {Grid.row.Row} [renderData.row] Row object. Can be null in case of export. Use the
     * {@link Grid.row.Row#function-assignCls row's API} to manipulate CSS class names.
     * @param {Object} [renderData.size] Set `size.height` to specify the desired row height for the current row.
     *        Largest specified height is used, falling back to configured {@link Grid/view/Grid#config-rowHeight}
     *        in case none is specified. Can be null in case of export
     * @param {Number} [renderData.size.height] Set this to request a certain row height
     * @param {Number} [renderData.size.configuredHeight] Row height that will be used if none is requested
     * @param {Boolean} [renderData.isExport] True if record is being exported to allow special handling during export
     * @param {Boolean} [renderData.isMeasuring] True if the column is being measured for a `resizeToFitContent`
     *        call. In which case an advanced renderer might need to take different actions.
     * @config {Function} renderer
     * @category Rendering
     */

    static get defaults() {
        return {
            filterable : false,
            sortable   : false,
            editor     : false,
            searchable : false,
            fitMode    : false
        };
    }

    //endregion

    //region Init / Destroy

    construct(config, store) {
        const me = this;

        me.widgetMap = {};

        super.construct(...arguments);

        me.externalRenderer = me.renderer;
        me.renderer = me.internalRenderer;
    }

    doDestroy() {
        // Destroy all the widgets we created.
        for (const widget of Object.values(this.widgetMap)) {
            widget.destroy && widget.destroy();
        }
        super.doDestroy();
    }

    // Called by grid when its read-only state is toggled
    updateReadOnly(readOnly) {
        for (const widget of Object.values(this.widgetMap)) {
            if (!widget.cellInfo.record.readOnly) {
                widget.readOnly = readOnly;
            }
        }
    }

    //endregion

    //region Render

    /**
     * Renderer that displays a widget in the cell.
     * @param {Object} renderData Render data
     * @param {Grid.column.Column} renderData.column Rendered column
     * @param {Core.data.Model} renderData.record Rendered record
     * @private
     */
    internalRenderer(renderData) {
        const
            me                                        = this,
            { cellElement, column, record, isExport } = renderData,
            { widgets }                               = column;

        // This renderer might be called from subclasses by accident
        // This condition saves us from investigating bug reports
        if (!isExport && widgets) {
            // If there is no widgets yet and we're going to add them,
            // need to make sure there is no content left in the cell after its previous usage
            // by grid features such as grouping feature or so.
            if (!cellElement.widgets) {
                // Reset cell content
                me.clearCell(cellElement);
            }
            cellElement.widgets = renderData.widgets = widgets.map((widgetCfg, i) => {
                let widget, widgetNextSibling;

                // If cell element already has widgets, check if we need to destroy/remove one
                if (cellElement.widgets) {
                    // Current widget
                    widget = cellElement.widgets[i];

                    // Store next element sibling to insert widget to correct position later
                    widgetNextSibling = widget.element.nextElementSibling;

                    // If we are not syncing content for present widget, remove it from cell and render again later
                    if (widgetCfg.recreate && widget) {
                        // destroy widget and remove reference to it
                        delete me.widgetMap[widget.id];
                        widget.destroy();
                        cellElement.widgets[i] = null;
                    }
                }

                // Ensure widget is created if first time through
                if (!widget) {
                    me.onBeforeWidgetCreate(widgetCfg, renderData);
                    widgetCfg.recomposeAsync = false;
                    widget = WidgetHelper.append(widgetCfg, widgetNextSibling ? { insertBefore : widgetNextSibling } : cellElement)[0];
                    me.widgetMap[widget.id] = widget;
                    me.onAfterWidgetCreate(widget, renderData);

                    if (widget.name) {
                        widget.on({
                            change : ({ value }) => {
                                widget.cellInfo.record[widget.name] = value;
                            }
                        });
                    }
                }

                widget.cellInfo = {
                    record,
                    column
                };

                if (me.grid && !me.meta.isSelectionColumn) {
                    widget.readOnly = me.grid.readOnly || record.readOnly;
                }

                if (me.onBeforeWidgetSetValue?.(widget, renderData) !== false) {
                    const valueProperty = widgetCfg.valueProperty || ('value' in widget && 'value') || widget.defaultBindProperty;

                    if (valueProperty) {
                        const value = widget.name ? record[widget.name] : renderData.value;
                        widget[valueProperty] = value;
                    }
                }

                me.onAfterWidgetSetValue?.(widget, renderData);

                return widget;
            });
        }

        if (isExport) {
            return null;
        }

        return this.externalRenderer?.(renderData);
    }

    //endregion

    //region Other

    /**
     * Called before widget is created on rendering
     * @param {Object} widgetCfg Widget config
     * @param {Object} renderData Render data
     * @private
     */
    onBeforeWidgetCreate(widgetCfg, renderData) {}

    /**
     * Called after widget is created on rendering
     * @param {Core.widget.Widget} widget Created widget
     * @param {Object} renderData Render data
     * @private
     */
    onAfterWidgetCreate(widget, renderData) {}

    /**
     * Called before the widget gets its value on rendering. Pass `false` to skip value setting while rendering
     * @preventable
     * @function onBeforeWidgetSetValue
     * @param {Core.widget.Widget} widget Created widget
     * @param {Object} renderData Render data
     * @param {Grid.column.Column} renderData.column Rendered column
     * @param {Core.data.Model} renderData.record Rendered record
     */

    /**
     * Called after the widget gets its value on rendering.
     * @function onAfterWidgetSetValue
     * @param {Core.widget.Widget} widget Created widget
     * @param {Object} renderData Render data
     * @param {Grid.column.Column} renderData.column Rendered column
     * @param {Core.data.Model} renderData.record Rendered record
     */

    // Overrides base implementation to cleanup widgets, for example when a cell is reused as part of group header
    clearCell(cellElement) {
        if (cellElement.widgets) {
            cellElement.widgets.forEach(widget => {
                // Destroy widget and remove reference to it
                delete this.widgetMap[widget.id];
                widget.destroy();
            });
            cellElement.widgets = null;
        }

        // Even if there is no widgets need to make sure there is no content left, for example after a cell has been reused as part of group header
        super.clearCell(cellElement);
    }

    // Null implementation because there is no way of ascertaining whether the widgets get their width from
    // the column, or the column shrinkwraps the Widget.
    // Remember that the widget could have a width from a CSS rule which we cannot read.
    // It might have width: 100%, or a flex which would mean it is sized by us, but we cannot read that -
    // getComputedStyle would return the numeric width.
    resizeToFitContent() {}

    //endregion
}

ColumnStore.registerColumnType(WidgetColumn);
WidgetColumn.exposeProperties();
