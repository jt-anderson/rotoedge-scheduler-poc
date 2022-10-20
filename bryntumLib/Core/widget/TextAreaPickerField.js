import PickerField from './PickerField.js';
import Objects from '../helper/util/Objects.js';
import EventHelper from '../helper/EventHelper.js';
import VersionHelper from '../helper/VersionHelper.js';

/**
 * @module Core/widget/TextAreaPickerField
 */

/**
 * TextAreaPickerField is a picker field with a drop down showing a `textarea` element for multiline text input. See also
 * {@link Core.widget.TextAreaField}.
 *
 *
 * ```javascript
 * let textAreaField = new TextAreaPickerField({
 *   placeholder: 'Enter some text'
 * });
 *```
 *
 * This field can be used as an {@link Grid.column.Column#config-editor editor} for {@link Grid.column.Column Columns}.
 *
 * @extends Core/widget/PickerField
 * @classType textareapickerfield
 * @inlineexample Core/widget/TextAreaPickerField.js
 */
export default class TextAreaPickerField extends PickerField {
    static get $name() {
        return 'TextAreaPickerField';
    }

    // Factoryable type name
    static get type() {
        return 'textareapickerfield';
    }

    static get configurable() {
        return {
            picker : {
                type         : 'widget',
                tag          : 'textarea',
                cls          : 'b-textareapickerfield-picker',
                scrollAction : 'realign',
                align        : {
                    align    : 't-b',
                    axisLock : true
                },
                autoShow : false
            },

            triggers : {
                expand : {
                    cls     : 'b-icon-picker',
                    handler : 'onTriggerClick'
                }
            },

            /**
             * The resize style to apply to the `<textarea>` element.
             * @config {'none'|'both'|'horizontal'|'vertical'}
             * @default
             */
            resize : 'none',

            inputType : null
        };
    }

    startConfigure(config) {
        if (typeof config.inline === 'boolean') {
            VersionHelper.deprecate('Core', '6.0.0', 'TextAreaPickerField.inline config is no longer supported');
        }

        super.startConfigure(config);
    }

    get inputElement() {
        const
            result = super.inputElement;

        result.readOnly = 'readonly';
        result.reference = 'displayElement';
        this.ariaElement = 'displayElement';

        return result;
    }

    get focusElement() {
        return this._picker && this._picker.isVisible ? this.input : this.displayElement;
    }

    showPicker() {
        const
            me         = this,
            { picker } = me;

        // Block picker if inline
        if (!me.inline) {
            picker.width = me.pickerWidth || me[me.pickerAlignElement].offsetWidth;

            // Always focus the picker.
            super.showPicker(true);
        }
    }

    focusPicker() {
        this.input.focus();
    }

    onPickerKeyDown(keyEvent) {
        const
            me        = this,
            realInput = me.input;

        switch (keyEvent.key.trim() || keyEvent.code) {
            case 'Escape':
                // TODO: revert value?
                me.picker.hide();
                return;
            case 'Enter':
                if (keyEvent.ctrlKey) {
                    me.syncInputFieldValue();
                    me.picker.hide();
                }
                break;
        }

        // Super's onPickerKeyDown fires through this.input, so avoid infinite recursion
        // by redirecting it through the displayElement.
        me.input     = me.displayElement;
        const result = super.onPickerKeyDown(keyEvent);
        me.input     = realInput;

        return result;
    }

    syncInputFieldValue(skipHighlight) {
        if (this.displayElement) {
            this.displayElement.value = this.inputValue;
        }

        super.syncInputFieldValue(skipHighlight);
    }

    changeValue(value) {
        return value == null ? '' : value;
    }

    changePicker(picker, oldPicker) {
        const
            me          = this,
            pickerWidth = me.pickerWidth || picker?.width;

        picker = TextAreaPickerField.reconfigure(oldPicker, picker ? Objects.merge({
            owner      : me,
            forElement : me[me.pickerAlignElement],
            align      : {
                matchSize : pickerWidth == null,
                anchor    : me.overlayAnchor,
                target    : me[me.pickerAlignElement]
            },
            id    : me.id + '-input',
            style : {
                resize : me.resize
            },
            html : me.value ?? ''
        }, picker) : null, me);

        // May have been set to null (destroyed)
        if (picker) {
            const input = me.input = picker.element;

            me.inputListenerRemover = EventHelper.on({
                element  : input,
                thisObj  : me,
                focus    : 'internalOnInputFocus',
                change   : 'internalOnChange',
                input    : 'internalOnInput',
                keydown  : 'internalOnKeyEvent',
                keypress : 'internalOnKeyEvent',
                keyup    : 'internalOnKeyEvent'
            });
        }

        return picker;
    }
}

// Register this widget type with its Factory
TextAreaPickerField.initClass();
