import Base from '../../../Core/Base.js';

/**
 * @module Scheduler/data/mixin/PartOfProject
 */

/**
 * This is a mixin, included in all models and stores of the Scheduler project. It provides a common API for accessing
 * all stores of the project.
 *
 * @mixin
 */
export default Target => class PartOfProject extends (Target || Base) {

    /**
     * Returns the project this entity belongs to.
     *
     * @member {Scheduler.model.ProjectModel} project
     * @readonly
     * @category Project
     */

    /**
     * Returns the event store of the project this entity belongs to.
     *
     * @member {Scheduler.data.EventStore} eventStore
     * @readonly
     * @category Project
     */

    /**
     * Returns the dependency store of the project this entity belongs to.
     *
     * @member {Scheduler.data.DependencyStore} dependencyStore
     * @readonly
     * @category Project
     */

    /**
     * Returns the assignment store of the project this entity belongs to.
     *
     * @member {Scheduler.data.AssignmentStore} assignmentStore
     * @readonly
     * @category Project
     */

    /**
     * Returns the resource store of the project this entity belongs to.
     *
     * @member {Scheduler.data.ResourceStore} resourceStore
     * @readonly
     * @category Project
     */

    static get $name() {
        return 'PartOfProject';
    }
};
