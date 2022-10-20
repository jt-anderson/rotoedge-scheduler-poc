import ContextMenuBase from '../../Core/feature/base/ContextMenuBase.js';
import GridFeatureManager from '../feature/GridFeatureManager.js';
import ObjectHelper from '../../Core/helper/ObjectHelper.js';
import StringHelper from '../../Core/helper/StringHelper.js';

/**
 * @module Grid/feature/HeaderMenu
 */

/**
 * Right click column header or focus it and press SPACE key to show the context menu for headers.
 *
 * ### Default header menu items
 *
 * The Header menu has no default items provided by the `HeaderMenu` feature, but there are other features
 * that populate the header menu with the following items:
 *
 * | Reference         | Text                              | Weight | Feature                                        | Description                                       |
 * |-------------------|-----------------------------------|--------|------------------------------------------------|---------------------------------------------------|
 * | `filter`          | Filter                            | 100    | {@link Grid.feature.Filter Filter}             | Shows the filter popup to add a filter            |
 * | `editFilter`      | Edit filter                       | 100    | {@link Grid.feature.Filter Filter}             | Shows the filter popup to change/remove a filter  |
 * | `removeFilter`    | Remove filter                     | 110    | {@link Grid.feature.Filter Filter}             | Stops filtering by selected column field          |
 * | `toggleFilterBar` | Hide filter bar / Show filter bar | 120    | {@link Grid.feature.FilterBar FilterBar}       | Toggles filter bar visibility                     |
 * | `columnPicker`    | Columns                           | 200    | {@link Grid.feature.ColumnPicker ColumnPicker} | Shows a submenu to control columns visibility     |
 * | \>column.id*      | column.text*                      |        | {@link Grid.feature.ColumnPicker ColumnPicker} | Check item to hide/show corresponding column      |
 * | `hideColumn`      | Hide column                       | 210    | {@link Grid.feature.ColumnPicker ColumnPicker} | Hides selected column                             |
 * | `movePrev  `      | Move previous                     | 220    | {@link Grid.feature.HeaderMenu HeaderMenu}     | Moves selected column before its previous sibling |
 * | `moveNext`        | Move next                         | 230    | {@link Grid.feature.HeaderMenu HeaderMenu}     | Moves selected column after its next sibling      |
 * | `sortAsc`         | Sort ascending                    | 300    | {@link Grid.feature.Sort Sort}                 | Sort by the column field in ascending order       |
 * | `sortDesc`        | Sort descending                   | 310    | {@link Grid.feature.Sort Sort}                 | Sort by the column field in descending order      |
 * | `multiSort`       | Multi sort                        | 320    | {@link Grid.feature.Sort Sort}                 | Shows a submenu to control multi-sorting          |
 * | \>`addSortAsc`    | Add ascending sorting             | 330    | {@link Grid.feature.Sort Sort}                 | Adds ascending sorter using the column field      |
 * | \>`addSortDesc`   | Add descending sorting            | 340    | {@link Grid.feature.Sort Sort}                 | Adds descending sorter using the column field     |
 * | \>`removeSorter`  | Remove sorter                     | 350    | {@link Grid.feature.Sort Sort}                 | Stops sorting by selected column field            |
 * | `groupAsc`        | Group ascending                   | 400    | {@link Grid.feature.Group Group}               | Group by the column field in ascending order      |
 * | `groupDesc`       | Group descending                  | 410    | {@link Grid.feature.Group Group}               | Group by the column field in descending order     |
 * | `groupRemove`     | Stop grouping                     | 420    | {@link Grid.feature.Group Group}               | Stops grouping                                    |
 * | `mergeCells`      | Merge cells                       | 500    | {@link Grid.feature.MergeCells}                | Merge cells with same value in a sorted column    |
 *
 * \* - items that are generated dynamically
 *
 * \> - first level of submenu
 *
 * ### Customizing the menu items
 *
 * The menu items in the Header menu can be customized, existing items can be changed or removed,
 * and new items can be added. This is handled using the `items` config of the feature.
 *
 * Add extra items for all columns:
 *
 * ```javascript
 * const grid = new Grid({
 *   features : {
 *     headerMenu : {
 *       items : {
 *         extraItem : { text: 'My header item', icon: 'fa fa-car', weight: 200, onItem : () => ... }
 *       }
 *     }
 *   }
 * });
 * ```
 *
 * It is also possible to add items using columns config. See examples below.
 *
 * Add extra items for a single column:
 *
 * ```javascript
 * const grid = new Grid({
 *   columns: [
 *     {
 *       field: 'name',
 *       text: 'Name',
 *       headerMenuItems: {
 *         columnItem : { text: 'My unique header item', icon: 'fa fa-flask', onItem : () => ... }
 *       }
 *     }
 *   ]
 * });
 * ```
 *
 * Remove built in item:
 *
 * ```javascript
 * const grid = new Grid({
 *   features : {
 *     headerMenu : {
 *       items : {
 *          // Hide 'Stop grouping'
 *          groupRemove : false
 *       }
 *     }
 *   }
 * });
 * ```
 *
 * Customize built in item:
 *
 * ```javascript
 * const grid = new Grid({
 *   features : {
 *     headerMenu : {
 *       items : {
 *          hideColumn : {
 *              text : 'Bye bye column'
 *          }
 *       }
 *     }
 *   }
 * });
 * ```
 *
 * Remove nested menu item:
 *
 * ```javascript
 * const grid = new Grid({
 *     features : {
 *         headerMenu : {
 *             items : {
 *                 multiSort : {
 *                     menu : { removeSorter : false }
 *                 }
 *             }
 *         }
 *     }
 * });
 * ```
 *
 * It is also possible to manipulate the default items and add new items in the processing function:
 *
 * ```javascript
 * const grid = new Grid({
 *   features : {
 *     headerMenu : {
 *       processItems({items, record}) {
 *           if (record.cost > 5000) {
 *              items.myItem = { text : 'Split cost' };
 *           }
 *       }
 *     }
 *   }
 * });
 * ```
 *
 * Full information of the menu customization can be found in the "Customizing the Cell menu and the Header menu" guide.
 *
 * This feature is <strong>enabled</strong> by default.
 *
 * ## Keyboard shortcuts
 * This feature has the following default keyboard shortcuts:
 *
 * | Keys       | Action               | Action description                              |
 * |------------|----------------------|-------------------------------------------------|
 * | Space      | showContextMenuByKey | Shows context menu for currently focused header |
 * | Ctrl+Space | showContextMenuByKey | Shows context menu for currently focused header |
 *
 * For more information on how to customize keyboard shortcuts, please see
 * [our guide](#Grid/guides/customization/keymap.md)
 *
 * @extends Core/feature/base/ContextMenuBase
 * @demo Grid/contextmenu
 * @classtype headerMenu
 * @feature
 *
 * @inlineexample Grid/feature/HeaderMenu.js
 */
