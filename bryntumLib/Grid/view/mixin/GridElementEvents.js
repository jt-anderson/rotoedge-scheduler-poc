// We declare consts inside case blocks in this file.
/* eslint-disable no-case-declarations */

//TODO: Should it fire more own events instead and rely less on function chaining?

import Base from '../../../Core/Base.js';
import DomDataStore from '../../../Core/data/DomDataStore.js';
import DomHelper from '../../../Core/helper/DomHelper.js';
import Rectangle from '../../../Core/helper/util/Rectangle.js';
import EventHelper from '../../../Core/helper/EventHelper.js';
import StringHelper from '../../../Core/helper/StringHelper.js';
import ObjectHelper from '../../../Core/helper/ObjectHelper.js';
import BrowserHelper from '../../../Core/helper/BrowserHelper.js';
import Location from '../../util/Location.js';

const gridBodyElementEventHandlers = {
    touchstart  : 'onElementTouchStart',
    touchmove   : 'onElementTouchMove',
    touchend    : 'onElementTouchEnd',
    mouseover   : 'onElementMouseOver',
    mouseout    : 'onElementMouseOut',
    mousedown   : 'onElementMouseDown',
    mousemove   : 'onElementMouseMove',
    mouseup     : 'onElementMouseUp',
    click       : 'onHandleElementClick',
    dblclick    : 'onElementDblClick',
    keyup       : 'onElementKeyUp',
    keypress    : 'onElementKeyPress',
    contextmenu : 'onElementContextMenu',
    pointerup   : 'onElementPointerUp'
};

/**
 * @module Grid/view/mixin/GridElementEvents
 */

/**
 * Mixin for Grid that handles dom events. Some listeners fire own events but all can be chained by features. None of
 * the functions in this class are indented to be called directly.
 *
 * See {@link Grid.view.Grid} for more information on grid keyboard interaction.
 *
 * @mixin
 */
