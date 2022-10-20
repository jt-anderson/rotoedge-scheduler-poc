import TreeColumn from '../column/TreeColumn.js';
import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from './GridFeatureManager.js';
import ObjectHelper from '../../Core/helper/ObjectHelper.js';
import WalkHelper from '../../Core/helper/WalkHelper.js';

/**
 * @module Grid/feature/TreeGroup
 */

/**
 * A feature that allows transforming a flat dataset (or the leaves of a hierarchical) into a tree by specifying a
 * record field per parent level. Parents are generated based on each leaf's value for those fields.
 *
 * {@inlineexample Grid/feature/TreeGroup.js}
 *
 * This feature can be used to mimic multi grouping or to generate another view for hierarchical data. The original data
 * is kept in memory and can be easily restored.
 *
 * <div class="note">
 * Please note that this feature requires using a {@link Grid.view.TreeGrid} or having the {@link Grid.feature.Tree}
 * feature enabled.
 * </div>
 *
 * This snippet shows how the sample dataset used in the demo above is transformed:
 *
 * ```javascript
 * const grid = new TreeGrid({
 *     // Original data
 *     data : [
 *         { id : 1, name : 'Project 1', children : [
 *             { id : 11, name : 'Task 11', status : 'wip', prio : 'high' },
 *             { id : 12, name : 'Task 12', status : 'done', prio : 'low' },
 *             { id : 13, name : 'Task 13', status : 'done', prio : 'high' }
 *         ]},
 *         { id : 2, name : 'Project 2', children : [
 *             { id : 21, name : 'Task 21', status : 'wip', prio : 'high' },
 *         ]}
 *     ],
 *
 *     features : {
 *         treeGroup : {
 *             // Fields to build a new tree from
 *             levels : [ 'prio', 'status' ]
 *         }
 *     }
 * });
 *
 * // Resulting data
 * [
 *     { name : 'low', children : [
 *         { name : 'done', children : [
 *             { id : 12, name : 'Task 12', status : 'done', prio : 'low' }
 *         ]}
 *     ]},
 *     { name : 'high', children : [
 *         { name : 'done', children : [
 *             { id : 13, name : 'Task 13', status : 'done', prio : 'high' }
 *         ]},
 *         { name : 'wip', children : [
 *             { id : 11, name : 'Task 11', status : 'wip', prio : 'high' },
 *             { id : 21, name : 'Task 21', status : 'wip', prio : 'low' }
 *         ]}
 *     ]}
 * ]
 * ```
 *
 * ## Important information
 *
 * Using the TreeGroup feature comes with some caveats:
 *
 * * Grouping completely replaces the dataset of the store with a new generated tree structure. Any uncommitted new or
 *   removed records will be lost.
 * * Generated parents are read-only, they cannot be edited using the default UI.
 * * Leaves in the new tree are still editable as usual, and any changes to them survives the grouping operation.
 * * Moving nodes manually in the tree is not supported while it is grouped.
 * * Grouping sets `parentId` to be non-persistable, since the generated structure is considered temporary and not meant
 *   to be persisted. The setting is reset when grouping is {@link #function-clearGroups cleared}.
 *
 * <div class="note">
 * Please note that this feature is currently only supported by Grid and Gantt.
 * </div>
 *
 * This feature is <strong>disabled</strong> by default.
 *
 * @extends Core/mixin/InstancePlugin
 *
 * @classtype treeGroup
 * @feature
 */
export default class TreeGroup extends InstancePlugin {
    static $name = 'TreeGroup';

    static configurable = {
        /**
         * An array of model field names or functions used to determine the levels in the resulting tree.
         *
         * Assigning `null` restores data to its original state.
         *
         * See the {@link #config-levels levels config} for more information.
         *
         * @member {Array<String|Function(Core.data.Model) : any>} levels
         */
        /**
         * An array of model field names or functions used to determine the levels in the resulting tree.
         *
         * When supplying a function, it will be called for each leaf in the original data and it is expected to return
         * an atomic value used to determine which parent the leaf will be added to at that level.
         *
         * ```javascript
         * const grid = new TreeGrid({
         *     features : {
         *         treeGroup : {
         *             levels : [
         *                 // First level is determined by the value of the status field
         *                 'status',
         *                 // Second level by the result of this function
         *                 // (which puts percentdone 0-9 in one group, 10-19 into another and so on)
         *                 record => (record.percentDone % 10) * 10
         *             ]
         *         }
         *     }
         * });
         * ```
         *
         * The function form can also be used as a formatter/renderer of sorts, simply by returning a string:
         *
         * ```javascript
         * const grid = new TreeGrid({
         *     features : {
         *         treeGroup : {
         *             levels : [
         *                 record => `Status: ${record.status}`
         *             ]
         *         }
         *     }
         * });
         * ```
         *
         * @config {Array<String|Function(Core.data.Model) : any>}
         */
        levels : null,

        /**
         * CSS class to apply to the generated parents.
         *
         * @config {String}
         * @default
         */
        parentCls : 'b-generated-parent'
    };

