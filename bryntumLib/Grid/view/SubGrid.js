import BrowserHelper from '../../Core/helper/BrowserHelper.js';
import ObjectHelper from '../../Core/helper/ObjectHelper.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import Widget from '../../Core/widget/Widget.js';
import Column from '../column/Column.js';
import SubGridScroller from '../util/SubGridScroller.js';
import Rectangle from '../../Core/helper/util/Rectangle.js';
import Scroller from '../../Core/helper/util/Scroller.js';
import EventHelper from '../../Core/helper/EventHelper.js';

/**
 * @module Grid/view/SubGrid
 */
const sumWidths = (t, e) => t + e.getBoundingClientRect().width;

/**
 * A SubGrid is a part of the grid (it has at least one and normally no more than two, called locked and normal). It
 * has its own header, which holds the columns to display rows for in the SubGrid. SubGrids are created by Grid, you
 * should not need to create instances directly.
 *
 * If not configured with a width or flex, the SubGrid will be sized to fit its columns. In this case, if all columns
 * have a fixed width (not using flex) then toggling columns will also affect the width of the SubGrid.
 *
 * @extends Core/widget/Widget
 */
export default class SubGrid extends Widget {
    //region Config

    static get $name() {
        return 'SubGrid';
    }

    // Factoryable type name
    static get type() {
        return 'subgrid';
    }

    /**
     * Region (name) for this SubGrid
     * @config {String} region
     */

    /**
     * Column store, a store containing the columns for this SubGrid
     * @config {Grid.data.ColumnStore} columns
     */

    static get defaultConfig() {
        return {
            localizableProperties : ['emptyText'],

            insertRowsBefore : null,
            appendTo         : null,
            monitorResize    : true,
            headerClass      : null,
            footerClass      : null,

            /**
             * Set `true` to start subgrid collapsed. To operate collapsed state on subgrid use
             * {@link #function-collapse}/{@link #function-expand} methods.
             * @config {Boolean}
             * @default false
             */
            collapsed : null,

            scrollable : {
                // Each SubGrid only handles scrolling in the X axis.
                // The owning Grid handles the Y axis.
                overflowX : 'hidden-scroll'
            },

            scrollerClass : SubGridScroller,

            // Will be set to true by GridSubGrids if it calculates the subgrids width based on its columns.
            // Used to determine if hiding a column should affect subgrids width
            hasCalculatedWidth : null,

            /**
             * Set `true` to disable moving columns into or out of this SubGrid.
             * @config {Boolean}
             * @default false
             * @private
             */
            sealedColumns : null,

            emptyText : null
        };
    }

    static get configurable() {
        return {
            element                : true,
            header                 : {},
            footer                 : {},
            virtualScrollerElement : true,
            splitterElement        : true,
            headerSplitter         : true,
            scrollerSplitter       : true,
            footerSplitter         : true,

            /**
             * Set to `false` to prevent this subgrid being resized with the {@link Grid.feature.RegionResize} feature
             * @internal
             * @config {Boolean}
             * @default true
             */
            resizable : null,

            role : 'presentation'
        };
    }

    static delayable = {
        hideOverlayScroller : 1000
    }

    //endregion

    //region Init

    /**
     * SubGrid constructor
     * @param config
     * @private
     */
    construct(config) {
        const me = this;

        super.construct(config);

        this.rowManager.on('addrows', this.onAddRow, this);

        if (BrowserHelper.isFirefox) {
            const
                { element }      = me,
                verticalScroller = me.grid.scrollable;

            // Firefox cannot scroll vertically smoothly when using touch pad. Even a microscopic horizontal touch will
            // abort the vertical scrolling. To counter this we ignore pointer events on the subgrid element temporarily
            // until scroll stops. No test coverage.
            // https://github.com/bryntum/support/issues/3000
            let lastScrollTop = 0;
            element.addEventListener('wheel', ({ ctrlKey, deltaY, deltaX }) => {
                const isVerticalScroll = Math.abs(deltaY) > Math.abs(deltaX);

                // Ignore wheel event with Control key pressed - it doesn't scroll, it either zooms scheduler or zooms
                // the page.
                if (!ctrlKey && isVerticalScroll && !me.scrollEndDetacher && verticalScroller.y !== lastScrollTop) {
                    element.style.pointerEvents = 'none';
                    lastScrollTop               = verticalScroller.y;

                    me.scrollEndDetacher = verticalScroller.on({
                        scrollEnd : async() => {
                            lastScrollTop               = verticalScroller.y;
                            element.style.pointerEvents = '';

                            me.scrollEndDetacher = null;
                        },
                        once : true
                    });
                }
            });
        }
    }

    doDestroy() {
        const me = this;

        me.header.destroy();
        me.footer.destroy();
        me.fakeScroller?.destroy();

        me.virtualScrollerElement.remove();
        me.splitterElement.remove();
        me.headerSplitter.remove();
        me.scrollerSplitter.remove();
        me.footerSplitter.remove();

        super.doDestroy();
    }

