//region Import

import Base from '../../Core/Base.js';

import AjaxStore from '../../Core/data/AjaxStore.js';
import DomDataStore from '../../Core/data/DomDataStore.js';
import Store from '../../Core/data/Store.js';

import ArrayHelper from '../../Core/helper/ArrayHelper.js';
import BrowserHelper from '../../Core/helper/BrowserHelper.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import EventHelper from '../../Core/helper/EventHelper.js';
import ObjectHelper from '../../Core/helper/ObjectHelper.js';
import Rectangle from '../../Core/helper/util/Rectangle.js';
import VersionHelper from '../../Core/helper/VersionHelper.js';
import ScrollManager from '../../Core/util/ScrollManager.js';

import Mask from '../../Core/widget/Mask.js';
import Panel from '../../Core/widget/Panel.js';
import GlobalEvents from '../../Core/GlobalEvents.js';

import LocaleManager from '../../Core/localization/LocaleManager.js';
import Pluggable from '../../Core/mixin/Pluggable.js';
import State from '../../Core/mixin/State.js';
import ColumnStore, { columnResizeEvent } from '../data/ColumnStore.js';
import GridRowModel from '../data/GridRowModel.js';
import RowManager from '../row/RowManager.js';
import GridScroller from '../util/GridScroller.js';
import Location from '../util/Location.js';
import Header from './Header.js';
import Footer from './Footer.js';

import GridElementEvents from './mixin/GridElementEvents.js';
import GridFeatures from './mixin/GridFeatures.js';
import GridNavigation from './mixin/GridNavigation.js';
import GridResponsive from './mixin/GridResponsive.js';
import GridSelection from './mixin/GridSelection.js';
import GridState from './mixin/GridState.js';
import GridSubGrids from './mixin/GridSubGrids.js';
import LoadMaskable from '../../Core/mixin/LoadMaskable.js';

import Column from '../column/Column.js';

// Needed since Grid now has its own localization
import '../localization/En.js';

//endregion

/**
 * @module Grid/view/GridBase
 */

const
    resolvedPromise       = new Promise(resolve => resolve()),
    storeListenerName     = 'GridBase:store',
    defaultScrollOptions  = {
        block  : 'nearest',
        inline : 'nearest'
    },
    datasetReplaceActions = {
        dataset  : 1,
        pageLoad : 1,
        filter   : 1
    };

/**
 * A thin base class for {@link Grid.view.Grid}. Does not include any features by default, allowing smaller custom built
 * bundles if used in place of {@link Grid.view.Grid}.
 *
 * **NOTE:** In most scenarios you probably want to use Grid instead of GridBase.

 * @extends Core/widget/Panel
 *
 * @mixes Core/mixin/Pluggable
 * @mixes Core/mixin/State
 * @mixes Grid/view/mixin/GridElementEvents
 * @mixes Grid/view/mixin/GridFeatures
 * @mixes Grid/view/mixin/GridResponsive
 * @mixes Grid/view/mixin/GridSelection
 * @mixes Grid/view/mixin/GridState
 * @mixes Grid/view/mixin/GridSubGrids
 * @mixes Core/mixin/LoadMaskable
 *
 * @features Grid/feature/CellEdit
 * @features Grid/feature/CellMenu
 * @features Grid/feature/CellTooltip
 * @features Grid/feature/ColumnAutoWidth
 * @features Grid/feature/ColumnDragToolbar
 * @features Grid/feature/ColumnPicker
 * @features Grid/feature/ColumnReorder
 * @features Grid/feature/ColumnResize
 * @features Grid/feature/Filter
 * @features Grid/feature/FilterBar
 * @features Grid/feature/Group
 * @features Grid/feature/GroupSummary
 * @features Grid/feature/HeaderMenu
 * @features Grid/feature/MergeCells
 * @features Grid/feature/QuickFind
 * @features Grid/feature/RegionResize
 * @features Grid/feature/RowCopyPaste
 * @features Grid/feature/RowExpander
 * @features Grid/feature/RowReorder
 * @features Grid/feature/Search
 * @features Grid/feature/Sort
 * @features Grid/feature/StickyCells
 * @features Grid/feature/Stripe
 * @features Grid/feature/Summary
 * @features Grid/feature/Tree
 * @features Grid/feature/TreeGroup
 *
 * @features Grid/feature/experimental/ExcelExporter
 *
 * @features Grid/feature/export/PdfExport
 * @features Grid/feature/export/exporter/MultiPageExporter
 * @features Grid/feature/export/exporter/MultiPageVerticalExporter
 * @features Grid/feature/export/exporter/SinglePageExporter
 *
 * @plugins Grid/row/RowManager
 */
