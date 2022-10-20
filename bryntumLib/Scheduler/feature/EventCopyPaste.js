import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from '../../Grid/feature/GridFeatureManager.js';
import './ScheduleContext.js';

/**
 * @module Scheduler/feature/EventCopyPaste
 */

/**
 * Allow using [Ctrl/CMD + C/X] and [Ctrl/CMD + V] to copy/cut and paste events.
 *
 * This feature also adds entries to the {@link Scheduler/feature/EventMenu} for copying & cutting (see example below
 * for how to configure) and to the {@link Scheduler/feature/ScheduleMenu} for pasting.
 *
 * You can configure how a newly pasted record is named using {@link #function-generateNewName}.
 *
 * {@inlineexample Scheduler/feature/EventCopyPaste.js}
 *
 * If you want to highlight the paste location when clicking in the schedule, consider enabling the
 * {@link Scheduler/feature/ScheduleContext} feature.
 *
 * <div class="note">When used with Scheduler Pro, pasting will bypass any constraint set on the event to allow the
 * copy to be assigned the targeted date.</div>
 *
 * This feature is **enabled** by default.
 *
 * ## Customize menu items
 *
 * See {@link Scheduler/feature/EventMenu} and {@link Scheduler/feature/ScheduleMenu} for more info on customizing the
 * menu items supplied by the feature. This snippet illustrates the concept:
 *
 * ```javascript
 * // Custom copy text + remove cut option from event menu:
 * const scheduler = new Scheduler({
 *     features : {
 *         eventCopyPaste : true,
 *         eventMenu : {
 *             items : {
 *                 copyEvent : {
 *                     text : 'Copy booking'
 *                 },
 *                 cutEvent  : false
 *             }
 *         }
 *     }
 * });
 * ```
 *
 * ## Keyboard shortcuts
 *
 * The feature has the following default keyboard shortcuts:
 *
 * | Keys   | Action | Action description                                |
 * |--------|--------|---------------------------------------------------|
 * | Ctrl+C | copy   | Copies selected event(s) into the clipboard.      |
 * | Ctrl+X | cut    | Cuts out selected event(s) into the clipboard.    |
 * | Ctrl+V | paste  | Insert copied or cut event(s) from the clipboard. |
 *
 * For more information on how to customize keyboard shortcuts, please see
 * [our guide](#Scheduler/guides/customization/keymap.md).
 *
 * ## Multi assigned events
 *
 * In a Scheduler that uses single assignment, copying and then pasting creates a clone of the event and assigns it
 * to the target resource. Cutting and pasting moves the original event to the target resource.
 *
 * In a Scheduler using multi assignment, the behaviour is slightly more complex. Cutting and pasting reassigns the
 * event to the target, keeping other assignments of the same event intact. The behaviour for copying and pasting is
 * configurable using the {@link #config-copyPasteAction} config. It accepts two values:
 *
 * * `'clone'` - The default, the event is cloned and the clone is assigned to the target resource. Very similar to the
 *   behaviour with single assignment (event count goes up by 1).
 * * `'assign'` - The original event is assigned to the target resource (event count is unaffected).
 *
 * This snippet shows how to reconfigure it:
 *
 * ```javascript
 * const scheduler = new Scheduler({
 *     features : {
 *         eventCopyPaste : {
 *             copyPasteAction : 'assign'
 *         }
 *     }
 * });
 * ```
 *
 * <div class="note">Copying multiple assignments of the same event will always result in all but the first assignment
 * being removed on paste, since paste targets a single resource and an event can only be assigned to a resource once.
 * </div>
 *
 * @extends Core/mixin/InstancePlugin
 * @classtype eventCopyPaste
 * @feature
 */

export default class EventCopyPaste extends InstancePlugin {
    static $name = 'EventCopyPaste';

    static pluginConfig = {
        assign : [
            'copyEvents',
            'pasteEvents'
        ],
        chain : [
            'populateEventMenu',
            'populateScheduleMenu',
            'onEventDataGenerated'
        ]
    };

