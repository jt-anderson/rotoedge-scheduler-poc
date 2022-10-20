import Widget from '../../Core/widget/Widget.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import DomSync from '../../Core/helper/DomSync.js';
import EventHelper from '../../Core/helper/EventHelper.js';
import DomClassList from '../../Core/helper/util/DomClassList.js';
import StringHelper from '../../Core/helper/StringHelper.js';
import AvatarRendering from '../../Core/widget/util/AvatarRendering.js';

/**
 * @module Scheduler/view/ResourceHeader
 */

/**
 * Header widget that renders resource column headers and acts as the interaction point for resource columns in vertical
 * mode. Note that it uses virtual rendering and element reusage to gain performance, only headers in view are available
 * in DOM. Because of this you should avoid direct element manipulation, any such changes can be discarded at any time.
 *
 * By default it displays resources `name` and also applies its `iconCls` if any, like this:
 *
 * ```
 * <i class="iconCls">name</i>
 * ```
 *
 * If Scheduler is configured with a {@link Scheduler.view.mixin.SchedulerEventRendering#config-resourceImagePath} the
 * header will render miniatures for the resources, using {@link Scheduler.model.mixin.ResourceModelMixin#field-imageUrl} or {@link Scheduler.model.mixin.ResourceModelMixin#field-image} with
 * fallback to {@link Scheduler.model.mixin.ResourceModelMixin#field-name} + {@link Scheduler.view.mixin.SchedulerEventRendering#config-resourceImageExtension} for unset values.
 *
 * The contents and styling of the resource cells in the header can be customized using {@link #config-headerRenderer}:
 *
 * ```
 * new Scheduler({
 *     mode            : 'vertical',
 *     resourceColumns : {
 *         headerRenderer : ({ resourceRecord }) => `Hello ${resourceRecord.name}`
 *     }
 * }
 *```
 *
 * The width of the resource columns is determined by the {@link #config-columnWidth} config.
 *
 * @extends Core/widget/Widget
 */
export default class ResourceHeader extends Widget {

    //region Config

    static get $name() {
        return 'ResourceHeader';
    }

    static get type() {
        return 'resourceheader';
    }

    static get defaultConfig() {
        return {
            /**
             * Resource store used to render resource headers. Assigned from Scheduler.
             * @config {Scheduler.data.ResourceStore}
             * @private
             */
            resourceStore : null,

            /**
             * Custom header renderer function. Can be used to manipulate the element config used to create the element
             * for the header:
             *
             * ```
             * new Scheduler({
             *   resourceColumns : {
             *     headerRenderer({ elementConfig, resourceRecord }) {
             *       elementConfig.dataset.myExtraData = 'extra';
             *       elementConfig.style.fontWeight = 'bold';
             *     }
             *   }
             * });
             * ```
             *
             * See {@link Core.helper.DomHelper#function-createElement-static DomHelper#createElement()} for more information.
             * Please take care to not break the default configs :)
             *
             * Or as a template by returning HTML from the function:
             *
             * ```
             * new Scheduler({
             *   resourceColumns : {
             *     headerRenderer : ({ resourceRecord }) => `
             *       <div class="my-custom-template">
             *       ${resourceRecord.firstName} {resourceRecord.surname}
             *       </div>
             *     `
             *   }
             * });
             * ```
             *
             * NOTE: When using `headerRenderer` no default internal markup is applied to the resource header cell,
             * `iconCls` and {@link Scheduler.model.mixin.ResourceModelMixin#field-imageUrl} or {@link Scheduler.model.mixin.ResourceModelMixin#field-image}
             * will have no effect unless you supply custom markup for them.
             *
             * @config {Function}
             * @param {Object} params Object containing the params below
             * @param {Scheduler.model.ResourceModel} resourceRecord Resource whose header is being rendered
             * @param {DomConfig} elementConfig A {@link Core.helper.DomHelper#function-createElement-static} config
             * object used to create the element for the resource
             */
            headerRenderer : null,

            // Copied from Scheduler#resourceImagePath on creation in TimeAxisColumn.js
            imagePath : null,

            // Copied from Scheduler#resourceImageExtension on creation in TimeAxisColumn.js
            imageExtension : null,

            // Copied from Scheduler#defaultResourceImageName on creation in TimeAxisColumn.js
            defaultImageName : null
        };
    }

