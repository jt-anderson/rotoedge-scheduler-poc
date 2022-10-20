import Base from '../../../Core/Base.js';
import Collection from '../../../Core/util/Collection.js';
import ArrayHelper from '../../../Core/helper/ArrayHelper.js';

/**
 * @module Scheduler/view/mixin/EventSelection
 */

/**
 * Mixin that tracks event or assignment selection by clicking on one or more events in the scheduler.
 * @mixin
 */
export default Target => class EventSelection extends (Target || Base) {
    static get $name() {
        return 'EventSelection';
    }

    //region Default config

    static get configurable() {
        return {
            /**
             * Configure as `true`, or set property to `true` to highlight dependent events as well when selecting an event.
             * @config {Boolean}
             * @default
             * @category Selection
             */
            highlightPredecessors : false,

            /**
             * Configure as `true`, or set property to `true` to highlight dependent events as well when selecting an event.
             * @config {Boolean}
             * @default
             * @category Selection
             */
            highlightSuccessors : false,

            /**
             * Configure as `true` to deselect a selected event upon click.
             * @config {Boolean}
             * @default
             * @category Selection
             */
            deselectOnClick : false
        };
    }

    static get defaultConfig() {
        return {
            /**
             * Configure as `true` to allow `CTRL+click` to select multiple events in the scheduler.
             * @config {Boolean}
             * @category Selection
             */
            multiEventSelect : false,

            /**
             * Configure as `true`, or set property to `true` to disable event selection.
             * @config {Boolean}
             * @default
             * @category Selection
             */
            eventSelectionDisabled : false,

            /**
             * CSS class to add to selected events.
             * @config {String}
             * @default
             * @category CSS
             * @private
             */
            eventSelectedCls : 'b-sch-event-selected',

            /**
             * Configure as `true` to trigger `selectionChange` when removing a selected event/assignment.
             * @config {Boolean}
             * @default
             * @category Selection
             */
            triggerSelectionChangeOnRemove : false,

            /**
             * This flag controls whether Scheduler should preserve its selection of events when loading a new dataset
             * (if selected event ids are included in the newly loaded dataset).
             * @config {Boolean}
             * @default
             * @category Selection
             */
            maintainSelectionOnDatasetChange : true,

            /**
             * CSS class to add to other instances of a selected event, to highlight them.
             * @config {String}
             * @default
             * @category CSS
             * @private
             */
            eventAssignHighlightCls : 'b-sch-event-assign-selected',

            /**
             * Collection to store selection.
             * @config {Core.util.Collection}
             * @private
             */
            selectedCollection : {}
        };
    }

    //endregion

    //region Events

    /**
     * Fired any time there is a change to the events selected in the Scheduler.
     * @event eventSelectionChange
     * @param {'select'|'deselect'|'update'|'clear'} action One of the actions 'select', 'deselect', 'update',
     * 'clear'
     * @param {Scheduler.model.EventModel[]} selected An array of the Events added to the selection.
     * @param {Scheduler.model.EventModel[]} deselected An array of the Event removed from the selection.
     * @param {Scheduler.model.EventModel[]} selection The new selection.
     */

    /**
     * Fired any time there is going to be a change to the events selected in the Scheduler.
     * Returning `false` prevents the change
     * @event beforeEventSelectionChange
     * @preventable
     * @param {String} action One of the actions 'select', 'deselect', 'update', 'clear'
     * @param {Scheduler.model.EventModel[]} selected An array of events that will be added to the selection.
     * @param {Scheduler.model.EventModel[]} deselected An array of events that will be removed from the selection.
     * @param {Scheduler.model.EventModel[]} selection The currently selected events, before applying `selected` and `deselected`.
     */

    /**
     * Fired any time there is a change to the assignments selected in the Scheduler.
     * @event assignmentSelectionChange
     * @param {'select'|'deselect'|'update'|'clear'} action One of the actions 'select', 'deselect', 'update',
     * 'clear'
     * @param {Scheduler.model.AssignmentModel[]} selected An array of the Assignments added to the selection.
     * @param {Scheduler.model.AssignmentModel[]} deselected An array of the Assignments removed from the selection.
     * @param {Scheduler.model.AssignmentModel[]} selection The new selection.
     */

    /**
     * Fired any time there is going to be a change to the assignments selected in the Scheduler.
     * Returning `false` prevents the change
     * @event beforeAssignmentSelectionChange
     * @preventable
     * @param {String} action One of the actions 'select', 'deselect', 'update', 'clear'
     * @param {Scheduler.model.EventModel[]} selected An array of assignments that will be added to the selection.
     * @param {Scheduler.model.EventModel[]} deselected An array of assignments that will be removed from the selection.
     * @param {Scheduler.model.EventModel[]} selection The currently selected assignments, before applying `selected` and `deselected`.
     */

    //endregion

    //region Init

    afterConstruct() {
        super.afterConstruct();

        this.navigator?.on({
            navigate : 'onEventNavigate',
            thisObj  : this
        });
    }

    //endregion

    //region Selected Collection

    set selectedCollection(selectedCollection) {
        if (!(selectedCollection instanceof Collection)) {
            selectedCollection = new Collection(selectedCollection);
        }
        this._selectedCollection = selectedCollection;

        // const selected = ;
        // Fire row change events from onSelectedCollectionChange
        selectedCollection.on({
            change       : 'onSelectedCollectionChange',
            beforeSplice : 'onBeforeSelectedCollectionSplice',
            thisObj      : this
        });
    }

    get selectedCollection() {
        return this._selectedCollection;
    }

    getActionType(selection, selected, deselected) {
        return (selection.length > 0)
            ? ((selected.length > 0 && deselected.length > 0)
                ? 'update'
                : (selected.length > 0
                    ? 'select'
                    : 'deselect'))
            : 'clear';
    }

    //endregion

    //region Modify selection

    getEventsFromAssignments(assignments) {
        return ArrayHelper.unique(assignments.map(assignment => assignment.event));
    }

    /**
     * The {@link Scheduler.model.EventModel events} which are selected.
     * @property {Scheduler.model.EventModel[]}
     * @category Selection
     */
    get selectedEvents() {
        return this.getEventsFromAssignments(this.selectedCollection.values);
    }

    set selectedEvents(events) {
        // Select all assignments
        const assignments = [];

        events = ArrayHelper.asArray(events);

        events?.forEach(event => {
            if (this.isEventSelectable(event) !== false) {
                assignments.push(...event.assignments);
            }
        });

        // Replace the entire selected collection with the new record set
        this.selectedCollection.splice(0, this.selectedCollection.count, assignments);
    }

    /**
     * The {@link Scheduler.model.AssignmentModel events} which are selected.
     * @property {Scheduler.model.AssignmentModel[]}
     * @category Selection
     */
    get selectedAssignments() {
        return this.selectedCollection.values;
    }

    set selectedAssignments(assignments) {
        // Replace the entire selected collection with the new record set
        this.selectedCollection.splice(0, this.selectedCollection.count, assignments || []);
    }

    /**
     * Returns `true` if the {@link Scheduler.model.EventModel event} is selected.
     * @param {Scheduler.model.EventModel} event The event
     * @returns {Boolean} Returns `true` if the event is selected
     * @category Selection
     */
    isEventSelected(event) {
        const { selectedCollection } = this;

        return Boolean(selectedCollection.count && selectedCollection.includes(event.assignments));
    }

    /**
     * A template method (empty by default) allowing you to control if an event can be selected or not.
     *
     * ```javascript
     * new Scheduler({
     *     isEventSelectable(event) {
     *         return event.startDate >= Date.now();
     *     }
     * })
     * ```
     *
     * @param {Scheduler.model.EventModel} event The event record
     * @returns {Boolean} true if event can be selected, otherwise false
     * @category Selection
     */
    isEventSelectable(event) {}

    /**
     * Returns `true` if the {@link Scheduler.model.AssignmentModel assignment} is selected.
     * @param {Scheduler.model.AssignmentModel} assignment The assignment
     * @returns {Boolean} Returns `true` if the assignment is selected
     * @category Selection
     */
    isAssignmentSelected(assignment) {
        return this.selectedCollection.includes(assignment);
    }

    /**
     * Selects the passed {@link Scheduler.model.EventModel event} or {@link Scheduler.model.AssignmentModel assignment}
     * *if it is not selected*. Selecting events results in all their assignments being selected.
     * @param {Scheduler.model.EventModel|Scheduler.model.AssignmentModel} eventOrAssignment The event or assignment to select
     * @param {Boolean} [preserveSelection] Pass `true` to preserve any other selected events or assignments
     * @category Selection
     */
    select(eventOrAssignment, preserveSelection = false) {
        if (eventOrAssignment.isAssignment) {
            this.selectAssignment(eventOrAssignment, preserveSelection);
        }
        else {
            this.selectEvent(eventOrAssignment, preserveSelection);
        }
    }

    /**
     * Selects the passed {@link Scheduler.model.EventModel event} *if it is not selected*. Selecting an event will
     * select all its assignments.
     * @param {Scheduler.model.EventModel} event The event select
     * @param {Boolean} [preserveSelection] Pass `true` to preserve any other selected events
     * @category Selection
     */
    selectEvent(event, preserveSelection = false) {
        // If the event is already selected, this is a no-op.
        // In this case, selection must not be cleared even in the absence of preserveSelection
        if (!this.isEventSelected(event)) {
            this.selectEvents([event], preserveSelection);
        }
    }

    /**
     * Selects the passed {@link Scheduler.model.AssignmentModel assignment} *if it is not selected*.
     * @param {Scheduler.model.AssignmentModel} assignment The assignment to select
     * @param {Boolean} [preserveSelection] Pass `true` to preserve any other selected assignments
     * @param {Event} [event] If this method was invoked as a result of a user action, this is the DOM event that triggered it
     * @category Selection
     */
    selectAssignment(assignment, preserveSelection = false, event) {
        // If the event is already selected, this is a no-op.
        // In this case, selection must not be cleared even in the absence of preserveSelection
        if (!this.isAssignmentSelected(assignment)) {
            preserveSelection ? this.selectedCollection.add(assignment) : this.selectedAssignments = assignment;
        }
    }

    /**
     * Deselects the passed {@link Scheduler.model.EventModel event} or {@link Scheduler.model.AssignmentModel assignment}
     * *if it is selected*.
     * @param {Scheduler.model.EventModel|Scheduler.model.AssignmentModel} eventOrAssignment The event or assignment to deselect.
     * @category Selection
     */
    deselect(eventOrAssignment) {
        if (eventOrAssignment.isAssignment) {
            this.deselectAssignment(eventOrAssignment);
        }
        else {
            this.deselectEvent(eventOrAssignment);
        }
    }

    /**
     * Deselects the passed {@link Scheduler.model.EventModel event} *if it is selected*.
     * @param {Scheduler.model.EventModel} event The event to deselect.
     * @category Selection
     */
    deselectEvent(event) {
        if (this.isEventSelected(event)) {
            this.selectedCollection.remove(...event.assignments);
        }
    }

    /**
     * Deselects the passed {@link Scheduler.model.AssignmentModel assignment} *if it is selected*.
     * @param {Scheduler.model.AssignmentModel} assignment The assignment to deselect
     * @param {Event} [event] If this method was invoked as a result of a user action, this is the DOM event that triggered it
     * @category Selection
     */
    deselectAssignment(assignment) {
        if (this.isAssignmentSelected(assignment)) {
            this.selectedCollection.remove(assignment);
        }
    }

    /**
     * Adds {@link Scheduler.model.EventModel events} to the selection.
     * @param {Scheduler.model.EventModel[]} events Events to be selected
     * @param {Boolean} [preserveSelection] Pass `true` to preserve any other selected events
     * @category Selection
     */
    selectEvents(events, preserveSelection = false) {
        if (preserveSelection) {
            const assignments = (events.reduce((assignments, event) => {
                if (this.isEventSelectable(event) !== false) {
                    assignments.push(...event.assignments);
                }
                return assignments;
            }, []));

            this.selectedCollection.add(assignments);
        }
        else {
            this.selectedEvents = events;
        }
    }

    /**
     * Removes {@link Scheduler.model.EventModel events} from the selection.
     * @param {Scheduler.model.EventModel[]} events Events or assignments  to be deselected
     * @category Selection
     */
    deselectEvents(events) {
        this.selectedCollection.remove(events.reduce((assignments, event) => {
            assignments.push(...event.assignments);
            return assignments;
        }, []));
    }

    /**
     * Adds {@link Scheduler.model.AssignmentModel assignments} to the selection.
     * @param {Scheduler.model.AssignmentModel[]} assignments Assignments to be selected
     * @category Selection
     */
    selectAssignments(assignments) {
        this.selectedCollection.add(assignments);
    }

    /**
     * Removes {@link Scheduler.model.AssignmentModel assignments} from the selection.
     * @param {Scheduler.model.AssignmentModel[]} assignments Assignments  to be deselected
     * @category Selection
     */
    deselectAssignments(assignments) {
        this.selectedCollection.remove(assignments);
    }

    /**
     * Deselects all {@link Scheduler.model.EventModel events} and {@link Scheduler.model.AssignmentModel assignments}.
     * @category Selection
     */
    clearEventSelection() {
        this.selectedAssignments = [];
    }

    //endregion

    //region Events

    /**
     * Responds to mutations of the underlying selection Collection.
     * Keeps the UI synced, eventSelectionChange and assignmentSelectionChange event is fired when `me.silent` is falsy.
     * @private
     */

    onBeforeSelectedCollectionSplice({ toAdd, toRemove, index }) {
        const
            me = this,
            selection = me._selectedCollection.values,
            selected = toAdd,
            deselected = toRemove > 0 ? selected.slice(index, toRemove + index) : [],
            action = me.getActionType(selection, selected, deselected);

        if (me.trigger('beforeEventSelectionChange', {
            action,
            selection  : me.getEventsFromAssignments(selection) || [],
            selected   : me.getEventsFromAssignments(selected) || [],
            deselected : me.getEventsFromAssignments(deselected) || []
        }) === false) {
            return false;
        }

        if (me.trigger('beforeAssignmentSelectionChange', {
            action,
            selection,
            selected,
            deselected
        }) === false) {
            return false;
        }
    }

    onSelectedCollectionChange({ added, removed }) {
        const
            me         = this,
            selection  = me.selectedAssignments,
            selected   = added || [],
            deselected = removed || [];

        function updateSelection(assignmentRecord, select) {
            const eventRecord    = assignmentRecord.event;

            if (eventRecord) {
                const
                    { eventAssignHighlightCls } = me,
                    element                     = me.getElementFromAssignmentRecord(assignmentRecord);

                me.currentOrientation.toggleCls(assignmentRecord, me.eventSelectedCls, select);

                eventAssignHighlightCls && me.getElementsFromEventRecord(eventRecord).forEach(el => {
                    if (el !== element) {
                        const otherAssignmentRecord = me.resolveAssignmentRecord(el);

                        me.currentOrientation.toggleCls(otherAssignmentRecord, eventAssignHighlightCls, select);

                        if (select) {
                            // Need to force a reflow to get the highlightning animation triggered
                            el.style.animation = 'none';
                            el.offsetHeight;
                            el.style.animation = '';
                        }
                        el.classList.toggle(eventAssignHighlightCls, select);
                    }
                });
            }
        }

        deselected.forEach(record => updateSelection(record, false));
        selected.forEach(record => updateSelection(record, true));

        if (me.highlightSuccessors || me.highlightPredecessors) {
            me.highlightLinkedEvents(me.selectedEvents);
        }

        // To be able to restore selection after reloading resources (which might lead to regenerated assignments in
        // the single assignment scenario, so cannot rely on records or ids)
        me.$selectedAssignments = selection.map(assignment => ({
            eventId    : assignment.eventId,
            resourceId : assignment.resourceId
        }));

        if (!me.silent) {
            const action = this.getActionType(selection, selected, deselected);

            me.trigger('assignmentSelectionChange', {
                action,
                selection,
                selected,
                deselected
            });

            me.trigger('eventSelectionChange', {
                action,
                selection  : me.selectedEvents,
                selected   : me.getEventsFromAssignments(selected),
                deselected : me.getEventsFromAssignments(deselected)
            });
        }
    }

    /**
     * Assignment change listener to remove events from selection which are no longer in the assignments.
     * @private
     */
    onAssignmentChange({ action, records : assignments }) {
        const me = this;

        me.silent = !me.triggerSelectionChangeOnRemove;

        if (action === 'remove') {
            me.deselectAssignments(assignments);
        }
        else if (action === 'removeall' && !me.eventStore.isSettingData) {
            me.clearEventSelection();
        }
        else if (action === 'dataset' && me.$selectedAssignments) {
            if (!me.maintainSelectionOnDatasetChange) {
                me.clearEventSelection();
            }
            else {
                const newAssignments = me.$selectedAssignments.map(selector =>
                    assignments.find(a =>
                        a.eventId === selector.eventId &&
                        a.resourceId === selector.resourceId
                    )
                );

                me.selectedAssignments = ArrayHelper.clean(newAssignments);
            }
        }

        me.silent = false;
    }

    onInternalEventStoreChange({ source, action, records }) {
        // Setting empty event dataset cannot be handled in onAssignmentChange above, no assignments might be affected
        if (!source.isResourceTimeRangeStore && action === 'dataset' && !records.length) {
            this.clearEventSelection();
        }

        super.onInternalEventStoreChange(...arguments);
    }

    /**
     * Mouse listener to update selection.
     * @private
     */
    onAssignmentSelectionClick(event, clickedRecord) {
        const me = this;

        // Multi selection: CTRL means preserve selection, just add or remove the event.
        // Single selection: CTRL deselects already selected event
        if (me.isAssignmentSelected(clickedRecord)) {
            if (me.deselectOnClick || event.ctrlKey) {
                me.deselectAssignment(clickedRecord, me.multiEventSelect, event);
            }
        }
        else if (this.isEventSelectable(clickedRecord.event) !== false) {
            me.selectAssignment(clickedRecord, event.ctrlKey && me.multiEventSelect, event);
        }
    }

    /**
     * Navigation listener to update selection.
     * @private
     */
    onEventNavigate({ event, item }) {
        if (!this.eventSelectionDisabled) {
            const assignment = item && (item.nodeType === Element.ELEMENT_NODE ? this.resolveAssignmentRecord(item) : item);

            if (assignment) {
                this.onAssignmentSelectionClick(event, assignment);
            }
            // Click outside of an event/assignment;
            else {
                this.clearEventSelection();
            }
        }
    }

    changeHighlightSuccessors(value) {
        return this.changeLinkedEvents(value);
    }

    changeHighlightPredecessors(value) {
        return this.changeLinkedEvents(value);
    }

    changeLinkedEvents(value) {
        const me = this;

        if (value) {
            me.highlighted = me.highlighted || new Set();

            me.highlightLinkedEvents(me.selectedEvents);
        }
        else if (me.highlighted) {
            me.highlightLinkedEvents();
        }

        return value;
    }

    // Function that highlights/unhighlights events in a dependency chain
    highlightLinkedEvents(eventRecords = []) {
        const
            me                  = this,
            {
                highlighted,
                eventStore
            }                   = me,
            dependenciesFeature = me.features.dependencies;

        // Unhighlight previously highlighted records
        highlighted.forEach(eventRecord => {
            if (!eventRecords.includes(eventRecord)) {
                eventRecord.meta.highlight = false;
                highlighted.delete(eventRecord);

                if (eventStore.includes(eventRecord)) {
                    eventRecord.dependencies.forEach(dep => dependenciesFeature.unhighlight(dep, 'b-highlight'));
                }
            }
        });

        eventRecords.forEach(eventRecord => {
            const toWalk = [eventRecord];

            // Collect all events along the dependency chain
            while (toWalk.length) {
                const record = toWalk.pop();

                highlighted.add(record);

                if (me.highlightSuccessors) {
                    record.outgoingDeps.forEach(outgoing => {
                        dependenciesFeature.highlight(outgoing, 'b-highlight');
                        !highlighted.has(outgoing.toEvent) && toWalk.push(outgoing.toEvent);
                    });
                }
                if (me.highlightPredecessors) {
                    record.incomingDeps.forEach(incoming => {
                        dependenciesFeature.highlight(incoming, 'b-highlight');
                        !highlighted.has(incoming.fromEvent) && toWalk.push(incoming.fromEvent);
                    });
                }
            }

            // Highlight them
            highlighted.forEach(record => record.meta.highlight = true);
        });

        // Toggle flag on schedulers element, to fade others in or out
        me.element.classList.toggle('b-highlighting', eventRecords.length > 0);

        me.refreshWithTransition();
    }

    onEventDataGenerated(renderData) {
        if (this.highlightSuccessors || this.highlightPredecessors) {
            renderData.cls['b-highlight'] = renderData.eventRecord.meta.highlight;
        }
        super.onEventDataGenerated(renderData);
    }

    updateProject(project, old) {
        // Clear selection when the whole world shifts :)
        this.clearEventSelection();

        super.updateProject(project, old);
    }

    //endregion

    doDestroy() {
        this._selectedCollection?.destroy();

        super.doDestroy();
    }

    //region Getters/Setters

    // This does not need a className on Widgets.
    // Each *Class* which doesn't need 'b-' + constructor.name.toLowerCase() automatically adding
    // to the Widget it's mixed in to should implement thus.
    get widgetClass() {}

    //endregion
};
