import LocaleManager from '../../Core/localization/LocaleManager.js';
//<umd>
import parentLocale from '../../Core/localization/Ru.js';
import LocaleHelper from '../../Core/localization/LocaleHelper.js';

const
    // This will be a truthy empty string so it can be used as a localized result.
    emptyString = new String(), // eslint-disable-line no-new-wrappers
    locale      = LocaleHelper.mergeLocales(parentLocale, {

        //region Features

        ColumnPicker : {
            column          : 'Колонка',
            columnsMenu     : 'Колонки',
            hideColumn      : 'Спрятать колонку',
            hideColumnShort : 'Спрятать',
            newColumns      : 'Новые столбцы'
        },

        Filter : {
            applyFilter  : 'Применить фильтр',
            filter       : 'Фильтр',
            editFilter   : 'Изменить фильтр',
            on           : 'В этот день',
            before       : 'До',
            after        : 'После',
            equals       : 'Равно',
            lessThan     : 'Меньше, чем',
            moreThan     : 'Больше, чем',
            removeFilter : 'Убрать фильтр'
        },

        FilterBar : {
            enableFilterBar  : 'Показать панель фильтров',
            disableFilterBar : 'Спрятать панель фильтров'
        },

        Group : {
            group                : 'Группа',
            groupAscending       : 'Группа по возрастанию',
            groupDescending      : 'Группа по убыванию',
            groupAscendingShort  : 'Возрастание',
            groupDescendingShort : 'Убывание',
            stopGrouping         : 'Убрать группу',
            stopGroupingShort    : 'Убрать'
        },

        MergeCells : {
            mergeCells  : 'Объединить ячейки',
            menuTooltip : 'Объединить ячейки с одинаковыми значениями при сортировке по этому столбцу'
        },

        HeaderMenu : {
            moveBefore : text => `Расположить перед "${text}"`,
            moveAfter  : text => `Расположить после "${text}"`
        },

        Search : {
            searchForValue : 'Найти значение'
        },

        Sort : {
            sort                   : 'Сортировка',
            sortAscending          : 'Сортировать по возрастанию',
            sortDescending         : 'Сортировать по убыванию',
            multiSort              : 'Сложная сортировка',
            removeSorter           : 'Убрать сортировку',
            addSortAscending       : 'Добавить сортировку по возрастанию',
            addSortDescending      : 'Добавить сортировку по убыванию',
            toggleSortAscending    : 'Сортировать по возрастанию',
            toggleSortDescending   : 'Сортировать по убыванию',
            sortAscendingShort     : 'Возрастание',
            sortDescendingShort    : 'Убывание',
            removeSorterShort      : 'Убрать',
            addSortAscendingShort  : '+ Возраст...',
            addSortDescendingShort : '+ Убыв...'

        },

        //endregion

        //region Grid

        Column : {
            columnLabel : column => `${column.text ? `${column.text} столбец. ` : ''}ПРОБЕЛ для контекстного меню${column.sortable ? ', ENTER для сортировки' : ''}`,
            cellLabel   : emptyString
        },

        Checkbox : {
            toggleRowSelect : 'Переключить выделение строки',
            toggleSelection : 'Переключить выбор всего набора данных'
        },

        RatingColumn : {
            cellLabel : column => `${column.text ? column.text : ''} ${column.location?.record ? `rating : ${column.location.record[column.field]} || 0` : ''}`
        },

        GridBase : {
            loadFailedMessage  : 'Не удалось загрузить!',
            syncFailedMessage  : 'Не удалось синхронизировать!',
            unspecifiedFailure : 'Неуказанная ошибка',
            networkFailure     : 'Ошибка сети',
            parseFailure       : 'Не удалось разобрать ответ сервера',
            serverResponse     : 'Ответ сервера:',
            noRows             : 'Нет записей для отображения',
            moveColumnLeft     : 'Передвинуть в левую секцию',
            moveColumnRight    : 'Передвинуть в правую секцию',
            moveColumnTo       : region => `Переместить колонку в секцию ${region}`
        },

        CellMenu : {
            removeRow : 'Удалить'
        },

        RowCopyPaste : {
            copyRecord  : 'Копировать',
            cutRecord   : 'Вырезать',
            pasteRecord : 'Вставить'
        },

        //endregion

        //region Export

        PdfExport : {
            'Waiting for response from server' : 'Ожидание ответа от сервера...',
            'Export failed'                    : 'Не удалось экспортировать',
            'Server error'                     : 'На сервере произошла ошибка',
            'Generating pages'                 : 'Генерация страниц...',
            'Click to abort'                   : 'Отмена'
        },

        ExportDialog : {
            width          : '40em',
            labelWidth     : '13em',
            exportSettings : 'Настройки',
            export         : 'Экспорт',
            exporterType   : 'Разбивка на страницы',
            cancel         : 'Отмена',
            fileFormat     : 'Формат файла',
            rows           : 'Строки',
            alignRows      : 'Выровнять строки',
            columns        : 'Колонки',
            paperFormat    : 'Размер листа',
            orientation    : 'Ориентация',
            repeatHeader   : 'Повторять заголовок'
        },

        ExportRowsCombo : {
            all     : 'Все строки',
            visible : 'Видимые строки'
        },

        ExportOrientationCombo : {
            portrait  : 'Портретная',
            landscape : 'Ландшафтная'
        },

        SinglePageExporter : {
            singlepage : 'Одна страница'
        },

        MultiPageExporter : {
            multipage     : 'Многостраничный',
            exportingPage : ({ currentPage, totalPages }) => `Экспорт страницы ${currentPage}/${totalPages}`
        },

        MultiPageVerticalExporter : {
            multipagevertical : 'Многостраничный (по вертикали)',
            exportingPage     : ({ currentPage, totalPages }) => `Экспорт страницы ${currentPage}/${totalPages}`
        },

        RowExpander : {
            'loading' : 'Загрузка'
        }

    //endregion
    });

export default locale;
//</umd>

LocaleManager.registerLocale('Ru', { desc : 'Русский', locale : locale });