    static get configurable() {
        return {
            /**
             * Set to `false` to render just the resource name, `true` to render an avatar (or initials if no image exists)
             * @config {Boolean}
             * @default true
             */
            showAvatars : {
                value : true,

                $config : 'nullify'
            },

            /**
             * Assign to toggle resource columns **fill* mode. `true` means they will stretch (grow) to fill viewport, `false`
             * that they will respect their configured `columnWidth`.
             *
             * This is ignored if *any* resources are loaded with {@link Scheduler.model.ResourceModel#field-columnWidth}.
             * @member {Boolean} fillWidth
             */
            /**
             * Automatically resize resource columns to **fill** available width. Set to `false` to always respect the
             * configured `columnWidth`.
             *
             * This is ignored if *any* resources are loaded with {@link Scheduler.model.ResourceModel#field-columnWidth}.
             * @config {Boolean}
             * @default
             */
            fillWidth : true,

            /**
             * Assign to toggle resource columns **fit* mode. `true` means they will grow or shrink to always fit viewport,
             * `false` that they will respect their configured `columnWidth`.
             *
             * This is ignored if *any* resources are loaded with {@link Scheduler.model.ResourceModel#field-columnWidth}.
             * @member {Boolean} fitWidth
             */
            /**
             * Automatically resize resource columns to always **fit** available width.
             *
             * This is ignored if *any* resources are loaded with {@link Scheduler.model.ResourceModel#field-columnWidth}.
             * @config {Boolean}
             * @default
             */
            fitWidth : false,

            /**
             * Width for each resource column.
             *
             * This is used for resources which are not are loaded with a {@link Scheduler.model.ResourceModel#field-columnWidth}.
             * @config {Number}
             */
            columnWidth : 150
        };
    }

    static get properties() {
        return {
            /**
             * An index of the first visible resource in vertical mode
             * @property {Number}
             * @readonly
             * @private
             */
            firstResource : -1,
            /**
             * An index of the last visible resource in vertical mode
             * @property {Number}
             * @readonly
             * @private
             */
            lastResource  : -1
        };
    }

    //endregion

    //region Init

    construct(config) {
        const me = this;

        // Inject this into owning Scheduler early because code further down
        // can call code which uses scheduler.resourceColumns.
        config.scheduler._resourceColumns = me;

        super.construct(config);

        if (me.imagePath != null) {
            // Need to increase height a bit when displaying images
            me.element.classList.add('b-has-images');
        }

        EventHelper.on({
            element     : me.element,
            delegate    : '.b-resourceheader-cell',
            capture     : true,
            click       : 'onResourceMouseEvent',
            dblclick    : 'onResourceMouseEvent',
            contextmenu : 'onResourceMouseEvent',
            thisObj     : me
        });
    }

    changeShowAvatars(show) {
        this.avatarRendering?.destroy();

        if (show) {
            this.avatarRendering = new AvatarRendering({
                element : this.element
            });
        }

        return show;
    }

    updateShowAvatars() {
        if (!this.isConfiguring) {
            this.refresh();
        }
    }

    //endregion

    //region ResourceStore

    set resourceStore(store) {
        const me = this;

        if (store !== me._resourceStore) {
            me.resourceStoreDetacher?.();

            me._resourceStore = store;

            me.resourceStoreDetacher = store.on({
                changePreCommit : 'onResourceStoreDataChange',
                thisObj         : me
            });

            // Already have data? Update width etc
            if (store.count) {
                me.onResourceStoreDataChange({});
            }
        }
    }

    get resourceStore() {
        return this._resourceStore;
    }

