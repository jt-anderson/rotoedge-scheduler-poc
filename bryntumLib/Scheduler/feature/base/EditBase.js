import InstancePlugin from '../../../Core/mixin/InstancePlugin.js';
import DateField from '../../../Core/widget/DateField.js';
import DateHelper from '../../../Core/helper/DateHelper.js';
import ObjectHelper from '../../../Core/helper/ObjectHelper.js';
import Config from '../../../Core/Config.js';
import Objects from '../../../Core/helper/util/Objects.js';

/**
 * @module Scheduler/feature/base/EditBase
 */

const
    DH = DateHelper,
    scheduleFields = ['startDate', 'endDate', 'resource', 'recurrenceRule'],
    makeDate = (fields) => {
        // single field, update record directly
        if (fields.length === 1) return fields[0].value;
        // two fields, date + time
        else if (fields.length === 2) {
            const
                [date, time] = fields[0] instanceof DateField ? fields : fields.reverse(),
                dateValue    = DH.parse(date.value);

            if (dateValue) {
                dateValue.setHours(
                    time.value.getHours(),
                    time.value.getMinutes(),
                    time.value.getSeconds(),
                    time.value.getMilliseconds()
                );
            }

            // Clone to not end up sharing dates
            return dateValue ? DateHelper.clone(dateValue) : null;
        }
        // shouldn't happen...
        return null;
    },
    copyTime = (dateTo, dateFrom) => {
        const d = new Date(dateTo.getTime());
        d.setHours(dateFrom.getHours(), dateFrom.getMinutes());
        return d;
    },
    adjustEndDate = (startDate, startTime, me) => {
        // The end datetime just moves in response to the changed start datetime, keeping the same duration.
        if (startDate && startTime && me.endDateField && me.endTimeField) {
            const newEndDate = DH.add(copyTime(me.startDateField.value, me.startTimeField.value), me.eventRecord.durationMS, 'milliseconds');
            me.endDateField.value = newEndDate;
            me.endTimeField.value = DH.clone(newEndDate);
        }
    };

/**
 * Base class for EventEdit. Not to be used directly.
 *
 * @extends Core/mixin/InstancePlugin
 */
export default class EditBase extends InstancePlugin {
    //region Config

    static get configurable() {
        return {
            /**
             * True to save and close this panel if ENTER is pressed in one of the input fields inside the panel.
             * @config {Boolean}
             * @default
             * @category Editor
             */
            saveAndCloseOnEnter : true,

            triggerEvent : null,

            /**
             * This config parameter is passed to the `startDateField` and `endDateField` constructor.
             * @config {String}
             * @default
             * @category Editor widgets
             */
            dateFormat : 'L', // date format that uses browser locale

            /**
             * This config parameter is passed to the `startTimeField` and `endTimeField` constructor.
             * @config {String}
             * @default
             * @category Editor widgets
             */
            timeFormat : 'LT', // date format that uses browser locale

            /**
             * Default editor configuration, which widgets it shows etc.
             *
             * This is the entry point into configuring any aspect of the editor.
             *
             * The {@link Core.widget.Container#config-items} configuration of a Container
             * is *deeply merged* with its default `items` value. This means that you can specify
             * an `editorConfig` object which configures the editor, or widgets inside the editor:
             * ```javascript
             * const scheduler = new Scheduler({
             *     features : {
             *         eventEdit  : {
             *             editorConfig : {
             *                 autoClose : false,
             *                 modal     : true,
             *                 cls       : 'editor-widget-cls',
             *                 items : {
             *                     resourceField : {
             *                         hidden : true
             *                     },
             *                     // Add our own event owner field at the top of the form.
             *                     // Weight -100 will make it sort top the top.
             *                     ownerField : {
             *                         weight : -100,
             *                         type   : 'usercombo',
             *                         name   : 'owner',
             *                         label  : 'Owner'
             *                     }
             *                 },
             *                 bbar : {
             *                     items : {
             *                         deleteButton : false
             *                     }
             *                 }
             *             }
             *         }
             *     }
             * });
             * ```
             * @config {PopupConfig}
             * @category Editor
             */
            editorConfig : null,

            /**
             * An object to merge with the provided items config of the editor to override the
             * configuration of provided fields, or add new fields.
             *
             * Example:
             * ```javascript
             * const scheduler = new Scheduler({
             *     features : {
             *         eventEdit  : {
             *             items : {
             *                 // Merged with provided config of the resource field
             *                 resourceField : {
             *                     label : 'Calendar'
             *                 },
             *                 owner : {
             *                     weight : -100, // Will sort above system-supplied fields which are weight 0
             *                     type   : 'usercombo',
             *                     name   : 'owner',
             *                     label  : 'Owner'
             *                 }
             *             }
             *         }
             *     }
             * });
             *```
             *
             * The provided fields are called
             *  - `nameField`
             *  - `resourceField`
             *  - `startDateField`
             *  - `startTimeField`
             *  - `endDateField`
             *  - `endTimeField`
             *  - `recurrenceCombo`
             *  - `editRecurrenceButton`
             * @config {Object}
             * @category Editor widgets
             */
            items : null,

            /**
             * The week start day used in all date fields of the feature editor form by default.
             * 0 means Sunday, 6 means Saturday.
             * Defaults to the locale's week start day.
             * @config {Number}
             */
            weekStartDay : null
        };
    }

