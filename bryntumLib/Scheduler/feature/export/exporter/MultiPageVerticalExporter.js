import GridMultiPageVerticalExporter from '../../../../Grid/feature/export/exporter/MultiPageVerticalExporter.js';
import SchedulerExporterMixin from './SchedulerExporterMixin.js';
import { ScheduleRange } from '../Utils.js';

/**
 * @module Scheduler/feature/export/exporter/MultiPageVerticalExporter
 */

/**
 * A vertical multiple page exporter. Used by the {@link Scheduler.feature.export.PdfExport} feature to export to
 * multiple pages. Content will be scaled in a horizontal direction to fit the page.
 *
 * You do not need to use this class directly.
 *
 * ### Extending exporter
 *
 * ```javascript
 * class MyMultiPageVerticalExporter extends MultiPageVerticalExporter {
 *     // type is required for exporter
 *     static get type() {
 *         return 'mymultipageverticalexporter';
 *     }
 *
 *     get stylesheets() {
 *         const stylesheets = super.stylesheets;
 *
 *         stylesheets.forEach(styleNodeOrLinkTag => doSmth(styleNodeOrLinkTag))
 *
 *         return stylesheets;
 *     }
 * }
 *
 * const scheduler = new Scheduler({
 *     features : {
 *         pdfExport : {
 *             // this export feature is configured with only one exporter
 *             exporters : [MyMultiPageVerticalExporter]
 *         }
 *     }
 * });
 *
 * // run export with the new exporter
 * scheduler.features.pdfExport.export({ exporter : 'mymultipageverticalexporter' });
 * ```
 *
 * @classType multipagevertical
 * @feature
 * @extends Grid/feature/export/exporter/MultiPageVerticalExporter
 * @typings Grid/feature/export/exporter/MultiPageVerticalExporter -> Grid/feature/export/exporter/GridMultiPageVerticalExporter
 */
export default class MultiPageVerticalExporter extends SchedulerExporterMixin(GridMultiPageVerticalExporter) {

    static get $name() {
        return 'MultiPageVerticalExporter';
    }

    static get type() {
        return 'multipagevertical';
    }

    async stateNextPage(config) {
        await super.stateNextPage(config);

        this.exportMeta.eventsBoxes.clear();
    }

    async prepareComponent(config) {
        await super.prepareComponent(config);

        // Scheduler exporter mixin can update totalWidth, so we need to adjust pages and scale here again
        if (config.scheduleRange !== ScheduleRange.completeview) {
            this.estimateTotalPages(config);
        }
    }

    positionRows(rows) {
        const
            resources   = [],
            events      = [];

        // In case of variable row height row vertical position is not guaranteed to increase
        // monotonously. Position row manually instead
        rows.forEach(([html, top, height, eventsHtml]) => {
            resources.push(html);
            eventsHtml && Array.from(eventsHtml.entries()).forEach(([key, [html, box]]) => {
                events.push(html);

                // Store event box to render dependencies later
                this.exportMeta.eventsBoxes.set(String(key), box);
            });
        });

        return { resources, events };
    }
}
