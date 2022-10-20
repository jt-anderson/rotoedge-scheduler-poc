/**
 * @module Grid/feature/RowReorder
 */

import GridFeatureManager from './GridFeatureManager.js';
import DragHelper from '../../Core/helper/DragHelper.js';
import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import Delayable from '../../Core/mixin/Delayable.js';

/**
 * Allows user to reorder rows by dragging them. To get notified about row reorder listen to `change` event
 * on the grid {@link Core.data.Store store}.
 *
 * This feature is **off** by default. For info on enabling it, see {@link Grid.view.mixin.GridFeatures}.
 * This feature is **enabled** by default for Gantt.
 *
 * {@inlineexample Grid/feature/RowReorder.js}
 *
 * If the grid is set to {@link Grid.view.Grid#config-readOnly}, reordering is disabled. Inside all event listeners you
 * have access a `context` object which has a `record` property (the dragged record).
 *
 * ## Validation
 * You can validate the drag drop flow by listening to the `gridrowdrag` event. Inside this listener you have access to
 * the `index` property which is the target drop position. For trees you get access to the `parent` record and `index`,
 * where index means the child index inside the parent.
 *
 * You can also have an async finalization step using the {@link #event-gridRowBeforeDropFinalize}, for showing a
 * confirmation dialog or making a network request to decide if drag operation is valid (see code snippet below)
 *
 * ```javascript
 * features : {
 *     rowReorder : {
 *         listeners : {
 *             gridRowDrag : ({ context }) => {
 *                // Here you have access to context.insertBefore, and additionally context.parent for trees
 *             },
 *
 *             gridRowBeforeDropFinalize : async ({ context }) => {
 *                const result = await MessageDialog.confirm({
 *                    title   : 'Please confirm',
 *                    message : 'Did you want the row here?'
 *                });
 *
 *                // true to accept the drop or false to reject
 *                return result === MessageDialog.yesButton;
 *             }
 *         }
 *     }
 * }
 * ```
 *
 * Note, that this feature uses the concept of "insert before" when choosing a drop point in the data. So the dropped
 * record's position is *before the visual next record's position*.
 *
 * This may look like a pointless distinction, but consider the case when a Store is filtered. The record *above* the
 * drop point may have several filtered out records below it. When unfiltered, the dropped record will be *below* these
 * because of the "insert before" behaviour.
 *
 * ## Behavior with multiple subgrids
 *
 * For grids with multiple subgrids, row reordering is only enabled for the first subgrid.
 *
 * NOTE: This feature cannot be used simultaneously with the `enableTextSelection` config.
 *
 * @extends Core/mixin/InstancePlugin
 * @demo Grid/rowreordering
 * @classtype rowReorder
 * @feature
 */
export default class RowReorder extends Delayable(InstancePlugin) {
    //region Events
    /**
     * Fired before dragging starts, return false to prevent the drag operation.
     * @preventable
     * @event gridRowBeforeDragStart
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {Core.data.Model[]} context.records The dragged row records
     * @param {MouseEvent|TouchEvent} event
     */

    /**
     * Fired when dragging starts.
     * @event gridRowDragStart
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {Core.data.Model[]} context.records The dragged row records
     * @param {MouseEvent|TouchEvent} event
     */

    /**
     * Fired while the row is being dragged, in the listener function you have access to `context.insertBefore` a grid /
     * tree record, and additionally `context.parent` (a TreeNode) for trees. You can signal that the drop position is
     * valid or invalid by setting `context.valid = false;`
     * @event gridRowDrag
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {Boolean} context.valid Set this to true or false to indicate whether the drop position is valid.
     * @param {Core.data.Model} context.insertBefore The record to insert before (`null` if inserting at last position of a parent node)
     * @param {Core.data.Model} context.parent The parent record of the current drop position (only applicable for trees)
     * @param {Core.data.Model[]} context.records The dragged row records
     * @param {MouseEvent} event
     */

    /**
     * Fired before the row drop operation is finalized. You can return false to abort the drop operation, or a
     * Promise yielding `true` / `false` which allows for asynchronous abort (e.g. first show user a confirmation dialog).
     * @event gridRowBeforeDropFinalize
     * @preventable
     * @async
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {Boolean} context.valid Set this to true or false to indicate whether the drop position is valid
     * @param {Core.data.Model} context.insertBefore The record to insert before (`null` if inserting at last position of a parent node)
     * @param {Core.data.Model} context.parent The parent record of the current drop position (only applicable for trees)
     * @param {Core.data.Model[]} context.records The dragged row records
     * @param {Object[]} context.oldPositionContext An array of objects with information about the previous tree position.
     * Objects contain the record, and its original `parentIndex` and `parentId` values
     * @param {MouseEvent} event
     */

