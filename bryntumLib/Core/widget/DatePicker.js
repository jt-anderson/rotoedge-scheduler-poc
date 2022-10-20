import CalendarPanel from './CalendarPanel.js';
import YearPicker from './YearPicker.js';
import DateHelper from '../helper/DateHelper.js';
import EventHelper from '../helper/EventHelper.js';
import Combo from './Combo.js';
import DomHelper from '../helper/DomHelper.js';
import './DisplayField.js';

const generateMonthNames = () => DateHelper.getMonthNames().map((m, i) => [i, m]);

class ReadOnlyCombo extends Combo {
    static get $name() {
        return 'ReadOnlyCombo';
    }

    static get type() {
        return 'readonlycombo';
    }

    static get configurable() {
        return {
            editable        : false,
            inputAttributes : {
                tag      : 'div',
                tabIndex : -1
            },
            highlightExternalChange : false,
            triggers                : {
                expand : false
            },
            picker : {
                align : {
                    align     : 't-b',
                    axisLock  : true,
                    matchSize : false
                },
                cls        : 'b-readonly-combo-list',
                scrollable : {
                    overflowX : false
                }
            }
        };
    }

    onSelect({ record }) {
        this.value = record.value;
    }

    set value(value) {
        const
            { store } = this,
            toAdd     = [];

        // the store must contain the value being set.
        // Fill in any gap.
        if (value < store.first.id) {
            for (let y = value; y < store.first.id; y++) {
                toAdd.push({ text : y });
            }
        }
        if (value > store.last.id) {
            for (let y = store.last.id + 1; y <= value; y++) {
                toAdd.push({ text : y });
            }
        }
        store.add(toAdd);
        super.value = value;
        this.input.innerHTML = this.input.value;
    }

    get value() {
        return super.value;
    }
}

ReadOnlyCombo.initClass();

/**
 * @module Core/widget/DatePicker
 */

/**
 * A Panel which can display a month of date cells, which navigates between the cells, fires events upon user selection
 * actions, optionally navigates to other months in response to UI gestures, and optionally displays information about
 * each date cell.
 *
 * This class is used by the {@link Core.widget.DateField} class.
 *
 * {@inlineexample Core/widget/DatePicker.js}
 *
 * ## Custom cell rendering
 * You can easily control the content of each date cell using the {@link #config-cellRenderer}. The example below shows
 * a view typically seen when booking hotel rooms or apartments.
 *
 * {@inlineexample Core/widget/DatePickerCellRenderer.js}
 *
 * @classtype datepicker
 * @extends Core/widget/CalendarPanel
 */
export default class DatePicker extends CalendarPanel {
    static get $name() {
        return 'DatePicker';
    }

    // Factoryable type name
    static get type() {
        return 'datepicker';
    }

    static get delayable() {
        return {
            refresh : 'raf'
        };
    }