    // Redraw resource headers on any data change
    onResourceStoreDataChange({ action }) {
        // These must be ingested before we assess the source of column widths
        // so that they can be cleared *after* their values have been cached.
        this.getConfig('fillWidth');
        this.getConfig('fitWidth');

        const
            me             = this,
            {
                element,
                resourceStore
            }              = me,
            width          = resourceStore.getTotalWidth(me.scheduler);

        // If we have some defined columnWidths in the resourceStore
        // we must then bypass configured fitWidth and fillWidth behaviour.
        if (me.scheduler.variableColumnWidths) {
            me._fillWidth = me._fitWidth = false;
        }
        else {
            me._fillWidth = me.configuredFillWidth;
            me._fitWidth = me.configuredFitWidth;
        }

        if (width !== me.width) {
            DomHelper.setLength(element, 'width', width);
            // During setup, silently set the width. It will then render correctly. After setup, let the world know...
            me.column.set('width', width, me.column.grid.isConfiguring);
        }

        if (action === 'removeall') {
            // Keep nothing
            element.innerHTML = '';
        }

        if (action === 'remove' || action === 'add' || action === 'filter' || me.fitWidth || me.fillWidth) {
            me.refreshWidths();
        }

        me.column.grid.toggleEmptyText();
    }

    //endregion

    //region Properties

    changeColumnWidth(columnWidth) {
        // Cache configured value, because if *all* resources have their own columnWidths
        // the property will be nulled, but if we ever recieve a new resource with no
        // columnWidth, or a columnWidth is nulled, we then have to fall back to using this.
        if (!this.refreshingWidths) {
            this.configuredColumnWidth = columnWidth;
        }
        return columnWidth;
    }

    updateColumnWidth(width, oldWidth) {
        const me = this;

        // Flag set in refreshWidths, do not want to create a loop
        if (!me.refreshingWidths) {
            me.refreshWidths();
        }

        if (!me.isConfiguring) {
            me.refresh();
            // Cannot trigger with requested width, might have changed because of fit/fill
            me.trigger('columnWidthChange', { width, oldWidth });
        }
    }

    changeFillWidth(fillWidth) {
        return this.configuredFillWidth = fillWidth;
    }

    updateFillWidth() {
        if (!this.isConfiguring) {
            this.refreshWidths();
        }
    }

    changeFitWidth(fitWidth) {
        return this.configuredFitWidth = fitWidth;
    }

    updateFitWidth() {
        if (!this.isConfiguring) {
            this.refreshWidths();
        }
    }

    getImageURL(imageName) {
        return StringHelper.joinPaths([this.imagePath || '', imageName || '']);
    }

    get imagePath() {
        return this._imagePath;
    }

    set imagePath(path) {
        this._imagePath = path;

        this.refresh();
    }

    //endregion

    //region Fit to width

    get availableWidth() {
        return this._availableWidth;
    }

    set availableWidth(width) {
        this._availableWidth = width;

        this.refreshWidths();
    }

    // Updates the column widths according to fill and fit settings
    refreshWidths() {
        const
            me    = this,
            {
                availableWidth,
                configuredColumnWidth
            }     = me,
            count = me.resourceStore?.count;

        // Bail out if availableWidth not yet set or resource store not assigned/loaded
        // or column widths are defined in the resources.
        if (!availableWidth || !count || me.scheduler.variableColumnWidths) {
            return;
        }

        me.refreshingWidths = true;

        const
            // Fit width if configured to do so or if configured to fill and used width is less than available width
            fit           = me.fitWidth || me.fillWidth && configuredColumnWidth * count < availableWidth,
            useWidth      = fit ? Math.floor(availableWidth / count) : configuredColumnWidth,
            shouldAnimate = me.column.grid.enableEventAnimations && Math.abs(me._columnWidth - useWidth) > 30;

        DomHelper.addTemporaryClass(me.element, 'b-animating', shouldAnimate ? 300 : 0, me);

        me.columnWidth = useWidth;

        me.refreshingWidths = false;
    }

