import Base from '../../Core/Base.js';
import DomDataStore from '../../Core/data/DomDataStore.js';
import ArrayHelper from '../../Core/helper/ArrayHelper.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import DomSync from '../../Core/helper/DomSync.js';
import DomClassList from '../../Core/helper/util/DomClassList.js';
import Location from '../util/Location.js';
import Rectangle from '../../Core/helper/util/Rectangle.js';

/**
 * @module Grid/row/Row
 */

const cellContentRange     = document.createRange();

/**
 * Represents a single rendered row in the grid. Consists of one row element for each SubGrid in use. The grid only
 * creates as many rows as needed to fill the current viewport (and a buffer). As the grid scrolls
 * the rows are repositioned and reused, there is not a one-to-one relation between rows and records.
 *
 * For normal use cases you should not have to use this class directly. Rely on using renderers instead.
 * @extends Core/Base
 */
export default class Row extends Base {

    static $name = 'Row';

    static get configurable() {
        return {
            /**
             * When __read__, this a {@link Core.helper.util.DomClassList DomClassList} of class names to be
             * applied to this Row's elements.
             *
             * It can be __set__ using Object notation where each property name with a truthy value is added as
             * a class, or as a regular space-separated string.
             *
             * @member {Core.helper.util.DomClassList} cls
             * @accepts {Core.helper.util.DomClassList|Object}
             */
            /**
             * The class name to initially add to all row elements
             * @config {String|Core.helper.util.DomClassList|Object}
             */
            cls : {
                $config : {
                    equal : (c1, c2) => c1?.isDomClassList && c2?.isDomClassList && c1.isEqual(c2)
                }
            }
        };
    }

    //region Init

    /**
     * Constructs a Row setting its index.
     * @param {Object} config A configuration object which must contain the following two properties:
     * @param {Grid.view.Grid} config.grid The owning Grid.
     * @param {Grid.row.RowManager} config.rowManager The owning RowManager.
     * @param {Number} config.index The index of the row within the RowManager's cache.
     * @function constructor
     * @internal
     */
    construct(config) {
        // Set up defaults and properties
        Object.assign(this, {
            _elements      : {},
            _elementsArray : [],
            _cells         : {},
            _allCells      : [],
            _regions       : [],
            lastHeight     : 0,
            lastTop        : -1,
            _dataIndex     : 0,
            _top           : 0,
            _height        : 0,
            _id            : null,
            forceInnerHTML : false,
            isGroupFooter  : false,
            // Create our cell rendering context
            cellContext    : new Location({
                grid        : config.grid,
                id          : null,
                columnIndex : 0
            })
        });

        super.construct(config);
    }

    doDestroy() {
        const me = this;

        // No need to clean elements up if the entire thing is being destroyed
        if (!me.rowManager.isDestroying) {
            me.removeElements();

            if (me.rowManager.idMap[me.id] === me) {
                delete me.rowManager.idMap[me.id];
            }

        }

        super.doDestroy();
    }

    //endregion

    //region Data getters/setters

    /**
     * Get index in RowManagers rows array
     * @property {Number}
     * @readonly
     */
    get index() {
        return this._index;
    }

    set index(index) {
        this._index = index;
    }

    /**
     * Get/set this rows current index in grids store
     * @property {Number}
     */
    get dataIndex() {
        return this._dataIndex;
    }

    set dataIndex(dataIndex) {
        if (this._dataIndex !== dataIndex) {
            this._dataIndex = dataIndex;
            this.eachElement(element => {
                element.dataset.index = dataIndex;
                element.ariaRowIndex  = this.grid.hideHeaders ? dataIndex + 1 : dataIndex + 2;
            });
        }
    }

    /**
     * Get/set id for currently rendered record
     * @property {String|Number}
     */
    get id() {
        return this._id;
    }

    set id(id) {
        const
            me    = this,
            idObj = { id },
            idMap = me.rowManager.idMap;

        if (me._id !== id || idMap[id] !== me) {
            if (idMap[me._id] === me) delete idMap[me._id];
            idMap[id] = me;

            me._id = id;
            me.eachElement(element => {
                DomDataStore.assign(element, idObj);
                element.dataset.id = id;
            });
            me.eachCell(cell => DomDataStore.assign(cell, idObj));
        }
    }

    //endregion

    //region Row elements

