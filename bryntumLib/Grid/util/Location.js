import Widget from '../../Core/widget/Widget.js';

/**
 * @module Grid/util/Location
 */

/**
 * This class encapsulates a reference to a specific navigable grid location.
 *
 * This encapsulates a grid cell based upon the record and column, but in addition, it could represent
 * an actionable location *within a cell** if the {@link #property-target} is not the grid cell in
 * question.
 *
 * A Location is immutable. That is, once instantiated, the record and column which it references
 * cannot be changed. The {@link #function-move} method returns a new instance.
 *
 * A `Location` that encapsulates a cell within the body of a grid will have the following
 * read-only properties:
 *
 *  - grid        : `Grid` The Grid that owns the Location.
 *  - record      : `Model` The record of the row that owns the Location. (`null` if the header).
 *  - rowIndex    : `Number` The zero-based index of the row that owns the Location. (-1 means the header).
 *  - column      : `Column` The Column that owns the Location.
 *  - columnIndex : `Number` The zero-based index of the column that owns the Location.
 *  - cell        : `HTMLElement` The referenced cell element.
 *  - target      : `HTMLElement` The focusable element. This may be the cell, or a child of the cell.
 *
 * If the location is a column *header*, the `record` will be `null` and the `rowIndex` will be `-1`.
 *
 */
export default class Location {
    /**
     * The grid which this Location references.
     * @config {Grid.view.Grid} grid
     */
    /**
     * The record which this Location references. (unless {@link #config-rowIndex} is used to configure)
     * @config {Core.data.Model} record
     */
    /**
     *
     * The row index which this Location references. (unless {@link #config-record} is used to configure).
     *
     * `-1` means the header row, in which case the {@link #config-record} will be `null`.
     * @config {Number} rowIndex
     */
    /**
     * The Column which this location references. (unless {@link #config-columnIndex} or {@link #config-columnId} is used to configure)
     * @config {Grid.column.Column} column
     */
    /**
     * The column id which this location references. (unless {@link #config-column} or {@link #config-columnIndex} is used to configure)
     * @config {String|Number} columnId
     */
    /**
     * The column index which this location references. (unless {@link #config-column} or {@link #config-columnId} is used to configure)
     * @config {Number} columnIndex
     */
    /**
     * The field of the column index which this location references. (unless another column identifier is used to configure)
     * @config {String} field
     */

    /**
     * Initializes a new Location.
     * @param {Object|HTMLElement} location A grid location specifier. This may be:
     *  * An element inside a grid cell or a grid cell.
     *  * An object identifying a cell location using the following properties:
     *    * grid
     *    * record
     *    * rowIndex
     *    * column
     *    * columnIndex
     * @function constructor
     */
    constructor(location) {
        // Private usage of init means that we can create an un attached Location
        // The move method does this.
        if (location) {
            // They passed us a Location, so they already know where to go.
            if (location.isLocation) {
                return location;
            }

            // Passed a DOM node.
            if (location.nodeType === Node.ELEMENT_NODE) {
                const
                    grid = Widget.fromElement(location, 'gridbase'),
                    cell = grid && location.closest(grid.focusableSelector);

                // We are targeted on, or within a cell.
                if (cell) {
                    const { dataset } = cell.parentNode;

                    this.init({
                        grid,

                        // A .b-grid-row will have a data-index
                        // If it' a column header, we use rowIndex -1
                        rowIndex : grid.store.includes(dataset.id) ? grid.store.indexOf(dataset.id) : (dataset.index || -1),
                        columnId : cell.dataset.columnId
                    });
                }
            }
            else {
                this.init(location);
            }
        }
    }

