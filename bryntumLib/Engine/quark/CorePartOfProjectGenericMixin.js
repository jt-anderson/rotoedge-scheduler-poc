import { Mixin } from "../../ChronoGraph/class/BetterMixin.js";
import { AbstractPartOfProjectGenericMixin } from "./AbstractPartOfProjectGenericMixin.js";
/**
 * This a base generic mixin for every class, that belongs to a scheduler_core project.
 *
 * It just provides getter/setter for the `project` property, along with some convenience methods
 * to access the project's stores.
 */
export class CorePartOfProjectGenericMixin extends Mixin([AbstractPartOfProjectGenericMixin], (base) => {
    const superProto = base.prototype;
    class CorePartOfProjectGenericMixin extends base {
        //region Store getters
        get eventStore() {
            return this.project?.eventStore;
        }
        get resourceStore() {
            return this.project?.resourceStore;
        }
        get assignmentStore() {
            return this.project?.assignmentStore;
        }
        get dependencyStore() {
            return this.project?.dependencyStore;
        }
        get calendarManagerStore() {
            return this.project?.calendarManagerStore;
        }
        //endregion
        //region Entity getters
        /**
         * Convenience method to get the instance of event by its id.
         */
        getEventById(id) {
            return this.eventStore?.getById(id);
        }
        /**
         * Convenience method to get the instance of dependency by its id.
         */
        getDependencyById(id) {
            return this.dependencyStore?.getById(id);
        }
        /**
         * Convenience method to get the instance of resource by its id.
         */
        getResourceById(id) {
            return this.resourceStore?.getById(id);
        }
        /**
         * Convenience method to get the instance of assignment by its id.
         */
        getAssignmentById(id) {
            return this.assignmentStore?.getById(id);
        }
        /**
         * Convenience method to get the instance of calendar by its id.
         */
        getCalendarById(id) {
            return this.calendarManagerStore?.getById(id);
        }
    }
    return CorePartOfProjectGenericMixin;
}) {
}
