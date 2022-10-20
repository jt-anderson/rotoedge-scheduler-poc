import Bar from './Bar.js';
import StringHelper from '../../Core/helper/StringHelper.js';
import DomSync from '../../Core/helper/DomSync.js';
import Tooltip from '../../Core/widget/Tooltip.js';

/**
 * @module Grid/view/Header
 */

/**
 * The Grid header, which contains simple columns but also allows grouped columns. One instance is created and used per SubGrid
 * automatically, you should not need to instantiate this class manually. See {@link Grid.column.Column} for information about
 * column configuration.
 *
 * @extends Grid/view/Bar
 * @internal
 *
 * @inlineexample Grid/view/Header.js
 */
export default class Header extends Bar {
    static get $name() {
        return 'Header';
    }

    // Factoryable type name
    static get type() {
        return 'gridheader';
    }

    get subGrid() {
        return this._subGrid;
    }

    set subGrid(subGrid) {
        this._subGrid = this.owner = subGrid;
    }

    get region() {
        return this.subGrid?.region;
    }

    changeElement(element, was) {
        const { region } = this;

        // Columns must be examined for maxDepth
        this.getConfig('columns');

        return super.changeElement({
            className : {
                'b-grid-header-scroller'             : 1,
                [`b-grid-header-scroller-${region}`] : region
            },
            children : [{
                reference : 'headersElement',
                className : {
                    'b-grid-headers'             : 1,
                    [`b-grid-headers-${region}`] : region
                },
                dataset : {
                    region,
                    reference : 'headersElement',
                    maxDepth  : this.maxDepth
                }
            }]
        }, was);
    }

    get overflowElement() {
        return this.headersElement;
    }

    /**
     * Recursive column header config creator.
     * Style not included because of CSP. Widths are fixed up in
     * {@link #function-fixHeaderWidths}
     * @private
     */
    getColumnConfig(column) {
        const
            {
                id,
                align,
                resizable,
                isLeaf,
                isParent,
                isLastInSubGrid,
                cls,
                childLevel,
                field,
                tooltip,
                children,
                isFocusable,
                grid
            } = column,
            // Headers tested standalone - may be no grid
            focusedCell = grid?.focusedCell,
            isFocused   = focusedCell?.rowIndex === -1 && focusedCell?.column === column;

        if (column.isVisible) {
            return {
                className : {
                    'b-grid-header'                  : 1,
                    'b-grid-header-parent'           : isParent,
                    [`b-level-${childLevel}`]        : 1,
                    [`b-depth-${column.meta.depth}`] : 1,
                    [`b-grid-header-align-${align}`] : align,
                    'b-grid-header-resizable'        : resizable && isLeaf,
                    [cls]                            : cls,
                    'b-last-parent'                  : isParent && isLastInSubGrid,
                    'b-last-leaf'                    : isLeaf && isLastInSubGrid
                },
                role                            : isFocusable ? 'columnheader' : 'presentation',
                'aria-sort'                     : 'none',
                'aria-label'                    : column.ariaLabel,
                [isFocusable ? 'tabIndex' : ''] : isFocused ? 0 : -1,
                dataset                         : {
                    ...Tooltip.encodeConfig(tooltip),
                    columnId                : id,
                    [field ? 'column' : ''] : field
                },
                children : [{
                    className : 'b-grid-header-text',
                    children  : [{
                        [grid && isFocusable ? 'id' : ''] : `${grid?.id}-column-${column.id}`,
                        className                         : 'b-grid-header-text-content'
                    }]
                }, children ? {
                    className : 'b-grid-header-children',
                    children  : children.map(child => this.getColumnConfig(child))
                } : null,
                {
                    className : 'b-grid-header-resize-handle'
                }]
            };
        }
    }

    // used by safari to fix flex when rows width shrink below this value
    calculateMinWidthForSafari() {
        let minWidth = 0;

        this.columns.visibleColumns.forEach(column => {
            minWidth += column.calculateMinWidth();
        });

        return minWidth;
    }

    /**
     * Fix header widths (flex or fixed width) after rendering. Not a part of template any longer because of CSP
     * @private
     */
    fixHeaderWidths() {
        this.fixCellWidths();
    }

    refreshHeaders() {
        const me = this;

        // run renderers, not done from template to work more like cell rendering
        me.columns.traverse(column => {
            const headerElement = me.getBarCellElement(column.id);

            if (headerElement) {
                let html = column.headerText;

                if (column.headerRenderer) {
                    html = column.headerRenderer.call(column.thisObj || me, { column, headerElement });
                }

                if (column.icon) {
                    html = `<i class="${StringHelper.encodeHtml(column.icon)}"></i>` + (html || '');
                }

                const innerEl = headerElement.querySelector('.b-grid-header-text-content');
                if (innerEl) {
                    innerEl.innerHTML = html || '';
                }
            }
        });

        me.fixHeaderWidths();
    }

    get columns() {
        const
            me     = this,
            result = super.columns;

        if (!me.columnsDetacher) {
            // columns is a chained store, it will be repopulated from master when columns change.
            // That action always triggers change with action dataset.
            me.columnsDetacher = result.on({
                change() {
                    me.initDepths();
                },
                thisObj : me
            });

            me.initDepths();
        }

        return result;
    }

    set columns(columns) {
        super.columns = columns;
    }

    /**
     * Depths are used for styling of grouped headers. Sets them on meta.
     * @private
     */
    initDepths(columns = this.columns.topColumns, parent = null) {
        const me = this;
        let maxDepth = 0;

        if (parent?.meta) {
            parent.meta.depth++;
        }

        for (const column of columns) {
            const { meta } = column;
            // TODO: this should maybe move
            meta.depth = 0;

            if (column.children) {
                me.initDepths(column.children.filter(me.columns.chainedFilterFn), column);
                if (meta.depth && parent) {
                    parent.meta.depth += meta.depth;
                }
            }

            if (meta.depth > maxDepth) {
                maxDepth = meta.depth;
            }
        }

        if (!parent) {
            me.maxDepth = maxDepth;
        }

        return maxDepth;
    }

    //endregion

    //region Getters

    /**
     * Get the header cell element for the specified column.
     * @param {String} columnId Column id
     * @returns {HTMLElement} Header cell element
     */
    getHeader(columnId) {
        return this.getBarCellElement(columnId);
    }

    //endregion

    get contentElement() {
        return this.element.firstElementChild;
    }

    refreshContent() {
        const me = this;

        DomSync.sync({
            domConfig : {
                children         : me.columns.topColumns.map(col => me.getColumnConfig(col)),
                onlyChildren     : true,
                strict           : true,
                syncIdField      : 'columnId',
                releaseThreshold : 0
            },
            targetElement : me.contentElement
        });

        me.refreshHeaders();
    }

    onPaint({ firstPaint }) {
        if (firstPaint) {
            this.refreshContent();
        }
    }
}

// Register this widget type with its Factory
Header.initClass();