    /**
     * Fired after the row drop operation has completed, regardless of validity
     * @event gridRowDrop
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {Boolean} context.valid true or false depending on whether the drop position was valid
     * @param {Core.data.Model} context.insertBefore The record to insert before (`null` if inserting at last position of a parent node)
     * @param {Core.data.Model} context.parent The parent record of the current drop position (only applicable for trees)
     * @param {Core.data.Model} context.record [DEPRECATED] The dragged row record
     * @param {Core.data.Model[]} context.records The dragged row records
     * @param {Object[]} context.oldPositionContext An array of objects with information about the previous tree position.
     * Objects contain the record, and its original `parentIndex` and `parentId` values
     * @param {MouseEvent} event
     */

    /**
     * Fired when a row drag operation is aborted
     * @event gridRowAbort
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {MouseEvent} event
     */
    //endregion

    //region Init

    static get $name() {
        return 'RowReorder';
    }

    static get configurable() {
        return {
            /**
             * Set to `true` to show a grip icon in the left side of each row.
             * @config {Boolean}
             */
            showGrip : null,

            /**
             * If hovering over a parent node for this period of a time in a tree, the node will expand
             * @config {Number}
             */
            hoverExpandTimeout : 1000,

            /**
             * The amount of milliseconds to wait after a touchstart, before a drag gesture will be allowed to start.
             * @config {Number}
             * @default
             */
            touchStartDelay : 300,

            /**
             * Enables creation of parents by dragging a row and dropping it onto a leaf row. Only works in a Grid with
             * a tree store.
             * @config {Boolean}
             */
            dropOnLeaf : false

        };
    }

    construct(grid, config) {
        this.grid = grid;

        super.construct(...arguments);
    }

    doDestroy() {
        this.dragHelper?.destroy();

        super.doDestroy();
    }

    /**
     * Initialize drag & drop (called from render)
     * @private
     */
    init() {
        const
            me       = this,
            { grid } = me;

        me.dragHelper = new DragHelper({
            name               : 'rowReorder',
            cloneTarget        : true,
            dragThreshold      : 10,
            targetSelector     : '.b-grid-row',
            lockX              : true,
            scrollManager      : grid.scrollManager,
            dragWithin         : grid.element,
            outerElement       : me.targetSubGridElement,
            touchStartDelay    : me.touchStartDelay,
            isElementDraggable : el => !el.closest('.b-grid-cell .b-widget'),
            monitoringConfig   : {
                scrollables : [
                    {
                        element   : grid.scrollable.element,
                        direction : 'vertical'
                    }
                ]
            },

            // Since parent nodes can expand after hovering, meaning original drag start position now refers to a different point in the tree
            ignoreSamePositionDrop : false,
            createProxy(element) {
                const
                    clone     = element.cloneNode(true),
                    container = document.createElement('div');

                container.classList.add('b-row-reorder-proxy');

                clone.removeAttribute('id');
                // The containing element will be positioned instead
                clone.style.transform = '';

                container.appendChild(clone);

                if (grid.selectedRecords.length > 1) {
                    const clone2 = clone.cloneNode(true);

                    clone2.classList.add('b-row-dragging-multiple');

                    container.appendChild(clone2);
                }

                DomHelper.removeClsGlobally(container, 'b-selected', 'b-hover', 'b-focused');

                return container;
            },

            listeners : {
                beforedragstart : 'onBeforeDragStart',
                dragstart       : 'onDragStart',
                drag            : 'onDrag',
                drop            : 'onDrop',
                reset           : 'onReset',
                prio            : 10000, // To ensure our listener is run before the relayed listeners (for the outside world)
                thisObj         : me
            }
        });

        me.dropIndicator = DomHelper.createElement({
            className : 'b-row-drop-indicator'
        });

        me.relayEvents(me.dragHelper, ['beforeDragStart', 'dragStart', 'drag', 'abort'], 'gridRow');

        me.dropOverTargetCls = ['b-row-reordering-target', 'b-hover'];
    }

    //endregion

    //region Plugin config

    static get pluginConfig() {
        return {
            after : ['onPaint']
        };
    }

    get targetSubGridElement() {
        const targetSubGrid = this.grid.regions[0];

        return this.grid.subGrids[targetSubGrid].element;
    }

    //endregion

    //region Events (drop)

