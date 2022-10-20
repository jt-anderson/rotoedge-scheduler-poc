import { Mixin } from "../../../../ChronoGraph/class/BetterMixin.js";
import { CorePartOfProjectModelMixin } from "../mixin/CorePartOfProjectModelMixin.js";
/**
 * Core resource model class.
 */
export class CoreResourceMixin extends Mixin([CorePartOfProjectModelMixin], (base) => {
    const superProto = base.prototype;
    class CoreResourceMixin extends base {
        get assigned() {
            return this.project?.assignmentStore.getResourcesAssignments(this);
        }
        joinProject() {
            // Set up assignment -> resource mapping when joining store after assignment (skip during load)
            // (note that there is no resourceStore yet when loading inline data, thus the first part of the condition)
            if (this.resourceStore && !this.resourceStore.isLoadingData) {
                this.assignmentStore?.query(a => a.get('resource') === this.id).forEach(unresolved => unresolved.setChanged('resource', this));
            }
            superProto.joinProject.call(this);
        }
        leaveProject(isReplacing = false) {
            // `this.assigned` will be empty if model is added to project and then removed immediately
            // w/o any propagations
            // when replacing a resource, the assignments should be left intact
            if (this.assigned && !isReplacing) {
                const resourceStore = this.resourceStore;
                // to batch the assignments removal, we don't remove the assignments right away, but instead
                // add them for the batched removal to the `assignmentsForRemoval` property of the event store
                this.assigned.forEach(assignment => resourceStore.assignmentsForRemoval.add(assignment));
            }
            superProto.leaveProject.call(this);
        }
        applyValue(useProp, key, value, skipAccessor, field) {
            // Changing id on a resource should update resourceId on its assignments
            // (note that field might not exist, if user supplies data for undefined fields)
            if (field?.name === 'id') {
                this.assigned.forEach(assignment => {
                    assignment.set('resourceId', value);
                });
            }
            superProto.applyValue.call(this, useProp, key, value, skipAccessor, field);
        }
    }
    return CoreResourceMixin;
}) {
}