    init(config) {
        const me = this;


        const
            grid               = me.grid = config.grid,
            { store, columns } = grid,
            { visibleColumns } = columns;

        // If we have a target. This is usually only for actionable locations.
        if (config.target) {
            me.actionTargets = [me._target = config.target];
        }

        // Determine our record and rowIndex
        if (config.record) {
            me._id = config.record.id;
        }
        else if ('id' in config) {
            me._id = config.id;

            // Null means that the Location is in the grid header, so rowIndex -1
            if (config.id == null) {
                me._rowIndex = -1;
            }
        }
        else {
            const rowIndex = !isNaN(config.row) ? config.row : !isNaN(config.rowIndex) ? config.rowIndex : NaN;

            me._rowIndex = Math.max(Math.min(Number(rowIndex), store.count - 1), grid.hideHeaders ? 0 : -1);
            me._id = store.getAt(me._rowIndex)?.id;
        }
        if (!('_rowIndex' in me)) {
            me._rowIndex = store.indexOf(me.id);
        }

        // Cache value that we use now. We do not hold a reference to a record
        me.isSpecialRow = me.record?.isSpecialRow;

        // Determine our column and columnIndex
        if ('columnId' in config) {
            me._column = columns.getById(config.columnId);
        }
        else if ('field' in config) {
            me._column = columns.get(config.field);
        }
        else {
            const columnIndex = !isNaN(config.column) ? config.column : !isNaN(config.columnIndex) ? config.columnIndex : NaN;

            if (!isNaN(columnIndex)) {
                me._columnIndex = Math.min(Number(columnIndex), visibleColumns.length - 1);
                me._column = visibleColumns[me._columnIndex];
            }
            // Fall back to using 'column' property either as index or the Column.
            // If no column property, use column zero.
            else {
                me._column = ('column' in config) ? isNaN(config.column) ? config.column : visibleColumns[config.column] : visibleColumns[0];
            }
        }
        if (!('_columnIndex' in me)) {
            me._columnIndex = visibleColumns.indexOf(me._column);
        }
    }

    // Class identity indicator. Usually added by extending Base, but we don't do that for perf.
    get isLocation() {
        return true;
    }

    equals(other) {
        return other?.isLocation &&
            other.grid   === this.grid &&
            other.record === this.record &&
            other.column === this.column &&
            other.target === this.target;
    }

    /**
     * Yields the row index of this location.
     * @property {Number}
     * @readonly
     */
    get rowIndex() {
        const
            { _id }   = this,
            { store } = this.grid;

        // Return the up to date row index for our record
        return store.includes(_id) ? store.indexOf(_id) : Math.min(this._rowIndex, store.count - 1);
    }

    /**
     * Used by GridNavigation.
     * @private
     */
    get visibleRowIndex() {
        const
            { rowManager } = this.grid,
            { rowIndex }   = this;

        return rowIndex === -1 ? rowIndex : Math.max(Math.min(rowIndex, rowManager.lastFullyVisibleTow.dataIndex), rowManager.firstFullyVisibleTow.dataIndex);
    }

    /**
     * Yields `true` if the cell and row are selectable.
     *
     * That is if the record is present in the grid's store and it's not a group summary or group header record.
     * @property {Boolean}
     * @readonly
     */
    get isSelectable() {
        return this.grid.store.includes(this._id) && !this.isSpecialRow;
    }

    get record() {
        // -1 means the header row
        if (this._rowIndex > -1) {
            const { store } = this.grid;

            // Location's record no longer in store; fall back to record at same index.
            if (!store.includes(this._id)) {
                return store.getAt(this._rowIndex);
            }

            return store.getById(this._id);
        }
    }

    get id() {
        return this._id;
    }

    get column() {
        const { visibleColumns } = this.grid.columns;

        // Location's column no longer visible; fall back to column at same index.
        if (!visibleColumns?.includes(this._column)) {
            return visibleColumns?.[this.columnIndex];
        }

        return this._column;
    }

    get columnId() {
        return this.column?.id;
    }

    get columnIndex() {
        return Math.min(this._columnIndex, this.grid.columns.visibleColumns?.length - 1);
    }

