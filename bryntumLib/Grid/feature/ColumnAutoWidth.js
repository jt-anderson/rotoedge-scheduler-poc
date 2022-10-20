import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from '../feature/GridFeatureManager.js';
import Delayable from '../../Core/mixin/Delayable.js';

const storeListenerName = 'store';

/**
 * @module Grid/feature/ColumnAutoWidth
 */

/**
 * Enables the {@link Grid.column.Column#config-autoWidth} config for a grid's columns.
 *
 * This feature is <strong>enabled</strong> by default.
 *
 * @extends Core/mixin/InstancePlugin
 * @mixes Core/mixin/Delayable
 * @classtype columnAutoWidth
 * @feature
 */
export default class ColumnAutoWidth extends Delayable(InstancePlugin) {
    static get $name() {
        return 'ColumnAutoWidth';
    }

    //region Config

    static get configurable() {
        return {
            /**
             * The default `autoWidth` option for columns with `autoWidth: true`. This can
             * be a single number for the minimum column width, or an array of two numbers
             * for the `[minWidth, maxWidth]`.
             * @config {Number|Number[]}
             */
            default : null,

            /**
             * The amount of time (in milliseconds) to delay after a store modification
             * before synchronizing `autoWidth` columns.
             * @config {Number}
             * @default
             */
            delay : 0
        };
    }

    //endregion

    //region Internals

    static get pluginConfig() {
        return {
            after : {
                bindStore        : 'bindStore',
                unbindStore      : 'unbindStore',
                renderRows       : 'syncAutoWidthColumns',
                onInternalResize : 'onInternalResize'
            },

            assign : [
                'columnAutoWidthPending',
                'syncAutoWidthColumns'
            ]
        };
    }

    construct(config) {
        super.construct(config);

        const
            { client : grid } = this,
            { store } = grid;

        // The initial bindStore can come super early such that our hooks won't catch it:
        if (store) {
            this.bindStore(store);
        }
    }

    doDestroy() {
        this.unbindStore();

        super.doDestroy();
    }

    bindStore(store) {
        this.lastSync = null;

        store.on({
            name : storeListenerName,

            [`change${this.client.asyncEventSuffix}`] : 'onStoreChange'
        }, this);
    }

    unbindStore() {
        this.detachListeners(storeListenerName);
    }

    get columnAutoWidthPending() {
        return this.lastSync === null || this.hasTimeout('syncAutoWidthColumns');
    }

    onStoreChange({ action }) {
        if (action !== 'move') {
            const me = this;
            ++me.storeGeneration;

            // If we are editing, sync right away so cell editing can align correctly to next cell
            if (me.client.features.cellEdit?.isEditing) {
                me.syncAutoWidthColumns();
            }
            else if (!me.hasTimeout('syncAutoWidthColumns')) {
                me.setTimeout('syncAutoWidthColumns', me.delay);
            }
        }
    }

    // Handle scenario with Grid being inside DIV with display none, and no width. Sync column widths after being shown
    onInternalResize(element, newWidth, newHeight, oldWidth) {
        if (oldWidth === 0) {
            // Force remeasure after we get a width
            this.lastSync = null;
            this.syncAutoWidthColumns();
        }
    }

    syncAutoWidthColumns() {
        const
            me = this,
            grid = me.client,
            storeGeneration = me.storeGeneration;

        if (me.lastSync !== storeGeneration) {
            me.lastSync = storeGeneration;

            let autoWidth, resizingColumns;

            for (const column of grid.columns.visibleColumns) {
                autoWidth = column.autoWidth;

                if (autoWidth) {
                    if (autoWidth === true) {
                        autoWidth = me.default;
                    }

                    grid.resizingColumns = resizingColumns = true;
                    column.resizeToFitContent(autoWidth);
                }
            }

            if (resizingColumns) {
                grid.resizingColumns = false;
                grid.afterColumnsResized();
            }
        }

        if (me.hasTimeout('syncAutoWidthColumns')) {
            me.clearTimeout('syncAutoWidthColumns');
        }
    }

    //endregion
}

ColumnAutoWidth.prototype.storeGeneration = 0;

GridFeatureManager.registerFeature(ColumnAutoWidth, true);
