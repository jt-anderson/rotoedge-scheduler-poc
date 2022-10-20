import AbstractCrudManagerMixin from '../../../Scheduler/crud/AbstractCrudManagerMixin.js';
import StringHelper from '../../../Core/helper/StringHelper.js';
import Base from '../../../Core/Base.js';
import AjaxTransport from '../../crud/transport/AjaxTransport.js';
import JsonEncoder from '../../crud/encoder/JsonEncoder.js';
import ObjectHelper from '../../../Core/helper/ObjectHelper.js';

/**
 * @module Scheduler/data/mixin/ProjectCrudManager
 */

/**
 * This mixin provides Crud Manager functionality supporting loading of scheduling engine projects.
 *
 * @mixin
 * @mixes Scheduler/crud/AbstractCrudManagerMixin
 * @mixes Scheduler/crud/transport/AjaxTransport
 * @mixes Scheduler/crud/encoder/JsonEncoder
 */
export default Target => class ProjectCrudManager extends (Target || Base).mixin(AbstractCrudManagerMixin, AjaxTransport, JsonEncoder) {

    //region Config

    static get defaultConfig() {
        return {
            project : null
        };
    }

    startConfigure(config) {
        // process the project first which ingests any configured data sources,
        this.getConfig('project');

        super.startConfigure(config);

        this._changesToClear = new Map();
    }

    async doAutoLoad() {
        const { project } = this;

        // Delay autoLoad to after projects initial commit if configured with a project
        if (project) {
            await project.commitAsync();
        }

        return super.doAutoLoad();
    }

    applyProjectResponse(response) {
        const
            me = this,
            { project } = me;

        me.applyingProjectResponse = true;

        const
            startDateField = project.fieldMap.startDate,
            endDateField   = project.fieldMap.endDate,
            startDate      = ObjectHelper.getPath(response, startDateField.dataSource),
            endDate        = ObjectHelper.getPath(response, endDateField.dataSource);

        // With early rendering engine won't convert project dates in time, do it manually first
        if (typeof startDate === 'string') {
            ObjectHelper.setPath(response, startDateField.dataSource, startDateField.convert(startDate));
        }
        if (typeof endDate === 'string') {
            ObjectHelper.setPath(response, endDateField.dataSource, endDateField.convert(startDate));
        }

        Object.assign(project, response);

        me.applyingProjectResponse = false;
    }

    loadCrudManagerData(response, options = {}) {
        const
            me = this,
            { project } = me;

        // We don't want to react on store changes while loading them
        me.suspendChangesTracking();

        super.loadCrudManagerData(...arguments);

        // If there is project data provided
        if (response?.project) {
            // If the project is delaying its linking to a new graph instance
            // wait till it detaches all records from the old graph
            // and then apply the project data.
            // Otherwise the project changes we apply here will be overridden when detaching from the old graph.
            // Since the code copies last identifier values from the graph when detaching.
            if (project.delayEnteringReplica) {
                project.on('recordsUnlinked', () => {
                    me.suspendChangesTracking();
                    me.applyProjectResponse(response.project);
                    me.resumeChangesTracking();
                }, { once : true });
            }
            else {
                me.applyProjectResponse(response.project);
            }
        }

        me.resumeChangesTracking();
    }

    async sync() {
        const { project } = this;

        // Suspend Crud Manager autoSync to not react on changes during commitAsync() call
        this.suspendAutoSync();

        // Make sure data is in a calculated state before syncing
        if (project) {
            await project.commitAsync();
        }

        if (this.isDestroying) {
            return;
        }

        // resume autoSync silently
        this.resumeAutoSync(false);

        return super.sync();
    }

    async applyResponse(request, response, options) {
        const me = this;

        if (me.isDestroyed || me.project?.isDestroyed) {
            return;
        }

        me.trigger('startApplyResponse');

        // clear "added"/"modified" collections on the stores
        // TODO: need to snapshot their state to be able to revert in case of an exception
        me.clearCrudStoresChanges({ clearRemovedCollection : false });

        await super.applyResponse(request, response, options);

        // clear "removed" collection on the stores
        me.clearCrudStoresChanges({
            removeAddedRecords      : false,
            clearAddedCollection    : false,
            clearModifiedCollection : false,
            clearRemovedCollection  : true
        });

        // if there is the project data provided
        if (response?.project) {
            me.applyProjectResponse(response.project);
        }

        // if we have a project
        if (me.project) {
            let requestType = request.type;

            // response can force its type
            if (me.trackResponseType) {
                requestType = response.type || requestType;
            }

            // Make a boolean flag indicating what has triggered the propagation ("propagatingLoadChanges" or  "propagatingSyncChanges")
            const propagationFlag = `propagating${StringHelper.capitalize(requestType)}Changes`;

            me[propagationFlag] = true;
            // Wait till calculation gets done
            await me.project.commitAsync();
            me[propagationFlag] = false;

            // Accept changes came from the server (might have been destroyed while waiting above)
            me.commitRespondedChanges?.();
        }
    }

    commitRespondedChanges() {
        // We silently accept changes came from the server
        this._changesToClear.forEach((changes, record) => {
            Object.entries(changes).forEach(([key, value]) => {
                const
                    field    = record.getFieldDefinition(key),
                    oldValue = record[key];

                // If the field value matches the one responded from the server
                // we silently accept it
                if (field?.isEqual ? field.isEqual(oldValue, value) : ObjectHelper.isEqual(oldValue, value)) {
                    delete record.meta.modified[key];
                }
            });
        });

        this._changesToClear.clear();
    }

    applyChangesToStore(storeDesc, storeResponse, storePack) {
        const changesMap = super.applyChangesToStore(storeDesc, storeResponse, storePack);

        // The changes enter graph first but not store until later, clearing changes in StoreChanges might still leave
        // records modified. We need to clean up after the next propagation, so we store record changes in a map for now
        if (changesMap.size && this.project) {
            for (const [id, changes] of changesMap) {
                const record = storeDesc.store.getById(id);
                record && this._changesToClear.set(record, changes);
            }
        }

        return changesMap;
    }

    clearCrudStoresChanges(flags = { removeAddedRecords : true, clearAddedCollection : true, clearModifiedCollection : true, clearRemovedCollection : true }) {
        const {
            removeAddedRecords,
            clearAddedCollection,
            clearModifiedCollection,
            clearRemovedCollection
        } = flags;

        // TODO: Change when https://app.assembla.com/spaces/bryntum/tickets/8975 is fixed
        // this.crudStores.forEach(store => store.store.clearChanges());
        this.forEachCrudStore(store => {
            if (removeAddedRecords) {
                // remove phantom records
                store.remove(this.added, true);
            }

            if (clearModifiedCollection) {
                store.modified.forEach(r => r.clearChanges(true, false));
                store.modified.clear();
            }

            if (clearAddedCollection) {
                store.added.clear();
            }

            if (clearRemovedCollection) {
                store.removed.clear();
            }
        });
    }
};
