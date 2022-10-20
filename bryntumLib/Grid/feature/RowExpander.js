import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from '../feature/GridFeatureManager.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import EventHelper from '../../Core/helper/EventHelper.js';
import Objects from '../../Core/helper/util/Objects.js';
import '../column/ActionColumn.js';

/**
 * @module Grid/feature/RowExpander
 */

const storeRemoveActions = { remove : 1, filter : 1, dataset : 1, replace : 1 };

/**
 * Enables expanding of Grid rows by either row click or double click, or by adding a separate Grid column which renders
 * a button that expands or collapses the row.
 *
 * {@inlineexample Grid/feature/RowExpander.js}
 *
 * The content of the expanded row body is rendered by providing a {@link #config-renderer} function to the
 * rowExpander feature config.
 *
 * ```javascript
 * new Grid({
 *    features : {
 *        rowExpander : {
 *            renderer({record, region, expanderElement}){
 *                return htmlToBeExpanded;
 *            }
 *        }
 *    }
 * });
 * ```
 *
 * <div class="note">Note that if used in a Gantt, the Gant's `fixedRowHeight` must be set to `false`.</div>
 *
 * This feature is **disabled** by default
 *
 * ## Expand on click
 * Set {@link #config-triggerEvent} to a Grid cell event that should trigger row expanding and collapsing.
 *
 * ```javascript
 * new Grid({
 *    features : {
 *        rowExpander : {
 *            triggerEvent: 'celldblclick',
 *            renderer...
 *        }
 *    }
 * });
 * ```
 *
 * ## Expander column position
 * The expander column can either be inserted before or after the existing Grid columns. If the Grid has multiple
 * regions the column will be added to the first region.
 *
 * Adjust expander column position to last in a specific Grid region by setting {@link #config-columnPosition}
 * to `last` and configuring the {@link #config-column} with a region name.
 *
 * ```javascript
 * new Grid({
 *    features : {
 *        rowExpander : {
 *            column: {
 *                region: 'last'
 *            },
 *            columnPosition: 'last',
 *            renderer...
 *        }
 *    }
 * });
 * ```
 *
 * ## Record update
 * If the expander content depends on row record data, the expander can be re-rendered on record update by setting
 * {@link #config-refreshOnRecordChange} to `true`.
 * ```javascript
 * new Grid({
 *    features : {
 *        rowExpander : {
 *            refreshOnRecordChange: true,
 *            renderer...
 *        }
 *    }
 * });
 * ```
 *
 * ## Async
 * When the content of the row expander should be rendered async just see to it that you return a promise.
 * ```javascript
 * new Grid({
 *    features : {
 *        rowExpander : {
 *            async renderer({record, region, expanderElement}){
 *                return fetchFromBackendAndRenderData(record);
 *            }
 *        }
 *    }
 * });
 * ```
 *
 * @extends Core/mixin/InstancePlugin
 * @classtype rowExpander
 * @feature
 */
export default class RowExpander extends InstancePlugin {

    //region Config
    static $name = 'RowExpander';

    static properties = {
        // CSS classes
        expanderBodyClass : 'b-rowexpander-body',
        expandedRowClass  : 'b-rowexpander-row-expanded',
        // Map where the keys are the expanded records and values are an object {rowHeight, cellHeight, expandElements}
        recordStateMap    : new Map(),
        collapsingRecords : new Set()
    };

