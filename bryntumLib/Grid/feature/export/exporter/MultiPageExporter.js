import Exporter from './Exporter.js';
import { Orientation, PaperFormat, RowsRange } from '../Utils.js';

/**
 * @module Grid/feature/export/exporter/MultiPageExporter
 */

/**
 * A multiple page exporter. Used by the {@link Grid.feature.export.PdfExport} feature to export to multiple pages. You
 * do not need to use this class directly.
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
 * const grid = new Grid({
 *     features : {
 *         pdfExport : {
 *             // this export feature is configured with only one exporter
 *             exporters : [MyMultiPageExporter]
 *         }
 *     }
 * });
 *
 * // run export with the new exporter
 * grid.features.pdfExport.export({ exporter : 'mymultipageexporter' });
 * ```
 *
 * @classType multipage
 * @feature
 * @extends Grid/feature/export/exporter/Exporter
 */
export default class MultiPageExporter extends Exporter {

    static get $name() {
        return 'MultiPageExporter';
    }

    static get type() {
        return 'multipage';
    }

    static get title() {
        // In case locale is missing exporter is still distinguishable
        return this.L('L{multipage}');
    }

    static get exportingPageText() {
        return 'L{exportingPage}';
    }

    //region State management

    async stateNextPage({ client }) {
        const { exportMeta } = this;

        ++exportMeta.currentPage;
        ++exportMeta.verticalPosition;

        delete exportMeta.lastExportedRowBottom;

        // If current vertical position is greater than max vertical pages, switch to next column
        if (exportMeta.verticalPosition >= exportMeta.verticalPages) {
            exportMeta.verticalPosition = exportMeta.currentPageTopMargin = 0;
            ++exportMeta.horizontalPosition;

            delete exportMeta.lastRowDataIndex;
            await this.scrollRowIntoView(client, exportMeta.firstVisibleDataIndex, { block : 'start' });
        }
    }

    //endregion

    //region Preparation

    async prepareComponent(config) {
        await super.prepareComponent(config);

        const
            me              = this,
            { exportMeta }  = me,
            {
                client,
                headerTpl,
                footerTpl,
                alignRows,
                rowsRange
            }               = config,
            paperFormat     = PaperFormat[config.paperFormat],
            isPortrait      = config.orientation === Orientation.portrait,
            paperWidth      = isPortrait ? paperFormat.width : paperFormat.height,
            paperHeight     = isPortrait ? paperFormat.height : paperFormat.width,
            pageWidth       = me.inchToPx(paperWidth),
            pageHeight      = me.inchToPx(paperHeight),
            horizontalPages = Math.ceil(exportMeta.totalWidth / pageWidth);

        // To estimate amount of pages correctly we need to know height of the header/footer on every page
        let contentHeight = pageHeight;

        if (headerTpl) {
            contentHeight -= me.measureElement(headerTpl({
                totalWidth  : exportMeta.totalWidth,
                totalPages  : -1,
                currentPage : -1
            }));
        }

        if (footerTpl) {
            contentHeight -= me.measureElement(footerTpl({
                totalWidth  : exportMeta.totalWidth,
                totalPages  : -1,
                currentPage : -1
            }));
        }

        let totalHeight, verticalPages, totalRows = client.store.count;

        if (rowsRange === RowsRange.visible) {
            totalRows = me.getVisibleRowsCount(client);

            totalHeight = exportMeta.totalHeight + client.height;
        }
        else {
            totalHeight = exportMeta.totalHeight + client.height - client.bodyHeight + client.scrollable.scrollHeight;
        }

        // alignRows config specifies if rows should be always fully visible. E.g. if row doesn't fit on the page, it goes
        // to the top of the next page
        if (alignRows && rowsRange !== RowsRange.visible) {
            // we need to estimate amount of vertical pages for case when we only put row on the page if it fits
            // first we need to know how much rows would fit one page, keeping in mind first page also contains header
            // This estimation is loose, because row height might differ much between pages
            const
                rowHeight       = client.rowManager.rowOffsetHeight,
                rowsOnFirstPage = Math.floor((contentHeight - client.headerHeight) / rowHeight),
                rowsPerPage     = Math.floor(contentHeight / rowHeight),
                remainingRows   = totalRows - rowsOnFirstPage;

            verticalPages = 1 + Math.ceil(remainingRows / rowsPerPage);
        }
        else {
            verticalPages = Math.ceil(totalHeight / contentHeight);
        }

        Object.assign(exportMeta, {
            paperWidth,
            paperHeight,
            pageWidth,
            pageHeight,
            horizontalPages,
            verticalPages,
            totalHeight,
            contentHeight,
            totalRows,
            totalPages           : horizontalPages * verticalPages,
            currentPage          : 0,
            verticalPosition     : 0,
            horizontalPosition   : 0,
            currentPageTopMargin : 0
        });

        this.adjustRowBuffer(client);
    }

