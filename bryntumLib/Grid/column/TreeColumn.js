import Column from './Column.js';
import ColumnStore from '../data/ColumnStore.js';
import DomHelper from '../../Core/helper/DomHelper.js';

/**
 * @module Grid/column/TreeColumn
 */

let currentParentHasIcon = false;

/**
 * A column that displays a tree structure when using the {@link Grid.feature.Tree tree} feature.
 *
 * Default editor is a {@link Core.widget.TextField TextField}.
 *
 * TreeColumn provides configs to define icons for {@link #config-expandIconCls expanded} / {@link #config-collapseIconCls collapsed} nodes,
 * {@link #config-expandedFolderIconCls expanded folder} / {@link #config-collapsedFolderIconCls collapsed folder} nodes and
 * {@link #config-leafIconCls leaf} nodes.
 *
 * When the TreeColumn renders its cells, it will look for two special fields {@link Grid.data.GridRowModel#field-href}
 * and {@link Grid.data.GridRowModel#field-target}. Specifying `href` will produce a link for the TreeNode,
 * and `target` will have the same meaning as in an A tag:
 *
 * ```javascript
 * {
 *    id        : 1,
 *    name      : 'Some external link'
 *    href      : '//www.website.com",
 *    target    : '_blank"
 * }
 * ```
 *
 * @example
 * new TreeGrid({
 *     appendTo : document.body,
 *
 *     columns : [
 *          { type: 'tree', field: 'name' }
 *     ]
 * });
 *
 * @classType tree
 * @extends Grid/column/Column
 * @inlineexample Grid/column/TreeColumn.js
 */
export default class TreeColumn extends Column {
    static get defaults() {
        return {
            tree     : true,
            hideable : false,
            minWidth : 150
        };
    }

    static get fields() {
        return [
            /**
             * The icon to use for the collapse icon in collapsed state
             * @config {String} expandIconCls
             */
            { name : 'expandIconCls', defaultValue : 'b-icon b-icon-tree-expand' },

            /**
             * The icon to use for the collapse icon in expanded state
             * @config {String} collapseIconCls
             */
            { name : 'collapseIconCls', defaultValue : 'b-icon b-icon-tree-collapse' },

            /**
             * The icon to use for the collapse icon in expanded state
             * @config {String} collapsedFolderIconCls
             */
            { name : 'collapsedFolderIconCls' },

            /**
             * The icon to use for the collapse icon in expanded state
             * @config {String} expandedFolderIconCls
             */
            { name : 'expandedFolderIconCls' },

            /**
             * Size of the child indent in em. Resulting indent is indentSize multiplied by child level.
             * @config {Number} indentSize
             * @default 1.7
             */
            { name : 'indentSize', defaultValue : 1.7 },

            /**
             * The icon to use for the leaf nodes in the tree
             * @config {String} leafIconCls
             */
            { name : 'leafIconCls', defaultValue : 'b-icon b-icon-tree-leaf' },

            { name : 'editTargetSelector', defaultValue : '.b-tree-cell-value' }
        ];
    }

    static get type() {
        return 'tree';
    }

    constructor(config, store) {
        super(...arguments);

        const me = this;

        // We handle htmlEncoding in this class rather than relying on the generic Row DOM manipulation
        // since this class requires quite a lot of DOM infrastructure around the actual rendered content
        me.shouldHtmlEncode = me.htmlEncode;
        me.setData('htmlEncode', false);

        // add tree renderer (which calls original renderer internally)
        if (me.renderer) {
            me.originalRenderer = me.renderer;
        }
        me.renderer = me.treeRenderer.bind(me);
    }

