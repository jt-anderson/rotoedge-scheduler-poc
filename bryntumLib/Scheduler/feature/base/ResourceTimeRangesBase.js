import InstancePlugin from '../../../Core/mixin/InstancePlugin.js';
import AttachToProjectMixin from '../../data/mixin/AttachToProjectMixin.js';

/**
 * @module Scheduler/feature/base/ResourceTimeRangesBase
 */

/**
 * Abstract base class for ResourceTimeRanges and ResourceNonWorkingTime features.
 * You should not use this class directly.
 *
 * @extends Core/mixin/InstancePlugin
 * @abstract
 */
export default class ResourceTimeRangesBase extends InstancePlugin.mixin(AttachToProjectMixin) {
    //region Config

    static get configurable() {
        return {
            /**
             * Specify value to use for the tabIndex attribute of range elements
             * @config {Number}
             * @default
             */
            tabIndex : null
        };
    }

    // Plugin configuration. This plugin chains some of the functions in Grid.
    static get pluginConfig() {
        return {
            chain : ['getEventsToRender', 'onEventDataGenerated', 'noFeatureElementsInAxis']
        };
    }

    // Let Scheduler know if we have ResourceTimeRanges in view or not
    noFeatureElementsInAxis() {
        const { timeAxis } = this.client;
        return !this.needsRefresh && this.store && !this.store.storage.values.some(t => timeAxis.isTimeSpanInAxis(t));
    }

    //endregion

    //region Init

    doDisable(disable) {
        if (this.client.isPainted) {
            this.client.refresh();
        }

        super.doDisable(disable);
    }

    updateTabIndex() {
        if (!this.isConfiguring) {
            this.client.refresh();
        }
    }

    //endregion

    getEventsToRender(resource, events) {
        throw new Error('Implement in subclass');
    }

    // Called for each event during render, allows manipulation of render data. Adjust any resource time ranges
    // (chained function from Scheduler)
    onEventDataGenerated(renderData) {
        const
            me                       = this,
            { eventRecord, iconCls } = renderData;

        if (me.shouldInclude(eventRecord)) {
            if (me.client.isVertical) {
                renderData.width = renderData.resourceRecord.columnWidth || me.client.resourceColumnWidth;
            }
            else {
                renderData.top = 0;
            }

            // Flag that we should fill entire row/col
            renderData.fillSize = true;
            // Add our own cls
            renderData.wrapperCls[me.rangeCls] = 1;
            renderData.wrapperCls[`b-sch-color-${eventRecord.timeRangeColor}`] = eventRecord.timeRangeColor;
            // Add label
            renderData.eventContent.text = eventRecord.name;
            renderData.children.push(renderData.eventContent);

            // Allow configuring tabIndex
            renderData.tabIndex = me.tabIndex != null ? String(me.tabIndex) : null;

            // Add icon
            if (iconCls?.length > 0) {
                renderData.children.unshift({
                    tag       : 'i',
                    className : iconCls.toString()
                });
            }

            // Event data for DOMSync comparison
            renderData.eventId = me.generateElementId(eventRecord);
        }
    }

    /**
     * Generates ID from the passed time range record
     * @param {Scheduler.model.TimeSpan} record
     * @returns {String} Generated ID for the DOM element
     * @internal
     */
    generateElementId(record) {
        return record.domId;
    }

    shouldInclude(eventRecord) {
        throw new Error('Implement in subclass');
    }

    // Called when a ResourceTimeRangeModel is manipulated, relays to Scheduler#onInternalEventStoreChange which updates to UI
    onStoreChange(event) {
        // Edge case for scheduler not using any events, it has to refresh anyway to get rid of ResourceTimeRanges
        if (event.action === 'removeall' || event.action === 'dataset') {
            this.needsRefresh = true;
        }

        this.client.onInternalEventStoreChange(event);

        this.needsRefresh = false;
    }
}

// No feature based styling needed, do not add a cls to Scheduler
ResourceTimeRangesBase.featureClass = '';