    get barConfig() {
        const
            me              = this,
            { width, flex } = me.element.style,
            config          = {
                subGrid  : me,
                parent   : me,  // Contained widgets need to know their parents
                maxWidth : me.maxWidth || undefined,
                minWidth : me.minWidth || undefined
            };

        // If we have been configured with sizing, construct the Bar in sync.
        if (flex) {
            config.flex = flex;
        }
        else if (width) {
            config.width = width;
        }

        return config;
    }

    changeHeader(header) {
        return new this.headerClass(ObjectHelper.assign({
            id : this.id + '-header'
        }, this.barConfig, header));
    }

    changeFooter(footer) {
        return new this.footerClass(ObjectHelper.assign({
            id : this.id + '-footer'
        }, this.barConfig, footer));
    }

    //endregion

    //region Splitters

    /**
     * Toggle (add/remove) class for splitters
     * @param {String} cls class name
     * @param {Boolean} [add] actions. Set to `true` to add class, `false` to remove
     * @private
     */
    toggleSplitterCls(cls, add = true) {
        const
            me        = this,
            splitters = [me.splitterElement, me.headerSplitter, me.footerSplitter, me.scrollerSplitter];
        splitters.forEach(el => el?.classList[add ? 'add' : 'remove'](cls));
    }

    //endregion

    //region Template

    changeElement(element, was) {
        const { region } = this;

        return super.changeElement({
            'aria-label' : region,
            className    : {
                'b-grid-subgrid'             : 1,
                [`b-grid-subgrid-${region}`] : region,
                'b-grid-subgrid-collapsed'   : this.collapsed
            },
            dataset : {
                region
            }
        }, was);
    }

    get rowElementConfig() {
        const { grid } = this;

        return {
            role      : 'row',
            className : grid.rowCls,
            children  : this.columns.visibleColumns.map((column, columnIndex) => ({
                role            : 'gridcell',
                'aria-colindex' : columnIndex + 1,
                tabIndex        : grid.cellTabIndex,
                className       : 'b-grid-cell',
                dataset         : {
                    column   : column.field || '',
                    columnId : column.id
                }
            }))
        };
    }

    // Added to DOM in Grid `get bodyConfig`
    changeVirtualScrollerElement() {
        const references = DomHelper.createElement({
            role      : 'presentation',
            reference : 'virtualScrollerElement',
            className : 'b-virtual-scroller',
            tabIndex  : -1,
            dataset   : {
                region : this.region
            },
            children : [
                {
                    reference : 'virtualScrollerWidth',
                    className : 'b-virtual-width'
                }
            ]
        });

        this.virtualScrollerWidth = references.virtualScrollerWidth;

        return references.virtualScrollerElement;
    }

