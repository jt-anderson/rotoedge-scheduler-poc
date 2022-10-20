import Model from '../../Core/data/Model.js';
import Localizable from '../../Core/localization/Localizable.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import Events from '../../Core/mixin/Events.js';
import Widget from '../../Core/widget/Widget.js';
import ObjectHelper from '../../Core/helper/ObjectHelper.js';
import StringHelper from '../../Core/helper/StringHelper.js';
import Config from '../../Core/Config.js';
import Location from '../util/Location.js';

/**
 * @module Grid/column/Column
 */

const validWidth = (value) => ((typeof value === 'number') || value?.endsWith('px'));

/**
 * Base class for other column types, used if no type is specified on a column.
 *
 * Default editor is a {@link Core.widget.TextField}.
 *
 * ```javascript
 * const grid = new Grid({
 *   columns : [{
 *     field : 'name',
 *     text  : 'Name'
 *   }, {
 *     text  : 'Hobby',
 *     field : 'others.hobby', // reading nested field data
 *   }, {
 *     type  : 'number', // Will use NumberColumn
 *     field : 'age',
 *     text  : 'Age'
 *   }]
 * });
 * ```
 *
 * ## Column types
 *
 * Grid ships with multiple different column types. Which type to use for a column is specified by the `type` config.
 * The built in types are:
 *
 * * {@link Grid.column.ActionColumn action} - displays actions (clickable icons) in the cell.
 * * {@link Grid.column.AggregateColumn aggregate} - a column, which, when used as part of a Tree, aggregates the values
 *   of this column's descendants using a configured function which defaults to `sum`.
 * * {@link Grid.column.CheckColumn check} - displays a checkbox in the cell.
 * * {@link Grid.column.DateColumn date} - displays a date in the specified format.
 * * {@link Grid.column.NumberColumn number} - a column for showing/editing numbers.
 * * {@link Grid.column.PercentColumn percent} - displays a basic progress bar.
 * * {@link Grid.column.RatingColumn rating} - displays a star rating.
 * * {@link Grid.column.RowNumberColumn rownumber} - displays the row number in each cell.
 * * {@link Grid.column.TemplateColumn template} - uses a template for cell content.
 * * {@link Grid.column.TimeColumn time} - displays a time in the specified format.
 * * {@link Grid.column.TreeColumn tree} - displays a tree structure when using the {@link Grid.feature.Tree tree}
 *   feature.
 * * {@link Grid.column.WidgetColumn widget} - displays widgets in the cells.
 *
 * ## Cell renderers
 *
 * You can affect the contents and styling of cells in a column using a
 * {@link Grid.column.Column#config-renderer} function.
 *
 * ```javascript
 * const grid = new Grid({
 *   columns : [
 *   ...
 *     {
 *       field      : 'approved',
 *       text       : 'Approved',
 *       htmlEncode : false, // allow to use HTML code
 *       renderer({ value }) {
 *         return value === true ? '<b>Yes</b>' : '<i>No</i>';
 *       }
 *     }
 *     ...
 *     ]
 * });
 * ```
 *
 * ## Menus
 *
 * You can add custom items to the context menu for a columns header and for its cells, using
 * {@link Grid.column.Column#config-headerMenuItems} and {@link Grid.column.Column#config-cellMenuItems}. Here is an
 * example:
 *
 * ```javascript
 * const grid = new Grid({
 *   columns : [
 *     ...
 *     {
 *       type  : 'number',
 *       field : 'age',
 *       text  : 'Age',
 *       headerMenuItems: [{
 *           text : 'My unique header item',
 *           icon : 'b-fa b-fa-paw',
 *           onItem() { console.log('item clicked'); }
 *       }],
 *       cellMenuItems: [{
 *           text : 'My unique cell item',
 *           icon : 'b-fa b-fa-plus',
 *           onItem() { console.log('item clicked'); }
 *       }]
 *     }
 *   ...
 *   ]
 * });
 * ```
 *
 * @extends Core/data/Model
 * @classType column
 * @mixes Core/mixin/Events
 * @mixes Core/localization/Localizable
 */
export default class Column extends Model.mixin(Events, Localizable) {
    static get $name() {
        return 'Column';
    }

    /**
     * Column name alias which you can use in the `columns` array of a Grid.
     *
     * ```javascript
     * class MyColumn extends Column {
     *     static get type() {
     *        return 'mycolumn';
     *     }
     * }
     * ```
     *
     * ```javascript
     * const grid = new Grid({
     *    columns : [
     *       { type : 'mycolumn', text : 'The column', field : 'someField', flex : 1 }
     *    ]
     * });
     * ```
     *
     * @static
     * @member {String} type
     */
    static get type() {
        return 'column';
    }

    //region Config

    /**
     * Default settings for the column, applied in constructor. None by default, override in subclass.
     * @member {Object} defaults
     * @returns {Object}
     * @readonly
     */