    static configurable = {

        /**
         * The implementation of this function is called each time the body of an expanded row is rendered. Either
         * return an HTML string, or a {@link Core.helper.DomHelper#typedef-DomConfig} object describing the markup.
         *
         * ```javascript
         * new Grid({
         *    features : {
         *        rowExpander : {
         *            renderer({record, region, expanderElement}){
         *                return htmlToBeExpanded;
         *            }
         *        }
         *    }
         * });
         * ```
         *
         * Or return a {@link Core.helper.DomHelper#typedef-DomConfig} object.
         *
         * ```javascript
         * new Grid({
         *    features : {
         *        rowExpander : {
         *            renderer({record, region, expanderElement}){
         *                return {
         *                   tag       : 'form',
         *                   className : 'expanded-row-form',
         *                   children  : [
         *                       {
         *                           tag        : 'textarea',
         *                           name       : 'description',
         *                           className  : 'expanded-textarea'
         *                       },
         *                       {
         *                           tag        : 'button',
         *                           text       : 'Save',
         *                           className  : 'expanded-save-button',
         *                       }
         *                   ]
         *                };
         *            }
         *        }
         *    }
         * });
         * ```
         *
         * It is also possible to add markup directly to the expanderElement.
         *
         * ```javascript
         * new Grid({
         *    features : {
         *        rowExpander : {
         *            renderer({record, region, expanderElement}){
         *                new UIComponent({
         *                    appendTo: expanderElement,
         *                    ...
         *                });
         *            }
         *        }
         *    }
         * });
         * ```
         * The renderer function can also be asynchronous.
         *
         * ```javascript
         * new Grid({
         *    features : {
         *        rowExpander : {
         *            async renderer({record, region, expanderElement}){
         *                return await awaitAsynchronousOperation();
         *            }
         *        }
         *    }
         * });
         * ```
         * @param {Object} renderData Object containing renderer parameters
         * @param {Core.data.Model} renderData.record Record for the row
         * @param {HTMLElement} renderData.expanderElement Expander body element
         * @param {HTMLElement} renderData.rowElement Row element
         * @param {String} renderData.region Grid region name
         * @returns {String|DomConfig} Row expander body content
         * @config {Function}
         * @async
         */
        renderer : null,

        /**
         * The name of the Grid event that will toggle expander. Defaults to `null` but can be set to any event such
         * as {@link Grid.view.mixin.GridElementEvents#event-cellDblClick} or
         * {@link Grid.view.mixin.GridElementEvents#event-cellClick}.
         *
         * ```javascript
         * features : {
         *     rowExpander : {
         *         triggerEvent : 'cellclick'
         *     }
         * }
         * ```
         *
         * @config {String}
         */
        triggerEvent : null,

        /**
         * Provide a column config object to display a button with expand/collapse functionality.
         * Shown by default, set to `null` to not include.
         *
         * ```javascript
         * new Grid({
         *    features : {
         *        rowExpander : {
         *            column: {
         *                // Use column config options here
         *                region: 'last'
         *            }
         *        }
         *    }
         * });
         * ```
         *
         * @config {Object|Grid.column.ActionColumn}
         */
        column : { },

        /**
         * Makes the expand/collapse button column appear either as the first column (default or `first`) or as the
         * last (set to `last`). Note that the column by default will be added to the first region, if the Grid
         * has multiple regions. Use the {@link #config-column} config to change region.
         * @config {String}
         * @default
         */
        columnPosition : 'first',

        /**
         * If set to `true`, the RowExpander will, on record update, re-render an expanded row by calling the
         * {@link #config-renderer} function.
         * @config {Boolean}
         * @default
         */
        refreshOnRecordChange : false,

        /**
         * Use this for customizing async {@link #config-renderer} loading indicator height.
         * @config {Number}
         * @defalt
         */
        loadingIndicatorHeight : 100,

        /**
         * Use this for customizing async {@link #config-renderer} loading indicator text.
         * @config {String}
         * @default Loading
         */
        loadingIndicatorText : 'L{loading}',

        /**
         * Use this to disable expand and collapse animations.
         * @config {Boolean}
         * @default
         */
        enableAnimations : true
    }

    // Plugin configuration. This plugin chains/overrides some of the functions in Grid.
    static get pluginConfig() {
        return {
            chain    : ['afterColumnsChange', 'beforeRenderRow', 'processRowHeight', 'bindStore'],
            override : ['onGridBodyFocusIn']
        };
    }

    //endregion

    //region Init

