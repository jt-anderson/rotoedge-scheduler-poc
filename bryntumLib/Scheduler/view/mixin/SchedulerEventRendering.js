import Base from '../../../Core/Base.js';
import DomClassList from '../../../Core/helper/util/DomClassList.js';
import HorizontalLayoutStack from '../../eventlayout/HorizontalLayoutStack.js';
import HorizontalLayoutPack from '../../eventlayout/HorizontalLayoutPack.js';
import EventHelper from '../../../Core/helper/EventHelper.js';
import BrowserHelper from '../../../Core/helper/BrowserHelper.js';
import ObjectHelper from '../../../Core/helper/ObjectHelper.js';
import DomHelper from '../../../Core/helper/DomHelper.js';
import StringHelper from '../../../Core/helper/StringHelper.js';
import VersionHelper from '../../../Core/helper/VersionHelper.js';

/**
 * @module Scheduler/view/mixin/SchedulerEventRendering
 */

/**
 * Layout data object used to render an event record.
 * @typedef {Object} EventRenderData
 * @property {Scheduler.model.EventModel} eventRecord Event instance
 * @property {Scheduler.model.ResourceModel} resourceRecord Assigned resource
 * @property {Scheduler.model.AssignmentModel} assignmentRecord Assignment instance
 * @property {Number} startMS Event start date time in milliseconds
 * @property {Number} endMS Event end date in milliseconds
 * @property {Number} height Calculated event element height
 * @property {Number} width Calculated event element width
 * @property {Number} top Calculated event element top position in the row (or column)
 * @property {Number} left Calculated event element left position in the row (or column)
 */

/**
 * Functions to handle event rendering (EventModel -> dom elements).
 *
 * @mixin
 */
