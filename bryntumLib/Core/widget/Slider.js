import Widget from './Widget.js';
import Tooltip from './Tooltip.js';
import Rectangle from '../helper/util/Rectangle.js';
import ObjectHelper from '../helper/ObjectHelper.js';

/**
 * @module Core/widget/Slider
 */
const arrowKeys = {
    ArrowUp    : 1,
    ArrowDown  : 1,
    ArrowLeft  : 1,
    ArrowRight : 1
};

/**
 * Wraps native &lt;input type="range"&gt;
 *
 * @extends Core/widget/Widget
 *
 * @example
 * let slider = new Slider({
 *   text: 'Choose value'
 * });
 *
 * @classType slider
 * @inlineexample Core/widget/Slider.js
 */
export default class Slider extends Widget {
    //region Config

    static get $name() {
        return 'Slider';
    }

    // Factoryable type name
    static get type() {
        return 'slider';
    }

    static get configurable() {
        return {
            /**
             * Get/set text. Appends value if Slider.showValue is true
             * @member {String} text
             */
            /**
             * Slider label text
             * @config {String}
             */
            text : null,

            /**
             * Show value in label (appends in () if text is set)
             * @config {Boolean}
             * @default
             */
            showValue : true,

            /**
             * Show the slider value in a tooltip
             * @config {Boolean}
             * @default
             */
            showTooltip : false,

            /**
             * Get/set min value
             * @member {Number} min
             */
            /**
             * Minimum value
             * @config {Number}
             * @default
             */
            min : 0,

            /**
             * Get/set max value
             * @member {Number} max
             */
            /**
             * Maximum value
             * @config {Number}
             * @default
             */
            max : 100,

            /**
             * Get/set step size
             * @member {Number} step
             */
            /**
             * Step size
             * @config {Number}
             * @default
             */
            step : 1,

            /**
             * Get/set value
             * @member {Number} value
             */
            /**
             * Initial value
             * @config {Number}
             */
            value : 50,

            /**
             * Unit to display next to the value, when configured with `showValue : true`
             * @config {String}
             * @default
             */
            unit : null,

            // The value is set in the Light theme. The Material theme will have different value.
            thumbSize : 20,

            tooltip : {
                $config : ['lazy', 'nullify'],
                value   : {
                    type     : 'tooltip',
                    align    : 'b-t',
                    anchor   : false, // No anchor displayed since thumbSize is different for different themes
                    axisLock : true
                }
            },

            localizableProperties : ['text'],

            /**
             * By default, the {@link #event-change} event is fired when a change gesture is completed, ie: on
             * the mouse up gesture of a drag.
             *
             * Configure this as `true` to fire the {@link #event-change} event as the value changes *during* a drag.
             * @prp {Boolean}
             */
            triggerChangeOnInput : null
        };
    }

    //endregion

    //region Init

    compose() {
        const
            { id, min, max, showValue, step, text, value, unit = '', disabled } = this,
            inputId = `${id}-input`,
            hasText = Boolean(text || showValue);

        return {
            class : {
                'b-has-label' : hasText,
                'b-text'      : hasText,
                'b-disabled'  : disabled
            },

            children : {
                input : {
                    tag       : 'input',
                    type      : 'range',
                    id        : inputId,
                    reference : 'input',
                    disabled  : disabled,

                    min,
                    max,
                    step,
                    value,
                    listeners : {
                        input     : 'onInternalInput',
                        change    : 'onInternalChange',
                        mouseover : 'onInternalMouseOver',
                        mouseout  : 'onInternalMouseOut'
                    }
                },

                label : {
                    tag  : 'label',
                    for  : inputId,
                    html : showValue ? (text ? `${text} (${value}${unit})` : value + unit) : text
                }
            }
        };
    }

    get focusElement() {
        return this.input;
    }

    get percentProgress() {
        return (this.value - this.min) / (this.max - this.min) * 100;
    }

