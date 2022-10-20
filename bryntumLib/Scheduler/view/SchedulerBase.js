import TimelineBase from './TimelineBase.js';
import DateHelper from '../../Core/helper/DateHelper.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import CrudManager from '../data/CrudManager.js';
import DomSync from '../../Core/helper/DomSync.js';
import Rectangle from '../../Core/helper/util/Rectangle.js';
import '../localization/En.js';

import CurrentConfig from './mixin/CurrentConfig.js';
import SchedulerDom from './mixin/SchedulerDom.js';
import SchedulerDomEvents from './mixin/SchedulerDomEvents.js';
import SchedulerEventRendering from './mixin/SchedulerEventRendering.js';
import SchedulerStores from './mixin/SchedulerStores.js';
import SchedulerScroll from './mixin/SchedulerScroll.js';
import SchedulerRegions from './mixin/SchedulerRegions.js';
import SchedulerState from './mixin/SchedulerState.js';
import EventSelection from './mixin/EventSelection.js';
import EventNavigation from './mixin/EventNavigation.js';
import CrudManagerView from '../crud/mixin/CrudManagerView.js';
import HorizontalRendering from './orientation/HorizontalRendering.js';
import VerticalRendering from './orientation/VerticalRendering.js';
import '../column/TimeAxisColumn.js';
import '../column/VerticalTimeAxisColumn.js';

// Should always be present in Scheduler
import '../../Grid/feature/RegionResize.js';

/**
 * @module Scheduler/view/SchedulerBase
 */

/**
 * A thin base class for {@link Scheduler.view.Scheduler}. Does not include any features by default, allowing smaller
 * custom built bundles if used in place of {@link Scheduler.view.Scheduler}.
 *
 * **NOTE:** In most scenarios you do probably want to use Scheduler instead of SchedulerBase.
 *
 * @mixes Scheduler/view/mixin/EventNavigation
 * @mixes Scheduler/view/mixin/EventSelection
 * @mixes Scheduler/view/mixin/SchedulerDom
 * @mixes Scheduler/view/mixin/SchedulerDomEvents
 * @mixes Scheduler/view/mixin/SchedulerEventRendering
 * @mixes Scheduler/view/mixin/SchedulerRegions
 * @mixes Scheduler/view/mixin/SchedulerScroll
 * @mixes Scheduler/view/mixin/SchedulerState
 * @mixes Scheduler/view/mixin/SchedulerStores
 * @mixes Scheduler/view/mixin/TimelineDateMapper
 * @mixes Scheduler/view/mixin/TimelineDomEvents
 * @mixes Scheduler/view/mixin/TimelineEventRendering
 * @mixes Scheduler/view/mixin/TimelineScroll
 * @mixes Scheduler/view/mixin/TimelineViewPresets
 * @mixes Scheduler/view/mixin/TimelineZoomable
 * @mixes Scheduler/crud/mixin/CrudManagerView
 * @mixes Scheduler/data/mixin/ProjectConsumer
 *
 * @features Scheduler/feature/ColumnLines
 * @features Scheduler/feature/Dependencies
 * @features Scheduler/feature/DependencyEdit
 * @features Scheduler/feature/EventCopyPaste
 * @features Scheduler/feature/EventDrag
 * @features Scheduler/feature/EventDragCreate
 * @features Scheduler/feature/EventDragSelect
 * @features Scheduler/feature/EventEdit
 * @features Scheduler/feature/EventFilter
 * @features Scheduler/feature/EventMenu
 * @features Scheduler/feature/EventResize
 * @features Scheduler/feature/EventTooltip
 * @features Scheduler/feature/GroupSummary
 * @features Scheduler/feature/HeaderZoom
 * @features Scheduler/feature/Labels
 * @features Scheduler/feature/NonWorkingTime
 * @features Scheduler/feature/Pan
 * @features Scheduler/feature/ResourceTimeRanges
 * @features Scheduler/feature/ScheduleContext
 * @features Scheduler/feature/ScheduleMenu
 * @features Scheduler/feature/ScheduleTooltip
 * @features Scheduler/feature/SimpleEventEdit
 * @features Scheduler/feature/StickyEvents
 * @features Scheduler/feature/Summary
 * @features Scheduler/feature/TimeAxisHeaderMenu
 * @features Scheduler/feature/TimeRanges
 *
 * @features Scheduler/feature/experimental/ExcelExporter
 *
 * @features Scheduler/feature/export/PdfExport
 * @features Scheduler/feature/export/exporter/MultiPageExporter
 * @features Scheduler/feature/export/exporter/MultiPageVerticalExporter
 * @features Scheduler/feature/export/exporter/SinglePageExporter
 *
 * @extends Scheduler/view/TimelineBase
 */