    onBeforeDragStart({ event, source, context }) {
        const
            me                = this,
            { grid }          = me,
            subGridEl         = me.targetSubGridElement;

        // Only dragging enabled in the leftmost grid section
        if (me.disabled || grid.readOnly || grid.isTreeGrouped || !subGridEl.contains(context.element)) {
            return false;
        }

        context.startRecord = grid.getRecordFromElement(context.element);

        // Dont allow starting drag on a readOnly record
        if (context.startRecord.readOnly) {
            return false;
        }

        context.originalRowTop = grid.rowManager.getRowFor(context.startRecord).top;

        if (source.startEvent.pointerType === 'touch') {
            // Touchstart doesn't focus/navigate on its own, so we do it at the last moment before drag start
            if (!grid.isSelected(context.startRecord)) {
                grid.selectRow({
                    record         : context.startRecord,
                    addToSelection : false
                });
            }
        }
        else if (!grid.isSelected(context.startRecord) && !event.shiftKey && !event.ctrlKey) {
            // If record is not selected and shift/ctrl is not pressed then select single row
            grid.selectRow({
                record : context.startRecord
            });
        }

        // Filter out any readOnly records from the drag
        const records = context.records = grid.selectedRecords.filter(r => !r.readOnly).slice().sort((r1, r2) => grid.store.indexOf(r1) - grid.store.indexOf(r2));

        return records.length > 0 && !records.some(rec => rec.isSpecialRow);
    }

    onDragStart({ context }) {
        const
            me                                 = this,
            { grid }                           = me,
            { cellEdit, cellMenu, headerMenu } = grid.features;

        if (cellEdit) {
            me.cellEditDisabledState = cellEdit.disabled;
            cellEdit.disabled = true; // prevent editing from being started through keystroke during row reordering
        }

        cellMenu?.hideContextMenu?.(false);
        headerMenu?.hideContextMenu?.(false);

        grid.element.classList.add('b-row-reordering');

        const focusedCell = context.element.querySelector('.b-focused');
        focusedCell?.classList.remove('b-focused');

        context.element.firstElementChild.classList.remove('b-selected', 'b-hover');

        grid.bodyContainer.appendChild(me.dropIndicator);
    }

    onDrag({ context, event }) {
        const
            me                    = this,
            { grid }              = me,
            { store, rowManager } = grid,
            { clientY }           = event;

        let valid = true,
            row   = rowManager.getRowAt(clientY),
            overRecord,
            dataIndex,
            after,
            over,
            insertBefore;

        if (row) {
            const
                rowTop        = row.top + grid._bodyRectangle.y - grid.scrollable.y,
                quarter       = row.height / 4,
                topQuarter    = rowTop + quarter,
                middleY       = rowTop + row.height / 2,
                bottomQuarter = rowTop + quarter * 3;

            dataIndex  = row.dataIndex;
            overRecord = store.getAt(dataIndex);

            // If Tree and pointer is in quarter 2 and 3, add as child of hovered row
            over = store.tree && (overRecord.isParent || me.dropOnLeaf) && clientY > topQuarter && clientY < bottomQuarter;
            // Else, drop after row below if mouse is in bottom half of hovered row
            after = !over && event.clientY >= middleY;
        }
        // User dragged below last row or above the top row.
        else {
            if (event.clientY < grid._bodyRectangle.y) {
                dataIndex  = 0;
                overRecord = store.first;
                after      = false;
            }
            else {
                dataIndex  = store.count - 1;
                overRecord = store.last;
                after      = true;
            }
            row = grid.rowManager.getRow(dataIndex);
        }

        if (overRecord === me.overRecord && me.after === after && me.over === over) {
            context.valid = me.reorderValid;
            // nothing's changed
            return;
        }

        if (me.overRecord !== overRecord) {
            rowManager.getRowById(me.overRecord)?.removeCls(me.dropOverTargetCls);
        }

        me.overRecord = overRecord;
        me.after      = after;
        me.over       = over;

        // Hovering the dragged record. This is a no-op.
        // But still gather the contextual data.
        if (overRecord === context.startRecord) {
            valid = false;
        }

        // Not allowed to drop above topmost group header
        if (!after && dataIndex === 0 && store.isGrouped) {
            valid = false;
        }

        if (store.tree) {
            insertBefore = after ? overRecord.nextSibling : overRecord;

            // For trees, prevent moving a parent into its own hierarchy
            if (context.records.some(rec => rec.contains(overRecord))) {
                valid = false;
            }

            context.parent = valid && over ? overRecord : overRecord.parent;
            row.toggleCls(me.dropOverTargetCls, valid && over);

            me.clearTimeout(me.hoverTimer);

            if (overRecord && overRecord.isParent && !overRecord.isExpanded(store)) {
                me.hoverTimer = me.setTimeout(() => grid.expand(overRecord), me.hoverExpandTimeout);
            }
        }
        else {
            insertBefore = after ? store.getAt(dataIndex + 1) : overRecord;
        }

        // If hovering results in same dataindex, regardless of what row is hovered, and parent has not changed
        if (!over && dataIndex === store.indexOf(context.startRecord) + (after ? -1 : 1) &&
            context.parent && context.startRecord.parent === context.parent) {
            valid = false;
        }

        // Provide visual clue to user of the drop position
        // In FF (in tests) it might not have had time to redraw rows after scroll before getting here
        row && DomHelper.setTranslateY(me.dropIndicator, Math.max(row.top + (after ? row.element.getBoundingClientRect().height : 0), 1));

        // Don't show dropIndicator if holding over a row
        me.dropIndicator.style.visibility = over ? 'hidden' : 'visible';
        me.dropIndicator.classList.toggle('b-drag-invalid', !valid);

        // Public property used for validation
        context.insertBefore = insertBefore;

        context.valid = me.reorderValid = valid;
    }

