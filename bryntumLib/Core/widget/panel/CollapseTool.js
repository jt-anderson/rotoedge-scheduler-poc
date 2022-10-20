import Tool from '../Tool.js';

/**
 * @module Core/widget/panel/CollapseTool
 */

const
    rightRe = /right/i,
    autoAlign = tool => ((tool.collapsed || tool.collapsing) && tool.owner.collapsible.direction.match(rightRe)) ? 'start' : 'end';

/**
 * This ensures the correct icon is used to represent the {@link Core.widget.Panel panel's}
 * {@link Core.widget.Panel#config-collapsed} state.
 * @extends Core/widget/Tool
 *
 * @classType collapsetool
 * @internal
 */
export default class CollapseTool extends Tool {
    static get $name() {
        return 'CollapseTool';
    }

    // Factoryable type name
    static get type() {
        return 'collapsetool';
    }

    static get configurable() {
        return {
            /**
             * Set to `false` to disable automatic adjustment of the {@link #config-align} config based on the state
             * of the panel's {@link Core.widget.Panel#config-collapsed} config and the
             * {@link Core.widget.panel.PanelCollapser#config-direction}.
             *
             * If this is set to a function, that function is called passing the owning `Panel` instance and its
             * return value is assigned to the {@link #config-align} config.
             * @config {Boolean|Function}
             * @default
             */
            autoAlign : true,

            collapsed : null,

            collapsing : null,

            collapsify : false,  // ...unaffected when the panel is collapsed

            direction : 'up',

            // Our own setValues/getValues system should not set/get HTML content
            defaultBindProperty : null
        };
    }

    compose() {
        const { collapsed, direction } = this;

        return {
            class : {
                [`b-icon-collapse-${direction}`] : 1,
                'b-collapsed'                    : collapsed
            }
        };
    }

    changeAutoAlign(v) {
        return (v === true) ? autoAlign : v;
    }

    syncAutoAlign() {
        const { autoAlign } = this;

        if (autoAlign) {
            this.align = autoAlign(this);
        }
    }

    updateAutoAlign() {
        this.syncAutoAlign();
    }

    updateCollapsed() {
        this.syncAutoAlign();
    }

    updateCollapsing() {
        this.syncAutoAlign();
    }

    updateDirection() {
        this.syncAutoAlign();
    }
}

// Register this widget type with its Factory
CollapseTool.initClass();