    static get fields() {
        return [
            //region Common

            /**
             * The type alias for this column
             * @config {'text'|'number'|'date'|'check'|'rownumber'|'template'|'tree'|'widget'|'rating'|'percent'|'aggregate'|'action'|String} type
             * @category Misc
             */
            'type',

            /**
             * Get/set header text
             * @member {String} text
             */

            /**
             * Text to display in the header
             * @config {String} text
             * @category Common
             */
            'text',

            /**
             * The {@link Core.data.field.DataField#config-name} of the {@link Core.data.Model data model} field to read
             * data from.
             * @config {String} field
             * @category Common
             */
            'field',

            // NOTE: This is duplicated in WidgetColumn so remember to change it too if changing the signature of
            // this function
            /**
             * Renderer function, used to format and style the content displayed in the cell. Return the cell text you
             * want to display. Can also affect other aspects of the cell, such as styling.
             *
             * **NOTE:** If you mutate cellElement and you want to prevent cell content to be reset during the
             * rendering, please return `undefined` from the renderer or just omit the `return` statement. If you return
             * a value and the value can be undefined, please make sure you return an empty string to update the cell
             * content. For example:
             *
             * ```javascript
             * new Grid({
             *     columns : [
             *         // Returns an empty string if status field value is undefined
             *         { text : 'Status', renderer : ({ record }) => record.status ?? '' },
             *     ]
             * });
             * ```
             *
             * You can also return a {@link Core.helper.DomHelper#typedef-DomConfig} object describing the markup
             * ```javascript
             * new Grid({
             *     columns : [
             *         {
             *              text : 'Status',
             *              renderer : ({ record }) => {
             *                  return {
             *                      class : 'myClass',
             *                      children : [
             *                          {
             *                              tag : 'i',
             *                              class : 'fa fa-pen'
             *                          },
             *                          {
             *                              tag : 'span',
             *                              html : record.name
             *                          }
             *                      ]
             *                  };
             *              }
             *         }
             *     ]
             * });
             * ```
             *
             * You can modify the row element too from inside a renderer to add custom CSS classes:
             *
             * ```javascript
             * new Grid({
             *     columns : [
             *         {
             *             text     : 'Name',
             *             renderer : ({ record, row }) => {
             *                // Add special CSS class to new rows that have not yet been saved
             *               row.cls.newRow = record.isPhantom;
             *
             *               return record.name;
             *         }
             *     ]
             * });
             * ```
             *
             * @param {Object} renderData Object containing renderer parameters
             * @param {HTMLElement} [renderData.cellElement] Cell element, for adding CSS classes, styling etc.
             * Can be `null` in case of export
             * @param {*} renderData.value Value to be displayed in the cell
             * @param {Core.data.Model} renderData.record Record for the row
             * @param {Grid.column.Column} renderData.column This column
             * @param {Grid.view.Grid} renderData.grid This grid
             * @param {Grid.row.Row} [renderData.row] Row object. Can be null in case of export. Use the
             * {@link Grid.row.Row#function-assignCls row's API} to manipulate CSS class names.
             * @param {Object} [renderData.size] Set `size.height` to specify the desired row height for the current
             * row. Largest specified height is used, falling back to configured {@link Grid/view/Grid#config-rowHeight}
             * in case none is specified. Can be null in case of export
             * @param {Number} [renderData.size.height] Set this to request a certain row height
             * @param {Number} [renderData.size.configuredHeight] Row height that will be used if none is requested
             * @param {Boolean} [renderData.isExport] True if record is being exported to allow special handling during
             * export.
             * @param {Boolean} [renderData.isMeasuring] True if the column is being measured for a `resizeToFitContent`
             * call. In which case an advanced renderer might need to take different actions.
             * @config {Function} renderer
             * @category Common
             */
            'renderer',

            //'reactiveRenderer',

            /**
             * Column width. If value is Number then width is in pixels
             * @config {Number|String} width
             * @category Common
             */
            'width',

            /**
             * Gets or sets the column flex weight
             * @member {String} flex
             */

            /**
             * Column width as a flex weight. All columns with flex specified divide the available space (after
             * subtracting fixed widths) between them according to the flex value. Columns that have flex 2 will be
             * twice as wide as those with flex 1 (and so on)
             * @config {Number} flex
             * @category Common
             */
            'flex',

            /**
             * This config sizes a column to fits its content. It is used instead of `width` or `flex`.
             *
             * This config requires the {@link Grid.feature.ColumnAutoWidth} feature which responds to changes in the
             * grid's store and synchronizes the widths' of all `autoWidth` columns.
             *
             * If this config is not a Boolean value, it is passed as the only argument to the `resizeToFitContent`
             * method to constrain the column's width.
             *
             * @config {Boolean|Number|Number[]} autoWidth
             * @category Common
             */
            'autoWidth',

            /**
             * This config enables automatic height for all cells in this column. It is achieved by measuring the height
             * a cell after rendering it to DOM, and then sizing the row using that height (if it is greater than other
             * heights used for the row).
             *
             * Heads up if you render your Grid on page load, if measurement happens before the font you are using is
             * loaded you might get slightly incorrect heights. For browsers that support it we detect that
             * and remeasure when fonts are available.
             *
             * **NOTE:** Enabling this config comes with a pretty big performance hit. To maintain good performance,
             * we recommend not using it. You can still set the height of individual rows manually, either through
             * {@link Grid.data.GridRowModel#field-rowHeight data} or via {@link #config-renderer renderers}.
             *
             * Also note that this setting only works fully as intended with non-flex columns.
             *
             * Rows will always be at least {@link Grid.view.Grid#config-rowHeight} pixels tall
             * even if an autoHeight cell contains no data.
             *
             * Manually setting a height from a {@link #config-renderer} in this column will take precedence over this
             * config.
             *
             * @config {Boolean} autoHeight
             * @category Common
             */
            'autoHeight',

            /**
             * Mode to use when measuring the contents of this column in calls to {@link #function-resizeToFitContent}.
             * Available modes are:
             *
             * * 'exact'       - Most precise, renders and measures all cells (Default, slowest)
             * * 'textContent' - Renders all cells but only measures the one with the longest `textContent`
             * * 'value'       - Renders and measures only the cell with the longest data (Fastest)
             * * 'none'/falsy  - Resize to fit content not allowed, a call does nothing
             *
             * @config {'exact'|'textContent'|'value'|'none'|null} fitMode
             * @default 'exact'
             * @category Common
             */
            { name : 'fitMode', defaultValue : 'exact' },

            //endregion

            //region Interaction

            /**
             * A config object used to create the input field which will be used for editing cells in the
             * column. Used when {@link Grid.feature.CellEdit} feature is enabled. The Editor refers to
             * {@link #config-field} for a data source.
             *
             * Configure this as `null` to prevent cell editing in this column.
             *
             * All subclasses of {@link Core.widget.Field} can be used as editors. The most popular are:
             * - {@link Core.widget.TextField}
             * - {@link Core.widget.NumberField}
             * - {@link Core.widget.DateField}
             * - {@link Core.widget.TimeField}
             * - {@link Core.widget.Combo}
             *
             * If record has method set + capitalized field, method will be called, e.g. if record has method named
             * `setFoobar` and the {@link #config-field} is `foobar`, then instead of `record.foobar = value`,
             * `record.setFoobar(value)` will be called.
             *
             * @config {Boolean|String|Object|Core.widget.Field} editor
             * @category Interaction
             */
            { name : 'editor', defaultValue : {} },

            /**
             * A config object used to configure an {@link Core.widget.Editor} which contains this Column's
             * {@link #config-editor input field} if {@link Grid.feature.CellEdit} feature is enabled.
             * @config {EditorConfig} cellEditor
             * @category Interaction
             */
            'cellEditor',

            /**
             * A function which is called when a cell edit is requested to finish.
             *
             * This may be an `async` function which performs complex validation. The edit will not
             * complete until it returns `false` to mean the edit cannot be finished, or `true` to go
             * ahead and complete.
             *
             * @param {Object} context An object describing the state of the edit at completion request time.
             * @param {Core.widget.Field} context.inputField The field configured as the column's `editor`.
             * @param {Core.data.Model} context.record The record being edited.
             * @param {*} context.oldValue The old value of the cell.
             * @param {*} context.value The new value of the cell.
             * @param {Grid.view.Grid} context.grid The host grid.
             * @param {Object} context.editorContext The {@link Grid.feature.CellEdit} context object.
             * @param {Grid.column.Column} context.editorContext.column The column being edited.
             * @param {Core.data.Model} context.editorContext.record The record being edited.
             * @param {HTMLElement} context.editorContext.cell The cell element hosting the editor.
             * @param {Core.widget.Editor} context.editorContext.editor The floating Editor widget which is hosting the
             * input field.
             * @config {Function} finalizeCellEdit
             * @category Interaction
             */
            'finalizeCellEdit',

            /**
             * Setting this option means that pressing the `ESCAPE` key after editing the field will
             * revert the field to the value it had when the edit began. If the value is _not_ changed
             * from when the edit started, the input field's {@link Core.widget.Field#config-clearable}
             * behaviour will be activated. Finally, the edit will be canceled.
             * @config {Boolean} revertOnEscape
             * @default true
             * @category Interaction
             */
            { name : 'revertOnEscape', defaultValue : true },

            /**
             * How to handle a request to complete a cell edit in this column if the field is invalid.
             * There are three choices:
             *  - `block` The default. The edit is not exited, the field remains focused.
             *  - `allow` Allow the edit to be completed.
             *  - `revert` The field value is reverted and the edit is completed.
             * @config {'block'|'allow'|'revert'} invalidAction
             * @default 'block'
             * @category Interaction
             */
            { name : 'invalidAction', defaultValue : 'block' },

            /**
             * Allow sorting of data in the column. You can pass true/false to enable/disable sorting, or provide a
             * custom sorting function, or a config object for a {@link Core.util.CollectionSorter}
             *
             * ```javascript
             * const grid = new Grid({
             *     columns : [
             *          {
             *              // Disable sorting for this column
             *              sortable : false
             *          },
             *          {
             *              field : 'name',
             *              // Custom sorting for this column
             *              sortable(user1, user2) {
             *                  return user1.name < user2.name ? -1 : 1;
             *              }
             *          },
             *          {
             *              // A config object for a Core.util.CollectionSorter
             *              sortable : {
             *                  property         : 'someField',
             *                  direction        : 'DESC',
             *                  useLocaleCompare : 'sv-SE'
             *              }
             *          }
             *     ]
             * });
             * ```
             * When providing a custom sorting function, if the sort feature is configured with
             * `prioritizeColumns : true` that function will also be used for programmatic sorting of the store:
             *
             * ```javascript
             * const grid = new Grid({
             *     features : {
             *       sort : {
             *           prioritizeColumns : true
             *       }
             *     },
             *
             *     columns : [
             *          {
             *              field : 'name',
             *              // Custom sorting for this column
             *              sortable(user1, user2) {
             *                  return user1.name < user2.name ? -1 : 1;
             *              }
             *          }
             *     ]
             * });
             *
             * // Will use sortable() from the column definition above
             * grid.store.sort('name');
             * ```
             *
             * @config {Boolean|Function|Object} sortable
             * @default true
             * @category Interaction
             */
            {
                name         : 'sortable',
                defaultValue : true,
                // Normalize function/object forms
                convert(value, column) {
                    if (!value) {
                        return false;
                    }

                    if (value === true) {
                        return true;
                    }

                    const sorter = {};

                    if (typeof value === 'function') {
                        sorter.originalSortFn = value;
                        // Scope for sortable() expected to be the column
                        sorter.sortFn = value.bind(column);
                    }
                    else if (typeof value === 'object') {
                        Object.assign(sorter, value);

                        if (sorter.fn) {
                            sorter.sortFn = sorter.fn;
                            delete sorter.fn;
                        }
                    }

                    return sorter;
                }
            },

            /**
             * Allow searching in the column (respected by QuickFind and Search features)
             * @config {Boolean} searchable
             * @default true
             * @category Interaction
             */
            { name : 'searchable', defaultValue : true },

            /**
             * Allow filtering data in the column (if {@link Grid.feature.Filter} or {@link Grid.feature.FilterBar}
             * feature is enabled).
             *
             * Also allows passing a custom filtering function that will be called for each record with a single
             * argument of format `{ value, record, [operator] }`. Returning `true` from the function includes the
             * record in the filtered set.
             *
             * Configuration object may be used for {@link Grid.feature.FilterBar} feature to specify `filterField`. See
             * an example in the code snippet below or check {@link Grid.feature.FilterBar} page for more details.
             *
             * ```
             * const grid = new Grid({
             *     columns : [
             *          {
             *              field : 'name',
             *              // Disable filtering for this column
             *              filterable : false
             *          },
             *          {
             *              field : 'age',
             *              // Custom filtering for this column
             *              filterable: ({ value, record }) => Math.abs(record.age - value) < 10
             *          },
             *          {
             *              field : 'start',
             *              // Changing default field type
             *              filterable: {
             *                  filterField : {
             *                      type : 'datetime'
             *                  }
             *              }
             *          },
             *          {
             *              field : 'city',
             *              // Filtering for a value out of a list of values
             *              filterable: {
             *                  filterField : {
             *                      type  : 'combo',
             *                      value : '',
             *                      items : [
             *                          'Paris',
             *                          'Dubai',
             *                          'Moscow',
             *                          'London',
             *                          'New York'
             *                      ]
             *                  }
             *              }
             *          },
             *          {
             *              field : 'score',
             *              filterable : {
             *                  // This filter fn doesn't return 0 values as matching filter 'less than'
             *                  filterFn : ({ record, value, operator, property }) => {
             *                      switch (operator) {
             *                          case '<':
             *                              return record[property] === 0 ? false : record[property] < value;
             *                          case '=':
             *                              return record[property] == value;
             *                          case '>':
             *                              return record[property] > value;
             *                      }
             *                  }
             *              }
             *          }
             *     ]
             * });
             * ```
             *
             * When providing a custom filtering function, if the filter feature is configured with
             * `prioritizeColumns : true` that function will also be used for programmatic filtering of the store:
             *
             * ```javascript
             * const grid = new Grid({
             *     features : {
             *         filter : {
             *             prioritizeColumns : true
             *         }
             *     },
             *
             *     columns : [
             *          {
             *              field : 'age',
             *              // Custom filtering for this column
             *              filterable: ({ value, record }) => Math.abs(record.age - value) < 10
             *          }
             *     ]
             * });
             *
             * // Will use filterable() from the column definition above
             * grid.store.filter({
             *     property : 'age',
             *     value    : 50
             * });
             * ```
             *
             * To use custom `FilterField` combo `store` it should contain one of these
             * {@link Core.data.Store#config-data} or {@link Core.data.AjaxStore#config-readUrl} configs.
             * Otherwise combo will get data from owner Grid store.
             *
             * ```javascript
             * const grid = new Grid({
             *     columns : [
             *          {
             *              field : 'name',
             *              filterable: {
             *                  filterField {
             *                      type  : 'combo',
             *                      store : new Store({
             *                          data : ['Adam', 'Bob', 'Charlie']
             *                      })
             *                  }
             *              }
             *          }
             *     ]
             * });
             * ```
             *
             * or
             *
             * ```javascript
             * const grid = new Grid({
             *     columns : [
             *          {
             *              field : 'name',
             *              filterable: {
             *                  filterField : {
             *                     type  : 'combo',
             *                     store : new AjaxStore({
             *                         readUrl  : 'data/names.json',
             *                         autoLoad : true
             *                     })
             *                  }
             *              }
             *          }
             *     ]
             * });
             * ```
             *
             * @config {Boolean|Function|Object} filterable
             * @default true
             * @category Interaction
             */
            {
                name         : 'filterable',
                defaultValue : true,
                // Normalize function/object forms
                convert(value) {
                    if (!value) {
                        return false;
                    }

                    if (value === true) {
                        return true;
                    }

                    const filter = {
                        columnOwned : true
                    };

                    if (typeof value === 'function') {
                        filter.filterFn = value;
                    }
                    else if (typeof value === 'object') {
                        Object.assign(filter, value);
                    }

                    return filter;
                }
            },

            /**
             * Setting this flag to `true` will prevent dropping child columns into a group column
             * @config {Boolean} sealed
             * @default false
             * @category Interaction
             */
            { name : 'sealed' },

            /**
             * Allow column visibility to be toggled through UI
             * @config {Boolean} hideable
             * @default true
             * @category Interaction
             */
            { name : 'hideable', defaultValue : true },

            /**
             * Set to false to prevent this column header from being dragged
             * @config {Boolean} draggable
             * @category Interaction
             */
            { name : 'draggable', defaultValue : true },

            /**
             * Set to false to prevent grouping by this column
             * @config {Boolean} groupable
             * @category Interaction
             */
            { name : 'groupable', defaultValue : true },

            /**
             * Set to `false` to prevent the column from being drag-resized when the ColumnResize plugin is enabled.
             * @config {Boolean} resizable
             * @default true
             * @category Interaction
             */
            { name : 'resizable', defaultValue : true },

            //endregion

            //region Rendering

            /**
             * Renderer function for group headers (when using Group feature).
             * @param {Object} renderData
             * @param {HTMLElement} renderData.cellElement Cell element, for adding CSS classes, styling etc.
             * @param {*} renderData.groupRowFor Current group value
             * @param {Core.data.Model} renderData.record Record for the row
             * @param {Core.data.Model[]} renderData.groupRecords Records in the group
             * @param {Grid.column.Column} renderData.column Current rendering column
             * @param {Grid.column.Column} renderData.groupColumn Column that the grid is grouped by
             * @param {Number} renderData.count Number of records in the group
             * @param {Grid.view.Grid} renderData.grid This grid
             * @config {Function} groupRenderer
             * @returns {String} The header grouping text
             * @category Rendering
             */
            'groupRenderer',

            /**
             * Renderer function for the column header.
             * @param {Object} renderData
             * @param {Grid.column.Column} renderData.column This column
             * @param {HTMLElement} renderData.headerElement The header element
             * @config {Function} headerRenderer
             * @category Rendering
             */
            'headerRenderer',

            /**
             * A tooltip string to show when hovering the column header, or a config object which can
             * reconfigure the shared tooltip by setting boolean, numeric and string config values.
             * @config {String|Object} tooltip
             * @category Rendering
             */
            'tooltip',

            /**
             * Renderer function for the cell tooltip (used with {@link Grid.feature.CellTooltip} feature). Specify
             * `false` to preventc tooltip for this column.
             * @param {HTMLElement} cellElement Cell element
             * @param {Core.data.Model} record Record for cell row
             * @param {Grid.column.Column} column Cell column
             * @param {Grid.feature.CellTooltip} cellTooltip Feature instance, used to set tooltip content async
             * @param {MouseEvent} event The event that triggered the tooltip
             * @config {Function} tooltipRenderer
             * @category Rendering
             */
            'tooltipRenderer',

            /**
             * CSS class added to each cell in this column
             * @config {String} cellCls
             * @category Rendering
             */
            'cellCls',

            /**
             * CSS class added to the header of this column
             * @config {String} cls
             * @category Rendering
             */
            'cls',

            /**
             * Get/set header icon class
             * @member {String} icon
             */

            /**
             * Icon to display in header. Specifying an icon will render a `<i>` element with the icon as value for the
             * class attribute
             * @config {String} icon
             * @category Rendering
             */
            'icon',

            //endregion

            //region Layout

            /**
             * Text align. Accepts left/center/right or direction neutral start/end
             * @config {'left'|'center'|'right'|'start'|'end'} align
             * @category Layout
             */
            'align',

            /**
             * Column minimal width. If value is Number then minimal width is in pixels
             * @config {Number|String} minWidth
             * @default 60
             * @category Layout
             */
            { name : 'minWidth', defaultValue : 60 },

            /**
             * Column maximal width. If value is Number then maximal width is in pixels
             * @config {Number|String} maxWidth
             * @category Common
             */
            'maxWidth',

            /**
             * Get/set columns hidden state. Specify `true` to hide the column, `false` to show it.
             * @member {Boolean} hidden
             */

            /**
             * Hide the column from start
             * @config {Boolean} hidden
             * @category Layout
             */
            { name : 'hidden', defaultValue : false },

            /**
             * Convenient way of putting a column in the "locked" region. Same effect as specifying region: 'locked'.
             * If you have defined your own regions (using {@link Grid.view.Grid#config-subGridConfigs}) you should use
             * {@link #config-region} instead of this one.
             * @config {Boolean} locked
             * @default false
             * @category Layout
             */
            { name : 'locked' },

            /**
             * Region (part of the grid, it can be configured with multiple) where to display the column. Defaults to
             * {@link Grid.view.Grid#config-defaultRegion}.
             * @config {String} region
             * @category Layout
             */
            { name : 'region' },

            /**
             * Specify `true` to merge cells within the column whose value match between rows, making the first
             * occurrence of the value span multiple rows.
             *
             * Only applies when using the {@link Grid/feature/MergeCells MergeCells feature}.
             *
             * This setting can also be toggled using the column header menu.
             *
             * @config {Boolean} mergeCells
             * @category Merge cells
             */
            { name : 'mergeCells', type : 'boolean' },

            /**
             * Set to `false` to prevent merging cells in this column using the column header menu.
             *
             * Only applies when using the {@link Grid/feature/MergeCells MergeCells feature}.
             *
             * @config {Boolean} mergeable
             * @default true
             * @category Merge cells
             */
            { name : 'mergeable', type : 'boolean', defaultValue : true },

            /**
             * An empty function by default, but provided so that you can override it. This function is called each time
             * a merged cell is rendered. It allows you to manipulate the DOM config object used before it is synced to
             * DOM, thus giving you control over styling and contents.
             *
             * NOTE: The function is intended for formatting, you should not update records in it since updating records
             * triggers another round of rendering.
             *
             * ```javascript
             * const grid = new Grid({
             *   columns : [
             *     {
             *       field      : 'project',
             *       text       : 'Project',
             *       mergeCells : 'true,
             *       mergedRenderer({ domConfig, value, fromIndex, toIndex }) {
             *         domConfig.className.highlight = value === 'Important project';
             *       }
             *    }
             *  ]
             * });
             * ```
             *
             * @config {Function}
             * @param {Object} detail An object containing the information needed to render a task.
             * @param {*} detail.value Value that will be displayed in the merged cell
             * @param {Number} detail.fromIndex Index in store of the first row of the merged cell
             * @param {Number} detail.toIndex Index in store of the last row of the merged cell
             * @param {Core.helper.DomHelper#typedef-DomConfig} detail.domConfig DOM config object for the merged cell
             * element
             * @category Merge cells
             */
            'mergedRenderer',

            //endregion

            // region Menu

            /**
             * Show column picker for the column
             * @config {Boolean} showColumnPicker
             * @default true
             * @category Menu
             */
            { name : 'showColumnPicker', defaultValue : true },

            /**
             * false to prevent showing a context menu on the column header element
             * @config {Boolean} enableHeaderContextMenu
             * @default true
             * @category Menu
             */
            { name : 'enableHeaderContextMenu', defaultValue : true },

            /**
             * Set to `false` to prevent showing a context menu on the cell elements in this column
             * @config {Boolean} enableCellContextMenu
             * @default true
             * @category Menu
             */
            { name : 'enableCellContextMenu', defaultValue : true },

            /**
             * Extra items to show in the header context menu for this column.
             *
             * ```javascript
             * headerMenuItems : {
             *     customItem : { text : 'Custom item' }
             * }
             * ```
             *
             * @config {Object} headerMenuItems
             * @category Menu
             */
            'headerMenuItems',

            /**
             * Extra items to show in the cell context menu for this column
             *
             * ```javascript
             * cellMenuItems : {
             *     customItem : { text : 'Custom item' }
             * }
             * ```
             *
             * @config {Object} cellMenuItems
             * @category Menu
             */
            'cellMenuItems',

            //endregion

            //region Summary

            /**
             * Summary type (when using Summary feature). Valid types are:
             * <dl class="wide">
             * <dt>sum <dd>Sum of all values in the column
             * <dt>add <dd>Alias for sum
             * <dt>count <dd>Number of rows
             * <dt>countNotEmpty <dd>Number of rows containing a value
             * <dt>average <dd>Average of all values in the column
             * <dt>function <dd>A custom function, used with store.reduce. Should take arguments (sum, record)
             * </dl>
             * @config {'sum'|'add'|'count'|'countNotEmpty'|'average'|Function} sum
             * @category Summary
             */
            'sum',

            /**
             * Summary configs, use if you need multiple summaries per column. Replaces {@link #config-sum} and
             * {@link #config-summaryRenderer} configs. Accepts an array of objects with the following fields:
             * * sum - Matching {@link #config-sum}
             * * renderer - Matching {@link #config-summaryRenderer}
             * * seed - Initial value when using a function as `sum`
             * @config {Object[]} summaries
             * @category Summary
             */
            'summaries',

            /**
             * Renderer function for summary (when using Summary feature). The renderer is called with an object having
             * the calculated summary `sum` as only member.
             * @config {Function} summaryRenderer
             * @param {Number} summaryRenderer.sum The sum
             * @category Summary
             */
            'summaryRenderer',

            //endregion

            //region Misc

            /**
             * Column settings at different responsive levels, see responsive demo under examples/
             * @config {Object} responsiveLevels
             * @category Misc
             */
            'responsiveLevels',

            /**
             * Tags, may be used by ColumnPicker feature for grouping columns by tag in the menu
             * @config {String[]} tags
             * @category Misc
             */
            'tags',

            /**
             * Column config to apply to normal config if viewed on a touch device
             * @config {Object} touchConfig
             * @category Misc
             */
            'touchConfig',

            /**
             * When using the tree feature, exactly one column should specify { tree: true }
             * @config {Boolean} tree
             * @category Misc
             */
            'tree',

            /**
             * Determines which type of filtering to use for the column. Usually determined by the column type used,
             * but may be overridden by setting this field.
             * @config {'string'|'date'|'number'|'int'|'duration'} filterType
             * @category Misc
             */
            'filterType',

            /**
             * By default, any rendered column cell content is HTML-encoded. Set this flag to `false` disable this and
             * allow rendering html elements
             * @config {Boolean} htmlEncode
             * @default true
             * @category Misc
             */
            { name : 'htmlEncode', defaultValue : true },

            /**
             * By default, the header text is HTML-encoded. Set this flag to `false` disable this and allow html
             * elements in the column header
             * @config {Boolean} htmlEncodeHeaderText
             * @default true
             * @category Misc
             */
            { name : 'htmlEncodeHeaderText', defaultValue : true },

            /**
             * Set to `true`to automatically call DomHelper.sync for html returned from a renderer. Should in most cases
             * be more performant than replacing entire innerHTML of cell and also allows CSS transitions to work. Has
             * no effect unless {@link #config-htmlEncode} is disabled. Returned html must contain a single root element
             * (that can have multiple children). See PercentColumn for example usage.
             * @config {Boolean} autoSyncHtml
             * @default false
             * @category Misc
             */
            { name : 'autoSyncHtml', defaultValue : false },

            /**
             * Set to `true` to have the {@link Grid.feature.CellEdit} feature update the record being edited live upon
             * field edit instead of when editing is finished by using `TAB` or `ENTER`
             * @config {Boolean} instantUpdate
             * @category Misc
             */
            { name : 'instantUpdate', defaultValue : false },

            { name : 'repaintOnResize', defaultValue : false },

            /**
             * An optional query selector to select a sub element within the cell being
             * edited to align a cell editor's `X` position and `width` to.
             * @config {String} editTargetSelector
             * @category Misc
             */
            'editTargetSelector',

            //endregion

            //region Export

            /**
             * Used by the Export feature. Set to `false` to omit a column from an exported dataset
             * @config {Boolean} exportable
             * @default true
             * @category Export
             */
            { name : 'exportable', defaultValue : true },

            /**
             * Column type which will be used by {@link Grid.util.TableExporter}. See list of available types in
             * TableExporter docs. Returns undefined by default, which means column type should be read from the record
             * field.
             * @config {String} exportedType
             * @category Export
             */
            { name : 'exportedType' },

            {
                name         : 'ariaLabel',
                defaultValue : 'L{Column.columnLabel}'
            },

            {
                name         : 'cellAriaLabel',
                defaultValue : 'L{cellLabel}'
            }

            //endregion
        ];
    }

