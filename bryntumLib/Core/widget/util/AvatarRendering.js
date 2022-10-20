import Base from '../../Base.js';
import DomHelper from '../../helper/DomHelper.js';
import EventHelper from '../../helper/EventHelper.js';
import Tooltip from '../../widget/Tooltip.js';
import StringHelper from '../../helper/StringHelper.js';

/**
 * @module Core/widget/util/AvatarRendering
 */

/**
 * Internal utility class providing rendering of avatars / resource initials.
 *
 * @internal
 * @extends Core/Base
 */
export default class AvatarRendering extends Base {
    static get $name() {
        return 'AvatarRendering';
    }

    static get configurable() {
        return {
            /**
             * Element used to listen for load errors on. Normally the owning widgets own element.
             * @config {HTMLElement}
             */
            element : null,

            /**
             * Prefix prepended to a supplied color to create a CSS class applied when showing initials.
             * @config {String}
             * @default
             */
            colorPrefix : 'b-sch-',

            /**
             * A tooltip config object to enable using a custom tooltip for the avatars. Listen for `beforeShow` and set
             * your html there.
             * @config {TooltipConfig}
             */
            tooltip : null,

            size : null
        };
    }

    doDestroy() {
        this.tooltip?.destroy();

        super.doDestroy();
    }

    updateElement(element) {
        // Error listener
        EventHelper.on({
            element,
            delegate : '.b-resource-image',
            error    : 'onImageErrorEvent',
            thisObj  : this,
            capture  : true
        });
    }

    changeTooltip(config) {
        return Tooltip.new({
            forElement  : this.element,
            forSelector : '.b-resource-avatar',
            cls         : 'b-resource-avatar-tooltip'
        }, config);
    }

    static get failedUrls() {
        if (!this._failedUrls) {
            this._failedUrls = new Set();
        }
        return this._failedUrls;
    }

    /**
     * Returns a DOM config object containing a resource avatar, icon or resource initials. Display priority in that
     * order.
     * @param {Object} options Avatar options
     * @param {String} options.initials Resource initials
     * @param {String} options.color Background color for initials
     * @param {String} options.iconCls Icon cls
     * @param {String} options.imageUrl Image url
     * @param {String} options.defaultImageUrl Default image url, fallback if image fails to load or there is none
     * specified. Leave out to show initials instead.
     * @param {Object} [options.dataset] Dataset to apply to the resulting element
     * @param {String} [options.alt] Image description
     * @returns {DomConfig}
     * @internal
     */
    getResourceAvatar({ initials, color, iconCls, imageUrl, defaultImageUrl, dataset = {}, resourceRecord, alt = StringHelper.encodeHtml(resourceRecord?.name) }) {
        return this.getImageConfig(initials, color, imageUrl, defaultImageUrl, dataset, alt) ||
            this.getIconConfig(iconCls, dataset) ||
            this.getResourceInitialsConfig(initials, color, dataset);
    }

    getImageConfig(initials, color, imageUrl, defaultImageUrl, dataset, alt) {
        const { size } = this;
        // Fall back to defaultImageUrl if imageUrl is known to fail
        imageUrl = AvatarRendering.failedUrls.has(imageUrl) ? defaultImageUrl : (imageUrl  || defaultImageUrl);

        if (imageUrl) {
            return {
                tag       : 'img',
                draggable : 'false',
                class     : {
                    'b-resource-avatar' : 1,
                    'b-resource-image'  : 1
                },
                ...(size ? { style : { height : size + 'px', width : size + 'px' } } : undefined),
                alt,
                elementData : {
                    defaultImageUrl,
                    imageUrl,
                    initials,
                    color,
                    dataset
                },
                src : imageUrl,
                dataset
            };
        }
    }

    getIconConfig(iconCls, dataset) {
        if (iconCls) {
            return iconCls && {
                tag   : 'i',
                class : {
                    'b-resource-avatar' : 1,
                    'b-resource-icon'   : 1,
                    [iconCls]           : 1
                },
                dataset
            };
        }
    }

    getResourceInitialsConfig(initials, color, dataset) {
        const
            { size }   = this,
            // eventColor = #FF5555, apply as background-color
            namedColor = DomHelper.isNamedColor(color) && color,
            // eventColor = red, add b-sch-red cls
            hexColor   = !namedColor && color;

        return {
            tag   : 'div',
            class : {
                'b-resource-avatar'                  : 1,
                'b-resource-initials'                : 1,
                [`${this.colorPrefix}${namedColor}`] : namedColor
            },
            style : {
                backgroundColor : hexColor || null,
                ...(size ? { height : size + 'px', width : size + 'px' } : undefined)
            },
            children : [initials],
            dataset
        };
    }

    onImageErrorEvent({ target }) {
        if (!target.matches('.b-resource-avatar')) {
            return;
        }

        const { defaultImageUrl, initials, color, imageUrl, dataset } = target.elementData;

        if (defaultImageUrl && !target.src.endsWith(defaultImageUrl.replace(/^[./]*/gm, ''))) {
            target.src = defaultImageUrl;
        }
        else {
            const initialsEl = DomHelper.createElement(this.getResourceInitialsConfig(initials, color, dataset));
            initialsEl.elementData = target.elementData;
            target.parentElement.replaceChild(initialsEl, target);
        }

        // Remember failed urls, to avoid trying to load them again next time
        AvatarRendering.failedUrls.add(imageUrl);
    }
}