export default class HeaderMenu extends ContextMenuBase {
    //region Config

    static get $name() {
        return 'HeaderMenu';
    }

    static get configurable() {
        return {
            type : 'header',

            /**
             * This is a preconfigured set of items used to create the default context menu.
             *
             * The `items` provided by this feature are listed in the intro section of this class. You can
             * configure existing items by passing a configuration object to the keyed items.
             *
             * To remove existing
             * items, set corresponding keys to `false`
             *
             * ```javascript
             * const scheduler = new Scheduler({
             *     features : {
             *         headerMenu : {
             *             items : {
             *                 filter        : false,
             *                 columnPicker  : false
             *             }
             *         }
             *     }
             * });
             * ```
             *
             * See the feature config in the above example for details.
             *
             * @config {Object} items
             */
            items : null,

            /**
              * Configure as `true` to show two extra menu options to move the selected column to either
              * before its previous sibling, or after its next sibling.
              *
              * This is a keyboard-accessible version of drag/drop column reordering.
              * @config {Boolean}
              * @category Accessibility
              */
            moveColumns : null

            /**
             * See {@link #keyboard-shortcuts Keyboard shortcuts} for details
             * @config {Object} keyMap
             */

        };
    }

    static get defaultConfig() {
        return {
            /**
             * A function called before displaying the menu that allows manipulations of its items.
             * Returning `false` from this function prevents the menu being shown.
             *
             * ```javascript
             *   features         : {
             *       headerMenu : {
             *           processItems({ column, items }) {
             *               // Add or hide existing items here as needed
             *               items.myAction = {
             *                   text   : 'Cool action',
             *                   icon   : 'b-fa b-fa-fw b-fa-ban',
             *                   onItem : () => console.log('Some coolness'),
             *                   weight : 300 // Move to end
             *               };
             *
             *               // Hide column picker
             *               items.columnPicker.hidden = true;
             *           }
             *       }
             *   },
             * ```
             * @param {Object} context An object with information about the menu being shown
             * @param {Grid.column.Column} context.column The current column
             * @param {Object} context.items An object containing the {@link Core.widget.MenuItem menu item} configs keyed by their id
             * @param {Event} context.event The DOM event object that triggered the show
             * @config {Function}
             * @preventable
             */
            processItems : null
        };
    }

    static get pluginConfig() {
        const config = super.pluginConfig;

        config.chain.push('populateHeaderMenu');

        return config;
    }