    // prevent undefined fields from being exposed, to simplify spotting errors
    static get autoExposeFields() {
        return false;
    }

    //endregion

    //region Init

    construct(data, store) {
        const me = this;

        me.masterStore = store;

        // Store might be an array
        if (store) {
            me._grid = Array.isArray(store) ? store[0].grid : store.grid;
        }

        me.localizableProperties = Config.mergeMethods.distinct(data.localizableProperties, ['text', 'ariaLabel', 'cellAriaLabel']);

        if (data.localeClass) {
            me.localeClass = data.localeClass;
        }

        super.construct(...arguments);

        // Default value for region is assigned by the ColumnStore in createRecord(), same for `locked`

        // Allow field : null if the column does not rely on a record field.
        // For example the CheckColumn when used by GridSelection.
        if (me.isLeaf && !('field' in me.data)) {
            me.field = '_' + (me.type || '') + (++Column.emptyCount);
            me.noFieldSpecified = true;
        }

        // If our field is a dot separated path, we must use ObjectHelper.getPath to extract our value
        me.hasComplexMapping = me.field?.includes('.');

        if (!me.width && !me.flex && !me.children) {
            // Set the width silently because we're in construction.
            me.set({
                width : Column.defaultWidth,
                flex  : null
            }, null, true);
        }
    }

