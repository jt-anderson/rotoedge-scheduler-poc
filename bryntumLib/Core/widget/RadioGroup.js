import ObjectHelper from '../helper/ObjectHelper.js';
import FieldSet from './FieldSet.js';
import Widget from './Widget.js';

import './Radio.js';
import './layout/Box.js';

/**
 * @module Core/widget/RadioGroup
 */

/**
 * The `RadioGroup` widget contains a set of related `{@link Core/widget/Radio}` button widgets.
 *
 * For example, to present three choices and have the user select one of them:
 *
 * ```javascript
 *  {
 *      type    : 'radiogroup',
 *      title   : 'Resolve Conflict',
 *      name    : 'resolution',
 *      value   : 'A',  // the default choice
 *      options : {
 *          A : 'Keep the original version',
 *          B : 'Use the new version',
 *          C : 'Reconcile individual conflicts'
 *      }
 *  }
 * ```
 * The {@link #config-name} config is required for this widget and it will be assigned to all radio buttons created by
 * processing the {@link #config-options} config.
 *
 * ## Nested Items
 * Radio buttons can also have a {@link Core.widget.Radio#config-container} of additional
 * {@link Core.widget.Container#config-items}. These items can be displayed immediately following the field's label
 * (which is the default when there is only one item) or below the radio button. This can be controlled using the
 * {@link Core.widget.Radio#config-inline} config.
 *
 * In the demo below notice how additional fields are displayed for the checked radio button:
 *
 * {@inlineexample Core/widget/RadioGroup.js vertical}
 *
 * @extends Core/widget/FieldSet
 * @classType radiogroup
 */
export default class RadioGroup extends FieldSet {
    //region Config
    static get $name() {
        return 'RadioGroup';
    }

    // Factoryable type name
    static get type() {
        return 'radiogroup';
    }

    static get configurable() {
        return {
            defaultType : 'radio',

            /**
             * Set this to `true` so that clicking the currently checked radio button will clear the check from all
             * radio buttons in the group.
             * @config {Boolean}
             * @default false
             */
            clearable : null,

            /**
             * The name by which this widget's {@link #property-value} is accessed using the parent container's
             * {@link Core.widget.Container#property-values}.
             *
             * The config must be provided as it is used to set the {@link Core.widget.Radio#config-name} of the
             * child {@link Core.widget.Radio radio buttons}.
             * @config {String}
             */
            name : null,

            /**
             * The set of radio button options for this radio button group. This is a shorthand for defining these in
             * the {@link Core.widget.Container#config-items}. The keys of this object hold the radio button's
             * {@link Core.widget.Radio#config-checkedValue} while the object values are a string for the radio button's
             * {@link Core.widget.Radio#config-text} or a config object for that radio button.
             *
             * The {@link #property-value} of this radio button group will be one of the keys in this object or `null`
             * if no radio button is checked.
             *
             * For example, consider the following configuration:
             * ```javascript
             *  {
             *      type    : 'radiogroup',
             *      name    : 'resolution',
             *      value   : 'A',
             *      options : {
             *          A : 'Keep the original version',
             *          B : 'Use the new version',
             *          C : 'Reconcile individual conflicts'
             *      }
             *  }
             * ```
             *
             * The above is equivalent to this configuration below using {@link #config-items}:
             * ```javascript
             *  {
             *      type  : 'radiogroup',
             *      items : [{
             *          text         : 'Keep the original version',
             *          name         : 'resolution',
             *          ref          : 'resolution_A',
             *          checked      : true,
             *          checkedValue : 'A'
             *      }, {
             *          text         : 'Use the new version',
             *          name         : 'resolution',
             *          ref          : 'resolution_B',
             *          checkedValue : 'B'
             *      }, {
             *          text         : 'Reconcile individual conflicts',
             *          name         : 'resolution',
             *          ref          : 'resolution_C',
             *          checkedValue : 'C'
             *      }]
             *  }
             * ```
             * @config {Object} options
             */
            options : {
                value : null,

                $config : {
                    merge : 'items'
                }
            },

            defaultBindProperty : 'value'
        };
    }