    static get configurable() {
        return {
            /**
             * The date that the user has navigated to using the UI *prior* to setting the widget's
             * value by selecting.
             *
             * This may be changed using keyboard navigation. The {@link Core.widget.CalendarPanel#property-date} is set
             * by pressing `ENTER` when the desired date is reached.
             *
             * Programmatically setting the {@link Core.widget.CalendarPanel#config-date}, or using the UI to select the date
             * by clicking it also sets the `activeDate`
             * @config {Date}
             */
            activeDate : {
                value   : null,
                $config : {
                    equal : 'date'
                }
            },

            focusable   : true,
            textContent : false,
            tbar        : {
                overflow : null,
                items    : {
                    prevYear : {
                        cls      : 'b-icon b-icon-first',
                        onAction : 'up.gotoPrevYear',
                        tooltip  : 'L{DatePicker.gotoPrevYear}'
                    },
                    prevMonth : {
                        cls      : 'b-icon b-icon-previous',
                        onAction : 'up.gotoPrevMonth',
                        tooltip  : 'L{DatePicker.gotoPrevMonth}'
                    },
                    fields : {
                        type  : 'container',
                        flex  : 1,
                        cls   : 'b-datepicker-title',
                        items : {
                            monthField : {
                                type      : 'readonlycombo',
                                cls       : 'b-datepicker-monthfield',
                                items     : generateMonthNames(),
                                listeners : {
                                    select : 'up.onMonthPicked'
                                }
                            },
                            yearButton : {
                                type      : 'button',
                                cls       : 'b-datepicker-yearbutton',
                                listeners : {
                                    click : 'up.onYearPickerRequested'
                                }
                            }
                        }
                    },
                    nextMonth : {
                        cls      : 'b-icon b-icon-next',
                        onAction : 'up.gotoNextMonth',
                        tooltip  : 'L{DatePicker.gotoNextMonth}'
                    },
                    nextYear : {
                        cls      : 'b-icon b-icon-last',
                        onAction : 'up.gotoNextYear',
                        tooltip  : 'L{DatePicker.gotoNextYear}'
                    }
                }
            },

            yearPicker : {
                value : {
                    type            : 'YearPicker',
                    yearButtonCount : 16,
                    trapFocus       : true,
                    positioned      : true,
                    hidden          : true,
                    listeners       : {
                        titleClick : 'up.onYearPickerTitleClick',
                        select     : 'up.onYearPicked'
                    }
                },
                $config : 'lazy'
            },

            /**
             * The initially selected date.
             * @config {Date}
             * @default
             */
            date : new Date(),

            /**
             * The minimum selectable date. Selection of and navigation to dates prior
             * to this date will not be possible.
             * @config {Date}
             */
            minDate : {
                value   : null,
                $config : {
                    equal : 'date'
                }
            },

            /**
             * The maximum selectable date. Selection of and navigation to dates after
             * this date will not be possible.
             * @config {Date}
             */
            maxDate : {
                value   : null,
                $config : {
                    equal : 'date'
                }
            },

            /**
             * By default, disabled dates cannot be navigated to, and they are skipped over
             * during keyboard navigation. Configure this as `true` to enable navigation to
             * disabled dates.
             * @config {Boolean}
             * @default
             */
            focusDisabledDates : null,

            /**
             * Configure as `true` to enable selecting a single date range by selecting a
             * start and end date. Hold "SHIFT" button to select date range.
             * @config {Boolean}
             * @default
             */
            multiSelect : false,

            /**
             * By default, the month and year are editable. Configure this as `false` to prevent that.
             * @config {Boolean}
             * @default
             */
            editMonth : true,

            /**
             * The {@link Core.helper.DateHelper} format string to format the day names.
             * @config {String}
             * @default
             */
            dayNameFormat : 'dd',

            trapFocus : true,

            role : 'grid',

            focusDescendant : true
        };
    }

    static get prototypeProperties() {
        return {
            /**
             * The class name to add to the calendar cell whose date which is outside of the
             * {@link #config-minDate}/{@link #config-maxDate} range.
             * @config {String}
             * @private
             */
            outOfRangeCls : 'b-out-of-range',

            /**
             * The class name to add to the currently focused calendar cell.
             * @config {String}
             * @private
             */
            activeCls : 'b-active-date',

            /**
             * The class name to add to selected calendar cells.
             * @config {String}
             * @private
             */
            selectedCls : 'b-selected-date'
        };
    }

    /**
     * Fires when a date is selected. If {@link #config-multiSelect} is specified, this
     * will fire upon deselection and selection of dates.
     * @event selectionChange
     * @param {Date[]} selection The selected date. If {@link #config-multiSelect} is specified
     * this may be a two element array specifying start and end dates.
     * @param {Boolean} userAction This will be `true` if the change was caused by user interaction
     * as opposed to programmatic setting.
     */

    /* ...disconnect doc comment above from method below... */

    // region Init

    construct(config) {
        const me = this;

        me.selection = config.date ? [config.date] : [];
        super.construct(config);

        me.externalCellRenderer = me.cellRenderer;
        me.cellRenderer         = me.internalCellRenderer;

        me.element.setAttribute('aria-activedescendant', `${me.id}-active-day`);
        me.weeksElement.setAttribute('role', 'grid');
        me.weekElements.forEach(w => w.setAttribute('role', 'row'));
        me.element.setAttribute('ariaLabelledBy', me.widgetMap.fields.id);

        EventHelper.on({
            element : me.weeksElement,
            click   : {
                handler  : 'onCellClick',
                delegate : `.${me.dayCellCls}:not(.${me.disabledCls}):not(.${me.outOfRangeCls})`
            },
            mousedown : {
                handler  : 'onCellMousedown',
                delegate : `.${me.dayCellCls}`
            },
            thisObj : me
        });

        me.widgetMap.monthField.readOnly = me.widgetMap.yearButton.disabled = !me.editMonth;
    }

    afterHide() {
        this._yearPicker?.hide();
        super.afterHide(...arguments);
    }

