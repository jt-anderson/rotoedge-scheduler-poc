import GridMultiPageExporter from '../../../../Grid/feature/export/exporter/MultiPageExporter.js';
import SchedulerExporterMixin from './SchedulerExporterMixin.js';

/**
 * @module Scheduler/feature/export/exporter/MultiPageExporter
 */

/**
 * A multiple page exporter. Used by the {@link Scheduler.feature.export.PdfExport} feature to export to multiple pages.
 * You do not need to use this class directly.
 *
 * ### Extending exporter
 *
 * ```javascript
 * class MyMultiPageExporter extends MultiPageExporter {
 *     // type is required for exporter
 *     static get type() {
 *         return 'mymultipageexporter';
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
 *             exporters : [MyMultiPageExporter]
 *         }
 *     }
 * });
 *
 * // run export with the new exporter
 * scheduler.features.pdfExport.export({ exporter : 'mymultipageexporter' });
 * ```
 *
 * @classType multipage
 * @feature
 * @extends Grid/feature/export/exporter/MultiPageExporter
 * @typings Grid/feature/export/exporter/MultiPageExporter -> Grid/feature/export/exporter/GridMultiPageExporter
 */
export default class MultiPageExporter extends SchedulerExporterMixin(GridMultiPageExporter) {

    static get $name() {
        return 'MultiPageExporter';
    }

    static get type() {
        return 'multipage';
    }

    async stateNextPage(config) {
        await super.stateNextPage(config);

        this.exportMeta.eventsBoxes.clear();
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
