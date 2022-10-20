import { Mixin } from "../../../ChronoGraph/class/Mixin.js";
import { AbstractPartOfProjectStoreMixin } from "./mixin/AbstractPartOfProjectStoreMixin.js";
const dataAddRemoveActions = {
    splice: 1,
    clear: 1
};
// Shared functionality for CoreEventStore & ChronoEventStore
export class AbstractEventStoreMixin extends Mixin([AbstractPartOfProjectStoreMixin], (base) => {
    const superProto = base.prototype;
    class AbstractEventStoreMixin extends base {
        constructor() {
            super(...arguments);
            this.assignmentsForRemoval = new Set();
            this.dependenciesForRemoval = new Set();
        }
        // we need `onDataChange` for `syncDataOnLoad` option to work
        onDataChange(event) {
            // remove from a filter action must be ignored.
            const isAddRemove = dataAddRemoveActions[event.action];
            super.onDataChange(event);
            if (isAddRemove && event.removed?.length)
                this.afterEventRemoval();
        }
        // it seems `onDataChange` is not triggered for `remove` with `silent` flag
        remove(records, silent) {
            const res = superProto.remove.call(this, records, silent);
            this.afterEventRemoval();
            return res;
        }
        // it seems `onDataChange` is not triggered for `TreeStore#removeAll()`
        removeAll(silent) {
            const res = superProto.removeAll.call(this, silent);
            this.afterEventRemoval();
            return res;
        }
        afterEventRemoval() {
            const { assignmentsForRemoval, dependenciesForRemoval } = this;
            // Can be called from `set data` during construction
            if (!assignmentsForRemoval)
                return;
            // ORDER IS IMPORTANT!
            // First remove assignments
            const assignmentStore = this.getAssignmentStore();
            if (assignmentStore && !assignmentStore.allAssignmentsForRemoval && assignmentsForRemoval.size) {
                const toRemove = [...assignmentsForRemoval].filter(assignment => !assignmentStore.assignmentsForRemoval.has(assignment));
                toRemove.length > 0 && assignmentStore.remove(toRemove);
            }
            assignmentsForRemoval.clear();
            // Then remove dependencies
            const dependencyStore = this.getDependencyStore();
            if (dependencyStore && !dependencyStore.allDependenciesForRemoval && dependenciesForRemoval.size) {
                const toRemove = [...dependenciesForRemoval].filter(dependency => !dependencyStore.dependenciesForRemoval.has(dependency));
                toRemove.length > 0 && dependencyStore.remove(toRemove);
            }
            dependenciesForRemoval.clear();
        }
        processRecord(eventRecord, isDataset = false) {
            if (!this.project?.isRepopulatingStores) {
                const existingRecord = this.getById(eventRecord.id);
                const isReplacing = existingRecord && existingRecord !== eventRecord;
                if (isReplacing) {
                    // TODO: Type
                    //@ts-ignore
                    for (const assignment of existingRecord.assigned) {
                        assignment.event = eventRecord;
                    }
                }
            }
            return eventRecord;
        }
    }
    return AbstractEventStoreMixin;
}) {
}