    //endregion

    //region Events

    /**
     * Fired while slider thumb is being dragged.
     * @event input
     * @param {Core.widget.Slider} source The slider
     * @param {String} value The value
     */

    /**
     * Fired after the slider value changes (on mouse up following slider interaction).
     * @event change
     * @param {String} value The value
     * @param {Boolean} userAction Triggered by user taking an action (`true`) or by setting a value (`false`)
     * @param {Core.widget.Slider} source The slider
     */

    /* break from doc comment */

    onInternalKeyDown(e) {
        // Contain arrow keys to be processed by the <input type="range">, do not allow them to bubble
        // up to by any owning container.
        if (!this.readOnly && arrowKeys[e.key]) {
            e.stopImmediatePropagation();
        }
    }

    onInternalChange() {
        this.updateUI();
        this.triggerChange(true);
        this.trigger('action', { value : this.value });
    }

    onInternalInput() {
        const me = this;

        if (me.readOnly) {
            // Undo the change if we are readOnly.
            // readOnly input attribute will not work for non-text fields: https://github.com/w3c/html/issues/89
            me.input.value = me.value;
            return;
        }

        me.value = parseInt(me.input.value, 10);

        me.trigger('input', { value : me.value });
        if (me.triggerChangeOnInput) {
            me.triggerChange(me);
        }
    }

    onInternalMouseOver() {
        const
            me            = this,
            thumbPosition = me.rtl ? 100 - me.percentProgress : me.percentProgress;

        me.tooltip?.showBy({
            target : Rectangle.from(me.input).inflate(me.thumbSize / 2, -me.thumbSize / 2),
            align  : `b-t${Math.round(thumbPosition)}`
        });
    }

    onInternalMouseOut() {
        this.tooltip?.hide();
    }

    triggerChange(userAction) {
        this.triggerFieldChange({
            value : this.value,
            valid : true,
            userAction
        });
    }

    //endregion

    //region Config Handling

    // max
    updateMax(max) {
        const me = this;

        if (me.input && me._value > max) {
            me.value = max;
            me.trigger('input', { value : me.value });
        }
    }

    // min
    updateMin(min) {
        const me = this;

        if (me.input && me._value < min) {
            me.value = min;
            me.trigger('input', { value : me.value });
        }
    }

    // tooltip
    changeTooltip(config, existingTooltip) {
        if (config) {
            config.owner = this;
        }

        return this.showTooltip ? Tooltip.reconfigure(existingTooltip, config, {
            owner    : this,
            defaults : {
                forElement : this.input,
                html       : String(this.value) + (this.unit ?? '')
            }
        }) : null;
    }

    changeValue(value) {
        const
            me            = this,
            { min, step } = me;

        value = Math.min(Math.max(value, min), me.max);

        // Round the passed value so that it is in sync with our steps.
        // For example, if our min is 10, and our step is 3, then
        // passing 12 should get 13. Rounding the value directly to the closest
        // step would fail this requirement.
        if (value > min) {
            return min + ObjectHelper.roundTo(value - min, step);
        }
        return ObjectHelper.roundTo(value, step);
    }

    updateValue(value) {
        const
            me = this,
            { input, _tooltip } = me;

        if (_tooltip) {
            _tooltip.html = me.value + (me.unit ?? '');
        }

        if (input && input.value !== String(value)) {
            input.value = value;
            me.triggerChange(false);
        }

        me.updateUI();
    }

    //endregion

    //region Util

    updateUI() {
        const me = this;

        // Don't measure the UI unless we need to
        me._tooltip?.isVisible && me._tooltip?.alignTo({
            target : Rectangle.from(me.input).inflate(me.thumbSize / 2, -me.thumbSize / 2),
            align  : `b-t${Math.round(me.percentProgress)}`
        });
    }

    //endregion
}

// Register this widget type with its Factory
Slider.initClass();
