import { CoreAssignmentMixin } from "../model/scheduler_core/CoreAssignmentMixin.js";
import { Mixin } from "../../../ChronoGraph/class/BetterMixin.js";
import { CorePartOfProjectStoreMixin } from "./mixin/CorePartOfProjectStoreMixin.js";
import { AbstractAssignmentStoreMixin } from "./AbstractAssignmentStoreMixin.js";
const emptySet = new Set();
/**
 * A store mixin class, that represent collection of all assignments in the [[SchedulerCoreProjectMixin|project]].
 */
export class CoreAssignmentStoreMixin extends Mixin([AbstractAssignmentStoreMixin, CorePartOfProjectStoreMixin], (base) => {
    const superProto = base.prototype;
    class CoreAssignmentStoreMixin extends base {
        constructor() {
            super(...arguments);
            this.skipInvalidateIndices = false;
        }
        static get defaultConfig() {
            return {
                modelClass: CoreAssignmentMixin,
                storage: {
                    extraKeys: [
                        { property: 'event', unique: false },
                        { property: 'resource', unique: false },
                        { property: 'eventId', unique: false }
                    ]
                }
            };
        }
        set data(value) {
            this.allAssignmentsForRemoval = true;
            super.data = value;
            this.allAssignmentsForRemoval = false;
        }
        getEventsAssignments(event) {
            return this.storage.findItem('event', event) || emptySet;
        }
        getResourcesAssignments(resource) {
            return this.storage.findItem('resource', resource) || emptySet;
        }
        updateIndices() {
            this.storage.rebuildIndices();
        }
        invalidateIndices() {
            this.storage.invalidateIndices();
        }
        // Link events/resources to assignments, called when those stores are populated or joined to project
        linkAssignments(store, modelName) {
            const unresolved = this.count && this.storage.findItem(modelName, null);
            if (unresolved) {
                for (const assignment of unresolved) {
                    const record = store.getById(assignment.getCurrentOrProposed(modelName));
                    if (record)
                        assignment.setChanged(modelName, record);
                }
                this.invalidateIndices();
            }
        }
        // Unlink events/resources from assignments, called when those stores are cleared
        unlinkAssignments(modelName) {
            // Invalidate links to events/resources, need to link to new records so set it back to the id (might be resource or resourceId)
            // As assignment.resource returns null if it's an id, need to check for that in data
            this.forEach(assignment => assignment.setChanged(modelName, assignment[modelName]?.id ?? assignment?.getData(modelName) ?? assignment[modelName + 'Id']));
            this.invalidateIndices();
        }
        onCommitAsync() {
            this.updateIndices();
        }
    }
    return CoreAssignmentStoreMixin;
}) {
}
