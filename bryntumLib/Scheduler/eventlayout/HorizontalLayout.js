import Base from '../../Core/Base.js';

/**
 * @module Scheduler/eventlayout/HorizontalLayout
 */

/**
 * Base class for horizontal layouts (HorizontalLayoutPack and HorizontalLayoutStack). Should not be used directly,
 * instead specify {@link Scheduler.view.mixin.SchedulerEventRendering#config-eventLayout} in Scheduler config (stack,
 * pack or none):
 *
 * @example
 * let scheduler = new Scheduler({
 *   eventLayout: 'stack'
 * });
 *
 * @abstract
 * @private
 */
export default class HorizontalLayout extends Base {
    static get defaultConfig() {
        return {
            nbrOfBandsByResource        : {},
            bandIndexToPxConvertFn      : null,
            bandIndexToPxConvertThisObj : null
        };
    }

    clearCache(resource) {
        if (resource) {
            delete this.nbrOfBandsByResource[resource.id];
        }
        else {
            this.nbrOfBandsByResource = {};
        }
    }

    /**
     * This method performs layout on an array of event render data and returns amount of _bands_. Band is a multiplier of a
     * configured {@link Scheduler.view.Scheduler#config-rowHeight} to calculate total row height required to fit all
     * events.
     * This method should not be used directly, it is called by the Scheduler during the row rendering process.
     * @param {EventRenderData[]} events
     * @param {Scheduler.model.ResourceModel} resource
     * @returns {Number}
     */
    applyLayout(events, resource) {
        // Return number of bands required
        return this.nbrOfBandsByResource[resource.id] = this.layoutEventsInBands(events);
    }

    /**
     * This method iterates over events and calculates top position for each of them. Default layouts calculate
     * positions to avoid events overlapping horizontally (except for the 'none' layout). Pack layout will squeeze events to a single
     * row by reducing their height, Stack layout will increase the row height and keep event height intact.
     * This method should not be used directly, it is called by the Scheduler during the row rendering process.
     * @param {EventRenderData[]} events
     */
    layoutEventsInBands(events) {
        throw new Error('Implement in subclass');
    }
}
