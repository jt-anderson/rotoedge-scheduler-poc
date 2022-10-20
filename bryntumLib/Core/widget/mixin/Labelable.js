import Base from '../../Base.js';
import DomHelper from '../../helper/DomHelper.js';
import ObjectHelper from '../../helper/ObjectHelper.js';

/**
 * @module Core/widget/mixin/Labelable
 */

/**
 * This mixin provides label functionality to {@link Core.widget.Field} and {@link Core.widget.FieldSet}.
 *
 * Not to be used directly.
 *
 * @mixin
 */
export default Target => class Labelable extends (Target || Base) {
    //region Config
    static get $name() {
        return 'Labelable';
    }

    static get configurable() {
        return {
            /**
             * Get/set fields label. Please note that the Field needs to have a label specified from start for this to
             * work, otherwise no element is created.
             * @member {String} label
             */

            /**
             * Label, prepended to field
             * @config {String}
             * @category Label
             */
            label : null,

            /**
             * Label position, either 'before' the field or 'above' the field
             * @config {'before'|'above'}
             * @default
             * @category Label
             */
            labelPosition : 'before',

            /**
             * CSS class name or class names to add to any configured {@link #config-label}
             * @config {String|Object}
             * @category Label
             */
            labelCls : null,

            /**
             * The width to apply to the `<label>` element. If a number is specified, `px` will be used.
             * @config {String|Number}
             * @localizable
             * @category Label
             */
            labelWidth : {
                value   : null,
                $config : {
                    localeKey : 'L{labelWidth}'
                }
            }
        };
    }

    get hasLabel() {
        return Boolean(this.label);
    }

    compose() {
        const { hasLabel, labelPosition } = this;

        return {
            class : {
                [`b-label-${labelPosition}`] : hasLabel,
                'b-has-label'                : hasLabel
            }
        };
    }

    changeLabel(label) {
        return label || '';
    }

    setupLabel(lbl) {
        return ObjectHelper.assign({
            tag   : 'label',
            for   : `${this.id}-input`,
            class : `b-label b-align-${lbl.align || 'start'}`
        }, lbl);
    }

    // updateLabel(label) {
    //     // since value is used in template it is not certain that element is available
    //     // TODO: move the code from template here instead
    //     if (this.labelElement) {
    //         // using innerHTML since we sometimes use icons as label
    //         this.labelElement.innerHTML = label;
    //     }
    // }

    updateLabelWidth(newValue) {
        if (this.labelElement) {
            this.labelElement.style.flex = `0 0 ${DomHelper.setLength(newValue)}`;
            // If there's a label width, the input must conform with it, and not try to expand to 100%
            this.inputWrap.style.flexBasis = newValue == null ? '' : 'auto';
        }
    }

    //endregion

    // This does not need a className on Widgets.
    // Each *Class* which doesn't need 'b-' + constructor.name.toLowerCase() automatically adding
    // to the Widget it's mixed in to should implement thus.
    get widgetClass() {}
};