    doDestroy() {
        this.yearButton?.destroy();
        this.monthField?.destroy();
        super.doDestroy();
    }

    // endregion

    get focusElement() {
        return this.weeksElement.querySelector(`.${this.dayCellCls}[tabIndex="0"]`);
    }

    doRefresh() {
        const
            me             = this,
            { activeDate } = me,
            activeCell     = me.getCell(activeDate);

        super.doRefresh(...arguments);

        // Make the width wide enough to accommodate the longest month name
        me.widgetMap.fields.element.style.minWidth = `${me.longestMonth + 5.5}ex`;

        // The position of the cell may have changed, so the "from" cell must
        // be identified by the date that is stamped into it after the refresh..
        me.updateActiveDate(me.activeDate, DateHelper.parseKey(activeCell?.dataset.date));
    }

    internalCellRenderer({ cell, date }) {
        const
            me            = this,
            {
                activeCls,
                selectedCls,
                externalCellRenderer
            }             = me,
            cellClassList = {
                [activeCls]        : me.isActiveDate(date),
                [selectedCls]      : me.isSelectedDate(date),
                [me.outOfRangeCls] : (me.minDate && date < me.minDate) || (me.maxDate && date > me.maxDate)
            };

        DomHelper.updateClassList(cell, cellClassList);

        // Must replace entire content in case we have an externalCellRenderer
        cell.innerHTML = date.getDate();
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', DateHelper.format(date, 'MMMM D, YYYY'));

        if (me.isActiveDate(date)) {
            cell.id = `${me.id}-active-day`;
        }
        else {
            cell.removeAttribute('id');
        }

        if (externalCellRenderer) {
            me.callback(externalCellRenderer, this, arguments);
        }
    }

    onCellMousedown(event) {
        const cell = event.target.closest('[data-date]');

        event.preventDefault();
        cell.focus();

        // Flag to prevent the view from shifting below the mouse pointer if what they click
        // on is in the "other" month. The updateActiveDate must not move our Month object
        // to match which would cause a refresh, and mean that the click would happen in a different date.
        this.inCellMousedown = true;
        this.activeDate = DateHelper.parseKey(cell.dataset.date);
        this.inCellMousedown = false;
    }

    onCellClick(event) {
        const cell = event.target.closest('[data-date]');
        this.onUIDateSelect(DateHelper.parseKey(cell.dataset.date), event);
    }

    onMonthDateChange({ newDate, changes }) {
        // Keep header widgets synced with our month
        if (changes.m || changes.y) {
            this.widgetMap.monthField.value = newDate.getMonth();
            this.widgetMap.yearButton.text  = newDate.getFullYear();
        }
        super.onMonthDateChange(...arguments);
    }

    /**
     * Called when the user uses the UI to select the current activeDate. So ENTER when focused
     * or clicking a date cell.
     * @param {Date} date The active date to select
     * @param {Event} event the instigating event, either a `click` event or a `keydown` event.
     * @internal
     */
    onUIDateSelect(date, event) {
        const
            me                             = this,
            { lastClickedDate, selection } = me;

        me.lastClickedDate = date;

        if (!me.isDisabledDate(date)) {
            me.activatingEvent = event;

            // Handle multi selecting.
            // * single contiguous date range, eg: an event start and end
            // * multiple discontiguous ranges
            if (me.multiSelect) {
                if (me.multiRange) {
                    // TODO: multiple date ranges
                }
                else if (!lastClickedDate || !DateHelper.isSameDate(date, lastClickedDate)) {
                    if (lastClickedDate && event.shiftKey) {
                        selection[1] = date;
                        selection.sort();
                    }
                    else {
                        selection.length = 0;
                        selection[0] = date;
                    }

                    me.trigger('selectionChange', {
                        selection,
                        userAction : Boolean(event)
                    });
                }
            }
            else {
                if (!me.value || me.value.getTime() !== date.getTime()) {
                    me.value = date;
                }
                else if (me.floating) {
                    me.hide();
                }
            }

            me.activatingEvent = null;
        }
    }