export default Target => class SchedulerEventRendering extends (Target || Base) {
    static get $name() {
        return 'SchedulerEventRendering';
    }

    //region Default config

    static get configurable() {
        return {
            /**
             * Position of the milestone text, either 'inside' (for short 1-char text) or 'outside' for longer text. Not
             * applicable when using {@link #config-milestoneLayoutMode}.
             * @member {'inside'|'outside'} milestoneTextPosition
             * @category Milestones
             */
            /**
             * Position of the milestone text, either 'inside' (for short 1-char text) or 'outside' for longer text. Not
             * applicable when using {@link #config-milestoneLayoutMode}.
             * @config {'inside'|'outside'}
             * @default
             * @category Milestones
             */
            milestoneTextPosition : 'outside',

            /**
             * Get/set how to align milestones in relation to their startDate. Only applies when using a
             * `milestoneLayoutMode` other than `default`. Valid values are:
             * * start
             * * center (default)
             * * end
             * @member {'start'|'center'|'end'} milestoneAlign
             * @category Milestones
             */
            /**
             * How to align milestones in relation to their startDate. Only applies when using a `milestoneLayoutMode`
             * other than `default`. Valid values are:
             * * start
             * * center (default)
             * * end
             * @config {'start'|'center'|'end'}
             * @default
             * @category Milestones
             */
            milestoneAlign : 'center',

            /**
             * Factor representing the average char width in pixels used to determine milestone width when configured
             * with `milestoneLayoutMode: 'estimate'`.
             * @member {Number} milestoneCharWidth
             * @category Milestones
             */
            /**
             * Factor representing the average char width in pixels used to determine milestone width when configured
             * with `milestoneLayoutMode: 'estimate'`.
             * @config {Number}
             * @default
             * @category Milestones
             */
            milestoneCharWidth : 10,

            /**
             * How to handle milestones during event layout. Options are:
             * * default - Milestones do not affect event layout
             * * estimate - Milestone width is estimated by multiplying text length with Scheduler#milestoneCharWidth
             * * data - Milestone width is determined by checking EventModel#milestoneWidth
             * * measure - Milestone width is determined by measuring label width
             * Please note that currently text width is always determined using EventModel#name.
             * Also note that only 'default' is supported by eventStyles line, dashed and minimal.
             * @member {'default'|'estimate'|'data'|'measure'} milestoneLayoutMode
             * @category Milestones
             */
            /**
             * How to handle milestones during event layout. Options are:
             * * default - Milestones do not affect event layout
             * * estimate - Milestone width is estimated by multiplying text length with Scheduler#milestoneCharWidth
             * * data - Milestone width is determined by checking EventModel#milestoneWidth
             * * measure - Milestone width is determined by measuring label width
             * Please note that currently text width is always determined using EventModel#name.
             * Also note that only 'default' is supported by eventStyles line, dashed and minimal.
             * @config {'default'|'estimate'|'data'|'measure'}
             * @default
             * @category Milestones
             */
            milestoneLayoutMode : 'default',

            // This is determined by styling, in the future it should be measured
            milestoneMinWidth : 40,

            /**
             * Get/set overlap mode. See {@link #config-eventLayout} config, valid values are `stack` (horizontal),
             * `pack`, `mixed` (vertical) and `none`
             * @member {String|Object} eventLayout
             * @category Scheduled events
             */
            /**
             * This config defines how to handle overlapping events. Valid values are:
             * - `stack`, adjusts row height (only horizontal)
             * - `pack`, adjusts event height
             * - `mixed`, allows two events to overlap, more packs (only vertical)
             * - `none`, allows events to overlap
             *
             * This config can also accept an object:
             *
             * ```javascript
             * new Scheduler({
             *     eventLayout : { type : 'stack' }
             * })
             * ```
             *
             * @config {'stack'|'pack'|'mixed'|'none'|Object}
             * @default
             * @category Scheduled events
             */
            eventLayout : 'stack',

            /**
             * Override this method to provide a custom sort function to sort any overlapping events. See {@link
             * #config-overlappingEventSorter} for more details.
             *
             * @param  {Scheduler.model.EventModel} a First event
             * @param  {Scheduler.model.EventModel} b Second event
             * @returns {Number} Return -1 to display `a` above `b`, 1 for `b` above `a`
             * @member {Function} overlappingEventSorter
             * @category Misc
             */
            /**
             * Override this method to provide a custom sort function to sort any overlapping events. This only applies
             * to the horizontal mode, where the order the events are sorted in determines their vertical placement
             * within a resource.
             *
             * By default, overlapping events are laid out based on the start date. If the start date is equal, events
             * with earlier end date go first. And lastly the name of events is taken into account.
             *
             * Here's a sample sort function, sorting on start- and end date. If this function returns -1, then event
             * `a` is placed above event `b`:
             *
             * ```javascript
             * overlappingEventSorter(a, b) {
             *
             *   const startA = a.startDate, endA = a.endDate;
             *   const startB = b.startDate, endB = b.endDate;
             *
             *   const sameStart = (startA - startB === 0);
             *
             *   if (sameStart) {
             *     return endA > endB ? -1 : 1;
             *   } else {
             *     return (startA < startB) ? -1 : 1;
             *   }
             * }
             * ```
             *
             * NOTE: The algorithms (stack, pack) that lay the events out expects them to be served in chronological
             * order, be sure to first sort by `startDate` to get predictable results.
             *
             * @param  {Scheduler.model.EventModel} a First event
             * @param  {Scheduler.model.EventModel} b Second event
             * @returns {Number} Return -1 to display `a` above `b`, 1 for `b` above `a`
             * @config {function}
             * @category Misc
             */
            overlappingEventSorter : null,

            /**
             * Deprecated, to be removed in version 6.0. Replaced by {@link #config-overlappingEventSorter}.
             * @deprecated Since 5.0. Use {@link #config-overlappingEventSorter} instead.
             * @config {function}
             */
            horizontalEventSorterFn : null,

            /**
             * Get/set fillTicks setting. If set to `true` it forces the rendered events to fill entire ticks.
             * @member {Boolean} fillTicks
             * @category Scheduled events
             */
            /**
             * Specify `true` to force rendered events to fill entire ticks. This only affects rendering, events retain
             * their set start and end dates on the data level. When enabling this config you should probably also
             * disable EventDrag and EventResize, otherwise their behaviour will not be what a user expects.
             * @config {Boolean}
             * @default
             * @category Scheduled events
             */
            fillTicks : false,

            /**
             * Control how much space to leave between the first event/last event and the resources edge (top/bottom
             * margin within the resource row in horizontal mode, left/right margin within the resource column in
             * vertical mode), in px. Defaults to the value of {@link Scheduler.view.Scheduler#config-barMargin}.
             *
             * Can be configured per resource by setting {@link Scheduler.model.ResourceModel#field-resourceMargin
             * resource.resourceMargin}.
             *
             * @member {Number} resourceMargin
             * @category Scheduled events
             */
            /**
             * Control how much space to leave between the first event/last event and the resources edge (top/bottom
             * margin within the resource row in horizontal mode, left/right margin within the resource column in
             * vertical mode), in px. Defaults to the value of {@link Scheduler.view.Scheduler#config-barMargin}.
             *
             * Can be configured per resource by setting {@link Scheduler.model.ResourceModel#field-resourceMargin
             * resource.resourceMargin}.
             *
             * @config {Number}
             * @category Scheduled events
             */
            resourceMargin : null,

            /**
             * Specify initial animation at runtime, see {@link #config-useInitialAnimation useInitialAnimation}
             * @member {Boolean|String} useInitialAnimation
             */
            /**
             * By default scheduler fades events in on load. Specify `false` to prevent this animation or specify one
             * of the available animation types to use it (`true` equals `'fade-in'`):
             * * fade-in (default)
             * * slide-from-left
             * * slide-from-top
             * ```
             * // Slide events in from the left on load
             * scheduler = new Scheduler({
             *     useInitialAnimation : 'slide-from-left'
             * });
             * ```
             * @config {Boolean|String}
             * @default
             * @category Misc
             */
            useInitialAnimation : true,

            /**
             * An empty function by default, but provided so that you can override it. This function is called each time
             * an event is rendered into the schedule to render the contents of the event. It's called with the event,
             * its resource and a `renderData` object which allows you to populate data placeholders inside the event
             * template. **IMPORTANT** You should never modify any data on the EventModel inside this method.
             *
             * By default, the DOM markup of an event bar includes placeholders for 'cls' and 'style'. The cls property
             * is a {@link Core.helper.util.DomClassList} which will be added to the event element. The style property
             * is an inline style declaration for the event element.
             *
             * IMPORTANT: When returning content, be sure to consider how that content should be encoded to avoid XSS
             * (Cross-Site Scripting) attacks. This is especially important when including user-controlled data such as
             * the event's `name`. The function {@link Core.helper.StringHelper#function-encodeHtml-static} as well as
             * {@link Core.helper.StringHelper#function-xss-static} can be helpful in these cases.
             *
             * ```javascript
             *  eventRenderer({ eventRecord, resourceRecord, renderData }) {
             *      renderData.style = 'color:white';                 // You can use inline styles too.
             *
             *      // Property names with truthy values are added to the resulting elements CSS class.
             *      renderData.cls.isImportant = this.isImportant(eventRecord);
             *      renderData.cls.isModified = eventRecord.isModified;
             *
             *      // Remove a class name by setting the property to false
             *      renderData.cls[scheduler.generatedIdCls] = false;
             *
             *      // Or, you can treat it as a string, but this is less efficient, especially
             *      // if your renderer wants to *remove* classes that may be there.
             *      renderData.cls += ' extra-class';
             *
             *      return StringHelper.xss`${DateHelper.format(eventRecord.startDate, 'YYYY-MM-DD')}: ${eventRecord.name}`;
             *  }
             * ```
             *
             * @param {Object} detail An object containing the information needed to render an Event.
             * @param {Scheduler.model.EventModel} detail.eventRecord The event record.
             * @param {Scheduler.model.ResourceModel} detail.resourceRecord The resource record.
             * @param {Scheduler.model.AssignmentModel} detail.assignmentRecord The assignment record.
             * @param {Object} detail.renderData An object containing details about the event rendering.
             * @param {Scheduler.model.EventModel} detail.renderData.event The event record.
             * @param {Core.helper.util.DomClassList|String} detail.renderData.cls An object whose property names
             * represent the CSS class names to be added to the event bar element. Set a property's value to truthy or
             * falsy to add or remove the class name based on the property name. Using this technique, you do not have
             * to know whether the class is already there, or deal with concatenation.
             * @param {Core.helper.util.DomClassList|String} detail.renderData.wrapperCls An object whose property names
             * represent the CSS class names to be added to the event wrapper element. Set a property's value to truthy
             * or falsy to add or remove the class name based on the property name. Using this technique, you do not
             * have to know whether the class is already there, or deal with concatenation.
             * @param {Core.helper.util.DomClassList|String} detail.renderData.iconCls An object whose property names
             * represent the CSS class names to be added to an event icon element.
             *
             * Note that an element carrying this icon class is injected into the event element *after*
             * the renderer completes, *before* the renderer's created content.
             *
             * To disable this if the renderer takes full control and creates content using the iconCls,
             * you can set `renderData.iconCls = null`.
             * @param {Number} detail.renderData.left Vertical offset position (in pixels) on the time axis.
             * @param {Number} detail.renderData.width Width in pixels of the event element.
             * @param {Number} detail.renderData.height Height in pixels of the event element.
             * @param {String|Object} detail.renderData.style Inline styles for the event bar DOM element. Use either
             * 'border: 1px solid black' or `{ border: '1px solid black' }`
             * @param {String|Object} detail.renderData.wrapperStyle Inline styles for wrapper of the event bar DOM element. Use either
             * 'border: 1px solid green' or `{ border: '1px solid green' }`
             * @param {String} detail.renderData.eventStyle The `eventStyle` of the event. Use this to apply custom
             * styles to the event DOM element
             * @param {String} detail.renderData.eventColor The `eventColor` of the event. Use this to set a custom
             * color for the rendered event
             * @param {Object[]} detail.renderData.children An array of DOM configs used as children to the
             * `b-sch-event` element. Can be populated with additional DOM configs to have more control over contents.
             * @returns {String|Object} A simple string, or a custom object which will be applied to the
             * {@link #config-eventBodyTemplate}, creating the actual HTML
             * @config {function}
             * @category Scheduled events
             */
            eventRenderer : null,

            /**
             * `this` reference for the {@link #config-eventRenderer} function
             * @config {Object}
             * @category Scheduled events
             */
            eventRendererThisObj : null,

            /**
             * Field from EventModel displayed as text in the bar when rendering
             * @config {String}
             * @default
             * @category Scheduled events
             */
            eventBarTextField : 'name',

            /**
             * The template used to generate the markup of your events in the scheduler. To 'populate' the
             * eventBodyTemplate with data, use the {@link #config-eventRenderer} method.
             * @config {Function}
             * @category Scheduled events
             */
            eventBodyTemplate : null,

            /**
             * The class responsible for the packing horizontal event layout process.
             * Override this to take control over the layout process.
             * @config {Scheduler.eventlayout.HorizontalLayout}
             * @typings {typeof HorizontalLayout}
             * @default
             * @private
             * @category Misc
             */
            horizontalLayoutPackClass : HorizontalLayoutPack,

            /**
             * The class name responsible for the stacking horizontal event layout process.
             * Override this to take control over the layout process.
             * @config {Scheduler.eventlayout.HorizontalLayout}
             * @typings {typeof HorizontalLayout}
             * @default
             * @private
             * @category Misc
             */
            horizontalLayoutStackClass : HorizontalLayoutStack,

            /**
             * A config object used to configure the resource columns in vertical mode.
             * See {@link Scheduler.view.ResourceHeader} for more details on available properties.
             *
             * ```
             * new Scheduler({
             *   resourceColumns : {
             *     columnWidth    : 100,
             *     headerRenderer : ({ resourceRecord }) => `${resourceRecord.id} - ${resourceRecord.name}`
             *   }
             * })
             * ```
             * @config {ResourceHeaderConfig}
             * @category Resources
             */
            resourceColumns : null,

            /**
             * Path to load resource images from. Used by the resource header in vertical mode and the
             * {@link Scheduler.column.ResourceInfoColumn} in horizontal mode. Set this to display miniature
             * images for each resource using their `image` or `imageUrl` fields.
             *
             * * `image` represents image name inside the specified `resourceImagePath`,
             * * `imageUrl` represents fully qualified image URL.
             *
             *  If set and a resource has no `imageUrl` or `image` specified it will try show miniature using
             *  the resource's name with {@link #config-resourceImageExtension} appended.
             *
             * **NOTE**: The path should end with a `/`:
             *
             * ```
             * new Scheduler({
             *   resourceImagePath : 'images/resources/'
             * });
             * ```
             * @config {String}
             * @category Resources
             */
            resourceImagePath : null,

            /**
             * Generic resource image, used when provided `imageUrl` or `image` fields or path calculated from resource
             * name are all invalid. If left blank, resource name initials will be shown when no image can be loaded.
             * @default
             * @config {String}
             * @category Resources
             */
            defaultResourceImageName : null,

            /**
             * Resource image extension, used when creating image path from resource name.
             * @default
             * @config {String}
             * @category Resources
             */
            resourceImageExtension : '.jpg',

            /**
             * Controls how much space to leave between stacked event bars in px.
             *
             * Can be configured per resource by setting {@link Scheduler.model.ResourceModel#field-barMargin
             * resource.barMargin}.
             *
             * @config {Number} barMargin
             * @default
             * @category Scheduled events
             */

            // Used to animate events on first render
            isFirstRender : true,

            initialAnimationDuration : 2000,

            /**
             * When an event bar has a width less than this value, it gets the CSS class `b-sch-event-narrow`
             * added. You may apply custom CSS rules using this class.
             *
             * In vertical mode, this class causes the text to be rotated so that it runs vertically.
             * @default
             * @config {Number}
             * @category Scheduled events
             */
            narrowEventWidth : 10,

            internalEventLayout : null,
            eventPositionMode   : 'translate',
            eventScrollMode     : 'move'
        };
    }

    //endregion

    //region Settings

    changeEventLayout(eventLayout) {
        // Pass layout config to internal config to normalize its form
        this.internalEventLayout = eventLayout;

        // Return normalized string type
        return this.internalEventLayout.type;
    }

    changeInternalEventLayout(eventLayout) {
        return this.getEventLayout(eventLayout);
    }

    updateInternalEventLayout(eventLayout, oldEventLayout) {
        const me = this;

        if (oldEventLayout) {
            me.element.classList.remove(`b-eventlayout-${oldEventLayout.type}`);
        }

        me.element.classList.add(`b-eventlayout-${eventLayout.type}`);

        if (!me.isConfiguring) {
            me.refreshWithTransition();

            me.trigger('stateChange');
        }
    }

    updateFillTicks() {
        if (!this.isConfiguring) {
            this.refreshWithTransition();

            this.trigger('stateChange');
        }
    }

    changeHorizontalEventSorterFn(fn) {
        VersionHelper.deprecate('Scheduler', '6.0.0', 'Replaced by overlappingEventSorter()');
        this.overlappingEventSorter = fn;
    }

    updateOverlappingEventSorter(fn) {
        if (!this.isConfiguring) {
            this.refreshWithTransition();
        }
    }

    //endregion

    //region Layout helpers

    // Wraps string config to object with type
    getEventLayout(value) {
        if (value?.isModel) {
            value = value.eventLayout || this.internalEventLayout;
        }

        if (typeof value === 'string') {
            value = { type : value };
        }

        return value;
    }

    /**
     * Get event layout handler. The handler decides the vertical placement of events within a resource.
     * Returns null if no eventLayout is used (if {@link #config-eventLayout} is set to "none")
     * @internal
     * @returns {Scheduler.eventlayout.HorizontalLayout}
     * @readonly
     * @category Scheduled events
     */
    getEventLayoutHandler(eventLayout) {
        const me = this;

        if (!me.isHorizontal) {
            return null;
        }

        const
            { timeAxisViewModel, horizontal } = me,
            { type }                          = eventLayout;

        if (!me.layouts) {
            me.layouts = {};
        }

        switch (type) {
            // stack, adjust row height to fit all events
            case 'stack': {
                if (!me.layouts.horizontalStack) {
                    me.layouts.horizontalStack = new me.horizontalLayoutStackClass(ObjectHelper.assign({
                        scheduler                   : me,
                        timeAxisViewModel,
                        bandIndexToPxConvertFn      : horizontal.layoutEventVerticallyStack,
                        bandIndexToPxConvertThisObj : horizontal
                    }, eventLayout));
                }

                return me.layouts.horizontalStack;
            }
            // pack, fit all events in available height by adjusting their height
            case 'pack': {
                if (!me.layouts.horizontalPack) {
                    me.layouts.horizontalPack = new me.horizontalLayoutPackClass(ObjectHelper.assign({
                        scheduler                   : me,
                        timeAxisViewModel,
                        bandIndexToPxConvertFn      : horizontal.layoutEventVerticallyPack,
                        bandIndexToPxConvertThisObj : horizontal
                    }, eventLayout));
                }

                return me.layouts.horizontalPack;
            }
            default:
                return null;
        }
    }

    //endregion

    //region Resource header/columns

    // NOTE: The configs below are initially applied to the resource header in `TimeAxisColumn#set mode`

    /**
     * Use it to manipulate resource column properties at runtime.
     * @property {Scheduler.view.ResourceHeader}
     * @readonly
     */
    get resourceColumns() {
        return this.timeAxisColumn?.resourceColumns || this._resourceColumns;
    }

    /**
     * Get resource column width. Only applies to vertical mode. To set it, assign to
     * `scheduler.resourceColumns.columnWidth`.
     * @property {Number}
     * @readonly
     */
    get resourceColumnWidth() {
        return this.resourceColumns?.columnWidth || null;
    }

    //endregion

    //region Event rendering

    // Chainable function called with the events to render for a specific resource. Allows features to add/remove.
    // Chained by ResourceTimeRanges
    getEventsToRender(resource, events) {
        return events;
    }

    /**
     * Rerenders events for specified resource (by rerendering the entire row).
     * @param {Scheduler.model.ResourceModel} resourceRecord
     */
    repaintEventsForResource(resourceRecord) {
        this.currentOrientation.repaintEventsForResource(resourceRecord);
    }

    /**
     * Rerenders the events for all resources connected to the specified event
     * @param {Scheduler.model.EventModel} eventRecord
     * @private
     */
    repaintEvent(eventRecord) {
        const resources = this.eventStore.getResourcesForEvent(eventRecord);
        resources.forEach(resourceRecord => this.repaintEventsForResource(resourceRecord));
    }

    // Returns a resource specific resourceMargin, falling back to Schedulers setting
    // This fn could be made public to allow hooking it as an alternative to only setting this in data
    getResourceMargin(resourceRecord) {
        return resourceRecord?.resourceMargin ?? this.resourceMargin;
    }

    // Returns a resource specific barMargin, falling back to Schedulers setting
    // This fn could be made public to allow hooking it as an alternative to only setting this in data
    getBarMargin(resourceRecord) {
        return resourceRecord?.barMargin ?? this.barMargin;
    }

    // Returns a resource specific rowHeight, falling back to Schedulers setting
    // Prio order: Height from record, configured height
    // This fn could be made public to allow hooking it as an alternative to only setting this in data
    getResourceHeight(resourceRecord) {
        return resourceRecord.rowHeight ?? (this.isHorizontal ? this.rowHeight : this.getResourceWidth(resourceRecord));
    }

    getResourceWidth(resourceRecord) {
        return resourceRecord.columnWidth ?? this.resourceColumnWidth;
    }

    // Similar to getResourceHeight(), but for usage later in the process to take height set by renderers into account.
    // Cant be used earlier in the process because then the row will grow
    // Prio order: Height requested by renderer, height from record, configured height
    getAppliedResourceHeight(resourceRecord) {
        const row = this.getRowById(resourceRecord);

        return row?.maxRequestedHeight ?? this.getResourceHeight(resourceRecord);
    }

    // Combined convenience getter for destructuring on calling side
    // Second arg only passed for nested events, handled by NestedEvent feature
    getResourceLayoutSettings(resourceRecord, parentEventRecord = null) {
        const
            resourceMargin = this.getResourceMargin(resourceRecord, parentEventRecord),
            rowHeight      = this.getAppliedResourceHeight(resourceRecord, parentEventRecord);

        return {
            barMargin     : this.getBarMargin(resourceRecord, parentEventRecord),
            contentHeight : Math.max(rowHeight - resourceMargin * 2, 1),
            rowHeight,
            resourceMargin
        };
    }

    getEventStyle(eventRecord, resourceRecord) {
        return eventRecord.eventStyle || resourceRecord.eventStyle || this.eventStyle;
    }

    getEventColor(eventRecord, resourceRecord) {
        return eventRecord.eventColor || eventRecord.parent?.eventColor || resourceRecord.eventColor || this.eventColor;
    }

    //endregion

    //region Template

    /**
     * Generates data used in the template when rendering an event. For example which css classes to use. Also applies
     * #eventBodyTemplate and calls the {@link #config-eventRenderer}.
     * @private
     * @param {Scheduler.model.EventModel} eventRecord Event to generate data for
     * @param {Scheduler.model.ResourceModel} resourceRecord Events resource
     * @param {Boolean|Object} includeOutside Specify true to get boxes for timespans outside the rendered zone in both
     * dimensions. This option is used when calculating dependency lines, and we need to include routes from timespans
     * which may be outside the rendered zone.
     * @param {Boolean} includeOutside.timeAxis Pass as `true` to include timespans outside the TimeAxis's bounds
     * @param {Boolean} includeOutside.viewport Pass as `true` to include timespans outside the vertical timespan viewport's bounds.
     * @returns {Object} Data to use in event template, or `undefined` if the event is outside the rendered zone.
     */
    generateRenderData(eventRecord, resourceRecord, includeOutside = { viewport : true }) {
        // TODO: Change this fn to accept an assignment instead of event + resource
        const
            me               = this,
            // generateRenderData calculates layout for events which are outside the vertical viewport
            // because the RowManager needs to know a row height.
            renderData       = me.currentOrientation.getTimeSpanRenderData(eventRecord, resourceRecord, includeOutside),
            { isEvent }      = eventRecord,
            // Don't want events drag created to zero duration to render as milestones
            isMilestone      = !eventRecord.meta.isDragCreating && eventRecord.isMilestone,
            assignmentRecord = isEvent && eventRecord.assignments.find(a => a.resourceId === resourceRecord.id),
            // Events inner element, will be populated by renderer and/or eventBodyTemplate
            eventContent = {
                className : 'b-sch-event-content',
                dataset   : {
                    taskBarFeature : 'content'
                }
            };

        if (renderData) {
            renderData.tabIndex = '0';

            let resizable = eventRecord.isResizable;
            if (renderData.startsOutsideView) {
                if (resizable === true) resizable = 'end';
                else if (resizable === 'start') resizable = false;
            }
            if (renderData.endsOutsideView) {
                if (resizable === true) resizable = 'start';
                else if (resizable === 'end') resizable = false;
            }

            // Event record cls properties are now DomClassList instances, so clone them
            // so that they can be manipulated here and by renderers.
            // Truthy value means the key will be added as a class name.
            // ResourceTimeRanges applies custom cls to wrapper.
            const
                // Boolean needed here, otherwise DomSync will dig into comparing the modifications
                isDirty           = Boolean(
                    eventRecord.hasPersistableChanges || assignmentRecord?.hasPersistableChanges
                ),
                clsListObj        = {
                    [resourceRecord.cls]      : resourceRecord.cls,
                    [me.generatedIdCls]       : !eventRecord.isOccurrence && eventRecord.hasGeneratedId,
                    [me.dirtyCls]             : isDirty,
                    [me.committingCls]        : eventRecord.isCommitting,
                    [me.endsOutsideViewCls]   : renderData.endsOutsideView,
                    [me.startsOutsideViewCls] : renderData.startsOutsideView,
                    'b-clipped-start'         : renderData.clippedStart,
                    'b-clipped-end'           : renderData.clippedEnd,
                    'b-iscreating'            : eventRecord.isCreating,
                    'b-rtl'                   : me.rtl
                },
                wrapperClsListObj = {
                    [`${me.eventCls}-parent`] : resourceRecord.isParent,
                    'b-readonly'              : eventRecord.readOnly || assignmentRecord?.readOnly
                },
                clsList           = eventRecord.isResourceTimeRange ? new DomClassList() : eventRecord.internalCls.clone(),
                wrapperClsList    = eventRecord.isResourceTimeRange ? eventRecord.internalCls.clone() : new DomClassList();

            renderData.wrapperStyle = '';

            // mark as wrapper to make sure fire render events for this level only
            renderData.isWrap = true;

            // Event specifics, things that do not apply to ResourceTimeRanges
            if (isEvent) {
                const selected = assignmentRecord && me.isAssignmentSelected(assignmentRecord);

                ObjectHelper.assign(clsListObj, {
                    [me.eventCls]                          : 1,
                    'b-milestone'                          : isMilestone,
                    'b-sch-event-narrow'                   : renderData.width < me.narrowEventWidth,
                    [me.fixedEventCls]                     : eventRecord.isDraggable === false,
                    [`b-sch-event-resizable-${resizable}`] : Boolean(me.features.eventResize && !eventRecord.readOnly),
                    [me.eventSelectedCls]                  : selected,
                    [me.eventAssignHighlightCls]           : me.eventAssignHighlightCls && !selected && me.isEventSelected(eventRecord),
                    'b-recurring'                          : eventRecord.isRecurring,
                    'b-occurrence'                         : eventRecord.isOccurrence,
                    'b-inactive'                           : eventRecord.inactive
                });

                renderData.eventId  = eventRecord.id;

                const
                    eventStyle   = me.getEventStyle(eventRecord, resourceRecord),
                    eventColor   = me.getEventColor(eventRecord, resourceRecord),
                    hasAnimation = me.isFirstRender && me.useInitialAnimation && globalThis.bryntum.noAnimations !== true;

                ObjectHelper.assign(wrapperClsListObj, {
                    [`${me.eventCls}-wrap`] : 1,
                    'b-milestone-wrap'      : isMilestone
                });

                if (hasAnimation) {
                    const
                        index   = renderData.row ? renderData.row.index : (renderData.top - me.scrollTop) / me.tickSize,
                        delayMS = index / 20 * 1000;

                    renderData.wrapperStyle = `animation-delay: ${delayMS}ms;`;
                    me.maxDelay = Math.max(me.maxDelay || 0, delayMS);

                    // Add an extra delay to wait for the most delayed animation to finish
                    // before we call stopInitialAnimation. In this way, we allow them all to finish
                    // before we remove the b-initial-${me._useInitialAnimation} class.
                    if (!me.initialAnimationDetacher) {
                        me.initialAnimationDetacher = EventHelper.on({
                            element  : me.foregroundCanvas,
                            delegate : me.eventSelector,

                            // Just listen for the first animation end fired by our event els
                            once         : true,
                            animationend : () => me.setTimeout({
                                fn                : 'stopInitialAnimation',
                                delay             : me.maxDelay,
                                cancelOutstanding : true
                            }),
                            // Fallback in case animation is interrupted
                            expires : {
                                alt   : 'stopInitialAnimation',
                                delay : me.initialAnimationDuration + me.maxDelay
                            },
                            thisObj : me
                        });
                    }
                }

                renderData.eventColor = eventColor;
                renderData.eventStyle = eventStyle;

                // TODO: Deprecate assignment, use assignmentRecord
                renderData.assignmentRecord = renderData.assignment = assignmentRecord;
            }

            // If not using a wrapping div, this cls will be added to event div for correct rendering
            renderData.wrapperCls = ObjectHelper.assign(wrapperClsList, wrapperClsListObj);

            renderData.cls = ObjectHelper.assign(clsList, clsListObj);
            renderData.iconCls = new DomClassList(eventRecord.get(me.eventBarIconClsField) || eventRecord.iconCls);

            // ResourceTimeRanges applies custom style to the wrapper
            if (eventRecord.isResourceTimeRange) {
                renderData.style = '';
                renderData.wrapperStyle += eventRecord.style || '';
            }
            // Others to inner
            else {
                renderData.style = eventRecord.style || '';
            }

            // TODO: Deprecate resource in favor of resourceRecord
            renderData.resource = renderData.resourceRecord = resourceRecord;
            renderData.resourceId = renderData.rowId;

            if (isEvent) {
                let childContent = null,
                    milestoneLabelConfig = null,
                    value;

                if (me.eventRenderer) {
                    // User has specified a renderer fn, either to return a simple string, or an object intended for the eventBodyTemplate
                    const
                        rendererValue = me.eventRenderer.call(me.eventRendererThisObj || me, {
                            eventRecord,
                            resourceRecord,
                            assignmentRecord : renderData.assignmentRecord,
                            renderData
                        });

                    // If the user's renderer coerced it into a string, recreate a DomClassList.
                    if (typeof renderData.cls === 'string') {
                        renderData.cls = new DomClassList(renderData.cls);
                    }

                    if (typeof renderData.wrapperCls === 'string') {
                        renderData.wrapperCls = new DomClassList(renderData.wrapperCls);
                    }

                    // Same goes for iconCls
                    if (typeof renderData.iconCls === 'string') {
                        renderData.iconCls = new DomClassList(renderData.iconCls);
                    }

                    if (me.eventBodyTemplate) {
                        value = me.eventBodyTemplate(rendererValue);
                    }
                    else {
                        value = rendererValue;
                    }
                }
                else if (me.eventBodyTemplate) {
                    // User has specified an eventBodyTemplate, but no renderer - just apply the entire event record data.
                    value = me.eventBodyTemplate(eventRecord);
                }
                else if (me.eventBarTextField) {
                    // User has specified a field in the data model to read from
                    value = StringHelper.encodeHtml(eventRecord[me.eventBarTextField] || '');
                }

                if (!me.eventBodyTemplate || Array.isArray(value)) {
                    eventContent.children = [];

                    // Give milestone a dedicated label element so we can use padding
                    if (isMilestone && me.milestoneLayoutMode === 'default' && value != null && value !== '') {
                        eventContent.children.unshift(milestoneLabelConfig = {
                            tag      : 'label',
                            children : []
                        });
                    }

                    if (renderData.iconCls?.length) {
                        eventContent.children.unshift({
                            tag       : 'i',
                            className : renderData.iconCls
                        });
                    }

                    // Array, assumed to contain DOM configs for eventContent children (or milestone label)
                    if (Array.isArray(value)) {
                        (milestoneLabelConfig || eventContent).children.push(...value);
                    }
                    // Likely HTML content
                    else if (StringHelper.isHtml(value)) {
                        if (eventContent.children.length) {
                            childContent = {
                                tag   : 'span',
                                class : 'b-event-text-wrap',
                                html  : value
                            };
                        }
                        else {
                            eventContent.children = null;
                            eventContent.html = value;
                        }
                    }
                    // DOM config or plain string can be used as is
                    else if (typeof value === 'string' || typeof value === 'object') {
                        childContent = value;
                    }
                    // Other, use string
                    else if (value != null) {
                        childContent = String(value);
                    }

                    // Must allow empty string as valid content
                    if (childContent != null) {
                        // Milestones have content in their label, other events in their "body"
                        (milestoneLabelConfig || eventContent).children.push(childContent);
                        renderData.cls.add('b-has-content');
                    }

                    if (eventContent.html != null || eventContent.children.length) {
                        renderData.children.push(eventContent);
                    }
                }
                else {
                    eventContent.html = value;
                    renderData.children.push(eventContent);
                }

                const { eventStyle, eventColor } = renderData;

                // Renderers have last say on style & color
                renderData.wrapperCls[`b-sch-style-${eventStyle}`] = eventStyle;

                // Named colors are applied as a class to the wrapper
                if (DomHelper.isNamedColor(eventColor)) {
                    renderData.wrapperCls[`b-sch-color-${eventColor}`] = eventColor;
                }
                else if (eventColor) {
                    const colorProp = eventStyle ? 'color' : 'background-color';

                    renderData.style = `${colorProp}:${eventColor};` + renderData.style;
                    renderData.wrapperCls['b-sch-custom-color'] = 1;
                }

                // Milestones has to apply styling to b-sch-event-content
                if (renderData.style && isMilestone && eventContent) {
                    eventContent.style = renderData.style;
                    delete renderData.style;
                }
            }

            // If there are any iconCls entries...
            renderData.cls['b-sch-event-withicon'] = renderData.iconCls?.length;

            // For comparison in sync, cheaper than comparing DocumentFragments
            renderData.eventContent = eventContent;

            renderData.wrapperChildren = [];

            // Method which features may chain in to
            me.onEventDataGenerated(renderData);
        }

        return renderData;
    }

    /**
     * A method which may be chained by features. It is called when an event's render
     * data is calculated so that features may update the style, class list or body.
     * @param {Object} eventData
     * @internal
     */
    onEventDataGenerated(eventData) {}

    //endregion

    //region Initial animation

    changeUseInitialAnimation(name) {
        return name === true ? 'fade-in' : name;
    }

    updateUseInitialAnimation(name, old) {
        const { classList } = this.element;

        if (old) {
            classList.remove(`b-initial-${old}`);
        }

        if (name) {
            classList.add(`b-initial-${name}`);

            // Transition block for FF, to not interfere with animations
            if (BrowserHelper.isFirefox) {
                classList.add('b-prevent-event-transitions');
            }
        }
    }

    /**
     * Restarts initial events animation with new value {@link #config-useInitialAnimation}.
     * @param {Boolean|String} initialAnimation new initial animation value
     */
    restartInitialAnimation(initialAnimation) {
        const me = this;

        me.initialAnimationDetacher?.();
        me.initialAnimationDetacher = null;

        me.useInitialAnimation = initialAnimation;
        me.isFirstRender = true;
        me.refresh();
    }

    stopInitialAnimation() {
        const me = this;

        me.initialAnimationDetacher();
        me.isFirstRender = false;

        // Prevent any further initial animations
        me.useInitialAnimation = false;

        // Remove transition block for FF a bit later, to not interfere with animations
        if (BrowserHelper.isFirefox) {
            me.setTimeout(() => me.element.classList.remove('b-prevent-event-transitions'), 100);
        }
    }

    //endregion

    //region Milestones

    /**
     * Determines width of a milestones label. How width is determined is decided by configuring Scheduler#milestoneLayoutMode.
     * Please note that currently text width is always determined using EventModel#name.
     * @param {Scheduler.model.EventModel} eventRecord
     * @returns {Number}
     */
    getMilestoneLabelWidth(eventRecord) {
        const
            me   = this,
            mode = me.milestoneLayoutMode;

        if (mode === 'measure') {
            const element = me.milestoneMeasureElement || (me.milestoneMeasureElement = DomHelper.createElement({
                className : 'b-sch-event-wrap b-milestone-wrap b-measure',
                children  : [{
                    className : 'b-sch-event b-milestone',
                    children  : [
                        {
                            className : 'b-sch-event-content'
                        }
                    ]
                }],
                parent : me.foregroundCanvas
            }));

            // DomSync should not touch
            element.retainElement = true;

            element.firstElementChild.firstElementChild.innerHTML = StringHelper.encodeHtml(eventRecord.name);

            return element.offsetWidth;
        }

        if (mode === 'estimate') {
            return Math.max(eventRecord.name.length * me.milestoneCharWidth, me.milestoneMinWidth);
        }

        if (mode === 'data') {
            return Math.max(eventRecord.milestoneWidth, me.milestoneMinWidth);
        }

        return 0;
    }

    updateMilestoneLayoutMode(mode) {
        this.element.classList[mode !== 'default' ? 'add' : 'remove']('b-sch-layout-milestones');

        if (!this.isConfiguring) {
            this.refreshWithTransition();
        }
    }

    updateMilestoneTextPosition(position) {
        this.element.classList.toggle('b-sch-layout-milestone-text-position-inside', position === 'inside');
    }

    updateMilestoneAlign() {
        if (!this.isConfiguring) {
            this.refreshWithTransition();
        }
    }

    updateMilestoneCharWidth() {
        if (!this.isConfiguring) {
            this.refreshWithTransition();
        }
    }

    // endregion

    // This does not need a className on Widgets.
    // Each *Class* which doesn't need 'b-' + constructor.name.toLowerCase() automatically adding
    // to the Widget it's mixed in to should implement thus.
    get widgetClass() {}
};
