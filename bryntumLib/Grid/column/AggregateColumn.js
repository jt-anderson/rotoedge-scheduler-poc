import ColumnStore from '../data/ColumnStore.js';
import NumberColumn from './NumberColumn.js';

/**
 * @module Grid/column/AggregateColumn
 */

/**
 * A column, which, when used as part of a {@link Grid.view.TreeGrid}, aggregates the values of this column's descendants using
 * a configured function which defaults to `sum`. The aggregate value is re-calculated after any change to the data,
 * and if you want aggregate values to be change-tracked, please set {@link #config-includeParentInChangeSet} to true.
 *
 * Default editor depends on the data field type. If it is a number, default editor is a {@link Core/widget/NumberField}.
 * Otherwise Default editor is a {@link Core/widget/TextField}.
 *
 * ```javascript
 * const grid = new TreeGrid({
 *     // Custom aggregation handler.
 *     // For test purposes, this just does "sum"
 *     myAggregator(...values) {
 *         let result = 0;
 *
 *         for (let i = 0, { length } = args; i < length; i++) {
 *             result += parseInt(args[i], 10);
 *         }
 *         return result;
 *     },
 *     columns : [
 *         { field : 'name', text : 'Name' },
 *
 *         // Will sum the ages of leaf nodes. This is the default.
 *         { type : 'aggregate', field : 'age', text : 'Age', renderer : ({ value }) => `<b>${value}<b>` },
 *
 *         // Will use AggregateColumn's built-in avg of scores of leaf nodes
 *         { type : 'aggregate', field : 'score', text : 'Score', function : 'avg' },
 *
 *         // Will use the grid's myAggregator function
 *         { type : 'aggregate', field : 'revenue', text : 'Revenue', function : 'up.myAggregator' },
 *     ]
 * });
 * ```
 *
 * @extends Grid/column/NumberColumn
 * @classType aggregate
 */
export default class AggregateColumn extends NumberColumn {
    //region Config
    static get type() {
        return 'aggregate';
    }

    static get fields() {
        return [
            'function',
            'includeParentInChangeSet'
        ];
    }

    static get defaults() {
        return {
            /**
             * Math Function name, or function name prepended by `"up."` that is resolvable in an
             * ancestor component (such as the owning Grid, or a hight Container), or a function to
             * use to aggregate child record values for this column, or a function.
             *
             * This Column is provided with a `sum` and `avg` function. The default function is `sum`
             * which is used for the aggregation.
             *
             * The function is passed a set of child node values, each value in a separate argument
             * and should return a single value based upon the value set passed.
             * @config {Function|String}
             * @category Common
             */
            function : 'sum',

            /**
             * Set to `true` to include changes to parent (aggregate) rows in the store's modification tracking.
             * @config {Boolean} includeParentInChangeSet
             * @category Common
             */
            includeParentInChangeSet : false
        };
    }

    construct(data, columnStore) {
        this.configuredAlign = 'align' in data;
        this.configuredEditor = 'editor' in data;

        super.construct(...arguments);

        const { grid } = columnStore;

        // 'sum' is reserved by Summary feature, so we use a different name
        if (this.function === 'sum') {
            this.function = 'sumChildren';
        }

        if (grid) {
            this.owner = grid;
            grid.on({
                paint   : 'onGridPaint',
                thisObj : this,
                prio    : 1000
            });
        }
    }

    onGridPaint({ source : grid }) {
        this.store = grid.store;
    }

    set store(store) {
        const
            me             = this,
            storeListeners = {
                update  : 'onRecordUpdate',
                thisObj : me,
                prio    : 1000
            },
            oldStore = me._store;

        if (store !== oldStore) {
            if (oldStore) {
                oldStore.un(storeListeners);
            }

            me._store = store;

            const
                { modelClass } = store,
                field = modelClass.fieldMap[me.field];

            // It's *likely*, but not certain that this will be used for a numeric field.
            // Use numeric defaults unless configured otherwise if so.
            if (field && field.type === 'number') {
                if (!me.configuredAlign) {
                    me.align = 'end';
                }
                if (!me.configuredEditor) {
                    me.editor = 'number';
                }
            }

            store.on(storeListeners);
        }
    }

    canEdit(record) {
        return record.isLeaf;
    }

    get store() {
        return this._store;
    }

    sumChildren(...args) {
        let result = 0;

        for (let i = 0, { length } = args; i < length; i++) {
            result += parseInt(args[i] || 0, 10);
        }
        return result;
    }

    avg(...args) {
        let result = 0;
        const { length } = args;

        for (let i = 0; i < length; i++) {
            result += parseInt(args[i] || 0, 10);
        }
        return result / length;
    }

    onRecordUpdate({ record, changes }) {
        const
            me = this,
            { rowManager } = me.grid;

        if (me.field in changes) {
            if (record.isLeaf) {
                record.bubble(rec => {
                    const row = rowManager.getRowFor(rec);

                    if (row) {
                        const cellElement = row.getCell(me.field);

                        if (cellElement) {
                            row.renderCell(cellElement);
                        }
                    }
                }, true);
            }
        }
    }

    getRawValue(record) {
        let value = 0;

        if (record.children) {
            const
                me       = this,
                fn       = me.function,
                isMathFn = typeof fn === 'string' && typeof Math[fn] === 'function',
                {
                    handler,
                    thisObj
                } = isMathFn ? {
                    handler : Math[fn],
                    thisObj : Math
                } : me.resolveCallback(fn);

            // Gather all child node values before passing them to the aggregator function.
            value = handler.apply(thisObj, record.children.map(r => me.getRawValue(r)));
            if (me.includeParentInChangeSet) {
                record.set(me.field, value, true);
            }
            else {
                record.setData(me.field, value);
            }
        }
        else {
            value = record[this.field];
        }
        return value;
    }
}

ColumnStore.registerColumnType(AggregateColumn, true);
AggregateColumn.exposeProperties();