    async restoreComponent(config) {
        await super.restoreComponent(config);

        this.restoreRowBuffer(config.client);
    }

    //endregion

    async buildPage(config) {
        const
            me             = this,
            { exportMeta } = me,
            {
                client,
                headerTpl,
                footerTpl,
                alignRows,
                rowsRange
            }              = config,
            {
                totalWidth,
                totalPages,
                currentPage,
                subGrids,
                currentPageTopMargin,
                verticalPosition,
                totalRows,
                lastRowDataIndex
            }              = exportMeta,
            { rowManager } = client,
            { rows }       = rowManager,
            onlyVisible    = rowsRange === RowsRange.visible,
            hasMergeCells  = client.hasActiveFeature('mergeCells');

        // Rows are stored in shared state object, need to clean it before exporting next page
        Object.values(subGrids).forEach(subGrid => subGrid.rows = []);

        // With variable row height total height might change after scroll, update it
        // to show content completely on the last page
        if (config.rowsRange === RowsRange.all) {
            exportMeta.totalHeight = client.height - client.bodyHeight + client.scrollable.scrollHeight - me.getVirtualScrollerHeight(client);
        }

        let headerHeight = 0,
            footerHeight = 0,
            remainingHeight, header, footer, index;

        if (onlyVisible && lastRowDataIndex != null) {
            if (lastRowDataIndex === rows[rows.length - 1].dataIndex) {
                index = rows.length - 1;
            }
            else {
                index = rows.findIndex(r => r.dataIndex === lastRowDataIndex);
            }
        }
        else {
            index = onlyVisible
                ? rows.findIndex(r => r.bottom > Math.ceil(client.scrollable.y))
                : rows.findIndex(r => r.bottom + currentPageTopMargin + client.headerHeight > 0);
        }

        const
            firstRowIndex     = index,
            // This is a portion of the row which is not visible, which means it shouldn't affect remaining height
            // Don't calculate for the first page
            overflowingHeight = (onlyVisible || verticalPosition === 0) ? 0 : rows[index].top + currentPageTopMargin + client.headerHeight;

        // Measure header and footer height
        if (headerTpl) {
            header = me.prepareHTML(headerTpl({
                totalWidth,
                totalPages,
                currentPage
            }));
            headerHeight = me.measureElement(header);
        }

        if (footerTpl) {
            footer = me.prepareHTML(footerTpl({
                totalWidth,
                totalPages,
                currentPage
            }));
            footerHeight = me.measureElement(footer);
        }

        // Calculate remaining height to fill with rows
        // remainingHeight is height of the page content region to fill. When next row is exported, this heights gets
        // reduced. Since top rows may be partially visible, it would lead to increasing error and eventually to incorrect
        // exported rows for the page
        remainingHeight = exportMeta.pageHeight - headerHeight - footerHeight - overflowingHeight;

        // first exported page container header
        if (verticalPosition === 0) {
            remainingHeight -= client.headerHeight;
        }

        // data index of the last collected row
        let lastDataIndex,
            offset = 0;

        while (remainingHeight > 0) {
            const row = rows[index];

            if (alignRows && remainingHeight < row.offsetHeight) {
                offset = -remainingHeight;
                remainingHeight = 0;
                // If we skip a row save its bottom to meta data in order to align canvases height
                // properly
                me.exportMeta.lastExportedRowBottom = rows[index - 1].bottom;
            }
            else {
                me.collectRow(row);

                remainingHeight -= row.offsetHeight;

                lastDataIndex = row.dataIndex;

                // Last row is processed, still need to fill the view
                if (++index === rows.length && remainingHeight > 0) {
                    remainingHeight = 0;
                }
                else if (onlyVisible && (index - firstRowIndex) === totalRows) {
                    remainingHeight = 0;
                }
            }
        }

        // Collect merged cells per subgrid
        if (hasMergeCells) {
            for (const subGridName in subGrids) {
                const
                    subGrid     = subGrids[subGridName],
                    mergedCells = client.subGrids[subGridName].element.querySelectorAll(`.b-grid-merged-cells`);

                subGrid.mergedCellsHtml = [];

                for (const mergedCell of mergedCells) {
                    subGrid.mergedCellsHtml.push(mergedCell.outerHTML);
                }
            }
        }

        const lastRow = rows[index - 1];

        if (lastRow) {
            // Calculate exact grid height according to the the last exported row
            exportMeta.exactGridHeight = lastRow.bottom + client.footerContainer.offsetHeight + client.headerContainer.offsetHeight;
            exportMeta.lastRowDataIndex = lastRow.dataIndex + 1;
        }

        await me.onRowsCollected(rows.slice(firstRowIndex, index), config);

        // No scrolling required if we are only exporting currently visible rows
        if (onlyVisible) {
            exportMeta.exactGridHeight -= exportMeta.scrollableTopMargin = client.scrollable.y;
        }
        else {
            // With variable row height row manager might relayout rows to fix position, moving them up or down.
            const detacher = rowManager.on('offsetrows', ({ offset : value }) => offset += value);

            await me.scrollRowIntoView(client, lastDataIndex + 1);

            detacher();
        }

        const html = me.buildPageHtml();

        return { html, header, footer, offset };
    }

