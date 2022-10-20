import Panel from './Panel.js';
import ArrayHelper from '../helper/ArrayHelper.js';
import DateHelper from '../helper/DateHelper.js';
import Month from '../util/Month.js';
import Tooltip from './Tooltip.js';
import ObjectHelper from '../helper/ObjectHelper.js';
import DomHelper from '../helper/DomHelper.js';

/**
 * @module Core/widget/CalendarPanel
 */

/**
 * A Panel which displays a month of date cells.
 *
 * This is a base class for UI widgets like {@link Core.widget.DatePicker} which need to display a calendar layout
 * and should not be used directly.
 * @extends Core/widget/Panel
 */
export default class CalendarPanel extends Panel {
    static get $name() {
        return 'CalendarPanel';
    }

    // Factoryable type name
    static get type() {
        return 'calendarpanel';
    }

    static get configurable() {
        return {
            textContent : false,

            /**
             * Gets or sets the date that orientates the panel to display a particular month.
             * Changing this causes the content to be refreshed.
             * @member {Date} date
             */
            /**
             * The date which this CalendarPanel encapsulates.
             * @config {Date|String}
             */
            date : {
                $config : {
                    equal : 'date'
                },
                value : null
            },

            /**
             * A {@link Core.util.Month} Month utility object which encapsulates this Panel's month
             * and provides contextual information and navigation services.
             * @config {Core.util.Month|Object}
             */
            month : {},

            year : null,

            /**
             * The week start day, 0 meaning Sunday, 6 meaning Saturday.
             * Defaults to {@link Core.helper.DateHelper#property-weekStartDay-static}.
             * @config {Number}
             */
            weekStartDay : null,

            /**
             * Configure as `true` to always show a six week calendar.
             * @config {Boolean}
             * @default
             */
            sixWeeks : true,

            /**
             * Configure as `true` to show a week number column at the start of the calendar block.
             * @deprecated Since 4.0.0. Use {@link #config-showWeekColumn} instead.
             * @config {Boolean}
             */
            showWeekNumber : null,

            /**
             * Configure as `true` to show a week number column at the start of the calendar block.
             * @config {Boolean}
             */
            showWeekColumn : null,

            /**
             * Either an array of `Date` objects which are to be disabled, or
             * a function (or the name of a function), which, when passed a `Date` returns `true` if the
             * date is disabled.
             * @config {Function|Date[]|String}
             */
            disabledDates : null,

            /**
             * A function (or the name of a function) which creates content in, and may mutate a day header element.
             * The following parameters are passed:
             *  - cell [HTMLElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement) The header element.
             *  - day [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) The day number conforming to the specified {@link #config-weekStartDay}. Will be in the range 0 to 6.
             *  - weekDay [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) The canonical day number where Monday is 0 and Sunday is.
             * @config {Function|String}
             */
            headerRenderer : null,

            /**
             * A function (or the name of a function) which creates content in, and may mutate the week cell element at the start of a week row.
             * The following parameters are passed:
             *  - cell [HTMLElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement) The header element.
             *  - week [Number[]](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) An array containing `[year, weekNumber]`.
             * @config {Function|String}
             */
            weekRenderer : null,

            /**
             * A function (or the name of a function) which creates content in, and may mutate a day cell element.
             * The following parameters are passed:
             *  - cell [HTMLElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement) The header element.
             *  - date [Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date) The date for the cell.
             *  - day [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) The day for the cell (0 to 6 for Sunday to Saturday).
             *  - rowIndex [Number[]](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) The row index, 0 to month row count (6 if {@link #config-sixWeeks} is `true`).
             *  _ row [HTMLElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement) The row element encapsulating the week which the cell is a part of.
             *  - cellIndex [Number[]](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) The cell index in the whole panel. May be from 0 to up to 42.
             *  - columnIndex [Number[]](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) The column index, 0 to 6.
             *  - visibleColumnIndex [Number[]](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number) The visible column index taking hidden non working days into account.
             * @config {Function|String}
             */
            cellRenderer : null,

            /**
             * Configure as `true` to render weekends as {@link #config-disabledDates}.
             * @config {Boolean}
             */
            disableWeekends : null,

            hideNonWorkingDays : null,

            hideNonWorkingDaysCls : 'b-hide-nonworking-days',

            /**
             * Non-working days as an object where keys are day indices, 0-6 (Sunday-Saturday), and the value is `true`.
             * Defaults to {@link Core.helper.DateHelper#property-nonWorkingDays-static}.
             * @config {Object}
             */
            nonWorkingDays : null,

            /**
             * A config object to create a tooltip which will show on hover of a date cell
             * including disabled, weekend, and "other month" cells.
             *
             * It is the developer's responsibility to hook the `beforeshow` event
             * to either veto the show by returning `false` or provide contextual
             * content for the date.
             *
             * The tip instance will be primed with a `date` property.
             * @config {Object}
             */
            tip : null,

            dayCellCls   : 'b-calendar-cell',
            dayHeaderCls : 'b-calendar-day-header',

            /**
             * The class name to add to disabled calendar cells.
             * @config {String}
             * @private
             */
            disabledCls : 'b-disabled-date',

            /**
             * The class name to add to calendar cells which are in the previous or next month.
             * @config {String}
             * @private
             */
            otherMonthCls : 'b-other-month',

            /**
             * The class name to add to calendar cells which are weekend dates.
             * @config {String}
             * @private
             */
            weekendCls : 'b-weekend',

            /**
             * The class name to add to the calendar cell which contains today's date.
             * @config {String}
             * @private
             */
            todayCls : 'b-today',

            /**
             * The class name to add to calendar cells which are {@link #config-nonWorkingDays}.
             * @config {String}
             * @private
             */
            nonWorkingDayCls : 'b-nonworking-day',

            /**
             * The {@link Core.helper.DateHelper DateHelper} format string to format the day names.
             * @config {String}
             * @default
             */
            dayNameFormat : 'ddd',

            /**
             * By default, week rows flex to share available Panel height equally.
             *
             * Set this config if the available height is too small, and the cell height needs
             * to be larger to show events.
             *
             * Setting this config causes the month grid to become scrollable in the `Y` axis.
             *
             * May be specified as a number in which case it will be taken to mean pixels,
             * or a length in standard CSS units.
             * @config {Number|String}
             */
            minRowHeight : {
                $config : ['lazy'],
                value   : null
            },

            /**
             * By default, day cells flex to share available Panel width equally.
             *
             * Set this config if the available width is too small, and the cell width needs
             * to be larger to show events.
             *
             * Setting this config causes the month grid to become scrollable in the `X` axis.
             * @config {Number}
             */
            minColumnWidth : {
                $config : ['lazy'],
                value   : null
            },

            /**
             * Configure this as true to disable pointer interaction with cells which are outside the
             * range of the current month.
             * @config {Boolean}
             */
            disableOtherMonthCells : null,

            disableOtherMonthCellsCls : 'b-disable-othermonth-cells',

            /**
             * Configure this as `true` to hide cells which are outside the range of the current month.
             * @config {Boolean}
             */
            hideOtherMonthCells : null,

            hideOtherMonthCellsCls : 'b-hide-othermonth-cells',

            /**
             * By default, when the {@link #property-date} changes, the UI will only refresh
             * if it doesn't contain a cell for that date, so as to keep a stable UI when
             * navigating.
             *
             * Configure this as `true` to refresh the UI whenever the month changes, even if
             * the UI already shows that date.
             * @config {Boolean}
             * @internal
             */
            alwaysRefreshOnMonthChange : null,

            /**
             * By default, when navigating through time, the next time
             * block will be animated in from the appropriate direction.
             *
             * Configure this as `false` to disable this.
             * @prp {Boolean} animateTimeShift
             * @default
             */
            animateTimeShift : true
        };
    }