    /**
     * Add a row element for specified region.
     * @param {String} region Region to add element for
     * @param {HTMLElement} element Element
     * @private
     */
    addElement(region, element) {
        const me = this;

        let cellElement = element.firstElementChild;

        me._elements[region] = element;
        me._elementsArray.push(element);
        me._regions.push(region);
        DomDataStore.assign(element, { index : me.index });

        me._cells[region] = [];

        while (cellElement) {
            me._cells[region].push(cellElement);
            me._allCells.push(cellElement);

            DomDataStore.set(cellElement, {
                column     : cellElement.dataset.column, // TODO: dataset is slow, read from columnstore using index instead
                columnId   : cellElement.dataset.columnId,
                rowElement : cellElement.parentNode,
                row        : me
            });

            cellElement = cellElement.nextElementSibling;
        }

        // making css selectors simpler, dataset has bad performance but it is only set once and never read
        element.dataset.index = me.index;
        element.ariaRowIndex  = me.grid.hideHeaders ? me.index + 1 : me.index + 2;
    }

    /**
     * Get the element for the specified region.
     * @param {String} region
     * @returns {HTMLElement}
     */
    getElement(region) {
        return this._elements[region];
    }

    /**
     * Get the {@link Core.helper.util.Rectangle element bounds} for the specified region of this Row.
     * @param {String} region
     * @returns {Core.helper.util.Rectangle}
     */
    getRectangle(region) {
        return Rectangle.from(this.getElement(region));
    }

    /**
     * Execute supplied function for each regions element.
     * @param {Function} fn
     */
    eachElement(fn) {
        this._elementsArray.forEach(fn);
    }

    /**
     * Execute supplied function for each cell.
     * @param {Function} fn
     */
    eachCell(fn) {
        this._allCells.forEach(fn);
    }

    /**
     * Row elements (one for each region)
     * @type {HTMLElement[]}
     * @readonly
     */
    get elements() {
        return this._elements;
    }

    /**
     * The row element, only applicable when not using multiple grid sections (see {@link #property-elements})
     * @type {HTMLElement}
     * @readonly
     */
    get element() {
        const region = Object.keys(this._elements)[0];

        return this._elements[region];
    }

    //endregion

    //region Cell elements

    /**
     * Row cell elements
     * @property {HTMLElement[]}
     * @readonly
     */
    get cells() {
        return this._allCells;
    }

    /**
     * Get cell elements for specified region.
     * @param {String} region Region to get elements for
     * @returns {HTMLElement[]} Array of cell elements
     */
    getCells(region) {
        return this._cells[region];
    }

    /**
     * Get the cell element for the specified column.
     * @param {String|Number} columnId Column id
     * @returns {HTMLElement} Cell element
     */
    getCell(columnId) {
        return this._allCells.find(cell => {
            const cellData = DomDataStore.get(cell);
            // cellData will always have String type, use == to handle a column with Number type
            return cellData.columnId == columnId || cellData.column == columnId;
        });
    }

    removeElements(onlyRelease = false) {
        const me = this;

        // Triggered before the actual remove to allow cleaning up elements etc.
        me.rowManager.trigger('removeRow', { row : me });

        if (!onlyRelease) {
            me.eachElement(element => element.remove());
        }
        me._elements = {};
        me._cells = {};
        me._elementsArray.length = me._regions.length = me._allCells.length = me.lastHeight = me.height = 0;
        me.lastTop = -1;
    }

    //endregion

    //region Height

    /**
     * Get/set row height
     * @property {Number}
     */
    get height() {
        return this._height;
    }

    set height(height) {
        this._height = height;
    }

    /**
     * Get row height including border
     * @property {Number}
     */
    get offsetHeight() {
        // me.height is specified height, add border height to it to get cells height to match specified rowHeight
        // border height is measured in Grid#get rowManager
        return this.height + this.grid._rowBorderHeight;
    }

    /**
     * Sync elements height to rows height
     * @private
     */
    updateElementsHeight() {
        const me = this;
        me.rowManager.storeKnownHeight(me.id, me.height);
        // prevent unnecessary style updates
        if (me.lastHeight !== me.height) {
            this.eachElement(element => element.style.height = `${me.offsetHeight}px`);
            me.lastHeight = me.height;
        }
    }

    //endregion

    //region CSS

    /**
     * Add CSS classes to each element.
     * @param {...String|Object|Core.helper.util.DomClassList} classes
     */
    addCls(classes) {
        this.updateCls(this.cls.add(classes));
    }