    static configurable = {
        /**
         * The field to use as the name field when updating the name of copied records
         * @config {String}
         * @default
         */
        nameField : 'name',

        /**
         * See {@link #keyboard-shortcuts Keyboard shortcuts} for details
         * @config {Object}
         */
        keyMap : {
            'Ctrl+C' : 'copy',
            'Ctrl+X' : 'cut',
            'Ctrl+V' : 'paste'
        },

        /**
         * How to handle a copy paste operation when the host uses multi assignment. Either:
         *
         * - `'clone'`  - The default, clone the copied event, assigning the clone to the target resource.
         * - `'assign'` - Add an assignment for the existing event to the target resource.
         *
         * For single assignment mode, it always uses the `'clone'` behaviour.
         *
         * @config {'clone'|'assign'}
         * @default
         */
        copyPasteAction : 'clone'
    };

    clipboardRecords = [];

    construct(scheduler, config) {
        super.construct(scheduler, config);

        // enable scheduleContext to highlight cell on click to paste
        if (scheduler.features.scheduleContext) {
            scheduler.features.scheduleContext.disabled = false;
        }

        scheduler.on({
            eventclick    : this.onEventClick,
            scheduleclick : this.onScheduleClick,
            thisObj       : this
        });

        this.scheduler = scheduler;
    }

    onEventDataGenerated(eventData) {
        const { assignmentRecord } = eventData;

        // No assignmentRecord for resource time ranges, which we want to ignore anyway
        if (assignmentRecord) {
            eventData.cls['b-cut-item'] = assignmentRecord.meta.isCut;
        }
    }

    onEventClick(context) {
        this._cellClickedContext = null;
    }

    onScheduleClick(context) {
        this._cellClickedContext = context;
    }

    isActionAvailable(keyCombination, action, event) {
        const cellEdit = this.client.features.cellEdit;

        // No action if
        // 1. there is selected text on the page
        // 2. cell editing is active
        // 3. cursor is not in the grid (filter bar etc)
        return !this.disabled &&
            globalThis.getSelection().toString().length === 0 &&
            !cellEdit?.isEditing &&
            Boolean(event.target.closest('.b-timeaxissubgrid'));
    }

    copy() {
        this.copyEvents();
    }

    cut() {
        this.copyEvents(undefined, true);
    }

    paste() {
        this.pasteEvents();
    }

    /**
     * Copy events (when using single assignment mode) or assignments (when using multi assignment mode) to clipboard to
     * paste later
     * @fires beforeCopy
     * @fires copy
     * @param {Scheduler.model.EventModel[]|Scheduler.model.AssignmentModel[]} [records] Pass records to copy them,
     * leave out to copying current selection
     * @param {Boolean} [isCut] Copies by default, pass `true` to cut instead
     * @category Edit
     */
    copyEvents(records = this.scheduler.selectedAssignments, isCut = false) {
        const
            me            = this,
            { scheduler } = me;

        if (!records?.length) {
            return;
        }

        let assignmentRecords = records.slice(); // Slice to not lose records if selection changes

        if (records[0].isEventModel) {
            assignmentRecords = records.map(r => r.assignments).flat();
        }

        // Prevent cutting readOnly events
        if (isCut) {
            assignmentRecords = assignmentRecords.filter(a => !a.event.readOnly);
        }

        const eventRecords = assignmentRecords.map(a => a.event);

        /**
         * Fires on the owning Scheduler before a copy action is performed, return `false` to prevent the action
         * @event beforeCopy
         * @preventable
         * @on-owner
         * @param {Scheduler.view.Scheduler} source Owner scheduler
         * @param {Scheduler.model.EventModel[]} records Deprecated, will be removed in 6.0. Use eventRecords instead.
         * @param {Scheduler.model.EventModel[]} eventRecords The event records about to be copied
         * @param {Scheduler.model.AssignmentModel[]} assignmentRecords The assignment records about to be copied
         * @param {Boolean} isCut `true` if this is a cut action
         */
        if (!assignmentRecords.length || scheduler.readOnly || scheduler.trigger('beforeCopy', {
            assignmentRecords, records : eventRecords, eventRecords, isCut
        }) === false) {
            return;
        }

        /**
         * Fires on the owning Scheduler after a copy action is performed.
         * @event copy
         * @on-owner
         * @param {Scheduler.view.Scheduler} source Owner scheduler
         * @param {Scheduler.model.EventModel[]} eventRecords The event records that were copied
         * @param {Scheduler.model.AssignmentModel[]} assignmentRecords The assignment records that were copied
         * @param {Boolean} isCut `true` if this is a cut action
         */
        if (assignmentRecords.length > 0) {
            scheduler.trigger('copy', { assignmentRecords, eventRecords, isCut });
        }

        me._isCut    = isCut;
        // records is used when call comes from context menu where the current event is the context
        me.clipboard = { assignmentRecords, eventRecords };
        
        scheduler.assignmentStore.forEach(assignment => {
            assignment.meta.isCut = isCut && assignmentRecords.includes(assignment);
        });

        // refresh to call onEventDataGenerated and reapply the cls for records where the cut was canceled
        scheduler.refreshWithTransition();
    }

