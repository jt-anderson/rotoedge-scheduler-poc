import DomHelper from '../../Core/helper/DomHelper.js';
import DragHelper from '../../Core/helper/DragHelper.js';
import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from '../feature/GridFeatureManager.js';
import Delayable from '../../Core/mixin/Delayable.js';
import Widget from '../../Core/widget/Widget.js';
import ScrollManager from '../../Core/util/ScrollManager.js';

/**
 * @module Grid/feature/ColumnReorder
 */

/**
 * Allows user to reorder columns by dragging headers. To get notified about column reorder listen to `change` event
 * on {@link Grid.data.ColumnStore columns} store.
 *
 * This feature is <strong>enabled</strong> by default.
 *
 * @extends Core/mixin/InstancePlugin
 *
 * @demo Grid/columns
 * @classtype columnReorder
 * @inlineexample Grid/feature/ColumnReorder.js
 * @feature
 */
export default class ColumnReorder extends Delayable(InstancePlugin) {
    //region Init

    static get $name() {
        return 'ColumnReorder';
    }

    construct(grid, config) {
        this.ignoreSelectors = [
            '.b-grid-header-resize-handle',
            '.b-field'
        ];

        this.grid = grid;

        super.construct(grid, config);
    }

    doDestroy() {
        this.dragHelper?.scrollManager.destroy();
        this.dragHelper?.destroy();

        super.doDestroy();
    }

    /**
     * Initialize drag & drop (called from render)
     * @private
     */
    init() {
        const
            me         = this,
            { grid }   = me,
            gridEl     = grid.element,
            containers = DomHelper.children(gridEl, '.b-grid-headers');

        containers.push(...DomHelper.children(gridEl, '.b-grid-header-children'));

        if (me.dragHelper) {
            // update the dragHelper with the new set of containers it should operate upon
            me.dragHelper.containers = containers;
        }
        else {
            me.dragHelper = new DragHelper({
                name             : 'columnReorder',
                mode             : 'container',
                dragThreshold    : 10,
                targetSelector   : '.b-grid-header',
                floatRootOwner   : grid,
                rtlSource        : grid,
                outerElement     : grid.headerContainer,
                monitoringConfig : {
                    scrollables : [{
                        element : '.b-grid-headers'
                    }]
                },
                scrollManager : ScrollManager.new({
                    direction : 'horizontal',
                    element   : grid.headerContainer
                }),

                containers,
                isElementDraggable(element) {
                    const abort = Boolean(DomHelper.up(element, me.ignoreSelectors.join(',')));

                    if (abort || me.disabled) {
                        return false;
                    }

                    const
                        columnEl = DomHelper.up(element, this.targetSelector),
                        column   = columnEl && grid.columns.getById(columnEl.dataset.columnId),
                        isLast   = column?.childLevel === 0 && grid.subGrids[column.region].columns.count === 1;

                    // TODO: If we want to prevent dragging last column out of group we can use the code below...
                    /*isLast = column.level !== 0
                            // In grouped header, do not allow dragging last remaining child
                            ? column.parent.children.length === 1
                            // Not in a grouped header, do not allow dragging last remaining column
                            : grid.subGrids[column.region].columns.count === 1;*/

                    return Boolean(column) && column.draggable !== false && !isLast;
                },
                ignoreSelector : '.b-filter-icon,.b-grid-header-resize-handle',
                listeners      : {
                    beforeDragStart : me.onBeforeDragStart,
                    dragstart       : me.onDragStart,
                    drag            : me.onDrag,
                    drop            : me.onDrop,
                    thisObj         : me
                }
            });

            me.relayEvents(me.dragHelper, ['dragStart', 'drag', 'drop', 'abort'], 'gridHeader');
        }
    }

    //endregion

    //region Plugin config

    // Plugin configuration. This plugin chains some of the functions in Grid
    static get pluginConfig() {
        return {
            after : ['onPaint', 'renderContents']
        };
    }

    //endregion

    //region Events (drop)

    onDrag({ context, event }) {
        const
            me           = this,
            targetHeader = Widget.fromElement(event.target, 'gridheader');

        // If SubGrid is configured with a sealed column set, do not allow moving into it
        if (targetHeader?.subGrid.sealedColumns) {
            context.valid = false;
            return;
        }

        // Require that we drag inside grid header while dragging if we don't have a drag toolbar
        if (!me.grid.features.columnDragToolbar) {
            context.valid = Boolean(event.target.closest('.b-grid-headers'));
        }
    }

    onBeforeDragStart({ context, event }) {
        const
            element = context.element,
            column  = context.column = this.client.columns.getById(element.dataset.columnId);

        /**
         * This event is fired prior to starting a column drag gesture. The drag is canceled if a listener returns `false`.
         * @on-owner
         * @event beforeColumnDragStart
         * @param {Grid.view.Grid} source The grid instance.
         * @param {Grid.column.Column} column The dragged column.
         * @param {Event} event The browser event.
         * @preventable
         */
        return this.client.trigger('beforeColumnDragStart', { column, event });
    }