    construct(config) {
        super.construct(config);

        if (!this.refreshCount) {
            this.refresh();
        }
    }

    onPaint({ firstPaint }) {
        super.onPaint?.(...arguments);

        // Invoke the lazy configs when we first hit the visible DOM
        if (firstPaint) {
            // The cell structure must exist for the configs to apply to.
            if (!this.refreshCount) {
                this.refresh();
            }
            this.getConfig('minColumnWidth');
            this.getConfig('minRowHeight');
        }
    }

    get overflowElement() {
        return this.weeksElement;
    }

    doDestroy() {
        this.tip?.destroy();

        super.doDestroy();
    }

    changeMinRowHeight(minRowHeight) {
        // Fall back to 75 on platforms that do not support CSS vars
        const minValue = parseInt(DomHelper.getStyleValue(this.element, '--min-row-height'), 10) || 75;

        return isNaN(minRowHeight) ? minRowHeight : Math.max(parseInt(minRowHeight) || 0, minValue);
    }

    updateMinRowHeight(minRowHeight) {
        this.weekElements.forEach(w => DomHelper.setLength(w, 'minHeight', minRowHeight));

        this.scrollable = {
            overflowY : minRowHeight ? 'auto' : false
        };
    }

    changeMinColumnWidth(minColumnWidth) {
        // Fall back to 75 on platforms that do not support CSS vars
        const minValue = parseInt(DomHelper.getStyleValue(this.element, '--min-column-width'), 10) || 75;

        return minColumnWidth == null ? minColumnWidth : Math.max(parseInt(minColumnWidth) || 0, minValue);
    }

