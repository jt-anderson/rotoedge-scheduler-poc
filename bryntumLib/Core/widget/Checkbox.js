import Field from './Field.js';
import Widget from './Widget.js';
import DomHelper from '../helper/DomHelper.js';
import ObjectHelper from '../helper/ObjectHelper.js';

/**
 * @module Core/widget/Checkbox
 */

const
    whenNotChecked = field => !field.value;

/**
 * Checkbox field, wraps <code>&lt;input type="checkbox"&gt;</code>.
 * Color can be specified and you can optionally configure {@link #config-text}
 * to display in a label to the right of the checkbox in addition to a standard
 * field {@link #config-label}.
 *
 * {@inlineexample Core/widget/Checkbox.js vertical}
 *
 * This field can be used as an {@link Grid.column.Column#config-editor} for the {@link Grid.column.Column}.
 *
 * ## Nested Items
 * A checkbox can also have a {@link #config-container} of additional {@link Core.widget.Container#config-items}. These
 * items can be displayed immediately following the field's label (which is the default when there is only one item) or
 * below the checkbox. This can be controlled using the {@link #config-inline} config.
 *
 * In the demo below notice how additional fields are displayed when the checkboxes are checked:
 *
 * {@inlineexample Core/widget/Checkbox-items.js vertical}
 *
 * @extends Core/widget/Field
 * @classType checkbox
 */
export default class Checkbox extends Field {
    //region Config
    static get $name() {
        return 'Checkbox';
    }

    // Factoryable type name
    static get type() {
        return 'checkbox';
    }

    // Factoryable type alias
    static get alias() {
        return 'check';
    }

    static get configurable() {
        return {
            inputType : 'checkbox',

            /**
             * Specify `true` to automatically {@link Core.widget.FieldContainer#config-collapsed collapse} the field's
             * {@link #config-container} when the field is not {@link #property-checked}.
             *
             * Alternatively, this can be a function that returns the desired `collapse` state when passed the field
             * instance as its one parameter.
             *
             * @config {Boolean|Function}
             * @default false
             */
            autoCollapse : null,

            containerDefaults : {
                syncableConfigs : {
                    disabled : field => field.disabled || !field.value
                },

                syncConfigTriggers : {
                    autoCollapse : 1,
                    value        : 1
                }
            },

            /**
             * Get/set label
             * @member {String} name
             */
            /**
             * Text to display on checkbox label
             * @config {String}
             */
            text : '',

            /**
             * The value to provide for this widget in {@link Core.widget.Container#property-values} when it is
             * {@link #property-checked}.
             * A value of `undefined` will cause this widget not to include its value when checked.
             * @config {*}
             * @default
             */
            checkedValue : true,

            /**
             * The value to provide for this widget in {@link Core.widget.Container#property-values} when it is not
             * {@link #property-checked}.
             *
             * A value of `undefined` will cause this widget to not include its value when it is unchecked.
             * @config {*}
             * @default
             */
            uncheckedValue : false,

            /**
             * The checked state. The same as `value`.
             * @config {Boolean} checked
             */

            /**
             * Checkbox color, must have match in CSS
             * @config {String}
             */
            color : null,

            /**
             * Get/set value
             * @member {String} value
             */
            /**
             * Sets input fields value attribute
             * @config {String}
             */
            value : '',

            toggleGroup : null,

            localizableProperties : ['label', 'text']
        };
    }

    //endregion

    //region Init

    construct(config) {
        // Convert checked to value so that initializing getter can read it if requested prior to trying to set it.
        if ('checked' in config) {
            config = ObjectHelper.assign({}, config);  // copy inherited properties unlike Object.assign()
            config.value = config.checked;
            delete config.checked;
        }

        super.construct(config);

        this.syncHasText();
    }

    get textLabelCls() {
        return 'b-checkbox-label';
    }

    // Implementation needed at this level because it has two inner elements in its inputWrap
    get innerElements() {
        return [
            this.inputElement,
            {
                tag       : 'label',
                class     : this.textLabelCls,
                for       : `${this.id}-input`,
                reference : 'textLabel',
                html      : this.text || ''
            }
        ];
    }

    get inputElement() {
        const config = super.inputElement;

        if (this.toggleGroup) {
            config.dataset = {
                group : this.toggleGroup
            };
        }

        config.listeners = {
            click  : 'internalOnClick',
            change : 'internalOnChange',
            input  : 'internalOnInput'
        };

        return config;
    }

    //endregion

    //region Toggle

    /**
     * Get/set checked state. Equivalent to `value` config.
     * @property {Boolean}
     */
    get checked() {
        return this.value;
    }

    set checked(value) {
        this.value = value;
    }

    syncHasText() {
        this.element.classList[this.text ? 'add' : 'remove']('b-text');
    }

    updateText(value) {
        if (this.textLabel) {
            this.syncHasText();
            this.textLabel.innerHTML = value;
        }
    }

    afterSyncChildConfigs(container) {
        super.afterSyncChildConfigs(container);

        let { autoCollapse } = this;

        if (autoCollapse) {
            autoCollapse = (autoCollapse === true) ? whenNotChecked : autoCollapse;

            container.collapsed = autoCollapse(this);
        }
    }

    assignFieldValue(values, key, value) {
        this.value = (value === this.checkedValue) || (value === this.uncheckedValue ? false : null);
    }