export default Target => class GridElementEvents extends (Target || Base) {
    static get $name() {
        return 'GridElementEvents';
    }

    //region Config

    static get configurable() {
        return {
            /**
             * Time in ms until a longpress is triggered
             * @prp {Number}
             * @default
             * @category Events
             */
            longPressTime : 400,

            /**
             * Set to true to listen for CTRL-Z (CMD-Z on Mac OS) keyboard event and trigger undo (redo when SHIFT is
             * pressed). Only applicable when using a {@link Core.data.stm.StateTrackingManager}.
             * @prp {Boolean}
             * @default
             * @category Events
             */
            enableUndoRedoKeys : true,

            keyMap : {
                'Ctrl+z'       : 'undoRedoKeyPress',
                'Ctrl+Shift+z' : 'undoRedoKeyPress',
                ' '            : { handler : 'clickCellByKey', weight : 1000 }
            }
        };
    }

    //endregion

    //region Events

    /**
     * Fired when user clicks in a grid cell
     * @event cellClick
     * @param {Grid.view.Grid} grid The grid instance
     * @param {Core.data.Model} record The record representing the row
     * @param {Grid.column.Column} column The column to which the cell belongs
     * @param {HTMLElement} cellElement The cell HTML element
     * @param {HTMLElement} target The target element
     * @param {MouseEvent} event The native DOM event
     */

    /**
     * Fired when user double clicks a grid cell
     * @event cellDblClick
     * @param {Grid.view.Grid} grid The grid instance
     * @param {Core.data.Model} record The record representing the row
     * @param {Grid.column.Column} column The column to which the cell belongs
     * @param {HTMLElement} cellElement The cell HTML element
     * @param {HTMLElement} target The target element
     * @param {MouseEvent} event The native DOM event
     */

    /**
     * Fired when user activates contextmenu in a grid cell
     * @event cellContextMenu
     * @param {Grid.view.Grid} grid The grid instance
     * @param {Core.data.Model} record The record representing the row
     * @param {Grid.column.Column} column The column to which the cell belongs
     * @param {HTMLElement} cellElement The cell HTML element
     * @param {HTMLElement} target The target element
     * @param {MouseEvent} event The native DOM event
     */

    /**
     * Fired when user moves the mouse over a grid cell
     * @event cellMouseOver
     * @param {Grid.view.Grid} grid The grid instance
     * @param {Core.data.Model} record The record representing the row
     * @param {Grid.column.Column} column The column to which the cell belongs
     * @param {HTMLElement} cellElement The cell HTML element
     * @param {HTMLElement} target The target element
     * @param {MouseEvent} event The native DOM event
     */

    /**
     * Fired when a user moves the mouse out of a grid cell
     * @event cellMouseOut
     * @param {Grid.view.Grid} grid The grid instance
     * @param {Core.data.Model} record The record representing the row
     * @param {Grid.column.Column} column The column to which the cell belongs
     * @param {HTMLElement} cellElement The cell HTML element
     * @param {HTMLElement} target The target element
     * @param {MouseEvent} event The native DOM event
     */

    //endregion

    //region Event handling

    /**
     * Init listeners for a bunch of dom events. All events are handled by handleEvent().
     * @private
     * @category Events
     */
    initInternalEvents() {
        const
            handledEvents = Object.keys(gridBodyElementEventHandlers),
            len           = handledEvents.length,
            listeners     = {
                element : this.bodyElement,
                thisObj : this
            };

        // Route all events through handleEvent, so that we can capture this.event
        // before we route to the handlers
        for (let i = 0; i < len; i++) {
            listeners[handledEvents[i]] = 'handleEvent';
        }

        EventHelper.on(listeners);

        EventHelper.on({
            focusin : 'onGridBodyFocusIn',
            element : this.bodyElement,
            thisObj : this,
            capture : true
        });
    }

    /**
     * This method finds the cell location of the passed event. It returns an object describing the cell.
     * @param {Event} event A Mouse, Pointer or Touch event targeted at part of the grid.
     * @returns {Object} An object containing the following properties:
     * - `cellElement` - The cell element clicked on.
     * - `column` - The {@link Grid.column.Column column} clicked under.
     * - `columnId` - The `id` of the {@link Grid.column.Column column} clicked under.
     * - `record` - The {@link Core.data.Model record} clicked on.
     * - `id` - The `id` of the {@link Core.data.Model record} clicked on.
     * @internal
     * @category Events
     */
    getCellDataFromEvent(event) {
        const
            me          = this,
            cellElement = DomHelper.up(event.target, '.b-grid-cell');

        // There is a cell
        if (cellElement) {
            const
                cellData         = DomDataStore.get(cellElement),
                { id, columnId } = cellData,
                record           = me.store.getById(id),
                column           = me.columns.getById(columnId);

            // Row might not have a record, since we transition record removal
            // https://app.assembla.com/spaces/bryntum/tickets/6805
            return record ? {
                cellElement,
                cellData,
                columnId,
                id,
                record,
                column,
                cellSelector : { id, columnId }
            } : null;
        }
    }

    /**
     * This method finds the header location of the passed event. It returns an object describing the header.
     * @param {Event} event A Mouse, Pointer or Touch event targeted at part of the grid.
     * @returns {Object} An object containing the following properties:
     * - `headerElement` - The header element clicked on.
     * - `column` - The {@link Grid.column.Column column} clicked under.
     * - `columnId` - The `id` of the {@link Grid.column.Column column} clicked under.
     * @internal
     * @category Events
     */
    getHeaderDataFromEvent(event) {
        const headerElement = DomHelper.up(event.target, '.b-grid-header');

        // There is a header
        if (headerElement) {
            const
                headerData   = ObjectHelper.assign({}, headerElement.dataset),
                { columnId } = headerData,
                column       = this.columns.getById(columnId);

            return column ? {
                headerElement,
                headerData,
                columnId,
                column
            } : null;
        }
    }

    /**
     * Handles all dom events, routing them to correct functions (touchstart -> onElementTouchStart)
     * @param event
     * @private
     * @category Events
     */
    handleEvent(event) {
        if (!this.disabled && gridBodyElementEventHandlers[event.type]) {
            this[gridBodyElementEventHandlers[event.type]](event);
        }
    }

    //endregion

    //region Touch events

    /**
     * Touch start, chain this function in features to handle the event.
     * @param event
     * @category Touch events
     * @internal
     */
    onElementTouchStart(event) {
        const
            me       = this,
            cellData = me.getCellDataFromEvent(event);

        DomHelper.isTouchEvent = true;

        if (event.touches.length === 1) {
            me.longPressTimeout = me.setTimeout(() => {
                me.onElementLongPress(event);
                event.preventDefault();
                me.longPressPerformed = true;
            }, me.longPressTime);
        }

        if (cellData && !event.defaultPrevented) {
            me.onFocusGesture(event);
        }
    }

    /**
     * Touch move, chain this function in features to handle the event.
     * @param event
     * @category Touch events
     * @internal
     */
    onElementTouchMove(event) {
        const me = this;

        if (me.longPressTimeout) {
            me.clearTimeout(me.longPressTimeout);
            me.longPressTimeout = null;
        }
    }

    /**
     * Touch end, chain this function in features to handle the event.
     * @param event
     * @category Touch events
     * @internal
     */
    onElementTouchEnd(event) {
        const me = this;

        if (me.longPressPerformed) {
            if (event.cancelable) {
                event.preventDefault();
            }
            me.longPressPerformed = false;
        }

        if (me.longPressTimeout) {
            me.clearTimeout(me.longPressTimeout);
            me.longPressTimeout = null;
        }
    }

    onElementLongPress(event) {}

    //endregion

    //region Mouse events

    // Trigger events in same style when clicking, dblclicking and for contextmenu
    triggerCellMouseEvent(name, event) {
        const
            me       = this,
            cellData = me.getCellDataFromEvent(event);

        // There is a cell
        if (cellData) {
            const
                column    = me.columns.getById(cellData.columnId),
                eventData = {
                    grid         : me,
                    record       : cellData.record,
                    column,
                    cellSelector : cellData.cellSelector,
                    cellElement  : cellData.cellElement,
                    target       : event.target,
                    event
                };

            me.trigger('cell' + StringHelper.capitalize(name), eventData);

            if (name === 'click') {
                column.onCellClick?.(eventData);
            }
        }
    }

    /**
     * Mouse down, chain this function in features to handle the event.
     * @param event
     * @category Mouse events
     * @internal
     */
    onElementMouseDown(event) {
        const
            me       = this,
            cellData = me.getCellDataFromEvent(event);

        me.skipFocusSelection = true;

        // If click was on a scrollbar or splitter, preventDefault to not steal focus
        if (me.isScrollbarOrRowBorderOrSplitterClick(event)) {
            event.preventDefault();
        }
        else {
            me.triggerCellMouseEvent('mousedown', event);

            // Browser event unification fires a mousedown on touch tap prior to focus.
            if (cellData && !event.defaultPrevented) {
                me.onFocusGesture(event);
            }
        }
    }

    isScrollbarOrRowBorderOrSplitterClick({ target, x, y }) {
        // Normally cells catch the click, directly on row = user clicked border, which we ignore.
        // Also ignore clicks on the virtual width element used to stretch fake scrollbar
        if (target.closest('.b-grid-splitter') || target.matches('.b-grid-row, .b-virtual-width')) {
            return true;
        }
        if (target.matches('.b-vertical-overflow')) {
            const rect = target.getBoundingClientRect();
            return x > rect.right - DomHelper.scrollBarWidth;
        }
        else if (target.matches('.b-horizontal-overflow')) {
            const rect = target.getBoundingClientRect();
            return y > rect.bottom - DomHelper.scrollBarWidth - 1; // -1 for height of virtualScrollerWidth element
        }
    }

    /**
     * Mouse move, chain this function in features to handle the event.
     * @param event
     * @category Mouse events
     * @internal
     */
    onElementMouseMove(event) {
        // Keep track of the last mouse position in case, due to OSX sloppy focusing,
        // focus is moved into the browser before a mousedown is delivered.
        // The cached mousemove event will provide the correct target in
        // GridNavigation#onGridElementFocus.
        this.mouseMoveEvent = event;
    }

    /**
     * Mouse up, chain this function in features to handle the event.
     * @param event
     * @category Mouse events
     * @internal
     */
    onElementMouseUp(event) {}

    /**
     * Pointer up, chain this function in features to handle the event.
     * @param event
     * @category Mouse events
     * @internal
     */
    onElementPointerUp(event) {}

    /**
     * Called before {@link #function-onElementClick}.
     * Fires 'beforeElementClick' event which can return false to cancel further onElementClick actions.
     * @param event
     * @fires beforeElementClick
     * @category Mouse events
     * @internal
     */

    onHandleElementClick(event) {
        if (this.trigger('beforeElementClick', { event }) !== false) {
            this.onElementClick(event);
        }
    }

    /**
     * Click, select cell on click and also fire 'cellClick' event.
     * Chain this function in features to handle the dom event.
     * @param event
     * @fires cellClick
     * @category Mouse events
     * @internal
     */
    onElementClick(event) {
        const
            me       = this,
            cellData = me.getCellDataFromEvent(event);

        // There is a cell
        if (cellData) {
            me.triggerCellMouseEvent('click', event);

            const row = DomDataStore.get(cellData.cellElement).row;

            // Unless row was destroyed by above event trigger, clear hover styling when clicking in a row
            // to avoid having it stick around if you keyboard navigate away from it
            // https://app.assembla.com/spaces/bryntum/tickets/5848
            if (!row.isDestroyed) {
                row.removeCls('b-hover');
            }
        }
    }

    onFocusGesture(event) {
        const
            me                    = this,
            isContextMenu         = event.button === 2,
            // Interaction with tree expand/collapse icons doesn't focus
            isTreeExpander        = !isContextMenu && event.target.matches('.b-icon-tree-expand, .b-icon-tree-collapse'),
            // Mac OS specific behaviour: when you right click a non-active window, the window does not receive focus, but the context menu is shown.
            // So for Mac OS we treat the right click as a non-focusable action, if window is not active
            isUnfocusedRightClick = !document.hasFocus() && BrowserHelper.isMac && isContextMenu;

        // Tree expander clicks and contextmenus on unfocused windows don't focus
        if (isTreeExpander || isUnfocusedRightClick) {
            event.preventDefault();
        }
        else {
            // Used by the GridNavigation mixin to detect what interaction event if any caused
            // the focus to be moved. If it's a programmatic focus, there won't be one.
            // Grid doesn't use a Navigator which maintains this property, so we need to set it.
            me.navigationEvent = event;

            // Context menu doesn't focus by default, so that needs to explicitly focus.
            // If they're re-clicking the current focus, GridNavigation#focusCell
            // still needs to know. It's a no-op, but it informs the GridSelection of the event.
            if (isContextMenu || me.focusedCell?.equals(new Location(event.target))) {
                me.focusCell(new Location(event.target));
            }
        }
    }

    /**
     * Double click, fires 'cellDblClick' event.
     * Chain this function in features to handle the dom event.
     * @param {Event} event
     * @fires cellDblClick
     * @category Mouse events
     * @internal
     */
    onElementDblClick(event) {
        const { target } = event;

        this.triggerCellMouseEvent('dblClick', event);

        if (target.classList.contains('b-grid-header-resize-handle')) {
            const
                header = DomHelper.up(target, '.b-grid-header'),
                column = this.columns.getById(header.dataset.columnId);

            column.resizeToFitContent();
        }
    }

    /**
     * Mouse over, adds 'hover' class to elements.
     * @param event
     * @fires mouseOver
     * @category Mouse events
     * @internal
     */
    onElementMouseOver(event) {
        // bail out early if scrolling
        if (!this.scrolling) {
            const cellElement = DomHelper.up(event.target, '.b-grid-cell');

            if (cellElement) {
                const row = DomDataStore.get(cellElement).row;

                // No hover effect needed if a mouse button is pressed (like when resizing window, region, or resizing something etc).
                // NOTE: 'buttons' not supported in Safari
                if (row && (typeof event.buttons !== 'number' || event.buttons === 0)) {
                    this.setHoveredRow(row);
                }

                this.triggerCellMouseEvent('mouseOver', event);
            }

            /**
             * Mouse moved in over element in grid
             * @event mouseOver
             * @param {MouseEvent} event The native browser event
             */
            this.trigger('mouseOver', { event });
        }
    }

    /**
     * Mouse out, removes 'hover' class from elements.
     * @param event
     * @fires mouseOut
     * @category Mouse events
     * @internal
     */
    onElementMouseOut(event) {
        this.setHoveredRow(null);

        // bail out early if scrolling
        if (!this.scrolling) {
            const cellElement = DomHelper.up(event.target, '.b-grid-cell');

            if (cellElement) {
                this.triggerCellMouseEvent('mouseOut', event);
            }

            /**
             * Mouse moved out from element in grid
             * @event mouseOut
             * @param {MouseEvent} event The native browser event
             */
            this.trigger('mouseOut', { event });
        }
    }

    // Not a setter to allow chaining in features
    setHoveredRow(row) {
        const me = this;

        // Unhover
        if (me._hoveredRow && !me._hoveredRow.isDestroyed) {
            me._hoveredRow.removeCls('b-hover');
            me._hoveredRow = null;
        }

        // Hover
        if (row && !me.scrolling) {
            me._hoveredRow = row;
            row.addCls('b-hover');
        }
    }

    //endregion

    //region Keyboard events

    // Hooks on to keyMaps keydown-listener to be able to run before
    keyMapOnKeyDown(event) {
        this.onElementKeyDown(event);
        super.keyMapOnKeyDown(event);
    }

    /**
     * To catch all keydowns. For more specific keydown actions, use keyMap.
     * @param event
     * @category Keyboard events
     * @internal
     */
    onElementKeyDown(event) {
        // If some other function flagged the event as handled, we ignore it.
        if (event.handled) {
            return;
        }

        const
            me          = this,
            // Read this to refresh cached reference in case this keystroke lead to the removal of current row
            focusedCell = me.focusedCell;

        if (focusedCell?.isCell && !focusedCell.isActionable) {
            const
                cellElement = focusedCell.cell;

            // If a cell is focused and column is interested - call special callback
            me.columns.getById(cellElement.dataset.columnId).onCellKeyDown?.({ event, cellElement });
        }
    }

    undoRedoKeyPress(event) {
        const { stm } = this.store;
        if (stm && this.enableUndoRedoKeys && !this.features.cellEdit?.isEditing) {
            stm.onUndoKeyPress(event);
            return true;
        }
        return false;
    }

    // Trigger column.onCellClick when space bar is pressed
    clickCellByKey(event) {
        const
            me          = this,
            // Read this to refresh cached reference in case this keystroke lead to the removal of current row
            focusedCell = me.focusedCell,
            cellElement = focusedCell?.cell,
            column      = me.columns.getById(cellElement.dataset.columnId);

        if (focusedCell?.isCell && !focusedCell.isActionable) {
            if (column.onCellClick) {
                column.onCellClick({
                    grid   : me,
                    column,
                    record : me.store.getById(focusedCell.id),
                    cellElement,
                    target : event.target,
                    event
                });
                return true;
            }
        }
        return false;
    }

    /**
     * Key press, chain this function in features to handle the dom event.
     * @param event
     * @category Keyboard events
     * @internal
     */
    onElementKeyPress(event) {}

    /**
     * Key up, chain this function in features to handle the dom event.
     * @param event
     * @category Keyboard events
     * @internal
     */
    onElementKeyUp(event) {}

    //endregion

    //region Other events

    /**
     * Context menu, chain this function in features to handle the dom event.
     * In most cases, include ContextMenu feature instead.
     * @param event
     * @category Other events
     * @internal
     */
    onElementContextMenu(event) {
        const
            me       = this,
            cellData = me.getCellDataFromEvent(event);

        // There is a cell
        if (cellData) {
            me.triggerCellMouseEvent('contextMenu', event);

            // Focus on tap for touch events.
            // Selection follows from focus.
            if (DomHelper.isTouchEvent) {
                me.onFocusGesture(event);
            }
        }
    }

    /**
     * Overrides empty base function in View, called when view is resized.
     * @fires resize
     * @param element
     * @param width
     * @param height
     * @param oldWidth
     * @param oldHeight
     * @category Other events
     * @internal
     */
    onInternalResize(element, width, height, oldWidth, oldHeight) {
        const me = this;

        if (me._devicePixelRatio && me._devicePixelRatio !== globalThis.devicePixelRatio) {
            // Pixel ratio changed, likely because of browser zoom. This affects the relative scrollbar width also
            DomHelper.resetScrollBarWidth();
        }

        me._devicePixelRatio = globalThis.devicePixelRatio;
        // cache to avoid recalculations in the middle of rendering code (RowManger#getRecordCoords())
        me._bodyRectangle    = Rectangle.client(me.bodyContainer);

        super.onInternalResize(...arguments);

        if (height !== oldHeight) {
            me._bodyHeight = me.bodyContainer.offsetHeight;
            if (me.isPainted) {
                // initial height will be set from render(),
                // it reaches onInternalResize too early when rendering, headers/footers are not sized yet
                me.rowManager.initWithHeight(me._bodyHeight);
            }
        }
        me.refreshVirtualScrollbars();

        if (width !== oldWidth) {
            // Slightly delay to avoid resize loops.
            me.setTimeout(() => {
                if (!me.isDestroyed) {
                    me.updateResponsive(width, oldWidth);
                }
            }, 0);
        }
    }

    //endregion

    // This does not need a className on Widgets.
    // Each *Class* which doesn't need 'b-' + constructor.name.toLowerCase() automatically adding
    // to the Widget it's mixed in to should implement thus.
    get widgetClass() {}
};
