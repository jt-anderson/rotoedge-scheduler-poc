import Popup from './Popup.js';
import DateHelper from '../helper/DateHelper.js';
import './NumberField.js';

/**
 * @module Core/widget/TimePicker
 */

/**
 * A Popup which displays hour and minute number fields and AM/PM switcher buttons for 12 hour time format.
 *
 * ```javascript
 * new TimeField({
 *     label     : 'Time field',
 *     appendTo  : document.body,
 *     // Configure the time picker
 *     picker    : {
 *         items : {
 *             minute : {
 *                 step : 5
 *             }
 *         }
 *     }
 * });
 * ```
 * ## Contained widgets
 *
 * The default widgets contained in this picker are:
 *
 * | Widget ref | Type                                        | Description      |
 * |------------|---------------------------------------------|------------------|
 * | `hour`     | {@link Core.widget.NumberField NumberField} | The hour field   |
 * | `minute`   | {@link Core.widget.NumberField NumberField} | The minute field |
 * | `amButton` | {@link Core.widget.Button Button}           | The am button    |
 * | `pmButton` | {@link Core.widget.Button Button}           | The pm button    |
 *
 * This class is not intended for use in applications. It is used internally by the {@link Core.widget.TimeField} class.
 *
 * @classType timepicker
 * @extends Core/widget/Popup
 */
export default class TimePicker extends Popup {

    //region Config
    static get $name() {
        return 'TimePicker';
    }

    // Factoryable type name
    static get type() {
        return 'timepicker';
    }

    static get defaultConfig() {
        return {
            items : {
                hour : {
                    label                   : 'L{TimePicker.hour}',
                    type                    : 'number',
                    min                     : 0,
                    max                     : 23,
                    highlightExternalChange : false,
                    format                  : '2>9'
                },
                label  : { html : ':' },
                minute : {
                    label                   : 'L{TimePicker.minute}',
                    type                    : 'number',
                    min                     : 0,
                    max                     : 59,
                    highlightExternalChange : false,
                    format                  : '2>9'
                },
                amButton : {
                    type        : 'button',
                    text        : 'AM',
                    toggleGroup : 'am-pm',
                    cls         : 'b-blue'
                },
                pmButton : {
                    type        : 'button',
                    text        : 'PM',
                    toggleGroup : 'am-pm',
                    cls         : 'b-blue'
                }
            },

            autoShow : false,

            trapFocus : true,

            /**
             * Default time value
             * @config {Date}
             */
            value : DateHelper.getTime(0),

            /**
             * Time format. Used to set appropriate 12/24 hour format to display.
             * See Core.helper.DateHelper#format for formatting options.
             * @config {String}
             */
            format : null
        };
    }

    //endregion

    //region Init

    /**
     * Fires when a time is changed.
     * @event timeChange
     * @param {Date} time The selected time.
     */
    construct(config) {
        super.construct(config);

        const
            me                                   = this,
            { hour, minute, amButton, pmButton } = me.widgetMap;

        me._pm = false;
        hour.on('change', me.onFieldChange, me);
        minute.on('change', me.onFieldChange, me);
        amButton.on('click', me.onAmButtonClick, me);
        pmButton.on('click', me.onPmButtonClick, me);

        me.refresh();
    }

    //endregion

    //region Event listeners

    onFieldChange() {
        if (this._time) {
            this.value = this.pickerToTime();
        }
    }

    onAmButtonClick() {
        const me = this;
        me._pm   = false;
        if (me._time) {
            me.value = me.pickerToTime();
        }
    }

    onPmButtonClick() {
        const me = this;
        me._pm   = true;
        if (me._time) {
            me.value = me.pickerToTime();
        }
    }

    onInternalKeyDown(keyEvent) {
        const me = this;

        switch (keyEvent.key) {
            case 'Escape':
                // Support for undefined initial time
                me.triggerTimeChange(me._initialValue);
                me.hide();
                keyEvent.preventDefault();
                return;
            case 'Enter':
                me.value = me.pickerToTime();
                me.hide();
                keyEvent.preventDefault();
                return;
        }

        super.onInternalKeyDown(keyEvent);
    }

    //endregion

    //region Internal functions

    pickerToTime() {
        const
            me               = this,
            pm               = me._pm,
            { hour, minute } = me.widgetMap;

        hour.format = me._is24Hour ? '2>9' : null;

        let hours    = hour.value,
            newValue = new Date(me._time);

        if (!me._is24Hour) {
            if (pm && hours < 12) hours = hours + 12;
            if (!pm && hours === 12) hours = 0;
        }

        newValue.setHours(hours);
        newValue.setMinutes(minute.value);

        if (me._min) {
            newValue = DateHelper.max(me._min, newValue);
        }
        if (me._max) {
            newValue = DateHelper.min(me._max, newValue);
        }

        return newValue;
    }

    triggerTimeChange(time) {
        this.trigger('timeChange', { time });
    }

    //endregion

    //region Getters / Setters

    /**
     * Get/set value, which can be a Date or a string. If a string is specified, it will be converted using the
     * specified {@link #config-format}
     * @property {Date}
     * @accepts {Date|String}
     */
    set value(newTime) {
        const me = this;
        let changed = false;

        if (!newTime || !me._time) {
            me._time = TimePicker.defaultConfig.value;
            changed  = true;
        }
        else if (newTime.getTime() !== me._time.getTime()) {
            me._time = newTime;
            changed  = true;
        }

        if (changed) {
            if (me.isVisible) {
                me.triggerTimeChange(me.value);
            }
            me.refresh();
        }
    }

    get value() {
        return this._time;
    }

    /**
     * Get/Set format for time displayed in field (see Core.helper.DateHelper#format for formatting options)
     * @property {String}
     */
    set format(value) {
        const me = this;
        me._format = value;
        me._is24Hour = DateHelper.is24HourFormat(me._format);
        me.refresh();
    }

    get format() {
        return this._format;
    }

    /**
     * Get/set max value, which can be a Date or a string. If a string is specified, it will be converted using the
     * specified {@link #config-format}
     * @property {Date}
     * @accepts {Date|String}
     */
    set min(value) {
        this._min = value;
    }

    get min() {
        return this._min;
    }

    /**
     * Get/set min value, which can be a Date or a string. If a string is specified, it will be converted using the
     * specified {@link #config-format}
     * @property {Date}
     * @accepts {Date|String}
     */
    set max(value) {
        this._max = value;
    }

    get max() {
        return this._max;
    }

    /**
     * Get/set initial value and value, which can be a Date or a string. If a string is specified,
     * it will be converted using the specified {@link #config-format}. Initial value is restored on Escape click
     * @property {Date}
     * @accepts {Date|String}
     */
    set initialValue(value) {
        this.value = value;
        this._initialValue = value;
    }

    get initialValue() {
        return this._initialValue;
    }

    //endregion

    //region Display

    refresh() {
        const me = this;

        if (!me.isConfiguring) {
            const
                { hour, minute, amButton, pmButton } = me.widgetMap,
                time                                 = me._time,
                is24                                 = me._is24Hour,
                hours                                = time.getHours(),
                pm                                   = me._pm = hours >= 12;

            me.element.classList[is24 ? 'add' : 'remove']('b-24h');

            hour.min         = is24 ? 0 : 1;
            hour.max         = is24 ? 23 : 12;
            hour.value       = is24 ? hours : (hours % 12) || 12;
            minute.value     = time.getMinutes();
            amButton.pressed = !pm;
            pmButton.pressed = pm;
            amButton.hidden  = pmButton.hidden = is24;
        }
    }

    //endregion

}

// Register this widget type with its Factory
TimePicker.initClass();
