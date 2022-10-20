import Toolbar from './Toolbar.js';

/**
 * @module Core/widget/PagingToolbar
 */

/**
 * A special Toolbar class, which, when attached to an {@link Core.data.AjaxStore}, which has been configured to be
 * {@link Core.data.AjaxStore#property-isPaged paged}, controls the loading of that store to page through the data set.
 *
 * ```javascript
 * new Grid({
 *      bbar : {
 *          type  : 'pagingtoolbar'
 *      }
 * });
 * ```
 *
 * {@inlineexample Core/widget/PagingToolbar.js}
 *
 * ### Default toolbar items
 *
 * The toolbar provides some default buttons and other items as described below:
 *
 * | Reference              | Weight | Description                                              |
 * |------------------------|--------|---------------------------------------------------------|
 * | `firstPageButton`      | 100    | Go to first page                                        |
 * | `previousPageButton`   | 110    | Go to previous page                                     |
 * | `pageNumber`           | 120    | TextCurrent page number                                 |
 * | `pageCount`            | 130    | Label showing number of pages                           |
 * | `nextPageButton`       | 140    | Go to next page                                         |
 * | `lastPageButton`       | 150    | Go to last page                                         |
 * | `reloadButton`         | 160    | Reload data                                             |
 * | `dataSummary`          | 170    | Summary text                                            |
 *
 * ### Customizing the toolbar items
 *
 * The toolbar items can be customized, existing items can be changed or removed,
 * and new items can be added. This is handled using the {@link #config-items} config.
 *
 * Adding additional buttons or widgets to the paging toolbar can be done like so:
 *
 * ```javascript
 * bbar : {
 *     type  : 'pagingtoolbar',
 *     items : {
 *         click : {
 *             type : 'button',
 *             text : 'Click me',
 *             weight : 175 // Add after last item
 *         }
 *     }
 * }
 * ```
 *
 * @demo Grid/paged
 * @extends Core/widget/Toolbar
 * @classType pagingtoolbar
 */
export default class PagingToolbar extends Toolbar {
    static get $name() {
        return 'PagingToolbar';
    }

    // Factoryable type name
    static get type() {
        return 'pagingtoolbar';
    }

    static get defaultConfig() {
        return {
            /**
             * The {@link Core.data.AjaxStore AjaxStore} that this PagingToolbar is to control.
             * @config {Core.data.AjaxStore}
             */
            store : null,

            defaults : {
                localeClass : this
            },

            items : {
                firstPageButton : {
                    onClick : 'up.onFirstPageClick',
                    icon    : 'b-icon-first',
                    weight  : 100,
                    tooltip : 'L{PagingToolbar.firstPage}'
                },
                previousPageButton : {
                    onClick : 'up.onPreviousPageClick',
                    icon    : 'b-icon-previous',
                    weight  : 110,
                    tooltip : 'L{PagingToolbar.prevPage}'
                },
                pageNumber : {
                    type                    : 'numberfield',
                    label                   : 'L{page}',
                    min                     : 1,
                    max                     : 1,
                    triggers                : null,
                    onChange                : 'up.onPageNumberChange',
                    highlightExternalChange : false,
                    weight                  : 120
                },
                pageCount : {
                    type   : 'widget',
                    cls    : 'b-pagecount b-toolbar-text',
                    weight : 130
                },
                nextPageButton : {
                    onClick : 'up.onNextPageClick',
                    icon    : 'b-icon-next',
                    weight  : 140,
                    tooltip : 'L{PagingToolbar.nextPage}'
                },
                lastPageButton : {
                    onClick : 'up.onLastPageClick',
                    icon    : 'b-icon-last',
                    weight  : 150,
                    tooltip : 'L{PagingToolbar.lastPage}'
                },
                separator : {
                    type   : 'widget',
                    cls    : 'b-toolbar-separator',
                    weight : 151
                },
                reloadButton : {
                    onClick : 'up.onReloadClick',
                    icon    : 'b-icon-reload',
                    weight  : 160,
                    tooltip : 'L{PagingToolbar.reload}'
                },
                spacer : {
                    type   : 'widget',
                    cls    : 'b-toolbar-fill',
                    weight : 161
                },
                dataSummary : {
                    type   : 'widget',
                    cls    : 'b-toolbar-text',
                    weight : 170
                }
            }
        };
    }

    // Retrieve store from grid when "assigned" to it
    set parent(parent) {
        super.parent = parent;

        if (!this.store) {
            this.store = parent.store;
        }
    }

    get parent() {
        return super.parent;
    }

    set store(store) {
        const me = this;

        me.detachListeners('store');

        me._store = store;

        if (store) {
            store.on({
                name          : 'store',
                beforerequest : 'onStoreBeforeRequest',
                afterrequest  : 'onStoreChange',
                change        : 'onStoreChange',
                thisObj       : me
            });

            if (store.isLoading) {
                me.onStoreBeforeRequest();
            }
        }
    }

    get store() {
        return this._store;
    }

    onStoreBeforeRequest() {
        this.eachWidget(w => w.disable());
    }

    updateLocalization() {
        this.updateSummary();

        super.updateLocalization();
    }

    updateSummary() {
        const
            me                         = this,
            { pageCount, dataSummary } = me.widgetMap;

        let count = 0, lastPage = 0, start = 0, end = 0, allCount = 0;

        if (me.store) {
            const
                { store }                 = me,
                { pageSize, currentPage } = store;

            count = store.count;
            lastPage = store.lastPage;
            allCount = store.allCount;

            start = Math.max(0, (currentPage - 1) * pageSize + 1);
            end = Math.min(allCount, start + pageSize - 1);
        }

        pageCount.html = me.L('L{pageCountTemplate}')({ lastPage });
        dataSummary.html = count ? me.L('L{summaryTemplate}')({ start, end, allCount }) : me.L('L{noRecords}');
    }

    onStoreChange() {
        const
            me                               = this,
            { widgetMap, store }             = me,
            { count, lastPage, currentPage } = store,
            {
                pageNumber,
                pageCount,
                firstPageButton,
                previousPageButton,
                nextPageButton,
                lastPageButton,
                dataSummary
            }                                = widgetMap;

        me.eachWidget(w => w.enable());

        pageNumber.value = currentPage;
        pageNumber.max = lastPage;

        dataSummary.disabled = pageNumber.disabled = pageCount.disabled = !count;
        firstPageButton.disabled = previousPageButton.disabled = currentPage <= 1 || !count;
        nextPageButton.disabled = lastPageButton.disabled = currentPage >= lastPage || !count;

        me.updateSummary();
    }

    onPageNumberChange({ value }) {
        if (this.store.currentPage !== value) {
            this.store.loadPage(value);
        }
    }

    onFirstPageClick() {
        this.store.loadPage(1);
    }

    onPreviousPageClick() {
        this.store.previousPage();
    }

    onNextPageClick() {
        this.store.nextPage();
    }

    onLastPageClick() {
        this.store.loadPage(this.store.lastPage);
    }

    onReloadClick() {
        this.store.loadPage(this.store.currentPage);
    }
}

// Register this widget type with its Factory
PagingToolbar.initClass();