    async onRowsCollected() {}

    collectRow(row) {
        const subGrids = this.exportMeta.subGrids;

        Object.entries(row.elements).forEach(([key, value]) => {
            subGrids[key].rows.push(value.outerHTML);
        });
    }

    buildPageHtml() {
        const
            me           = this,
            { subGrids } = me.exportMeta;

        // Now when rows are collected, we need to add them to exported grid
        let html = me.prepareExportElement();

        Object.values(subGrids).forEach(({ placeHolder, rows, mergedCellsHtml }) => {
            const placeHolderText = placeHolder.outerHTML;

            let contentHtml = rows.join('');

            if (mergedCellsHtml?.length) {
                contentHtml += `<div class="b-grid-merged-cells-container">${mergedCellsHtml.join('')}</div>`;
            }

            html = html.replace(placeHolderText, contentHtml);
        });

        return html;
    }

    prepareExportElement() {
        const
            me = this,
            { element, exportMeta } = me;

        if (exportMeta.scrollableTopMargin) {
            element.querySelector('.b-grid-vertical-scroller').style.marginTop = `-${exportMeta.scrollableTopMargin}px`;
        }

        return super.prepareExportElement();
    }
}

// HACK: terser/obfuscator doesn't yet support async generators, when processing code it converts async generator to regular async
// function.
MultiPageExporter.prototype.pagesExtractor = async function * pagesExtractor(config) {
    const
        me = this,
        {
            exportMeta,
            stylesheets
        }  = me,
        {
            totalWidth,
            totalPages,
            paperWidth,
            paperHeight,
            contentHeight
        }  = exportMeta;

    let currentPage;

    while ((currentPage = exportMeta.currentPage) < totalPages) {
        me.trigger('exportStep', { text : me.L(MultiPageExporter.exportingPageText, { currentPage, totalPages }), progress : Math.round(((currentPage + 1) / totalPages) * 90) });

        const { html, header, footer, offset } = await me.buildPage(config);

        // TotalHeight might change in case of variable row heights
        // Move exported content in the visible frame
        const styles = [
            ...stylesheets,
            `
                <style>
                    #${config.client.id} {
                        height: ${exportMeta.exactGridHeight}px !important;
                        width: ${totalWidth}px !important;
                    }
                    
                    .b-export-body .b-export-viewport {
                        margin-inline-start : ${-paperWidth * exportMeta.horizontalPosition}in;
                        margin-top  : ${exportMeta.currentPageTopMargin}px;
                    }
                </style>
            `];

        // when aligning rows, offset gets accumulated, so we need to take it into account
        exportMeta.currentPageTopMargin -= contentHeight + offset;

        await me.stateNextPage(config);

        yield {
            html : me.pageTpl({
                html,
                header,
                footer,
                styles,
                paperWidth,
                paperHeight
            })
        };
    }
};
