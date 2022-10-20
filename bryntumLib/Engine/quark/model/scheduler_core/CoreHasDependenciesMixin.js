import { Mixin } from "../../../../ChronoGraph/class/BetterMixin.js";
import { CoreEventMixin } from "./CoreEventMixin.js";
/**
 * This is a mixin, which can be applied to the [[CoreEventMixin]]. It provides the collection of all dependencies,
 * which reference this event.
 *
 * Doesn't affect scheduling.
 */
export class CoreHasDependenciesMixin extends Mixin([CoreEventMixin], (base) => {
    const superProto = base.prototype;
    class CoreHasDependenciesMixin extends base {
        get outgoingDeps() {
            return this.project.dependencyStore.getOutgoingDepsForEvent(this);
        }
        get incomingDeps() {
            return this.project.dependencyStore.getIncomingDepsForEvent(this);
        }
        leaveProject() {
            const eventStore = this.eventStore;
            // the buckets may be empty if a model is removed from the project immediately after adding
            // (without propagation)
            if (this.outgoingDeps) {
                this.outgoingDeps.forEach(dependency => eventStore.dependenciesForRemoval.add(dependency));
            }
            if (this.incomingDeps) {
                this.incomingDeps.forEach(dependency => eventStore.dependenciesForRemoval.add(dependency));
            }
            superProto.leaveProject.call(this);
        }
    }
    return CoreHasDependenciesMixin;
}) {
}
