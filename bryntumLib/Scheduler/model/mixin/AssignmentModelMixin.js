/**
 * @module Scheduler/model/mixin/AssignmentModelMixin
 */

/**
 * Mixin that holds configuration shared between assignments in Scheduler and Scheduler Pro.
 * @mixin
 */
export default Target => class AssignmentModelMixin extends Target {
    static get $name() {
        return 'AssignmentModelMixin';
    }

    /**
     * Set value for the specified field(s), triggering engine calculations immediately. See
     * {@link Core.data.Model#function-set Model#set()} for arguments.
     *
     * ```javascript
     * assignment.set('resourceId', 2);
     * // assignment.resource is not yet resolved
     *
     * await assignment.setAsync('resourceId', 2);
     * // assignment.resource is resolved
     * ```
     *
     * @param {String|Object} field The field to set value for, or an object with multiple values to set in one call
     * @param {*} value Value to set
     * @param {Boolean} [silent=false] Set to true to not trigger events
     * automatically.
     * @function setAsync
     * @category Editing
     * @async
     */

    //region Fields

    static get fields() {
        return [
            /**
             * Id for the resource to assign to
             * @field {String|Number} resourceId
             * @category Common
             */
            'resourceId',

            /**
             * Id for the event to assign
             * @field {String|Number} eventId
             * @category Common
             */
            'eventId',

            /**
             * Specify `false` to opt out of drawing dependencies from/to this assignment
             * @field {Boolean} drawDependencies
             * @category Common
             */
            { name : 'drawDependencies', type : 'boolean' },

            'event',

            'resource'
        ];
    }

    //endregion

    construct(data, ...args) {
        data = data || {};

        const
            eventId    = data[this.fieldMap.eventId.dataSource],
            resourceId = data[this.fieldMap.resourceId.dataSource];

        // Engine expects event and resource, not eventId and resourceId. We need to support both
        if (eventId != null) {
            data.event = eventId;
        }

        if (resourceId != null) {
            data.resource = resourceId;
        }

        super.construct(data, ...args);
    }

    //region Event & resource

    /**
     * A key made up from the event id and the id of the resource assigned to.
     * @property eventResourceKey
     * @readonly
     * @internal
     */
    get eventResourceKey() {
        return this.buildEventResourceKey(this.event, this.resource);
    }

    buildEventResourceKey(event, resource) {
        let eventKey, resourceKey;

        if (event) {
            eventKey = event.isModel ? event.id : event;
        }
        else {
            eventKey = this.internalId;
        }

        if (resource) {
            resourceKey = resource.isModel ? resource.id : resource;
        }
        else {
            resourceKey = this.internalId;
        }
        return `${eventKey}-${resourceKey}`;
    }

    buildIndexKey({ event, resource }) {
        return this.buildEventResourceKey(event, resource);
    }

    set(field, value, ...args) {
        const toSet = this.fieldToKeys(field, value);

        // If resource was set, store its id as resourceId and announce it
        if ('resource' in toSet) {
            if (toSet.resource?.id) {
                toSet.resourceId = toSet.resource.id;
            }
        }
        // If resourceId was set, we need to replace resource to have it re-referenced in engine
        else if ('resourceId' in toSet && this.constructor.isProAssignmentModel) {
            toSet.resource = toSet.resourceId;
        }

        // Same for event
        if ('event' in toSet) {
            if (toSet.event?.id) {
                toSet.eventId = toSet.event.id;
            }
        }
        else if ('eventId' in toSet && this.constructor.isProAssignmentModel) {
            toSet.event = toSet.eventId;
        }

        return super.set(toSet, null, ...args);
    }

    afterChange(toSet, wasSet, silent, fromRelationUpdate, skipAccessors) {
        // Make sure Core Engine implementation notices "resourceId" change
        // and updates "resource" field value respectively
        if (!this.constructor.isProAssignmentModel && wasSet?.resourceId &&
            this.resource?.id !== wasSet.resourceId.value) {
            this.resource = wasSet.resourceId.value;
        }

        return super.afterChange(...arguments);
    }

    // Settings resourceId relays to `resource`. Underlying data will be updated in `afterChange()` above
    set resourceId(value) {
        const { resource } = this;

        // When assigning a new id to a resource, it will update the resourceId of the assignment. But the assignments
        // resource is still the same so we need to announce here
        if (resource?.isModel && resource.id === value) {
            this.set('resourceId', value);
        }
        else {
            this.resource = value;
        }
    }

    get resourceId() {
        // If assigned using `resource` and not `resourceId` there will be no resourceId
        return this.get('resourceId') || this.resource?.id;
    }

    // Same for event as for resourceId
    set eventId(value) {
        const { event } = this;

        // When assigning a new id to an event, it will update the eventId of the assignment. But the assignments
        // event is still the same so we need to announce here
        if (event?.isModel && event.id === value) {
            this.set('eventId', value);
        }
        else {
            this.event = value;
        }
    }

    get eventId() {
        // If assigned using `event` and not `eventId` there will be no eventId
        return this.get('eventId') || this.event?.id;
    }

    /**
     * Convenience property to get the name of the associated event.
     * @property {String}
     * @readonly
     */
    get eventName() {
        return this.event?.name;
    }

    /**
     * Convenience property to get the name of the associated resource.
     * @property {String}
     * @readonly
     */
    get resourceName() {
        return this.resource?.name;
    }

    // TODO : Deprecate in favor of `get resource`
    /**
     * Returns the resource associated with this assignment.
     *
     * @returns {Scheduler.model.ResourceModel} Instance of resource
     */
    getResource() {
        return this.resource;
    }

    //endregion

    // Convenience getter to not have to check `instanceof AssignmentModel`
    get isAssignment() {
        return true;
    }

    /**
     * Returns true if the Assignment can be persisted (e.g. task and resource are not 'phantoms')
     *
     * @property {Boolean}
     */
    get isPersistable() {
        const
            {
                event,
                resource,
                unjoinedStores,
                assignmentStore
            }           = this,
            crudManager = assignmentStore?.crudManager;

        let result;

        if (assignmentStore) {
            // If the owning event is not persistable, this assignment is also not persistable.
            // if crud manager is used it can deal with phantom event/resource since it persists all records in one batch
            // if no crud manager used we have to wait till event/resource are persisted
            result = this.isValid && event.isPersistable && (crudManager || !event.hasGeneratedId && !resource.hasGeneratedId);
        }
        // if we remove the record
        else {
            result = !this.isPhantom && Boolean(unjoinedStores[0]);
        }

        // Records not yet fully created cannot be persisted
        return result && super.isPersistable && !this.event?.isCreating;
    }

    get isValid() {
        return this.resource != null && this.event != null;
    }

    /**
     * Returns a textual representation of this assignment (e.g. Mike 50%).
     * @returns {String}
     */
    toString() {
        if (this.resourceName) {
            return `${this.resourceName} ${Math.round(this.units)}%`;
        }

        return '';
    }

    //region STM hooks

    shouldRecordFieldChange(fieldName, oldValue, newValue) {
        if (!super.shouldRecordFieldChange(fieldName, oldValue, newValue)) {
            return false;
        }

        if (fieldName === 'event' || fieldName === 'eventId') {
            const eventStore = this.project?.eventStore;

            if (eventStore && eventStore.oldIdMap[oldValue] === eventStore.getById(newValue)) {
                return false;
            }
        }

        if (fieldName === 'resource' || fieldName === 'resourceId') {
            const resourceStore = this.project?.resourceStore;

            if (resourceStore && resourceStore.oldIdMap[oldValue] === resourceStore.getById(newValue)) {
                return false;
            }
        }

        return true;
    }

    //endregion
};
