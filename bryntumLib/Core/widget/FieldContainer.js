import Container from './Container.js';
import ObjectHelper from '../helper/ObjectHelper.js';
import Animator from '../util/Animator.js';

/**
 * @module Core/widget/FieldContainer
 */

/**
 * This widget is created by {@link Core.widget.Field#config-container} and is not created directly.
 * @extends Core/widget/Container
 */
export default class FieldContainer extends Container {
    //region Config
    static get $name() {
        return 'FieldContainer';
    }

    // Factoryable type name
    static get type() {
        return 'fieldcontainer';
    }

    static get configurable() {
        return {
            /**
             * An animation config object to use when expanding or collapsing the field's
             * {@link Core.widget.Field#config-container}.
             * @config {Object} animation
             * @property {Number} [animation.duration=300] The duration of the animation (in milliseconds).
             * @internal
             */
            animation : {
                duration : 300
            },

            /**
             * Controls whether the field is collapsed (that is, the field's {@link Core.widget.Field#config-container}
             * is hidden).
             * @config {Boolean}
             * @default false
             */
            collapsed : null,

            /**
             * The animator performing the field's currently running expand or collapse animation.
             * @config {Core.util.Animator}
             * @private
             */
            collapser : {
                value   : null,
                $config : 'nullify'  // to abort animations on destroy
            },

            /**
             * A mapping object for config properties of the items in the {@link Core.widget.Field#config-container}.
             * The keys are the config names and the values are functions that compute the config value when passed
             * the field instance.
             *
             * For example, this is the default:
             * ```javascript
             *      syncableConfigs : {
             *          disabled : field => field.disabled
             *      }
             * ```
             * This indicates that the config property named with the key ('disabled') should be assigned to the result
             * of the function assigned to that key (`field => field.disabled`). In other words, when the field is
             * {@link Core.widget.Field#config-disabled}, all of the field's items should also be disabled.
             *
             * @config {Object}
             * @internal
             */
            syncableConfigs : null,

            /**
             * This object holds truthy values for each config property that, when modified, should trigger a sync of
             * this field's items as defined in {@link #config-syncableConfigs}.
             * @config {Object}
             * @internal
             */
            syncConfigTriggers : {
                $config : {
                    merge : 'classList'
                },

                value : null
            },

            testConfig : {
                animation : {
                    duration : 10
                }
            }
        };
    }

    static get delayable() {
        return {
            syncChildConfigs : 'raf'
        };
    }

    get inline() {
        return this.owner.inline ?? this.ensureItems().count === 1;
    }

    changeCollapsed(collapsed) {
        if (this.togglingCollapse) {
            this.togglingCollapse = false;

            return collapsed;
        }

        this.toggleCollapse(Boolean(collapsed));
    }

    updateCollapsed(collapsed) {
        this.collapser = this.collapser?.destroy();
        this.setCollapsedCls(collapsed);
    }

    updateCollapser(collapser, was) {
        if (was && was.completed == null) {
            if (!was.reverting || !collapser) {
                was.destroy();
            }
        }

        this.setOwnerCls('b-collapsing', collapser);
    }

    //endregion

    /**
     * This property is `true` if the field container is currently collapsing.
     * @property {Boolean}
     * @readonly
     */
    get collapsing() {
        const { collapser } = this;

        return collapser != null && collapser.collapsed;
    }

    /**
     * This property is `true` if the field container is currently either collapsing or expanding.
     * @property {Boolean}
     * @readonly
     * @internal
     */
    get collapsingExpanding() {
        return this.collapser != null;
    }

    /**
     * This property is `true` if the field container is currently expanding.
     * @property {Boolean}
     * @readonly
     */
    get expanding() {
        const { collapser } = this;

        return collapser != null && !collapser.collapsed;
    }

    collapse(animation) {
        this.toggleCollapse(true, animation);
    }

    expand(animation) {
        this.toggleCollapse(false, animation);
    }

    setCollapsedCls(collapsed) {
        this.setOwnerCls('b-collapsed', collapsed);
    }

    setOwnerCls(cls, state) {
        this.owner?.element?.classList[state ? 'add' : 'remove'](cls);
    }

    syncChildConfigs() {
        const
            me                         = this,
            { owner, syncableConfigs } = me;

        if (syncableConfigs) {
            let destProp, val;

            for (destProp in syncableConfigs) {
                val = syncableConfigs[destProp](owner);

                me.eachWidget(item => {
                    item[destProp] = val;
                }, /* deep = */ false);
            }
        }

        owner.afterSyncChildConfigs(me);
    }

    syncContainer() {
        const { inline, layout } = this;

        if (this.autoLayout) {
            layout.horizontal = inline;
            layout.justify = inline ? 'center' : 'stretch';
        }
    }

    toggleCollapse(collapsed, animation) {
        const
            me                                                    = this,
            { animation : collapseAnimation, collapser, inline } = me,
            { containerWrapElement }                              = me.owner,
            finalize = complete => {
                if (complete) {
                    me.element.style.height = '';
                    me.togglingCollapse = true;
                    me.collapsed = collapsed;
                    me.collapser = null;  // in case we reverted
                }
            };

        if (collapsed == null) {
            collapsed = !me.collapsed;
        }

        if (animation !== false && animation !== null) {
            if (!containerWrapElement || !me.isVisible) {
                animation = null;
            }
            else {
                if (animation === true) {
                    animation = {};
                }
                else if (typeof animation === 'number') {
                    animation = {
                        duration : animation
                    };
                }

                animation = (collapseAnimation || animation) ? ObjectHelper.merge({}, collapseAnimation, animation) : null;
            }
        }

        if (!animation) {
            me.togglingCollapse = true;
            me.collapsed = collapsed;
        }
        else if (collapser && collapsed !== collapser.collapsed) {
            me.collapser = collapser.revert({ finalize });
            me.collapser.collapsed = collapsed;
        }
        else if (!collapser && collapsed !== me.collapsed) {
            // to expand, we need to briefly become expanded in order to get a proper measurement
            !collapsed && me.setCollapsedCls(false);

            const
                { element } = me,
                { height } = element.getBoundingClientRect(),
                expanded = inline ? 1 : height;

            !collapsed && me.setCollapsedCls(true);

            element.style.height = `${height}px`;

            me.collapser = Animator.run(ObjectHelper.merge({
                finalize,
                element                         : containerWrapElement,
                [inline ? 'opacity' : 'height'] : {
                    from : collapsed ? expanded : 0,
                    to   : collapsed ? 0        : expanded
                }
            }, animation));

            me.collapser.collapsed = collapsed;
        }
    }
}

FieldContainer.initClass();