    afterConstruct() {
        const
            me         = this,
            { client } = me;
        if (!me.renderer) {
            console.warn('RowExpander requires implementing the renderer function.');
            return;
        }
        if (client.isGanttBase && client.fixedRowHeight !== false) {
            console.warn('When using RowExpander on a Gantt, the Gantt`s fixedRowHeight config must be set to false.');
        }

        // Bind initial store
        me.bindStore(client.store);

        if (me.triggerEvent) {
            client.on(me.triggerEvent, me.onTriggerEvent, me);
        }

        me.addColumn();
    }

    bindStore(store) {
        const me = this;

        me.recordStateMap.clear();
        me.collapsingRecords.clear();
        me.detachListeners('clientStoreChange');

        store.on({
            name    : 'clientStoreChange',
            change  : me.onStoreChange,
            thisObj : me
        });
    }

    doDisable(disable) {
        const { client } = this;

        if (disable) {
            this.recordStateMap.clear();
            this.collapsingRecords.clear();
        }

        if (!client.isConfiguring) {
            client.rowManager.renderFromRow();
        }
        super.doDisable(disable);
    }

    changeLoadingIndicatorText(text) {
        return text ? this.L(text) : text;
    }

    // Overrides onGridBodyFocusIn to ignore events on row expander body.
    onGridBodyFocusIn(event) {
        if (!this.client.lastMousedownEvent?.target?.closest('.b-rowexpander-body')) {
            this.overridden.onGridBodyFocusIn(event);
        }
    }

    get isAnimating() {
        return this.client.isAnimating;
    }

    set isAnimating(value) {
        const
            { client }   = this,
            wasAnimating = client.isAnimating;

        client.isAnimating = value;

        if (client.isAnimating !== wasAnimating) {
            client.element.classList.toggle('b-rowexpander-animating');
        }
    }

    //endregion

    //region Events
    /**
     * This event fires before row expand is started.
     *
     * Returning `false` from a listener prevents the RowExpander to expand the row.
     *
     * Note that this event fires when the RowExpander toggles the row, not when the actual row expander body is
     * rendered. Most of the time this is synchronous, but in the case of a row that is not yet rendered into view by
     * scrolling, it can happen much later.
     *
     * @event beforeExpand
     * @preventable
     * @async
     * @param {Core.data.Model} record Record
     */

    /**
     * This event fires before row collapse is started.
     *
     * Returning `false` from a listener prevents the RowExpander to collapse the row.
     *
     * Note that this event fires when the RowExpander toggles the row, not when the actual row expander body is
     * rendered. Most of the time this is synchronous, but in the case of a row that is not yet rendered into view by
     * scrolling, it can happen much later.
     *
     * @event beforeCollapse
     * @preventable
     * @async
     * @param {Core.data.Model} record Record
     */
    //endregion

    //region ExpanderColumn
    afterColumnsChange() {
        this.addColumn();
    }

    changeColumn(config) {
        if (config == null) {
            return config;
        }
        return {
            type    : 'action',
            actions : [{
                cls     : 'b-icon b-icon-collapse-down',
                tooltip : 'Expand',
                onClick : ({ record }) => this.toggleExpand(record)
            }],
            width    : 40,
            hideable : false,
            align    : 'center',
            region   : this.client.regions[0],
            ...config,
            field    : 'expanderActionColumn'
        };
    }

    // Called in construct and if grid columns change
    addColumn() {
        const
            me = this,
            { column } = me,
            { columns } = me.client;

        if (!me._isAddingExpanderColumn && column && (!me._expander || !columns.includes(me._expander))) {
            me._isAddingExpanderColumn = true;
            if (me.columnPosition === 'last') {
                [me._expander] = columns.add(column);
            }
            else {
                [me._expander] = columns.insert(0, column);
            }
            me._isAddingExpanderColumn = false;
        }
    }
    //endregion

    //region UI events