    changeSplitterElement() {
        const references = DomHelper.createElement({
            reference : 'splitterElement',
            className : {
                'b-grid-splitter'           : 1,
                'b-grid-splitter-collapsed' : this.collapsed,
                'b-hide-display'            : 1 // GridSubGrids determines visibility
            },
            dataset : {
                region : this.region
            },
            children : [
                BrowserHelper.isTouchDevice ? { className : 'b-splitter-touch-area' } : null,
                {
                    className : 'b-grid-splitter-inner b-grid-splitter-main',
                    children  : [
                        {
                            className : 'b-grid-splitter-buttons',
                            reference : 'splitterButtons',
                            children  : [
                                {
                                    className : 'b-grid-splitter-button-collapse',
                                    children  : [
                                        BrowserHelper.isTouchDevice ? { className : 'b-splitter-button-touch-area' } : null,
                                        {
                                            tag       : 'svg',
                                            ns        : 'http://www.w3.org/2000/svg',
                                            version   : '1.1',
                                            className : 'b-grid-splitter-button-icon b-gridregion-collapse-arrow',
                                            viewBox   : '0 0 256 512',
                                            children  : [
                                                {
                                                    tag : 'path',
                                                    d   : 'M192 448c-8.188 0-16.38-3.125-22.62-9.375l-160-160c-12.5-1' +
                                                        '2.5-12.5-32.75 0-45.25l160-160c12.5-12.5 32.75-12.5 45.25 0s' +
                                                        '12.5 32.75 0 45.25L77.25 256l137.4 137.4c12.5 12.5 12.5 32.7' +
                                                        '5 0 45.25C208.4 444.9 200.2 448 192 448z'
                                                }
                                            ]
                                        }
                                    ]
                                },
                                {
                                    className : 'b-grid-splitter-button-expand',
                                    children  : [
                                        BrowserHelper.isTouchDevice ? { className : 'b-splitter-button-touch-area' } : null,
                                        {
                                            tag       : 'svg',
                                            ns        : 'http://www.w3.org/2000/svg',
                                            version   : '1.1',
                                            className : 'b-grid-splitter-button-icon b-gridregion-expand-arrow',
                                            viewBox   : '0 0 256 512',
                                            children  : [
                                                {
                                                    tag : 'path',
                                                    d   : 'M64 448c-8.188 0-16.38-3.125-22.62-9.375c-12.5-12.5-12.5-3' +
                                                        '2.75 0-45.25L178.8 256L41.38 118.6c-12.5-12.5-12.5-32.75 0-4' +
                                                        '5.25s32.75-12.5 45.25 0l160 160c12.5 12.5 12.5 32.75 0 45.25' +
                                                        'l-160 160C80.38 444.9 72.19 448 64 448z'
                                                }
                                            ]
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        this.splitterButtons = references.splitterButtons;

        return references.splitterElement;
    }

    get splitterConfig() {
        return {
            className : this.splitterElement.className.trim(),
            children  : [
                BrowserHelper.isTouchDevice ? { className : 'b-splitter-touch-area' } : null,
                {
                    className : 'b-grid-splitter-inner'
                }
            ],
            dataset : {
                region : this.region
            }
        };
    }

    changeHeaderSplitter() {
        return DomHelper.createElement(this.splitterConfig);
    }

    changeScrollerSplitter() {
        return DomHelper.createElement(this.splitterConfig);
    }

    changeFooterSplitter() {
        return DomHelper.createElement(this.splitterConfig);
    }

    hideSplitter() {
        const me = this;
        me.splitterElement.classList.add('b-hide-display');
        me.headerSplitter.classList.add('b-hide-display');
        me.scrollerSplitter.classList.add('b-hide-display');
        me.footerSplitter.classList.add('b-hide-display');
        me.$showingSplitter = false;
    }

    showSplitter() {
        const me = this;
        me.splitterElement.classList.remove('b-hide-display');
        me.headerSplitter.classList.remove('b-hide-display');
        me.scrollerSplitter.classList.remove('b-hide-display');
        me.footerSplitter.classList.remove('b-hide-display');
        me.$showingSplitter = true;
    }

    //endregion

    //region Render

    render(...args) {
        const me = this;

        super.render(...args);

        // Unit tests create naked SubGrids so we have to do this.
        if (me.grid) {
            me.updateHasFlex();

            me.element.parentNode.insertBefore(me.splitterElement, me.element.nextElementSibling);

            EventHelper.on({
                element   : me.grid.element,
                delegate  : `.b-grid-splitter[data-region=${me.region}]`,
                mouseover : 'onSplitterMouseOver',
                mouseout  : 'onSplitterMouseOut',
                thisObj   : me
            });

            me._collapsed && me.collapse();
        }
    }

    refreshHeader() {
        this.header.refreshContent();
    }

    refreshFooter() {
        this.footer?.refreshContent();
    }

    // Override to iterate header and footer.
    eachWidget(fn, deep = true) {
        const
            me      = this,
            widgets = [me.header, me.footer];

        for (let i = 0; i < widgets.length; i++) {
            const widget = widgets[i];

            if (fn(widget) === false) {
                return;
            }

            if (deep && widget.eachWidget) {
                widget.eachWidget(fn, deep);
            }
        }
    }

    //endregion

    //region Size & resize

    /**
     * Sets cell widths. Cannot be done in template because of CSP
     * @private
     */
    fixCellWidths(rowElement) {
        const { visibleColumns } = this.columns;

        // fix cell widths, no longer allowed in template because of CSP
        let cell = rowElement.firstElementChild,
            i    = 0;

        while (cell) {
            const
                column      = visibleColumns[i],
                { element } = column;

            if (column.minWidth) {
                cell.style.minWidth = DomHelper.setLength(column.minWidth);
            }
            if (column.maxWidth) {
                cell.style.maxWidth = DomHelper.setLength(column.maxWidth);
            }

            // either flex or width, flex has precedence
            if (column.flex) {
                // Nested flex - we have to match the column's header width because it's flexing
                // a different available space - the space in its owning column header.
                if (column.childLevel && element) {
                    cell.style.flex = `0 0 ${element.getBoundingClientRect().width}px`;
                    cell.style.width = '';
                }
                else {
                    cell.style.flex = column.flex;
                    cell.style.width = '';
                }
            }
            else if (column.width) {
                // https://app.assembla.com/spaces/bryntum/tickets/8041
                // Although header and footer elements must be sized using flex-basis to avoid the busting out problem,
                // grid cells MUST be sized using width since rows are absolutely positioned and will not cause the
                // busting out problem, and rows will not stretch to shrinkwrap the cells unless they are widthed with
                // width.
                cell.style.width = DomHelper.setLength(column.width);
            }
            else {
                cell.style.flex = cell.style.width = cell.style.minWidth = '';
            }

            cell = cell.nextElementSibling;
            i++;
        }
    }

    get totalFixedWidth() {
        return this.columns.totalFixedWidth;
    }

    /**
     * Sets header width and scroller width (if needed, depending on if using flex). Might also change the subgrids
     * width, if it uses a width calculated from its columns.
     * @private
     */
    fixWidths() {
        const
            me = this,
            {
                element,
                header,
                footer
            }  = me;

        if (!me.collapsed) {
            if (me.flex) {
                header.flex = me.flex;
                if (footer) {
                    footer.flex = me.flex;
                }
                element.style.flex = me.flex;
            }
            else {
                // If width is calculated and no column is using flex, check if total width is less than width. If so,
                // recalculate width and bail out of further processing (since setting width will trigger again)
                if (
                    me.hasCalculatedWidth &&
                    !me.columns.some(col => !col.hidden && col.flex) &&
                    me.totalFixedWidth !== me.width
                ) {
                    me.width = me.totalFixedWidth;
                    // Setting width above clears the hasCalculatedWidth flag, but we want to keep it set to react
                    // correctly next time
                    me.hasCalculatedWidth = true;
                    return;
                }

                let totalWidth = me.width;

                if (!totalWidth) {
                    totalWidth = 0;

                    // summarize column widths, needed as container width when not using flex widths.
                    for (const col of me.columns) {
                        if (!col.flex && !col.hidden) totalWidth += col.width;
                    }
                }

                // rows are absolutely positioned, meaning that their width won't affect container width
                // hence we must set it, if not using flex
                element.style.width = `${totalWidth}px`;

                header.width = totalWidth;
                if (footer) {
                    footer.width = totalWidth;
                }
            }

            me.syncScrollingPartners(false);
        }
    }

    // Safari does not shrink cells the same way as chrome & ff does without having a width set on the row
    fixRowWidthsInSafariEdge() {
        if (BrowserHelper.isSafari) {
            const
                me                 = this,
                { region, header } = me,
                minWidth           = header.calculateMinWidthForSafari();

            // fix row widths for safari, it does not size flex cells correctly at small widths otherwise.
            // there should be a css solution, but I have failed to find it
            me.rowManager.forEach(row => {
                // This function runs on resize and rendering a SubGrid triggers a resize. When adding a new SubGrid
                // on the fly elements wont exists for it yet, so ignore...
                const element = row.getElement(region);
                // it is worth noting that setting a width does not prevent the row from growing beyond that with
                // when making view wider, it is used in flex calculation more like a min-width
                if (element) {
                    element.style.width = `${minWidth}px`;
                }
            });

            header.headersElement.style.width = `${minWidth}px`;
        }
    }

    /**
     * Get/set SubGrid width, which also sets header and footer width (if available).
     * @property {Number}
     */
    set width(width) {
        const me = this;

        // Width explicitly set, remember that
        me.hasCalculatedWidth = false;

        super.width = width;

        me.header.width = width;
        me.footer.width = width;

        // When we're live, we can't wait until the  throttled resize occurs - it looks bad.
        if (me.isPainted) {
            me.onElementResize();
        }
    }

    get width() {
        return super.width;
    }

    /**
     * Get/set SubGrid flex, which also sets header and footer flex (if available).
     * @property {Number|String}
     */
    set flex(flex) {
        const me = this;

        // Width explicitly set, remember that
        me.hasCalculatedWidth = false;

        me.header.flex = flex;
        me.footer.flex = flex;

        super.flex = flex;

        // When we're live, we can't wait until the  throttled resize occurs - it looks bad.
        if (me.isPainted) {
            me.onElementResize();
        }
    }

    get flex() {
        return super.flex;
    }

    /**
     * Called when grid changes size. SubGrid determines if it has changed size and triggers scroll (for virtual
     * rendering in cells to work when resizing etc.)
     * @private
     */
    onInternalResize(element, newWidth, newHeight, oldWidth, oldHeight) {
        const
            me       = this,
            { grid } = me;

        // Widget caches dimensions
        super.onInternalResize(element, newWidth, newHeight, oldWidth, oldHeight);

        // Unit tests create naked SubGrids so we have to do this.
        if (grid?.isPainted) {
            me.syncSplitterButtonPosition();

            if (newWidth !== oldWidth) {
                // trigger scroll, in case anything is done on scroll it needs to be done now also
                grid.trigger('horizontalScroll', {
                    grid,
                    subGrid    : me,
                    scrollLeft : me.scrollable.element.scrollLeft,
                    scrollX    : me.scrollable.x
                });

                // Update virtual scrollers, if they are ready
                me.fakeScroller && me.refreshFakeScroll();

                // Columns which are flexed, but as part of a grouped column cannot just have their flex
                // value reflected in the flex value of its cells. They are flexing a different available space.
                // These have to be set to the exact width and kept synced.
                grid.syncFlexedSubCols();

                me.fixRowWidthsInSafariEdge();
            }

            me.trigger('afterInternalResize', me);
        }
    }

    /**
     * Keeps the parallel splitters in the header, footer and fake scroller synced in terms
     * of being collapsed or not.
     * @private
     */
    syncParallelSplitters(collapsed) {
        const
            me       = this,
            { grid } = me;

        if (me.splitterElement && me.$showingSplitter) {
            me.toggleSplitterCls('b-grid-splitter-collapsed', collapsed);
        }
        else {
            // If we're the last, we don't own a splitter, we use the previous region's splitter
            const prevGrid = grid.getSubGrid(grid.getPreviousRegion(me.region));

            // If there's a splitter before us, sync it with our state.
            if (prevGrid && prevGrid.splitterElement) {
                prevGrid.syncParallelSplitters(collapsed);
            }
        }
    }

    onSplitterMouseOver() {
        const
            me              = this,
            { nextSibling } = me;

        // No hover effect when collapsed
        if (!me.collapsed && (!nextSibling || !nextSibling.collapsed)) {
            me.toggleSplitterCls('b-hover');
        }

        me.startSplitterButtonSyncing();
    }

    onSplitterMouseOut() {
        const
            me              = this,
            { nextSibling } = me;

        me.toggleSplitterCls('b-hover', false);
        if (!me.collapsed && (!nextSibling || !nextSibling.collapsed)) {
            me.stopSplitterButtonSyncing();
        }
    }

    startSplitterButtonSyncing() {
        const me = this;

        if (me.splitterElement) {
            me.syncSplitterButtonPosition();
            if (!me.splitterSyncScrollListener) {
                me.splitterSyncScrollListener = me.grid.scrollable.on({
                    scroll  : 'syncSplitterButtonPosition',
                    thisObj : me
                });
            }
        }
    }

    stopSplitterButtonSyncing() {
        if (this.splitterSyncScrollListener) {
            this.splitterSyncScrollListener();
            this.splitterSyncScrollListener = null;
        }
    }

    syncSplitterButtonPosition() {
        const me = this;
        me.splitterButtons.style.top = `${me.grid.scrollable.y + ((me.grid.bodyHeight - (me.headerSplitter ? me.grid.headerHeight : 0)) / 2)}px`;
    }

    /**
     * Get the "viewport" for the SubGrid as a Rectangle
     * @property {Core.helper.util.Rectangle}
     * @readonly
     */
    get viewRectangle() {
        const { scrollable } = this;

        return new Rectangle(scrollable.x, scrollable.y, this.width || 0, this.rowManager.viewHeight);
    }

    /**
     * Called when updating column widths to apply 'b-has-flex' which is used when fillLastColumn is configured.
     * @internal
     */
    updateHasFlex() {
        this.scrollable.element.classList.toggle('b-has-flex', this.columns.hasFlex);
    }

    updateResizable(resizable) {
        const me = this;

        [me.splitterElement, me.headerSplitter, me.scrollerSplitter, me.footerSplitter].forEach(splitter => DomHelper.toggleClasses(splitter, ['b-disabled'], !resizable));
    }

    /**
     * Resize all columns in the SubGrid to fit their width, according to their configured
     * {@link Grid.column.Column#config-fitMode}
     */
    resizeColumnsToFitContent() {
        this.grid.beginGridMeasuring();

        this.columns.visibleColumns.forEach(column => {
            column.resizeToFitContent(null, null, true);
        });

        this.grid.endGridMeasuring();
    }

    //endregion

    //region Scroll

    get overflowingHorizontally() {
        // We are not overflowing if collapsed
        return !this.collapsed && this.scrollable.hasOverflow('x');
    }

    get overflowingVertically() {
        // SubGrids never overflow vertically. They are full calculated content height.
        // The owning Grid scrolls all SubGrids vertically in its own overflowElement.
        return false;
    }

    /**
     * Fixes widths of fake scrollers
     * @private
     */
    refreshFakeScroll() {
        const
            me = this,
            {
                element,
                virtualScrollerElement,
                virtualScrollerWidth,
                header,
                footer,
                scrollable
            }  = me,
            // Cannot use scrollWidth because its an integer and we need exact content size
            totalFixedWidth = [...header.contentElement.children].reduce(sumWidths, 0);

        // Use a fixed scroll width so that when grid is empty (e.g after filtering with no matches),
        // it is able to it maintain its scroll-x position and magic mouse swiping
        // in the grid area will produce horizontal scrolling.
        // https://github.com/bryntum/support/issues/3247
        scrollable.scrollWidth = totalFixedWidth;

        // Scroller lays out in the same way as subgrid.
        // If we are flexed, the scroller is flexed etc.
        virtualScrollerElement.style.width = element.style.width;
        virtualScrollerElement.style.flex = element.style.flex;
        header.scrollable.syncOverflowState();
        footer.scrollable.syncOverflowState();

        if (!me.collapsed) {
            if (me.overflowingHorizontally) {
                virtualScrollerWidth.style.width = `${scrollable.scrollWidth || 0}px`;
                // If *any* SubGrids have horizontal overflow, the main grid
                // has to show its virtual horizontal scrollbar.
                me.grid.virtualScrollers.classList.remove('b-hide-display');
            }
            else {
                virtualScrollerWidth.style.width = 0;
            }
        }
    }

    /**
     * Init scroll syncing for header and footer (if available).
     * @private
     */
    initScroll() {
        const
            me = this,
            {
                scrollable,
                virtualScrollerElement
            }  = me;

        me.syncPartnersOnFrame = me.createOnFrame(me.syncScrollingPartners);

        if (BrowserHelper.isFirefox) {
            scrollable.element.addEventListener('wheel', event => {
                if (event.deltaX) {
                    scrollable.x += event.deltaX;
                    event.preventDefault();
                }
            });
        }

        scrollable.yScroller = me.grid.scrollable;

        // Add our Scroller to the controlling GridScroller
        scrollable.yScroller.addScroller(scrollable);

        // Create a Scroller for the fake horizontal scrollbar so that it can partner
        me.fakeScroller = new Scroller({
            element   : virtualScrollerElement,
            overflowX : true
        });

        // Sync scrolling partners (header, footer) when our xScroller reports a scroll.
        // Also fires horizontalscroll
        scrollable.on({
            scroll    : 'onSubGridScroll',
            scrollend : 'onSubGridScrollEnd',
            thisObj   : me
        });

        scrollable.addPartner(me.fakeScroller, 'x');
        scrollable.addPartner(me.header.scrollable, 'x');
        scrollable.addPartner(me.footer.scrollable, 'x');

        // Update virtual scrollers (previously updated too early from onInternalResize)
        me.refreshFakeScroll();
    }

    onSubGridScrollEnd() {
        const me = this;

        // If we do not have the direct update flag set which would ensure a sync in each scroll event
        // then ensure syncing happens on scroll end. This is for animated scrolls where the scroll
        // impulses come through animation frames.
        if (!me.forceScrollUpdate) {
            me.syncScrollingPartners();
        }
        me.scrolling = false;

        if (!DomHelper.scrollBarWidth) {
            me.grid.virtualScrollers.classList.remove('b-scrolling');
            // Remove interactivity a while after scrolling ended
            me.hideOverlayScroller();
        }
    }

    onSubGridScroll() {
        // Force direct update, without waiting for next animation frame
        // TODO: Only used in Scheduler, could perhaps live in Scheduler specific SubGrid in the future
        if (this.forceScrollUpdate) {
            this.syncScrollingPartners();
            this.forceScrollUpdate = false;
        }
        else {
            this.syncPartnersOnFrame();
        }
    }

    showOverlayScroller() {
        this.hideOverlayScroller.cancel();

        this.virtualScrollerElement.classList.add('b-show-virtual-scroller');
    }

    // Buffered 1500ms, hides virtual scrollers after scrolling has ended
    hideOverlayScroller() {
        this.virtualScrollerElement.classList.remove('b-show-virtual-scroller');
    }

    set scrolling(scrolling) {
        this._scrolling = scrolling;
    }

    get scrolling() {
        return this._scrolling;
    }

    /**
     * This syncs the horizontal scroll position of the header and the footer with
     * the horizontal scroll position of the grid. Usually, this will be called automatically
     * when the grid scrolls. In some cases, such as a refresh caused by column changes
     * it will need to be called from elsewhere.
     * @internal
     */
    syncScrollingPartners(addCls = true) {
        const
            subGrid  = this,
            { grid } = subGrid;

        if (!subGrid.scrolling && addCls) {
            subGrid.scrolling = true;
            // Allow interacting with overlaid scrollbar after scrolling starts
            if (!DomHelper.scrollBarWidth) {
                // Cls indicating that we are actively scrolling
                grid.virtualScrollers.classList.add('b-scrolling');
                // Cls sticking around longer to keep overlay scrollbar visible longer, allowing users to more easily
                // grab it to drag more
                subGrid.showOverlayScroller();
            }
        }

        grid.trigger('horizontalScroll', {
            subGrid,
            grid,
            scrollLeft : subGrid.scrollable.element.scrollLeft,
            scrollX    : subGrid.scrollable.x
        });
    }

    /**
     * Scrolls a column into view (if it is not already). Called by Grid#scrollColumnIntoView, use it instead to not
     * have to care about which SubGrid contains a column.
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
     */
    scrollColumnIntoView(column, options) {
        const
            { columns, header } = this,
            scroller            = header.scrollable;

        // Allow column,column id,or column index to be passed
        column = (column instanceof Column) ? column : columns.get(column) || columns.getById(column) || columns.getAt(column);

        if (column) {
            // Get the current column header element.
            const columnHeaderElement = header.getHeader(column.id);

            if (columnHeaderElement) {
                return scroller.scrollIntoView(Rectangle.from(columnHeaderElement, null, true), options);
            }
        }
    }

    //endregion

    //region Rows

    /**
     * Creates elements for the new rows when RowManager has determined that more rows are needed
     * @private
     */
    onAddRow({ rows }) {
        const
            me             = this,
            config         = me.rowElementConfig,
            frag           = document.createDocumentFragment();

        rows.forEach(row => {
            const rowElement = DomHelper.createElement(config);

            frag.appendChild(rowElement);
            row.addElement(me.region, rowElement);

            // TODO: Stamp the correct width into the cells on creation
            me.fixCellWidths(rowElement);
        });

        me.fixRowWidthsInSafariEdge();

        // Put the row elements into the SubGrid en masse.
        // If 2nd param is null, insertBefore appends.
        me.element.insertBefore(frag, me.insertRowsBefore);
    }

    /**
     * Get all row elements for this SubGrid.
     * @property {HTMLElement[]}
     * @readonly
     */
    get rowElements() {
        return this.fromCache('.b-grid-row', true);
    }

    /**
     * Removes all row elements from the subgrids body and empties cache
     * @private
     */
    clearRows() {
        this.emptyCache();

        const
            all   = this.element.querySelectorAll('.b-grid-row'),
            range = document.createRange();

        if (all.length) {
            range.setStartBefore(all[0]);
            range.setEndAfter(all[all.length - 1]);
            range.deleteContents();
        }
    }

    // only called when RowManager.rowScrollMode = 'dom', which is not intended to be used
    addNewRowElement() {
        const rowElement = DomHelper.append(this.element, this.rowElementConfig);

        this.fixCellWidths(rowElement);

        return rowElement;
    }

    get emptyText() {
        return this._emptyText;
    }

    set emptyText(text) {
        this._emptyText = text;

        this.element.dataset.emptyText = text;
    }

    get store() {
        return this.grid.store;
    }

    get rowManager() {
        return this.grid?.rowManager;
    }

    //endregion

    // region Expand/collapse

    // All usages are commented, uncomment when this is resolved: https://app.assembla.com/spaces/bryntum/tickets/5472
    toggleTransitionClasses(doRemove = false) {
        const
            me         = this,
            grid       = me.grid,
            nextRegion = grid.getSubGrid(grid.getNextRegion(me.region)),
            splitter   = grid.resolveSplitter(nextRegion);

        nextRegion.element.classList[doRemove ? 'remove' : 'add']('b-grid-subgrid-animate-collapse');
        nextRegion.header.element.classList[doRemove ? 'remove' : 'add']('b-grid-subgrid-animate-collapse');

        me.element.classList[doRemove ? 'remove' : 'add']('b-grid-subgrid-animate-collapse');
        me.header.element.classList[doRemove ? 'remove' : 'add']('b-grid-subgrid-animate-collapse');

        splitter.classList[doRemove ? 'remove' : 'add']('b-grid-splitter-animate');
    }

    /**
     * Get/set collapsed state
     * @property {Boolean}
     */
    get collapsed() {
        return this._collapsed;
    }

    set collapsed(collapsed) {
        if (this.isConfiguring) {
            this._collapsed = collapsed;
        }
        else {
            if (collapsed) {
                this.collapse();
            }
            else {
                this.expand();
            }
        }
    }

    /**
     * Collapses subgrid. If collapsing subgrid is the only one expanded, next subgrid to the right (or previous) will
     * be expanded.
     *
     * @example
     * let locked = grid.getSubGrid('locked');
     * locked.collapse().then(() => {
     *     console.log(locked.collapsed); // Logs 'True'
     * });
     *
     * let normal = grid.getSubGrid('normal');
     * normal.collapse().then(() => {
     *     console.log(locked.collapsed); // Logs 'False'
     *     console.log(normal.collapsed); // Logs 'True'
     * });
     *
     * @returns {Promise} A Promise which resolves when this SubGrid is fully collapsed.
     */
    async collapse() {
        const
            me                       = this,
            { grid, element }        = me,
            nextRegion               = grid.getSubGrid(grid.getNextRegion(me.region)),
            splitterOwner            = me.splitterElement ? me : me.previousSibling;
        let { _beforeCollapseState } = me,
            // Count all expanded regions. Grid must have always have at least one expanded
            expandedRegions          = 0;

        grid.eachSubGrid(subGrid => {
            subGrid !== me && !subGrid._collapsed && ++expandedRegions;
        });

        // Current region is the only one expanded, expand next region
        if (expandedRegions === 0) {
            // expandPromise = nextRegion.expand();
            await nextRegion.expand();
        }

        return new Promise((resolve) => {
            if (!_beforeCollapseState) {
                _beforeCollapseState = me._beforeCollapseState = {};

                let widthChanged = false;

                // If current width is zero, the resize event will not be fired. In such case we want to trigger callback immediately
                if (me.width) {
                    widthChanged = true;

                    // Toggle transition classes here, we will actually change width below
                    // me.toggleTransitionClasses();

                    // afterinternalresize event is buffered, it will be fired only once after animation is finished
                    // and element size is final
                    me.on({
                        afterinternalresize : () => {
                            // me.toggleTransitionClasses(true);
                            resolve(me);
                        },
                        thisObj : me,
                        once    : true
                    });
                }

                // When trying to collapse region we need its partner to occupy free space. Considering multiple
                // regions, several cases are possible:
                // 1) Both left and right regions have fixed width
                // 2) Left region has fixed width, right region is flexed
                // 3) Left region is flexed, right region has fixed width
                // 4) Both regions are flexed
                //
                // To collapse flexed region we need to remove flex style, remember it somehow and set fixed width.
                // If another region is flexed, it will fill the space. If it has fixed width, we need to increase
                // its width by collapsing region width. Same logic should be applied to headers.
                //
                // Save region width first
                _beforeCollapseState.width = me.width;
                _beforeCollapseState.elementWidth = element.style.width;

                // Next region is not flexed, need to make it fill the space
                if (nextRegion.element.style.flex === '') {
                    _beforeCollapseState.nextRegionWidth = nextRegion.width;
                    nextRegion.width = '';
                    nextRegion.flex = '1';
                }

                // Current region is flexed, store style to restore on expand
                if (element.style.flex !== '') {
                    _beforeCollapseState.flex = element.style.flex;
                    // remove flex state to reduce width later
                    me.header.element.style.flex = element.style.flex = '';
                }

                // Sets the grid to its collapsed width as defined in SASS: zero
                element.classList.add('b-grid-subgrid-collapsed');

                // The parallel elements which must be in sync width-wise must know about collapsing
                me.virtualScrollerElement.classList.add('b-collapsed');
                me.header.element.classList.add('b-collapsed');
                me.footer.element.classList.add('b-collapsed');

                me._collapsed = true;
                me.width = '';

                if (!widthChanged) {
                    // sync splitters in case subGrid was collapsed by state (https://github.com/bryntum/support/issues/1857)
                    me.syncParallelSplitters(true);

                    resolve(false);
                }
            }
        }).then((value) => {
            if (!me.isDestroyed) {
                if (value !== false) {
                    me.syncParallelSplitters(true);

                    // Our splitter is permanently visible when collapsed, so keep splitter button set
                    // synced in the vertical centre of the view just in time for paint.
                    // Uses translateY so will not cause a further layout.
                    splitterOwner.startSplitterButtonSyncing?.();
                }

                grid.trigger('subGridCollapse', { subGrid : me });
                grid.afterToggleSubGrid({ subGrid : me, collapsed : true });
            }
        });
    }

    /**
     * Expands subgrid.
     *
     * @example
     * grid.getSubGrid('locked').expand().then(() => console.log('locked grid expanded'));
     *
     * @returns {Promise} A Promise which resolves when this SubGrid is fully expanded.
     */
    async expand() {
        const
            me            = this,
            {
                grid,
                _beforeCollapseState
            }             = me,
            nextRegion    = grid.getSubGrid(grid.getNextRegion(me.region)),
            splitterOwner = me.splitterElement ? me : me.previousSibling;

        return new Promise((resolve) => {
            if (_beforeCollapseState != null) {
                // If current width matches width expected after expand resize event will not be fired. In such case
                // we want to trigger callback immediately
                let widthChanged = false;

                // See similar clause in collapse method above
                if (me.width !== _beforeCollapseState.elementWidth) {
                    widthChanged = true;

                    // Toggle transition classes here, we will actually change width below
                    // me.toggleTransitionClasses();

                    me.on({
                        afterinternalresize() {
                            // me.toggleTransitionClasses(true);

                            // Delay the resolve to avoid "ResizeObserver loop limit exceeded" errors
                            // collapsing the only expanded region and it has to expand its nextRegion
                            // before it can collapse.
                            me.setTimeout(() => resolve(me), 10);
                        },
                        thisObj : me,
                        once    : true
                    });
                }

                // previous region is not flexed, reduce its width as it was increased in collapse
                if (_beforeCollapseState.nextRegionWidth) {
                    nextRegion.width = _beforeCollapseState.nextRegionWidth;
                    nextRegion.flex = null;
                }

                me.element.classList.remove('b-grid-subgrid-collapsed');
                me._collapsed = false;

                // The parallel elements which must be in sync width-wise must know about collapsing
                me.virtualScrollerElement.classList.remove('b-collapsed');
                me.header.element.classList.remove('b-collapsed');
                me.footer.element.classList.remove('b-collapsed');

                // This region used to be flex, let's restore it
                if (_beforeCollapseState.flex) {
                    // Always restore width, restoring flex wont trigger resize otherwise
                    me.width = _beforeCollapseState.width;

                    // Widget flex setting clears style width
                    me.header.flex = me.flex = _beforeCollapseState.flex;
                    me.footer.flex = _beforeCollapseState.flex;
                    me._width = null;
                }
                else {
                    me.width = _beforeCollapseState.elementWidth;
                }

                me.element.classList.remove('b-grid-subgrid-collapsed');
                me._collapsed = false;

                if (!widthChanged) {
                    resolve(false);
                }
                else {
                    // Our splitter buttons are hidden when expanded, so we no longer need to keep splitter button set
                    // synced in the vertical centre of the view.
                    splitterOwner.stopSplitterButtonSyncing();

                    me.syncParallelSplitters(false);
                }

                delete me._beforeCollapseState;
            }
        }).then((value) => {
            if (value !== false) {
                grid.trigger('subGridExpand', { subGrid : me });
                grid.afterToggleSubGrid({ subGrid : me, collapsed : false });
            }
        });
    }

    //endregion
}

// Register this widget type with its Factory
SubGrid.initClass();
