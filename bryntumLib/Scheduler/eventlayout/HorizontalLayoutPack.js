import HorizontalLayout from './HorizontalLayout.js';
import PackMixin from './PackMixin.js';

/**
 * @module Scheduler/eventlayout/HorizontalLayoutPack
 */

/**
 * Handles layout of events within a row (resource) in horizontal mode. Packs events (adjusts their height) to fit
 * available row height
 *
 * @extends Scheduler/eventlayout/HorizontalLayout
 * @mixes Scheduler/eventlayout/PackMixin
 * @private
 */
export default class HorizontalLayoutPack extends HorizontalLayout.mixin(PackMixin) {
    static get $name() {
        return 'HorizontalLayoutPack';
    }

    static get configurable() {
        return {
            type : 'pack'
        };
    }

    // Packs the events to consume as little space as possible
    layoutEventsInBands(events) {
        const result = this.packEventsInBands(events, (event, j, slot, slotSize) => {
            event.height = slotSize;
            event.top    = slot.start + (j * slotSize);
        });

        events.forEach(event => {
            Object.assign(
                event,
                this.bandIndexToPxConvertFn.call(
                    this.bandIndexToPxConvertThisObj || this,
                    event.top,
                    event.height,
                    event.eventRecord,
                    event.resourceRecord
                )
            );
        });

        return result;
    }
}