    fetchInputValue() {
        if (!this.readOnly) {
            this.value = this.input.checked;
        }
    }

    gatherValue(values) {
        const
            me = this,
            value = me.value ? me.checkedValue : me.uncheckedValue,
            storedValue = value !== undefined,
            { valueName } = me;

        if (storedValue) {
            values[valueName] = value;
        }

        me.gatherValues(values, storedValue);

        if (value === true && values[valueName]?.value === value) {
            delete values[valueName].value;
        }
    }

    changeValue(value) {
        return (value === 'false') ? false : Boolean(value);
    }

    updateValue(value) {
        const
            me      = this,
            changed = me.input.checked !== value;

        me.input.checked = value;

        me.container?.syncChildConfigs();

        if (changed && !me.inputting && !me.isConfiguring) {
            me.uncheckToggleGroupMembers();

            // The change event does not fire on programmatic change of input.
            me.triggerChange(false);
        }
    }

    get inputValueAttr() {
        return 'checked';
    }

    updateColor(value, was) {
        const classes = this.element.classList;

        if (was) {
            classes.remove(was);
        }

        if (value) {
            classes.add(value);
        }
    }

    getToggleGroupMembers() {
        const
            me = this,
            { checked, toggleGroup, input : checkedElement, type } = me,
            result = [];

        if (checked && toggleGroup) {
            DomHelper.forEachSelector(me.rootElement, `input[type=${type}][data-group=${toggleGroup}]`, inputEl => {
                if (inputEl !== checkedElement) {
                    const partnerCheckbox = Widget.fromElement(inputEl);
                    partnerCheckbox && result.push(partnerCheckbox);
                }
            });
        }

        return result;
    }

    uncheckToggleGroupMembers() {
        if (this.checked && this.toggleGroup) {
            this.getToggleGroupMembers().forEach(widget => widget.checked = false);
        }
    }

    /**
     * Check the box
     */
    check() {
        this.checked = true;
    }

    /**
     * Uncheck the box
     */
    uncheck() {
        this.checked = false;
    }

    /**
     * Toggle checked state. If you want to force a certain state, assign to {@link #property-checked} instead.
     */
    toggle() {
        this.checked = !this.checked;
    }

    //endregion

    //region Events

    internalOnClick(event) {
        // Native checkboxes has no readonly attribute, we prevent toggling it here instead
        if (this.readOnly) {
            event.preventDefault();
            return false;
        }

        /**
         * Fires when the checkbox is clicked
         * @event click
         * @param {Core.widget.Checkbox} source The checkbox
         * @param {Event} event DOM event
         */
        return this.trigger('click', { event });
    }

    /**
     * Triggers events when user toggles the checkbox
     * @fires beforeChange
     * @fires change
     * @fires action
     * @private
     */
    internalOnChange(event) {
        const me = this;

        // Chrome somehow sets checked state when re-enabling, have to reset that
        if (me.readOnly && me.value !== me.input.checked) {
            me.input.checked = me.value;
            return;
        }

        me.value = me.input.checked;

        if (!me.inputting) {
            me.inputting = true;

            me.triggerChange(true);

            me.inputting = false;
        }
    }

    // Need to catch changes even if readOnly, because of chrome behaviour when re-enabling
    updateInputReadOnly(readOnly) {}

    /**
     * Triggers events when checked state is changed
     * @fires beforeChange
     * @fires change
     * @fires action
     * @private
     */
    triggerChange(userAction) {
        const
            me = this,
            { checked } = me.input;

        /**
         * Fired before checkbox is toggled. Returning false from a listener prevents the checkbox from being toggled.
         * @event beforeChange
         * @preventable
         * @param {Core.widget.Checkbox} source Checkbox
         * @param {Boolean} checked Checked or not
         */

        /**
         * Fired when checkbox is toggled
         * @event change
         * @param {Core.widget.Checkbox} source Checkbox
         * @param {Boolean} checked Checked or not
         */
        // Prevent uncheck if this checkbox is part of a toggleGroup (radio-button mode) ..also ensure the group has
        // visible active members
        const
            eventObject  = { checked, value : checked, userAction, valid : true },
            prevented = (!checked && userAction && me.toggleGroup &&
                me.getToggleGroupMembers().filter(widget => widget.isVisible && !widget.disabled).length) ||
                // Since Widget has Events mixed in configured with 'callOnFunctions' this will also call onBeforeChange,
                // onChange and onAction
                me.trigger('beforeChange', eventObject) === false;

        // If prevented need to rollback the checkbox input
        if (prevented) {
            // Input change is not preventable, so need to revert the changes
            // The change event does not fire on programmatic change of input, so no need to suspend
            me.input.checked = me._value = !checked;
        }
        else {
            me.triggerFieldChange(eventObject, false);

            if (userAction) {
                me.uncheckToggleGroupMembers();
            }

            /**
             * User performed the default action (toggled the checkbox)
             * @event action
             * @param {Core.widget.Checkbox} source Checkbox
             * @param {Boolean} checked Checked or not
             */
            me.trigger('action', eventObject);
            me.trigger('change', eventObject);

            return true;
        }
    }

    //endregion
}

// Register this widget type with its Factory
Checkbox.initClass();