    onTriggerEvent({ target }) {
        // Only grid cell event is handled. Action-cell event has its own handler.
        if (this.disabled || target?.closest('.b-action-cell') || !target.closest('.b-grid-cell')) {
            return;
        }
        this.toggleExpand(this.client.getRecordFromElement(target));
    }

    /**
     * Toggles expander state.
     * @private
     * @param {Core.data.Model} record The record that should be toggled
     * @category Internal
     */
    toggleExpand(record) {
        if (record) {
            if (this.recordStateMap.has(record)) {
                this.collapse(record);
            }
            else {
                this.expand(record);
            }
        }
    }

    //endregion

    //region Rendering

    /**
     * Listens to changes in the Grid Store. Will remove expand State data on Store removal.
     * If the refreshOnRecordChange config is `true`, it will trigger a re-render of the expander.
     * @private
     * @param {String} action
     * @param {Core.data.Store} source
     * @param {Core.data.Model[]} records
     * @category Internal
     */
    onStoreChange({ action, source, records }) {
        const
            me = this,
            { recordStateMap, collapsingRecords } = me;
        if (me.disabled) {
            return;
        }
        if (action === 'removeAll') {
            recordStateMap.clear();
            collapsingRecords.clear();
        }
        else if (storeRemoveActions[action]) {
            for (const [record] of recordStateMap) {
                if (!source.includes(record)) {
                    recordStateMap.delete(record);
                    collapsingRecords.delete(record);
                }
            }
        }
        else if (me.refreshOnRecordChange && records?.length) {
            if (action === 'update') {
                const recordState = recordStateMap.get(records[0]);
                if (recordState?.isCreated) {
                    recordState.isCreated = false;
                    me.client.rowManager.renderFromRecord(records[0]);
                }
            }
            else if (action === 'updatemultiple') {
                let topRecordIndex,
                    topRecord;
                for (const rec of records) {
                    const recordState = recordStateMap.get(rec);
                    if (recordState?.isCreated) {
                        recordState.isCreated = false;
                        const index = source.records.indexOf(rec);
                        if (!topRecord || topRecordIndex > index) {
                            topRecordIndex = index;
                            topRecord = rec;
                        }
                    }
                }
                if (topRecord) {
                    me.client.rowManager.renderFromRecord(topRecord);
                }
            }
        }
    }

    // Implements grid.processRowHeight hook
    processRowHeight(record, height) {
        const recordState = this.recordStateMap.get(record);
        if (recordState) {
            // If we are waiting for async rendering, height is calculated from a fixed loadingIndicatorHeight.
            if (!recordState.isCreated && recordState.isRenderingAsync) {
                return this.loadingIndicatorHeight + height;
            }
            // If we have a recordState but no expanderBodyHeight, we should recalculate height.
            if (!recordState.expanderBodyHeight) {
                for (const region of this.client.regions) {
                    const height = recordState.expandElements[region].offsetHeight;
                    if (height > recordState.expanderBodyHeight) {
                        recordState.expanderBodyHeight = height;
                    }
                }
            }
        }
        return (recordState?.expanderBodyHeight ?? 0) + height;
    }