    onCellFocus(location) {
        this.location = location;
        this.updateHeaderAriaLabel(this.localizeProperty('ariaLabel'));

        // Update cell if cell is in the grid
        if (location.rowIndex !== -1) {
            this.updateCellAriaLabel(this.localizeProperty('cellAriaLabel'));
        }
    }

    updateHeaderAriaLabel(headerAriaLabel) {
        DomHelper.setAttributes(this.element, {
            'aria-label' : headerAriaLabel
        });
    }

    updateCellAriaLabel(cellAriaLabel) {
        if (!this.location?.isSpecialRow && this.location?.cell) {
            if (!cellAriaLabel?.length) {
                cellAriaLabel = this.location.column.text;
            }
            DomHelper.setAttributes(this.location.cell, {
                'aria-label' : cellAriaLabel
            });
        }
    }

    doDestroy() {
        this.data?.editor?.destroy?.();
        super.doDestroy();
    }

    //endregion

    //region Fields

    // Yields the automatic cell tagging class, eg b-number-cell from NumberColumn etc
    static generateAutoCls() {
        let columnAutoCls = '';

        // Create the auto class for cells owned by this column class
        // For example NumberColumn cells get b-number-cell
        // DurationColumn cells get b-duration-cell b-number-cell
        for (let c = this; c !== Column; c = c.superclass) {
            c.type && (columnAutoCls += `b-${c.type.toLowerCase()}-cell `);
        }
        (Column.autoClsMap || (Column.autoClsMap = new Map())).set(this, columnAutoCls);
        return columnAutoCls;
    }

