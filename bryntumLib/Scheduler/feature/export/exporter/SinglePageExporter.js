import GridSinglePageExporter from '../../../../Grid/feature/export/exporter/SinglePageExporter.js';
import SchedulerExporterMixin from './SchedulerExporterMixin.js';

/**
 * @module Scheduler/feature/export/exporter/SinglePageExporter
 */

/**
 * A single page exporter. Used by the {@link Scheduler.feature.export.PdfExport} feature to export to single page.
 * Content will be scaled in both directions to fit the page.
 *
 * You do not need to use this class directly.
 *
 * ### Extending exporter
 *
 * ```javascript
 * class MySinglePageExporter extends SinglePageExporter {
 *     // type is required for exporter
 *     static get type() {
 *         return 'mysinglepageexporter';
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
 *             exporters : [MySinglePageExporter]
 *         }
 *     }
 * });
 *
 * // run export with the new exporter
 * scheduler.features.pdfExport.export({ exporter : 'mysinglepageexporter' });
 * ```
 *
 * @classType singlepage
 * @feature
 * @extends Grid/feature/export/exporter/SinglePageExporter
 * @typings Grid/feature/export/exporter/SinglePageExporter -> Grid/feature/export/exporter/GridSinglePageExporter
 */
export default class SinglePageExporter extends SchedulerExporterMixin(GridSinglePageExporter) {

    static get $name() {
        return 'SinglePageExporter';
    }

    static get type() {
        return 'singlepage';
    }

    // We should not collect dependencies per each page, instead we'd render them once
    collectDependencies() {}

    positionRows(rows) {
        const
            resources   = [],
            events      = [],
            translateRe = /translate\((\d+.?\d*)px, (\d+.?\d*)px\)/,
            topRe       = /top:.+?px/;

        let currentTop = 0;

        // In case of variable row height row vertical position is not guaranteed to increase
        // monotonously. Position row manually instead
        rows.forEach(([html, top, height, eventsHtml]) => {
            // Adjust row vertical position by changing `translate` style
            resources.push(html.replace(translateRe, `translate($1px, ${currentTop}px)`));

            const rowTopDelta = currentTop - top;

            eventsHtml && Array.from(eventsHtml.entries()).forEach(([key, [html, box]]) => {
                // Fix event vertical position according to the row top
                box.translate(0, rowTopDelta);

                // Store event box to render dependencies later
                this.exportMeta.eventsBoxes.set(String(key), box);

                // Adjust event vertical position by replacing `top` style
                events.push(html.replace(topRe, `top: ${box.y}px`));
            });

            currentTop += height;
        });

        return { resources, events };
    }
}