    /**
     * Hooks on before row render to render or remove row expander content depending on record state.
     * @private
     * @category Internal
     */
    beforeRenderRow({ row, record }) {
        const
            me = this,
            { regions } = me.client,
            { expandedRowClass } = me;

        row.cls.toggle('b-rowexpander-disabled', me.disabled);

        // If current row is expanded, always remove all expander content and settings.
        if (row.cls[expandedRowClass]) {
            // If animating a collapse, content should not be removed until animation is complete
            if (me.enableAnimations && me.isAnimating && me.collapsingRecords.has(record)) {
                me.waitForTransition(row, () => {
                    // Make sure record still should be collapsed after animation is complete
                    if (me.collapsingRecords.has(record)) {
                        me.removeExpander(row);
                    }
                });
            }
            else {
                me.removeExpander(row);
            }
        }
        else {
            // Makes sure record should collapse no longer
            me.collapsingRecords.delete(record);
        }

        // The map only contains record that are expanded
        const recordState = me.recordStateMap.get(record);
        if (!me.disabled && recordState) {
            // Expander content is created once, then reused.
            if (!recordState.isCreated) {
                me.renderExpander(record, row, recordState);
            }
            row.cls.add(expandedRowClass);
            for (const region of regions) {
                const rowElement = row.getElement(region);
                if (recordState.isCreated) {
                    rowElement.appendChild(recordState.expandElements[region]);
                }
                else {
                    // If the renderer is async, we show a loading indicator.
                    me.renderLoadingIndicator(rowElement, recordState);
                }
                me.lockCellHeight(rowElement, recordState.cellHeight, false);
            }

            // If expander body is rendered not fully in view, it will be scrolled into view
            if (me._shouldScrollIntoView) {
                me._shouldScrollIntoView = false;
                if (!DomHelper.isInView(recordState.expandElements[regions[0]], true)) {
                    // Waits for rendering to complete, then scrolls
                    me.client.rowManager.on({
                        once       : true,
                        thisObj    : me,
                        renderDone : () => me.scrollRowIntoView(row, record)
                    });
                }
            }
        }
    }

    /**
     * Scrolls expanded row into view. This function is called after rowManager has finished rendering.
     * @private
     * @category Internal
     */
    scrollRowIntoView(row, record) {
        // If animating expand, need to wait for the animation to end before scrolling.
        if (this.isAnimating) {
            this.waitForTransition(row, () => this.client.scrollRowIntoView(record));
        }
        else {
            this.client.scrollRowIntoView(record);
        }
    }

    /**
     * Waits for height transition on the provided rows element. Then calls provided function.
     * @private
     * @category Internal
     */
    waitForTransition(row, fn) {
        EventHelper.onTransitionEnd({
            element  : row.element,
            property : 'height',
            handler  : fn,
            thisObj  : this
        });
    }

    removeExpander(row) {
        row.cls.remove(this.expandedRowClass);
        for (const region of this.client.regions) {
            const rowElement = row.getElement(region);
            // If this function is called after animation finished, we need to remove class `manually`
            rowElement.classList.remove(this.expandedRowClass);
            DomHelper.removeEachSelector(rowElement, '.' + this.expanderBodyClass);
            this.lockCellHeight(rowElement, null, false);
        }
    }

    renderLoadingIndicator(rowElement, recordState) {
        DomHelper.createElement({
            parent    : rowElement,
            className : this.expanderBodyClass + ' b-rowexpander-loading',
            style     : {
                top    : recordState.cellHeight,
                height : this.loadingIndicatorHeight
            },
            children : [
                {
                    tag       : 'i',
                    className : 'b-icon b-icon-spinner'
                },
                this.loadingIndicatorText
            ]
        });
    }