    /**
     * Handle drop
     * @private
     */
    async onDrop(event) {
        const
            me             = this,
            context        = event.context;

        context.valid = context.valid && me.reorderValid;

        if (context.valid) {
            context.async = true;

            if (me.client.store.tree) {
                // For tree scenario, add context about previous positions of dragged tree nodes
                context.oldPositionContext = context.records.map((record) => ({
                    record,
                    parentId    : record.parent?.id,
                    parentIndex : record.parentIndex
                }));
            }

            // Outside world provided us one or more Promises to wait for
            const result = await me.trigger('gridRowBeforeDropFinalize', event);

            if (result === false) {
                context.valid = false;
            }

            await me.dragHelper.animateProxyTo(me.dropIndicator, { align : 'l0-l0' });

            await me.finalizeReorder(context);
        }

        // already dropped the node, don't have to expand any node hovered anymore
        // (cancelling expand action after timeout)
        me.clearTimeout(me.hoverTimer);

        me.overRecord = me.after = me.over = null;

        me.trigger('gridRowDrop', event);
    }

    async finalizeReorder(context) {
        const
            me                     = this,
            { grid }               = me,
            { store, focusedCell } = grid;

        let records = context.records;

        context.valid = context.valid && !records.some(rec => !store.includes(rec));

        if (context.valid) {
            let result;

            if (store.tree) {
                // Remove any selected child records of parent nodes
                records = records.filter(record => !record.parent || !records.includes(record.parent));

                result  = await context.parent.tryInsertChild(records, me.over ? context.parent.children?.[0] : context.insertBefore);
                // remove reorder cls from preview parent element dropped
                grid.rowManager.forEach(r => r.removeCls(me.dropOverTargetCls));

                // If parent wasn't expanded, expand it if it now has children
                if (!context.parent.isExpanded() && context.parent.children?.length) {
                    grid.expand(context.parent);
                }

                context.valid = result !== false;
            }
            else {
                store.move(records, context.insertBefore);
            }

            if (focusedCell?._rowIndex >= 0) {
                grid._focusedCell = null;
                // Refresh focused cell
                grid.focusCell({
                    grid,
                    record   : focusedCell.record,
                    columnId : focusedCell.columnId
                });
            }

            store.clearSorters();
        }

        context.finalize(context.valid);

        grid.element.classList.remove('b-row-reordering');
    }

    /**
     * Clean up on reset
     * @private
     */
    onReset() {
        const
            me       = this,
            cellEdit = me.grid.features.cellEdit;

        me.grid.element.classList.remove('b-row-reordering');

        if (cellEdit) {
            cellEdit.disabled = me.cellEditDisabledState;
        }

        me.dropIndicator.remove();

        DomHelper.removeClsGlobally(
            me.grid.element,
            ...me.dropOverTargetCls
        );
    }

    //endregion

    //region Render

    /**
     * Updates DragHelper with updated headers when grid contents is rerendered
     * @private
     */
    onPaint() {
        // columns shown, hidden or reordered
        this.init();
    }

    //endregion

    updateShowGrip(show) {
        this.grid.element.classList.toggle('b-row-reorder-with-grip', show);
    }
}

RowReorder.featureClass = '';

GridFeatureManager.registerFeature(RowReorder, false);
GridFeatureManager.registerFeature(RowReorder, true, 'Gantt');