    /**
     * Paste events or assignments to specified date and resource
     * @fires beforePaste
     * @fires paste
     * @param {Date} [date] Date where the events or assignments will be pasted
     * @param {Scheduler.model.ResourceModel} [resourceRecord] Resource to assign the pasted events or assignments to
     * @category Edit
     */
    pasteEvents(date, resourceRecord) {
        const
            me                                  = this,
            { clipboard, scheduler }            = me,
            { assignmentRecords, eventRecords } = clipboard,
            isCut                               = me._isCut;

        if (arguments.length === 0) {
            const context  = me._cellClickedContext || {};
            date           = context.date;
            resourceRecord = context.resourceRecord;
        }

        /**
         * Fires on the owning Scheduler before a paste action is performed, return `false` to prevent the action
         * @event beforePaste
         * @preventable
         * @on-owner
         * @param {Scheduler.view.Scheduler} source Owner scheduler
         * @param {Scheduler.model.EventModel[]} records Deprecated, will be removed in 6.0. Use eventRecords instead.
         * @param {Scheduler.model.EventModel[]} eventRecords The events about to be pasted
         * @param {Scheduler.model.AssignmentModel[]} assignmentRecords The assignments about to be pasted
         * @param {Date} date The date when the pasted events will be scheduled
         * @param {Scheduler.model.ResourceModel} resourceRecord The target resource record, the clipboard
         * event records will be assigned to this resource.
         * @param {Boolean} isCut `true` if this is a cut action
         */

        if (!clipboard || scheduler.trigger('beforePaste', { assignmentRecords, records : eventRecords, eventRecords, resourceRecord : resourceRecord || assignmentRecords[0].resource, date, isCut }) === false) {
            return;
        }

        let toFocus = null;

        const pastedEvents = new Set();

        for (const assignmentRecord of assignmentRecords) {
            let { event }            = assignmentRecord;
            const
                targetResourceRecord = resourceRecord || assignmentRecord.resource,
                targetDate           = date || assignmentRecord.event.startDate;

            // Pasting targets a specific resource, we cannot have multiple assignments to the same so remove all but
            // the first (happens when pasting multiple assignments of the same event)
            if (pastedEvents.has(event)) {
                if (isCut) {
                    assignmentRecord.remove();
                }
                continue;
            }

            pastedEvents.add(event);

            // Cut always means reassign
            if (isCut) {
                assignmentRecord.meta.isCut = false;
                assignmentRecord.resource   = targetResourceRecord;
                toFocus                     = assignmentRecord;
            }
            // Copy creates a new event in single assignment, or when configured to copy
            else if (scheduler.eventStore.usesSingleAssignment || me.copyPasteAction === 'clone') {
                event      = event.copy();
                event.name = me.generateNewName(event);
                scheduler.eventStore.add(event);
                event.assign(targetResourceRecord);
                toFocus = scheduler.assignmentStore.last;
            }
            // Safeguard against pasting on a resource where the event is already assigned,
            // a new assignment in multiassign mode will only change the date in such case
            else if (!event.resources.includes(targetResourceRecord)) {
                const newAssignmentRecord    = assignmentRecord.copy();
                newAssignmentRecord.resource = targetResourceRecord;
                [toFocus]                    = scheduler.assignmentStore.add(newAssignmentRecord);
            }

            event.startDate = targetDate;

            // Pro specific, to allow event to appear where pasted
            if (event.constraintDate) {
                event.constraintDate = null;
            }
        }

        /**
         * Fires on the owning Scheduler after a paste action is performed.
         * @event paste
         * @on-owner
         * @param {Scheduler.view.Scheduler} source Owner scheduler
         * @param {Scheduler.model.EventModel[]} eventRecords Pasted events
         * @param {Scheduler.model.AssignmentModel[]} assignmentRecords Pasted assignments
         * @param {Date} date date Pasted to this date
         * @param {Scheduler.model.ResourceModel} resourceRecord The target resource record
         * @param {Boolean} isCut `true` if this is a cut action
         */
        if (clipboard) {
            scheduler.trigger('paste', { assignmentRecords, eventRecords, resourceRecord, date, isCut });
        }

        // Focus the last pasted assignment
        const detacher = scheduler.on({
            renderEvent({ assignmentRecord, element }) {
                if (assignmentRecord === toFocus) {
                    element.focus();
                    detacher();
                }
            }
        });

        if (isCut) {
            me.clearClipboard();
        }
    }