    //endregion

    //region Events

    /**
     * This event fires on the owning Grid before the context menu is shown for a header.
     * Allows manipulation of the items to show in the same way as in the {@link #config-processItems}.
     *
     * Returning `false` from a listener prevents the menu from being shown.
     *
     * @event headerMenuBeforeShow
     * @on-owner
     * @preventable
     * @param {Grid.view.Grid} source The grid
     * @param {Core.widget.Menu} menu The menu
     * @param {Object} items Menu item configs
     * @param {Grid.column.Column} column Column
     */

    /**
     * This event fires on the owning Grid after the context menu is shown for a header
     * @event headerMenuShow
     * @on-owner
     * @param {Grid.view.Grid} source The grid
     * @param {Core.widget.Menu} menu The menu
     * @param {Object} items Menu item configs
     * @param {Grid.column.Column} column Column
     */

    /**
     * This event fires on the owning Grid when an item is selected in the header context menu.
     * @event headerMenuItem
     * @on-owner
     * @param {Grid.view.Grid} source The grid
     * @param {Core.widget.Menu} menu The menu
     * @param {Core.widget.MenuItem} item Selected menu item
     * @param {Grid.column.Column} column Column
     */

    /**
     * This event fires on the owning Grid when a check item is toggled in the header context menu.
     * @event headerMenuToggleItem
     * @on-owner
     * @param {Grid.view.Grid} source The grid
     * @param {Core.widget.Menu} menu The menu
     * @param {Core.widget.MenuItem} item Selected menu item
     * @param {Grid.column.Column} column Column
     * @param {Boolean} checked Checked or not
     */

    //endregion

    //region Menu handlers

    shouldShowMenu(eventParams) {
        const { column } = eventParams;

        return column && column.enableHeaderContextMenu !== false && column !== this.client.timeAxisColumn;
    }

    getDataFromEvent(event) {
        return ObjectHelper.assign(super.getDataFromEvent(event), this.client.getHeaderDataFromEvent(event));
    }

    populateHeaderMenu({ items, column }) {
        const me = this;

        if (column) {
            if (column.headerMenuItems) {
                ObjectHelper.merge(items, column.headerMenuItems);
            }
            if (me.moveColumns) {
                const
                    columnToMoveBefore = me.getColumnToMoveBefore(column),
                    columnToMoveAfter = me.getColumnToMoveAfter(column);

                if (columnToMoveBefore) {
                    items.movePrev = {
                        weight : 220,
                        icon   : 'b-fw-icon b-icon-column-move-left',
                        text   : me.L('L{moveBefore}', StringHelper.encodeHtml(columnToMoveBefore.text)),
                        onItem : () => {
                            const { parent : oldParent } = column;

                            // If the operation was successful, postprocess. Check for
                            // parent being empty and set the new region.
                            if (columnToMoveBefore.parent.insertChild(column, columnToMoveBefore)) {
                                column.region = columnToMoveBefore.region;

                                // If we have removed the last child, remove the empty group.
                                // Column#sealed may have vetoed the operation.
                                if (!oldParent.children?.length) {
                                    oldParent.remove();
                                }
                            }
                        }
                    };
                }
                if (columnToMoveAfter) {
                    items.moveNext = {
                        weight : 230,
                        icon   : 'b-fw-icon b-icon-column-move-right',
                        text   : me.L('L{moveAfter}', StringHelper.encodeHtml(columnToMoveAfter.text)),
                        onItem : () => {
                            const { parent : oldParent } = column;

                            // If the operation was successful, postprocess. Check for
                            // parent being empty and set the new region.
                            if (columnToMoveAfter.parent.insertChild(column, columnToMoveAfter.nextSibling)) {
                                column.region = columnToMoveAfter.region;

                                // If we have removed the last child, remove the empty group.
                                // Column#sealed may have vetoed the operation.
                                if (!oldParent.children?.length) {
                                    oldParent.remove();
                                }
                            }
                        }
                    };
                }
            }
        }

        return items;
    }

    getColumnToMoveBefore(column) {
        const { previousSibling, parent } = column;

        if (previousSibling) {
            return previousSibling.children && !column.children ? previousSibling.children[previousSibling.children.length - 1] : previousSibling;
        }

        // Move to before parent
        if (!parent.isRoot) {
            return parent;
        }
    }

    getColumnToMoveAfter(column) {
        const { nextSibling, parent } = column;

        if (nextSibling) {
            return nextSibling;
        }

        // Move to before parent
        if (!parent.isRoot) {
            return parent;
        }
    }
}

HeaderMenu.featureClass = '';

GridFeatureManager.registerFeature(HeaderMenu, true);
