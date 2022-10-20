import Panel from './Panel.js';
import EventHelper from '../helper/EventHelper.js';
import ObjectHelper from '../helper/ObjectHelper.js';
import DomHelper from '../helper/DomHelper.js';

/**
 * @module Core/widget/YearPicker
 */

/**
 * A Panel subclass which allows a year to be selected from a range of 12 displayed years.
 *
 * The panel can be configured with {@link #config-startYear} to specify the first year in the
 * displayed range.
 *
 * The {@link #property-year} indicates and sets the currently selected year.
 *
 * The {@link #event-select} event is fired when a new year is selected.
 *
 * {@inlineexample Core/widget/YearPicker.js}
 *
 * @extends Core/widget/Panel
 *
 * @classType yearpicker
 */
export default class YearPicker extends Panel {
    static $name = 'YearPicker'

    // Factoryable type name
    static type = 'yearpicker'

    static configurable = {
        textContent : false,

        /**
         * The definition of the top toolbar which displays the title and "previous" and
         * "next" buttons.
         *
         * This contains the following predefined `items` which may be reconfigured by
         * application code:
         *
         * - `title` A widget which displays the visible year range. Weight 100.
         * - `previous` A button which navigates to the previous block. Weight 200.
         * - `next` A button which navigates to the next block. Weight 300.
         *
         * These may be reordered:
         *
         * ```javascript
         * new YearPicker({
         *     appendTo : targetElement,
         *     tbar     : {
         *         items : {
         *             // Move title to centre
         *             title : {
         *                 weight : 250
         *             }
         *         }
         *     },
         *     width    : '24em'
         * });
         * ```
         * @config {ToolbarConfig}
         */
        tbar : {
            overflow : null,
            items    : {
                previous : {
                    type     : 'tool',
                    cls      : 'b-icon b-icon-previous',
                    onAction : 'up.previous',
                    weight   : 100
                },
                title : {
                    type     : 'button',
                    cls      : 'b-yearpicker-title',
                    weight   : 200,
                    onAction : 'up.handleTitleClick'
                },
                next : {
                    type     : 'tool',
                    cls      : 'b-icon b-icon-next',
                    onAction : 'up.next',
                    weight   : 300
                }
            }
        },

        itemCls : 'b-year-container',

        /**
         * The number of clickable year buttons to display in the widget.
         *
         * It may be useful to change this if a non-standard shape or size is used.
         * @config {Number}
         * @default
         */
        yearButtonCount : 12,

        /**
         * The currently selected year.
         * @member {Number} year
         */
        /**
         * The year to use as the selected year. Defaults to the current year.
         * @config {Number}
         */
        year : null,

        /**
         * The lowest year to allow.
         * @config {Number}
         */
        minYear : null,

        /**
         * The highest year to allow.
         * @config {Number}
         */
        maxYear : null,

        /**
         * The starting year displayed in the widget.
         * @member {Number} startYear
         */
        /**
         * The year to show at the start of the widget
         * @config {Number}
         */
        startYear : null
    }

    construct(config) {
        super.construct({
            year : new Date().getFullYear(),
            ...config
        });

        EventHelper.on({
            element  : this.contentElement,
            click    : 'onYearClick',
            delegate : '.b-yearpicker-year',
            thisObj  : this
        });
    }

    get focusElement() {
        return this.getYearButton(this.year) || this.getYearButton(this.startYear);
    }

    getYearButton(y) {
        return this.contentElement.querySelector(`.b-yearpicker-year[data-year="${y}"]`);
    }

    /**
     * The currently selected year.
     * @member {Number} value
     */
    get value() {
        return this.year;
    }

    set value(year) {
        this.year = year;
    }

    onYearClick({ target }) {
        const clickedYear = Math.min(Math.max(parseInt(target.innerText), this.minYear || 1), this.maxYear || 9999);

        // The updater won't run, so fire the select event here.
        if (this.year === clickedYear) {
            this.trigger('select', { oldValue : clickedYear, value : clickedYear });
        }
        else {
            this.year = clickedYear;
        }
    }

    handleTitleClick(e) {
        this.trigger('titleClick', e);
    }

    previous() {
        this.startYear = this.startYear - this.yearButtonCount;
    }

    next() {
        this.startYear = this.endYear + 1;
    }

    ingestYear(year) {
        if (!isNaN(year)) {
            return ObjectHelper.isDate(year) ? year.getFullYear() : year;
        }
    }

    changeYear(year) {
        // ingestYear returns undefined if invalid input
        if ((year = this.ingestYear(year))) {
            return Math.min(Math.max(year, this.minYear || 1), this.maxYear || 9999);
        }
    }

    updateYear(year, oldValue) {
        const me = this;

        if (!me.startYear || year > me.endYear) {
            me.startYear = year;
        }
        else if (year < me.startYear) {
            me.startYear = year - (me.yearButtonCount - 1);
        }
        if (!me.isConfiguring) {
            /**
             * Fired when a year is selected.
             * @event select
             * @param {Number} value The previously selected year.
             * @param {Core.widget.YearPicker} source This YearPicker
             */
            me.trigger('select', { oldValue, value : year });
        }
    }

    /**
     * The ending year displayed in the widget.
     * @member {Number} endYear
     * @readonly
     */
    get endYear() {
        return this.startYear + this.yearButtonCount - 1;
    }

    changeStartYear(startYear) {
        // ingestYear returns undefined if invalid input
        if ((startYear = this.ingestYear(startYear))) {
            startYear = this.minYear ? Math.max(startYear, this.minYear) : startYear;
            return this.maxYear ? Math.min(startYear, this.maxYear - (this.yearButtonCount - 1)) : startYear;
        }
    }

    async updateStartYear(startYear, oldStartYear) {
        if (this.isVisible) {
            DomHelper.slideIn(this.contentElement, Math.sign(startYear - oldStartYear));
        }
    }

    composeBody() {
        // Must be ingested before first compose.
        this.getConfig('year');

        const
            { startYear } = this,
            result        = super.composeBody(),
            children      = result.children[this.tbar ? 1 : 0].children = [];

        this.widgetMap.title.text = `${`000${startYear}`.slice(-4)} - ${`000${this.endYear}`.slice(-4)}`;

        for (let i = 0, y = startYear; i < this.yearButtonCount; i++, y++) {
            children.push({
                tag     : 'button',
                dataset : {
                    year : y
                },
                class : {
                    'b-yearpicker-year' : 1,
                    'b-selected'        : y === this.year
                },
                text : `000${y}`.slice(-4)
            });
        }

        return result;
    }
}

// Register this widget type with its Factory
YearPicker.initClass();