    /**
     * Creates expander element for each grid region and calls the renderer, also for each grid region.
     * @private
     * @param {Core.data.Model} record
     * @param {Grid.row.Row} row
     * @param {Object} recordState
     * @category Internal
     */
    renderExpander(record, row, recordState) {
        const
            me                = this,
            cellHeight        = row.cells[0]?.offsetHeight,
            expandElements    = {},
            renderings        = [],
            // Will be called sync or async depending on the implementation of the renderer function.
            continueRendering = (content, expanderElement, region) => {
                if (content != null) {
                    if (typeof content === 'string') {
                        expanderElement.innerHTML = content;
                    }
                    // Everything else will be treated as a dom config for now
                    else {
                        content = DomHelper.createElement(content);
                        expanderElement.appendChild(content);
                    }
                }
                expandElements[region] = expanderElement;
            };

        // If another rendering of the same record is made while waiting for async, we should ignore it.
        if (recordState.isRenderingAsync) {
            return;
        }

        Object.assign(recordState, { cellHeight, expandElements, expanderBodyHeight : 0 });

        for (const region of me.client.regions) {
            const rowElement = row.getElement(region);

            // class needed at this point to give the expander container correct height
            row.addCls(me.expandedRowClass);

            // Create expand container
            // Expander element needs to be in the DOM for appendTo to work correctly
            const expanderElement = DomHelper.createElement({
                parent    : rowElement,
                className : me.expanderBodyClass,
                style     : {
                    top : cellHeight + 'px'
                }
            });

            // The renderer can be async or sync
            const renderResponse = me.renderer({ record, expanderElement, rowElement, region });
            if (Objects.isPromise(renderResponse)) {
                renderings.push(renderResponse.then((content) => continueRendering(content, expanderElement, region)));
            }
            else {
                continueRendering(renderResponse, expanderElement, region);
            }
        }

        // If we have async renderer, wait for all to complete
        if (renderings.length) {
            recordState.isRenderingAsync = true;
            Promise.all(renderings).then((contents) => {
                // Flag that indicates the completion of expand rendering
                recordState.isCreated = true;
                // The rows need to refresh to recalculate row height
                me.renderRowsWithAnimation(record);
                recordState.isRenderingAsync = false;
            });
        }
        else {
            recordState.isCreated = true;
        }
    }

    /**
     * Called when grid rows needs to re-render, for example on expand or collapse.
     * Activates animations on grid, and deactivates them when they are completed.
     * @private
     * @param {Core.data.Model} record Record whose row was toggled
     * @category Internal
     */
    renderRowsWithAnimation(record) {
        const me = this;
        if (me.enableAnimations) {
            const row = me.client.rowManager.getRowById(record);
            if (row) {
                me.isAnimating = true;
                if (me.collapsingRecords.has(record)) {
                    row.addCls('b-row-is-collapsing');
                }
                me.waitForTransition(row, () => {
                    me.isAnimating = false;
                    row.removeCls('b-row-is-collapsing');
                });
            }
        }
        me.client.rowManager.renderFromRecord(record);
    }

    /**
     * Called when row is expanded. This function locks all cell's height to current height (before expanding).
     * @private
     * @param {HTMLElement} rowElement
     * @param {Number} cellHeight The height to lock
     * @param {Boolean} unlock To remove locked cell height when the row is collapsed
     * @category Internal
     */
    lockCellHeight(rowElement, cellHeight, unlock) {
        for (let a = 0; a < rowElement.children.length; a++) {
            const child = rowElement.children[a];
            // Should not lock expander element
            if (!child.classList.contains(this.expanderBodyClass)) {
                child.style.height = unlock ? '' : cellHeight + 'px';
            }
        }
    }
    //endregion

    //region Public

    /**
     * Tells the RowExpander that the provided record should be expanded. If or when the record is rendered into view,
     * the record will be expanded.
     *
     * @param {Core.data.Model} record Record whose row should be expanded
     * @category Common
     */
    async expand(record) {
        const me = this;
        if (me.disabled) {
            return;
        }

        if (await me.trigger('beforeExpand', { record }) === false) {
            return;
        }
        // Tells renderer that this record should be expanded
        me.recordStateMap.set(record, { isCreated : false });
        // In the event that we have expanded a record which is in collapsing animation state
        me.collapsingRecords.delete(record);
        me._shouldScrollIntoView = true;
        me.renderRowsWithAnimation(record);
    }

    /**
     * Tells the RowExpander that the provided record should be collapsed. If the record is in view, it will be
     * collapsed. If the record is not in view, it will simply not be expanded when rendered into view.
     *
     * @param {Core.data.Model} record Record whose row should be collapsed
     * @category Common
     */
    async collapse(record) {
        const me = this;
        if (me.disabled) {
            return;
        }

        if (await me.trigger('beforeCollapse', { record }) === false) {
            return;
        }
        me.recordStateMap.delete(record);
        me.collapsingRecords.add(record);
        me.renderRowsWithAnimation(record);
    }
    //endregion
}

GridFeatureManager.registerFeature(RowExpander);