    //endregion

    //region Init & destroy

    construct(client, config) {
        const me = this;

        client.eventEdit = me;

        super.construct(client, ObjectHelper.assign({
            weekStartDay : client.weekStartDay
        }, config));

        me.clientListenersDetacher = client.on({
            [me.triggerEvent] : 'onActivateEditor',
            dragCreateEnd     : 'onDragCreateEnd',

            // Not fired at the Scheduler level.
            // Calendar, which inherits this, implements this event.
            eventAutoCreated : 'onEventAutoCreated',
            thisObj          : me
        });
    }

    doDestroy() {
        this.clientListenersDetacher();

        this._editor?.destroy();

        super.doDestroy();
    }

    //endregion

    //region Editing

    // Not implemented at this level.
    // Scheduler Editing relies on being called at point of event creation.
    onEventAutoCreated() {}

    changeEditorConfig(editorConfig) {
        const { items } = this;

        // Merge items which is an Object with the default editorConfig's items
        if (items) {
            editorConfig = Objects.clone(editorConfig);
            editorConfig.items = Config.merge(items, editorConfig.items);
        }

        return editorConfig;
    }

    changeItems(items) {
        this.cleanItemsConfig(items);
        return items;
    }

    // Remove any items configured as === true which just means default config options
    cleanItemsConfig(items) {
        for (const ref in items) {
            const itemCfg = items[ref];

            if (itemCfg === true) {
                delete items[ref];
            }
            else if (itemCfg?.items) {
                this.cleanItemsConfig(itemCfg.items);
            }
        }
    }

    onDatesChange(params) {
        const
            me    = this,
            field = params.source,
            value = params.value;

        switch (field.ref) {
            case 'startDateField':
                me.startTimeField && adjustEndDate(value, me.startTimeField.value, me);
                break;

            case 'startTimeField':
                me.startDateField && adjustEndDate(me.startDateField.value, value, me);
                break;
        }

        // End date can never be less than start date
        if (me.startDateField && me.endDateField) {
            me.endDateField.min = me.startDateField.value;
        }

        if (me.endTimeField) {
            // If the event starts and ends on the same day, the time fields need
            // to have their min and max set against each other.
            if (DH.isEqual(DH.clearTime(me.startDateField?.value), DH.clearTime(me.endDateField?.value))) {
                me.endTimeField.min = me.startTimeField.value;
            }
            else {
                me.endTimeField.min = null;
            }
        }
    }

    //endregion

    //region Save

    async save() {
        throw new Error('Implement in subclass');
    }

    get values() {
        const
            me          = this,
            { editor }  = me,
            startFields = [],
            endFields   = [],
            { values }  = editor;

        // The standard values getter will produce (almost) what we want, however, there are some special fields that
        // we need to take over. Remove those fields:
        scheduleFields.forEach(f => delete values[f]);

        editor.eachWidget(widget => {
            const { name } = widget;

            // If the widget is part of the recurrence editor, we don't gather it.
            if (!name || widget.hidden || widget.up(w => w === me.recurrenceEditor)) {
                delete values[name];
                return;
            }

            switch (name) {
                case 'startDate':
                    startFields.push(widget);
                    break;
                case 'endDate':
                    endFields.push(widget);
                    break;
                case 'resource':
                    values[name] = widget.record;
                    break;
                case 'recurrenceRule':
                    // If recurrence set to null, completely clear the recurrenceRule.
                    // Otherwise it will still be perceived as recurring with the rule 'FREQ=none'
                    values[name] = editor.widgetMap.recurrenceCombo?.value === 'none' ? '' : widget.value;
                    break;
                // Ignore other widgets and allow the standard values getter to provide them:
                // default:
                //     values[name] = widget.value;
            }
        }, true);

        // if is changing from not allDay to allDay should consider time fields to not change them on makeDate
        if (values.allDay && !me.eventRecord.allDay) {
            startFields.push(me.startTimeField);
            endFields.push(me.endTimeField);
        }

        // Handle fields being configured away
        if (startFields.length) {
            values.startDate = makeDate(startFields);
        }
        if (endFields.length) {
            values.endDate = makeDate(endFields);
        }

        // Since there is no duration field in the editor,
        // we don't need to recalc duration value on each date change.
        // It's enough to return correct duration value in `values`,
        // so the record will get updated with the correct data.
        if (('startDate' in values) && ('endDate' in values)) {
            values.duration = DH.diff(values.startDate, values.endDate, me.editor.record.durationUnit, true);
        }

        return values;
    }