    /**
     * Clears the clipboard and refreshes the UI
     */
    clearClipboard() {
        const me = this;
        if (me._isCut) {
            me.clipboard.assignmentRecords.forEach(assignment => {
                assignment.meta.isCut = false;
            });
            me.scheduler.refreshWithTransition();
            me._isCut = false;
        }
        // reset clipboard
        me.clipboard = null;
    }

    populateEventMenu({ assignmentRecord, items }) {
        const me = this;

        if (!me.scheduler.readOnly) {
            items.copyEvent = {
                text        : 'L{copyEvent}',
                localeClass : me,
                icon        : 'b-icon b-icon-copy',
                weight      : 110,
                onItem      : () => me.copyEvents([assignmentRecord].concat(me.scheduler.selectedAssignments.filter(rec => rec !== assignmentRecord)))
            };

            items.cutEvent = {
                text        : 'L{cutEvent}',
                localeClass : me,
                icon        : 'b-icon b-icon-cut',
                weight      : 120,
                disabled    : assignmentRecord.event.readOnly,
                onItem      : () => me.copyEvents([assignmentRecord].concat(me.scheduler.selectedAssignments.filter(rec => rec !== assignmentRecord)), true)
            };
        }
    }

    populateScheduleMenu({ items }) {
        const
            me            = this,
            { scheduler } = me;

        if (!scheduler.readOnly && me.clipboard) {
            items.pasteEvent = {
                text        : 'L{pasteEvent}',
                localeClass : me,
                icon        : 'b-icon b-icon-paste',
                disabled    : scheduler.resourceStore.count === 0,
                weight      : 110,
                onItem      : ({ date, resourceRecord }) => me.pasteEvents(date, resourceRecord, scheduler.getRowFor(resourceRecord))
            };
        }
    }

    /**
     * A method used to generate the name for a copy pasted record. By defaults appends "- 2", "- 3" as a suffix.
     *
     * @param {Scheduler.model.EventModel} eventRecord The new eventRecord being pasted
     * @returns {String}
     */
    generateNewName(eventRecord) {
        const originalName = eventRecord[this.nameField];

        let counter = 2;

        while (this.client.eventStore.findRecord(this.nameField, `${originalName} - ${counter}`)) {
            counter++;
        }

        return `${originalName} - ${counter}`;
    }
}

EventCopyPaste.featureClass = 'b-event-copypaste';

GridFeatureManager.registerFeature(EventCopyPaste, true, 'Scheduler');
