import Base from '../../Core/Base.js';
import DateHelper from '../../Core/helper/DateHelper.js';

/**
 * @module Scheduler/eventlayout/PackMixin
 */

/**
 * Mixin holding functionality shared between HorizontalLayoutPack and VerticalLayout.
 *
 * @mixin
 * @private
 */
export default Target => class PackMixin extends (Target || Base) {
    static get $name() {
        return 'PackMixin';
    }

    static get defaultConfig() {
        return {
            coordProp       : 'top',
            sizeProp        : 'height',
            inBandCoordProp : 'inBandTop',
            inBandSizeProp  : 'inBandHeight'
        };
    }

    isSameGroup(a, b) {
        return this.grouped ? a.group === b.group : true;
    }

    // Packs the events to consume as little space as possible
    packEventsInBands(events, applyClusterFn) {
        const
            me                      = this,
            { coordProp, sizeProp } = me;

        let slot,
            firstInCluster,
            cluster,
            j;

        for (let i = 0, l = events.length; i < l; i++) {
            firstInCluster = events[i];

            slot = me.findStartSlot(events, firstInCluster);

            cluster = me.getCluster(events, i);

            if (cluster.length > 1) {
                firstInCluster[coordProp] = slot.start;
                firstInCluster[sizeProp]  = slot.end - slot.start;

                // If there are multiple slots, and events in the cluster have multiple start dates, group all same-start events into first slot
                j = 1;

                while (j < (cluster.length - 1) && cluster[j + 1].start - firstInCluster.start === 0) {
                    j++;
                }

                // See if there's more than 1 slot available for this cluster, if so - first group in cluster consumes the entire first slot
                const nextSlot = me.findStartSlot(events, cluster[j]);

                if (nextSlot && nextSlot.start < 0.8) {
                    cluster.length = j;
                }
            }

            const
                clusterSize = cluster.length,
                slotSize    = (slot.end - slot.start) / clusterSize;

            // Apply fraction values
            for (j = 0; j < clusterSize; j++) {
                applyClusterFn(cluster[j], j, slot, slotSize);
            }

            i += clusterSize - 1;
        }

        return 1;
    }

    findStartSlot(events, event) {
        const
            {
                inBandSizeProp,
                inBandCoordProp,
                coordProp,
                sizeProp
            }                = this,
            priorOverlappers = this.getPriorOverlappingEvents(events, event);

        let i;

        if (priorOverlappers.length === 0) {
            return {
                start : 0,
                end   : 1
            };
        }

        for (i = 0; i < priorOverlappers.length; i++) {
            const
                item       = priorOverlappers[i],
                COORD_PROP = inBandCoordProp in item ? inBandCoordProp : coordProp,
                SIZE_PROP  = inBandSizeProp in item ? inBandSizeProp : sizeProp;

            if (i === 0 && item[COORD_PROP] > 0) {
                return {
                    start : 0,
                    end   : item[COORD_PROP]
                };
            }
            else {
                if (item[COORD_PROP] + item[SIZE_PROP] < (i < priorOverlappers.length - 1 ? priorOverlappers[i + 1][COORD_PROP] : 1)) {
                    return {
                        start : item[COORD_PROP] + item[SIZE_PROP],
                        end   : i < priorOverlappers.length - 1 ? priorOverlappers[i + 1][COORD_PROP] : 1
                    };
                }
            }
        }

        return false;
    }

    getPriorOverlappingEvents(events, event) {
        const
            start       = event.start,
            end         = event.end,
            overlappers = [];

        for (let i = 0, l = events.indexOf(event); i < l; i++) {
            const item = events[i];

            if (this.isSameGroup(item, event) && DateHelper.intersectSpans(start, end, item.start, item.end)) {
                overlappers.push(item);
            }
        }

        overlappers.sort(this.sortOverlappers.bind(this));

        return overlappers;
    }

    sortOverlappers(e1, e2) {
        const { coordProp } = this;

        return e1[coordProp] - e2[coordProp];
    }

    getCluster(events, startIndex) {
        const
            startEvent = events[startIndex],
            result     = [startEvent];

        if (startIndex >= events.length - 1) {
            return result;
        }

        let { start, end } = startEvent;

        for (let i = startIndex + 1, l = events.length; i < l; i++) {
            const item = events[i];

            if (!this.isSameGroup(item, startEvent) || !DateHelper.intersectSpans(start, end, item.start, item.end)) {
                break;
            }

            result.push(item);
            start = DateHelper.max(start, item.start);
            end   = DateHelper.min(item.end, end);
        }

        return result;
    }
};