    //endregion

    //region Rendering

    // Visual resource range, set by VerticalRendering + its buffer
    set visibleResources({ firstResource, lastResource }) {
        this.firstResource = firstResource;
        this.lastResource = lastResource;

        this.refresh();
    }

    /**
     * Refreshes the visible headers
     */
    refresh() {
        const
            me      = this,
            {
                firstResource,
                lastResource,
                scheduler
            }       = me,
            {
                variableColumnWidths
            }       = scheduler,
            configs = [];

        if (!me.column.grid.isConfiguring && firstResource > -1 && lastResource > -1 && lastResource < me.resourceStore.count) {
            // Gather element configs for resource headers in view
            for (let i = firstResource; i <= lastResource; i++) {
                const
                    resourceRecord = me.resourceStore.getAt(i),
                    instanceMeta   = resourceRecord.instanceMeta(scheduler),
                    // Possible variable column width taken from the resources, fallback to scheduler's default
                    width          = resourceRecord.columnWidth || me.columnWidth,
                    elementConfig  = {
                        // Might look like overkill to use DomClassList here, but can be used in headerRenderer
                        className : new DomClassList({
                            'b-resourceheader-cell' : 1
                        }),
                        dataset : {
                            resourceId : resourceRecord.id
                        },
                        style : {
                            [scheduler.rtl ? 'right' : 'left'] : variableColumnWidths ? instanceMeta.insetStart : i * me.columnWidth,
                            width
                        },
                        children : []
                    };

                // Let a configured headerRenderer have a go at it before applying
                if (me.headerRenderer) {
                    const value = me.headerRenderer({ elementConfig, resourceRecord });

                    if (value != null) {
                        elementConfig.html = value;
                    }
                }
                // No headerRenderer, apply default markup
                else {
                    let imageUrl;

                    if (resourceRecord.imageUrl) {
                        imageUrl = resourceRecord.imageUrl;
                    }
                    else {
                        if (me.imagePath != null) {
                            if (resourceRecord.image !== false) {
                                const imageName = resourceRecord.image ||
                                    resourceRecord.name?.toLowerCase() + me.imageExtension;
                                imageUrl = me.getImageURL(imageName);
                            }
                        }
                    }

                    // By default showing resource name and optionally avatar
                    elementConfig.children.push(
                        me.showAvatars && me.avatarRendering.getResourceAvatar({
                            resourceRecord,
                            initials        : resourceRecord.initials,
                            color           : resourceRecord.eventColor,
                            iconCls         : resourceRecord.iconCls,
                            defaultImageUrl : me.defaultImageName && me.getImageURL(me.defaultImageName),
                            imageUrl
                        }),
                        {
                            tag       : 'span',
                            className : 'b-resource-name',
                            html      : StringHelper.encodeHtml(resourceRecord.name)
                        }
                    );
                }

                configs.push(elementConfig);
            }
        }

        // Sync changes to the header
        DomSync.sync({
            domConfig : {
                onlyChildren : true,
                children     : configs
            },
            targetElement : me.element,
            syncIdField   : 'resourceId'
            // TODO: Add callback here to trigger events when rendering/derendering header cells. Sooner or later
            //  someone is going to ask for a way to render JSX or what not to the header
        });
    }

    //endregion

    onResourceMouseEvent(event) {
        const
            resourceCell   = event.target.closest('.b-resourceheader-cell'),
            resourceRecord = this.resourceStore.getById(resourceCell.dataset.resourceId);

        this.trigger('resourceHeader' + StringHelper.capitalize(event.type), {
            resourceRecord,
            event
        });
    }

    // This function is not meant to be called by any code other than Base#getCurrentConfig().
    // It extracts the current configs for the header, removing irrelevant ones
    getCurrentConfig(options) {
        const result = super.getCurrentConfig(options);

        // Assigned from Scheduler
        delete result.resourceStore;
        delete result.column;
        delete result.type;

        return result;
    }
}