    /**
     * Remove CSS classes from each element.
     * @param {...String|Object|Core.helper.util.DomClassList} classes
     */
    removeCls(classes) {
        this.updateCls(this.cls.remove(classes));
    }

    /**
     * Toggle CSS classes for each element.
     * @param {Object|Core.helper.util.DomClassList|...String} classes
     * @param {Boolean} add
     * @internal
     */
    toggleCls(classes, add) {
        this.updateCls(this.cls[add ? 'add' : 'remove'](classes));
    }

    /**
     * Adds/removes class names according to the passed object's properties.
     *
     * Properties with truthy values are added.
     * Properties with false values are removed.
     * @param {Object} classes Object containing properties to set/clear
     */
    assignCls(classes) {
        this.updateCls(this.cls.assign(classes));
    }

    changeCls(cls) {
        return cls?.isDomClassList ? cls : new DomClassList(cls);
    }

    updateCls(cls) {
        this.eachElement(element => DomHelper.syncClassList(element, cls));
    }

    setAttribute(attribute, value) {
        this.eachElement(element => element.setAttribute(attribute, value));
    }

    removeAttribute(attribute) {
        this.eachElement(element => element.removeAttribute(attribute));
    }

    //endregion

    //region Position

    /**
     * Is this the very first row?
     * @property {Boolean}
     * @readonly
     */
    get isFirst() {
        return this.dataIndex === 0;
    }

    /**
     * Row top coordinate
     * @property {Number}
     * @readonly
     */
    get top() {
        return this._top;
    }

    /**
     * Row bottom coordinate
     * @property {Number}
     * @readonly
     */
    get bottom() {
        return this._top + this._height + this.grid._rowBorderHeight;
    }

    /**
     * Sets top coordinate, translating elements position.
     * @param {Number} top Top coordinate
     * @param {Boolean} [silent] Specify `true` to not trigger translation event
     * @internal
     */
    setTop(top, silent) {
        if (this._top !== top) {
            this._top = top;
            this.translateElements(silent);
        }
    }

    /**
     * Sets bottom coordinate, translating elements position.
     * @param {Number} bottom Bottom coordinate
     * @param {Boolean} [silent] Specify `true` to not trigger translation event
     * @private
     */
    setBottom(bottom, silent) {
        this.setTop(bottom - this.offsetHeight, silent);
    }

    /**
     * Sets css transform to position elements at correct top position (translateY)
     * @private
     */
    translateElements(silent) {
        const
            me           = this,
            positionMode = me.grid.positionMode;

        if (me.lastTop !== me.top) {
            me.eachElement(element => {
                const style = element.style;

                if (positionMode === 'translate') {
                    style.transform = `translate(0,${me.top}px)`;
                }
                else if (positionMode === 'translate3d') {
                    style.transform = `translate3d(0,${me.top}px,0)`;
                }
                else if (positionMode === 'position') {
                    style.top = `${me.top}px`;
                }
            });

            if (!silent) {
                me.rowManager.trigger('translateRow', { row : me });
            }

            me.lastTop = me.top;
        }
    }

    /**
     * Moves all row elements up or down and updates model.
     * @param {Number} offsetTop Pixels to offset the elements
     * @private
     */
    offset(offsetTop) {
        let newTop = this._top + offsetTop;

        // Not allowed to go below zero (won't be reachable on scroll in that case)
        if (newTop < 0) {
            offsetTop -= newTop;
            newTop = 0;
        }
        this.setTop(newTop);
        return offsetTop;
    }

    //endregion

    //region Render