    updateMinColumnWidth(minColumnWidth) {
        const me = this;

        me.weekdayCells.forEach(c => DomHelper.setLength(c, 'minWidth', minColumnWidth));
        me.cellElements.forEach(c => c.matches(`.${me.dayCellCls}`) && DomHelper.setLength(c, 'minWidth', minColumnWidth));

        me.scrollable = {
            overflowX : minColumnWidth ? 'auto' : false
        };
        me.overflowElement.classList[minColumnWidth ? 'add' : 'remove']('b-min-columnwidth');
    }

    getDateFromDomEvent(domEvent) {
        const element = (domEvent.nodeType === Element.ELEMENT_NODE ? domEvent : domEvent.target).closest(`#${this.id} [data-date]`);

        if (element) {
            return DateHelper.parseKey(element.dataset.date);
        }
    }

    changeTip(tip, existingTip) {
        const me = this;

        return Tooltip.reconfigure(existingTip, tip, {
            owner    : me,
            defaults : {
                type        : 'tooltip',
                owner       : me,
                id          : `${me.id}-cell-tip`,
                forElement  : me.bodyElement,
                forSelector : `.${me.dayCellCls}`
            }
        });
    }

    updateTip(tip) {
        this.detachListeners('tip');

        tip?.on({
            pointerOver : 'onTipOverCell',

            name    : 'tip',
            thisObj : this
        });
    }

    updateElement(element, was) {
        const me = this;

        super.updateElement(element, was);

        me.updateHideNonWorkingDays(me.hideNonWorkingDays);
        me.weekdayCells = Array.from(element.querySelectorAll('.b-calendar-day-header'));
        me.weekElements = Array.from(element.querySelectorAll('.b-calendar-week'));
        me.weekDayElements = Array.from(element.querySelectorAll('.b-calendar-days'));
        me.cellElements = [];

        for (let i = 0, { length } = me.weekDayElements; i < length; i++) {
            me.cellElements.push(me.weekDayElements[i].previousSibling, ...me.weekDayElements[i].children);
        }
    }

    changeDate(date) {
        date = typeof date === 'string' ? DateHelper.parse(date) : new Date(date);
        if (isNaN(date)) {
            throw new Error('CalendarPanel date ingestion must be passed a Date, or a YYYY-MM-DD date string');
        }

        return DateHelper.clearTime(date);
    }

    /**
     * The date which this CalendarPanel encapsulates. Setting this causes the
     * content to be refreshed.
     * @property {Date}
     */
    updateDate(value) {
        // We respond to Month change events to update the UI
        this.month.date = value;
    }