    /**
     * Template method, intended to be overridden. Called before the event record has been updated.
     * @param {Scheduler.model.EventModel} eventRecord The event record
     *
     **/
    onBeforeSave(eventRecord) {}

    /**
     * Template method, intended to be overridden. Called after the event record has been updated.
     * @param {Scheduler.model.EventModel} eventRecord The event record
     *
     **/
    onAfterSave(eventRecord) {}

    /**
     * Updates record being edited with values from the editor
     * @private
     */
    updateRecord(record) {
        const { values } = this;

        // Clean resourceId / resources out of values when using assignment store, it will handle the assignment
        if (this.assignmentStore) {
            delete values.resource;
        }

        return record.set(values);
    }

    //endregion

    //region Events

    onBeforeEditorShow() {
        const
            { eventRecord, editor } = this.editingContext,
            { nameField } = editor.widgetMap;

        // Editing new event. Make sure user doesn't have to clear the input field.
        // Record field value still should be there because a rendered event block
        // looks bad with no text in it.
        // nameField may have been configured away.
        if (nameField && eventRecord.isCreating) {
            // Avoid initial invalid because required state.
            editor.assigningValues = true;
            nameField.value = '';
            editor.assigningValues = false;

            // Show new event text as a placeholder
            nameField._configuredPlaceholder = nameField.placeholder;
            nameField.placeholder = eventRecord.name;
        }
    }

    resetEditingContext() {
        const
            me              = this,
            {
                eventRecord,
                client
            }               = me,
            { eventStore }  = client,
            { nameField }   = me.editor.widgetMap;

        // This will remove the record from the store, *and* from the added bag, so no sync will take place.
        if (eventRecord.isCreating) {
            // Ensure that during the engine's async processing of the remove, the element is non-interactive.
            // Mousedown on the just-created element itself passes through here, and the immediate mouseup
            // after that instigates a click which will find no corresponding event.
            if (client.isTimelineBase) {
                me.editingContext.eventElement?.closest('[data-event-id]').classList.add('b-released');
            }

            eventStore.remove(eventRecord);

            // Clear isCreating *after* removal.
            // Store doesn't register as a removed record if isCreating is set
            eventRecord.isCreating = false;
        }

        // Revert any placeholder that we may have set
        // nameField may have been configured away.
        if (nameField) {
            nameField.placeholder = nameField._configuredPlaceholder;
        }

        me.targetEventElement = null;
        client.element.classList.remove('b-eventeditor-editing');
    }

    onPopupKeyDown({ event }) {
        const me = this;

        if (!me.readOnly && event.key === 'Enter' && me.saveAndCloseOnEnter && event.target.tagName.toLowerCase() === 'input') {
            // Need to prevent this key events from being fired on whatever receives focus after the editor is hidden
            event.preventDefault();

            // If enter key was hit in an input element of a start field, need to adjust end date fields (the same way as if #onDatesChange handler was called)
            if (event.target.name === 'startDate') {
                adjustEndDate(me.startDateField.value, me.startTimeField.value, me);
            }

            me.onSaveClick();
        }
    }

    async onSaveClick() {
        // TODO add new API on Container: blurFocusedField which manages this scenario
        // of blurring active field just before hiding
        this.editor.focus();

        const saved = await this.save();

        if (saved) {
            this.editor.close();

            /**
             * Fires on the owning Scheduler after editor is closed by any action - save, delete or cancel
             * @event afterEventEdit
             * @on-owner
             * @param {Scheduler.view.Scheduler} source The scheduler
             */
            this.client.trigger('afterEventEdit');
        }
        return saved;
    }

    async onDeleteClick() {
        const removed = await this.deleteEvent();

        if (removed) {
            const { editor } = this;
            // We expect deleteEvent will trigger close if autoClose is true and focus has moved out,
            // otherwise need to call it manually
            if (!editor.autoClose || editor.containsFocus) {
                editor.close();
            }
            this.client.trigger('afterEventEdit');
        }
    }

    onCancelClick() {
        this.editor.close();
        this.client.trigger('afterEventEdit');
    }

    //endregion
}
