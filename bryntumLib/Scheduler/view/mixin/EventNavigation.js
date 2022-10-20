import Base from '../../../Core/Base.js';
import Navigator from '../../../Core/helper/util/Navigator.js';
import DomHelper from '../../../Core/helper/DomHelper.js';
import Delayable from '../../../Core/mixin/Delayable.js';
import Location from '../../../Grid/util/Location.js';

/**
 * @module Scheduler/view/mixin/EventNavigation
 */

const
    preventDefault  = e => e.preventDefault(),
    isArrowKey = {
        ArrowRight : 1,
        ArrowLeft  : 1,
        ArrowUp    : 1,
        ArrowDown  : 1
    },
    animate100 = {
        animate : 100
    },
    emptyObject = Object.freeze({});

/**
 * Mixin that tracks event or assignment selection by clicking on one or more events in the scheduler.
 * @mixin
 */
export default Target => class EventNavigation extends Delayable(Target || Base) {
    static get $name() {
        return 'EventNavigation';
    }

    //region Default config

    static get configurable() {
        return {
            /**
             * A config object to use when creating the {@link Core.helper.util.Navigator}
             * to use to perform keyboard navigation in the timeline.
             * @config {NavigatorConfig}
             * @default
             * @category Misc
             * @internal
             */
            navigator : {
                allowCtrlKey   : true,
                scrollSilently : true,
                keys           : {
                    Space     : 'onEventSpaceKey',
                    Enter     : 'onEventEnterKey',
                    Delete    : 'onDeleteKey',
                    Backspace : 'onDeleteKey',
                    ArrowUp   : 'onArrowUpKey',
                    ArrowDown : 'onArrowDownKey',
                    Escape    : 'onEscapeKey',

                    // These are processed by GridNavigation's handlers
                    Tab         : 'onTab',
                    'SHIFT+Tab' : 'onShiftTab'
                }
            },

            isNavigationKey : {
                ArrowDown  : 1,
                ArrowUp    : 1,
                ArrowLeft  : 1,
                ArrowRight : 1
            }
        };
    }

    static get defaultConfig() {
        return {
            /**
             * A CSS class name to add to focused events.
             * @config {String}
             * @default
             * @category CSS
             * @private
             */
            focusCls : 'b-active',

            /**
             * Allow using [Delete] and [Backspace] to remove events/assignments
             * @config {Boolean}
             * @default
             * @category Misc
             */
            enableDeleteKey : true,

            // Number in milliseconds to buffer handlers execution. See `Delayable.throttle` function docs.
            onDeleteKeyBuffer      : 500,
            navigatePreviousBuffer : 200,
            navigateNextBuffer     : 200,

            testConfig : {
                onDeleteKeyBuffer : 1
            }
        };
    }

    //endregion

    //region Events

    /**
     * Fired when a user gesture causes the active item to change.
     * @event navigate
     * @param {Event} event The browser event which instigated navigation. May be a click or key or focus event.
     * @param {HTMLElement|null} item The newly active item, or `null` if focus moved out.
     * @param {HTMLElement|null} oldItem The previously active item, or `null` if focus is moving in.
     */

    //endregion

    construct(config) {
        const me = this;

        me.isInTimeAxis = me.isInTimeAxis.bind(me);
        me.onDeleteKey = me.throttle(me.onDeleteKey, me.onDeleteKeyBuffer, me);

        super.construct(config);
    }

    changeNavigator(navigator) {
        const me = this;

        me.getConfig('subGridConfigs');

        return new Navigator(me.constructor.mergeConfigs({
            ownerCmp         : me,
            target           : me.timeAxisSubGridElement,
            processEvent     : me.processEvent,
            itemSelector     : `.${me.eventCls}-wrap`,
            focusCls         : me.focusCls,
            navigatePrevious : me.throttle(me.navigatePrevious, { delay : me.navigatePreviousBuffer, throttled : preventDefault }),
            navigateNext     : me.throttle(me.navigateNext, { delay : me.navigateNextBuffer, throttled : preventDefault })
        }, navigator));
    }

    doDestroy() {
        this.navigator.destroy();
        super.doDestroy();
    }

    isInTimeAxis(record) {
        // If event is hidden by workingTime configs, horizontal mapper would raise a flag on instance meta
        // We still need to check if time span is included in axis
        return !record.instanceMeta(this).excluded && this.timeAxis.isTimeSpanInAxis(record);
    }

    onElementKeyDown(keyEvent) {
        const
            me              = this,
            { navigator }   = me,
            composedKeyName = navigator.constructor.getComposedKeyName(keyEvent);

        // If we're focused in the time axis, and *not* on an event, then ENTER means
        // jump down into the first visible assignment in the cell.
        if (me.focusedCell?.rowIndex !== -1 && me.focusedCell?.column === me.timeAxisColumn && !keyEvent.target.closest(navigator.itemSelector) && keyEvent.key === 'Enter') {
            const firstAssignment = me.getFirstVisibleAssignment();
            if (firstAssignment) {
                me.navigateTo(firstAssignment, {
                    uiEvent : keyEvent
                });
                return false;
            }
        }
        else {
            // Only pass up to superclass if it's not one of our navigation keys
            // or isn't from our navigation
            if (!me.isNavigationKey[composedKeyName] || !keyEvent.target.matches(me.navigator.itemSelector)) {
                return super.onElementKeyDown?.(keyEvent);
            }
        }
    }

    getFirstVisibleAssignment(location = this.focusedCell) {
        const
            me = this,
            {
                currentOrientation,
                rowManager,
                eventStore
            } = me;

        if (me.isHorizontal) {
            let renderedEvents = currentOrientation.rowMap.get(rowManager.getRow(location.rowIndex));

            if (renderedEvents?.length) {
                return renderedEvents[0]?.elementData.assignmentRecord;
            }
            else {
                renderedEvents = currentOrientation.resourceMap.get(location.id)?.eventsData;
                if (renderedEvents?.length) {
                    // When events are gathered from resource, we need to check they're available
                    return renderedEvents.filter(e => eventStore.isAvailable(e.eventRecord))[0]?.assignmentRecord;
                }
            }
        }
        else {
            const
                firstResource = [...currentOrientation.resourceMap.values()][0],
                renderedEvents = firstResource && Object.values(firstResource);

            if (renderedEvents?.length) {
                return renderedEvents.filter(e => eventStore.isAvailable(e.renderData.eventRecord))[0].renderData.assignmentRecord;
            }
        }
    }

    onGridBodyFocusIn(focusEvent) {
        const isGridCellFocus = focusEvent.target.closest(this.focusableSelector);

        // Event navigation only has a say when navigation is inside the TimeAxisSubGrid
        if (this.timeAxisSubGridElement.contains(focusEvent.target)) {
            const
                me                  = this,
                { navigationEvent } = me,
                { target }          = focusEvent,
                eventFocus          = target.closest(me.navigator.itemSelector),
                destinationCell     = eventFocus ? me.normalizeCellContext({
                    rowIndex : me.isVertical ? 0
                        : me.resourceStore.indexOf(me.resolveResourceRecord(target)),
                    column : me.timeAxisColumn,
                    target
                }) : new Location(target);

            // Don't take over what the event navigator does if it's doing event navigation.
            // Just silently cache our actionable location.
            if (eventFocus) {
                const { _focusedCell } = me;

                me._focusedCell = destinationCell;
                me.onCellNavigate?.(me, _focusedCell, destinationCell, navigationEvent, true);
                return;
            }

            // Depending on how we got here, try to focus the first event in the cell *if we're in a cell*.
            if (isGridCellFocus && (!navigationEvent || isArrowKey[navigationEvent.key])) {
                const firstAssignment = me.getFirstVisibleAssignment(destinationCell);
                if (firstAssignment) {
                    me.navigateTo(firstAssignment, {
                        // Only change scroll if focus came from key press
                        scrollIntoView : Boolean(navigationEvent && navigationEvent.type !== 'mousedown'),
                        uiEvent        : navigationEvent || focusEvent
                    });
                    return;
                }
            }
        }

        // Grid-level focus movement, let superclass handle it.
        if (isGridCellFocus) {
            super.onGridBodyFocusIn(focusEvent);
        }
    }

    /*
     * Override of GridNavigation#focusCell method to handle the TimeAxisColumn.
     * Not needed until we implement full keyboard accessibility.
     */
    accessibleFocusCell(cellSelector, options) {
        const me                     = this;

        cellSelector = me.normalizeCellContext(cellSelector);

        if (cellSelector.columnId === me.timeAxisColumn.id) {
            // const lastFocusedCell        = me.lastFocusedCell = me._focusedCell,
            //     lastFocusedCellElement = lastFocusedCell && me.getCell(lastFocusedCell),
            //     newCell = me.getCell(cellSelector),
            //     // Flag if the lastFocusedCellElement is DOCUMENT_POSITION_FOLLOWING newCell
            //     backwards = !!(lastFocusedCellElement && (newCell.compareDocumentPosition(lastFocusedCellElement) & 4));

            // // Navigating into the Scheduler, need to enable this back (for situations where we know focus was requested as a result of a keyboard input)...
            // let newEvent = me.getRecordFromElement(newCell);

            // me._focusedCell = cellSelector;

            // // Scheduler where row is a Resource which might have many events
            // // TODO: https://app.assembla.com/spaces/bryntum/tickets/6526 this class should
            // // not know about Gantt.
            // if (!newEvent.isTask) {
            //     const resourceEvents = newEvent.getEvents().filter(me.isInTimeAxis).sort(sortByStartDate);
            //     newEvent = resourceEvents[backwards ? resourceEvents.length - 1 : 0];
            // }

            // options.event.eventRecord = newEvent;

            // if (newEvent && me.activeEvent !== newEvent) {
            //     lastFocusedCellElement && lastFocusedCellElement.classList.remove('b-focused');
            //     me.scrollResourceEventIntoView(me.store.getById(cellSelector.id), newEvent, {
            //         animate : 100
            //     }).then(() => {
            //         me.activeEvent = newEvent;
            //     });
            // }
        }
        else {
            return super.focusCell(cellSelector, options);
        }
    }

    // Interface method to extract the navigated to record from a populated 'navigate' event.
    // Gantt, Scheduler and Calendar handle event differently, adding different properties to it.
    // This method is meant to be overridden to return correct target from event
    normalizeTarget(event) {
        return event.assignmentRecord;
    }

    getPrevious(assignmentRecord, isDelete) {
        const
            me                     = this,
            { resourceStore }      = me,
            { eventSorter }        = me.currentOrientation,
            // start/end dates are required to limit time span to look at in case recurrence feature is enabled
            { startDate, endDate } = me.timeAxis,
            eventRecord            = assignmentRecord.event,
            resourceEvents         = me.eventStore
                .getEvents({
                    resourceRecord : assignmentRecord.resource,
                    startDate,
                    endDate
                })
                .filter(this.isInTimeAxis)
                .sort(eventSorter);

        let resourceRecord = assignmentRecord.resource,
            previousEvent  = resourceEvents[resourceEvents.indexOf(eventRecord) - 1];

        // At first event for resource, traverse up the resource store.
        if (!previousEvent) {
            // If we are deleting an event, skip other instances of the event which we may encounter
            // due to multi-assignment.
            for (
                let rowIdx = resourceStore.indexOf(resourceRecord) - 1;
                (!previousEvent || (isDelete && previousEvent === eventRecord)) && rowIdx >= 0;
                rowIdx--
            ) {
                resourceRecord = resourceStore.getAt(rowIdx);
                const events = me.eventStore
                    .getEvents({
                        resourceRecord,
                        startDate,
                        endDate
                    })
                    .filter(me.isInTimeAxis)
                    .sort(eventSorter);

                previousEvent = events.length && events[events.length - 1];
            }
        }

        return me.assignmentStore.getAssignmentForEventAndResource(previousEvent, resourceRecord);
    }

    navigatePrevious(keyEvent) {
        const
            me                 = this,
            previousAssignment = me.getPrevious(me.normalizeTarget(keyEvent));

        keyEvent.preventDefault();
        if (previousAssignment) {
            if (!keyEvent.ctrlKey) {
                me.clearEventSelection();
            }
            return me.navigateTo(previousAssignment, {
                uiEvent : keyEvent
            });
        }

        // No previous event/task, fall back to Grid's handling of this gesture
        return me.doGridNavigation(keyEvent);
    }

    getNext(assignmentRecord, isDelete) {
        const
            me                     = this,
            { resourceStore }      = me,
            { eventSorter }        = me.currentOrientation,
            // start/end dates are required to limit time span to look at in case recurrence feature is enabled
            { startDate, endDate } = me.timeAxis,
            eventRecord            = assignmentRecord.event,
            resourceEvents         = me.eventStore
                .getEvents({
                    resourceRecord : assignmentRecord.resource,
                    // start/end are required to limit time
                    startDate,
                    endDate
                })
                .filter(this.isInTimeAxis)
                .sort(eventSorter);

        let resourceRecord = assignmentRecord.resource,
            nextEvent      = resourceEvents[resourceEvents.indexOf(eventRecord) + 1];

        // At last event for resource, traverse down the resource store
        if (!nextEvent) {
            // If we are deleting an event, skip other instances of the event which we may encounter
            // due to multi-assignment.
            for (let rowIdx = resourceStore.indexOf(resourceRecord) + 1; (!nextEvent || (isDelete && nextEvent === eventRecord)) && rowIdx < resourceStore.count; rowIdx++) {
                resourceRecord = resourceStore.getAt(rowIdx);
                const events = me.eventStore
                    .getEvents({
                        resourceRecord,
                        startDate,
                        endDate
                    })
                    .filter(me.isInTimeAxis)
                    .sort(eventSorter);

                nextEvent = events[0];
            }
        }

        return me.assignmentStore.getAssignmentForEventAndResource(nextEvent, resourceRecord);
    }

    navigateNext(keyEvent) {
        const
            me             = this,
            nextAssignment = me.getNext(me.normalizeTarget(keyEvent));

        keyEvent.preventDefault();
        if (nextAssignment) {
            if (!keyEvent.ctrlKey) {
                me.clearEventSelection();
            }
            return me.navigateTo(nextAssignment, {
                uiEvent : keyEvent
            });
        }

        // No next event/task, fall back to Grid's handling of this gesture
        return me.doGridNavigation(keyEvent);
    }

    doGridNavigation(keyEvent) {
        if (!keyEvent.handled && keyEvent.key.indexOf('Arrow') === 0) {
            this[`navigate${keyEvent.key.substring(5)}ByKey`](keyEvent);
        }
    }

    async navigateTo(targetAssignment, {
        scrollIntoView = true,
        uiEvent        = {}
    } = emptyObject) {
        const
            me                      = this,
            { navigator }           = me,
            { skipScrollIntoView }  = navigator;

        if (targetAssignment) {
            if (scrollIntoView) {
                // No key processing during scroll
                navigator.disabled = true;
                await me.scrollAssignmentIntoView(targetAssignment, animate100);
                navigator.disabled = false;
            }
            else {
                navigator.skipScrollIntoView = true;
            }

            // Panel can be destroyed before promise is resolved
            // Perform a sanity check to make sure element is still in the DOM (syncIdMap actually).
            if (!me.isDestroyed && this.getElementFromAssignmentRecord(targetAssignment)) {
                me.activeAssignment = targetAssignment;
                navigator.skipScrollIntoView = skipScrollIntoView;
                navigator.trigger('navigate', {
                    event : uiEvent,
                    item  : DomHelper.up(me.getElementFromAssignmentRecord(targetAssignment), navigator.itemSelector)
                });
            }
        }
    }

    set activeAssignment(assignmentRecord) {
        const assignmentEl = this.getElementFromAssignmentRecord(assignmentRecord, true);

        if (assignmentEl) {
            this.navigator.activeItem = assignmentEl;
        }
    }

    get activeAssignment() {
        const { activeItem } = this.navigator;

        if (activeItem) {
            return this.resolveAssignmentRecord(activeItem);
        }
    }

    get previousActiveEvent() {
        const { previousActiveItem } = this.navigator;

        if (previousActiveItem) {
            return this.resolveEventRecord(previousActiveItem);
        }
    }

    processEvent(keyEvent) {
        const
            me           = this,
            eventElement = DomHelper.up(keyEvent.target, me.eventSelector);

        if (!me.navigator.disabled && eventElement) {
            keyEvent.assignmentRecord = me.resolveAssignmentRecord(eventElement);
            keyEvent.eventRecord = me.resolveEventRecord(eventElement);
            keyEvent.resourceRecord = me.resolveResourceRecord(eventElement);
        }

        return keyEvent;
    }

    onDeleteKey(keyEvent) {
        const me = this;
        if (!me.readOnly && me.enableDeleteKey) {
            const records = me.eventStore.usesSingleAssignment ? me.selectedEvents : me.selectedAssignments;

            me.removeEvents(records.filter(r => !r.readOnly));
        }
    }

    onArrowUpKey(keyEvent) {
        this.focusCell({
            rowIndex : this.focusedCell.rowIndex - 1,
            column   : this.timeAxisColumn
        });
        keyEvent.handled = true;
    }

    onArrowDownKey(keyEvent) {
        if (this.focusedCell.rowIndex < this.resourceStore.count - 1) {
            this.focusCell({
                rowIndex : this.focusedCell.rowIndex + 1,
                column   : this.timeAxisColumn
            });
            keyEvent.handled = true;
        }
    }

    onEscapeKey(keyEvent) {
        if (!keyEvent.target.closest('.b-dragging')) {
            this.focusCell({
                rowIndex : this.focusedCell.rowIndex,
                column   : this.timeAxisColumn
            });
            keyEvent.handled = true;
        }
    }

    /**
     * Internal utility function to remove events. Used when pressing [DELETE] or [BACKSPACE] or when clicking the
     * delete button in the event editor. Triggers a preventable `beforeEventDelete` or `beforeAssignmentDelete` event.
     * @param {Scheduler.model.EventModel[]|Scheduler.model.AssignmentModel[]} eventRecords Records to remove
     * @param {Function} [callback] Optional callback executed after triggering the event but before deletion
     * @returns {Boolean} Returns `false` if the operation was prevented, otherwise `true`
     * @internal
     * @fires beforeEventDelete
     * @fires beforeAssignmentDelete
     */
    removeEvents(eventRecords, callback = null) {
        const me = this;

        if (!me.readOnly && eventRecords.length) {
            const context = {
                finalize(removeRecord = true) {
                    if (callback) {
                        callback(removeRecord);
                    }

                    if (removeRecord !== false) {
                        if (eventRecords.some(record => record.isOccurrence || record.event?.isOccurrence)) {
                            eventRecords.forEach(record => record.isOccurrenceAssignment ? record.event.remove() : record.remove());
                        }
                        else {
                            const store = eventRecords[0].isAssignment ? me.assignmentStore : me.eventStore;

                            store.remove(eventRecords);
                        }
                    }
                }
            };

            let shouldFinalize;

            if (eventRecords[0].isAssignment) {
                /**
                 * Fires before an assignment is removed. Can be triggered by user pressing [DELETE] or [BACKSPACE] or
                 * by the event editor. Can for example be used to display a custom dialog to confirm deletion, in which
                 * case records should be "manually" removed after confirmation:
                 *
                 * ```javascript
                 * scheduler.on({
                 *    beforeAssignmentDelete({ assignmentRecords, context }) {
                 *        // Show custom confirmation dialog (pseudo code)
                 *        confirm.show({
                 *            listeners : {
                 *                onOk() {
                 *                    // Remove the assignments on confirmation
                 *                    context.finalize(true);
                 *                },
                 *                onCancel() {
                 *                    // do not remove the assignments if "Cancel" clicked
                 *                    context.finalize(false);
                 *                }
                 *            }
                 *        });
                 *
                 *        // Prevent default behaviour
                 *        return false;
                 *    }
                 * });
                 * ```
                 *
                 * @event beforeAssignmentDelete
                 * @param {Scheduler.view.Scheduler} source  The Scheduler instance
                 * @param {Scheduler.model.EventModel[]} eventRecords  The records about to be deleted
                 * @param {Object} context  Additional removal context:
                 * @param {Function} context.finalize  Function to call to finalize the removal.
                 *      Used to asynchronously decide to remove the records or not. Provide `false` to the function to
                 *      prevent the removal.
                 * @param {Boolean} [context.finalize.removeRecords = true]   Provide `false` to the function to prevent
                 *      the removal.
                 * @preventable
                 */
                shouldFinalize = me.trigger('beforeAssignmentDelete', { assignmentRecords : eventRecords, context });
            }
            else {
                /**
                 * Fires before an event is removed. Can be triggered by user pressing [DELETE] or [BACKSPACE] or by the
                 * event editor. Can for example be used to display a custom dialog to confirm deletion, in which case
                 * records should be "manually" removed after confirmation:
                 *
                 * ```javascript
                 * scheduler.on({
                 *    beforeEventDelete({ eventRecords, context }) {
                 *        // Show custom confirmation dialog (pseudo code)
                 *        confirm.show({
                 *            listeners : {
                 *                onOk() {
                 *                    // Remove the events on confirmation
                 *                    context.finalize(true);
                 *                },
                 *                onCancel() {
                 *                    // do not remove the events if "Cancel" clicked
                 *                    context.finalize(false);
                 *                }
                 *            }
                 *        });
                 *
                 *        // Prevent default behaviour
                 *        return false;
                 *    }
                 * });
                 * ```
                 *
                 * @event beforeEventDelete
                 * @param {Scheduler.view.Scheduler} source  The Scheduler instance
                 * @param {Scheduler.model.EventModel[]} eventRecords  The records about to be deleted
                 * @param {Object} context  Additional removal context:
                 * @param {Function} context.finalize  Function to call to finalize the removal.
                 *      Used to asynchronously decide to remove the records or not. Provide `false` to the function to
                 *      prevent the removal.
                 * @param {Boolean} [context.finalize.removeRecords = true]  Provide `false` to the function to prevent
                 *      the removal.
                 * @preventable
                 */
                shouldFinalize = me.trigger('beforeEventDelete', { eventRecords, context });
            }

            if (shouldFinalize !== false) {
                context.finalize();
                return true;
            }
        }

        return false;
    }

    onEventSpaceKey(keyEvent) {
        // Empty, to be chained by features
    }

    onEventEnterKey(keyEvent) {
        // Empty, to be chained by features
    }

    get isActionableLocation() {
        // Override from grid if the Navigator's location is an event (or task if we're in Gantt)
        // Being focused on a task/event means that it's *not* actionable. It's not valid to report
        // that we're "inside" the cell in a TimeLine, so ESC must not attempt to focus the cell.
        if (!this.navigator.activeItem) {
            return super.isActionableLocation;
        }
    }

    // This does not need a className on Widgets.
    // Each *Class* which doesn't need 'b-' + constructor.name.toLowerCase() automatically adding
    // to the Widget it's mixed in to should implement thus.
    get widgetClass() {}
};