    static pluginConfig = {
        assign : ['group', 'clearGroups']
    }

    static properties = {
        isApplying : 0
    }

    construct(grid, config) {
        super.construct(grid, config);

        if (!grid.hasFeature('tree')) {
            throw new Error('The TreeGroup feature requires the Tree feature to be enabled');
        }
    }

    processParentData(parentData) {
        // Apply cls to allow custom styling of generated parents
        if (this.parentCls) {
            parentData.cls = this.parentCls;
        }
    }

    restoreChildRecord(record) {
        if (record.children?.length === 0) {
            record.appendChild(record.$originalChildren);
        }
    }

    // Override in subclasses to wait for initial data readiness before transforming, for example to wait for engine
    // calculations in Gantt
    async waitForReadiness() {
        // Wait for store to finish loading before transforming the data
        if (this.client.store.isLoading) {
            await this.client.store.await('load', false);
        }
    }

    async applyLevels(levels, applyToStore = true) {
        const
            me            = this,
            { store }     = me.client,
            treeColumn    = me.client.columns.find(col => col instanceof TreeColumn),
            parentIdField = store.modelClass.getFieldDefinition('parentId');

        me._levels = levels;

        me.isApplying++;

        await me.waitForReadiness();

        if (me.isDestroyed) {
            return;
        }

        // Applying custom levels
        if (levels) {
            // We don't want the change to parentId when moving to a new generated parent to be persisted
            if (parentIdField && !('$originalPersist' in parentIdField)) {
                parentIdField.$originalPersist = parentIdField.persist;
                parentIdField.persist = false;
            }

            // Store original children for each current parent first time we pass through here
            if (!me.$originalChildren) {
                store.traverse(r => {
                    if (r.isParent && r.children.length) {
                        r.$originalChildren = r.children.slice();
                    }
                });
                me.$originalChildren = store.rootNode.children.slice();
            }

            // Transform it according to levels
            const transformedData = store.treeify(levels, parentData => {
                // Use group key as tree columns content
                ObjectHelper.setPath(parentData, store.modelClass.getFieldDataSource(treeColumn.field), parentData.key);

                // Let the outside world manipulate generated parents data before turning it into a record
                me.processParentData(parentData);
            });

            if (applyToStore) {
                store.data = transformedData.children;
            }

            me.isApplying--;

            return transformedData;
        }
        // Clearing custom levels
        else {
            // Return children to their original parents
            WalkHelper.preWalk(
                { $originalChildren : me.$originalChildren },
                r => r.$originalChildren,
                r => me.restoreChildRecord(r)
            );

            if (applyToStore) {
                store.data = me.$originalChildren;
            }

            // Restore persistability when clearing groups
            if (parentIdField) {
                parentIdField.persist = parentIdField.$originalPersist;
                delete parentIdField.$originalPersist;
            }

            me.$originalChildren = null;

            me.isApplying--;
        }
    }

    updateLevels(levels) {
        this.applyLevels(levels);
    }

    /**
     * Transforms the data according to the supplied levels.
     *
     * Yields the same result as assigning to {@link #property-levels}.
     *
     * ```javascript
     * // Transform into a tree with two parent levels
     * grid.group('status', record => (record.percentDone % 10) * 10);
     * ```
     *
     * @param {Array<String|Function(Core.data.Model) : any>} levels Field names or functions use to generate parents in resulting tree.
     * @on-owner
     * @category Common
     */
    async group(levels) {
        ObjectHelper.assertArray(levels, 'group()');

        await this.applyLevels(levels);
    }

    /**
     * Clears the previously applied transformation, restoring data to its initial state.
     *
     * Yields the same result as assigning `null` to {@link #property-levels}.
     *
     * ```javascript
     * // Restore original data
     * grid.clearGroupers();
     * ```
     * @on-owner
     * @category Common
     */
    async clearGroups() {
        await this.applyLevels(null);
    }

    get isGrouped() {
        return Boolean(this._levels);
    }
}

GridFeatureManager.registerFeature(TreeGroup);