    onInternalKeyDown(keyEvent) {
        const
            me         = this,
            keyName    = keyEvent.key.trim() || keyEvent.code,
            activeDate = me.activeDate;

        let newDate    = new Date(activeDate);

        if (keyName === 'Escape' && me.floating) {
            return me.hide();
        }

        // Only navigate if not focused on one of our child widgets.
        // We have a prevMonth and nextMonth tool and possibly month and year pickers.
        if (activeDate && me.weeksElement.contains(keyEvent.target)) {
            do {
                switch (keyName) {
                    case 'ArrowLeft':
                        // Disable browser use of this key.
                        // Ctrl+ArrowLeft navigates back.
                        // ArrowLeft scrolls if there is horizontal scroll.
                        keyEvent.preventDefault();

                        if (keyEvent.ctrlKey) {
                            newDate = me.gotoPrevMonth();
                        }
                        else {
                            newDate.setDate(newDate.getDate() - 1);
                        }
                        break;
                    case 'ArrowUp':
                        // Disable browser use of this key.
                        // ArrowUp scrolls if there is vertical scroll.
                        keyEvent.preventDefault();

                        newDate.setDate(newDate.getDate() - 7);
                        break;
                    case 'ArrowRight':
                        // Disable browser use of this key.
                        // Ctrl+ArrowRight navigates forwards.
                        // ArrowRight scrolls if there is horizontal scroll.
                        keyEvent.preventDefault();

                        if (keyEvent.ctrlKey) {
                            newDate = me.gotoNextMonth();
                        }
                        else {
                            newDate.setDate(newDate.getDate() + 1);
                        }
                        break;
                    case 'ArrowDown':
                        // Disable browser use of this key.
                        // ArrowDown scrolls if there is vertical scroll.
                        keyEvent.preventDefault();

                        newDate.setDate(newDate.getDate() + 7);
                        break;
                    case 'Enter':
                        return me.onUIDateSelect(activeDate, keyEvent);
                }
            } while (me.isDisabledDate(newDate) && !me.focusDisabledDates);

            // Don't allow navigation to outside of date bounds.
            if (me.minDate && newDate < me.minDate) {
                return;
            }
            if (me.maxDate && newDate > me.maxDate) {
                return;
            }
            me.activeDate = newDate;
        }
    }

    changeMinDate(minDate) {
        return minDate ? this.changeDate(minDate) : null;
    }

    updateMinDate(minDate) {
        this._yearpicker && (this._yearpicker.minYear = minDate?.getFullYear());
        this.refresh();
    }

    changeMaxDate(maxDate) {
        return maxDate ? this.changeDate(maxDate) : null;
    }

    updateMaxDate(maxDate) {
        this._yearpicker && (this._yearpicker.maxYear = maxDate?.getFullYear());
        this.refresh();
    }

    updateDate(date) {
        this.activeDate = date;
        super.updateDate(date);
    }

    changeActiveDate(activeDate) {
        activeDate =  activeDate ? this.changeDate(activeDate) : this.date || (this.date = DateHelper.clearTime(new Date()));

        if (isNaN(activeDate)) {
            throw new Error('DatePicker date ingestion must be passed a Date, or a YYYY-MM-DD date string');
        }

        return activeDate;
    }

    updateActiveDate(activeDate, wasActiveDate) {
        const
            me            = this,
            {
                activeCls,
                refreshCount
            } = me,
            wasActiveCell = wasActiveDate && me.getCell(wasActiveDate);

        if (refreshCount) {
            // Initial set, and month change and year change can set active date to outside
            // rendered block, so we must ensure its refreshed.
            // Only insist on finding a *NON* "other month" cell (strict parameter to getCell)
            // if a keyboard gesture, or top toolbar gesture is causing the interaction.
            // A cell mousedown-caused focus must not change month so that the impending click
            // is fired on an unchanged cell.
            if (!me.getCell(activeDate, !me.inCellMousedown)) {
                // Use the strict flag to see if the active date is owned by this month
                const isOtherMonth = !me.getCell(activeDate, true);

                // Month's date setter protects it from non-changes.
                me.month.date = activeDate;
                me.refresh.now();

                if (isOtherMonth && me.animateTimeShift && !me.hidden) {
                    DomHelper.slideIn(me.contentElement, activeDate > wasActiveDate ? 1 : -1);
                }
            }

            const activeCell = me.getCell(activeDate);

            activeCell.setAttribute('tabIndex', 0);
            activeCell.classList.add(activeCls);
            activeCell.id = `${me.id}-active-day`;

            if (me.weeksElement.contains(DomHelper.getActiveElement(me.element))) {
                activeCell.focus();
            }

            if (wasActiveCell && wasActiveCell !== activeCell) {
                wasActiveCell.removeAttribute('tabIndex');
                wasActiveCell.classList.remove(activeCls);
                wasActiveCell.removeAttribute('id');
            }
        }
        else {
            me.month.date = activeDate;
        }
    }

