import LocaleManager from '../../Core/localization/LocaleManager.js';
//<umd>
import coreLocale from '../../Core/localization/En.js';
import LocaleHelper from '../../Core/localization/LocaleHelper.js';

const
    // This will be a truthy empty string so it can be used as a localized result.
    emptyString = new String(), // eslint-disable-line no-new-wrappers
    locale      = LocaleHelper.mergeLocales(coreLocale, {

        //region Features

        ColumnPicker : {
            column          : 'Column',
            columnsMenu     : 'Columns',
            hideColumn      : 'Hide column',
            hideColumnShort : 'Hide',
            newColumns      : 'New columns'
        },

        Filter : {
            applyFilter  : 'Apply filter',
            filter       : 'Filter',
            editFilter   : 'Edit filter',
            on           : 'On',
            before       : 'Before',
            after        : 'After',
            equals       : 'Equals',
            lessThan     : 'Less than',
            moreThan     : 'More than',
            removeFilter : 'Remove filter'
        },

        FilterBar : {
            enableFilterBar  : 'Show filter bar',
            disableFilterBar : 'Hide filter bar'
        },

        Group : {
            group                : 'Group',
            groupAscending       : 'Group ascending',
            groupDescending      : 'Group descending',
            groupAscendingShort  : 'Ascending',
            groupDescendingShort : 'Descending',
            stopGrouping         : 'Stop grouping',
            stopGroupingShort    : 'Stop'
        },

        HeaderMenu : {
            moveBefore : text => `Move before "${text}"`,
            moveAfter  : text => `Move after "${text}"`
        },

        MergeCells : {
            mergeCells  : 'Merge cells',
            menuTooltip : 'Merge cells with same value when sorted by this column'
        },

        Search : {
            searchForValue : 'Search for value'
        },

        Sort : {
            sort                   : 'Sort',
            sortAscending          : 'Sort ascending',
            sortDescending         : 'Sort descending',
            multiSort              : 'Multi sort',
            removeSorter           : 'Remove sorter',
            addSortAscending       : 'Add ascending sorter',
            addSortDescending      : 'Add descending sorter',
            toggleSortAscending    : 'Change to ascending',
            toggleSortDescending   : 'Change to descending',
            sortAscendingShort     : 'Ascending',
            sortDescendingShort    : 'Descending',
            removeSorterShort      : 'Remove',
            addSortAscendingShort  : '+ Ascending',
            addSortDescendingShort : '+ Descending'
        },

        //endregion

        //region Grid

        Column : {
            columnLabel : column => `${column.text ? `${column.text} column. ` : ''}SPACE for context menu${column.sortable ? ', ENTER to sort' : ''}`,
            cellLabel   : emptyString
        },

        Checkbox : {
            toggleRowSelect : 'Toggle row selection',
            toggleSelection : 'Toggle selection of entire dataset'
        },

        RatingColumn : {
            cellLabel : column => `${column.text ? column.text : ''} ${column.location?.record ? `rating : ${column.location.record[column.field] || 0}` : ''}`
        },

        GridBase : {
            loadFailedMessage  : 'Data loading failed!',
            syncFailedMessage  : 'Data synchronization failed!',
            unspecifiedFailure : 'Unspecified failure',
            networkFailure     : 'Network error',
            parseFailure       : 'Failed to parse server response',
            serverResponse     : 'Server response:',
            noRows             : 'No records to display',
            moveColumnLeft     : 'Move to left section',
            moveColumnRight    : 'Move to right section',
            moveColumnTo       : region => `Move column to ${region}`
        },

        CellMenu : {
            removeRow : 'Delete'
        },

        RowCopyPaste : {
            copyRecord  : 'Copy',
            cutRecord   : 'Cut',
            pasteRecord : 'Paste'
        },

        //endregion

        //region Export

        PdfExport : {
            'Waiting for response from server' : 'Waiting for response from server...',
            'Export failed'                    : 'Export failed',
            'Server error'                     : 'Server error',
            'Generating pages'                 : 'Generating pages...',
            'Click to abort'                   : 'Abort'
        },

        ExportDialog : {
            width          : '40em',
            labelWidth     : '12em',
            exportSettings : 'Export settings',
            export         : 'Export',
            exporterType   : 'Control pagination',
            cancel         : 'Cancel',
            fileFormat     : 'File format',
            rows           : 'Rows',
            alignRows      : 'Align rows',
            columns        : 'Columns',
            paperFormat    : 'Paper format',
            orientation    : 'Orientation',
            repeatHeader   : 'Repeat header'
        },

        ExportRowsCombo : {
            all     : 'All rows',
            visible : 'Visible rows'
        },

        ExportOrientationCombo : {
            portrait  : 'Portrait',
            landscape : 'Landscape'
        },

        SinglePageExporter : {
            singlepage : 'Single page'
        },

        MultiPageExporter : {
            multipage     : 'Multiple pages',
            exportingPage : ({ currentPage, totalPages }) => `Exporting page ${currentPage}/${totalPages}`
        },

        MultiPageVerticalExporter : {
            multipagevertical : 'Multiple pages (vertical)',
            exportingPage     : ({ currentPage, totalPages }) => `Exporting page ${currentPage}/${totalPages}`
        },

        RowExpander : {
            'loading' : 'Loading'
        }

    //endregion
    });

export default locale;
//</umd>

LocaleManager.registerLocale('En', { desc : 'English', locale : locale });