    /**
     * Returns the full CSS class set for a cell at the passed {@link Grid.util.Location}
     * as an object where property keys with truthy values denote a class to be added
     * to the cell.
     * @param {Grid.util.Location} cellContext
     * @returns {Object} An object in which property keys with truthy values are used as
     * the class names on the cell element.
     * @internal
     */
    getCellClass(cellContext) {
        const
            { record, column } = cellContext,
            {
                cellCls,
                internalCellCls,
                grid,
                constructor,
                align
            }          = column,
            autoCls    = Column.autoClsMap?.get(constructor) || constructor.generateAutoCls(),
            result     = {
                [grid.cellCls]                 : grid.cellCls,
                [autoCls]                      : autoCls,
                [cellCls]                      : cellCls,
                [internalCellCls]              : internalCellCls,
                'b-cell-dirty'                 : record.isFieldModified(column.field),
                [`b-grid-cell-align-${align}`] : align,
                'b-selected'                   : grid.isSelected(cellContext),
                'b-focused'                    : grid.isFocused(cellContext),
                'b-auto-height'                : column.autoHeight
            };

        // Check cell CSS should not be applied to group header rows
        if (record.isSpecialRow && result['b-checkbox-selection']) {
            result['b-checkbox-selection'] = false;
        }

        return result;
    }

