/**
 * @module Scheduler/view/mixin/CurrentConfig
 */

const
    stores = [
        'eventStore',
        'taskStore',
        'assignmentStore',
        'resourceStore',
        'dependencyStore',
        'timeRangeStore',
        'resourceTimeRangeStore'
    ],
    inlineProperties = [
        'events',
        'tasks',
        'resources',
        'assignments',
        'dependencies',
        'timeRanges',
        'resourceTimeRanges'
    ];

/**
 * Mixin that makes sure inline data & crud manager data are removed from current config for products using a project.
 * The data is instead inlined in the project (by ProjectModel.js)
 *
 * @mixin
 * @private
 */
export default Target => class CurrentConfig extends Target {

    static get $name() {
        return 'CurrentConfig';
    }

    preProcessCurrentConfigs(configs) {
        // Remove inline data on the component
        for (const prop of inlineProperties) {
            delete configs[prop];
        }

        super.preProcessCurrentConfigs(configs);
    }

    // This function is not meant to be called by any code other than Base#getCurrentConfig().
    getCurrentConfig(options) {
        const
            project = this.project.getCurrentConfig(options),
            result = super.getCurrentConfig(options);

        // Force project with inline data
        if (project) {
            result.project = project;

            const { crudManager } = result;

            // Transfer crud store configs to project (mainly fields)
            if (crudManager) {
                for (const store of stores) {
                    if (crudManager[store]) {
                        project[store] = crudManager[store];
                    }
                }
            }

            if (Object.keys(project).length === 0) {
                delete result.project;
            }
        }

        // Store (resource store) data is included in project
        delete result.data;

        // Remove CrudManager, since data will be placed inline
        delete result.crudManager;

        return result;
    }

    get widgetClass() {}
};