    /**
     * A column renderer that is automatically added to the column with { tree: true }. It adds padding and node icons
     * to the cell to make the grid appear to be a tree. The original renderer is called in the process.
     * @private
     */
    treeRenderer(renderData) {
        const
            me       = this,
            {
                grid,
                column,
                cellElement,
                row,
                record,
                isExport
            }           = renderData,
            gridMeta    = record.instanceMeta(grid.store),
            isCollapsed = !record.isLeaf && gridMeta.collapsed,
            innerConfig = {
                className : 'b-tree-cell-value'
            },
            children    = [innerConfig],
            result      = {
                className : 'b-tree-cell-inner',
                tag       : record.href ? 'a' : 'div',
                href      : record.href,
                target    : record.target,
                children
            },
            rowClasses  = {
                'b-tree-parent-row'  : 0,
                'b-tree-collapsed'   : 0,
                'b-tree-expanded'    : 0,
                'b-loading-children' : 0
            };

        let outputIsObject, iconCls, { value } = renderData;

        if (me.originalRenderer) {
            const
                rendererHtml         = me.originalRenderer(renderData),
                // Check if the cell content is going to be rendered by framework
                hasFrameworkRenderer = grid.hasFrameworkRenderer?.({
                    cellContent : rendererHtml,
                    column
                });

            outputIsObject = typeof rendererHtml === 'object' && !hasFrameworkRenderer;

            // Reset the value when framework is responsible for the cell content
            value = hasFrameworkRenderer ? '' : (rendererHtml === false ? cellElement.innerHTML : rendererHtml);

            // Save content to the `rendererHtml` to be used in processCellContent implemented by framework
            renderData.rendererHtml = rendererHtml;
        }

        if (!outputIsObject) {
            value = String(value ?? '');
        }

        if (isExport) {
            return value;
        }

        if (!record.isLeaf) {
            const
                isCollapsed     = !record.isExpanded(grid.store),
                expanderIconCls = isCollapsed ? me.expandIconCls : me.collapseIconCls,
                folderIconCls   = isCollapsed ? me.collapsedFolderIconCls : me.expandedFolderIconCls;

            rowClasses['b-tree-parent-row']  = 1;
            rowClasses['b-tree-collapsed']   = isCollapsed;
            rowClasses['b-tree-expanded']    = !isCollapsed;
            rowClasses['b-loading-children'] = gridMeta.isLoadingChildren;

            cellElement.classList.add('b-tree-parent-cell');

            children.unshift({
                tag       : 'i',
                className : {
                    'b-tree-expander' : 1,
                    [expanderIconCls] : 1,
                    'b-empty-parent'  : !gridMeta.isLoadingChildren && (record.children !== true && !record.children?.length)
                }
            });

            // Allow user to customize tree icon or opt out entirely
            currentParentHasIcon = iconCls = renderData.iconCls || record.iconCls || folderIconCls;
        }
        else {
            // TODO: Cleanup for reusing dom nodes should be done elsewhere, also cleanup selection
            cellElement.classList.add('b-tree-leaf-cell');

            // Allow user to customize tree icon or opt out entirely
            iconCls = renderData.iconCls || record.iconCls || me.leafIconCls;
        }

        if (iconCls) {
            children.splice(children.length - 1, 0, {
                tag       : 'i',
                className : {
                    'b-tree-icon' : 1,
                    [iconCls]     : 1
                }
            });
        }

        // Row can be just a dummy object for example when the renderer is called from Column#resizeToFitContent.
        // Add/remove the various tree node classes.
        // Keep row's aria state up to date
        if (row.isRow) {
            row.assignCls(rowClasses);

            if (!record.isLeaf) {
                row.setAttribute('aria-expanded', !isCollapsed);

                if (isCollapsed) {
                    row.removeAttribute('aria-owns');
                }
                else {
                    for (const region in grid.subGrids) {
                        const el = row.elements[region];

                        // A branch node may be configured expanded, but yet have no children.
                        // They may be added dynamically.
                        DomHelper.setAttributes(el, {
                            'aria-owns' : record.children?.length ? record.children?.map(r => `${grid.id}-${region}-${r.id}`).join(' ') : null
                        });
                    }
                };
            }
        }

        // If we are encoding HTML, or there's no raw HTML, we can use the children property
        // with the raw value as a child, and DomSync will create a TextNode from that.
        if (outputIsObject || me.shouldHtmlEncode || !value.includes('<')) {
            if (outputIsObject) {
                Object.assign(innerConfig, value);
            }
            innerConfig.children = innerConfig.children || [];

            innerConfig.children.unshift(outputIsObject ? null : value);
        }
        // If we are accepting HTML without encoding it, and there is HTML we must use html property
        else {
            innerConfig.html = value;
        }

        const padding = (record.childLevel * me.indentSize + (record.isLeaf ? (currentParentHasIcon ? 2.0 : (iconCls ? 0.5 : 0.4)) : 0));

        result.style = `padding-inline-start:${padding}em`;

        return result;
    }

    // This function is not meant to be called by any code other than Base#getCurrentConfig().
    // It extracts the current configs (fields) for the column, with special handling for the renderer
    getCurrentConfig(options) {
        const result = super.getCurrentConfig(options);

        // Use app renderer
        result.renderer = this.originalRenderer;

        return result;
    }
}

ColumnStore.registerColumnType(TreeColumn, true);
TreeColumn.exposeProperties();
