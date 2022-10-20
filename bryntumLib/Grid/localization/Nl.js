import LocaleManager from '../../Core/localization/LocaleManager.js';
//<umd>
import parentLocale from '../../Core/localization/Nl.js';
import LocaleHelper from '../../Core/localization/LocaleHelper.js';

const
    // This will be a truthy empty string so it can be used as a localized result.
    emptyString = new String(), // eslint-disable-line no-new-wrappers
    locale      = LocaleHelper.mergeLocales(parentLocale, {

        //region Features

        ColumnPicker : {
            column          : 'Kolom',
            columnsMenu     : 'Kolommen',
            hideColumn      : 'Verberg Kolom',
            hideColumnShort : 'Verberg',
            newColumns      : 'Nieuwe kolommen'
        },

        Filter : {
            applyFilter  : 'Pas filter toe',
            filter       : 'Filter',
            editFilter   : 'Wijzig filter',
            on           : 'Aan',
            before       : 'Voor',
            after        : 'Na',
            equals       : 'Is gelijk',
            lessThan     : 'Minder dan',
            moreThan     : 'Meer dan',
            removeFilter : 'Verwijder filter'
        },

        FilterBar : {
            enableFilterBar  : 'Maak filterbalk zichtbaar',
            disableFilterBar : 'Verberg filterbalk'
        },

        Group : {
            group                : 'Groepeer',
            groupAscending       : 'Groepeer oplopend',
            groupDescending      : 'Groepeer aflopend',
            groupAscendingShort  : 'Oplopend',
            groupDescendingShort : 'Aflopend',
            stopGrouping         : 'Maak groepering ongedaan',
            stopGroupingShort    : 'Maak ongedaan'
        },

        MergeCells : {
            mergeCells  : 'Cellen samenvoegen',
            menuTooltip : 'Met deze kolom sortering cellen met dezelfde waarde samenvoegen'
        },

        HeaderMenu : {
            moveBefore : text => `Verplaatsen naar voor "${text}"`,
            moveAfter  : text => `Verplaatsen naar na "${text}"`
        },

        Search : {
            searchForValue : 'Zoek op term'
        },

        Sort : {
            sort                   : 'Sorteer',
            sortAscending          : 'Sorteer oplopend',
            sortDescending         : 'Sorteer aflopend',
            multiSort              : 'Meerdere sorteringen',
            removeSorter           : 'Verwijder sortering',
            addSortAscending       : 'Voeg oplopende sortering toe',
            addSortDescending      : 'Voeg aflopende sortering toe',
            toggleSortAscending    : 'Sorteer oplopend',
            toggleSortDescending   : 'Sorteer aflopend',
            sortAscendingShort     : 'Oplopend',
            sortDescendingShort    : 'Aflopend',
            removeSorterShort      : 'Verwijder',
            addSortAscendingShort  : '+ Oplopend',
            addSortDescendingShort : '+ Aflopend'
        },

        //endregion

        //region Grid

        Column : {
            columnLabel : column => `${column.text ? `${column.text} kolom. ` : ''}SPATIEBALK voor contextmenu${column.sortable ? ', ENTER om te sorteren' : ''}`,
            cellLabel   : emptyString
        },

        Checkbox : {
            toggleRowSelect : 'Rijselectie wisselen',
            toggleSelection : 'Toggle selectie van volledige dataset'
        },

        RatingColumn : {
            cellLabel : column => `${column.text ? column.text : ''} ${column.location?.record ? `rating : ${column.location.record[column.field] || 0}` : ''}`
        },

        GridBase : {
            loadFailedMessage  : 'Laden mislukt!',
            syncFailedMessage  : 'Gegevenssynchronisatie is mislukt!',
            unspecifiedFailure : 'Niet-gespecificeerde fout',
            networkFailure     : 'Netwerk fout',
            parseFailure       : 'Kan server response niet parsen',
            serverResponse     : 'Server reactie:',
            noRows             : 'Geen rijen om weer te geven',
            moveColumnLeft     : 'Plaats naar het linker kader',
            moveColumnRight    : 'Plaats naar het rechter kader',
            moveColumnTo       : region => `Kolom verplaatsen naar ${region}`
        },

        CellMenu : {
            removeRow : 'Verwijder'
        },

        RowCopyPaste : {
            copyRecord  : 'Kopieer',
            cutRecord   : 'Knip',
            pasteRecord : 'Plak'
        },

        //endregion

        //region Export

        PdfExport : {
            'Waiting for response from server' : 'Wachten op antwoord van server...',
            'Export failed'                    : 'Export mislukt',
            'Server error'                     : 'Serverfout',
            'Generating pages'                 : 'Pagina\'s genereren...',
            'Click to abort'                   : 'Annuleer'
        },

        ExportDialog : {
            width          : '40em',
            labelWidth     : '12em',
            exportSettings : 'Instellingen exporteren',
            export         : 'Exporteren',
            exporterType   : 'Paginering beheren',
            cancel         : 'Annuleren',
            fileFormat     : 'Bestandsformaat',
            rows           : 'Rijen',
            alignRows      : 'Rijen uitlijnen',
            columns        : 'Kolommen',
            paperFormat    : 'Papier formaat',
            orientation    : 'Oriëntatatie',
            repeatHeader   : 'Herhaal koptekst'
        },

        ExportRowsCombo : {
            all     : 'Alle rijen',
            visible : 'Zichtbare rijen'
        },

        ExportOrientationCombo : {
            portrait  : 'Staand',
            landscape : 'Liggend'
        },

        SinglePageExporter : {
            singlepage : 'Enkele pagina'
        },

        MultiPageExporter : {
            multipage     : 'Meerdere pagina\'s',
            exportingPage : ({ currentPage, totalPages }) => `Exporteren van de pagina ${currentPage}/${totalPages}`
        },

        MultiPageVerticalExporter : {
            multipagevertical : 'Meerdere pagina\'s (verticaal)',
            exportingPage     : ({ currentPage, totalPages }) => `Exporteren van de pagina ${currentPage}/${totalPages}`
        },

        RowExpander : {
            'loading' : 'Bezig met laden'
        }

    //endregion
    });

export default locale;
//</umd>

LocaleManager.registerLocale('Nl', { desc : 'Nederlands', locale : locale });
