import Panel from './Panel.js';
import Labelable from './mixin/Labelable.js';
import DomHelper from '../helper/DomHelper.js';

/**
 * @module Core/widget/FieldSet
 */

/**
 * The `FieldSet` widget wraps an <code>&lt;fieldset&gt;</code> element. A fieldset is a specially styled
 * {@link Core.widget.Panel} intended to hold form fields.
 *
 * @extends Core/widget/Panel
 * @mixes Core/widget/mixin/Labelable
 * @classType fieldset
 */
export default class FieldSet extends Panel.mixin(Labelable) {
    //region Config
    static get $name() {
        return 'FieldSet';
    }

    // Factoryable type name
    static get type() {
        return 'fieldset';
    }

    static get configurable() {
        return {
            bodyTag   : 'fieldset',
            focusable : false,

            /**
             * Setting this config to `true` assigns a horizontal box layout (`flex-flow: row`) to the items in this
             * container, while `false` assigns a vertical box layout (`flex-flow: column`).
             *
             * By default, this value is automatically determined based on the {@link #config-label} and
             * {@link #config-labelPosition} configs.
             * @config {Boolean}
             */
            inline : null,

            inlineInternal : null,

            layout : {
                type       : 'box',
                horizontal : false
            }
        };
    }

    static get prototypeProperties() {
        return {
            flexRowCls : 'b-hbox',
            flexColCls : 'b-vbox'
        };
    }

    //endregion

    //region Composition

    get bodyConfig() {
        const
            result = super.bodyConfig,
            { className } = result,
            { inlineInternal: inline, hasLabel, title } = this;

        delete result.html;

        className['b-inline'] = inline;
        className['b-fieldset-has-label'] = hasLabel;

        if (title) {
            result.children = {
                // We render the <legend> element for a11y (not 100% sure it is needed)
                legendElement : {
                    tag   : 'legend',
                    text  : title,
                    class : {
                        'b-fieldset-legend' : 1
                    }
                }
            };
        }

        return result;
    }

    compose() {
        const { inlineInternal: inline, label, labelCls, labelWidth } = this;

        return {
            class : {
                'b-field' : label,
                'b-vbox'  : !inline  // override panel
            },
            children : {
                'labelElement > headerElement' : (label || null) && {
                    tag   : 'label',
                    html  : label,
                    class : {
                        'b-label'       : 1,
                        'b-align-start' : 1,
                        [labelCls]      : labelCls
                    },
                    style : {
                        width : DomHelper.unitize('width', labelWidth)[1]
                    }
                }
            }
        };
    }

    //endregion

    syncInlineInternal() {
        this.inlineInternal = this.inline ?? (this.label != null && this.labelPosition === 'before');
    }

    updateDisabled(value, was) {
        super.updateDisabled(value, was);

        // Needs {}'s to avoid a "return false" that ends iteration
        this.eachWidget(item => {
            item.disabled = value;
        }, /* deep = */false);
    }

    updateInline() {
        this.syncInlineInternal();
    }

    updateInlineInternal(inline) {
        this.layout.horizontal = inline;
    }

    updateLabel() {
        this.syncInlineInternal();
    }

    updateLabelPosition() {
        this.syncInlineInternal();
    }
}

// Register this widget type with its Factory
FieldSet.initClass();