export default class SchedulerBase extends TimelineBase.mixin(
    CrudManagerView,
    SchedulerDom,
    SchedulerDomEvents,
    SchedulerStores,
    SchedulerScroll,
    SchedulerState,
    SchedulerEventRendering,
    SchedulerRegions,
    EventSelection,
    EventNavigation,
    CurrentConfig
) {
    //region Config

    static get $name() {
        return 'SchedulerBase';
    }

    // Factoryable type name
    static get type() {
        return 'schedulerbase';
    }

    static get configurable() {
        return {
            /**
             * Get/set the scheduler's read-only state. When set to `true`, any UIs for modifying data are disabled.
             * @member {Boolean} readOnly
             */
            /**
             * Configure as `true` to make the scheduler read-only, by disabling any UIs for modifying data.
             *
             * __Note that checks MUST always also be applied at the server side.__
             * @config {Boolean} readOnly
             * @default false
             */

            /**
             * The date to display when used as a component of a Calendar.
             *
             * This is required by the Calendar Mode Interface.
             *
             * @config {Date}
             * @category Calendar integration
             */
            date : {
                value : null,

                $config : {
                    equal : 'date'
                }
            },

            /**
             * Unit used to control how large steps to take when clicking the previous and next buttons in the Calendar
             * UI. Only applies when used as a component of a Calendar.
             *
             * Suitable units depend on configured {@link #config-range}, a smaller or equal unit is recommended.
             *
             * @config {'millisecond'|'second'|'minute'|'hour'|'day'|'week'|'month'|'quarter'|'year'}
             * @category Calendar integration
             */
            stepUnit : 'week',

            /**
             * Unit used to set the length of the time axis when used as a component of a Calendar. Suitable units are
             * `'month'`, `'week'` and `'day'`.
             *
             * @config {'day'|'week'|'month'}
             * @category Calendar integration
             */
            range : 'week',

            /**
             * When the scheduler is used in a Calendar, this function provides the textual description for the
             * Calendar's toolbar.
             *
             * ```javascript
             *  descriptionRenderer : scheduler => {
             *      const
             *          count = scheduler.eventStore.records.filter(
             *              eventRec => DateHelper.intersectSpans(
             *                  scheduler.startDate, scheduler.endDate,
             *                  eventRec.startDate, eventRec.endDate)).length,
             *          startDate = DateHelper.format(scheduler.startDate, 'DD/MM/YYY'),
             *          endData = DateHelper.format(scheduler.endDate, 'DD/MM/YYY');
             *
             *      return `${startDate} - ${endData}, ${count} event${count === 1 ? '' : 's'}`;
             *  }
             * ```
             * @config {Function}
             * @param {Scheduler.view.SchedulerBase} view The active view.
             * @category Calendar integration
             */
            descriptionRenderer : {
                value : null,

                $config : null,
                default : view => {
                    switch (view.range) {
                        case 'month' :
                            return DateHelper.format(view.startDate, 'MMMM, YYYY');
                        case 'week' :
                            return `${DateHelper.getLocalizedNameOfUnit('Week')} ${DateHelper.getWeekDescription(view.startDate, view.endDate)}`;
                        case 'day':
                            return DateHelper.format(view.startDate, 'MMMM D, YYYY');
                    }
                }
            },

            /**
             * A method allowing you to define date boundaries that will constrain resize, create and drag drop operations. The method will be called with the
             * Resource record, and the Event record.
             *
             * ```javascript
             *  new Scheduler({
             *      getDateConstraints(resourceRecord, eventRecord) {
             *          // Assuming you have added these extra fields to your own EventModel subclass
             *          const { minStartDate, maxEndDate } = eventRecord;
             *
             *          return {
             *              start : minStartDate,
             *              end   : maxEndDate
             *          };
             *      }
             *  });
             * ```
             * @param {Scheduler.model.ResourceModel} resourceRecord The resource record
             * @param {Scheduler.model.EventModel} eventRecord The event record
             * @returns {Object} Constraining object containing `start` and `end` constraints. Omitting either
             * will mean that end is not constrained. So you can prevent a resize or move from moving *before*
             * a certain time while not constraining the end date.
             * @returns {Date} [return.start] Start date
             * @returns {Date} [return.end] End date
             * @config {Function}
             * @category Scheduled events
             */
            getDateConstraints : null,

            /**
             * The time axis column config for vertical {@link Scheduler.view.SchedulerBase#config-mode}.
             *
             * Object with {@link Scheduler.column.VerticalTimeAxisColumn} configuration.
             *
             * This object will be used to configure the vertical time axis column instance.
             *
             * The config allows configuring the `VerticalTimeAxisColumn` instance used in vertical mode with any Column options that apply to it.
             *
             * Example:
             *
             * ```javascript
             * new Scheduler({
             *     mode     : 'vertical',
             *     features : {
             *         filterBar : true
             *     },
             *     verticalTimeAxisColumn : {
             *         text  : 'Filter by event name',
             *         width : 180,
             *         filterable : {
             *             // add a filter field to the vertical column access header
             *             filterField : {
             *                 type        : 'text',
             *                 placeholder : 'Type to search',
             *                 onChange    : ({ value }) => {
             *                     // filter event by name converting to lowerCase to be equal comparison
             *                     scheduler.eventStore.filter({
             *                         filters : event => event.name.toLowerCase().includes(value.toLowerCase()),
             *                         replace : true
             *                     });
             *                 }
             *             }
             *         }
             *     },
             *     ...
             * });
             * ```
             *
             * @config {VerticalTimeAxisColumnConfig}
             * @category Time axis
             */
            verticalTimeAxisColumn : {},

            /**
             * See {@link Scheduler.view.Scheduler#keyboard-shortcuts Keyboard shortcuts} for details
             * @config {Object} keyMap
             * @category Common
             */

            /**
             * If true, a new event will be created when user double clicks on a time axis cell (if scheduler is not in
             * read only mode).
             *
             * The duration / durationUnit of the new event will be 1 time axis tick (default), or it can be read from
             * the {@link Scheduler.model.EventModel#field-duration} and
             * {@link Scheduler.model.EventModel#field-durationUnit} fields.
             *
             * Set to `false` to not create events on double click.
             * @config {Boolean|Object} createEventOnDblClick
             * @param {Boolean} [createEventOnDblClick.useEventModelDefaults] set to `true` to set default duration
             * based on the defaults specified by the {@link Scheduler.model.EventModel#field-duration} and
             * {@link Scheduler.model.EventModel#field-durationUnit} fields.
             * @default
             * @category Scheduled events
             */
            createEventOnDblClick : true,

            scheduledEventName : 'event'
        };
    }

    static get defaultConfig() {
        return {
            /**
             * Scheduler mode. Supported values: horizontal, vertical
             * @config {'horizontal'|'vertical'} mode
             * @default
             */
            mode : 'horizontal',

            /**
             * CSS class to add to rendered events
             * @config {String}
             * @category CSS
             * @private
             * @default
             */
            eventCls : 'b-sch-event',

            /**
             * CSS class to add to cells in the timeaxis column
             * @config {String}
             * @category CSS
             * @private
             * @default
             */
            timeCellCls : 'b-sch-timeaxis-cell',

            timeCellSelector : '.b-sch-timeaxis-cell',

            /**
             * A CSS class to apply to each event in the view on mouseover (defaults to 'b-sch-event-hover').
             * @config {String}
             * @default
             * @category CSS
             * @private
             */
            overScheduledEventClass : 'b-sch-event-hover',

            /**
             * Set to false if you don't want to allow events overlapping times for any one resource (defaults to true).
             * @config {Boolean}
             * @default
             * @category Scheduled events
             */
            allowOverlap : true,

            /**
             * The height in pixels of Scheduler rows.
             * @config {Number}
             * @default
             */
            rowHeight : 60,

            /**
             * Scheduler overrides Grids default implementation of {@link Grid.view.GridBase#config-getRowHeight} to
             * pre-calculate row heights based on events in the rows.
             *
             * The amount of rows that are pre-calculated is limited for performance reasons. The limit is configurable
             * by specifying the {@link Scheduler.view.SchedulerBase#config-preCalculateHeightLimit} config.
             *
             * The results of the calculation are cached internally.
             *
             * @config {Function} getRowHeight
             * @param {Scheduler.model.ResourceModel} getRowHeight.record Resource record to determine row height for
             * @returns {Number} Desired row height
             * @category Layout
             */

            /**
             * Maximum number of resources for which height is pre-calculated. If you have many events per
             * resource you might want to lower this number to gain some initial rendering performance.
             *
             * Specify a falsy value to opt out of row height pre-calculation.
             *
             * @config {Number}
             * @default
             * @category Layout
             */
            preCalculateHeightLimit : 10000,

            crudManagerClass : CrudManager,

            testConfig : {
                loadMaskError : {
                    autoClose : 10,
                    showDelay : 0
                }
            }
        };
    }

    // Keep this commented out to have easy access to the syntax next time we need to use it
    // static get deprecatedEvents() {
    //     return {
    //         eventContextMenuBeforeShow : {
    //             product            : 'Scheduler',
    //             invalidAsOfVersion : '5.0.0',
    //             message            : '`eventContextMenuBeforeShow` event is deprecated, in favor of `eventMenuBeforeShow` event. Please see https://bryntum.com/docs/scheduler/#Scheduler/guides/upgrades/3.1.0.md for more information.'
    //         }
    //     };
    // }

    //endregion

    //region Store & model docs

    // Documented here instead of in SchedulerStores since SchedulerPro uses different types

    // Configs

    /**
     * Inline events, will be loaded into an internally created EventStore.
     * @config {Scheduler.model.EventModel[]|Object[]} events
     * @category Data
     */

    /**
     * The {@link Scheduler.data.EventStore} holding the events to be rendered into the scheduler (required).
     * @config {Scheduler.data.EventStore|Object} eventStore
     * @category Data
     */

    /**
     * Inline resources, will be loaded into an internally created ResourceStore.
     * @config {Scheduler.model.ResourceModel[]|Object[]} resources
     * @category Data
     */

    /**
     * The {@link Scheduler.data.ResourceStore} holding the resources to be rendered into the scheduler (required).
     * @config {Scheduler.data.ResourceStore|Object} resourceStore
     * @category Data
     */

    /**
     * Inline assignments, will be loaded into an internally created AssignmentStore.
     * @config {Scheduler.model.AssignmentModel[]|Object[]} assignments
     * @category Data
     */

    /**
     * The optional {@link Scheduler.data.AssignmentStore}, holding assignments between resources and events.
     * Required for multi assignments.
     * @config {Scheduler.data.AssignmentStore|Object} assignmentStore
     * @category Data
     */

    /**
     * Inline dependencies, will be loaded into an internally created DependencyStore.
     * @config {Scheduler.model.DependencyModel[]|Object[]} dependencies
     * @category Data
     */

    /**
     * The optional {@link Scheduler.data.DependencyStore}.
     * @config {Scheduler.data.DependencyStore|Object} dependencyStore
     * @category Data
     */

    // Properties

    /**
     * Get/set events, applies to the backing project's EventStore.
     * @member {Scheduler.model.EventModel[]} events
     * @accepts {Scheduler.model.EventModel[]|Object[]}
     * @category Data
     */

    /**
     * Get/set the event store instance of the backing project.
     * @member {Scheduler.data.EventStore} eventStore
     * @category Data
     */

    /**
     * Get/set resources, applies to the backing project's ResourceStore.
     * @member {Scheduler.model.ResourceModel[]} resources
     * @accepts {Scheduler.model.ResourceModel[]|Object[]}
     * @category Data
     */

    /**
     * Get/set the resource store instance of the backing project
     * @member {Scheduler.data.ResourceStore} resourceStore
     * @category Data
     */

    /**
     * Get/set assignments, applies to the backing project's AssignmentStore.
     * @member {Scheduler.model.AssignmentModel[]} assignments
     * @accepts {Scheduler.model.AssignmentModel[]|Object[]}
     * @category Data
     */

    /**
     * Get/set the event store instance of the backing project.
     * @member {Scheduler.data.AssignmentStore} assignmentStore
     * @category Data
     */

    /**
     * Get/set dependencies, applies to the backing projects DependencyStore.
     * @member {Scheduler.model.DependencyModel[]} dependencies
     * @accepts {Scheduler.model.DependencyModel[]|Object[]}
     * @category Data
     */

    /**
     * Get/set the dependencies store instance of the backing project.
     * @member {Scheduler.data.DependencyStore} dependencyStore
     * @category Data
     */

    //endregion

    //region Events

    /**
     * Fired after rendering an event, when its element is available in DOM.
     * @event renderEvent
     * @param {Scheduler.view.Scheduler} source This Scheduler
     * @param {Scheduler.model.EventModel} eventRecord The event record
     * @param {Scheduler.model.ResourceModel} resourceRecord The resource record
     * @param {Scheduler.model.AssignmentModel} assignmentRecord The assignment record
     * @param {Object} renderData An object containing details about the event rendering, see
     *   {@link Scheduler.view.mixin.SchedulerEventRendering#config-eventRenderer} for details
     * @param {Boolean} isRepaint `true` if this render is a repaint of the event, updating its existing element
     * @param {Boolean} isReusingElement `true` if this render lead to the event reusing a released events element
     * @param {HTMLElement} element The event bar element
     */

    /**
     * Fired after releasing an event, useful to cleanup of custom content added on `renderEvent` or in `eventRenderer`.
     * @event releaseEvent
     * @param {Scheduler.view.Scheduler} source This Scheduler
     * @param {Scheduler.model.EventModel} eventRecord The event record
     * @param {Scheduler.model.ResourceModel} resourceRecord The resource record
     * @param {Scheduler.model.AssignmentModel} assignmentRecord The assignment record
     * @param {Object} renderData An object containing details about the event rendering
     * @param {HTMLElement} element The event bar element
     */

    /**
     * Fired when clicking a resource header cell
     * @event resourceHeaderClick
     * @param {Scheduler.view.Scheduler} source This Scheduler
     * @param {Scheduler.model.ResourceModel} resourceRecord The resource record
     * @param {Event} event The event
     */

    /**
     * Fired when double clicking a resource header cell
     * @event resourceHeaderDblclick
     * @param {Scheduler.view.Scheduler} source This Scheduler
     * @param {Scheduler.model.ResourceModel} resourceRecord The resource record
     * @param {Event} event The event
     */

    /**
     * Fired when activating context menu on a resource header cell
     * @event resourceHeaderContextmenu
     * @param {Scheduler.view.Scheduler} source This Scheduler
     * @param {Scheduler.model.ResourceModel} resourceRecord The resource record
     * @param {Event} event The event
     */

    /**
     * Triggered when a keydown event is observed if there are selected events.
     * @event eventKeyDown
     * @param {Scheduler.view.Scheduler} source This Scheduler
     * @param {Scheduler.model.EventModel[]} eventRecord The selected event records
     * @param {Scheduler.model.AssignmentModel[]} assignmentRecord The selected assignment records
     * @param {KeyboardEvent} event Browser event
     */

    /**
     * Triggered when a keyup event is observed if there are selected events.
     * @event eventKeyUp
     * @param {Scheduler.view.Scheduler} source This Scheduler
     * @param {Scheduler.model.EventModel[]} eventRecord The selected event records
     * @param {Scheduler.model.AssignmentModel[]} assignmentRecord The selected assignment records
     * @param {KeyboardEvent} event Browser event
     */

    //endregion

    //region Functions injected by features

    // For documentation & typings purposes

    /**
     * Opens an editor UI to edit the passed event.
     *
     * *NOTE: Only available when the {@link Scheduler/feature/EventEdit EventEdit} feature is enabled.*
     *
     * @function editEvent
     * @param {Scheduler.model.EventModel} eventRecord Event to edit
     * @param {Scheduler.model.ResourceModel} [resourceRecord] The Resource record for the event.
     * This parameter is needed if the event is newly created for a resource and has not been assigned, or when using
     * multi assignment.
     * @param {HTMLElement} [element] Element to anchor editor to (defaults to events element)
     * @category Feature shortcuts
     */

    /**
     * Returns the dependency record for a DOM element
     *
     * *NOTE: Only available when the {@link Scheduler/feature/Dependencies Dependencies} feature is enabled.*
     *
     * @function resolveDependencyRecord
     * @param {HTMLElement} element The dependency line element
     * @returns {Scheduler.model.DependencyModel} The dependency record
     * @category Feature shortcuts
     */

    //endregion

    //region Init

    afterConstruct() {
        const me = this;

        super.afterConstruct();

        me.on('scroll', me.onVerticalScroll, me);

        if (me.createEventOnDblClick) {
            me.on('scheduledblclick', me.onTimeAxisCellDblClick);
        }
    }

    //endregion

    //region Overrides

    onPaintOverride() {
        // Internal procedure used for paint method overrides
        // Not used in onPaint() because it may be chained on instance and Override won't be applied
    }

    //endregion

    //region Config getters/setters

    // Placeholder getter/setter for mixins, please make any changes needed to SchedulerStores#store instead
    get store() {
        return super.store;
    }

    set store(store) {
        super.store = store;
    }

    /**
     * Returns an object defining the range of visible resources
     * @property {Object}
     * @property {Number} visibleResources.first First visible resource
     * @property {Number} visibleResources.last Last visible resource
     * @readonly
     */
    get visibleResources() {
        const me = this;

        if (me.isVertical) {
            return me.currentOrientation.visibleResources;
        }

        return {
            first : me.store.getById(me.firstVisibleRow?.id),
            last  : me.store.getById(me.lastVisibleRow?.id)
        };
    }

    //endregion

    //region Event handlers

    onLocaleChange() {
        this.currentOrientation.onLocaleChange();

        super.onLocaleChange();
    }

    onTimeAxisCellDblClick({ date : startDate, resourceRecord, row }) {
        const me = this;

        if (me.readOnly || resourceRecord.isSpecialRow || resourceRecord.readOnly) {
            return;
        }

        me.createEvent(startDate, resourceRecord, row);
    }

    onVerticalScroll({ scrollTop }) {
        this.currentOrientation.updateFromVerticalScroll(scrollTop);
    }

    /**
     * Called when new event is created.
     * Сan be overriden to supply default record values etc.
     * @param {Scheduler.model.EventModel} eventRecord Newly created event
     */
    onEventCreated(eventRecord) {}

    //endregion

    //region Mode

    /**
     * Checks if scheduler is in horizontal mode
     * @returns {Boolean}
     * @readonly
     * @category Common
     * @private
     */
    get isHorizontal() {
        return this.mode === 'horizontal';
    }

    /**
     * Checks if scheduler is in vertical mode
     * @returns {Boolean}
     * @readonly
     * @category Common
     * @private
     */
    get isVertical() {
        return this.mode === 'vertical';
    }

    /**
     * Get mode (horizontal/vertical)
     * @property {'horizontal'|'vertical'}
     * @readonly
     * @category Common
     */
    get mode() {
        return this._mode;
    }

    set mode(mode) {
        const me = this;

        me._mode = mode;

        if (!me[mode]) {
            me.element.classList.add(`b-sch-${mode}`);

            if (mode === 'horizontal') {
                me.horizontal = new HorizontalRendering(me);
                if (me.isPainted) {
                    me.horizontal.init();
                }
            }
            else if (mode === 'vertical') {
                me.vertical = new VerticalRendering(me);

                if (me.rendered) {
                    me.vertical.init();
                }
            }
        }
    }

    get currentOrientation() {
        return this[this.mode];
    }

    //endregion

    //region Dom event dummies

    // this is ugly, but needed since super cannot be called from SchedulerDomEvents mixin...

    onElementKeyDown(event) {
        return super.onElementKeyDown(event);
    }

    onElementKeyUp(event) {
        return super.onElementKeyUp(event);
    }

    onElementMouseOver(event) {
        return super.onElementMouseOver(event);
    }

    onElementMouseOut(event) {
        return super.onElementMouseOut(event);
    }

    //endregion

    //region Feature hooks

    // Called for each event during drop
    processEventDrop() {}
    processCrossSchedulerEventDrop() {}

    // Called before event drag starts
    beforeEventDragStart() {}

    // Called after event drag starts
    afterEventDragStart() {}

    // Called after aborting a drag
    afterEventDragAbortFinalized() {}

    // Called during event drag validation
    checkEventDragValidity() {}

    // Called after event resizing starts
    afterEventResizeStart() {}

    //endregion

    //region Scheduler specific date mapping functions

    get hasEventEditor() {
        const {
            eventEdit,
            taskEdit,
            simpleEventEdit
        } = this.features;

        return Boolean(
            eventEdit?.enabled || taskEdit?.enabled || simpleEventEdit?.enabled
        );
    }

    // Method is chained by event editing features. Ensure that the event is in the store.
    editEvent(eventRecord, resourceRecord, element) {
        const
            me = this,
            {
                eventStore,
                assignmentStore
            } = me;

        // Abort the chain if no event editing features available
        if (!me.hasEventEditor) {
            return false;
        }

        if (eventRecord.eventStore !== eventStore) {
            const
                { enableEventAnimations } = me,
                resourceRecords           = [];

            // It's only a provisional event because we are going to edit it which will
            // allow an opportunity to cancel the add (by removing it).
            eventRecord.isCreating = true;

            let assignmentRecords = [];

            if (resourceRecord) {
                resourceRecords.push(resourceRecord);
                assignmentRecords = assignmentStore.assignEventToResource(eventRecord, resourceRecord);
            }

            // Vetoable beforeEventAdd allows cancel of this operation
            if (me.trigger('beforeEventAdd', { eventRecord, resourceRecords, assignmentRecords }) === false) {
                // Remove any assignment created above, to leave store as it was
                assignmentStore?.remove(assignmentRecords);

                return false;
            }

            me.enableEventAnimations = false;
            eventStore.add(eventRecord);
            me.project.commitAsync().then(() => me.enableEventAnimations = enableEventAnimations);

            // Element must be created synchronously, not after the project's normalizing delays.
            me.refreshRows();
        }
    }

    /**
     * Creates an event on the specified date, for the specified resource which conforms to this
     * scheduler's {@link #config-createEventOnDblClick} setting.
     *
     * This method may be called programmatically by application code if the `createEventOnDblClick` setting
     * is `false`, in which case the default values for `createEventOnDblClick` will be used.
     *
     * If the {@link Scheduler.feature.EventEdit} feature is active, the new event
     * will be displayed in the event editor.
     * @param {Date} date The date to add the event at.
     * @param {Scheduler.model.ResourceModel} resourceRecord The resource to create the event for.
     */
    async createEvent(startDate, resourceRecord) {
        const
            me                    = this,
            {
                enableEventAnimations,
                features,
                eventStore,
                assignmentStore
            }                     = me,
            resourceRecords       = [resourceRecord],
            useEventModelDefaults = me.createEventOnDblClick.useEventModelDefaults,
            defaultDuration       = useEventModelDefaults ? eventStore.modelClass.defaultValues.duration : 1,
            defaultDurationUnit   = useEventModelDefaults ? eventStore.modelClass.defaultValues.durationUnit : me.timeAxis.unit,
            eventRecord           = eventStore.createRecord({
                startDate,
                endDate      : DateHelper.add(startDate, defaultDuration, defaultDurationUnit),
                duration     : defaultDuration,
                durationUnit : defaultDurationUnit,
                name         : me.L('L{Object.newEvent}')
            }),
            eventEditAvailable    = Boolean(features.eventEdit?.enabled || features.taskEdit?.enabled || features.simpleEventEdit?.enabled);

        // It's only a provisional event if there is an event edit feature available to
        // cancel the add (by removing it). Otherwise it's a definite event creation.
        eventRecord.isCreating = eventEditAvailable;

        me.onEventCreated(eventRecord);

        const assignmentRecords = assignmentStore?.assignEventToResource(eventRecord, resourceRecord);

        /**
         * Fires before an event is added. Can be triggered by schedule double click or drag create action.
         * @event beforeEventAdd
         * @param {Scheduler.view.Scheduler} source The Scheduler instance
         * @param {Scheduler.model.EventModel} eventRecord The record about to be added
         * @param {Scheduler.model.ResourceModel[]} resourceRecords Resources that the record is assigned to
         * @param {Scheduler.model.AssignmentModel[]} assignmentRecords The assignment records
         * @preventable
         */
        if (me.trigger('beforeEventAdd', { eventRecord, resourceRecords, assignmentRecords }) === false) {
            // Remove any assignment created above, to leave store as it was
            assignmentStore?.remove(assignmentRecords);

            return;
        }

        me.enableEventAnimations = false;
        eventStore.add(eventRecord);
        me.project.commitAsync().then(() => me.enableEventAnimations = enableEventAnimations);

        // Element must be created synchronously, not after the project's normalizing delays.
        // Overrides the check for isEngineReady in VerticalRendering so that the newly added record
        // will be rendered when we call refreshRows.
        me.isCreating = true;
        me.refreshRows();
        me.isCreating = false;

        /**
         * Fired when a double click or drag gesture has created a new event and added it to the event store.
         * @event eventAutoCreated
         * @param {Scheduler.view.Scheduler} source This Scheduler.
         * @param {Scheduler.model.EventModel} eventRecord The new event record.
         * @param {Scheduler.model.ResourceModel} resourceRecord The resource assigned to the new event.
         */
        me.trigger('eventAutoCreated', {
            eventRecord,
            resourceRecord
        });

        if (eventEditAvailable) {
            me.editEvent(eventRecord, resourceRecord, me.getEventElement(eventRecord));
        }
    }

    /**
     * Checks if a date range is allocated or not for a given resource.
     * @param {Date} start The start date
     * @param {Date} end The end date
     * @param {Scheduler.model.EventModel|null} excludeEvent An event to exclude from the check (or null)
     * @param {Scheduler.model.ResourceModel} resource The resource
     * @returns {Boolean} True if the timespan is available for the resource
     * @category Dates
     */
    isDateRangeAvailable(start, end, excludeEvent, resource) {
        return this.eventStore.isDateRangeAvailable(start, end, excludeEvent, resource);
    }
    //endregion

    /**
     * Suspends UI refresh on store operations.
     *
     * Multiple calls to `suspendRefresh` stack up, and will require an equal number of `resumeRefresh` calls to
     * actually resume UI refresh.
     *
     * @function suspendRefresh
     */

    /**
     * Resumes UI refresh on store operations.
     *
     * Multiple calls to `suspendRefresh` stack up, and will require an equal number of `resumeRefresh` calls to
     * actually resume UI refresh.
     *
     * Specify `true` as the first param to trigger a refresh if this call unblocked the refresh suspension.
     * If the underlying project is calculating changes, the refresh will be postponed until it is done.
     *
     * @param {Boolean} trigger `true` to trigger a refresh, if this resume unblocks the suspend
     */
    async resumeRefresh(trigger) {
        super.resumeRefresh(false);

        const me = this;

        if (!me.refreshSuspended && trigger) {
            // Do not refresh until project is in a valid state
            if (!me.isEngineReady) {
                // Refresh will happen because of the commit, bail out of this one after forcing rendering to consider
                // next one a full refresh
                me.currentOrientation.refreshAllWhenReady = true;
                return me.project.commitAsync();
            }

            // View could've been destroyed while we waited for engine
            if (!me.isDestroyed) {
                // If it already is, refresh now
                me.refreshWithTransition();
            }
        }
    }

    //region Appearance

    // Overrides grid to take crudManager loading into account
    toggleEmptyText() {
        const
            me = this;

        if (me.bodyContainer) {
            DomHelper.toggleClasses(me.bodyContainer, 'b-grid-empty', !(me.resourceStore.count > 0 || me.crudManager?.isLoading));
        }
    }

    // Overrides Grids base implementation to return a correctly calculated height for the row. Also stores it in
    // RowManagers height map, which is used to calculate total height etc.
    getRowHeight(resourceRecord) {
        if (this.isHorizontal) {
            const height = this.currentOrientation.calculateRowHeight(resourceRecord);
            this.rowManager.storeKnownHeight(resourceRecord.id, height);
            return height;
        }
    }

    // Calculates the height for specified rows. Call when changes potentially makes its height invalid
    calculateRowHeights(resourceRecords, silent = false) {
        // Array allowed to have nulls in it for easier code when calling this fn
        resourceRecords.forEach(resourceRecord => resourceRecord && this.getRowHeight(resourceRecord));

        if (!silent) {
            this.rowManager.estimateTotalHeight(true);
        }
    }

    // Calculate heights for all rows (up to the preCalculateHeightLimit)
    calculateAllRowHeights(silent = false) {
        const
            { store, rowManager } = this,
            count                 = Math.min(store.count, this.preCalculateHeightLimit);

        // Allow opt out by specifying falsy value.
        if (count) {
            rowManager.clearKnownHeights();

            for (let i = 0; i < count; i++) {
                // This will both calculate and store the height
                this.getRowHeight(store.getAt(i));
            }

            // Make sure height is reflected on scroller etc.
            if (!silent) {
                rowManager.estimateTotalHeight(true);
            }
        }
    }

    //endregion

    //region Calendar Mode Interface

    // These are all internal and match up w/CalendarMixin

    get description() {
        return this.callback(this.descriptionRenderer, this, [this]);
    }

    getEventRecord(target) {
        target = DomHelper.getEventElement(target);

        return this.resolveEventRecord(target);
    }

    getEventElement(eventRecord) {
        return this.getElementFromEventRecord(eventRecord);
    }

    changeRange(unit) {
        return DateHelper.normalizeUnit(unit);
    }

    updateRange(unit) {
        if (!this.isConfiguring) {
            const
                currentDate = this.date,
                newDate     = this.date = DateHelper.startOf(currentDate, unit);

            // Force a span update if changing the range did not change the date
            if (currentDate.getTime() === newDate.getTime()) {
                this.updateDate(newDate);
            }
        }
    }

    changeStepUnit(unit) {
        return DateHelper.normalizeUnit(unit);
    }

    updateDate(newDate) {
        const
            me    = this,
            start = DateHelper.startOf(newDate, me.range);

        me.setTimeSpan(start, DateHelper.add(start, 1, me.range));

        // Cant always use newDate here in case timeAxis is filtered
        me.visibleDate = {
            date    : DateHelper.max(newDate, me.timeAxis.startDate),
            block   : 'start',
            animate : true
        };

        me.trigger('descriptionChange');
    }

    previous() {
        this.date = DateHelper.add(this.date, -1, this.stepUnit);
    }

    next() {
        this.date = DateHelper.add(this.date, 1, this.stepUnit);
    }

    //endregion

    /**
     * Assigns and schedules an unassigned event record (+ adds it to this Scheduler's event store unless already in it).
     * @param {Object} config The config containing data about the event record to schedule
     * @param {Date} config.startDate The start date
     * @param {Scheduler.model.EventModel|Object} config.eventRecord Event (or data for it) to assign and schedule
     * @param {Scheduler.model.EventModel} [config.parentEventRecord] Parent event to add the event to (to nest it),
     * only applies when using the NestedEvents feature
     * @param {Scheduler.model.ResourceModel} config.resourceRecord Resource to assign the event to
     * @param {HTMLElement} [config.element] The element if you are dragging an element from outside the scheduler
     */
    async scheduleEvent({ startDate, eventRecord, resourceRecord, element }) {
        const me = this;

        // NestedEvents has an override for this function to handle parentEventRecord

        if (!me.eventStore.includes(eventRecord)) {
            [eventRecord] = me.eventStore.add(eventRecord);
        }

        eventRecord.startDate = startDate;
        eventRecord.assign(resourceRecord);

        if (element) {
            const eventRect = Rectangle.from(element, me.foregroundCanvas);

            // Clear translate styles used by DragHelper
            DomHelper.setTranslateXY(element, 0, 0);
            DomHelper.setTopLeft(element, eventRect.y, eventRect.x);

            DomSync.addChild(me.foregroundCanvas, element, eventRecord.assignments[0].id);
        }

        await me.project.commitAsync();
    }
}

// Register this widget type with its Factory
SchedulerBase.initClass();

// Scheduler version is specified in TimelineBase because Gantt extends it
