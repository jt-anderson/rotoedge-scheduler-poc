import Base from '../../Base.js';
import ObjectHelper from '../../helper/ObjectHelper.js';

/**
 * @module Core/data/mixin/StoreSort
 */

const nestedRe = /\./;

/**
 * Mixin for Store that handles simple sorting as well as multi-level sorting.
 *
 * ```javascript
 * // single sorter
 * store.sort('age');
 *
 * // single sorter as object, descending order
 * store.sort({ field : 'age', ascending : false });
 *
 * // multiple sorters
 * store.sort(['age', 'name']);
 *
 * // using custom sorting function
 * store.sort({
 *     fn : (recordA, recordB) => {
 *         // apply custom logic, for example:
 *         return recordA.name.length < recordB.name.length ? -1 : 1;
 *     }
 * });
 *
 * // using locale specific sort (slow)
 * store.sort({ field : 'name', useLocaleSort : 'sv-SE' });
 * ```
 *
 * @mixin
 */
export default Target => class StoreSort extends (Target || Base) {
    static get $name() {
        return 'StoreSort';
    }

    //region Config

    static get defaultConfig() {
        return {
            /**
             * Use `localeCompare()` when sorting, which lets the browser sort in a locale specific order. Set to `true`,
             * a locale string or a locale config to enable.
             *
             * Enabling this has big negative impact on sorting
             * performance. For more info on `localeCompare()`, see [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare).
             *
             * Examples:
             *
             * ```javascript
             * const store = new Store({
             *     // Swedish sorting
             *     useLocaleSort : 'sv-SE'
             * });
             *
             * const store = new Store({
             *     // Swedish sorting with custom casing order
             *     useLocaleSort : {
             *         locale    : 'sv-SE',
             *         caseFirst : 'upper'
             *     }
             * });
             * ```
             *
             * Can also be configured on a per sorter basis:
             *
             * ```javascript
             * store.sort({ field: 'name', useLocaleSort : 'sv-SE' });
             * ```
             *
             * @config {Boolean|String|Object}
             * @default false
             * @category Advanced
             */
            useLocaleSort : null
        };
    }

    static get configurable() {
        return {
            /**
             * Initial sorters, format is [{ field: 'name', ascending: false }, ...]
             * @config {Object[]|String[]}
             * @category Common
             */
            sorters : [],

            /**
             * Specify true to sort this store after records are added.
             * @config {Boolean}
             * @default
             * @category Sorting
             */
            reapplySortersOnAdd : false
        };
    }

    //endregion

    //region Events

    /**
     * Fired before sorting
     * @event beforeSort
     * @param {Core.data.Store} source This Store
     * @param {Object[]} sorters Sorter configs
     * @param {Core.data.Model[]} records Records to sort
     */

    /**
     * Fired after sorting
     * @event sort
     * @param {Core.data.Store} source This Store
     * @param {Object[]} sorters Sorter configs
     * @param {Core.data.Model[]} records Sorted records
     */

    //endregion

    //region Properties

    /**
     * Currently applied sorters
     * @member {Object[]} sorters
     * @readonly
     * @category Sort, group & filter
     */

    /**
     * Is store sorted?
     * @property {Boolean}
     * @readonly
     * @category Sort, group & filter
     */
    get isSorted() {
        return Boolean(this.sorters.length) || this.isGrouped;
    }

    changeSorters(sorters) {
        return sorters.map(sorter => this.normalizeSorterConfig(sorter, true));
    }

    updateReapplySortersOnAdd(enable) {
        this.storage.autoSort = enable;
    }

    //endregion

    //region Add & remove sorters

    /**
     * Sort records, either by replacing current sorters or by adding to them.
     * A sorter can specify a **_custom sorting function_** which will be called with arguments (recordA, recordB).
     * Works in the same way as a standard array sorter, except that returning `null` triggers the stores
     * normal sorting routine.
     *
     * ```javascript
     * // single sorter
     * store.sort('age');
     *
     * // single sorter as object, descending order
     * store.sort({ field : 'age', ascending : false });
     *
     * // multiple sorters
     * store.sort(['age', 'name']);
     *
     * // using custom sorting function
     * store.sort((recordA, recordB) => {
     *     // apply custom logic, for example:
     *     return recordA.name.length < recordB.name.length ? -1 : 1;
     * });
     *
     * // using locale specific sort (slow)
     * store.sort({ field : 'name', useLocaleSort : 'sv-SE' });
     * ```
     *
     * @param {String|Object[]|Object|Function} field Field to sort by.
     * Can also be an array of {@link Core.util.CollectionSorter sorter} config objects, or a sorting function, or a {@link Core.util.CollectionSorter sorter} config.
     * @param {Boolean} [ascending] Sort order.
     * Applicable when the `field` is a string (if not specified and already sorted by the field, reverts direction),
     * or an object and `ascending` property is not specified for the object. `true` by default.
     * Not applicable when `field` is a function. `ascending` is always `true` in this case.
     * @param {Boolean} [add] If `true`, adds a sorter to the sorters collection.
     * Not applicable when `field` is an array. In this case always replaces active sorters.
     * @param {Boolean} [silent] Set as true to not fire events. UI will not be informed about the changes.
     * @category Sort, group & filter
     * @fires beforeSort
     * @fires sort
     * @fires refresh
     * @returns {Promise|null} If {@link Core/data/AjaxStore#config-sortParamName} is set on store, this method returns `Promise`
     * which is resolved after data is loaded from remote server, otherwise it returns `null`
     * @async
     */
    sort(field, ascending, add = false, silent = false) {
        const
            me             = this,
            records        = me.allRecords,
            currentSorters = me.sorters ? me.sorters.slice() : [];

        let currentDir = null,
            curSort;

        if (field) {
            if (Array.isArray(field)) {
                // array of strings make fields always be sorted ascending
                me.sorters = field.map(sorter => me.normalizeSorterConfig(sorter, typeof sorter === 'string' ? true : ascending));
            }
            else {
                const sorter = me.normalizeSorterConfig(field, ascending);

                if (add) {
                    curSort = me.getCurrentSorterByField(sorter.field);

                    // Field already among sorters? change sort direction instead of adding new sorter
                    if (curSort) {
                        currentDir        = curSort.ascending;
                        curSort.ascending = sorter.ascending;
                    }
                    else {
                        me.sorters.push(sorter);
                    }
                }
                else {
                    me.sorters = [sorter];
                }
            }
        }

        if (!silent && me.trigger('beforeSort', { sorters : me.sorters, records, currentSorters }) === false) {
            // Restore sorters
            me.sorters = currentSorters;

            // Restore sorting direction if toggled
            if (currentDir !== null) {
                curSort.ascending = currentDir;
            }

            return null;
        }

        return me.performSort(silent);
    }

    normalizeSorterConfig(field, ascending) {
        const
            me     = this,
            sorter = { ascending };

        if (typeof field === 'object') {
            ObjectHelper.assign(sorter, field);

            if (field.fn) {
                delete sorter.fn;
                sorter.sortFn = field.fn;
            }

            sorter.ascending = field.ascending ?? ascending;
        }
        else if (typeof field === 'function') {
            sorter.sortFn = field;
        }
        else {
            sorter.field = field;
        }

        // sort in opposite direction if not specified and already sorted, default to sorting ascending
        if (sorter.ascending == null) {
            const curSort = me.getCurrentSorterByField(sorter.field);
            sorter.ascending = curSort ? !curSort.ascending : true;
        }

        if (sorter.sortFn == null) {
            const compareItems = me.modelClass?.$meta.fields.map[sorter.field]?.compareItems;

            if (compareItems) {
                // These sorters will be ignored by AjaxStore when remoting...
                sorter.sortFn = compareItems;
            }
        }

        return sorter;
    }

    getCurrentSorterByField(field) {
        return typeof field === 'string' && this.sorters.find(s => s.field === field) || null;
    }

    /**
     * Add a sorting level (a sorter).
     * @param {String|Object[]|Object|Function} field Field to sort by. Can also be an array of sorters, or a sorting
     * function, or a {@link Core.util.CollectionSorter sorter} config.
     * @param {Boolean} [ascending] Sort order (used only if field specified as string)
     * @returns {Promise|null} If {@link Core/data/AjaxStore#config-sortParamName} is set on store, this method returns `Promise`
     * which is resolved after data is loaded from remote server, otherwise it returns `null`
     * @async
     * @category Sort, group & filter
     */
    addSorter(field, ascending = true) {
        return this.sort(field, ascending, true);
    }

    /**
     * Remove a sorting level (a sorter)
     * @param {String|Function} field Stop sorting by this field (or sorter function)
     * @returns {Promise|null} If {@link Core/data/AjaxStore#config-sortParamName} is set on store, this method returns `Promise`
     * which is resolved after data is loaded from remote server, otherwise it returns `null`
     * @async
     * @category Sort, group & filter
     */
    removeSorter(field) {
        const
            sorterIndex = this.sorters.findIndex(sorter => sorter.field === field || sorter.sortFn === field);

        if (sorterIndex > -1) {
            this.sorters.splice(sorterIndex, 1);
            return this.sort();
        }
    }

    /**
     * Removes all sorters, turning store sorting off.
     * @returns {Promise|null} If {@link Core/data/AjaxStore#config-sortParamName} is set on store, this method returns `Promise`
     * which is resolved after data is loaded from remote server, otherwise it returns `null`
     * @async
     * @category Sort, group & filter
     */
    clearSorters() {
        if (this.sorters.length) {
            this.sorters.length = 0;
            return  this.sort();
        }
    }

    //region

    //region Sorting logic

    /**
     * Creates a function used with Array#sort when sorting the store. Override to use your own custom sorting logic.
     * @param {Object[]} sorters An array of sorter config objects
     * @returns {Function}
     * @category Sort, group & filter
     */
    createSorterFn(sorters) {
        const storeLocaleSort = this.useLocaleSort;

        return (lhs, rhs) => {
            for (let i = 0; i < sorters.length; i++) {
                const
                    sorter = sorters[i],
                    { field, ascending = true, useLocaleSort = storeLocaleSort } = sorter,
                    fn = sorter.fn || sorter.sortFn,
                    direction = ascending ? 1 : -1;

                if (fn) {
                    const val = fn(lhs, rhs);
                    if (val !== null) {
                        return val * direction;
                    }
                }

                const
                    nested = nestedRe.test(field),
                    lhsValue = nested ? lhs.get(field) : lhs[field],
                    rhsValue = nested ? rhs.get(field) : rhs[field];

                if (lhsValue === rhsValue) {
                    continue;
                }

                if (lhsValue == null) {
                    return -direction;
                }

                if (rhsValue == null) {
                    return direction;
                }

                if (useLocaleSort && typeof lhsValue === 'string') {
                    // Use systems locale
                    if (useLocaleSort === true) {
                        return String(lhsValue).localeCompare(rhsValue) * direction;
                    }

                    // Use specified locale
                    if (typeof useLocaleSort === 'string') {
                        return String(lhsValue).localeCompare(rhsValue, useLocaleSort) * direction;
                    }

                    // Use locale config
                    if (typeof useLocaleSort === 'object') {
                        return String(lhsValue).localeCompare(rhsValue, useLocaleSort.locale, useLocaleSort) * direction;
                    }
                }

                if (lhsValue > rhsValue) {
                    return direction;
                }
                if (lhsValue < rhsValue) {
                    return -direction;
                }
            }

            return 0;
        };
    }

    /**
     * Perform sorting according to the {@link #config-sorters} configured.
     * This is the internal implementation which is overridden in {@link Core.data.AjaxStore} and
     * must not be overridden.
     * @async
     * @private
     * @category Sort, group & filter
     */
    performSort(silent) {
        const
            me = this,
            { rootNode, storage, sorters } = me,
            // When remoteSort is enabled then always sort by data order received from remote server
            // _remoteSortIndex is set inside store.setStoreData() method
            sorter = me.createSorterFn(me.remoteSort ?  [{ field : '_remoteSortIndex' }] : (me.isGrouped ? me.groupers.concat(sorters) : sorters));

        if (me.tree) {
            rootNode.traverse(node => {
                if (node.isLoaded && node.isParent) {
                    node.children.sort(sorter);
                    // Since child nodes change order their parentIndex needs to be updated.
                    // Update is silent, records wont be considered modified because of the sort
                    node.updateChildrenIndices(node.children, false, true);
                }
            });
            storage.replaceValues({
                values : me.collectDescendants(rootNode).visible,
                silent : true
            });
        }
        else if (me.isGrouped) {
            storage.replaceValues({
                values : me.prepareGroupRecords(sorter),
                silent : true
            });
        }
        else {
            storage.replaceValues({
                values : storage.values.sort(sorter),
                silent : true
            });
        }

        me.afterPerformSort(silent || me.isRemoteDataLoading);
    }

    afterPerformSort(silent) {
        if (silent) {
            return;
        }

        const me = this;

        me._idMap = null;

        const event = {
            action  : 'sort',
            sorters : me.sorters,
            records : me.allRecords
        };

        me.trigger('sort', event);
        me.trigger('refresh', event);
    }

    //endregion
};
