import { Mixin } from "../../../ChronoGraph/class/Mixin.js";
import { AbstractPartOfProjectModelMixin } from './mixin/AbstractPartOfProjectModelMixin.js';
/**
 * This is a mixin enabling events to handle assignments. It is mixed by CoreHasAssignmentsMixin and
 * BaseHasAssignmentsMixin. It provides a collection of all assignments, which reference this event.
 *
 * Doesn't affect scheduling.
 */
export class AbstractHasAssignmentsMixin extends Mixin([AbstractPartOfProjectModelMixin], (base) => {
    const superProto = base.prototype;
    class HasAssignmentsMixin extends base {
        /**
         * If a given resource is assigned to this task, returns a [[BaseAssignmentMixin]] instance for it.
         * Otherwise returns `null`
         */
        getAssignmentFor(resource) {
            // Bucket `assigned` might not be set up yet when using delayed calculations
            for (const assignment of this.assigned ?? []) {
                if (assignment.resource === resource)
                    return assignment;
            }
            return null;
        }
        isAssignedTo(resource) {
            return Boolean(this.getAssignmentFor(resource));
        }
        /**
         * A method which assigns a resource to the current event
         */
        async assign(resource) {

            const assignmentCls = this.project.assignmentStore.modelClass;
            this.addAssignment(new assignmentCls({
                event: this,
                resource: resource
            }));
            return this.commitAsync();
        }
        /**
         * A method which unassigns a resource from the current event
         */
        async unassign(resource) {
            const assignment = this.getAssignmentFor(resource);

            this.removeAssignment(assignment);
            return this.commitAsync();
        }
        leaveProject() {
            // `this.assigned` will be empty if model is added to project and then removed immediately
            // w/o any propagations
            // @ts-ignore
            if (this.isInActiveTransaction && this.assigned) {
                const eventStore = this.getEventStore();
                // to batch the assignments removal, we don't remove the assignments right away, but instead
                // add them for the batched removal to the `assignmentsForRemoval` property of the event store
                this.assigned.forEach(assignment => eventStore.assignmentsForRemoval.add(assignment));
            }
            superProto.leaveProject.call(this, ...arguments);
        }
        remove() {
            if (this.parent) {
                // need to get the event store in advance, because after removal the project reference will be cleared (all that is what provide
                // references to all stores
                const eventStore = this.getEventStore();
                superProto.remove.call(this);
                eventStore && eventStore.afterEventRemoval();
            }
            else {
                return superProto.remove.call(this);
            }
        }
        // template methods, overridden in scheduling modes mixins
        // should probably be named something like "onEventAssignmentAdded"
        // should be a listener for the `add` event of the assignment store instead
        addAssignment(assignment) {
            this.getProject().assignmentStore.add(assignment);
            return assignment;
        }
        // should be a listener for the `remove` event of the assignment store instead
        removeAssignment(assignment) {
            this.getProject().assignmentStore.remove(assignment);
            return assignment;
        }
    }
    return HasAssignmentsMixin;
}) {
}