    onDragStart({ context, event }) {
        const
            me       = this,
            { grid } = me,
            { column } = context;

        if (!grid.features.columnDragToolbar) {
            const headerContainerBox = grid.element.querySelector('.b-grid-header-container').getBoundingClientRect();

            me.dragHelper.minY = headerContainerBox.top;
            me.dragHelper.maxY = headerContainerBox.bottom;
        }

        grid.headerContainer.classList.add('b-dragging-header');

        /**
         * This event is fired when a column drag gesture has started.
         * @on-owner
         * @event columnDragStart
         * @param {Grid.view.Grid} source The grid instance.
         * @param {Grid.column.Column} column The dragged column.
         * @param {Event} event The browser event.
         */
        this.client.trigger('columnDragStart', { column, event });
    }

    /**
     * Handle drop
     * @private
     */
    onDrop({ context, event }) {
        if (!context.valid) {
            return this.onInvalidDrop({ context });
        }

        const
            me           = this,
            { grid }     = me,
            element      = context.dragging,
            onHeader     = DomHelper.up(context.target, '.b-grid-header'),
            onColumn     = grid.columns.get(onHeader.dataset.column),
            toRegion     = context.draggedTo.dataset.region || onColumn.region,
            sibling      = context.insertBefore,
            column       = grid.columns.getById(element.dataset.columnId),
            oldParent    = column.parent,
            insertBefore = sibling ? grid.columns.getById(sibling.dataset.columnId) : grid.subGrids[toRegion].columns.last.nextSibling;

        let newParent;

        if (insertBefore) {
            newParent = insertBefore.parent;
        }
        else {
            const groupNode = DomHelper.up(onHeader.parentElement, '.b-grid-header');

            if (groupNode) {
                newParent = grid.columns.getById(groupNode.dataset.columnId);
            }
            else {
                newParent = grid.columns.rootNode;
            }
        }

        grid.headerContainer.classList.remove('b-dragging-header');

        // Clean up element used during drag drop as it will not be removed by Grid when it refreshes its header elements
        element.remove();

        // If dropped into its current position in the same SubGrid - abort
        let vetoed = (toRegion === column.region && oldParent === newParent && (onColumn === column.previousSibling || insertBefore === column.nextSibling));

        /**
         * This event is fired when a column is dropped, and you can return false from a listener to abort the operation.
         * @event beforeColumnDropFinalize
         * @on-owner
         * @param {Grid.view.Grid} source The grid instance.
         * @param {Grid.column.Column} column The dragged column.
         * @param {Grid.column.Column} insertBefore The column before which the dragged column will be inserted.
         * @param {Grid.column.Column} newParent The new parent column.
         * @param {Event} event The browser event.
         * @preventable
         */
        vetoed = vetoed || this.client.trigger('beforeColumnDropFinalize', { column, newParent, insertBefore, event }) === false;

        if (!vetoed) {
            // Insert the column into its new place, which might be vetoed if column is sealed
            vetoed = !newParent.insertChild(column, insertBefore);
        }

        context.valid = !vetoed;

        if (!vetoed) {
            column.region = toRegion;

            // Check if we should remove last child
            if (oldParent.children.length === 0) {
                oldParent.parent.removeChild(oldParent);
            }
        }

        /**
         * This event is always fired after a column is dropped. The `valid` param is true if the operation was not
         * vetoed and the column was moved in the column store.
         * @event columnDrop
         * @on-owner
         * @param {Grid.view.Grid} source The grid instance.
         * @param {Grid.column.Column} column The dragged column.
         * @param {Grid.column.Column} insertBefore The column before which the the dragged column will be inserted.
         * @param {Grid.column.Column} newParent The new parent column.
         * @param {Boolean} valid true if the operation was not vetoed.
         * @param {Event} event The browser event.
         * @preventable
         */
        this.client.trigger('columnDrop', { column, newParent, insertBefore, valid : context.valid, event });
    }

    /**
     * Handle invalid drop
     * @private
     */
    onInvalidDrop() {
        this.grid.headerContainer.classList.remove('b-dragging-header');
    }

    //endregion

    //region Render

    /**
     * Updates DragHelper with updated headers when grid contents is rerendered
     * @private
     */
    renderContents() {
        // columns shown, hidden or reordered
        this.init();
    }

    /**
     * Initializes this feature on grid paint.
     * @private
     */
    onPaint() {
        // always reinit on paint
        this.init();
    }

    //endregion
}

ColumnReorder.featureClass = 'b-column-reorder';

GridFeatureManager.registerFeature(ColumnReorder, true);