    get locked() {
        return this.data.region === 'locked';
    }

    set locked(locked) {
        this.region = locked ? 'locked' : 'normal';
    }

    // parent headers cannot be sorted by
    get sortable() {
        return this.isLeaf && this.data.sortable;
    }

    set sortable(sortable) {
        this.set('sortable', sortable);
    }

    // parent headers cannot be grouped by
    get groupable() {
        return this.isLeaf && this.data.groupable;
    }

    set groupable(groupable) {
        this.set('groupable', groupable);
    }

    /**
     * The Field to use as editor for this column
     * @private
     * @readonly
     */
    get editor() {
        const me = this;

        let { editor } = me.data;

        if (editor && !editor.isWidget) {
            // Give frameworks a shot at injecting their own editor, wrapped as a widget
            const result = me.grid.processCellEditor({ editor, field : me.field });

            if (result) {
                // Use framework editor
                editor = me.data.editor = result.editor;
            }
            else {
                if (typeof editor === 'string') {
                    editor = {
                        type : editor
                    };
                }

                // The two configs, default and configured must be deep merged.
                editor = me.data.editor = Widget.create(ObjectHelper.merge(me.defaultEditor, {
                    owner : me.grid,

                    // Field labels must be present for A11Y purposes, but are clipped out of visibility.
                    // Screen readers will be able to access them and announce them.
                    label : StringHelper.encodeHtml(me.text)
                }, editor));
            }
        }

        return editor;
    }

    set editor(editor) {
        this.data.editor = editor;
    }

    /**
     * A config object specifying the editor to use to edit this column.
     * @private
     * @readonly
     */
    get defaultEditor() {
        return {
            type : 'textfield',
            name : this.field
        };
    }

    //endregion

    //region Grid, SubGrid & Element

    /**
     * Extracts the value from the record specified by this Column's {@link #config-field} specification
     * in a format that can be used as a value to match by a {@link Grid.feature.Filter filtering} operation.
     *
     * The default implementation returns the {@link #function-getRawValue} value, but this may be
     * overridden in subclasses.
     * @param {Core.data.Model} record The record from which to extract the field value.
     * @returns {*} The value of the referenced field if any.
     */
    getFilterableValue(record) {
        return this.getRawValue(record);
    }

    // Create an ownership hierarchy which links columns up to their SubGrid if no owner injected.
    get owner() {
        return this._owner || this.subGrid;
    }

    set owner(owner) {
        this._owner = owner;
    }

    get grid() {
        return this._grid || this.parent?.grid;
    }

    // Private, only used in tests where standalone Headers are created with no grid
    // from which to lookup the associate SubGrid.
    set subGrid(subGrid) {
        this._subGrid = subGrid;
    }

    /**
     * Get the SubGrid to which this column belongs
     * @property {Grid.view.SubGrid}
     * @readonly
     */
    get subGrid() {
        return this._subGrid || this.grid?.getSubGridFromColumn(this);
    }

    /**
     * Get the element for the SubGrid to which this column belongs
     * @property {HTMLElement}
     * @readonly
     * @private
     */
    get subGridElement() {
        return this.subGrid.element;
    }

    /**
     * The header element for this Column. *Only available after the grid has been rendered*.
     *
     * **Note that column headers are rerendered upon mutation of Column values, so this
     * value is volatile and should not be cached, but should be read whenever needed.**
     * @property {HTMLElement}
     * @readonly
     */
    get element() {
        return this.grid.getHeaderElement(this);
    }

    get nextVisibleSibling() {
        // During move from one region to another, nextSibling might not be wired up to the new next sibling in region.
        // (Because the order in master store did not change)
        const region = this.region;

        let next = this.nextSibling;
        while (next && (next.hidden || next.region !== region)) {
            next = next.nextSibling;
        }
        return next;
    }

    get isLastInSubGrid() {
        return !this.nextVisibleSibling && (!this.parent || this.parent.isLastInSubGrid);
    }

    /**
     * The text wrapping element for this Column. *Only available after the grid has been rendered*.
     *
     * This is the full-width element which *contains* the text-bearing element and any icons.
     *
     * **Note that column headers are rerendered upon mutation of Column values, so this
     * value is volatile and should not be cached, but should be read whenever needed.**
     * @property {HTMLElement}
     * @readonly
     */
    get textWrapper() {
        return DomHelper.getChild(this.element, '.b-grid-header-text');
    }

    /**
     * The text containing element for this Column. *Only available after the grid has been rendered*.
     *
     * **Note that column headers are rerendered upon mutation of Column values, so this
     * value is volatile and should not be cached, but should be read whenever needed.**
     * @property {HTMLElement}
     * @readonly
     */
    get textElement() {
        return DomHelper.down(this.element, '.b-grid-header-text-content');
    }

    /**
     * The child element into which content should be placed. This means where any
     * contained widgets such as filter input fields should be rendered. *Only available after the grid has been
     * rendered*.
     *
     * **Note that column headers are rerendered upon mutation of Column values, so this
     * value is volatile and should not be cached, but should be read whenever needed.**
     * @property {HTMLElement}
     * @readonly
     */
    get contentElement() {
        return DomHelper.down(this.element, '.b-grid-header-children');
    }

    //endregion

    //region Misc properties

    get isSorted() {
        return this.grid.store.sorters.some(s => s.field === this.field);
    }

    get isFocusable() {
        return this.isLeaf;
    }