    set value(value) {
        const
            me = this,
            { selection } = me;

        let changed;

        if (value) {
            value = me.changeDate(value, me.value);

            // Undefined return value means no change
            if (value === undefined) {
                return;
            }

            if (!me.value || value.getTime() !== me.value.getTime()) {
                selection.length = 0;
                selection[0] = value;
                changed = true;
            }
            me.date = value;
        }
        else {
            changed = selection.length;
            selection.length = 0;

            // Clearing the value - go to today's calendar
            me.date = new Date();
        }

        if (changed) {
            // A refresh needs to be scheduled if the selection changes.
            // The base class's onMonthDateChange only refreshes if the year or month change.
            me.refresh();

            me.trigger('selectionChange', {
                selection,
                userAction : Boolean(me.activatingEvent)
            });
        }
    }

    get value() {
        return this.selection[this.selection.length - 1];
    }

    gotoPrevYear() {
        return this.goto(-1, 'year');
    }

    gotoPrevMonth() {
        return this.goto(-1, 'month');
    }

    gotoNextMonth() {
        return this.goto(1, 'month');
    }

    gotoNextYear() {
        return this.goto(1, 'year');
    }

    goto(direction, unit) {
        const
            me                  = this,
            { activeDate }      = me,
            // Navigate from the activeDate if the activeDate is in the UI.
            baseDate            = activeDate && me.getCell(activeDate) ? activeDate : me.date,
            newDate             = DateHelper.add(baseDate, direction, unit),
            firstDateOfNewMonth = new Date(newDate);

        firstDateOfNewMonth.setDate(1);

        const lastDateOfNewMonth  = DateHelper.add(DateHelper.add(firstDateOfNewMonth, 1, 'month'), -1, 'day');

        // Don't navigate if month is outside bounds
        if ((me.minDate && direction < 0 && lastDateOfNewMonth < me.minDate) || (me.maxDate && direction > 0 && firstDateOfNewMonth > me.maxDate)) {
            return;
        }
        return me.date = newDate;
    }

    isActiveDate(date) {
        return this.activeDate && this.changeDate(date).getTime() === this.activeDate.getTime();
    }

    isSelectedDate(date) {
        return this.selection.some(d => DateHelper.isEqual(d, date, 'day'));
    }

    onMonthPicked({ record, userAction }) {
        this.activeDate = DateHelper.add(this.activeDate, record.value - this.activeDate.getMonth(), 'month');
        if (userAction) {
            this.focusElement?.focus();
        }
    }

    onYearPickerRequested() {
        const { yearPicker } = this;

        if (yearPicker.isVisible) {
            yearPicker.hide();
        }
        else {
            yearPicker.year = yearPicker.startYear = this.activeDate.getFullYear();
            yearPicker.show();
            yearPicker.focus();
        }
    }

    onYearPickerTitleClick() {
        this.yearPicker.hide();
    }

    onYearPicked({ value, source }) {
        const newDate = new Date(this.activeDate);

        newDate.setFullYear(value);
        this.activeDate = newDate;

        // Move focus without scroll *before* focus reversion from the hide.
        // Browser behaviour of scrolling to focused element would break animation.
        this.focusElement && DomHelper.focusWithoutScrolling(this.focusElement);
        source.hide();
    }

    changeYearPicker(yearPicker, oldYearPicker) {
        return YearPicker.reconfigure(oldYearPicker, yearPicker ? YearPicker.mergeConfigs({
            owner    : this,
            appendTo : this.element,
            minYear  : this.minDate?.getFullYear(),
            maxYear  : this.maxDate?.getFullYear()
        }, yearPicker) : null, this);
    }

    get childItems() {
        const
            { _yearPicker } = this,
            result          = super.childItems;

        if (_yearPicker) {
            result.push(_yearPicker);
        }

        return result;
    }

    updateLocalization() {
        const
            {
                fields,
                monthField
            }          = this.widgetMap,
            newData    = generateMonthNames();

        this.longestMonth = Math.max(...newData.map(d => d[1].length));

        if (!this.isConfiguring) {
            newData[monthField.value].selected = true;
            monthField.items = newData;
        }

        super.updateLocalization();

        // Make the width wide enough to accommodate the longest month name
        fields.element.style.minWidth = `${this.longestMonth + 5.5}ex`;
    }
}

// Register this widget type with its Factory
DatePicker.initClass();
