import Base from '../../Base.js';
import StringHelper from '../../helper/StringHelper.js';

/**
 * @module Core/data/mixin/StoreTree
 */
const emptyArray = Object.freeze([]);

/**
 * Mixin for store with tree related functionality. To learn more about working with tree nodes please see the
 * {@link Core/data/mixin/TreeNode} class and [this guide](#Core/guides/data/treedata.md).
 * @mixin
 */
export default Target => class StoreTree extends (Target || Base) {
    static get $name() {
        return 'StoreTree';
    }

    static get configurable() {
        return {
            /**
             * Set to `true` to on load transform a flat dataset with raw objects containing `parentId` into the format
             * expected for tree data.
             *
             * Example input format:
             *
             * ```javascript
             * [
             *   { id : 1, name : 'Parent' },
             *   { id : 2, name : 'Child', parentId : 1 }
             * ]
             * ```
             *
             * Will be transformed into:
             *
             * ```javascript
             * [
             *   {
             *     id : 1,
             *     name : 'Parent',
             *     children : [
             *       { id : 2, name : 'Child', parentId : 1 }
             *     ]
             *   }
             * ]
             * ```
             *
             * @config {Boolean}
             * @category Tree
             */
            transformFlatData : null
        };
    }

    //region Getters

    /**
     * True if this Store is configured to handle tree data (with `tree : true`) or if this is a
     * {@link Core.data.Store#function-makeChained chained store} and the master store is a tree store.
     * @property {Boolean}
     * @readonly
     * @category Tree
     */
    get isTree() {
        return this.tree || (this.masterStore && this.masterStore.tree);
    }

    /**
     * Returns all leaf records in a tree store
     * @property {Core.data.Model[]}
     * @category Tree
     */
    get leaves() {
        const me = this,
            result = [];

        if (me.isTree) {
            me.traverse(record => {
                if (record.isLeaf) {
                    result.push(record);
                }
            });

            return result;
        }
        else {
            me.allRecords.forEach(r => {
                if (r.isLeaf) {
                    result.push(r);
                }
                r.traverse(record => {
                    if (record.isLeaf) {
                        result.push(record);
                    }
                }, true);
            });
        }
        return result;
    }

    //endregion

    //region Children

    /**
     * Loads children for a parent node that uses load on demand (when expanding it). Base implementation does nothing,
     * either use AjaxStore which implements it, create your own subclass with an implementation or listen for
     * `toggleNode` and insert records when you have them available.
     * @param {Core.data.Model} parentRecord
     * @returns {Promise} A Promise which will be resolved if the load succeeds, and rejected if the load is
     * vetoed by a {@link Core.data.AjaxStore#event-beforeLoadChildren} handler, or if an {@link Core.data.AjaxStore#event-exception} is detected.
     * The resolved function is passed the event object passed to any event handlers.
     * The rejected function is passed the {@link Core.data.AjaxStore#event-exception} event if an exception occurred,
     * or `false` if the load was vetoed by a {@link Core.data.AjaxStore#event-beforeLoadChildren} handler.
     * @category Tree
     */
    async loadChildren(parentRecord) {
    }

    /**
     * Called from Model when adding children. Not to be called directly, use Model#appendChild() instead.
     * @internal
     * @param {Core.data.mixin.TreeNode} parent
     * @param {Core.data.mixin.TreeNode[]} children
     * @param {Number} index
     * @param {Object} isMove
     * @param {Boolean} [silent]
     * @fires add
     * @fires change
     * @category Tree
     */
    onNodeAddChild(parent, children, index, isMove, silent = false) {
        const
            me              = this,
            isRootLoad      = parent === me.rootNode && parent.isLoading,
            { storage }     = me,
            toAddToUI       = [],
            toAdd           = [],
            previousSibling = children[0].previousSibling;

        let storeInsertionPoint;

        me.collectDescendants(children, toAddToUI, toAdd, { inCollapsedBranch : !(parent.isExpanded(me) && parent.ancestorsExpanded(me)) });

        // Keep CRUD caches up to date unless it's a root load
        if (!isRootLoad && toAdd.length) {
            for (const record of toAdd) {
                // Only considered an add if not modified or moved
                if (!me.modified.includes(record) && !isMove[record.id]) {
                    // If was removed, remove from `removed` list
                    if (me.removed.includes(record)) {
                        me.removed.remove(record);
                    }
                    // Else add to `added` list
                    else {
                        me.added.add(record);
                    }
                }
            }
        }

        // Root node inserted first
        if (isRootLoad && me.rootVisible) {
            toAddToUI.unshift(parent);
            toAdd.unshift(parent);
        }

        if (toAddToUI.length) {
            // Calculate the insertion point into the flat store.
            // If the new node is the first, then it goes after the parent node.
            if (index === 0 || !previousSibling) {
                storeInsertionPoint = storage.indexOf(parent);
            }
            // Otherwise it has to go after the previous visible node which has
            // to be calculated. See indexOfPreviousVisibleNode for explanation.
            else {
                storeInsertionPoint = storage.indexOf(previousSibling) + previousSibling.getDescendantCount(true, me);
            }

            // Insert added child nodes at correct location in storage.
            // We must not react to change - we fire the events here.
            storage.suspendEvents();
            me.storage.splice(++storeInsertionPoint, 0, toAddToUI);
            storage.resumeEvents();
            me._idMap = null;
        }

        // Since we do not pass through Store#onDataChange we have to handle relations manually here. And since they are
        // not tied to flat part of store, use all children
        me.updateDependentStores('add', children);

        // If it's a root level set data op, then signal 'dataset'
        if (isRootLoad && toAddToUI.length) {
            // If we have initial sorters, perform a silent sort before triggering `dataset`
            // NOTE: Records in toAddToUI will be in the original order, not affected by the sort
            if (me.sorters.length) {
                me.sort(null, null, false, true);
            }

            me.afterLoadData?.();

            if (!silent) {
                const event = { action : 'dataset', data : me._data, records : toAddToUI };
                me.trigger('refresh', event);
                me.trigger('change', event);
            }
        }
        // Else, continue as before to signal an "isChild" add.
        else if (!silent) {
            const event = { action : 'add', parent, isChild : true, isMove, records : children, allRecords : toAdd, index : storeInsertionPoint };
            me.trigger('add', event);
            me.trigger('change', event);

            // Check if any add is actually a move
            if (Object.values(isMove).some(wasMoved => wasMoved)) {
                const event = {
                    newParent : parent,
                    records   : children.filter(record => isMove[record.id])
                };
                me.trigger('move', event);
            }
        }
    }

    onNodeRemoveChild(parent, children, index, flags = { isMove : false, silent : false, unfiltered : false }) {
        const
            me                             = this,
            { storage }                    = me,
            toRemoveFromUI                 = [],
            toRemove                       = [],
            { isMove, silent, unfiltered } = flags,
            removeUnfiltered               = unfiltered && me.isFiltered,
            childrenToRemove               = removeUnfiltered && parent.unfilteredChildren ? parent.unfilteredChildren : children;

        me.collectDescendants(childrenToRemove, toRemoveFromUI, toRemove, { inCollapsedBranch : !(parent.isExpanded(me) && parent.ancestorsExpanded(me)), unfiltered : removeUnfiltered });
        // test StoreTree.t.js should fail if the next line replaces the above line
        // me.collectDescendants(children, toRemoveFromUI, toRemove, { inCollapsedBranch : !(parent.isExpanded(me) && parent.ancestorsExpanded(me)) });

        if (!isMove) {
            // Unjoin is recursive, use flat children array
            for (const record of children) {
                record.unjoinStore(me);
            }

            // Keep CRUD caches up to date
            for (const record of toRemove) {
                // TODO remove this check as unjoinStore already checks (currently makes StoreTree.t.js fail)
                if (record.stores.includes(me)) {
                    record.unjoinStore(me);
                }

                // If was newly added, remove from `added` list
                if (me.added.includes(record)) {
                    me.added.remove(record);
                }
                // Else add to `removed` list
                else {
                    me.removed.add(record);
                }
            }
            me.modified.remove(toRemove);
        }

        // Remove removed child nodes at correct location in storage
        if (toRemoveFromUI.length) {
            index = storage.indexOf(toRemoveFromUI[0]);
            // We must not react to change - we fire the events here.
            if (index > -1) {
                storage.suspendEvents();
                storage.splice(index, toRemoveFromUI.length);
                storage.resumeEvents();
                me._idMap = null;
            }
        }
        else {
            // If nothing is removed from UI (storage) return -1, showing that removed node was in a collapsed branch
            index = -1;
        }

        if (!silent) {
            const event = {
                action     : 'remove',
                parent,
                isChild    : true,
                isMove,
                records    : children,
                allRecords : toRemove,
                index
            };
            me.trigger('remove', event);
            me.trigger('change', event);
        }

        return toRemove;
    }

    collectDescendants(node, visible = [], all = [], flags = { inCollapsedBranch : false, unfiltered : false }) {
        const me = this,
            { inCollapsedBranch, unfiltered } = flags,
            children = Array.isArray(node) ? node : me.getChildren(node, unfiltered);

        if (children) {
            for (let i = 0, len = children.length, child; i < len; i++) {
                child = children[i];
                if (!inCollapsedBranch) {
                    visible.push(child);
                }
                all.push(child);
                me.collectDescendants(child, visible, all, { inCollapsedBranch : inCollapsedBranch || !child.isExpanded(me), unfiltered });
            }
        }
        return { visible, all };
    }

    /**
     * Returns the children of the passed branch node which this store owns. By default, this
     * is the entire `children` array.
     *
     * **If this store {@link Core.data.mixin.StoreChained#property-isChained isChained}**, then
     * this returns only the subset of children which are filtered into this store by the
     * {@link Core.data.mixin.StoreChained#config-chainedFilterFn chainedFilterFn}.
     * @param {Core.data.Model} parent The node to return the children of.
     * @returns {Core.data.Model[]}
     * @category Tree
     */
    getChildren(parent, unfiltered = false) {
        // In case of chained store we need to apply chainedFilterFn to all records
        const children = ((unfiltered || this.isChained) && parent.unfilteredChildren) || parent.children;
        return children && children.length ? (this.isChained ? children.filter(this.chainedFilterFn) : children) : emptyArray;
    }

    /**
     * Includes or excludes all records beneath parentRecord in storage. Used when expanding or collapsing
     * nodes.
     * @private
     * @param parentRecord Parent record
     * @param include Include (true) or exclude (false)
     * @category Tree
     */
    internalToggleTreeSubRecords(parentRecord, include) {
        const
            me          = this,
            { storage } = me,
            index       = storage.indexOf(parentRecord),
            children    = me.doIncludeExclude(me.getChildren(parentRecord), include);

        // When expanded a parent node while being filtered, need to update the hidden flag of its children
        if (me.isFiltered && include && parentRecord.unfilteredChildren) {
            me.updateChildrenHiddenState(parentRecord);
        }

        // If we expanded a node which is yet to load children, the collected children
        // array will be empty, so do not broadcast any change event.
        // If we are collapsing a record which isn't visible (because parent is collapsed) we won't get an index,
        // which is fine since it is already removed from processedRecords
        if (children.length && index !== false) {
            // We must not react to change - we fire the events here with a flag
            // to tell responders that it's due to an expand or collapse.
            storage.suspendEvents();

            if (include) {
                storage.splice(index + 1, 0, ...children);

                const event = { action : 'add', isExpand : true, records : children, index : index + 1 };
                me.trigger('add', event);
                me.trigger('change', event);
            }
            else {
                storage.splice(index + 1, children.length);

                const event = { action : 'remove', isCollapse : true, records : children, index : index + 1 };
                me.trigger('remove', event);
                me.trigger('change', event);
            }
            storage.resumeEvents();
            me._idMap = null;
        }
    }

    // Updates the hidden flag of its children while store is filtered
    updateChildrenHiddenState(parentRecord) {
        parentRecord.unfilteredChildren?.forEach(child => {
            child.instanceMeta(this.id).hidden = false;

            if (!child.isLeaf) {
                this.updateChildrenHiddenState(child);
            }
        });
    }

    doIncludeExclude(children, include, result = []) {
        const
            me         = this,
            childCount = children?.length || 0;

        for (let i = 0; i < childCount; i++) {
            const child = children[i];

            // Only consider child nodes who we own.
            // If we are a chained store, skip nodes that are not ours.
            if (!me.isChained || me.chainedFilterFn(child)) {
                const mapMeta = child.instanceMeta(me.id);

                if (include || !mapMeta.hidden) {
                    // if including sub-records, add those who are not hidden by a collapsed sub parent
                    result.push(child);
                }
                mapMeta.hidden = !include;

                if (child.isExpanded(me)) {
                    me.doIncludeExclude(me.getChildren(child), include, result);
                }
            }
        }
        return result;
    }

    /**
     * Collapse an expanded record or expand a collapsed. Optionally forcing a certain state.
     * @param {String|Number|Core.data.Model} idOrRecord Record (the record itself) or id of a record to toggle
     * @param {Boolean} [collapse] Force collapse (true) or expand (false)
     * @category Tree
     */
    async toggleCollapse(idOrRecord, collapse) {
        const
            me                 = this,
            record             = me.getById(idOrRecord),
            meta               = record.instanceMeta(me);

        if (collapse === undefined) {
            collapse = !meta.collapsed;
        }

        // Reject if we're in the middle of loading children, or it's a leaf, or it's a no-op
        if (!meta.isLoadingChildren && !record.isLeaf && record.isExpanded(me) === collapse) {
            me.trigger('beforeToggleNode', { record, collapse });
            meta.collapsed = collapse;

            if (meta.collapsed) {
                me.onNodeCollapse(record);
                return true;
            }
            else {
                me.onNodeExpand(record);
                let success = true;

                // Children not yet loaded, ask store for them.
                // It will append them. Appending to a node which
                // is expanded will insert the children into the UI.
                if (!record.isLoaded) {
                    meta.isLoadingChildren = true;

                    try {
                        await me.loadChildren(record);
                    }
                    catch (exception) {
                        // Revert to being collapsed
                        meta.collapsed = true;
                        success = false;
                        me.trigger('loadChildrenException', { record, exception });
                    }
                    finally {
                        meta.isLoadingChildren = false;
                    }
                }
                return success;
            }
        }
    }

    /**
     * Remove all records beneath parentRecord from storage.
     * @private
     * @param parentRecord Parent record
     * @category Tree
     */
    onNodeCollapse(parentRecord) {
        // We don't care about collapse if it's inside a collapsed subtree
        if (parentRecord.ancestorsExpanded(this)) {
            return this.internalToggleTreeSubRecords(parentRecord, false);
        }
    }

    /**
     * Add all records beneath parentRecord from storage.
     * @private
     * @param parentRecord Parent record
     * @category Tree
     */
    onNodeExpand(parentRecord) {
        // We don't care about expand if it's inside a collapsed subtree
        if (parentRecord.ancestorsExpanded(this)) {
            return this.internalToggleTreeSubRecords(parentRecord, true);
        }
    }

    //endregion

    //region Transform flat data

    /**
     * Transforms flat data containing parent ids into tree data
     * @param {Object[]} data Flat raw data
     * @returns {Object[]} Tree data
     * @private
     */
    transformToTree(data) {
        const
            { parentIdField, idField, childrenField } = this.modelClass,
            parents                                   = new Map(),
            transformed                               = [];

        for (const node of data) {
            const parentId = node[parentIdField];

            // Child, find parent
            if (parentId != null) {
                // Detected parents are kept in a map to no have to iterate to find them each time
                let parent = parents.get(parentId);

                // Parent not in map, find it and add it (also adds unmatched parents, to not search for
                // them again)
                if (parent === undefined) {
                    parent = data.find(node => node[idField] === parentId) ?? null;
                    parents.set(parentId, parent);
                }

                // Parent found, add node as child of it
                if (parent) {
                    if (!parent[childrenField]) {
                        parent[childrenField] = [];
                    }

                    parent[childrenField].push(node);
                }
            }
            // Parent, keep
            else {
                transformed.push(node);
            }
        }

        return transformed;
    }

    /**
     * Transforms data into a tree with parent levels based on supplied fields.
     *
     * ```javascript
     * const newRoot = store.treeify(['name', r => r.age % 10]);
     * ```
     *
     * @param {Array<String|Function>} fields The field names, or a function to call to extract a value to create parent
     * nodes for records with the same value.
     * @param {Function} [parentTransform] A function which is called to allow the caller to transform the raw data
     * object of any newly created parent nodes.
     * @param {Boolean} [convertParents] Pass `true` to convert raw new parent data objects to this Store's
     * {@link Core.data.Store#config-modelClass}.
     * @returns {Core.data.Model} New root node
     * @internal
     */
    treeify(fields, parentTransform, convertParents = false) {
        const
            { length } = fields,
            parents    = [],
            newRoot    = {};

        let i, lastParent;

        // New branch nodes are ID'd by their field values concatenated into
        // string form.
        //
        // The key value that was used to create them is their "key" property.
        //
        // rootNode : {
        //    children : [{
        //        id       : 'p1',
        //        name     : 'Parent 1',
        //        expanded : true,
        //        children : [
        //            { id : 700, name : 'Task 700', startDate : '2021-11-26', duration : 3, percentDone : 20 },
        //            { id : 500, name : 'Task 500', startDate : '2021-11-22', duration : 5, percentDone : 20 },
        //            { id : 300, name : 'Task 300', startDate : '2021-11-24', duration : 3, percentDone : 10 },
        //            { id : 100, name : 'Task 100', startDate : '2021-11-22', duration : 5, percentDone : 10 }
        //       ]
        //    },
        //    {
        //        id       : 'p2',
        //        name     : 'Parent 2',
        //        expanded : true,
        //        children : [
        //            { id : 600, name : 'Task 600', startDate : '2021-11-22', duration : 6, percentDone : 20 },
        //            { id : 800, name : 'Task 800', startDate : '2021-11-26', duration : 2, percentDone : 20 },
        //            { id : 400, name : 'Task 400', startDate : '2021-11-24', duration : 2, percentDone : 10 },
        //            { id : 200, name : 'Task 200', startDate : '2021-11-22', duration : 6, percentDone : 10 }
        //        ]
        //    }]
        // }
        //
        // Becomes the following. Note that all records are sorted into ascending
        // order of their field values:
        //
        // rootNode : {
        //    children : [{
        //        id       : '10',
        //        key      : 10,
        //        expanded : true,
        //        children : [
        //            {
        //                id       : '10Mon Nov 22 2021 00:00:00 GMT+0100 (Central European Standard Time)',
        //                key      : new Date(2021, 10, 22),
        //                expanded : true,
        //                children : [
        //                    { id : 100, name : 'Task 100', startDate : '2021-11-22', duration : 5, percentDone : 10 },
        //                    { id : 200, name : 'Task 200', startDate : '2021-11-22', duration : 6, percentDone : 10 }
        //                ]
        //            },
        //            {
        //                id       : '10Wed Nov 24 2021 00:00:00 GMT+0100 (Central European Standard Time)',
        //                key      : new Date(2021, 10, 24),
        //                expanded : true,
        //                children : [
        //                    { id : 300, name : 'Task 300', startDate : '2021-11-24', duration : 3, percentDone : 10 },
        //                    { id : 400, name : 'Task 400', startDate : '2021-11-24', duration : 2, percentDone : 10 }
        //                ]
        //            }
        //        ]
        //    },
        //    {
        //        id       : '20',
        //        key      : 20,
        //        expanded : true,
        //        children : [
        //            {
        //                id       : '20Mon Nov 22 2021 00:00:00 GMT+0100 (Central European Standard Time)',
        //                key      : new Date(2021, 10, 22),
        //                expanded : true,
        //                children : [
        //                    { id : 500, name : 'Task 500', startDate : '2021-11-22', duration : 5, percentDone : 20 },
        //                    { id : 600, name : 'Task 600', startDate : '2021-11-22', duration : 6, percentDone : 20 }
        //                ]
        //            },
        //            {
        //                id       : '20Fri Nov 26 2021 00:00:00 GMT+0100 (Central European Standard Time)',
        //                key      : new Date(2021, 10, 26),
        //                expanded : true,
        //                children : [
        //                    { id : 700, name : 'Task 700', startDate : '2021-11-26', duration : 3, percentDone : 20 },
        //                    { id : 800, name : 'Task 800', startDate : '2021-11-26', duration : 2, percentDone : 20 }
        //                ]
        //            }
        //        ]
        //    }]
        // }
        //

        // Convert field definitions to a function which extracts the field]
        // for a simpler field value extraction.
        for (i = 0; i < length; i++) {
            if (!fields[i].call) {
                const field = fields[i];
                fields[i] = n => n[field];
            }
            parents[i] = new Map();
        }

        this.rootNode.traverse(n => {
            lastParent = null;

            if (n.isLeaf) {
                for (i = 0; i < length; i++) {
                    const
                        lastParentPath = lastParent?.path || '',
                        nodeMap        = parents[i],
                        key            = fields[i](n),
                        path           = `${lastParentPath + key}/`,
                        id             = StringHelper.makeValidDomId(`generated_${path}`, '_'),
                        parent         = nodeMap.get(id) || (nodeMap.set(id, {
                            id,
                            key,
                            path,
                            expanded : true,
                            readOnly : true,
                            children : []
                        })).get(id);

                    if (lastParent && !lastParent.children.includes(parent)) {
                        lastParent.children.push(parent);
                    }

                    lastParent = parent;
                }
                lastParent.children.push(n);
            }
        }, true);

        // Call the optional transformer, and if we are configured to do so,
        // convert the new branches into TreeNodes.
        parents.forEach(p => p.forEach((p, id, map) => {
            parentTransform?.(p);

            if (convertParents) {
                p = this.createRecord(p);
                map.set(id, p);
            }
        }));

        newRoot.children = [...parents[0].values()];

        // Cascade a sort down so that all "groups" are in order.
        const sort = (n) => {
            if (n.children) {
                n.children.sort((lhs, rhs) => {
                    // If it's a leaf, sort by comparing all "fields"
                    if (lhs.isLeaf) {
                        let result;

                        for (let i = 0; !result && i < length; i++) {
                            const
                                lv = fields[i](lhs),
                                rv = fields[i](rhs);
                            result = lv < rv ? -1 : rv > lv ? 1 : 0;
                        }
                        return result;
                    }
                    // Sort branch nodes by their key values
                    else {
                        // Sort numbers in strings nicely
                        if (typeof lhs.key === 'string' || typeof rhs.key === 'string') {
                            return lhs.key.localeCompare(rhs.key, undefined, { numeric : true });
                        }

                        return lhs.key < rhs.key ? -1 : lhs.key > rhs.key ? 1 : 0;
                    }
                });
                n.children.forEach(sort);
            }
        };
        sort(newRoot);

        return newRoot;
    }

    //endregion

    treeifyFlatData(data) {
        const { childrenField, parentIdField } = this.modelClass;

        let hasParentId     = false,
            shouldTransform = true;

        // Configured to transform flat data into tree data, make sure that we have:
        // - raw data without children defined
        // - parentIds
        for (const node of data) {
            if (node.isModel || Array.isArray(node[childrenField])) {
                shouldTransform = false;
                break;
            }

            if (node[parentIdField] != null) {
                hasParentId = true;
            }
        }

        if (shouldTransform && hasParentId) {
            data = this.transformToTree(data);
        }

        return data;
    }
};