    get existingOptions() {
        const { name } = this;

        return this.ensureItems().filter(c => c.name === name);
    }

    get refPrefix() {
        return `${this.name || this.ref || this.id}_`;
    }

    get selected() {
        return this.existingOptions.filter(c => c.input.checked)[0] || null;
    }

    /**
     * This property corresponds to the {@link Core.widget.Radio#config-checkedValue} of the currently
     * {@link Core.widget.Radio#property-checked} radio button.
     * @property {String}
     */
    get value() {
        const { selected } = this;

        return selected ? selected.checkedValue : null;
    }

    set value(v) {
        this.existingOptions.forEach(c => {
            c.checked = c.checkedValue === v;
        });
    }

    changeOptions(options, was) {
        if (!(options && was && ObjectHelper.isDeeplyEqual(was, options))) {
            return options;
        }
    }

    convertOption(key, option, existing) {
        const
            me       = this,
            { name } = me,
            ret      = {
                name,
                type         : 'radio',
                value        : key === me.value,
                ref          : `${me.refPrefix}${key}`,
                checkedValue : key
            };

        if (typeof option === 'string') {
            ret.text = option;
        }
        else {
            ObjectHelper.assign(ret, option);
        }

        return existing ? Widget.reconfigure(existing, ret) : ret;
    }

    isOurRadio(item) {
        // Radio groups could be nested using field containers, so we need isRadio and name equality check:
        return item.isRadio && item.name === this.name;
    }

    isolateFieldChange(field) {
        // if this is one of our radio buttons, swallow the field change:
        return this.isOurRadio(field);
    }

    onChildAdd(item) {
        super.onChildAdd(item);

        if (this.isOurRadio(item)) {
            item.on({
                name         : item.id,
                beforeChange : 'onRadioItemBeforeChange',
                change       : 'onRadioItemChange',
                click        : 'onRadioClick',
                thisObj      : this
            });
        }
    }

    onChildRemove(item) {
        if (this.isOurRadio(item)) {
            this.detachListeners(item.id);
        }

        super.onChildRemove(item);
    }

    onRadioClick(ev) {
        const { source } = ev;

        if (source.checked && this.clearable && source.clearable == null) {
            source.checked = false;
        }
    }

    onRadioItemBeforeChange(ev) {
        if (ev.checked) {
            const
                me = this,
                { lastValue } = me;

            if (!me.reverting && me.trigger('beforeChange', me.wrapRadioEvent(ev)) === false) {
                if (lastValue != null && lastValue !== me.value) {
                    me.reverting = true;

                    ev.source.uncheckToggleGroupMembers();
                    me.value = lastValue;
                    me.lastValue = lastValue;

                    me.reverting = false;

                    return false;
                }
            }
        }
    }

    onRadioItemChange(ev) {
        const me = this;

        if (ev.checked && !me.reverting) {
            me.triggerFieldChange(me.wrapRadioEvent(ev));
            me.lastValue = me.value;
        }
    }

    wrapRadioEvent(ev) {
        return {
            from       : ev,
            item       : ev.source,
            userAction : ev.userAction,
            lastValue  : this.lastValue,
            value      : this.value
        };
    }

    updateOptions() {
        const
            me                     = this,
            { options, refPrefix } = me,
            existingOptions        = me.existingOptions.reduce((m, c) => {
                m[c.ref.substring(refPrefix.length)] = c;
                return m;
            }, {});

        let index = 0,
            existing, key, option;

        if (options) {
            for (key in options) {
                option = me.convertOption(key, options[key], existingOptions[key]);

                delete existingOptions[key];
                me.insert(option, index++);
            }
        }

        existing = Object.values(existingOptions);

        if (existing?.length) {
            me.remove(existing);
            existing.forEach(c => c.destroy());
        }
    }

    //endregion
}

// Register this widget type with its Factory
RadioGroup.initClass();