    static get text() {
        return this.$meta.fields.defaults.text;
    }

    /**
     * Returns header text based on {@link #config-htmlEncodeHeaderText} config value.
     * @returns {String}
     * @internal
     */
    get headerText() {
        return this.htmlEncodeHeaderText ? StringHelper.encodeHtml(this.text) : this.text;
    }

    //endregion

    //region Show/hide

    get isVisible() {
        return !this.hidden && (!this.parent || this.parent.isVisible);
    }

    /**
     * Hides this column.
     */
    hide(silent = false) {
        const
            me         = this,
            { parent } = me;

        // Reject non-change
        if (!me.hidden) {
            me.hidden = true;

            if (parent && !parent.isRoot) {
                // check if all sub columns are hidden, if so hide parent
                const anyVisible = parent.children.some(child => child.hidden !== true);
                if (!anyVisible && !parent.hidden) {
                    silent = true; // hiding parent will trigger event
                    parent.hide();
                }
            }

            me.children?.forEach(child => child.hide(true));

            if (!silent) {
                me.stores.forEach(store => store.trigger('columnHide', { column : me }));
            }
        }
    }

    /**
     * Shows this column.
     */
    show(silent = false) {
        const
            me         = this,
            { parent } = me;

        // Reject non-change
        if (me.hidden) {
            me.hidden = false;

            if (parent?.hidden) {
                parent.show();
            }

            me.children?.forEach(child => child.show(true));

            // event is triggered on chained stores
            if (!silent) {
                me.stores.forEach(store => store.trigger('columnShow', { column : me }));
            }
        }
    }

    /**
     * Toggles the column visibility.
     * @param {Boolean} force Set to true (visible) or false (hidden) to force a certain state
     */
    toggle(force = null) {
        if ((this.hidden && force === undefined) || force === true) {
            return this.show();
        }

        if ((!this.hidden && force === undefined) || force === false) {
            return this.hide();
        }
    }

    //endregion

    //region Index & id

    /**
     * Generates an id for the column when none is set. Generated ids are 'col1', 'col2' and so on. If a field is
     * specified (as it should be in most cases) the field name is used instead: 'name1', 'age2' ...
     * @private
     * @returns {String}
     */
    generateId() {
        if (!Column.generatedIdIndex) {
            Column.generatedIdIndex = 0;
        }

        return (this.field ? this.field.replace(/\./g, '-') : 'col') + (++Column.generatedIdIndex);
    }

    /**
     * Index among all flattened columns
     * @property {Number}
     * @readOnly
     * @internal
     */
    get allIndex() {
        return this.masterStore.indexOf(this);
    }

    //endregion

    //region Width

    // Returns size in pixels for measured value
    measureSize(value) {
        return DomHelper.measureSize(value, this.subGrid?.element);
    }

    /**
     * Returns minimal width in pixels for applying to style according to the current `width` and `minWidth`.
     * @internal
     */
    get calcMinWidth() {
        const { width, minWidth } = this.data;

        if (validWidth(width) && validWidth(minWidth)) {
            return Math.max(parseInt(width) || 0, parseInt(minWidth) || 0);
        }
        else {
            return width;
        }
    }

    /**
     * Get/set columns width in px. If column uses flex, width will be undefined.
     * Setting a width on a flex column cancels out flex.
     *
     * **NOTE:** Grid might be configured to always stretch the last column, in which case the columns actual width
     * might deviate from the configured width.
     *
     * ```javascript
     * let grid = new Grid({
     *     appendTo : 'container',
     *     height   : 200,
     *     width    : 400,
     *     columns  : [{
     *         text  : 'First column',
     *         width : 100
     *     }, {
     *         text  : 'Last column',
     *         width : 100 // last column in the grid is always stretched to fill the free space
     *     }]
     * });
     *
     * grid.columns.last.element.offsetWidth; // 300 -> this points to the real element width
     * ```
     * @property {Number|String}
     */
    get width() {
        return this.data.width;
    }

    set width(width) {
        const data = { width };
        if (width && ('flex' in this.data)) {
            data.flex = null; // remove flex when setting width to enable resizing flex columns
        }
        this.set(data);
    }

    set flex(flex) {
        const data = { flex };
        if (flex && ('width' in this.data)) {
            data.width = null; // remove width when setting flex
        }
        this.set(data);
    }

    get flex() {
        return this.data.flex;
    }

    // This method is used to calculate minimum row width for edge and safari
    // It calculates minimum width of the row taking column hierarchy into account
    calculateMinWidth() {
        const
            me       = this,
            width    = me.measureSize(me.width),
            minWidth = me.measureSize(me.minWidth);

        let minChildWidth = 0;

        if (me.children) {
            minChildWidth = me.children.reduce((result, column) => {
                return result + column.calculateMinWidth();
            }, 0);
        }

        return Math.max(width, minWidth, minChildWidth);
    }

    /**
     * Resizes the column to match the widest string in it. By default it also measures the column header, this
     * behaviour can be configured by setting {@link Grid.view.Grid#config-resizeToFitIncludesHeader}.
     *
     * Called internally when you double click the edge between
     * column headers, but can also be called programmatically. For performance reasons it is limited to checking 1000
     * rows surrounding the current viewport.
     *
     * @param {Number|Number[]} widthMin Minimum allowed width. If content width is less than this, this width is used
     * instead. If this parameter is an array, the first element is `widthMin` and the seconds is `widthMax`.
     * @param {Number} widthMax Maximum allowed width. If the content width is greater than this number, this width
     * is used instead.
     */
    resizeToFitContent(widthMin, widthMax, batch = false) {
        const
            me                    = this,
            {
                grid,
                element,
                fitMode
            } = me,
            { rowManager, store } = grid,
            { count }             = store;

        if (count <= 0 || me.fitMode === 'none' || !me.fitMode) {
            return;
        }

        const
            [row]       = rowManager.rows,
            {
                rowElement,
                cellElement
            }           = grid.beginGridMeasuring(),
            cellContext = new Location({
                grid,
                column : me,
                id     : null
            });

        let maxWidth = 0,
            start, end, i, record, value, length, longest = { length : 0, record : null };

        // Fake element data to be able to use Row#renderCell()
        cellElement._domData = {
            columnId : me.id,
            row,
            rowElement
        };

        cellContext._cell             = cellElement;
        cellContext.updatingSingleRow = true;
        cellContext.isMeasuring       = true;

        // Clear cellElement, since it is being reused between columns
        cellElement.innerHTML = '';

        // Measure header unless configured not to
        if (grid.resizeToFitIncludesHeader) {
            // Cache the padding
            if (!grid.$headerPadding) {
                const style = globalThis.getComputedStyle(element);
                grid.$headerPadding = parseInt(style.paddingLeft);
            }
            // Grab the header text content element
            const headerText = element.querySelector('.b-grid-header-text-content');
            // Restyle it to shrinkwrap its text, measure and then restore
            headerText.style.cssText = 'flex: none; width: auto';
            maxWidth = headerText.offsetWidth + grid.$headerPadding * 2 + 2; // +2 to avoid overflow ellipsis
            headerText.style.cssText = '';
        }

        // If it's a very large dataset, measure the maxWidth of the field in the 1000 rows
        // surrounding the rendered block.
        if (count > 1000) {
            start = Math.max(Math.min(rowManager.topIndex + Math.round(rowManager.rowCount / 2) - 500, count - 1000), 0);
            end = start + 1000;
        }
        else {
            start = 0;
            end = count;
        }

        for (i = start; i < end; i++) {
            record = store.getAt(i);
            value = me.getRawValue(record);

            // In value mode we determine the record with the longest value, no rendering involved
            if (fitMode === 'value') {
                length = String(value).length;
            }
            // In exact and textContent modes we have to render the records
            else {
                cellContext._record   = longest.record;
                cellContext._id       = record.id;
                cellContext._rowIndex = i;

                row.renderCell(cellContext);

                // Reading textContent is "cheap", it does not require a layout
                if (fitMode === 'textContent') {
                    length = cellElement.textContent.length;
                }
                // Using exact mode, measure the cell = expensive
                else {
                    const width = cellElement.offsetWidth;
                    if (width > maxWidth) {
                        maxWidth = width;
                    }
                }
            }

            if (length > longest.length) {
                longest = { record, length, rowIndex : i };
            }
        }

        // value mode and textContent mode both required us to render and measure the record determined to be the
        // longest above
        if (fitMode === 'value' || fitMode === 'textContent') {
            cellContext._record = longest.record;
            cellContext._id = longest.record.id;
            cellContext._rowIndex = longest.rowIndex;
            row.renderCell(cellContext);
            maxWidth = Math.max(maxWidth, cellElement.offsetWidth);
        }

        if (Array.isArray(widthMin)) {
            [widthMin, widthMax] = widthMin;
        }

        maxWidth = Math.max(maxWidth, widthMin || 0);
        maxWidth = Math.min(maxWidth, widthMax || 1e6);  // 1 million px default max

        // Batch mode saves a little time by not removing the measuring elements between columns
        if (!batch) {
            grid.endGridMeasuring();
        }

        me.width = me.maxWidth ? (maxWidth = Math.min(maxWidth, me.maxWidth)) : maxWidth;

        return maxWidth;
    }