    /**
     * Returns a __*new *__ `Location` instance having moved from the current location in the
     * mode specified.
     * @param {Number} where Where to move from this Location. May be:
     *
     *  - `Location.UP`
     *  - `Location.NEXT_CELL`
     *  - `Location.DOWN`
     *  - `Location.PREV_CELL`
     *  - `Location.FIRST_COLUMN`
     *  - `Location.LAST_COLUMN`
     *  - `Location.FIRST_CELL`
     *  - `Location.LAST_CELL`
     *  - `Location.PREV_PAGE`
     *  - `Location.NEXT_PAGE`
     * @returns {Grid.util.Location} A Location object encapsulating the target location.
     */
    move(where) {
        const
            me        = this,
            {
                record,
                column,
                grid
            }         = me,
            { store } = grid,
            columns   = grid.columns.visibleColumns,
            result    = new Location();

        let rowIndex    = store.includes(record)   ? store.indexOf(record)   : me.rowIndex,
            columnIndex = columns.includes(column) ? columns.indexOf(column) : me.columnIndex;

        const
            rowMin        = grid.hideHeaders ? 0 : -1,
            rowMax        = store.count - 1,
            colMax        = columns.length - 1,
            atFirstRow    = rowIndex === rowMin,
            atLastRow     = rowIndex === rowMax,
            atFirstColumn = columnIndex === 0,
            atLastColumn  = columnIndex === colMax;

        switch (where) {
            case Location.PREV_CELL:
                if (atFirstColumn) {
                    if (!atFirstRow) {
                        columnIndex = colMax;
                        rowIndex--;
                    }
                }
                else {
                    columnIndex--;
                }
                break;
            case Location.NEXT_CELL:
                if (atLastColumn) {
                    if (!atLastRow) {
                        columnIndex = 0;
                        rowIndex++;
                    }
                }
                else {
                    columnIndex++;
                }
                break;
            case Location.UP:
                if (!atFirstRow) {
                    rowIndex--;
                }
                break;
            case Location.DOWN:
                if (!atLastRow) {
                    // From the col header, we drop to the topmost fully visible row.
                    if (rowIndex === -1) {
                        rowIndex = grid.rowManager.firstFullyVisibleRow.dataIndex;
                    }
                    else {
                        rowIndex++;
                    }
                }
                break;
            case Location.FIRST_COLUMN:
                columnIndex = 0;
                break;
            case Location.LAST_COLUMN:
                columnIndex = colMax;
                break;
            case Location.FIRST_CELL:
                rowIndex = rowMin;
                columnIndex = 0;
                break;
            case Location.LAST_CELL:
                rowIndex = rowMax;
                columnIndex = colMax;
                break;
            case Location.PREV_PAGE:
                rowIndex = Math.max(rowMin, rowIndex - Math.floor(grid.scrollable.clientHeight / grid.rowHeight));
                break;
            case Location.NEXT_PAGE:
                rowIndex = Math.min(rowMax, rowIndex + Math.floor(grid.scrollable.clientHeight / grid.rowHeight));
                break;
        }

        // Set the calculated coordinates in the result.
        result.init({
            grid,
            rowIndex,
            columnIndex
        });

        return result;
    }

    /**
     * The cell DOM element which this Location references.
     * @property {HTMLElement}
     * @readonly
     */
    get cell() {
        const
            me = this,
            {
                grid,
                id,
                _cell
            }  = me;

        // Property value set
        if (_cell) {
            return _cell;
        }

        // On a header cell
        if (id == null) {
            return grid.columns.getById(me.columnId)?.element;
        }
        else {
            const { row } = me;

            if (row) {
                return row.getCell(me.columnId) || row.getCell(grid.columns.getAt(me.columnIndex)?.id);
            }
        }
    }

    get row() {
        // Use our record ID by preference, but fall back to our row index if not present
        return this.grid.getRowById(this.id) || this.grid.getRow(this.rowIndex);
    }

    /**
     * The DOM element which encapsulates the focusable target of this Location.
     *
     * This is usually the {@link #property-cell}, but if this is an actionable location, this
     * may be another DOM element within the cell.
     * @property {HTMLElement}
     * @readonly
     */
    get target() {
        const
            { cell, _target }   = this,
            { focusableFinder } = this.grid;

        // We might be asked for our focusElement before we're fully rendered and painted.
        if (cell) {
            // Location was created in disableActionable mode with the target
            // explicitly directed to the cell.
            if (_target) {
                return _target;
            }
            focusableFinder.currentNode = this.grid.focusableFinderCell = cell;

            return focusableFinder.nextNode() || cell;
        }
    }

    /**
     * This property is `true` if the focus target is not the cell itself.
     * @property {Boolean}
     * @readonly
     */
    get isActionable() {
        // The actual target may be inside the cell, or just positioned to *appear* inside the cell
        // such as event/task rendering.
        return Boolean(this.target && this.target !== this.cell);
    }

    /**
     * This property is `true` if this location represents a column header.
     * @property {Boolean}
     * @readonly
     */
    get isColumnHeader() {
        return this.cell && this.rowIndex === -1;
    }

    /**
     * This property is `true` if this location represents a cell in the grid body.
     * @property {Boolean}
     * @readonly
     */
    get isCell() {
        return this.cell && this.record;
    }
}

Location.UP           = 1;
Location.NEXT_CELL    = 2;
Location.DOWN         = 3;
Location.PREV_CELL    = 4;
Location.FIRST_COLUMN = 5;
Location.LAST_COLUMN  = 6;
Location.FIRST_CELL   = 7;
Location.LAST_CELL    = 8;
Location.PREV_PAGE    = 9;
Location.NEXT_PAGE    = 10;