    updateDayNameFormat() {
        // 4th June 2000 was a Sunday
        const d = new Date('2000-06-04T12:00:00');

        this.shortDayNames = [];

        // Collect local shortDayNames in default order.
        for (let date = 4; date < 11; date++) {
            d.setDate(date);
            this.shortDayNames.push(DateHelper.format(d, this.dayNameFormat));
        }
    }

    get weekStartDay() {
        // This trick allows our weekStartDay to float w/the locale even if the locale changes
        return typeof this._weekStartDay === 'number' ? this._weekStartDay : DateHelper.weekStartDay;
    }

    /**
     * Set to 0 for Sunday (the default), 1 for Monday etc.
     *
     * Set to `null` to use the default value from {@link Core/helper/DateHelper}.
     */
    updateWeekStartDay(weekStartDay) {
        const me = this;

        if (me._month) {
            me.month.weekStartDay = weekStartDay;

            me.dayNames = [];

            // So, if they set weekStartDay to 1 meaning Monday which is ISO standard, we will
            // dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            for (let i = 0; i < 7; i++) {
                me.dayNames[i] = me.shortDayNames[me.canonicalDayNumbers[i]];
            }

            if (me.refreshCount) {
                me.refresh();
            }
        }
    }

    updateHideNonWorkingDays(hideNonWorkingDays) {
        // Undefined must be cast to Boolean, otherwise it will toggle the class *on*.
        this.contentElement.classList.toggle(this.hideNonWorkingDaysCls, Boolean(hideNonWorkingDays));
        this.scrollable?.syncOverflowState();
        if (this._month) {
            this.month.hideNonWorkingDays = hideNonWorkingDays;
        }
    }

    updateHideOtherMonthCells(hideOtherMonthCells) {
        // If we are hiding cells outside of the month of this view
        // then changing the month must *always* refresh.
        if (hideOtherMonthCells) {
            this.alwaysRefreshOnMonthChange = true;
        }
        else {
            this.alwaysRefreshOnMonthChange = (this.initialConfig.alwaysRefreshOnMonthChange);
        }

        // Undefined must be cast to Boolean, otherwise it will toggle the class *on*.
        this.element.classList.toggle(this.hideOtherMonthCellsCls, Boolean(hideOtherMonthCells));
        this.scrollable?.syncOverflowState();
    }

    updateDisableOtherMonthCells(disableOtherMonthCells) {
        // Undefined must be cast to Boolean, otherwise it will toggle the class *on*.
        this.element.classList.toggle(this.disableOtherMonthCellsCls, Boolean(disableOtherMonthCells));
        this.scrollable?.syncOverflowState();
    }

    get nonWorkingDays() {
        return this._nonWorkingDays || DateHelper.nonWorkingDays;
    }

    changeNonWorkingDays(nonWorkingDays) {
        return ObjectHelper.assign({}, nonWorkingDays);
    }

    updateNonWorkingDays(nonWorkingDays) {
        if (this._month) {
            this.month.nonWorkingDays = nonWorkingDays;
            this.refresh();
            this.scrollable?.syncOverflowState();
        }
    }

    get visibleDayColumnIndex() {
        return this.month.visibleDayColumnIndex;
    }

    get dayColumnIndex() {
        return this.month.dayColumnIndex;
    }

    get canonicalDayNumbers() {
        return this.month.canonicalDayNumbers;
    }

    get visibleColumnCount() {
        return this.month.visibleColumnCount;
    }

    get weekLength() {
        return this.month.weekLength;
    }

    /**
     * The date of the first day cell in this panel.
     * Note that this may *not* be the first of this panel's current month.
     * @property {Date}
     * @readonly
     */
    get startDate() {
        return this.month.startDate;
    }

    get duration() {
        // The endDate is "exclusive" because it means 00:00:00 of that day.
        return DateHelper.diff(this.month.startDate, this.month.endDate, 'day') + 1;
    }

    /**
     * The end date of this view. Note that in terms of full days, this is exclusive,
     * ie: 2020-01-012 to 2020-01-08 is *seven* days. The end is 00:00:00 on the 8th.
     *
     * Note that this may *not* be the last date of this panel's current month.
     * @property {Date}
     * @readonly
     */
    get endDate() {
        const { endDate } = this.month;

        if (endDate) {
            return DateHelper.add(endDate, 1, 'day');
        }
    }

    changeMonth(month, currentMonth) {
        const me = this;

        if (!(month instanceof Month)) {

            // Setting month to a number when we already have a Month means
            // just updating the month number of our Month
            if (typeof month === 'number') {
                if (currentMonth) {
                    currentMonth.month = month;
                    return;
                }
                const date = me.date || DateHelper.clearTime(new Date());

                date.setMonth(month);
                month = {
                    date
                };
            }
            month = Month.new({
                weekStartDay       : me.weekStartDay,
                nonWorkingDays     : me.nonWorkingDays,
                hideNonWorkingDays : me.hideNonWorkingDays,
                sixWeeks           : me.sixWeeks
            }, month);
        }

        month.on({
            dateChange : 'onMonthDateChange',
            thisObj    : me
        });

        return month;
    }

    onMonthDateChange({ source : month, newDate, oldDate, changes }) {
        const me = this;

        // Ensure we're always in sync with the data our Month holds
        me.year = month.year;

        if (!me.isConfiguring) {
            // Only refresh if we don't contain a cell for the new date.
            // Unless we are configured to always refresh when the month changes
            if (!me.getCell(newDate) || ((changes.m || changes.y) && me.alwaysRefreshOnMonthChange)) {
                me.refresh();

                if (me.animateTimeShift && !me.hidden) {
                    DomHelper.slideIn(me.contentElement, newDate > oldDate ? 1 : -1);
                }
            }

            /**
             * Fires when the date of this CalendarPanel is set.
             * @event dateChange
             * @param {Date} value The new date.
             * @param {Date} oldValue The old date.
             * @param {Object} changes An object which contains properties which indicate what part of the date changed.
             * @param {Boolean} changes.d True if the date changed in any way.
             * @param {Boolean} changes.w True if the week changed (including same week in a different year).
             * @param {Boolean} changes.m True if the month changed (including same month in a different year).
             * @param {Boolean} changes.y True if the year changed.
             */
            me.trigger('dateChange', {
                changes,
                value    : newDate,
                oldValue : oldDate
            });
        }
    }

    updateYear(year) {
        this.month.year = year;
    }

    updateShowWeekNumber(showWeekNumber) {
        this.updateShowWeekColumn(showWeekNumber);
    }

    updateShowWeekColumn(showWeekColumn) {
        const me = this;

        me.element.classList[showWeekColumn ? 'add' : 'remove']('b-show-week-column');
        if (me.floating) {
            // Must realign because content change might change dimensions
            if (!me.isAligning) {
                me.realign();
            }
        }
    }

    updateSixWeeks(sixWeeks) {
        if (this.month) {
            this.month.sixWeeks = sixWeeks;
            this.refresh();
        }
    }

    /**
     * Refreshes the UI after changing a config that would affect the UI.
     */
    refresh() {
        // This method may be overridden by subclasses to add things like refresh scheduling.
        this.doRefresh();
    }

    /**
     * Implementation of the UI refresh.
     * @private
     */
    doRefresh() {
        // Ensure sub elements are all present
        this.getConfig('element');

        const
            me    = this,
            today = DateHelper.clearTime(new Date()),
            {
                weekElements,
                weekDayElements,
                date,
                month,
                dayCellCls,
                dayHeaderCls,
                disabledCls,
                otherMonthCls,
                weekendCls,
                todayCls,
                nonWorkingDayCls,
                nonWorkingDays,
                canonicalDayNumbers,
                sixWeeks
            } = me;

        // If we have not been initialized with a current date, use today
        if (!date) {
            me.date = today;
            return;
        }

        /**
         * Fires before this CalendarPanel refreshes in response to changes in its month.
         * @event beforeRefresh
         * @param {Core.widget.DatePicker} source This DatePicker.
         */
        me.trigger('beforeRefresh');

        // Make sure we've calculated our shortDayNames
        me.getConfig('dayNameFormat');

        for (let columnIndex = 0; columnIndex < 7; columnIndex++) {
            const
                cell          = me.weekdayCells[columnIndex],
                cellDay       = me.canonicalDayNumbers[columnIndex],
                cellClassList = {
                    [dayHeaderCls]     : 1,
                    [weekendCls]       : DateHelper.weekends[cellDay],
                    [nonWorkingDayCls] : nonWorkingDays[cellDay]
                };

            if (me.headerRenderer) {
                cell.innerHTML = '';
                me.callback(me.headerRenderer, me, [cell, columnIndex, cellDay]);
            }
            else {
                DomHelper.setInnerText(cell, me.shortDayNames[cellDay]);
            }

            // Sync day name cell classes with its calculated status
            DomHelper.syncClassList(cell, cellClassList);

            cell.dataset.columnIndex = columnIndex;
            cell.dataset.cellDay = cellDay;
        }

        // Create cell content
        let rowIndex = 0,
            cellIndex = 0,
            lastWorkingColumn = 6;

        // Which column is the last working day so it can be tagged with an identifying class
        for (let columnIndex = 6; columnIndex >= 0; columnIndex--) {
            if (!nonWorkingDays[canonicalDayNumbers[columnIndex]]) {
                lastWorkingColumn = columnIndex;
                break;
            }
        }

        // Hide or show the "other month" week row depending on our sixWeeks setting
        weekElements[4].classList.toggle('b-hide-display', month.weekCount < 5 && !sixWeeks);
        weekElements[5].classList.toggle('b-hide-display', month.weekCount < 6 && !sixWeeks);

        month.eachWeek((week, dates) => {
            const
                weekDayElement = weekDayElements[rowIndex],
                weekCells = [weekDayElement.previousSibling, ...weekDayElement.children];

            // Stamp week into week row's dataset
            weekElements[rowIndex].dataset.week = `${week[0]},${week[1]}`;

            if (me.weekRenderer) {
                me.callback(me.weekRenderer, me, [weekCells[0], week]);
            }
            else {
                weekCells[0].innerText = week[1];
            }

            for (let columnIndex = 0; columnIndex < 7; columnIndex++) {
                const
                    date          = dates[columnIndex],
                    day           = date.getDay(),
                    cell          = weekCells[columnIndex + 1],
                    cellClassList = {
                        [dayCellCls]           : 1,
                        [disabledCls]          : me.isDisabledDate(date),
                        [otherMonthCls]        : date.getMonth() !== month.month,
                        [weekendCls]           : DateHelper.weekends[day],
                        [todayCls]             : date.getTime() === today.getTime(),
                        [nonWorkingDayCls]     : nonWorkingDays[day],
                        'b-last-working-day'   : columnIndex === lastWorkingColumn,
                        'b-first-visible-cell' : !(date - (me.firstVisibleDate || -1))
                    };

                // Sync day cell classes with its calculated status
                DomHelper.syncClassList(cell, cellClassList);

                cell.dataset.date = DateHelper.makeKey(date);
                cell.dataset.cellIndex = cellIndex;
                cell.dataset.columnIndex = columnIndex;

                // Since we manipulate the classList/Name directly, we need to trick DomSync's config comparison logic or it
                // may think the class has not changed.
                if (cell.lastDomConfig) {
                    delete cell.lastDomConfig.class;
                    delete cell.lastDomConfig.className;
                }

                if (me.cellRenderer) {
                    me.callback(me.cellRenderer, me, [{
                        cell,
                        date,
                        day,
                        row                : weekElements[rowIndex],
                        rowIndex,
                        cellIndex,
                        columnIndex,
                        visibleColumnIndex : me.visibleDayColumnIndex[day],
                        week
                    }]);
                }
                else {
                    cell.innerHTML = date.getDate();
                }
                cellIndex++;
            }

            rowIndex++;
        });

        /**
         * The number of rows displayed in this month. If {@link #config-sixWeeks} is not set,
         * this may be from 4 to 6.
         * @member {Number} visibleWeekCount
         * @readonly
         */
        me.visibleWeekCount = rowIndex;

        if (me.floating) {
            // Must realign because content change might change dimensions
            if (!me.isAligning) {
                me.realign();
            }
        }

        me.refreshCount = (me.refreshCount || 0) + 1;

        /**
         * Fires when this CalendarPanel refreshes.
         * @event refresh
         */
        me.trigger('refresh');
    }

    isDisabledDate(date) {
        const
            day = date.getDay(),
            {
                disabledDates,
                nonWorkingDays
            }   = this;

        if (this.disableWeekends && nonWorkingDays[day]) {
            return true;
        }

        if (disabledDates) {
            if (Array.isArray(disabledDates)) {
                date = DateHelper.clearTime(date, true);
                return disabledDates.some(d => !(DateHelper.clearTime(d, true) - date));
            }
            else {
                return this.callback(this.disabledDates, this, [date]);
            }
        }
    }

    get bodyConfig() {
        const
            result = super.bodyConfig,
            weeksContainerChildren = [];

        result.children = [{
            tag       : 'div',
            className : 'b-calendar-row b-calendar-weekdays',
            reference : 'weekdaysHeader',
            children  : [
                { class : 'b-week-number-cell' },
                ...ArrayHelper.fill(7, { class : this.dayHeaderCls }),
                DomHelper.scrollBarPadElement
            ]
        }, {
            // `notranslate` prevents google translate messing up the DOM, https://github.com/facebook/react/issues/11538
            className : 'b-weeks-container notranslate',
            reference : 'weeksElement',
            children  : weeksContainerChildren
        }];

        for (let i = 0; i < 6; i++) {
            const weekRow = {
                className : 'b-calendar-row b-calendar-week',
                dataset   : {
                    rowIndex : i
                },
                children : [{
                    className : 'b-week-number-cell'
                }, {
                    className   : 'b-calendar-days',
                    children    : [{}, {}, {}, {}, {}, {}, {}],
                    syncOptions : {
                        ignoreRefs : true,
                        strict     : false  // allow complete replacement of classes w/o matching lastDomConfig
                    }
                }]
            };

            weeksContainerChildren.push(weekRow);
        }

        return result;
    }

    get firstVisibleDate() {
        if (this.hideOtherMonthCells) {
            const { year, month } = this.month;

            return new Date(year, month, 1);
        }
        for (const me = this, date = me.month.startDate; ; date.setDate(date.getDate() + 1)) {
            if (!me.hideNonWorkingDays || !me.nonWorkingDays[date.getDay()]) {
                return date;
            }
        }
    }

    /**
     * Returns the cell associated with the passed date.
     *
     * To exclude dates which are outside of the panel's current month, pass the `strict` parameter as `true`
     * @param {Date|String} date The date to find the element for or a key in the format `YYYY-MM-DD`
     * @param {Boolean} strict Only return the element if this view *owns* the date.
     * @returns {HTMLElement} The cell for the passed date if it exists
     */
    getCell(date, strict) {
        if (!(typeof date === 'string')) {
            date = DateHelper.makeKey(date);
        }
        const cell = this.weeksElement.querySelector(`[data-date="${date}"]`);

        if (cell && (!strict || !cell.classList.contains(this.otherMonthCls))) {
            return cell;
        }
    }

    onTipOverCell({ source : tip, target }) {
        tip.date = DateHelper.parseKey(target.dataset.date);
    }

    updateLocalization() {
        this.updateDayNameFormat();
        this.updateWeekStartDay(this.weekStartDay);
        super.updateLocalization();
    }
}

// Register this widget type with its Factory
CalendarPanel.initClass();