    //endregion

    //region State

    /**
     * Get column state, used by State mixin
     * @private
     */
    getState() {
        const
            me    = this,
            state = {
                id     : me.id,
                // State should only store column attributes which user can modify via UI (except column index).
                // User can hide column, resize or move it to neighbor region
                hidden : me.hidden,
                region : me.region,
                locked : me.locked
            };

        if (!me.children) {
            state[me.flex ? 'flex' : 'width'] = me.flex || me.width;
        }

        return state;
    }

    /**
     * Apply state to column, used by State mixin
     * @private
     */
    applyState(state) {
        const me = this;

        me.beginBatch();

        if ('locked' in state) {
            me.locked = state.locked;
        }

        if ('width' in state) {
            me.width = state.width;
        }

        if ('flex' in state) {
            me.flex = state.flex;
        }

        if ('width' in state && me.flex) {
            me.flex = undefined;
        }
        else if ('flex' in state && me.width) {
            me.width = undefined;
        }

        if ('region' in state) {
            me.region = state.region;
        }

        me.endBatch();

        if ('hidden' in state) {
            me.toggle(state.hidden !== true);
        }
    }

    //endregion

    //region Other

    remove() {
        const
            { subGrid, grid } = this,
            focusedCell       = subGrid && grid?.focusedCell;

        // Prevent errors when removing the column that the owning grid has registered as focused.
        if (focusedCell?.columnId === this.id) {

            // Focus is in the grid, navigate before column is removed
            if (grid.owns(DomHelper.getActiveElement(grid))) {
                grid.navigateRight();
            }
            // Focus not in the grid, bump the focused cell pointer to the next visible column
            // for when focus returns so it can go as close as possible.
            else {
                grid._focusedCell = new Location({
                    grid,
                    rowIndex : focusedCell.rowIndex,
                    column   : subGrid.columns.getAdjacentVisibleLeafColumn(this.id, true, true)
                });
            }
        }
        super.remove();
    }

    /**
     * Extracts the value from the record specified by this Column's {@link #config-field} specification.
     *
     * This will work if the field is a dot-separated path to access fields in associated records, eg
     *
     * ```javascript
     *  field : 'resource.calendar.name'
     * ```
     *
     * **Note:** This is the raw field value, not the value returned by the {@link #config-renderer}.
     * @param {Core.data.Model} record The record from which to extract the field value.
     * @returns {*} The value of the referenced field if any.
     */
    getRawValue(record) {
        if (this.hasComplexMapping) {
            return ObjectHelper.getPath(record, this.field);
        }

        // Engine can change field value to null, in which case cell will render previous record value,
        // before project commit
        return record[this.field];
    }

    /**
     * Refresh the cell for supplied record in this column, if that cell is rendered.
     * @param {Core.data.Model} record Record used to get row to update the cell in
     */
    refreshCell(record) {
        this.grid.rowManager.refreshCell(record, this.id);
    }

    /**
     * Clear cell contents. Base implementation which just sets innerHTML to blank string.
     * Should be overridden in subclasses to clean up for examples widgets.
     * @param {HTMLElement} cellElement
     * @internal
     */
    clearCell(cellElement) {
        cellElement.innerHTML = '';

        delete cellElement._content;
    }

    /**
     * Override in subclasses to allow/prevent editing of certain rows.
     * @param {Core.data.Model} record
     * @internal
     */
    canEdit(record) {
        // the record can decide which column is editable
        if (record.isEditable) {
            const isEditable = record.isEditable(this.field);
            // returns undefined for unknown field
            if (isEditable !== undefined) {
                return isEditable;
            }
        }

        return true;
    }

    /**
     * Insert a child column(s) before an existing child column. Returns `null` if the parent column is
     * {@link #config-sealed}
     * @param {Core.data.Model|Core.data.Model[]} childColumn Column or array of columns to insert
     * @param {Core.data.Model} [before] Optional column to insert before, leave out to append to the end
     * @param {Boolean} [silent] Pass `true` to not trigger events during insert
     * @returns {Core.data.Model|Core.data.Model[]|null}
     * @category Parent & children
     */
    insertChild(childColumn, before = null, silent = false) {
        return (this.sealed && !this.inProcessChildren) ? null : super.insertChild(...arguments);
    }

    //endregion

    // This function is not meant to be called by any code other than Base#getCurrentConfig().
    // It extracts the current configs (fields) for the column, with special handling for sortable, editor, renderer and
    // headerRenderer
    getCurrentConfig(options) {
        const result = super.getCurrentConfig(options);

        // Use unbound sort fn
        if (this.sortable?.originalSortFn) {
            result.sortable = this.sortable.originalSortFn;
        }

        // Dont include internalRenderer in current config
        if (result.renderer === this.internalRenderer) {
            delete result.renderer;
        }

        // Same for headerRenderer
        if (result.headerRenderer === this.internalHeaderRenderer) {
            delete result.headerRenderer;
        }

        delete result.ariaLabel;
        delete result.cellAriaLabel;

        return result;
    }
}

// Registered in ColumnStore as we can't have this in Column due to circular dependencies

Column.emptyCount = 0;
Column.defaultWidth = 100;
Column.exposeProperties();
