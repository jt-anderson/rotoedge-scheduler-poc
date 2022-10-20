import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from '../feature/GridFeatureManager.js';

/**
 * @module Grid/feature/Stripe
 */

/**
 * Stripes rows by adding alternating CSS classes to all row elements (`b-even` and `b-odd`).
 *
 * This feature is <strong>disabled</strong> by default.
 *
 * @extends Core/mixin/InstancePlugin
 *
 * @example
 * let grid = new Grid({
 *   features: {
 *     stripe: true
 *   }
 * });
 *
 * @demo Grid/columns
 * @classtype stripe
 * @inlineexample Grid/feature/Stripe.js
 * @feature
 */
export default class Stripe extends InstancePlugin {

    static get $name() {
        return 'Stripe';
    }

    construct(grid, config) {
        super.construct(grid, config);

        grid.on({
            renderrow : 'onRenderRow',
            thisObj   : this
        });
    }

    doDisable(disable) {
        if (!this.isConfiguring) {
            // Refresh rows to add/remove even/odd classes
            this.client.refreshRows();
        }

        super.doDisable(disable);
    }

    /**
     * Applies even/odd CSS when row is rendered
     * @param {Grid.row.Row} rowModel
     * @private
     */
    onRenderRow({ row }) {
        const
            { disabled } = this,
            even         = row.dataIndex % 2 === 0;

        row.assignCls({
            'b-even' : !disabled && even,
            'b-odd'  : !disabled && !even
        });
    }
}

GridFeatureManager.registerFeature(Stripe);
