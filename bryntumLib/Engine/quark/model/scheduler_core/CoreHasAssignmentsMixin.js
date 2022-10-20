import { Mixin } from "../../../../ChronoGraph/class/BetterMixin.js";
import { CoreEventMixin } from "./CoreEventMixin.js";
import ObjectHelper from "../../../../Core/helper/ObjectHelper.js";
import { AbstractHasAssignmentsMixin } from '../AbstractHasAssignmentsMixin.js';
/**
 * This is a mixin, which can be applied to the [[CoreEventMixin]]. It provides the collection of all assignments,
 * which reference this event.
 *
 * Doesn't affect scheduling.
 */
export class CoreHasAssignmentsMixin extends Mixin([CoreEventMixin, AbstractHasAssignmentsMixin], (base) => {
    const superProto = base.prototype;
    class CoreHasAssignmentsMixin extends base {
        get assigned() {
            return this.project?.assignmentStore.getEventsAssignments(this) ?? this.$cachedAssignments;
        }
        leaveProject(isReplacing = false) {
            // Expected to still be able to return assignments when removed from project
            this.$cachedAssignments = this.assigned;
            super.leaveProject(isReplacing);
        }
        applyValue(useProp, key, value, skipAccessor, field) {
            // Changing id on an event should update resourceId on its assignments
            if (key === 'id') {
                this.assigned?.forEach(assignment => assignment.set('eventId', value));
            }
            superProto.applyValue.call(this, useProp, key, value, skipAccessor, field);
        }
        copy(newId = null, deep = null) {
            const copy = superProto.copy.call(this, newId, deep);
            // If deep is everything but object - use default behavior, which is to invoke accessors
            // If deep is an object, check if it has certain field disabled
            if ((ObjectHelper.isObject(deep) && !deep.skipFieldIdentifiers) || !ObjectHelper.isObject(deep)) {
                // Copy current assignments, used for occurrences
                copy.$cachedAssignments = this.assigned;
            }
            return copy;
        }
    }
    return CoreHasAssignmentsMixin;
}) {
}