    /**
     * Renders a record into this rows elements (trigger event that subgrids catch to do the actual rendering).
     * @param {Number} recordIndex
     * @param {Core.data.Model} record
     * @param {Boolean} [updatingSingleRow]
     * @param {Boolean} [batch]
     * @private
     */
    render(recordIndex, record, updatingSingleRow = true, batch = false) {
        const
            me        = this,
            {
                cellContext,
                cls,
                elements,
                cells,
                grid,
                rowManager,
                height         : oldHeight,
                _id            : oldId
            }             = me,
            rowElData     = DomDataStore.get(me._elementsArray[0]),
            rowHeight     = rowManager._rowHeight,
            { store }     = grid,
            { isTree }    = store;

        let i = 0,
            size;

        // no record specified, try looking up in store (false indicates empty row, don't do lookup
        if (!record && record !== false) {
            record = grid.store.getById(rowElData.id);
            recordIndex = grid.store.indexOf(record);
        }

        // Bail out if record is not resolved
        // TODO this happens when resource changes its id
        // covered w/ 13_view_update.t.js and 14_crudmanager_sharing.t.js in Scheduler
        if (!record) {
            return;
        }

        // Now we have acquired a record, see what classes it requires on the
        const
            rCls          = record?.cls,
            recordCls     = rCls ? (rCls.isDomClassList ? rCls : new DomClassList(rCls)) : null;

        cls.assign({
            'b-grid-row-updating' : updatingSingleRow && grid.transitionDuration,
            'b-selected'          : grid.isSelected(record?.id),
            'b-readonly'          : record.readOnly
        });

        // These are DomClassLists, so they have to have their properties processed by add/remove
        if (me.lastRecordCls) {
            cls.remove(me.lastRecordCls);
        }

        // Assign our record's cls to the row, and cache the value so it can be removed next time round
        if (recordCls) {
            cls.add(recordCls);
            me.lastRecordCls = Object.assign({}, recordCls);
        }
        else {
            me.lastRecordCls = null;
        }

        // used by GroupSummary feature to clear row before
        rowManager.trigger('beforeRenderRow', { row : me, record, recordIndex, oldId });

        grid.beforeRenderRow({ row : me, record, recordIndex, oldId });

        // Flush any changes to our DomClassList to the Row's DOM
        me.updateCls(cls);

        if (updatingSingleRow && grid.transitionDuration) {
            grid.setTimeout(() => {
                if (!me.isDestroyed) {
                    cls.remove('b-grid-row-updating');
                    me.updateCls(cls);
                }
            }, grid.transitionDuration);
        }

        me.id = record.id;
        me.dataIndex = recordIndex;


        // Configured height, used as row height if renderers do not specify otherwise
        const height = (!grid.fixedRowHeight && grid.getRowHeight(record)) || rowHeight;

        // Max height returned by renderers
        let maxRequestedHeight = me.maxRequestedHeight = null;

        // Keep ARIA ownership up to date
        if (isTree) {
            for (const region in elements) {
                const el = elements[region];

                el.id = `${grid.id}-${region}-${me.id}`;
                DomHelper.setAttributes(el, {
                    'aria-level'    : record.childLevel + 1,
                    'aria-setsize'  : record.parent.children.length,
                    'aria-posinset' : record.parentIndex + 1
                });

                if (record.isExpanded(store)) {
                    DomHelper.setAttributes(el, {
                        'aria-expanded' : true,
                        // A branch node may be configured expanded, but yet have no children.
                        // They may be added dynamically.
                        'aria-owns'     : record.children?.length ? record.children?.map(r => `${grid.id}-${region}-${r.id}`).join(' ') : null
                    });
                }
                else {
                    if (record.isLeaf) {
                        el.removeAttribute('aria-expanded');
                    }
                    else {
                        el.setAttribute('aria-expanded', false);
                    }
                    el.removeAttribute('aria-owns');
                }
            }
        }

        cellContext._record   = record;
        cellContext._id       = record.id;
        cellContext._rowIndex = recordIndex;

        for (i = 0; i < cells.length; i++) {
            cellContext._columnId          = cells[i].dataset.columnId;
            cellContext._column            = grid.columns.getById(cellContext._columnId);
            cellContext._columnIndex       = i;
            cellContext._cell              = cells[i];
            cellContext.height             = height;
            cellContext.maxRequestedHeight = maxRequestedHeight;
            cellContext.updatingSingleRow  = updatingSingleRow;

            size = me.renderCell(cellContext);

            if (!rowManager.fixedRowHeight) {
                // We want to make row in all regions as high as the highest cell
                if (size.height != null) {
                    maxRequestedHeight = Math.max(maxRequestedHeight, size.height);

                    // Do not store a max height set by schedulers rendering, it has to base its layouts on the
                    // original row height / that returned by other cells
                    if (!size.transient) {
                        me.maxRequestedHeight = maxRequestedHeight;
                    }
                }
            }
        }
        const useHeight = maxRequestedHeight ?? height;
        me.height = grid.processRowHeight(record, useHeight) ?? useHeight;

        // Height gets set during render, reflect on elements
        me.updateElementsHeight();

        // Rerendering a row might change its height, which forces translation of all following rows
        if (updatingSingleRow) {
            if (oldHeight !== me.height) {
                rowManager.translateFromRow(me, batch);
            }
            rowManager.trigger('updateRow', { row : me, record, recordIndex, oldId });
            rowManager.trigger('renderDone');
        }

        grid.afterRenderRow({ row : me, record, recordIndex, oldId, oldHeight });

        rowManager.trigger('renderRow', { row : me, record, recordIndex, oldId });

        if (oldHeight && me.height !== oldHeight) {
            rowManager.trigger('rowRowHeight',  { row : me, record, height : me.height, oldHeight });
        }

        me.forceInnerHTML = false;
    }

