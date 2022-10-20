import Checkbox from './Checkbox.js';

/**
 * @module Core/widget/Radio
 */

/**
 * The `Radio` widget wraps an <code>&lt;input type="radio"&gt;</code> element.
 *
 * Color can be specified and you can optionally configure {@link #config-text} to display in a label to the right of
 * the radio button instead of, or in addition to, a standard field {@link #config-label}.
 *
 * {@inlineexample Core/widget/Radio.js vertical}
 *
 * ## Nested Items
 * A radio button can also have a {@link #config-container} of additional {@link Core.widget.Container#config-items}.
 * These items can be displayed immediately following the field's label (which is the default when there is only one
 * item) or below the radio button. This can be controlled using the {@link #config-inline} config.
 *
 * In the demo below notice how additional fields are displayed for the checked radio button:
 *
 * {@inlineexample Core/widget/Radio-items.js vertical}
 *
 * For a simpler way to create a set of radio buttons, see the {@link Core.widget.RadioGroup} widget.
 *
 * @extends Core/widget/Checkbox
 * @classType radio
 */
export default class Radio extends Checkbox {
    //region Config
    static get $name() {
        return 'Radio';
    }

    // Factoryable type name
    static get type() {
        return 'radio';
    }

    // Factoryable type alias
    static get alias() {
        return 'radiobutton';
    }

    static get configurable() {
        return {
            inputType : 'radio',

            /**
             * Set this to `true` so that clicking a checked radio button will clear its checked state.
             * @config {Boolean}
             * @default false
             */
            clearable : null,

            uncheckedValue : undefined  // won't store to Container#values when unchecked
        };
    }

    //endregion

    //region Init

    get textLabelCls() {
        return super.textLabelCls + ' b-radio-label';
    }

    //endregion

    internalOnClick(info) {
        if (super.internalOnClick(info) !== false) {
            if (this.checked && this.clearable) {
                this.checked = false;
            }
        }
    }

    updateName(name) {
        this.toggleGroup = name;
    }

    // Empty override to get rid of clear trigger
    updateClearable() {}
}

// Register this widget type with its Factory
Radio.initClass();