export default class GridBase extends Panel.mixin(
    Pluggable,
    State,
    GridElementEvents,
    GridFeatures,
    GridNavigation,
    GridResponsive,
    GridSelection,
    GridState,
    GridSubGrids,
    LoadMaskable
) {
    //region Config

    static get $name() {
        return 'GridBase';
    }

    // Factoryable type name
    static get type() {
        return 'gridbase';
    }

    static get delayable() {
        return {
            onGridScroll : {
                type : 'raf'
            },

            onGridVerticalScroll : {
                type : 'raf'
            },

            bufferedAfterColumnsResized : 250,

            bufferedElementResize : 250
        };
    }

    static get configurable() {
        return {
            //region Hidden configs

            /**
             * @hideconfigs autoUpdateRecord, defaults, hideWhenEmpty, itemCls, items, layout, layoutStyle, lazyItems, namedItems, record, textContent, defaultAction, html, htmlCls, tag, textAlign, trapFocus, content, defaultBindProperty, ripple
             */

            /**
             * @hideproperties html, isSettingValues, isValid, items, record, values, content, layoutStyle
             */

            /**
             * @hidefunctions attachTooltip, add, getWidgetById, insert, processWidgetConfig, remove, removeAll
             */

            //endregion

            /**
             * Set to `true` to make the grid read-only, by disabling any UIs for modifying data.
             *
             * __Note that checks MUST always also be applied at the server side.__
             * @prp {Boolean} readOnly
             * @default false
             * @category Misc
             */

            /**
             * Automatically set grids height to fit all rows (no scrolling in the grid). In general you should avoid
             * using `autoHeight: true`, since it will bypass Grids virtual rendering and render all rows at once, which
             * in a larger grid is really bad for performance.
             * @config {Boolean}
             * @default false
             * @category Layout
             */
            autoHeight : null,

            /**
             * Configure this as `true` to allow elements within cells to be styled as `position: sticky`.
             *
             * Columns which contain sticky content will need to be configured with
             *
             * ```javascript
             *    cellCls : 'b-sticky-cell',
             * ```
             *
             * Or a custom renderer can add the class to the passed cell element.
             *
             * It is up to the application author how to style the cell content. It is recommended that
             * a custom renderer create content with CSS class names which the application author
             * will use to apply the `position`, and matching `margin-top` and `top` styles to keep the
             * content stuck at the grid's top.
             *
             * Note that not all browsers support this CSS feature. A cross browser alternative
             * is to use the {link Grid.feature.StickyCells StickyCells} Feature.
             * @config {Boolean}
             * @category Misc
             */
            enableSticky : null,

            /**
             * Set to true to allow text selection in the grid cells. Note, this cannot be used simultaneously with the
             * `RowReorder` feature.
             * @config {Boolean}
             * @default false
             * @category Selection
             */
            enableTextSelection : null,

            /**
             * Set to `true` to stretch the last column in a grid with all fixed width columns
             * to fill extra available space if the grid's width is wider than the sum of all
             * configured column widths.
             * @config {Boolean}
             * @default
             * @category Layout
             */
            fillLastColumn : true,

            /**
             * See {@link Grid.view.Grid#keyboard-shortcuts Keyboard shortcuts} for details
             * @config {Object} keyMap
             * @category Common
             */

            // TODO: break out as strategies
            positionMode : 'translate', // translate, translate3d, position

            /**
             * Configure as `true` to have the grid show a red "changed" tag in cells who's
             * field value has changed and not yet been committed.
             * @config {Boolean}
             * @default false
             * @category Misc
             */
            showDirty : null,

            /**
             * An object containing sub grid configuration objects keyed by a `region` property.
             * By default, grid has a 'locked' region (if configured with locked columns) and a 'normal' region.
             * The 'normal' region defaults to use `flex: 1`.
             *
             * This config can be used to reconfigure the "built in" sub grids or to define your own.
             *
             * Redefining the default regions:
             *
             * {@frameworktabs}
             * {@js}
             * ```javascript
             * new Grid({
             *   subGridConfigs : {
             *     locked : { flex : 1 },
             *     normal : { width : 100 }
             *   }
             * });
             * ```
             * {@endjs}
             * {@react}
             * ```jsx
             * const App = props => {
             *     const subGridConfigs = {
             *         locked : { flex : 1 },
             *         normal : { width : 100 }
             *     };
             *
             *     return <bryntum-grid subGridConfigs={subGridConfigs} />
             * }
             * ```
             * {@endreact}
             * {@vue}
             * ```html
             * <bryntum-grid :sub-grid-configs="subGridConfigs" />
             * ```
             * ```javascript
             * export default {
             *     setup() {
             *         return {
             *             subGridConfigs : [
             *                 locked : { flex : 1 },
             *                 normal : { width : 100 }
             *             ]
             *         };
             *     }
             * }
             * ```
             * {@endvue}
             * {@angular}
             * ```html
             * <bryntum-grid [subGridConfigs]="subGridConfigs"></bryntum-grid>
             * ```
             * ```typescript
             * export class AppComponent {
             *      subGridConfigs = [
             *          locked : { flex : 1 },
             *          normal : { width : 100 }
             *      ]
             *  }
             * ```
             * {@endangular}
             * {@endframeworktabs}
             *
             * Defining your own multi region grid:
             *
             * ```javascript
             * new Grid({
             *   subGridConfigs : {
             *     left   : { width : 100 },
             *     middle : { flex : 1 },
             *     right  : { width  : 100 }
             *   },
             *
             *   columns : {
             *     { field : 'manufacturer', text: 'Manufacturer', region : 'left' },
             *     { field : 'model', text: 'Model', region : 'middle' },
             *     { field : 'year', text: 'Year', region : 'middle' },
             *     { field : 'sales', text: 'Sales', region : 'right' }
             *   }
             * });
             * ```
             * @config {Object}
             * @category Misc
             */
            subGridConfigs : {
                normal : { flex : 1 }
            },

            /**
             * Store that holds records to display in the grid, or a store config object. If the configuration contains
             * a `readUrl`, an `AjaxStore` will be created.
             *
             * Note that a store will be created during initialization if none is specified.
             *
             * Supplying a store config object at initialization time:
             *
             * ```javascript
             * const grid = new Grid({
             *     store : {
             *         fields : ['name', 'powers'],
             *         data   : [
             *             { id : 1, name : 'Aquaman', powers : 'Decent swimmer' },
             *             { id : 2, name : 'Flash', powers : 'Pretty fast' },
             *         ]
             *     }
             * });
             * ```
             *
             * Accessing the store at runtime:
             *
             * ```javascript
             * grid.store.sort('powers');
             * ```
             *
             * @prp {Core.data.Store}
             * @accepts {Core.data.Store|Object}
             * @category Common
             */
            store : {
                value : {},

                $config : 'nullify'
            },

            rowManager : {
                value : {},

                $config : ['nullify', 'lazy']
            },

            /**
             * Configuration values for the {@link Core.util.ScrollManager} class on initialization. Returns the
             * {@link Core.util.ScrollManager} at runtime.
             *
             * @prp {Core.util.ScrollManager}
             * @accepts {Object|Core.util.ScrollManager}
             * @readonly
             * @category Scrolling
             */
            scrollManager : {
                value : {},

                $config : ['nullify', 'lazy']
            },

            /**
             * Accepts column definitions for the grid during initialization. They will be used to create
             * {@link Grid/column/Column} instances that are added to a {@link Grid/data/ColumnStore}.
             *
             * At runtime it is read-only and returns the {@link Grid/data/ColumnStore}.
             *
             * Initialization using column config objects:
             *
             * ```javascript
             * new Grid({
             *   columns : [
             *     { text : 'Alias', field : 'alias' },
             *     { text : 'Superpower', field : 'power' }
             *   ]
             * });
             * ```
             *
             * Also accepts a store config object:
             *
             * ```javascript
             * new Grid({
             *   columns : {
             *     data : [
             *       { text : 'Alias', field : 'alias' },
             *       { text : 'Superpower', field : 'power' }
             *     ],
             *     listeners : {
             *       update() {
             *         // Some update happened
             *       }
             *     }
             *   }
             * });
             * ```
             *
             * Access the {@link Grid/data/ColumnStore} at runtime to manipulate columns:
             *
             * ```javascript
             * grid.columns.add({ field : 'column', text : 'New column' });
             * ```
             * @prp {Grid.data.ColumnStore}
             * @accepts {Grid.data.ColumnStore|Object[]|Object}
             * @readonly
             * @category Common
             */
            columns : {
                value : [],

                $config : 'nullify'
            },

            /**
             * Grid's `min-height`. Defaults to `10em` to be sure that the Grid always has a height wherever it is
             * inserted.
             *
             * Can be either a String or a Number (which will have 'px' appended).
             *
             * Note that _reading_ the value will return the numeric value in pixels.
             *
             * @config {String|Number}
             * @category Layout
             */
            minHeight : '10em',

            hideFooters : true,

            contentElMutationObserver : false,
            trapFocus                 : false,

            ariaElement : 'bodyElement',

            cellTabIndex : -1,

            rowCls : {
                value   : 'b-grid-row',
                $config : {
                    merge : this.mergeCls
                }
            },

            cellCls : {
                value   : 'b-grid-cell',
                $config : {
                    merge : this.mergeCls
                }
            }
        };
    }

    // Default settings, applied in grids constructor.
    static get defaultConfig() {
        return {
            /**
             * Row height in pixels. This allows the default height for rows to be controlled. Note that it may be
             * overriden by specifying a {@link Grid/data/GridRowModel#field-rowHeight} on a per record basis, or from
             * a column {@link Grid/column/Column#config-renderer}.
             *
             * When initially configured as `null`, an empty row will be measured and its height will be used as default
             * row height, enabling it to be controlled using CSS
             *
             * @prp {Number}
             * @category Common
             */
            rowHeight : null,

            /**
             * Use fixed row height. Setting this to `true` will configure the underlying RowManager to use fixed row
             * height, which sacrifices the ability to use rows with variable height to gain a fraction better
             * performance.
             *
             * Using this setting also ignores the {@link Grid.view.GridBase#config-getRowHeight} function, and thus any
             * row height set in data. Only Grids configured {@link Grid.view.GridBase#config-rowHeight} is used.
             *
             * @config {Boolean}
             * @category Layout
             */
            fixedRowHeight : null,

            /**
             * A function called for each row to determine its height. It is passed a {@link Core.data.Model record} and
             * expected to return the desired height of that records row. If the function returns a falsy value, Grids
             * configured {@link Grid.view.GridBase#config-rowHeight} is used.
             *
             * The default implementation of this function returns the row height from the records
             * {@link Grid.data.GridRowModel#field-rowHeight rowHeight field}.
             *
             * Override this function to take control over how row heights are determined:
             *
             * ```javascript
             * new Grid({
             *    getRowHeight(record) {
             *        if (record.low) {
             *            return 20;
             *        }
             *        else if (record.high) {
             *            return 60;
             *        }
             *
             *        // Will use grids configured rowHeight
             *        return null;
             *    }
             * });
             * ```
             *
             * NOTE: Height set in a Column renderer takes precedence over the height returned by this function.
             *
             * @config {Function} getRowHeight
             * @param {Core.data.Model} getRowHeight.record Record to determine row height for
             * @returns {Number} Desired row height
             * @category Layout
             */

            // used if no rowHeight specified and none found in CSS. not public since our themes have row height
            // specified and this is more of an internal failsafe
            defaultRowHeight : 45,

            /**
             * Text to display when there is no data to display in the grid
             * @config {String}
             * @default
             * @category Common
             */
            emptyText : 'L{noRows}',

            /**
             * Refresh entire row when a record changes (`true`) or, if possible, only the cells affected (`false`).
             *
             * When this is set to `false`, then if a column uses a renderer, cells in that column will still
             * be updated because it is impossible to know whether the cells value will be affected.
             *
             * If a standard, provided Column class is used with no custom renderer, its cells will only be updated
             * if the column's {@link Grid.column.Column#config-field} is changed.
             * @config {Boolean}
             * @default
             * @category Misc
             */
            fullRowRefresh : true,

            /**
             * True to not create any grid column headers
             * @config {Boolean}
             * @default false
             * @category Misc
             */
            hideHeaders : null,

            /**
             * Specify `true` to preserve vertical scroll position after store actions that trigger a `refresh` event,
             * such as loading new data and filtering.
             * @config {Boolean}
             * @default false
             * @category Misc
             */
            preserveScrollOnDatasetChange : null,

            /**
             * True to preserve focused cell after loading new data
             * @config {Boolean}
             * @default
             * @category Misc
             */
            preserveFocusOnDatasetChange : true,

            /**
             * Convenient shortcut to set data in grids store both during initialization and at runtime. Can also be
             * used to retrieve data at runtime, although we do recommend interacting with Grids store instead using
             * the {@link #property-store} property.
             *
             * Setting initial data during initialization:
             *
             * ```javascript
             * const grid = new Grid({
             *     data : [
             *       { id : 1, name : 'Batman' },
             *       { id : 2, name : 'Robin' },
             *       ...
             *     ]
             * });
             * ```
             *
             * Setting data at runtime:
             *
             * ```javascript
             * grid.data = [
             *     { id : 3, name : 'Joker' },
             *     ...
             * ];
             * ```
             *
             * Getting data at runtime:
             *
             * ```javascript
             * const records = store.data;
             * ```
             *
             * Note that a Store will be created during initialization if none is specified.
             *
             * @prp {Core.data.Model[]}
             * @accepts {Object[]|Core.data.Model[]}
             * @category Common
             */
            data : null,

            /**
             * Region to which columns are added when they have none specified
             * @config {String}
             * @default
             * @category Misc
             */
            defaultRegion : 'normal',

            /**
             * true to destroy the store when the grid is destroyed
             * @config {Boolean}
             * @default false
             * @category Misc
             */
            destroyStore : null,

            /**
             * Grids change the `maskDefaults` to cover only their `body` element.
             * @config {Object|Core.widget.Mask}
             * @category Misc
             */
            maskDefaults : {
                cover  : 'body',
                target : 'element'
            },

            /**
             * Set to `false` to inhibit column lines during initialization or assign to it at runtime to toggle column
             * line visibility.
             *
             * End result might be overruled by/differ between themes.
             *
             * @prp {Boolean}
             * @default
             * @category Misc
             */
            columnLines : true,

            /**
             * Set to `false` to only measure cell contents when double clicking the edge between column headers.
             * @config {Boolean}
             * @default
             * @category Layout
             */
            resizeToFitIncludesHeader : true,

            /**
             * Set to `false` to prevent remove row animation and remove the delay related to that.
             * @config {Boolean}
             * @default
             * @category Misc
             */
            animateRemovingRows : true,

            /**
             * Set to `true` to not get a warning when using another base class than GridRowModel for your grid data. If
             * you do, and would like to use the full feature set of the grid then include the fields from GridRowModel
             * in your model definition.
             * @config {Boolean}
             * @default false
             * @category Misc
             */
            disableGridRowModelWarning : null,

            headerClass : Header,
            footerClass : Footer,

            testPerformance : false,
            rowScrollMode   : 'move', // move, dom, all

            /**
             * Grid monitors window resize by default.
             * @config {Boolean}
             * @default true
             * @category Misc
             */
            monitorResize : true,

            /**
             * An object containing Feature configuration objects (or `true` if no configuration is required)
             * keyed by the Feature class name in all lowercase.
             * @config {Object}
             * @category Common
             */
            features : true,

            /**
             * Configures whether the grid is scrollable in the `Y` axis. This is used to configure a {@link Grid.util.GridScroller}.
             * See the {@link #config-scrollerClass} config option.
             * @config {Boolean|Object|Core.helper.util.Scroller}
             * @category Scrolling
             */
            scrollable : {
                // Just Y for now until we implement a special grid.view.Scroller subclass
                // Which handles the X scrolling of subgrids.
                overflowY : true
            },

            /**
             * The class to instantiate to use as the {@link #config-scrollable}. Defaults to {@link Grid.util.GridScroller}.
             * @config {Core.helper.util.Scroller}
             * @typings {typeof Scroller}
             * @category Scrolling
             */
            scrollerClass : GridScroller,

            refreshSuspended : 0,

            /**
             * Animation transition duration in milliseconds.
             * @prp {Number}
             * @default
             * @category Misc
             */
            transitionDuration : 500,

            /**
             * Event which is used to show context menus.
             * Available options are: 'contextmenu', 'click', 'dblclick'.
             * @config {'contextmenu'|'click'|'dblclick'}
             * @category Misc
             * @default
             */
            contextMenuTriggerEvent : 'contextmenu',

            localizableProperties : ['emptyText'],

            asyncEventSuffix : '',

            testConfig : {
                transitionDuration : 50
            }
        };
    }

    static getLKey() {
        return '8fd60302-436b-11ed-9a0f-d094663d5c88';
    }

    static get properties() {
        return {
            _selectedRecords      : [],
            _verticalScrollHeight : 0,
            virtualScrollHeight   : 0,
            _scrollTop            : null
        };
    }

    // Keep this commented out to have easy access to the syntax next time we need to use it
    // static get deprecatedEvents() {
    //     return {
    //         cellContextMenuBeforeShow : {
    //             product            : 'Grid',
    //             invalidAsOfVersion : '5.0.0',
    //             message            : '`cellContextMenuBeforeShow` event is deprecated, in favor of `cellMenuBeforeShow` event. Please see https://bryntum.com/docs/grid/#Grid/guides/upgrades/4.0.0.md for more information.'
    //         }
    //     };
    // }

    //endregion

    //region Init-destroy

    finishConfigure(config) {
        const me = this;

        super.finishConfigure(config);

        // When locale is applied columns react and change, which triggers `change` event on columns store for each
        // changed column, and every change normally triggers rendering view. This overhead becomes noticeable with
        // larger amount of columns. So we set two listeners to locale events: prioritized listener to be executed first
        // and suspend renderContents method and unprioritized one to resume method and call it immediately.
        LocaleManager.on({
            locale  : 'onBeforeLocaleChange',
            prio    : 1,
            thisObj : me
        });

        LocaleManager.on({
            locale  : 'onLocaleChange',
            prio    : -1,
            thisObj : me
        });

        GlobalEvents.on({
            theme   : 'onThemeChange',
            thisObj : me
        });

        me.on({
            subGridExpand : 'onSubGridExpand',
            prio          : -1,
            thisObj       : me
        });

        // Buffered for scrolling, to be called
        me.bufferedFixElementHeights = me.buffer('fixElementHeights', 350, me);

        // Add the extra grid classes to the element
        me.setGridClassList(me.element.classList);
    }

    onSubGridExpand() {
        // Need to rerender all rows, because if the rows were rerendered (by adding a new column to another region for example)
        // while the region was collapsed, cells in the region will be empty.
        this.renderContents();
    }

    onBeforeLocaleChange() {
        this._suspendRenderContentsOnColumnsChanged = true;
    }

    onLocaleChange() {
        this._suspendRenderContentsOnColumnsChanged = false;
        if (this.isPainted) {
            this.renderContents();
        }
    }

    finalizeInit() {
        super.finalizeInit();

        if (this.store.isLoading) {
            // Maybe show loadmask if store is already loading when grid is constructed
            this.onStoreBeforeRequest();
        }
    }

    changeScrollManager(scrollManager, oldScrollManager) {
        oldScrollManager?.destroy();

        if (scrollManager) {
            return ScrollManager.new({
                element : this.element,
                owner   : this
            }, scrollManager);
        }
        else {
            return null;
        }
    }

    /**
     * Cleanup
     * @private
     */
    doDestroy() {
        const me = this;

        me.detachListeners(storeListenerName);

        me.scrollManager?.destroy();

        for (const feature of Object.values(me.features)) {
            feature.destroy?.();
        }

        me._focusedCell = null;
        me.columns.destroy();

        super.doDestroy();
    }

    /**
     * Adds extra classes to the Grid element after it's been configured.
     * Also iterates through features, thus ensuring they have been initialized.
     * @private
     */
    setGridClassList(classList) {
        const me = this;

        Object.values(me.features).forEach(feature => {
            if (feature.disabled) {
                return;
            }

            let featureClass;

            if (Object.prototype.hasOwnProperty.call(feature.constructor, 'featureClass')) {
                featureClass = feature.constructor.featureClass;
            }
            else {
                featureClass = `b-${(feature instanceof Base ? feature.$$name : feature.constructor.name)}`;
            }

            if (featureClass) {
                classList.add(featureClass.toLowerCase());
            }
        });
    }

    //endregion

    //region Functions & events injected by features

    // For documentation & typings purposes

    //region Feature events

    /**
     * Fired before a parent node record toggles its collapsed state. Only applicable when the {@link Grid.feature.Tree} feature is enabled
     * @event beforeToggleNode
     * @param {Grid.view.Grid} source The firing Grid instance.
     * @param {Core.data.Model} record The record being toggled.
     * @param {Boolean} collapse `true` if the node is being collapsed.
     */
    /**
     * Fired after a parent node record toggles its collapsed state. Only applicable when the {@link Grid.feature.Tree} feature is enabled
     * @event toggleNode
     * @param {Core.data.Model} record The record being toggled.
     * @param {Boolean} collapse `true` if the node is being collapsed.
     */
    /**
     * Fired before a parent node record is collapsed. Only applicable when the {@link Grid.feature.Tree} feature is enabled
     * @event collapseNode
     * @param {Grid.view.Grid} source The firing Grid instance.
     * @param {Core.data.Model} record The record which has been collapsed.
     */
    /**
     * Fired after a parent node record is expanded. Only applicable when the {@link Grid.feature.Tree} feature is enabled
     * @event expandNode
     * @param {Grid.view.Grid} source The firing Grid instance.
     * @param {Core.data.Model} record The record which has been expanded.
     */

    /**
     * Fires after a sub grid is collapsed.
     * @event subGridCollapse
     * @param {Grid.view.Grid} source The firing Grid instance
     * @param {Grid.view.SubGrid} subGrid The sub grid instance
     */
    /**
     * Fires after a sub grid is expanded.
     * @event subGridExpand
     * @param {Grid.view.Grid} source The firing Grid instance
     * @param {Grid.view.SubGrid} subGrid The sub grid instance
     */
    /**
     * Fires before a row is rendered.
     * @event beforeRenderRow
     * @param {Grid.view.Grid} source The firing Grid instance.
     * @param {Grid.row.Row} row The row about to be rendered.
     * @param {Core.data.Model} record The record for the row.
     * @param {Number} recordIndex The zero-based index of the record.
     */
    /**
     * Fires after a row is rendered.
     * @event renderRow
     * @param {Grid.view.Grid} source The firing Grid instance.
     * @param {Grid.row.Row} row The row that has been rendered.
     * @param {Core.data.Model} record The record for the row.
     * @param {Number} recordIndex The zero-based index of the record.
     */
    //endregion

    /**
     * Collapse all groups/parent nodes.
     *
     * *NOTE: Only available when the {@link Grid/feature/Group Group} or the {@link Grid/feature/Tree Tree} feature is enabled.*
     *
     * @function collapseAll
     * @category Feature shortcuts
     */

    /**
     * Expand all groups/parent nodes.
     *
     * *NOTE: Only available when the {@link Grid/feature/Group Group} or the {@link Grid/feature/Tree Tree} feature is enabled.*
     *
     * @function expandAll
     * @category Feature shortcuts
     */

    /**
     * Start editing specified cell. If no cellContext is given it starts with the first cell in the first row.
     *
     * *NOTE: Only available when the {@link Grid/feature/CellEdit CellEdit} feature is enabled.*
     *
     * @function startEditing
     * @param {Object} cellContext Cell specified in format `{ id: 'x', columnId/column/field: 'xxx' }`.
     * See {@link Grid.view.Grid#function-getCell} for details.
     * @returns {Boolean}
     * @category Feature shortcuts
     */

    /**
     * Collapse an expanded node or expand a collapsed. Optionally forcing a certain state.
     *
     * *NOTE: Only available when the {@link Grid/feature/Tree Tree} feature is enabled.*
     *
     * @function toggleCollapse
     * @param {String|Number|Core.data.Model} idOrRecord Record (the node itself) or id of a node to toggle
     * @param {Boolean} [collapse] Force collapse (true) or expand (false)
     * @param {Boolean} [skipRefresh] Set to true to not refresh rows (if calling in batch)
     * @async
     * @category Feature shortcuts
     */

    /**
     * Collapse a single node.
     *
     * *NOTE: Only available when the {@link Grid/feature/Tree Tree} feature is enabled.*
     *
     * @function collapse
     * @param {String|Number|Core.data.Model} idOrRecord Record (the node itself) or id of a node to collapse
     * @async
     * @category Feature shortcuts
     */

    /**
     * Expand a single node.
     *
     * *NOTE: Only available when the {@link Grid/feature/Tree Tree} feature is enabled.*
     *
     * @function expand
     * @param {String|Number|Core.data.Model} idOrRecord Record (the node itself) or id of a node to expand
     * @async
     * @category Feature shortcuts
     */

    /**
     * Expands parent nodes to make this node "visible".
     *
     * *NOTE: Only available when the {@link Grid/feature/Tree Tree} feature is enabled.*
     *
     * @function expandTo
     * @param {String|Number|Core.data.Model} idOrRecord Record (the node itself) or id of a node
     * @async
     * @category Feature shortcuts
     */

    //endregion

    //region Grid template & elements

    compose() {
        const { autoHeight, enableSticky, enableTextSelection, fillLastColumn, positionMode, showDirty } = this;

        return {
            class : {
                [`b-grid-${positionMode}`] : 1,
                'b-enable-sticky'          : enableSticky,
                'b-grid-notextselection'   : !enableTextSelection,
                'b-autoheight'             : autoHeight,
                'b-fill-last-column'       : fillLastColumn,
                'b-show-dirty'             : showDirty
            }
        };
    }

    get cellCls() {
        const { _cellCls } = this;

        // It may have been merged to create a DomClassList, but 90% of the time will be a simple string.
        return _cellCls.value || _cellCls;
    }

    get bodyConfig() {
        const { autoHeight, hideFooters, hideHeaders } = this;

        return {
            reference : 'bodyElement',
            className : {
                'b-autoheight'      : autoHeight,
                'b-grid-panel-body' : 1
            },

            // Only include aria-labelled-by if we have a header
            [this.hasHeader ? 'ariaLabelledBy' : ''] : `${this.id}-panel-title`,

            children : {
                headerContainer : {
                    tag             : 'header',
                    role            : 'row',
                    'aria-rowindex' : 1,
                    className       : {
                        'b-grid-header-container' : 1,
                        'b-hidden'                : hideHeaders
                    }
                },
                bodyContainer : {
                    className : 'b-grid-body-container',
                    tabIndex  : -1,

                    // Explicitly needs this because it's in theory focusable
                    // and DomSync won't add a default role
                    role     : 'presentation',
                    children : {
                        verticalScroller : {
                            className : 'b-grid-vertical-scroller'
                        }
                    }
                },
                virtualScrollers : {
                    className : 'b-virtual-scrollers b-hide-display',
                    style     : BrowserHelper.isFirefox ? {
                        height : `${DomHelper.scrollBarWidth}px`
                    } : undefined
                },
                footerContainer : {
                    tag       : 'footer',
                    className : {
                        'b-grid-footer-container' : 1,
                        'b-hidden'                : hideFooters
                    }
                }
            }
        };
    }

    get contentElement() {
        return this.verticalScroller;
    }

    get overflowElement() {
        return this.bodyContainer;
    }

    updateHideFooters(hide) {
        this.footerContainer?.classList[hide ? 'add' : 'remove']('b-hidden');
    }

    //endregion

    //region Columns

    changeColumns(columns, currentStore) {
        const me = this;

        // TODO: @johan: reconfiguring, ie changing whole column set should work.
        // Empty, clear or destroy store
        if (!columns && currentStore) {
            // Destroy when Grid is destroyed, if we created the ColumnStore
            if (me.isDestroying) {
                currentStore.owner === me && currentStore.destroy();
            }
            // Clear if set to falsy value at some other point
            else {
                currentStore.removeAll();
            }

            return currentStore;
        }

        // Keep store if configured with one
        if (columns.isStore) {
            currentStore?.owner === me && currentStore.destroy();

            columns.grid = me;

            return columns;
        }

        // Given an array of columns
        if (Array.isArray(columns)) {
            // If we have a store, plug them in
            if (currentStore) {

                // Remove and destroy existing columns
                // Filter columns to be destroyed for ability to reassign existing ones and not destroy them
                me._suspendRenderContentsOnColumnsChanged = true;
                const columnsToDestroy = currentStore.allRecords.filter(column => !columns.includes(column) && column !== me.checkboxSelectionColumn);
                currentStore.remove(currentStore.allRecords, true);
                columnsToDestroy.forEach(column => column.destroy?.());

                currentStore.data = columns;
                me._suspendRenderContentsOnColumnsChanged = false;

                return currentStore;
            }

            // No store, use as data for a new store below
            columns = { data : columns };
        }

        if (currentStore) {
            throw new Error('Replacing ColumnStore is not supported');
        }

        // Assuming a store config object
        return ColumnStore.new({
            grid  : me,
            owner : me
        }, columns);
    }

    updateColumns(columns, was) {
        const me = this;

        super.updateColumns?.(columns, was);

        // changes might be triggered when applying state, before grid is rendered
        // TODO: have this run a lighter weight, non-destructive response.
        // onColumnsChanged is a start, but lots of machinery is hooked to render.
        columns.on({
            refresh : me.onColumnsChanged,
            change  : me.onColumnsChanged,
            sort    : me.onColumnsChanged,
            thisObj : me
        });
        columns.on(columnResizeEvent(me.onColumnsResized, me));

        // Add touch class for touch devices
        if (BrowserHelper.isTouchDevice) {
            me.touch = true;

            // apply touchConfig for columns that defines it
            columns.forEach(column => {
                const { touchConfig } = column;
                if (touchConfig) {
                    column.applyState(touchConfig);
                }
            });
        }

        me.bodyElement.setAttribute('aria-colcount', columns.visibleColumns.length);
    }

    onColumnsChanged({ type, action, changes, record : column, records : addedColumns, isMove }) {
        if ((type === 'refresh' && action !== 'batch') ||
            // Ignore the update of parentIndex following a column move (we redraw on the insert)
            (action === 'update' && Object.keys(changes).length === 1 && 'parentIndex' in changes)) {
            return;
        }

        const
            me = this,
            {
                columns,
                checkboxSelectionColumn
            }  = me;

        // this.onPaint will handle changes caused by updateResponsive
        if (!me.isPainted || (isMove && action === 'remove')) {
            return;
        }

        // See if we have to create and add new SubGrids to accommodate new columns.
        if (action === 'add') {
            for (const column of addedColumns) {
                const { region } = column;

                // See if there's a home for this column, if not, add one
                if (!me.subGrids[region]) {
                    me.add(me.createSubGrid(region, me.subGridConfigs[region]));
                }
            }
        }

        if (action === 'update') {
            // Just updating width is already handled in a minimal way.
            if ('width' in changes || 'minWidth' in changes || 'maxWidth' in changes || 'flex' in changes) {
                // Update any leaf columns that want to be repainted on size change
                const region = column.region;

                // We must not capture visibleColumns from the columns var
                // at the top. It's a cached/recalculated value that we
                // are invalidating in the body of this function.
                columns.visibleColumns.forEach(col => {
                    if (col.region === region && col.repaintOnResize) {
                        me.refreshColumn(col);
                    }
                });

                me.afterColumnsChange({ action, changes, column });
                return;
            }

            // Column toggled, need to recheck if any visible column has flex
            if ('hidden' in changes) {
                const subGrid = me.getSubGridFromColumn(column.id);
                subGrid.header.fixHeaderWidths();
                subGrid.footer.fixFooterWidths();
                subGrid.updateHasFlex();
            }
        }

        // Might have to add or remove subgrids when assigning a new set of columns or when changing region
        if (action === 'dataset' || action === 'batch' || (action === 'update' && 'region' in changes)) {
            const
                regions             = columns.getDistinctValues('region'),
                { toRemove, toAdd } = ArrayHelper.delta(regions, me.regions, true);

            me.remove(toRemove.map(region => me.getSubGrid(region)));
            me.add(toAdd.map(region => me.createSubGrid(region)));
        }

        // Check if checkbox selection column was removed, if so insert it back as the first column
        if (checkboxSelectionColumn && !columns.includes(checkboxSelectionColumn)) {
            // Insert the checkbox after any rownumber column. If not there, -1 means in at 0.
            const insertIndex = columns.indexOf(columns.findRecord('type', 'rownumber')) + 1;

            columns.insert(insertIndex, checkboxSelectionColumn, true);
        }

        if (!me._suspendRenderContentsOnColumnsChanged) {
            me.renderContents();
        }

        // Columns which are flexed, but as part of a grouped column cannot just have their flex
        // value reflected in the flex value of its cells. They are flexing a different available space.
        // These have to be set to the exact width and kept synced.
        me.syncFlexedSubCols();

        // We must not capture visibleColumns from the columns var
        // at the top. It's a cached/recalculated value that we must
        // are invalidating in the body of this function.
        me.bodyElement.setAttribute('aria-colcount', columns.visibleColumns.length);

        me.afterColumnsChange({ action, changes, column });
    }

    onColumnsResized({ changes, record : column }) {
        const me = this;

        if (me.isConfiguring) {
            return;
        }

        const
            domWidth    = DomHelper.setLength(column.width),
            domMinWidth = DomHelper.setLength(column.minWidth),
            domMaxWidth = DomHelper.setLength(column.maxWidth),
            subGrid     = me.getSubGridFromColumn(column.id);

        // Let header and footer fix their own widths
        subGrid.header.fixHeaderWidths();
        subGrid.footer.fixFooterWidths();
        subGrid.updateHasFlex();

        // We can't apply flex from flexed subColums - they are flexing inside a different available width.
        if (!(column.flex && column.childLevel)) {
            if (!me.cellEls || column !== me.lastColumnResized) {
                me.cellEls = DomHelper.children(
                    me.element,
                    `.b-grid-cell[data-column-id="${column.id}"]`
                );
                me.lastColumnResized = column;
            }

            for (const cell of me.cellEls) {
                if ('width' in changes) {
                    // https://app.assembla.com/spaces/bryntum/tickets/8041
                    // Although header and footer elements must be sized using flex-basis to avoid the busting out problem,
                    // grid cells MUST be sized using width since rows are absolutely positioned and will not cause the
                    // busting out problem, and rows will not stretch to shrinkwrap the cells unless they are widthed with
                    // width.
                    cell.style.width = domWidth;
                }

                if ('minWidth' in changes) {
                    cell.style.minWidth = domMinWidth;
                }
                if ('maxWidth' in changes) {
                    cell.style.maxWidth = domMaxWidth;
                }

                if ('flex' in changes) {
                    cell.style.flex = column.flex ?? null;
                }
            }
        }

        // If we're being driven by the ColumnResizer or other bulk column resizer (like
        // ColumnAutoWidth), they will finish up with a call to afterColumnsResized.
        if (!me.resizingColumns) {
            me.afterColumnsResized();
        }

        // Columns which are flexed, but as part of a grouped column cannot just have their flex
        // value reflected in the flex value of its cells. They are flexing a different available space.
        // These have to be set to the exact width and kept synced.
        me.syncFlexedSubCols();
    }

    afterColumnsResized() {
        const me = this;

        me.eachSubGrid(subGrid => {
            if (!subGrid.collapsed) {
                subGrid.fixWidths();
                subGrid.fixRowWidthsInSafariEdge();
            }
        });

        me.lastColumnResized = me.cellEls = null;

        // Buffer some expensive operations, like updating the fake scrollers
        me.bufferedAfterColumnsResized();

        // Must happen immediately, not inside the bufferedAfterColumnsResized
        me.onHeightChange();
    }

    syncFlexedSubCols() {
        const flexedSubCols = this.columns.query(c => c.flex && c.childLevel && c.element);

        // Columns which are flexed, but as part of a grouped column cannot just have their flex
        // value reflected in the flex value of its cells. They are flexing a different available space.
        // These have to be set to the exact width and kept synced.
        if (flexedSubCols) {
            for (const column of flexedSubCols) {
                const
                    width   = column.element.getBoundingClientRect().width,
                    cellEls = DomHelper.children(
                        this.element,
                        `.b-grid-cell[data-column-id="${column.id}"]`
                    );

                for (const cell of cellEls) {
                    cell.style.flex = `0 0 ${width}px`;
                }
            }
        }
    }

    bufferedAfterColumnsResized() {
        // Columns that allow their cell content to drive the row height requires a rerender after resize
        if (this.columns.usesAutoHeight) {
            this.refreshRows();
        }

        this.refreshVirtualScrollbars();
        this.eachSubGrid(subGrid => {
            if (!subGrid.collapsed) {
                subGrid.refreshFakeScroll();
            }
        });
    }

    bufferedElementResize() {
        this.refreshRows();
    }

    onInternalResize(element, newWidth, newHeight, oldWidth, oldHeight) {
        // If a flexed subGrid would be flexed *down* by a width reduction, allow it
        // to lay itself out before the refreshVirtualScrollbars called by GridElementEvents
        // asks them whether they are overflowingHorizontally.
        // This is to avoid an unecessary extra layout with a horizontal
        // scrollbar which may be hidden when the subgrid adjusts itself when its ResizeMonitor
        // notification arrives - they are delivered outermost->innermost, we we find out first here.
        // When the actualResizeMonitor notification arrives, it will be a no-op.
        if (DomHelper.scrollBarWidth && newWidth < oldWidth) {
            this.eachSubGrid(subGrid => {
                if (subGrid.flex) {
                    subGrid.onElementResize(subGrid.element);
                }
            });
        }

        super.onInternalResize(...arguments);

        // Columns that allow their cell content to drive the row height requires a rerender after element resize
        if (this.isPainted && newWidth !== oldWidth && this.columns.usesFlexAutoHeight) {
            this.bufferedElementResize();
        }
    }

    //endregion

    //region Rows

    /**
     * Get the topmost visible grid row
     * @member {Grid.row.Row} firstVisibleRow
     * @readonly
     * @category Rows
     */

    /**
     * Get the last visible grid row
     * @member {Grid.row.Row} lastVisibleRow
     * @readonly
     * @category Rows
     */

    /**
     * Get the Row that is currently displayed at top.
     * @member {Grid.row.Row} topRow
     * @readonly
     * @category Rows
     * @private
     */

    /**
     * Get the Row currently displayed furthest down.
     * @member {Grid.row.Row} bottomRow
     * @readonly
     * @category Rows
     * @private
     */

    /**
     * Get Row for specified record id.
     * @function getRowById
     * @param {Core.data.Model|String|Number} recordOrId Record id (or a record)
     * @returns {Grid.row.Row} Found Row or null if record not rendered
     * @category Rows
     * @private
     */

    /**
     * Returns top and bottom for rendered row or estimated coordinates for unrendered.
     * @function getRecordCoords
     * @param {Core.data.Model|String|Number} recordOrId Record or record id
     * @returns {Object} Record bounds with format { top, height, bottom }
     * @category Calculations
     * @private
     */

    /**
     * Get the Row at specified index. "Wraps" index if larger than available rows.
     * @function getRow
     * @param {Number} index
     * @returns {Grid.row.Row}
     * @category Rows
     * @private
     */

    /**
     * Get a Row for either a record, a record id or an HTMLElement
     * @function getRowFor
     * @param {HTMLElement|Core.data.Model|String|Number} recordOrId Record or record id or HTMLElement
     * @returns {Grid.row.Row} Found Row or `null` if record not rendered
     * @category Rows
     */

    /**
     * Get a Row from an HTMLElement
     * @function getRowFromElement
     * @param {HTMLElement} element
     * @returns {Grid.row.Row} Found Row or `null` if record not rendered
     * @category Rows
     * @private
     */

    changeRowManager(rowManager, oldRowManager) {
        const me = this;

        // Use row height from CSS if not specified in config. Did not want to turn this into a getter/setter for
        // rowHeight since RowManager will plug its implementation into Grid when created below, and after initial
        // configuration that is what should be used
        if (!me._isRowMeasured) {
            me.measureRowHeight();
        }

        oldRowManager?.destroy();

        if (rowManager) {
            // RowManager is a plugin, it is configured with its grid as its "client".
            // It uses client.store as its record source.
            const result = RowManager.new({
                grid           : me,
                rowHeight      : me.rowHeight,
                rowScrollMode  : me.rowScrollMode || 'move',
                autoHeight     : me.autoHeight,
                fixedRowHeight : me.fixedRowHeight,
                listeners      : {
                    changeTotalHeight   : 'onRowManagerChangeTotalHeight',
                    requestScrollChange : 'onRowManagerRequestScrollChange',
                    thisObj             : me
                }
            }, rowManager);

            // The grid announces row rendering to allow customization of rows.
            me.relayEvents(result, ['beforeRenderRow', 'renderRow']);

            // RowManager injects itself as a property into the grid so that the grid
            // can reference it during RowManager's spin-up. We need to undo that now
            // otherwise updaters will not run.
            me._rowManager = null;
            return result;
        }
    }

    // Default implementation, documented in `defaultConfig`
    getRowHeight(record) {
        return record.rowHeight;
    }

    // Hook for features that need to alter the row height
    processRowHeight(record, height) {}

    //endregion

    //region Store

    /**
     * Hooks up data store listeners
     * @private
     * @category Store
     */
    bindStore(store) {
        const suffix = this.asyncEventSuffix;

        store.on({
            name : storeListenerName,

            [`refresh${suffix}`]   : 'onStoreDataChange',
            [`add${suffix}`]       : 'onStoreAdd',
            [`remove${suffix}`]    : 'onStoreRemove',
            [`replace${suffix}`]   : 'onStoreReplace',
            [`removeAll${suffix}`] : 'onStoreRemoveAll',
            [`move${suffix}`]      : store.tree ? null : 'onFlatStoreMove',
            change                 : 'relayStoreDataChange',

            idChange      : 'onStoreRecordIdChange',
            update        : 'onStoreUpdateRecord',
            beforeRequest : 'onStoreBeforeRequest',
            afterRequest  : 'onStoreAfterRequest',
            exception     : 'onStoreException',
            commit        : 'onStoreCommit',
            thisObj       : this
        });

        super.bindStore(store);
    }

    unbindStore(oldStore) {
        this.detachListeners(storeListenerName);

        if (this.destroyStore) {
            oldStore.destroy();
        }
    }

    changeStore(store) {
        if (store == null) {
            return null;
        }

        if (typeof store === 'string') {
            store = Store.getStore(store);
        }

        if (!store.isStore) {
            store = ObjectHelper.assign({
                data : this.data,
                tree : Boolean(this.initialConfig.features?.tree)
            }, store);

            if (!store.data) {
                delete store.data;
            }

            if (!store.modelClass) {
                store.modelClass = GridRowModel;
            }

            store = new (store.readUrl ? AjaxStore : Store)(store);
        }


        return store;
    }

    updateStore(store, was) {
        const me = this;

        super.updateStore?.(store, was);

        if (was) {
            me.unbindStore(was);
        }

        if (store) {
            // Deselect all rows when replacing the store, otherwise selection retains old store
            if (was) {
                me.deselectAll();
            }
            me.bindStore(store);
        }

        me.trigger('bindStore', { store, oldStore : was });

        // Changing store when painted -> refresh rows to reflect new data
        if (!me.isDestroying && me.isPainted && !me.refreshSuspended) {
            me._rowManager?.reinitialize();
        }
    }

    /**
     * Rerenders a cell if a record is updated in the store
     * @private
     * @category Store
     */
    onStoreUpdateRecord({ source : store, record, changes }) {
        const me = this;

        if (me.refreshSuspended) {
            return;
        }

        if (me.forceFullRefresh) {
            // flagged to need full refresh (probably from using GroupSummary)
            me.rowManager.refresh();

            me.forceFullRefresh = false;
        }
        else {
            let row;
            // Search for old row if id was changed
            if (record.isFieldModified('id')) {
                row = me.getRowFor(record.meta.modified.id);
            }

            row = row || me.getRowFor(record);
            // not rendered, bail out
            if (!row) {
                return;
            }

            // We must refresh the full row if it's a special row which has signalled
            // an update because it has no cells.
            if (me.fullRowRefresh || record.isSpecialRow) {
                const index = store.indexOf(record);
                if (index !== -1) {
                    row.render(index, record);
                }
            }
            else {
                me.columns.visibleColumns.forEach(column => {
                    const
                        field  = column.field,
                        isSafe = column.constructor.simpleRenderer && !(Object.prototype.hasOwnProperty.call(column.data, 'renderer'));

                    // If there's a  non-safe renderer, that is a renderer which draws values from elsewhere
                    // than just its configured field, that column must be refreshed on every record update.
                    // Obviously, if the column's configured field is changed that also means it's refreshed.
                    if (!isSafe || changes[field]) {
                        const cellElement = row.getCell(field);
                        if (cellElement) {
                            row.renderCell(cellElement);
                        }
                    }
                });
            }
        }
    }

    refreshFromRowOnStoreAdd(row, context) {
        const
            me             = this,
            { rowManager } = me;

        rowManager.renderFromRow(row);
        rowManager.trigger('changeTotalHeight', { totalHeight : rowManager.totalHeight });

        // First record? Also update fake scrollers
        // TODO: Consider making empty grid scrollable to not have to do this
        if (me.store.count === 1) {
            me.callEachSubGrid('refreshFakeScroll');
        }
    }

    onMaskAutoClose(mask) {
        super.onMaskAutoClose(mask);

        this.toggleEmptyText();
    }

    /**
     * Refreshes rows when data is added to the store
     * @private
     * @category Store
     */
    onStoreAdd({ source : store, records, index, oldIndex, isChild, oldParent, parent, isMove, isExpandAll }) {
        // Do not react if the content has not been rendered
        if (!this.isPainted || isExpandAll) {
            return;
        }

        // If we move records check if some of their old parents is expanded
        const hasExpandedOldParent = isMove && records.some(record => {
            if (isMove[record.id]) {
                // When using TreeGroup there won't be an old parent
                const oldParent = store.getById(record.meta.modified.parentId);

                return oldParent?.isExpanded(store) && oldParent?.ancestorsExpanded(store);
            }
        });

        // If it's the addition of a child to a collapsed zone (and old parents are also collapsed), the UI does not change.
        if (isChild && !records[0].ancestorsExpanded(store) && !hasExpandedOldParent) {
            // BUT it might change if parent had no children (expander made invisible) and it gets children added
            if (!parent.isLeaf) {
                const parentRow = this.rowManager.getRowById(parent);
                if (parentRow) {
                    this.rowManager.renderRows([parentRow]);
                }
            }

            return;
        }

        this.rowManager.calculateRowCount(false, true, true);

        // When store is filtered need to update the index value
        if (store.isFiltered) {
            index = store.indexOf(records[0]);
        }

        const
            me             = this,
            { rowManager } = me,
            {
                topIndex,
                rows,
                rowCount
            }              = rowManager,
            bottomIndex    = rowManager.topIndex + rowManager.rowCount - 1,
            dataStart      = index,
            dataEnd        = index + records.length - 1,
            atEnd          = bottomIndex >= store.count - records.length - 1;

        // When moving a node within a tree we might need the redraw to include its old parent and its children. Not worth
        // the complexity of trying to do a partial render for this, rerender all rows to be safe.
        // Moving records within a flat store is handled elsewhere, in onFlatStoreMove
        // TODO: Moving within a tree should also trigger 'move' (https://app.assembla.com/spaces/bryntum/tickets/7270)
        if (oldParent || oldIndex > -1 || (isChild && isMove)) {
            rowManager.refresh();
        }
        // Added block starts in our visible block. Render from there downwards.
        else if (dataStart >= topIndex && dataStart < topIndex + rowCount) {
            me.refreshFromRowOnStoreAdd(rows[dataStart - topIndex], ...arguments);
        }
        // Added block ends in our visible block, render block
        else if (dataEnd >= topIndex && dataEnd < topIndex + rowCount) {
            rowManager.refresh();
        }
        // If added block is outside of the visible area, no visible change
        // but potentially a change in total dataset height.
        else {
            // If we are against the end of the dataset, and have appended records
            // ensure they are rendered below
            if (atEnd && index > bottomIndex) {
                rowManager.fillBelow(me._scrollTop || 0);
            }

            rowManager.estimateTotalHeight(true);
        }
    }

    /**
     * Responds to exceptions signalled by the store
     * @private
     * @category Store
     */
    onStoreException({ action, type, response, exceptionType, error }) {
        const me = this;

        let message;

        switch (type) {
            case 'server':
                message = response.message || me.L('L{unspecifiedFailure}');
                break;
            case 'exception':
                message = exceptionType === 'network' ? me.L('L{networkFailure}') : (error?.message || response?.parsedJson?.message || me.L('L{parseFailure}'));
                break;
        }

        // eslint-disable-next-line
        me.applyMaskError(
            `<div class="b-grid-load-failure">
                <div class="b-grid-load-fail">${me.L(action === 'read' ? 'L{loadFailedMessage}' : 'L{syncFailedMessage}')}</div>
                ${response?.url ? `<div class="b-grid-load-fail">${response.url}</div>` : ''}
                <div class="b-grid-load-fail">${me.L('L{serverResponse}')}</div>
                <div class="b-grid-load-fail">${message}</div>
            </div>`);
    }

    /**
     * Refreshes rows when data is changed in the store
     * @private
     * @category Store
     */
    onStoreDataChange({ action, changes, source : store }) {
        if (this.refreshSuspended || !this.rowManager) {
            return;
        }

        const
            me                 = this,
            isGroupFieldChange = store.isGrouped && changes && store.groupers.some(grouper => grouper.field in changes);

        // If the next mixin up the inheritance chain has an implementation, call it
        super.onStoreDataChange && super.onStoreDataChange(...arguments);

        // If it's new data, the old calculation is invalidated.
        if (action === 'dataset') {
            me.rowManager.clearKnownHeights();
        }
        // No need to rerender if it's a change of the value of the group field which
        // will be responded to by StoreGroup
        if (me.isPainted && !isGroupFieldChange) {
            // Optionally scroll to top if setting new data or is filtering based on preserveScrollOnDatasetChange setting
            me.renderRows(Boolean(!(action in datasetReplaceActions) || me.preserveScrollOnDatasetChange));
        }

        me.toggleEmptyText();
    }

    /**
     * The hook is called when the id of a record has changed.
     * @private
     * @category Store
     */
    onStoreRecordIdChange() {
        // If the next mixin up the inheritance chain has an implementation, call it
        super.onStoreRecordIdChange && super.onStoreRecordIdChange(...arguments);
    }

    /**
     * Shows a load mask while the connected store is loading
     * @private
     * @category Store
     */
    onStoreBeforeRequest() {
        this.applyLoadMask();
    }

    /**
     * Hides load mask after a load request ends either in success or failure
     * @private
     * @category Store
     */
    onStoreAfterRequest(event) {
        if (this.loadMask && !event.exception) {
            this.masked = null;
            this.toggleEmptyText();
        }
    }

    needsFullRefreshOnStoreRemove({ isCollapse }) {
        const features = this._features;

        return (features?.group && !features.group.disabled) ||
            (features?.groupSummary && !features.groupSummary.disabled) ||
            // Need to redraw parents when children are removed since they might be converted to leaves
            (this.store.tree && !isCollapse && this.store.modelClass.convertEmptyParentToLeaf);
    }

    /**
     * Animates removal of record.
     * @private
     * @category Store
     */
    onStoreRemove({ records, isCollapse, isChild, isMove, isCollapseAll }) {
        // Do not react if the content has not been rendered,
        // or if it is a move, which will be handled by onStoreAdd
        if (!this.isPainted || isMove || isCollapseAll) {
            return;
        }

        // GridSelection mixin does its job on records removing
        super.onStoreRemove && super.onStoreRemove(...arguments);

        const
            me             = this,
            { rowManager } = me;

        // Remove cached heights
        rowManager.invalidateKnownHeight(records);

        if (me.animateRemovingRows  && !isCollapse && !isChild) {
            // Gather all visible rows which need to be removed.
            const rowsToRemove = records.reduce((result, record) => {
                const row = rowManager.getRowById(record.id);
                row && result.push(row);
                return result;
            }, []);

            if (rowsToRemove.length) {
                const topRow = rowsToRemove[0];

                me.isAnimating = true;

                // As soon as first row has disappeared, rerender the view
                EventHelper.onTransitionEnd({
                    element  : topRow._elementsArray[0],
                    property : 'left',

                    // Detach listener after timeout even if event wasn't fired
                    duration : me.transitionDuration,
                    thisObj  : me,
                    handler  : () => {
                        me.isAnimating = false;

                        rowsToRemove.forEach(row => !row.isDestroyed && row.removeCls('b-removing'));
                        rowManager.refresh();

                        // undocumented internal event for scheduler
                        me.trigger('rowRemove');
                        me.afterRemove(arguments[0]);
                    }
                });

                rowsToRemove.forEach(row => row.addCls('b-removing'));
                return;
            }
        }

        // Cannot do an update from the affected row and down here. Since group headers might be affected by
        // removing rows we need a full refresh
        if (me.needsFullRefreshOnStoreRemove(...arguments)) {
            rowManager.refresh();
            me.afterRemove(arguments[0]);
        }
        else {
            const oldTopIndex = rowManager.topIndex;

            // Potentially remove rows and change dataset height
            rowManager.calculateRowCount(false, true, true);

            // If collapsing lead to rows "shifting up" to fit in available rows, we have to rerender from top
            if (rowManager.topIndex !== oldTopIndex) {
                rowManager.renderFromRow(rowManager.topRow);
            }
            else {
                const { rows } = rowManager, topRowIndex = records.reduce((result, record) => {
                    const row = rowManager.getRowById(record.id);
                    if (row) {
                        // Rows are repositioned in the array, it matches visual order. Need to find actual index in it
                        result = Math.min(result, rows.indexOf(row));
                    }
                    return result;
                }, rows.length);

                // If there were rows below which have moved up into place
                // then repurpose them with their new records
                if (rows[topRowIndex]) {
                    !me.refreshSuspended && rowManager.renderFromRow(rows[topRowIndex]);
                }
                // If nothing to render below, just update dataset height
                else {
                    rowManager.trigger('changeTotalHeight', { totalHeight : rowManager.totalHeight });
                }
            }
            me.trigger('rowRemove', { isCollapse });
            me.afterRemove(arguments[0]);
        }
    }

    onFlatStoreMove({ from, to }) {
        const
            { rowManager }       = this,
            {
                topIndex,
                rowCount
            }                    = rowManager,
            [dataStart, dataEnd] = [from, to].sort((a, b) => a - b);

        // Changed block starts in our visible block. Render from there downwards.
        if (dataStart >= topIndex && dataStart < topIndex + rowCount) {
            rowManager.renderFromRow(rowManager.rows[dataStart - topIndex]);
        }
        // Changed block ends in our visible block, render block
        else if (dataEnd >= topIndex && dataEnd < topIndex + rowCount) {
            rowManager.refresh();
        }
        // If changed block is outside of the visible area, this is a no-op
    }

    onStoreReplace({ records, all }) {
        const { rowManager } = this;

        if (all) {
            rowManager.clearKnownHeights();
            rowManager.refresh();
        }
        else {
            const rows = records.reduce((rows, [, record]) => {
                const row = this.getRowFor(record);
                if (row) {
                    rows.push(row);
                }
                return rows;
            }, []);

            // Heights will be stored on render, but some records might be out of view -> have to invalidate separately
            rowManager.invalidateKnownHeight(records);

            rowManager.renderRows(rows);
        }
    }

    relayStoreDataChange(event) {
        this.ariaElement.setAttribute('aria-rowcount', this.store.count + 1);

        /**
         * Fired when data in the store changes.
         *
         * Basically a relayed version of the store's own change event, decorated with a `store` property.
         * See the {@link Core.data.Store#event-change store change event} documentation for more information.
         *
         * @event dataChange
         * @param {Grid.view.Grid} source Owning grid
         * @param {Core.data.Store} store The originating store
         * @param {'remove'|'removeAll'|'add'|'updatemultiple'|'clearchanges'|'filter'|'update'|'dataset'|'replace'} action
         * Name of action which triggered the change. May be one of:
         * * `'remove'`
         * * `'removeAll'`
         * * `'add'`
         * * `'updatemultiple'`
         * * `'clearchanges'`
         * * `'filter'`
         * * `'update'`
         * * `'dataset'`
         * * `'replace'`
         * @param {Core.data.Model} record Changed record, for actions that affects exactly one record (`'update'`)
         * @param {Core.data.Model[]} records Changed records, passed for all actions except `'removeAll'`
         * @param {Object} changes Passed for the `'update'` action, info on which record fields changed
         */
        if (!this.project) {
            return this.trigger('dataChange', { ...event, store : event.source, source : this });
        }
    }

    /**
     * Rerenders grid when all records have been removed
     * @private
     * @category Store
     */
    onStoreRemoveAll() {
        // GridSelection mixin does its job on records removing
        super.onStoreRemoveAll && super.onStoreRemoveAll(...arguments);

        if (this.isPainted) {
            this.rowManager.clearKnownHeights();
            this.renderRows(false);
            this.toggleEmptyText();
        }
    }

    // Refresh dirty cells on commit
    onStoreCommit({ changes }) {
        if (this.showDirty && changes.modified.length) {
            const rows = [];

            changes.modified.forEach(record => {
                const row = this.rowManager.getRowFor(record);
                row && rows.push(row);
            });

            this.rowManager.renderRows(rows);
        }
    }

    // Documented with config
    get data() {
        if (this._store) {
            return this._store.records;
        }
        else {
            return this._data;
        }
    }

    set data(data) {
        if (this._store) {
            this._store.data = data;
        }
        else {
            this._data = data;
        }
    }

    get emptyText() {
        return this._emptyText;
    }

    set emptyText(text) {
        this._emptyText = text;
        this.eachSubGrid(subGrid => subGrid.emptyText = text);
    }

    //endregion

    //region Context menu items

    /**
     * Populates the header context menu. Chained in features to add menu items.
     * @param {Object} options Contains menu items and extra data retrieved from the menu target.
     * @param {Grid.column.Column} options.column Column for which the menu will be shown
     * @param {Object} options.items A named object to describe menu items
     * @internal
     */
    populateHeaderMenu({ column, items }) {
        const
            me                    = this,
            { subGrids, regions } = me;

        let first = true;

        Object.entries(subGrids).forEach(([region, subGrid]) => {
            // If SubGrid is configured with a sealed column set, do not allow moving into it
            if (subGrid.sealedColumns) {
                return;
            }

            if (column.draggable &&
                region !== column.region &&
                (!column.parent && subGrids[column.region].columns.count > 1 ||
                    column.parent && column.parent.children.length > 1)
            ) {
                const
                    moveRight = subGrid.element.compareDocumentPosition(subGrids[column.region].element) === document.DOCUMENT_POSITION_PRECEDING,
                    // With 2 regions, use Move left, Move right. With multiple, include region name
                    text      = regions.length > 2
                        ? me.L('L{moveColumnTo}', me.optionalL(region))
                        : me.L(moveRight ? 'L{moveColumnRight}' : 'L{moveColumnLeft}');

                items[`${region}Region`] = {
                    targetSubGrid : region,
                    text,
                    icon          : 'b-fw-icon ' + (moveRight ? 'b-icon-column-move-right' : 'b-icon-column-move-left'),
                    cls           : first ? 'b-separator' : '',
                    onItem        : ({ item }) => {
                        column.traverse(col => col.region = region);

                        // Changing region will move the column to the correct SubGrid, but we want it to go last
                        me.columns.insert(me.columns.indexOf(subGrids[item.targetSubGrid].columns.last) + 1, column);

                        me.scrollColumnIntoView(column);
                    }
                };

                first = false;
            }
        });
    }

    /**
     * Populates the cell context menu. Chained in features to add menu items.
     * @param {Object} options Contains menu items and extra data retrieved from the menu target.
     * @param {Grid.column.Column} options.column Column for which the menu will be shown
     * @param {Core.data.Model} options.record Record for which the menu will be shown
     * @param {Object} options.items A named object to describe menu items
     * @internal
     */
    populateCellMenu({ record, items }) {}

    getColumnDragToolbarItems(column, items) {
        return items;
    }

    //endregion

    //region Getters

    normalizeCellContext(cellContext) {
        const
            grid        = this,
            { columns } = grid;

        // Already have a Location
        if (cellContext.isLocation) {
            return cellContext;
        }

        // Create immutable Location object encapsulating the passed object.
        if (cellContext.isModel) {
            return new Location({
                grid,
                id       : cellContext.id,
                columnId : columns.visibleColumns[0].id
            });
        }
        return new Location(Object.assign({ grid }, cellContext));
    }

    // TODO: move to RowManager? Or create a CellManager?
    /**
     * Returns a cell if rendered.
     * @param {Object} cellContext { id: rowId, columnId: columnId [,column: column number, field: column field] }
     * @param {Number} [cellContext.row] The row index of the row to access. Exclusive with `id` and 'record'.
     * @param {String|Number} [cellContext.id] The record id of the row to access. Exclusive with `row` and 'record'.
     * @param {Core.data.Model} [cellContext.record] The record of the row to access. Exclusive with `id` and 'row'.
     * @param {Grid.column.Column|Number} [cellContext.column] The column instance or the index of the cell to access. Exclusive with `columnId`.
     * @param {String|Number} [cellContext.columnId] The column id of the column to access. Exclusive with `column`.
     * @param {String} [cellContext.field] The field of the column to access. Exclusive with `column`.
     * @returns {HTMLElement}
     * @category Getters
     */
    getCell(cellContext) {
        const
            { store, columns } = this,
            { visibleColumns } = this.columns,
            rowIndex           = !isNaN(cellContext.row) ? cellContext.row : !isNaN(cellContext.rowIndex) ? cellContext.rowIndex : store.indexOf(cellContext.record || cellContext.id),
            columnIndex        = !isNaN(cellContext.column) ? cellContext.column : !isNaN(cellContext.columnIndex) ? cellContext.columnIndex : visibleColumns.indexOf(cellContext.column || columns.getById(cellContext.columnId) || columns.get(cellContext.field) || visibleColumns[0]);

        // Only return cell for valid address.
        // This code is more strict than Location which attempts to find the closest existing cell.
        // Here we MUST only return a cell if the passed context is fully valid.
        return rowIndex > -1 && rowIndex < store.count && columnIndex > -1 && columnIndex < visibleColumns.length && this.normalizeCellContext(cellContext).cell;
    }

    //TODO: Should move to ColumnManager? Or Header?
    /**
     * Returns the header element for the column
     * @param {String|Number|Grid.column.Column} columnId or Column instance
     * @returns {HTMLElement} Header element
     * @category Getters
     */
    getHeaderElement(columnId) {
        if (columnId.isModel) {
            columnId = columnId.id;
        }

        return this.fromCache(`.b-grid-header[data-column-id="${columnId}"]`);
    }

    getHeaderElementByField(field) {
        const column = this.columns.get(field);

        return column ? this.getHeaderElement(column) : null;
    }

    /**
     * Body height
     * @member {Number}
     * @readonly
     * @category Layout
     */
    get bodyHeight() {
        return this._bodyHeight;
    }

    /**
     * Header height
     * @member {Number}
     * @readonly
     * @category Layout
     */
    get headerHeight() {
        const me = this;
        // measure header if rendered and not stored
        if (me.isPainted && !me._headerHeight) {
            me._headerHeight = me.headerContainer.offsetHeight;
        }

        return me._headerHeight;
    }

    get isTreeGrouped() {
        return Boolean(this.features.treeGroup?.isGrouped);
    }

    /**
     * Searches up from the specified element for a grid row and returns the record associated with that row.
     * @param {HTMLElement} element Element somewhere within a row or the row container element
     * @returns {Core.data.Model} Record for the row
     * @category Getters
     */
    getRecordFromElement(element) {
        const el = element.closest('.b-grid-row');

        if (!el) return null;

        return this.store.getAt(el.dataset.index);
    }

    /**
     * Searches up from specified element for a grid cell or an header and returns the column which the cell belongs to
     * @param {HTMLElement} element Element somewhere in a cell
     * @returns {Grid.column.Column} Column to which the cell belongs
     * @category Getters
     */
    getColumnFromElement(element) {
        const cell = DomHelper.up(element, '.b-grid-cell, .b-grid-header');
        if (!cell) return null;

        if (cell.matches('.b-grid-header')) {
            return this.columns.getById(cell.dataset.columnId);
        }

        const cellData = DomDataStore.get(cell);
        return this.columns.getById(cellData.columnId);
    }

    // Only added for type checking, since it seems common to get it wrong in react/angular
    updateAutoHeight(autoHeight) {
        ObjectHelper.assertBoolean(autoHeight, 'autoHeight');
    }

    // Documented under configs
    get columnLines() {
        return this._columnLines;
    }

    set columnLines(columnLines) {
        ObjectHelper.assertBoolean(columnLines, 'columnLines');

        DomHelper.toggleClasses(this.element, 'b-no-column-lines', !columnLines);

        this._columnLines = columnLines;
    }

    get keyMapElement() {
        return this.bodyElement;
    }

    //endregion

    //region Fix width & height

    /**
     * Sets widths and heights for headers, rows and other parts of the grid as needed
     * @private
     * @category Width & height
     */
    fixSizes() {
        // subGrid width
        this.callEachSubGrid('fixWidths');

        // Get leaf headers.
        const colHeaders = this.headerContainer.querySelectorAll('.b-grid-header.b-depth-0');

        // Update leaf headers' ariaColIndex
        for (let i = 0, { length } = colHeaders; i < length; i++) {
            colHeaders[i].setAttribute('aria-colindex', i + 1);
        }
    }

    onRowManagerChangeTotalHeight({ totalHeight, immediate }) {
        return this.refreshTotalHeight(totalHeight, immediate);
    }

    /**
     * Makes height of vertical scroller match estimated total height of grid. Called when scrolling vertically and
     * when showing/hiding rows.
     * @param {Number} [height] Total height supplied by RowManager
     * @param {Boolean} [immediate] Flag indicating if buffered element sizing should be bypassed
     * @private
     * @category Width & height
     */
    refreshTotalHeight(height = this.rowManager.totalHeight, immediate = false) {
        const me = this;

        // Veto change of estimated total height while rendering rows or if triggered while in a hidden state
        if (me.renderingRows || !me.isVisible) {
            return false;
        }

        const
            scroller     = me.scrollable,
            delta        = Math.abs(me.virtualScrollHeight - height),
            clientHeight = me._bodyRectangle.height,
            newMaxY      = height - clientHeight;

        if (delta) {
            const
                // We must update immediately if we are nearing the end of the scroll range.
                isCritical = (newMaxY - me._scrollTop < clientHeight * 2) ||
                    // Or if we have scrolled pass visual height
                    (me._verticalScrollHeight && (me._verticalScrollHeight - clientHeight < me._scrollTop));

            // Update the true scroll range using the scroller. This will not cause a repaint.
            scroller.scrollHeight = me.virtualScrollHeight = height;

            // If we are scrolling, put this off because it causes
            // a full document layout and paint.
            // Do not buffer calls for not yet painted grid
            if (me.isPainted && (me.scrolling && !isCritical || delta < 100) && !immediate) {
                me.bufferedFixElementHeights();
            }
            else {
                me.virtualScrollHeightDirty && me.virtualScrollHeightDirty();
                me.bufferedFixElementHeights.cancel();
                me.fixElementHeights();
            }
        }
    }

    fixElementHeights() {
        const
            me         = this,
            height     = me.virtualScrollHeight,
            heightInPx = `${height}px`;

        me._verticalScrollHeight = height;
        me.verticalScroller.style.height = heightInPx;
        me.virtualScrollHeightDirty = false;

        if (me.autoHeight) {
            me.bodyContainer.style.height = heightInPx;
            me._bodyHeight = height;
            me.refreshBodyRectangle();
        }

        me.refreshVirtualScrollbars();
    }

    refreshBodyRectangle() {
        return this._bodyRectangle = Rectangle.client(this.bodyContainer);
    }

    //endregion

    //region Scroll & virtual rendering

    set scrolling(scrolling) {
        this._scrolling = scrolling;
    }

    get scrolling() {
        return this._scrolling;
    }

    /**
     * Activates automatic scrolling of a subGrid when mouse is moved closed to the edges. Useful when dragging DOM nodes
     * from outside this grid and dropping on the grid.
     * @param {Grid.view.SubGrid|String} subGrid A subGrid instance or its region name
     */
    enableScrollingCloseToEdges(subGrid) {
        if (typeof subGrid === 'string') {
            subGrid = this.subGrids[subGrid];
        }

        this.scrollManager.startMonitoring({
            scrollables : [
                {
                    element   : subGrid.scrollable.element,
                    direction : 'horizontal'
                },
                {
                    element   : this.scrollable.element,
                    direction : 'vertical'
                }
            ]
        });
    }

    /**
     * Deactivates automatic scrolling of a subGrid when mouse is moved closed to the edges
     * @param {Grid.view.SubGrid|String} subGrid A subGrid instance or its region name
     */
    disableScrollingCloseToEdges(subGrid) {
        if (typeof subGrid === 'string') {
            subGrid = this.subGrids[subGrid];
        }

        this.scrollManager.stopMonitoring([subGrid.element, this.scrollable.element]);
    }

    /**
     * Responds to request from RowManager to adjust scroll position. Happens when jumping to a scroll position with
     * variable row height.
     * @param {Number} bottomMostRowY
     * @private
     * @category Scrolling
     */
    onRowManagerRequestScrollChange({ bottom }) {
        this.scrollable.y = bottom - this.bodyHeight;
    }

    

    /**
     * Scroll syncing for normal headers & grid + triggers virtual rendering for vertical scroll
     * @private
     * @fires scroll
     * @category Scrolling
     */
    initScroll() {
        const
            me             = this,
            { scrollable } = me;

        // This method may be called early, before render calls it, so ensure that it's
        // only executed once.
        if (!me.scrollInitialized) {
            me.scrollInitialized = true;

            // Allows FF to dynamically track scrollbar state change by reacting to content height changes.
            // Remove when https://bugzilla.mozilla.org/show_bug.cgi?id=1733042 is fixed
            scrollable.contentElement = me.contentElement;

            scrollable.on({
                scroll    : 'onGridVerticalScroll',
                scrollend : 'onGridVerticalScrollEnd',
                thisObj   : me
            });

            me.callEachSubGrid('initScroll');



            // Fixes scroll freezing bug on iPad by putting scroller in its own layer
            if (BrowserHelper.isMobileSafari) {
                scrollable.element.style.transform = 'translate3d(0, 0, 0)';
            }
        }
    }

    onGridVerticalScroll({ source : scrollable }) {
        const
            me                = this,
            { y : scrollTop } = scrollable;

        // Was getting scroll events in FF where scrollTop was unchanged, ignore those
        if (scrollTop !== me._scrollTop) {
            me._scrollTop = scrollTop;

            if (!me.scrolling) {
                me.scrolling = true;
                // Vertical scroll may trigger resize if row height is variable
                me.eachSubGrid(s => s.suspendResizeMonitor = true);
            }

            

            me.rowManager.updateRenderedRows(scrollTop);

            // Hook for features that need to react to scroll
            me.afterScroll({ scrollTop });

            /**
             * Grid has scrolled vertically
             * @event scroll
             * @param {Grid.view.Grid} source The firing Grid instance.
             * @param {Number} scrollTop The vertical scroll position.
             */
            me.trigger('scroll', { scrollTop });
        }
    }

    onGridVerticalScrollEnd() {
        this.scrolling = false;
        this.eachSubGrid(s => s.suspendResizeMonitor = false);
    }

    // TODO: rename to scrollRecordIntoView? Or have an alias?
    /**
     * Scrolls a row into view. If row isn't rendered it tries to calculate position
     * @param {Core.data.Model|String|Number} recordOrId Record or record id
     * @param {Object} [options] How to scroll.
     * @param {String} [options.column] Field name or ID of the column, or the Column instance to scroll to.
     * @param {'start'|'end'|'center'|'nearest'} [options.block] How far to scroll the element.
     * @param {Number} [options.edgeOffset] edgeOffset A margin around the element or rectangle to bring into view.
     * @param {Boolean|Number} [options.animate] Set to `true` to animate the scroll, or the number of milliseconds to animate over.
     * @param {Boolean} [options.highlight] Set to `true` to highlight the element when it is in view.
     * @category Scrolling
     * @returns {Promise} A promise which resolves when the specified row has been scrolled into view.
     */
    async scrollRowIntoView(recordOrId, options = defaultScrollOptions) {
        const
            me             = this,
            blockPosition  = options.block || 'nearest',
            { rowManager } = me,
            record         = me.store.getById(recordOrId);

        if (record) {
            let scrollPromise;

            // check that record is "displayable", not filtered out or hidden by collapse
            if (me.store.indexOf(record) === -1) {
                return resolvedPromise;
            }

            let scroller   = me.scrollable,
                recordRect = me.getRecordCoords(record);

            const scrollerRect = Rectangle.from(scroller.element);

            // If it was calculated from the index, update the rendered rowScrollMode
            // and scroll to the actual element. Note that this should only be necessary
            // for variableRowHeight.
            // But to "make the tests green", this is a workaround for a buffered rendering
            // bug when teleporting scroll. It does not render the rows at their correct
            // positions. Please do not try to "fix" this. I will do it. NGW
            if (recordRect.virtual) {
                const
                    virtualBlock = recordRect.block,
                    innerOptions = blockPosition !== 'nearest' ? options : {
                        block : virtualBlock
                    };

                // Scroll the calculated position **synchronously** to the center of the scrollingViewport
                // and then update the rendered block while asking the RowManager to
                // display the required recordOrId.
                scrollPromise = scroller.scrollIntoView(recordRect, {
                    block : 'center'
                });

                rowManager.scrollTargetRecordId = record;
                rowManager.updateRenderedRows(scroller.y, true);
                recordRect               = me.getRecordCoords(record);
                rowManager.lastScrollTop = scroller.y;

                if (recordRect.virtual) {

                    // bail out to not get caught in infinite loop, since code above is cut out of bundle
                    // eslint-disable-next-line no-useless-return,no-unreachable
                    return resolvedPromise;
                }

                // Scroll the target just less than append/prepend buffer height out of view so that the animation looks good
                if (options.animate) {
                    // Do not fire scroll events during this scroll sequence - it's a purely cosmetic operation.
                    // We are scrolling the desired row out of view merely to *animate scroll* it to the requested position.
                    scroller.suspendEvents();

                    // Scroll to its final position
                    if (blockPosition === 'end' || blockPosition === 'nearest' && virtualBlock === 'end') {
                        scroller.y -= (scrollerRect.bottom - recordRect.bottom);
                    }
                    else if (blockPosition === 'start' || blockPosition === 'nearest' && virtualBlock === 'start') {
                        scroller.y += (recordRect.y - scrollerRect.y);
                    }

                    // Ensure rendered block is correct at that position
                    rowManager.updateRenderedRows(scroller.y, false, true);

                    // Scroll away from final position to enable a cosmetic scroll to final position
                    if (virtualBlock === 'end') {
                        scroller.y -= (rowManager.appendRowBuffer * rowManager.rowHeight - 1);
                    }
                    else {
                        scroller.y += (rowManager.prependRowBuffer * rowManager.rowHeight - 1);
                    }

                    // The row will still be rendered, so scroll it using the scroller directly
                    scroller.scrollIntoView(me.getRecordCoords(record), Object.assign({}, options, innerOptions));

                    // Now we're at the required position, resume events
                    scroller.resumeEvents();
                }
                else {
                    if (!options.recursive) {
                        await scrollPromise;
                    }
                    // May already be destroyed at this point, hence ?.
                    await me.scrollRowIntoView?.(record, Object.assign({ recursive : true }, options, innerOptions));
                }
            }
            else {
                let { column } = options;

                if (column) {
                    if (!column.isModel) {
                        column = me.columns.getById(column) || me.columns.get(column);
                    }

                    // If we are targeting a column, we must use the scroller of that column's SubGrid
                    if (column) {
                        scroller = me.getSubGridFromColumn(column).scrollable;

                        const cellRect = Rectangle.from(rowManager.getRowFor(record).getCell(column.id));

                        recordRect.x = cellRect.x;
                        recordRect.width = cellRect.width;
                    }
                }
                // No column, then tell the scroller not to scroll in the X axis
                else {
                    options.x = false;
                }
                return scroller.scrollIntoView(recordRect, options);
            }
        }
    }

    /**
     * Scrolls a column into view (if it is not already)
     * @param {Grid.column.Column|String|Number} column Column name (data) or column index or actual column object.
     * @param {Object} [options] How to scroll.
     * @param {'start'|'end'|'center'|'nearest'} [options.block] How far to scroll the element.
     * @param {Number} [options.edgeOffset] edgeOffset A margin around the element or rectangle to bring into view.
     * @param {Object|Boolean|Number} [options.animate] Set to `true` to animate the scroll by 300ms,
     * or the number of milliseconds to animate over, or an animation config object.
     * @param {Number} [options.animate.duration] The number of milliseconds to animate over.
     * @param {String} [options.animate.easing] The name of an easing function.
     * @param {Boolean} [options.highlight] Set to `true` to highlight the element when it is in view.
     * @param {Boolean} [options.focus] Set to `true` to focus the element when it is in view.
     * @returns {Promise} If the column exists, a promise which is resolved when the column header element has been
     * scrolled into view.
     * @category Scrolling
     */
    scrollColumnIntoView(column, options) {
        column = (column instanceof Column) ? column : this.columns.get(column) || this.columns.getById(column) || this.columns.getAt(column);

        return this.getSubGridFromColumn(column).scrollColumnIntoView(column, options);
    }

    // TODO The API { id: recordId, column: 'columnName' } is not clear: id has to be renamed to `record` or `recordId` to be self-explanatory;
    /**
     * Scrolls a cell into view (if it is not already)
     * @param {Object} cellContext Cell selector { id: recordId, column: 'columnName' }
     * @category Scrolling
     */
    scrollCellIntoView(cellContext, options) {
        return this.scrollRowIntoView(cellContext.id, Object.assign({
            column : cellContext.columnId
        }, typeof options === 'boolean' ? { animate : options } : options));
    }

    /**
     * Scroll all the way down
     * @returns {Promise} A promise which resolves when the bottom is reached.
     * @category Scrolling
     */
    scrollToBottom(options) {
        // triggers scroll to last record. not using current scroller height because we do not know if it is correct
        return this.scrollRowIntoView(this.store.last, options);
    }

    /**
     * Scroll all the way up
     * @returns {Promise} A promise which resolves when the top is reached.
     * @category Scrolling
     */
    scrollToTop(options) {
        return this.scrollable.scrollBy(0, -this.scrollable.y, options);
    }

    /**
     * Stores the scroll state. Returns an objects with a `scrollTop` number value for the entire grid and a `scrollLeft`
     * object containing a left position scroll value per sub grid.
     * @returns {Object}
     * @category Scrolling
     */
    storeScroll() {
        const
            me    = this,
            state = me.storedScrollState = {
                scrollTop  : me.scrollable.y,
                scrollLeft : {}
            };

        // TODO: Implement special multi-element Scroller subclass for Grids which
        // encapsulates the x axis only Scrollers of all its SubGrids.
        me.eachSubGrid(subGrid => {
            state.scrollLeft[subGrid.region] = subGrid.scrollable.x;
        });

        return state;
    }

    /**
     * Restore scroll state. If state is not specified, restores the last stored state.
     * @param {Object} [state] Scroll state, optional
     * @category Scrolling
     */
    restoreScroll(state = this.storedScrollState) {
        const me = this;

        // TODO: Implement special multi-element Scroller subclass for Grids which
        // encapsulates the x axis only Scrollers of all its SubGrids.
        me.eachSubGrid(subGrid => {
            const x = state.scrollLeft[subGrid.region];

            // Force scrollable to set its position to the underlying element in case it was removed and added back to
            // the DOM prior to restoring state
            if (x != null) {
                subGrid.scrollable.updateX(x);
                subGrid.header.scrollable.updateX(x);
                subGrid.footer.scrollable.updateX(x);
                subGrid.fakeScroller?.updateX(x);
            }
        });

        me.scrollable.updateY(state.scrollTop);
    }

    //endregion

    //region Theme & measuring

    beginGridMeasuring() {
        const me = this;

        if (!me.$measureCellElements) {
            me.$measureCellElements = DomHelper.createElement({
                // For row height measuring, features are not yet there. Work around that for the stripe feature,
                // which removes borders
                className : 'b-grid-subgrid ' + (!me._isRowMeasured && me.hasFeature('stripe') ? 'b-stripe' : ''),
                reference : 'subGridElement',
                style     : {
                    position   : 'absolute',
                    top        : '-10000px',
                    left       : '-100000px',
                    visibility : 'hidden',
                    contain    : 'strict'
                },
                children : [
                    {
                        className : 'b-grid-row',
                        reference : 'rowElement',
                        children  : [
                            {
                                className : 'b-grid-cell',
                                reference : 'cellElement',
                                style     : {
                                    width   : 'auto',
                                    contain : BrowserHelper.isFirefox ? 'layout paint' : 'layout style paint'
                                }
                            }
                        ]
                    }
                ]
            });
        }

        // Bring element into life if we get here early, to be able to access verticalScroller below
        me.getConfig('element');

        // Temporarily add to where subgrids live, to get have all CSS classes in play
        me.verticalScroller.appendChild(me.$measureCellElements.subGridElement);

        // Not yet on page, which prevents us from getting style values. Add it to the DOM temporarily
        if (!me.rendered) {
            const
                targetEl    = me.appendTo || me.insertBefore || document.body,
                rootElement = DomHelper.getRootElement(typeof targetEl === 'string' ? document.getElementById(targetEl) : targetEl);

            if (!me.adopt || !rootElement.contains(me.element)) {
                rootElement.appendChild(me.element);
                me.$removeAfterMeasuring = true;
            }
        }
        return me.$measureCellElements;
    }

    endGridMeasuring() {
        // Remove grid from DOM if it was added for measuring
        if (this.$removeAfterMeasuring) {
            this.element.remove();
            this.$removeAfterMeasuring = false;
        }

        // Remove measuring elements from grid
        this.$measureCellElements.subGridElement.remove();
    }

    /**
     * Creates a fake subgrid with one row and measures its height. Result is used as rowHeight.
     * @private
     */
    measureRowHeight() {
        const
            me             = this,
            // Create a fake subgrid with one row, since styling for row is specified on .b-grid-subgrid .b-grid-row
            { rowElement } = me.beginGridMeasuring(),
            // Use style height or default height from config.
            // Not using clientHeight since it will have some value even if no height specified in CSS
            styles         = DomHelper.getStyleValue(rowElement, ['height', 'border-top-width', 'border-bottom-width']),
            styleHeight    = parseInt(styles.height),
            // FF reports border width adjusted to device pixel ration, e.g. on a 150% scaling it would tell 0.6667px width
            // for a 1px border. Dividing by the integer part to take base devicePixelRatio into account
            multiplier     = BrowserHelper.isFirefox ? devicePixelRatio / Math.trunc(devicePixelRatio) : 1,
            borderTop      = styles['border-top-width'] ? Math.round(multiplier * parseFloat(styles['border-top-width'])) : 0,
            borderBottom   = styles['border-bottom-width'] ? Math.round(multiplier * parseFloat(styles['border-bottom-width'])) : 0;

        // Change rowHeight if specified in styling, also remember that value to replace later if theme changes and
        // user has not explicitly set some other height
        if (me.rowHeight == null || me.rowHeight === me._rowHeightFromStyle) {
            me.rowHeight = !isNaN(styleHeight) && styleHeight ? styleHeight : me.defaultRowHeight;
            me._rowHeightFromStyle = me.rowHeight;
        }

        // this measurement will be added to rowHeight during rendering, to get correct cell height
        me._rowBorderHeight = borderTop + borderBottom;

        me._isRowMeasured = true;

        me.endGridMeasuring();

        // There is a ticket about measuring the actual first row instead:
        // https://app.assembla.com/spaces/bryntum/tickets/5735-measure-first-real-rendered-row-for-rowheight/details
    }

    /**
     * Handler for global theme change event (triggered by shared.js). Remeasures row height.
     * @private
     */
    onThemeChange({ theme }) {
        // Can only measure when we are visible, so do it next time we are.
        this.whenVisible('measureRowHeight');

        this.trigger('theme', { theme });
    }

    //endregion

    //region Rendering of rows

    /**
     * Triggers a render of records to all row elements. Call after changing order, grouping etc to reflect changes
     * visually. Preserves scroll.
     * @category Rendering
     */
    refreshRows(returnToTop = false) {
        const { element, rowManager } = this;

        element.classList.add('b-notransition');

        if (returnToTop) {
            rowManager.returnToTop();
        }
        else {
            rowManager.refresh();
        }

        element.classList.remove('b-notransition');
    }

    /**
     * Triggers a render of all the cells in a column.
     * @param {Grid.column.Column} column
     * @category Rendering
     */
    refreshColumn(column) {
        if (column.isVisible) {
            const { field } = column;

            this.rowManager.forEach(row => {
                row.renderCell(row.getCell(field));
            });
        }
    }

    //endregion

    //region Render the grid

    /**
     * Recalculates virtual scrollbars widths and scrollWidth
     * @private
     */
    refreshVirtualScrollbars() {
        // NOTE: This was at some point changed to only run on platforms with width-occupying scrollbars, but it needs
        // to run with overlayed scrollbars also to make them show/hide as they should.

        const
            me                        = this,
            {
                headerContainer,
                footerContainer,
                virtualScrollers,
                scrollable,
                hasVerticalOverflow
            }                         = me,
            { classList }             = virtualScrollers,
            hadHorizontalOverflow     = !classList.contains('b-hide-display'),
            // We need to ask each subGrid if it has horizontal overflow.
            // If any do, we show the virtual scroller, otherwise we hide it.
            hasHorizontalOverflow     = Object.values(me.subGrids).some(subGrid => subGrid.overflowingHorizontally),
            horizontalOverflowChanged = hasHorizontalOverflow !== hadHorizontalOverflow;

        // If horizontal overflow state changed, the docked horizontal scrollbar's visibility
        //  must be synced to match, and this may cause a height change;
        if (horizontalOverflowChanged) {
            virtualScrollers.classList.toggle('b-hide-display', !hasHorizontalOverflow);
        }

        // Auto-widthed padding element at end hides or shows to create matching margin.
        if (DomHelper.scrollBarWidth) {
            // Header will need its extra padding if we have overflow, *OR* if we are overflowY : scroll
            const needsPadding = hasVerticalOverflow || scrollable.overflowY === 'scroll';

            headerContainer.classList.toggle('b-show-yscroll-padding', needsPadding);
            footerContainer.classList.toggle('b-show-yscroll-padding', needsPadding);
            virtualScrollers.classList.toggle('b-show-yscroll-padding', needsPadding);

            // Do any measuring necessitated by show/hide of the docked horizontal scrollbar
            /// *after* mutating DOM classnames.
            if (horizontalOverflowChanged) {
                // If any subgrids reported they have horizontal overflow, then we have to ask them
                // to sync the widths of the scroll elements inside the docked horizontal scrollbar
                // so that it takes up the required scrollbar width at the bottom of our body element.
                if (hasHorizontalOverflow) {
                    me.callEachSubGrid('refreshFakeScroll');
                }
                me.onHeightChange();
            }
        }
    }

    get hasVerticalOverflow() {
        return this.scrollable.hasOverflow('y');
    }

    /**
     * Returns content height calculated from row manager
     * @private
     */
    get contentHeight() {
        const rowManager = this.rowManager;
        return Math.max(rowManager.totalHeight, rowManager.bottomRow ? rowManager.bottomRow.bottom : 0);
    }

    onContentChange() {
        const
            me         = this,
            rowManager = me.rowManager;

        if (me.isVisible) {
            rowManager.estimateTotalHeight();
            me.paintListener = null;
            me.refreshTotalHeight(me.contentHeight);
            me.callEachSubGrid('refreshFakeScroll');
            me.onHeightChange();
        }
        // If not visible, this operation MUST be done when we become visible.
        // This is announced by the paint event which is triggered when a Widget
        // really gains visibility, ie is shown or rendered, or it's not hidden,
        // and a hidden/non-rendered ancestor is shown or rendered.
        // See Widget#triggerPaint.
        else if (!me.paintListener) {
            me.paintListener = me.on({
                paint   : 'onContentChange',
                once    : true,
                thisObj : me
            });
        }
    }

    triggerPaint() {
        if (!this.isPainted) {
            this.refreshBodyRectangle();
        }

        super.triggerPaint();
    }

    onHeightChange() {
        const me = this;

        // cache to avoid recalculations in the middle of rendering code (RowManger#getRecordCoords())
        me.refreshBodyRectangle();
        me._bodyHeight = me.autoHeight ? me.contentHeight : me.bodyContainer.offsetHeight;
    }

    suspendRefresh() {
        this.refreshSuspended++;
    }

    resumeRefresh(trigger) {
        if (this.refreshSuspended && !--this.refreshSuspended) {
            if (trigger) {
                this.refreshRows();
            }

            this.trigger('resumeRefresh', { trigger });
        }
    }

    /**
     * Rerenders all grid rows, completely replacing all row elements with new ones
     * @category Rendering
     */
    renderRows(keepScroll = true) {
        const
            me          = this,
            scrollState = keepScroll && me.storeScroll();

        if (me.refreshSuspended) {
            return;
        }

        /**
         * Grid rows are about to be rendered
         * @event beforeRenderRows
         * @param {Grid.view.Grid} source This grid.
         */
        me.trigger('beforeRenderRows');
        me.renderingRows = true;

        // This allows us to do things like disable animations on a refresh
        me.element.classList.add('b-grid-refreshing');

        if (!keepScroll) {
            me.scrollable.y = me._scrollTop = 0;
        }
        me.rowManager.reinitialize(!keepScroll);

        /**
         * Grid rows have been rendered
         * @event renderRows
         * @param {Grid.view.Grid} source This grid.
         */
        me.trigger('renderRows');

        me.renderingRows = false;
        me.onContentChange();

        if (keepScroll) {
            me.restoreScroll(scrollState);
        }

        me.element.classList.remove('b-grid-refreshing');
    }

    /**
     * Rerenders the grids rows, headers and footers, completely replacing all row elements with new ones
     * @category Rendering
     */
    renderContents() {
        const
            me                                                        = this,
            { element, headerContainer, footerContainer, rowManager } = me;

        me.emptyCache();

        // columns will be "drawn" on render anyway, bail out
        if (me.isPainted) {
            // reset measured header height, to make next call to get headerHeight measure it
            me._headerHeight = null;

            me.callEachSubGrid('refreshHeader', headerContainer);
            me.callEachSubGrid('refreshFooter', footerContainer);

            // Note that these are hook methods for features to plug in to. They do not do anything.
            me.renderHeader(headerContainer, element);
            me.renderFooter(footerContainer, element);

            me.fixSizes();

            // any elements currently used for rows should be released.
            // actual removal of elements is done in SubGrid#clearRows
            const refreshContext = rowManager.removeAllRows();

            rowManager.calculateRowCount(false, true, true);

            if (rowManager.rowCount) {
                // Sets up the RowManager's position for when renderRows calls RowManager#reinitialize
                // so that it renders the correct data block at the correct position.
                rowManager.setPosition(refreshContext);

                me.renderRows();
            }
        }
    }

    onPaintOverride() {
        // Internal procedure used for paint method overrides
        // Not used in onPaint() because it may be chained on instance and Override won't be applied
    }

    // Render rows etc. on first paint, to make sure Grids element has been laid out
    onPaint({ firstPaint }) {
        const me = this;

        me.ariaElement.setAttribute('aria-rowcount', me.store.count + 1);

        super.onPaint?.(...arguments);

        if (me.onPaintOverride() || !firstPaint) {
            return;
        }

        const
            {
                rowManager,
                store,
                element,
                headerContainer,
                bodyContainer,
                footerContainer
            }         = me,
            scrollPad = DomHelper.scrollBarPadElement;

        let columnsChanged,
            maxDepth = 0;

        // ARIA. Update our ariaElement that encapsulates all rows.
        // The header is counted as a row, and column headers are cells.
        me.role = store?.isTree ? 'treegrid' : 'grid';

        // See if updateResponsive changed any columns.
        me.columns.on({
            change : () => columnsChanged = true,
            once   : true
        });

        // Apply any responsive configs before rendering rows.
        me.updateResponsive(me.width, 0);

        // If there were any column changes, apply them
        if (columnsChanged) {
            me.callEachSubGrid('refreshHeader', headerContainer);
            me.callEachSubGrid('refreshFooter', footerContainer);
        }

        // Note that these are hook methods for features to plug in to. They do not do anything.
        // SubGrids take care of their own rendering.
        me.renderHeader(headerContainer, element);
        me.renderFooter(footerContainer, element);

        // These padding elements are only visible on scrollbar showing platforms.
        // And then, only when the owning element as the b-show-yscroll-padding class added.
        // See refreshVirtualScrollbars where this is synced on the header, footer and scroller elements.
        DomHelper.append(headerContainer, scrollPad);
        DomHelper.append(footerContainer, scrollPad);
        DomHelper.append(me.virtualScrollers, scrollPad);

        // Cached, updated on resize. Used by RowManager and by the subgrids upon their render.
        // Measure after header and footer have been rendered and taken their height share.
        me.refreshBodyRectangle();
        const bodyOffsetHeight = me.bodyContainer.offsetHeight;

        if (me.autoHeight) {
            me._bodyHeight = rowManager.initWithHeight(element.offsetHeight - headerContainer.offsetHeight - footerContainer.offsetHeight, true);
            bodyContainer.style.height = me.bodyHeight + 'px';
        }
        else {
            me._bodyHeight = bodyOffsetHeight;
            rowManager.initWithHeight(me._bodyHeight, true);
        }

        me.eachSubGrid(subGrid => {
            if (subGrid.header.maxDepth > maxDepth) {
                maxDepth = subGrid.header.maxDepth;
            }
        });

        headerContainer.dataset.maxDepth = maxDepth;

        me.fixSizes();

        if (store.count || !store.isLoading) {
            me.renderRows();
        }

        // With autoHeight cells we need to refresh rows when fonts are loaded, to get correct measurements
        if (me.columns.usesAutoHeight) {
            const { fonts } = document;
            if (fonts?.status !== 'loaded') {
                fonts.ready.then(() => !me.isDestroyed && me.refreshRows());
            }
        }

        me.initScroll();

        me.initInternalEvents();
    }

    render() {
        const me = this;

        // When displayed inside one of our containers, require a size to be considered visible. Ensures it is painted
        // on display when for example in a tab
        me.requireSize = Boolean(me.owner);

        // Render as a container. This renders the child SubGrids
        super.render(...arguments);

        if (!me.autoHeight) {
            // Sanity check that main element has been given some sizing styles, unless autoHeight is used in which case
            // it will be sized programmatically instead
            if (me.headerContainer.offsetHeight && !me.bodyContainer.offsetHeight) {
                console.warn('Grid element not sized correctly, please check your CSS styles and review how you size the widget');
            }

            // Warn if height equals the predefined minHeight, likely that is not what the dev intended
            if (
                !('minHeight' in me.initialConfig) &&
                !('height' in me.initialConfig) &&
                parseInt(globalThis.getComputedStyle(me.element).minHeight) === me.height
            ) {
                console.warn(
                    `The ${me.$$name} is sized by its predefined minHeight, likely this is not intended. ` +
                    `Please check your CSS and review how you size the widget, or assign a fixed height in the config. ` +
                    `For more information, see the "Basics/Sizing the component" guide in docs.`
                );
            }
        }
    }

    //endregion

    //region Hooks

    /**
     * Called after headers have been rendered to the headerContainer.
     * This does not do anything, it's just for Features to hook in to.
     * @param {HTMLElement} headerContainer DOM element which contains the headers.
     * @param {HTMLElement} element Grid element
     * @private
     * @category Rendering
     */
    renderHeader(headerContainer, element) {}

    /**
     * Called after footers have been rendered to the footerContainer.
     * This does not do anything, it's just for Features to hook in to.
     * @param {HTMLElement} footerContainer DOM element which contains the footers.
     * @param {HTMLElement} element Grid element
     * @private
     * @category Rendering
     */
    renderFooter(footerContainer, element) {}

    // Hook for features to affect cell rendering before renderers are run
    beforeRenderCell() {}

    // Hooks for features to react to a row being rendered
    beforeRenderRow() {}
    afterRenderRow() {}

    // Hook for features to react to scroll
    afterScroll() {}

    // Hook that can be overridden to prepare custom editors, can be used by framework wrappers
    processCellEditor(editorConfig) {}

    // Hook for features to react to column changes
    afterColumnsChange() {}

    // Hook for features to react to record removal (which might be transitioned)
    afterRemove(removeEvent) {}

    // Hook for features to react to groups being collapsed/expanded
    afterToggleGroup() {}

    // Hook for features to react to subgrid being collapsed
    afterToggleSubGrid() {}

    //endregion

    //region Masking and Appearance

    syncMaskCover(mask = this.masked) {
        if (mask) {
            const
                bodyRect     = (mask.cover === 'body') && this.rectangleOf('bodyContainer'),
                scrollerRect = bodyRect && this.rectangleOf('virtualScrollers'),
                { style }    = mask.element;

            // the width of the bodyCt covers the vscroll but the height does not cover the hscroll:
            style.marginTop = bodyRect ? `${bodyRect.y}px` : '';
            style.height    = bodyRect ? `${bodyRect.height + (scrollerRect?.height || 0)}px` : '';
        }
    }

    /**
     * Show a load mask with a spinner and the specified message. When using an AjaxStore masking and unmasking is
     * handled automatically, but if you are loading data in other ways you can call this function manually when your
     * load starts.
     * ```
     * myLoadFunction() {
     *   // Show mask before initiating loading
     *   grid.maskBody('Loading data');
     *   // Your custom loading code
     *   load.then(() => {
     *      // Hide the mask when loading is finished
     *      grid.unmaskBody();
     *   });
     * }
     * ```
     * @param {String|Object} loadMask The message to show in the load mask (next to the spinner) or a config object
     * for a {@link Core.widget.Mask}.
     * @returns {Core.widget.Mask}
     */
    maskBody(loadMask) {
        let ret;

        if (this.bodyContainer) {
            this.masked = Mask.mergeConfigs(this.loadMaskDefaults, loadMask);  // smart setter
            ret = this.masked;  // read back
        }

        return ret;
    }

    /**
     * Hide the load mask.
     */
    unmaskBody() {
        this.masked = null;
    }

    toggleEmptyText() {
        if (this.bodyContainer) {
            DomHelper.toggleClasses(this.bodyContainer, 'b-grid-empty', !(this.rowManager.rowCount > 0 || this.store.isLoading || this.store.isCommitting));
        }
    }

    // Notify columns when our read-only state is toggled
    updateReadOnly(readOnly, old) {
        super.updateReadOnly(readOnly, old);

        if (!this.isConfiguring) {
            for (const column of this.columns.bottomColumns) {
                column.updateReadOnly?.(readOnly);
            }
        }
    }

    //endregion

    //region Extract config

    // This function is not meant to be called by any code other than Base#getCurrentConfig().
    // It extracts the current configs for the grid, with special handling for inline data
    getCurrentConfig(options) {
        const
            result     = super.getCurrentConfig(options),
            { store }  = this,
            // Clean up inline data to not have group records in it
            data       = store.getInlineData(options),
            // Get stores current state, in case it has filters etc added at runtime
            storeState = store.getCurrentConfig(options);

        if (data.length) {
            result.data = data;
        }

        // Dont include the default model class
        if (storeState && store.originalModelClass === GridRowModel) {
            delete storeState.modelClass;
        }

        if (!ObjectHelper.isEmpty(storeState)) {
            result.store = storeState;
        }

        if (result.store) {
            delete result.store.data;
        }

        return result;
    }

    //endregion
}

// Register this widget type with its Factory
GridBase.initClass();

VersionHelper.setVersion('grid', '5.1.4');
