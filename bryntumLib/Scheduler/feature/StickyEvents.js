import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from '../../Grid/feature/GridFeatureManager.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import DomSync from '../../Core/helper/DomSync.js';

/**
 * @module Scheduler/feature/StickyEvents
 */

const zeroMargins = { width : 0, height : 0 };

/**
 * This feature applies native `position: sticky` to event contents in horizontal mode, keeping the contents in view as
 * long as possible on scroll. For vertical mode it uses a programmatic solution to achieve the same result.
 *
 * Assign `eventRecord.stickyContents = false` to disable stickiness on a per event level (docs for
 * {@link Scheduler/model/EventModel#field-stickyContents}).
 *
 * This feature is **enabled** by default.
 *
 * @extends Core/mixin/InstancePlugin
 * @classtype stickyEvents
 * @feature
 */
export default class StickyEvents extends InstancePlugin {
    static $name = 'StickyEvents';

    static type = 'stickyEvents';

    static pluginConfig = {
        chain : ['onEventDataGenerated']
    }

    construct(scheduler, config) {
        super.construct(scheduler, config);

        if (scheduler.isVertical) {
            this.toUpdate = new Set();

            scheduler.on({
                scroll  : 'onSchedulerScroll',
                thisObj : this,
                prio    : 10000
            });
        }
    }

    onEventDataGenerated(renderData) {
        if (this.client.isHorizontal) {
            renderData.wrapperCls['b-disable-sticky'] = renderData.eventRecord.stickyContents === false;
        }
        else {
            this.syncEventContentPosition(renderData, undefined, true);
            this.updateStyles();
        }
    }

    //region Vertical mode

    onSchedulerScroll() {
        if (!this.disabled) {
            this.verticalSyncAllEventsContentPosition(this.client);
        }
    }

    updateStyles() {
        for (const { contentEl, style } of this.toUpdate) {
            DomHelper.applyStyle(contentEl, style);
        }

        this.toUpdate.clear();
    }

    verticalSyncAllEventsContentPosition(scheduler) {
        const { resourceMap } = scheduler.currentOrientation;

        for (const eventsData of resourceMap.values()) {
            for (const { renderData, elementConfig } of Object.values(eventsData)) {
                const args = [renderData];

                if (elementConfig && renderData.eventRecord.isResourceTimeRange) {
                    args.push(elementConfig.children[0]);
                }

                this.syncEventContentPosition.apply(this, args);
            }
        }
        this.toUpdate.size && this.updateStyles();
    }

    syncEventContentPosition(renderData, eventContent = renderData.eventContent, duringGeneration = false) {
        if (
            this.disabled ||
            // Allow client disable stickiness for certain events
            renderData.eventRecord.stickyContents === false
        ) {
            return;
        }

        const
            { client }        = this,
            {
                eventRecord,
                resourceRecord,
                useEventBuffer,
                bufferAfterWidth,
                bufferBeforeWidth,
                top,
                height
            }                 = renderData,
            scrollPosition    = client.scrollable.y,
            wrapperEl         = duringGeneration ? null : client.getElementFromEventRecord(eventRecord, resourceRecord, true),
            contentEl         = wrapperEl && DomSync.getChild(wrapperEl, 'event.content'),
            meta              = eventRecord.instanceMeta(client),
            style             = typeof eventContent.style === 'string'
                ? (eventContent.style = DomHelper.parseStyle(eventContent.style))
                : eventContent.style || (eventContent.style = {});

        // Do not process events being dragged
        if (wrapperEl?.classList.contains('b-dragging')) {
            return;
        }

        let start       = top,
            contentSize = height,
            end         = start + contentSize;

        if (useEventBuffer) {
            start += bufferBeforeWidth;
            contentSize = contentSize - bufferBeforeWidth - bufferAfterWidth;
            end = start + contentSize;
        }

        // Only process non-milestones that are partially out of view
        if (start < scrollPosition && end >= scrollPosition && !eventRecord.isMilestone) {
            const
                contentWidth = contentEl?.offsetWidth,
                justify      = contentEl?.parentNode && DomHelper.getStyleValue(contentEl.parentNode, 'justifyContent'),
                c            = justify === 'center' ? (renderData.width - contentWidth) / 2 : 0,
                eventStart   = start,
                eventEnd     = eventStart + contentSize - 1;

            // Only process non-milestone events. Milestones have no width.
            // If there's no offsetWidth, it's still b-released, so we cannot measure it.
            // If the event starts off the left edge, but its right edge is still visible,
            // translate the contentEl to compensate. If not, undo any translation.
            if ((!contentEl || contentWidth) && eventStart < scrollPosition && eventEnd >= scrollPosition) {
                const
                    edgeSizes = this.getEventContentMargins(contentEl),
                    maxOffset = contentEl
                        ? (contentSize - contentEl.offsetHeight - edgeSizes.height) - c
                        : Number.MAX_SAFE_INTEGER,
                    offset = Math.min(scrollPosition - eventStart, maxOffset - 2);

                style.transform = offset > 0 ? `translateY(${offset}px)` : '';
                meta.stuck = true;
            }
            else {
                style.transform = '';
                meta.stuck = false;
            }

            if (contentEl) {
                this.toUpdate.add({
                    contentEl,
                    style
                });
            }
        }
        else if (contentEl && meta.stuck) {
            style.transform = '';
            meta.stuck = false;

            this.toUpdate.add({
                contentEl,
                style
            });
        }
    }

    // Only measure the margins of an event's contentEl once
    getEventContentMargins(contentEl) {
        if (contentEl?.classList.contains('b-sch-event-content')) {
            return DomHelper.getEdgeSize(contentEl, 'margin');
        }
        return zeroMargins;
    }

    //endregion

    doDisable() {
        super.doDisable(...arguments);

        if (!this.isConfiguring) {
            this.client.refreshWithTransition();
        }
    }
}

GridFeatureManager.registerFeature(StickyEvents, true, 'Scheduler');
GridFeatureManager.registerFeature(StickyEvents, false, 'ResourceHistogram');
