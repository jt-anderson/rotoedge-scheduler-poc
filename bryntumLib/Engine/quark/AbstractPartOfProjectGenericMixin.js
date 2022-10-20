import { Mixin } from "../../ChronoGraph/class/BetterMixin.js";
/**
 * This a base generic mixin for every class, that belongs to a project.
 *
 * It just provides getter/setter for the `project` property, along with some convenience methods
 * to access the project's stores.
 */
export class AbstractPartOfProjectGenericMixin extends Mixin([], (base) => {
    const superProto = base.prototype;
    class AbstractPartOfProjectGenericMixin extends base {
        async commitAsync() {
            return this.project.commitAsync();
        }
        set project(project) {
            this.$project = project;
        }
        get project() {
            return this.$project;
        }
        calculateProject() {
            throw new Error("Implement me");
        }
        /**
         * The method to set the [[AbstractProjectMixin|project]] instance, this entity belongs to.
         */
        setProject(project) {
            return this.project = project;
        }
        /**
         * The method to get the [[AbstractProjectMixin|project]] instance, this entity belongs to.
         */
        getProject() {
            if (this.project)
                return this.project;
            return this.setProject(this.calculateProject());
        }
        /**
         * Convenience method to get the instance of the assignment store in the [[AbstractProjectMixin|project]] instance, this entity belongs to.
         */
        getAssignmentStore() {
            const project = this.getProject();
            return project?.assignmentStore;
        }
        /**
         * Convenience method to get the instance of the dependency store in the [[AbstractProjectMixin|project]] instance, this entity belongs to.
         */
        getDependencyStore() {
            const project = this.getProject();
            return project?.dependencyStore;
        }
        /**
         * Convenience method to get the instance of the event store in the [[AbstractProjectMixin|project]] instance, this entity belongs to.
         */
        getEventStore() {
            const project = this.getProject();
            return project?.eventStore;
        }
        /**
         * Convenience method to get the instance of the resource store in the [[AbstractProjectMixin|project]] instance, this entity belongs to.
         */
        getResourceStore() {
            const project = this.getProject();
            return project?.resourceStore;
        }
        /**
         * Convenience method to get the instance of the calendar manager store in the [[AbstractProjectMixin|project]] instance, this entity belongs to.
         */
        getCalendarManagerStore() {
            const project = this.getProject();
            return project?.calendarManagerStore;
        }
    }
    return AbstractPartOfProjectGenericMixin;
}) {
}