    /**
     * Renders a single cell, calling features to allow them to hook
     * @param {Grid.util.Location|HTMLElement} cellContext A {@link Grid.util.Location} which contains rendering
     * options, or a cell element which can be used to initialize a {@link Grid.util.Location}
     * @param {Number} [cellContext.height] Configured row height
     * @param {Number} [cellContext.maxRequestedHeight] Maximum proposed row height from renderers
     * @param {Boolean} [cellContext.updatingSingleRow] Rendered as part of updating a single row
     * @param {Boolean} [cellContext.isMeasuring] Rendered as part of a measuring operation
     * @private
     */
    renderCell(cellContext) {
        if (!cellContext.isLocation) {
            cellContext = new Location(cellContext);
        }

        let {
            cell : cellElement,
            record
        } = cellContext;

        const
            me              = this,
            {
                grid,
                column,
                height,
                maxRequestedHeight,
                updatingSingleRow = true,
                isMeasuring = false
            }               = cellContext,
            cellEdit        = grid.features?.cellEdit,
            cellElementData = DomDataStore.get(cellElement),
            rowElement      = cellElementData.rowElement,
            rowElementData  = DomDataStore.get(rowElement);

        if (!record) {
            record = cellContext.record = grid.store.getById(rowElementData.id);

            if (!record) {
                return;
            }
        }

        let cellContent   = column.getRawValue(record);

        const
            dataField    = record.fieldMap[column.field],
            size         = { configuredHeight : height, height : null, maxRequestedHeight },
            cellCls      = column.getCellClass(cellContext),
            rendererData = {
                cellElement,
                dataField,
                rowElement,
                value : cellContent,
                record,
                column,
                size,
                grid,
                row   : cellElementData.row,
                updatingSingleRow,
                isMeasuring
            },
            useRenderer  = column.renderer || column.defaultRenderer;

        // Hook to allow processing cell before render, used by QuickFind & MergeCells
        grid.beforeRenderCell(rendererData);

        // Allow hook to redirect cell output
        if (rendererData.cellElement !== cellElement) {
            // Render to redirected target
            cellElement = rendererData.cellElement;
        }

        DomHelper.syncClassList(cellElement, cellCls);

        let shouldSetContent = true;

        // By default, `cellContent` is raw value extracted from Record based on Column field.
        // Call `renderer` if present, otherwise set innerHTML directly.
        if (useRenderer) {
            // `cellContent` could be anything here:
            // - null
            // - undefined when nothing is returned, used when column modifies cell content, for example Widget column
            // - number as cell value, to be converted to string
            // - string as cell value
            // - string which contains custom DOM element which is handled by Angular after we render it as cell value
            // - object with special $$typeof property equals to Symbol(react.element) handled by React when JSX is returned
            // - object which has no special properties but understood by Vue because the column is marked as "Vue" column
            // - object that should be passed to the `DomSync.sync` to update the cell content
            cellContent = useRenderer.call(column, rendererData);

            if (cellContent === undefined) {
                shouldSetContent = false;
            }
        }
        else if (dataField) {
            cellContent = dataField.print(cellContent);
        }

        // Check if the cell content is going to be rendered by framework
        const hasFrameworkRenderer = grid.hasFrameworkRenderer?.({ cellContent, column });

        // This is exceptional case, using framework rendering while grouping is not supported.
        // Need to reset the content in case of JSX is returned from the renderer.
        // Normally, if a renderer returns some content, the Grouping feature will overwrite it with the grouped value.
        // But useRenderer cannot be ignored completely, since a column might want to render additional content to the
        // grouped row. For example, Action Column may render an action button the grouped row.
        if (hasFrameworkRenderer && record.isSpecialRow) {
            cellContent = '';
        }

        // If present, framework may decide if it wants our renderer to prerender the cell content or not.
        // In case of normal cells in flat grids, React and Vue perform the full rendering into the root cell element.
        // But in case of tree cell in tree grids, React and Vue require our renderer to prerender internals,
        // and they perform rendering into inner "b-tree-cell-value" element. This way we can see our expand controls,
        // bullets, etc.
        const frameworkPerformsFullRendering = hasFrameworkRenderer && !column.data.tree && !record.isSpecialRow;

        // `shouldSetContent` false means content is already set by the column (i.e. Widget column).
        // `frameworkPerformsFullRendering` true means full cell content is set by framework renderer.
        if (shouldSetContent && !frameworkPerformsFullRendering) {
            let renderTarget = cellElement;

            // If the cell is being edited, we render to a separate div and carefully
            // insert the contents into a Range which excludes the editor.
            if (cellEdit?.editorContext?.equals(cellContext) && !cellEdit.editor.isFinishing) {
                renderTarget = me.moveContentFromCell(cellElement, cellEdit.editor.element);
            }

            const
                hasObjectContent = cellContent != null && typeof cellContent === 'object',
                hasStringContent = typeof cellContent === 'string',
                text             = (hasObjectContent || cellContent == null) ? '' : String(cellContent);

            // row might be flagged by GroupSummary to require full "redraw"
            if (me.forceInnerHTML) {
                // To allow minimal updates below, we must remove custom markup inserted by the GroupSummary feature
                renderTarget.innerHTML = '';
                // Delete cached content value
                delete renderTarget._content;

                cellElement.lastDomConfig = null;
            }

            // display cell contents as text or use actual html?
            // (disableHtmlEncode set by features that decorate cell contents)
            if (!hasObjectContent && column.htmlEncode && !column.disableHtmlEncode) {
                // Set innerText if cell currently has html content.
                if (cellElement._hasHtml) {
                    renderTarget.innerText = text;
                    cellElement._hasHtml = false;
                }
                else {
                    DomHelper.setInnerText(renderTarget, text);
                }
            }
            else {
                if (column.autoSyncHtml && (!hasStringContent || DomHelper.getChildElementCount(renderTarget))) {
                    // String content in html column is handled as a html template string
                    if (hasStringContent) {
                        // update cell with only changed attributes etc.
                        DomHelper.sync(text, renderTarget.firstElementChild);
                    }
                    // Other content is considered to be a DomHelper config object
                    else if (hasObjectContent) {
                        DomSync.sync({
                            domConfig     : cellContent,
                            targetElement : renderTarget
                        });
                    }
                }
                // Consider all returned plain objects to be DomHelper configs for cell content
                else if (hasObjectContent) {
                    DomSync.sync({
                        targetElement : renderTarget,
                        domConfig     : {
                            onlyChildren : true,
                            children     : ArrayHelper.asArray(cellContent)
                        }
                    });
                }
                // Apply text as innerHTML only if it has changed
                else if (renderTarget._content !== text) {
                    renderTarget.innerHTML = renderTarget._content = text;
                }
            }

            // If we had to render to a separate div to avoid the cell editor, insert the result now.
            if (renderTarget !== cellElement) {
                const { firstChild } = cellElement;
                for (const node of renderTarget.childNodes) {
                    cellElement.insertBefore(node, firstChild);
                }
            }
        }

        // If present, framework renders content into the cell element.
        // Ignore special rows, like grouping.
        if (!record.isSpecialRow) {
            // processCellContent is implemented in the framework wrappers
            grid.processCellContent?.({
                cellElementData,
                rendererData,
                // In case of TreeColumn we should prerender inner cell content like expand controls, bullets, etc
                // Then the framework renders the content into the nested "b-tree-cell-value" element.
                // rendererHtml is set in TreeColumn.treeRenderer
                rendererHtml : rendererData.rendererHtml || cellContent
            });
        }

        if (column.autoHeight && size.height == null) {
            cellElement.classList.add('b-measuring-auto-height');

            // Shrinkwrap autoHeight must not allow a row's height to drop below the configured row height
            size.height = Math.max(cellElement.offsetHeight, grid.rowHeight);

            cellElement.classList.remove('b-measuring-auto-height');
        }

        if (!isMeasuring) {
            // Allow others to affect rendering
            me.rowManager.trigger('renderCell', rendererData);
        }

        return size;
    }

    //#region Hooks for salesforce

    moveContentFromCell(cellElement, editorElement) {
        cellContentRange.setStart(cellElement, 0);
        cellContentRange.setEndBefore(editorElement);

        const renderTarget = document.createElement('div');

        renderTarget.appendChild(cellContentRange.extractContents());

        return renderTarget;
    }

    //#endregion

//endregion
}

Row.initClass();
