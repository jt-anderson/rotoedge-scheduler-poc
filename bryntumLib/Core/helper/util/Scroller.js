import Base from '../../Base.js';
import Rectangle from './Rectangle.js';
import Delayable from '../../mixin/Delayable.js';
import Events from '../../mixin/Events.js';
import DomHelper from '../DomHelper.js';
import FunctionHelper from '../FunctionHelper.js';
import IdHelper from '../IdHelper.js';
import BrowserHelper from '../BrowserHelper.js';
import EventHelper from '../EventHelper.js';
import ResizeMonitor from '../ResizeMonitor.js';
import './Point.js';
import DomClassList from './DomClassList.js';

/**
 * @module Core/helper/util/Scroller
 */

const
    scrollLiterals       = {
        auto            : 'auto',
        true            : 'auto',
        false           : 'hidden',
        'hidden-scroll' : 'auto',
        clip            : BrowserHelper.supportsOverflowClip ? 'clip' : 'hidden'
    },
    scrollerCls          = 'b-widget-scroller',
    defaultScrollOptions = {
        block : 'nearest'
    },
    immediatePromise     = Promise.resolve(),
    scrollPromise        = element => new Promise(resolve => EventHelper.on({
        element,
        scroll : resolve,
        once   : true
    })),
    xAxis                = {
        x : 1
    },
    isScrollable = {
        auto   : 1,
        scroll : 1
    },
    isScrollableConfig = {
        true : 1,
        auto : 1
    },
    allScroll = {
        overflowX : 'auto',
        overflowY : 'auto'
    },
    normalizeEdgeOffset  = edgeOffset => {
        let top, bottom, start, end;

        if (!edgeOffset) {
            top = bottom = start = end = 0;
        }
        else if (typeof edgeOffset === 'number') {
            top = bottom = start = end = edgeOffset;
        }
        else {
            top = edgeOffset.top ?? 0;
            bottom = edgeOffset.bottom ?? 0;
            start = edgeOffset.start ?? 0;
            end = edgeOffset.end ?? 0;
        }

        return { top, bottom, start, end };
    };

/**
 * Encapsulates scroll functionality for a Widget. All requests for scrolling and scrolling information
 * must go through a Widget's {@link Core.widget.Widget#config-scrollable} property.
 * @mixes Core/mixin/Events
 * @mixes Core/mixin/Delayable
 * @extends Core/Base
 */
export default class Scroller extends Delayable(Events(Base)) {
    static get configurable() {
        return {
            /**
             * The widget which is to scroll.
             * @config {Core.widget.Widget}
             */
            widget : null,

            /**
             * The element which is to scroll. Defaults to the {@link Core.widget.Widget#property-overflowElement} of
             * the configured {@link #config-widget}
             * @config {HTMLElement}
             */
            element : {
                $config : {
                    nullify : true
                },
                value : null
            },

            /**
             * The element, or a selector which identifies a descendant element whose size
             * will affect the scroll range.
             * @config {HTMLElement|String}
             */
            contentElement : {
                $config : {
                    nullify : true
                },
                value : null
            },

            /**
             * How to handle overflowing in the `X` axis.
             * May be:
             * * `'auto'`
             * * `'visible'`
             * * `'hidden'`
             * * `'scroll'`
             * * `'hidden-scroll'` Meaning scrollable from the UI but with no scrollbar,
             * for example a grid header. Only on platforms which support this feature.
             * * `true` - meaning `'auto'`
             * * `false` - meaning `'hidden'`
             * * `clip` - Uses `clip` where supported. Where not supported it uses
             * `hidden` and rolls back any detected scrolls in this dimension.
             * @config {String|Boolean}
             */
            overflowX : null,

            /**
             * How to handle overflowing in the `Y` axis.
             * May be:
             * * `'auto'`
             * * `'visible'`
             * * `'hidden'`
             * * `'scroll'`
             * * `'hidden-scroll'` Meaning scrollable from the UI but with no scrollbar.
             * Only on platforms which support this feature.
             * * `true` - meaning `'auto'`
             * * `false` - meaning `'hidden'`
             * * `clip` - Uses `clip` where supported. Where not supported it uses
             * `hidden` and rolls back any detected scrolls in this dimension.
             * @config {String|Boolean}
             */
            overflowY : null,

            /**
             * If configured as `true`, the {@link #config-element} is not scrolled but is translated using CSS
             * transform when controlled by this class's API. Scroll events are fired when the element is translated.
             * @default
             * @config {Boolean}
             */
            translate : null,

            x : 0,
            y : 0,

            rtlSource : null
        };
    }

    static get delayable() {
        return {
            onScrollEnd : {
                type  : 'buffer',
                delay : 100
            }
        };
    }

    /**
     * Fired when scrolling happens on this Scroller's element. The event object is a native `scroll` event
     * with the described extra properties injected.
     * @event scroll
     * @param {Core.widget.Widget} widget The owning Widget which has been scrolled.
     * @param {Core.helper.util.Scroller} source This Scroller
     */

    /**
     * Fired when scrolling finished on this Scroller's element. The event object is the last native `scroll` event
     * fires by the element with the described extra properties injected.
     * @event scrollend
     * @param {Core.widget.Widget} widget The owning Widget which has been scrolled.
     * @param {Core.helper.util.Scroller} source This Scroller
     */

    /**
     * The `overflow-x` setting for the widget. `true` means `'auto'`.
     * @member {Boolean|String} overflowX
     */

    /**
     * The `overflow-y` setting for the widget. `true` means `'auto'`.
     * @member {Boolean|String} overflowY
     */

    get isRTL() {
        return Boolean(this.rtlSource?.rtl);
    }

    syncOverflowState() {
        const
            me          = this,
            { element } = me,
            classList   = new DomClassList(element.classList),
            x           = me.hasOverflowX = element.scrollWidth > element.clientWidth,
            y           = me.hasOverflowY = element.scrollHeight > element.clientHeight;

        classList.value = element.classList;

        // We use classes to indicate presence of overflow. This carries no rules by default.
        // Widget SASS may or may not attach rules or use these to select elements.
        const changed = classList.toggle('b-horizontal-overflow', x) || classList.toggle('b-vertical-overflow', y);

        if (changed) {
            DomHelper.syncClassList(element, classList);

            if (!me.isConfiguring) {
                /**
                 * Fired when either the X or the Y axis changes from not showing a space-consuming scrollbar
                 * to showing a space-consuming scrollbar or vice-versa.
                 *
                 * *_Does not fire on platforms which show overlayed scrollbars_*
                 * @event overflowChange
                 * @param {Boolean} x `true` if the X axis overflow, `false` otherwise.
                 * @param {Boolean} y `true` if the Y axis overflow, `false` otherwise.
                 * @internal
                 */
                me.trigger('overflowChange', { x, y });
            }
        }
    }

    /**
     * Returns `true` if there is overflow in the specified axis.
     * @param {'x'|'y'} [axis='y'] The axis to check scrollbar for. Note that this is subtly different to asking
     * whether an axis is showing a space-consuming scrollbar, see {@link #function-hasScrollbar}.
     * @internal
     */
    hasOverflow(axis = 'y') {
        const
            overflowSetting = this[`overflow${axis.toUpperCase()}`],
            otherAxis       = this[`overflow${axis === 'y' ? 'x' : 'y'}`];

        // If there are no space-consuming scrollbars, we will not be recording overflow
        // state on change of scrollbars (There will be no resize event when overflow state changes).
        // If we're not overflow:auto in that axis there will be no resize events from overflow state change.
        // If the other axis won't be changing size on scroll change we can't track this.
        // Also, work around Firefox ResizeObserver bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1733042
        // We don't get to update our scroll status when content size causes scrollbar change
        // so FF has to measure each time we're asked about overflow.
        if (!DomHelper.scrollBarWidth || !isScrollableConfig[overflowSetting] || otherAxis === 'hidden-scroll' || BrowserHelper.isFirefox) {
            const dimension = axis === 'y' ? 'Height' : 'Width';

            return this[`scroll${dimension}`] > this[`client${dimension}`];
        }
        else {
            return this[`hasOverflow${axis.toUpperCase()}`];
        }
    }

    /**
     * Returns `true` if there is a *space-consuming* scrollbar controlling scroll in the specified axis.
     * @param {'x'|'y'} [axis='y'] The axis to check scrollbar for. Note that this is subtly different to asking
     * whether an axis *has any* overflow, see {@link #function-hasOverflow}.
     * @internal
     */
    hasScrollbar(axis = 'y') {
        const { element } = this;

        if (element && DomHelper.scrollBarWidth) {
            const
                vertical   = axis === 'y',
                dimension  = vertical ? 'Width' : 'Height',
                clientSize = element[`client${dimension}`],
                borderSize = parseInt(DomHelper.getStyleValue(element, `border${vertical ? 'Left' : 'Top'}Width`)) +
                    parseInt(DomHelper.getStyleValue(element, `border${vertical ? 'Right' : 'Bottom'}Width`)),
                difference = (element[`offset${dimension}`] - borderSize) - clientSize;

            // If the difference between the content width and the client width is
            // scrollBarWidth, then we have a scrollbar
            return Math.abs(difference - DomHelper.scrollBarWidth) < 2;
        }
    }

    /**
     * Partners this Scroller with the passed scroller in order to sync the scrolling position in the passed axes
     * @param {Core.helper.util.Scroller} otherScroller
     * @param {String|Object} [axes='x'] `'x'` or `'y'` or `{x: true/false, y: true/false}` axes to sync
     */
    addPartner(otherScroller, axes = xAxis) {
        const me = this;


        if (typeof axes === 'string') {
            axes = {
                [axes] : 1
            };
        }

        if (!me.partners) {
            me.partners = {};
        }

        me.partners[otherScroller.id] = {
            scroller : otherScroller,
            axes
        };

        // Initial sync of the other axis to match our current state
        if (axes.x) {
            otherScroller.x = me.x;
        }
        if (axes.y) {
            otherScroller.y = me.y;
        }

        // It's a mutual relationship - the other scroller partners with us.
        if (!otherScroller.isPartneredWith(me)) {
            otherScroller.addPartner(me, axes);
        }
    }

    eachPartner(fn) {
        const { partners } = this;

        if (partners) {
            Object.values(partners).forEach(fn);
        }
    }

    /**
     * Breaks the link between this Scroller and the passed Scroller set up by the
     * {@link #function-addPartner} method.
     * @param {Core.helper.util.Scroller} otherScroller The Scroller to unlink from.
     */
    removePartner(otherScroller) {
        if (this.isPartneredWith(otherScroller)) {
            delete this.partners[otherScroller.id];
            otherScroller.removePartner(this);
        }
    }

    isPartneredWith(otherScroller) {
        return Boolean(this.partners?.[otherScroller.id]);
    }

    /**
     * Breaks the link between this Scroller and all other Scrollers set up by the
     * {@link #function-addPartner} method.
     * @internal
     */
    clearPartners() {
        if (this.partners) {
            Object.values(this.partners).forEach(otherScroller => otherScroller.scroller.removePartner(this));
        }
    }

    /**
     * Scrolls the passed element or {@link Core.helper.util.Rectangle} into view according to the passed options.
     * @param {HTMLElement|Core.helper.util.Rectangle} element The element or a Rectangle in document space to scroll
     * into view.
     * @param {Object} [options] How to scroll.
     * @param {'start'|'end'|'center'|'nearest'} [options.block] How far to scroll the element.
     * @param {Number} [options.edgeOffset] edgeOffset A margin around the element or rectangle to bring into view.
     * @param {Object|Boolean|Number} [options.animate] Set to `true` to animate the scroll by 300ms,
     * or the number of milliseconds to animate over, or an animation config object.
     * @param {Number} [options.animate.duration] The number of milliseconds to animate over.
     * @param {String} [options.animate.easing] The name of an easing function.
     * @param {Boolean|Function} [options.highlight] Set to `true` to highlight the element when it is in view.
     * May be a function which is called passing the element, to provide customized highlighting.
     * @param {Boolean} [options.focus] Set to `true` to focus the element when it is in view.
     * @param {Boolean} [options.x] Pass as `false` to disable scrolling in the `X` axis.
     * @param {Boolean} [options.y] Pass as `false` to disable scrolling in the `Y` axis.
     * @returns {Promise} A promise which is resolved when the element has been scrolled into view.
     */
    async scrollIntoView(element, options = defaultScrollOptions) {
        const
            me                 = this,
            { isRectangle }    = element,
            originalRect       = isRectangle ? element : Rectangle.from(element),
            { xDelta, yDelta } = me.getDeltaTo(element, options),
            result             = me.scrollBy(xDelta, yDelta, options);

        if (options.highlight || options.focus) {
            result.then(() => {
                if (isRectangle) {
                    element = originalRect.translate(-xDelta, -yDelta);
                }
                if (options.highlight) {
                    // Not coercible to a number means its a function or name of a function
                    if (isNaN(options.highlight)) {
                        (me.widget || me).callback(options.highlight, null, [element]);
                    }
                    // Otherwise, it's truthy or falsy
                    else {
                        DomHelper.highlight(element, me);
                    }
                }
                if (options.focus) {
                    DomHelper.focusWithoutScrolling(element);
                }
            });
        }
        return result;
    }

    /**
     * Scrolls the passed element into view according to the passed options.
     * @param {HTMLElement} element The element in document space to scroll into view.
     * @param {Object} [options] How to scroll.
     * @param {'start'|'end'|'center'|'nearest'} [options.block] How far to scroll the element.
     * @param {Number} [options.edgeOffset] edgeOffset A margin around the element or rectangle to bring into view.
     * @param {Object|Boolean|Number} [options.animate] Set to `true` to animate the scroll by 300ms,
     * or the number of milliseconds to animate over, or an animation config object.
     * @param {Number} [options.animate.duration] The number of milliseconds to animate over.
     * @param {String} [options.animate.easing] The name of an easing function.
     * @param {Boolean} [options.highlight] Set to `true` to highlight the element when it is in view.
     * @param {Boolean} [options.focus] Set to `true` to focus the element when it is in view.
     * @param {Boolean} [options.x] Pass as `false` to disable scrolling in the `X` axis.
     * @param {Boolean} [options.y] Pass as `false` to disable scrolling in the `Y` axis.
     * @returns {Promise} A promise which is resolved when the element has been scrolled into view.
     */
    static async scrollIntoView(element, options = defaultScrollOptions, rtl = false) {
        const
            target     = Rectangle.from(element),
            animate    = (typeof options === 'object') ? options.animate : options,
            scrollable = Scroller._globalScroller || (Scroller._globalScroller = new Scroller()),
            deltas     = [];

        scrollable.rtlSource = { rtl };

        let totalX = 0, totalY = 0, result;

        // Build up all the scroll deltas necessary to bring the requested element into view
        for (let ancestor = element.parentNode; ancestor.nodeType === Node.ELEMENT_NODE; ancestor = ancestor.parentNode) {
            if (ancestor === document.body && ancestor !== document.scrollingElement) {
                continue;
            }
            // The <html> element, although it scrolls is overflow:visible by default.
            const style = ancestor === document.scrollingElement ? allScroll : ancestor.ownerDocument.defaultView.getComputedStyle(ancestor);

            // If the ancestor overflows and scrolls in a dimension we are being asked to scroll in
            // Accumulate a scroll command for the ancestor.
            if (
                (options.y !== false && isScrollable[style.overflowY] && ancestor.scrollHeight > ancestor.clientHeight) ||
                (options.x !== false && isScrollable[style.overflowX] && ancestor.scrollWidth > ancestor.clientWidth)
            ) {
                // Global Scrollable
                scrollable.element = ancestor;

                // In case same element used as last time and didn't make it to the updater.
                scrollable.positionDirty = true;

                // See if the target is outside of this ancestor
                const { xDelta, yDelta } = scrollable.getDeltaTo(target, options);

                if (xDelta || yDelta) {
                    deltas.push({
                        element : ancestor,
                        x       : ancestor.scrollLeft,
                        y       : ancestor.scrollTop,
                        xDelta,
                        yDelta
                    });
                    target.translate(-xDelta, -yDelta);
                    totalX += xDelta;
                    totalY += yDelta;
                }
            }
        }

        // If scrolling was found to be necessary
        if (deltas.length) {
            const
                absX = Math.abs(totalX),
                absY = Math.abs(totalY);

            let duration = animate && (typeof animate === 'number' ? animate : (typeof animate.duration === 'number' ? animate.duration : 300));

            // Only go through animation if there is significant scrolling to do.
            if (duration && (absX > 10 || absY > 10)) {
                // For small distances, constrain duration
                if (Math.max(absX, absY) < 50) {
                    duration = Math.min(duration, 500);
                }

                result = scrollable.scrollAnimation = FunctionHelper.animate(duration, progress => {
                    const isEnd = progress === 1;

                    for (const { element, x, y, xDelta, yDelta } of deltas) {
                        scrollable.element = element;

                        if (xDelta) {
                            scrollable.x = Math[rtl ? 'min' : 'max'](x + (isEnd ? xDelta : Math.round(xDelta * progress)), 0);
                        }
                        if (yDelta) {
                            scrollable.y = Math.max(y + (isEnd ? yDelta : Math.round(yDelta * progress)), 0);
                        }
                    }
                }, null, animate.easing);
                result.then(() => {
                    scrollable.scrollAnimation = null;
                });
            }
            // No animation
            else {
                for (const { element, xDelta, yDelta } of deltas) {
                    element.scrollTop += yDelta;
                    element.scrollLeft += xDelta;
                }
                result = scrollPromise(deltas[deltas.length - 1].element);
            }
        }
        else {
            result = immediatePromise;
        }

        // Postprocess element after scroll.
        if (options.highlight || options.focus) {
            result.then(() => {
                if (options.highlight) {
                    // Not coercible to a number means it's a function or name of a function
                    if (isNaN(options.highlight)) {
                        scrollable.callback(options.highlight, null, [element]);
                    }
                    // Otherwise, it's truthy or falsy
                    else {
                        DomHelper.highlight(element, scrollable);
                    }
                }
                if (options.focus) {
                    element.focus();
                }
            });
        }

        return result;
    }

    /**
     * Scrolls by the passed deltas according to the passed options.
     * @param {Number} [xDelta=0] How far to scroll in the X axis.
     * @param {Number} [yDelta=0] How far to scroll in the Y axis.
     * @param {Object|Boolean} [options] How to scroll. May be passed as `true` to animate.
     * @param {Boolean} [options.silent] Set to `true` to suspend `scroll` events during scrolling.
     * @param {Object|Boolean|Number} [options.animate] Set to `true` to animate the scroll by 300ms,
     * or the number of milliseconds to animate over, or an animation config object.
     * @param {Number} [options.animate.duration] The number of milliseconds to animate over.
     * @param {String} [options.animate.easing] The name of an easing function.
     * @returns {Promise} A promise which is resolved when the scrolling has finished.
     */
    async scrollBy(xDelta = 0, yDelta = 0, options = defaultScrollOptions) {
        const
            me      = this,
            animate = (typeof options === 'object') ? options.animate : options,
            absX    = Math.abs(xDelta),
            absY    = Math.abs(yDelta);

        if (me.scrollAnimation) {
            me.scrollAnimation.cancel();
            me.scrollAnimation = null;
        }

        // Only set the flag if there is going to be scrolling done.
        // It is cleared by the scrollEnd handler, so there must be scrolling.
        if (xDelta || yDelta) {
            me.silent = options.silent;
        }

        let duration = animate && (typeof animate === 'number' ? animate : (typeof animate.duration === 'number' ? animate.duration : 300));

        // Only go through animation if there is significant scrolling to do.
        if (duration && (absX > 10 || absY > 10)) {
            const { x, y } = me;
            let lastX = x,
                lastY = y;

            // For small distances, constrain duration
            if (Math.max(absX, absY) < 50) {
                duration = Math.min(duration, 500);
            }

            me.scrollAnimation = FunctionHelper.animate(duration, progress => {
                const isEnd = progress === 1;
                if (xDelta) {
                    // If the user, or another process has changed the position since last time, abort.
                    // Unless called with the force option to proceed regardless.
                    if (me.x !== lastX && !options.force) {
                        return me.scrollAnimation?.cancel();
                    }
                    me.x = Math.max(x + (isEnd ? xDelta : Math.round(xDelta * progress)), 0);
                }
                if (yDelta) {
                    // If the user, or another process has changed the position since last time, abort.
                    // Unless called with the force option to proceed regardless.
                    if (me.y !== lastY && !options.force) {
                        return me.scrollAnimation?.cancel();
                    }
                    me.y = Math.max(y + (isEnd ? yDelta : Math.round(yDelta * progress)), 0);
                }
                // Store actual position from DOM
                lastX = me.x;
                lastY = me.y;
            }, me, animate.easing);

            me.element.classList.add('b-scrolling');

            me.scrollAnimation.then(() => {
                if (!me.isDestroyed) {
                    me.element.classList.remove('b-scrolling');
                    me.scrollAnimation = null;
                }
            });
            return me.scrollAnimation;
        }
        else {
            if (xDelta | yDelta) {
                const
                    xBefore = me.x,
                    yBefore = me.y;

                me.x += xDelta;
                me.y += yDelta;

                // Another change check for the possibility that setting me.x doesn't really scroll any significant
                // amount of pixels.
                if (me.x !== xBefore || me.y !== yBefore) {
                    return scrollPromise(me.element);
                }
            }
            return immediatePromise;
        }
    }

    /**
     * Scrolls to the passed position according to the passed options.
     * @param {Number} [toX=0] Where to scroll to in the X axis.
     * @param {Number} [toY=0] Where to scroll to in the Y axis.
     * @param {Object|Boolean} [options] How to scroll. May be passed as `true` to animate.
     * @param {Object|Boolean|Number} [options.animate] Set to `true` to animate the scroll by 300ms,
     * or the number of milliseconds to animate over, or an animation config object.
     * @param {Number} [options.animate.duration] The number of milliseconds to animate over.
     * @param {String} [options.animate.easing] The name of an easing function.
     * @returns {Promise} A promise which is resolved when the scrolling has finished.
     */
    async scrollTo(toX, toY, options) {
        const
            { x, y } = this,
            xDelta   = toX == null ? 0 : toX - x,
            yDelta   = toY == null ? 0 : toY - y;

        return this.scrollBy(xDelta, yDelta, options);
    }

    doDestroy() {
        const me = this;

        if (me._element) {
            me._element.removeEventListener('scroll', me.scrollHandler);
            me.wheelListenerRemover?.();
        }

        me.scrollAnimation?.cancel();

        Object.values(me.partners || {}).forEach(({ scroller }) => scroller.removePartner(me));

        super.doDestroy();
    }

    /**
     * Respond to style changes to monitor scroll *when this Scroller is in `translate: true` mode.*
     * @param {Object[]} mutations The ElementMutation records.
     * @private
     */
    onElMutation(mutations) {
        const
            me     = this,
            [x, y] = DomHelper.getTranslateXY(me.element);

        // If the mutation was due to a change in the translateX/Y styles, this is
        // a scroll event, so inform observers and partners
        if (me._x !== -x || me.y !== -y) {
            const scrollEvent = new CustomEvent('scroll', { bubbles : true });

            Object.defineProperty(scrollEvent, 'target', {
                get : () => me.element
            });

            me.onScroll(scrollEvent);
        }
    }

    onElResize() {
        const
            me         = this,
            { widget } = me;

        // If it's not animating its size, sync immediately
        if (!widget?.isAnimating) {
            me.syncOverflowState();
        }
        // If it's animating, sync chen it's finished
        else if (widget.findListener('animationend', 'onElResize', me) === -1) {
            widget.on({
                animationEnd : 'onElResize',
                thisObj      : me,
                once         : true
            });
        }
    }

    onScroll(e) {
        const
            me = this,
            { _x, _y, element } = me;

        let vetoed = 0;

        // Until overflow:clip is 100% supported just veto (and rollback) scrolls in clipped axes
        if (me.overflowX === 'clip' && element.scrollLeft !== _x) {
            element.scrollLeft = _x;
            ++vetoed;
        }
        if (me.overflowY === 'clip' && element.scrollTop !== _y) {
            element.scrollTop = _y;
            ++vetoed;
        }
        if (vetoed === 2) {
            return;
        }

        if (!me.widget || !me.widget.isDestroyed) {
            // Don't read the value until we have to. The x & y getters will check this flag
            me.positionDirty = true;

            if (!element.classList.contains('b-scrolling')) {
                element.classList.add('b-scrolling');
            }

            e.widget = me.widget;

            // If we have the scroll silent flag, do not fire the event.
            if (!me.silent) {
                me.trigger('scroll', e);
            }

            // Keep partners in sync
            me.syncPartners();

            // If this scroll impulse was from a controlling partner, clear that now
            me.controllingPartner = null;

            // Buffered method will fire in 100ms, unless another scroll event comes round.
            // In which case execution will be pushed out by another 100ms.
            me.onScrollEnd(e);
        }
    }

    /**
     * Syncs all attached scrolling partners with the scroll state of this Scroller.
     * @param {Boolean} force Allow this to sync a partner which is controlling this via a sync.
     * @param {Boolean} propagate Propagate any change immediately onwards through further linked
     * partners immediately rather than relying on the partner to react to its own scroll event.
     * @internal
     */
    syncPartners(force, propagate) {
        const me = this;

        // Keep partners in sync
        if (me.partners) {
            Object.values(me.partners).forEach(({ axes, scroller }) => {
                // Don't feed back to the one who's just told us to scroll here.
                // Unless we have assumed command. For example Scheduler timeline infinite scrolling
                // has reset the scroll position and the partner who thinks it's controlling
                // must stay in sync with that reset.
                if (scroller !== me.controllingPartner || force) {

                    // Propagate means update all linked partners immediately rather than scroller reacting
                    // to its scroll events to sync its partners. Only bother if the scroller actually changed.
                    if (scroller.sync(me, axes) && propagate) {
                        scroller.syncPartners(force, propagate);
                    }
                }
            });
        }
    }

    onScrollEnd(e) {
        const me = this;

        if (me.silent) {
            me.silent = false;
        }

        me.trigger('scrollEnd', e);

        // Controlling partner is required for scrollable not to change its partners on scroll. This method is buffered
        // and landing here essentially means that no scrolling has occurred during the onScrollEnd buffer
        // time. We can safely cleanup controlling partner here.
        // https://github.com/bryntum/support/issues/1095
        me.controllingPartner = null;

        me.element.classList.remove('b-scrolling');
    }

    /**
     * Returns the xDelta and yDelta values in an object from the current scroll position to the
     * passed element or Rectangle.
     * @param {HTMLElement|Core.helper.util.Rectangle} element The element or a Rectangle to calculate deltas for.
     * @param {Object} [options] How to scroll.
     * @param {'start'|'end'|'center'|'nearest'} [options.block] How far to scroll the element.
     * @param {Number} [options.edgeOffset] A margin around the element or rectangle to bring into view.
     * @param {Boolean} [options.x] Pass as `false` to disable scrolling in the `X` axis.
     * @param {Boolean} [options.y] Pass as `false` to disable scrolling in the `Y` axis.
     * @returns {Object} `{ xDelta, yDelta }`
     * @internal
     */
    getDeltaTo(element, options) {
        const me = this;

        // scroller may belong to a collapsed subgrid widget
        if (!me.viewport) {
            return {
                xDelta : 0,
                yDelta : 0
            };
        }

        const
            {
                x,
                y,
                scrollWidth,
                scrollHeight,
                isRTL
            }            = me,
            elementRect  = (element instanceof Rectangle ? element : Rectangle.from(element)),
            block        = options.block || 'nearest',
            scrollerRect = me.viewport,
            edgeOffset   = normalizeEdgeOffset(options.edgeOffset),
            // Only include the offset round the target if the viewport is big enough to accommodate it.
            xOffset      = scrollerRect.width >= elementRect.width + (edgeOffset.start + edgeOffset.end) ? edgeOffset : { start : 0, end : 0 },
            yOffset      = scrollerRect.height >= elementRect.height + (edgeOffset.top + edgeOffset.bottom) ? edgeOffset : { top : 0, bottom : 0 },
            constrainTo  = new Rectangle(
                isRTL ? (scrollerRect.right - -x - scrollWidth) : (scrollerRect.x - x),
                scrollerRect.y - y,
                scrollWidth,
                scrollHeight
            ),
            elRect       = elementRect.clone().adjust(-xOffset.start, -yOffset.top, xOffset.end, yOffset.bottom).constrainTo(constrainTo),
            targetRect   = elRect.clone(),
            // X scrolling is always +ve along the X scroll axis
            xFactor      = me.isRTL ? -1 : 1;

        let xDelta = 0,
            yDelta = 0;

        if (block === 'start') {
            targetRect.moveTo(scrollerRect.x, scrollerRect.y);
            xDelta = elRect.x - targetRect.x;
            yDelta = elRect.y - targetRect.y;
        }
        else if (block === 'end') {
            targetRect.translate(scrollerRect.right - targetRect.right, scrollerRect.bottom - targetRect.bottom);
            xDelta = elRect.x - targetRect.x;
            yDelta = elRect.y - targetRect.y;
        }
        else {
            // Calculate deltas unless the above has done that for non-fitting target
            if (block === 'center') {
                const center = scrollerRect.center;

                targetRect.moveTo(center.x - targetRect.width / 2, center.y - targetRect.height / 2);
                xDelta = xDelta || elRect.x - targetRect.x;
                yDelta = yDelta || elRect.y - targetRect.y;
            }
            // Use "nearest"
            else {
                // Can't fit width in, scroll what is possible into view so that start is visible.
                if (targetRect.width > scrollerRect.width) {
                    xDelta = targetRect.x - scrollerRect.x;
                }
                // If it's *possible* to scroll to nearest x, calculate the delta
                else {
                    if (targetRect.right > scrollerRect.right) {
                        xDelta = targetRect.right - scrollerRect.right;
                    }
                    else if (targetRect.x < scrollerRect.x) {
                        xDelta = targetRect.x - scrollerRect.x;
                    }
                }

                // Can't fit height in, scroll what is possible into view so that start is visible.
                if (targetRect.height > scrollerRect.height) {
                    yDelta = targetRect.y - scrollerRect.y;
                }
                // If it's *possible* to scroll to nearest y, calculate the delta
                else {
                    if (targetRect.bottom > scrollerRect.bottom) {
                        yDelta = targetRect.bottom - scrollerRect.bottom;
                    }
                    else if (targetRect.y < scrollerRect.y) {
                        yDelta = targetRect.y - scrollerRect.y;
                    }
                }
            }
        }

        // Ensure x scrolling proceeds in +ve direction in RTL mode
        xDelta = xFactor * Math.round(xDelta);
        yDelta = Math.round(yDelta);

        // Do not allow deltas which would produce -ve scrolling or scrolling past the maxX/Y
        return {
            // When calculating how much delta is necessary to scroll the targetRect to the center
            // constrain that to what is *possible*. If what you are trying to scroll into the
            // center is hard against the right edge of the scroll range, then it cannot scroll
            // to the center, and the result must reflect that even though scroll is self limiting.
            // This is because highlighting the requested "element", if that element is in fact
            // a Rectangle, uses a temporary element placed at the requested region which
            // MUST match where the actual scroll has moved the requested region.
            xDelta : options.x === false ? 0 : Math.max(Math.min(xDelta, me.maxX - x), -x),
            yDelta : options.y === false ? 0 : Math.max(Math.min(yDelta, me.maxY - y), -y)
        };
    }

    /**
     * A {@link Core/helper/util/Rectangle} describing the bounds of the scrolling viewport.
     * @property {Core.helper.util.Rectangle}
     */
    get viewport() {
        return Rectangle.client(this.element);
    }

    updateWidget(widget) {
        this.rtlSource = this.owner = widget;
    }

    updateElement(element, oldElement) {
        const me = this;

        // The global Scroller doesn't monitor its element.
        // It's only used for *commanding* scrolls.
        if (me === Scroller._globalScroller) {
            me._element = element;
            me.positionDirty = true;
            return;
        }

        const
            scrollHandler = me.scrollHandler || (me.scrollHandler = me.onScroll.bind(me)),
            resizeHandler = me.resizeHandler || (me.resizeHandler = me.onElResize.bind(me));

        if (oldElement) {
            if (me.translate) {
                me.mutationObserver?.disconnect(oldElement);
            }
            else {
                oldElement.removeEventListener('scroll', scrollHandler);
                oldElement.classList.remove(scrollerCls);
                oldElement.style.overflowX = oldElement.style.overflowY = '';
            }
            ResizeMonitor.removeResizeListener(oldElement, resizeHandler);
        }

        if (element) {
            if (me.translate) {
                if (!me.mutationObserver) {
                    me.mutationObserver = new MutationObserver(me.mutationHandler || (me.mutationHandler = me.onElMutation.bind(me)));
                }
                me._x = me._y = 0;
                if (document.contains(element)) {
                    const [x, y] = DomHelper.getTranslateXY(element);
                    me._x = -x;
                    me._y = -y;
                }
                me.mutationObserver.observe(element, { attributes : true });
            }
            else {
                element.addEventListener('scroll', scrollHandler);
                element.classList.add(scrollerCls);
            }
            ResizeMonitor.addResizeListener(element, resizeHandler);

            if (!me.widget) {
                me.rtlSource = {
                    get rtl() {
                        return DomHelper.getStyleValue(element, 'direction') === 'rtl';
                    }
                };
            }

            if (me.isRTL) {
                element.classList.add('b-rtl');
            }

            // Ensure the overflow configs, which are unable to process themselves
            // in the absence of the element get applied to the newly arrived element.
            if (me.positionDirty) {
                me.updateOverflowX(me.overflowX);
                me.updateOverflowY(me.overflowY);
            }

            // Keep flags synced from the start
            me.syncOverflowState();

            // Apply initially configured scroll position if we have non-zero positions
            if (me.isConfiguring) {
                me._x && me.updateX(me._x);
                me._y && me.updateY(me._y);
            }
        }

        me.positionDirty = true;
    }

    /**
     * The horizontal scroll position of the widget.
     *
     * Note that this is always +ve. Horizontal scrolling using the `X` property akways proceeds
     * in the +ve direction.
     *
     * @property {Number}
     */
    get x() {
        const
            me          = this,
            { element } = me;

        if (element && me.positionDirty) {
            if (me.translate) {
                const [x, y] = DomHelper.getTranslateXY(element);
                me._x = -x;
                me._y = -y;
            }
            else {
                // A Scroller's conception is that X is an offset from the origin in whatever the direction is.
                me._x = Math.abs(element.scrollLeft);
                me._y = element.scrollTop;
            }
            me.positionDirty = false;
        }
        return me._x;
    }

    /**
     * The natural DOM horizontal scroll position of the widget.
     *
     * Note that this proceeds from 0 into negative space in RTL mode.
     *
     * @property {Number}
     */
    get scrollLeft() {
        return this.element.scrollLeft;
    }

    changeX(x) {
        // We do not accept the concept of -ve X values.
        // Although scrolling in an RTL element sets scrollLeft to -ve, a Scroller's conception
        // is that X is an offset from the origin in whatever the direction is. So all code should
        // use this concept.
        x = Math.max(x, 0);

        // Only process initial X if we were configured to start at non-zero
        if (!this.isConfiguring || x) {
            return x;
        }
        this._x = x;
    }

    updateContentElement(contentElement) {
        if (contentElement) {
            contentElement = typeof contentElement === 'string' ? this.element.querySelector(contentElement) : contentElement;

            ResizeMonitor.addResizeListener(contentElement, this.resizeHandler);
        }
    }

    updateX(x) {
        const { element } = this;

        // When element is outside of DOM, this can have no effect
        if (element && !this.widget?.isConfiguring) {
            this.trigger('scrollStart', { x });

            if (this.translate) {
                DomHelper.setTranslateX(element, -x);
            }
            else {
                element.scrollLeft = this.isRTL ? -x : x;
            }
        }

        // The scroll position will need to be read before we can return it.
        // Do not read it back now, we may not have our element, or if we do,
        // that would cause a forced synchronous layout.
        this.positionDirty = true;
    }

    /**
     * Syncs this Scroller with the passed Scroller in the passed axes.
     * @param {Core.helper.util.Scroller} controllingPartner The Scroller which is dictating our new scroll position.
     * @param {Object} axes `{x : <boolean>, y : <boolean> }` which axes to sync. 
     * @returns {Boolean} `true` if this Scroller needed the passed axes syncing, `false`
     * if no changes were made.
     * @internal
     */
    sync(controllingPartner, axes) {
        const
            me       = this,
            { x, y } = axes;

        let result = false;

        if (x != null) {
            if (me.x !== controllingPartner.x) {
                // Only set controlling partner when scroll will actually change. This helps to increase stability of
                // state restoring API.
                me.controllingPartner = controllingPartner;

                me.x = controllingPartner.x;
                result = true;
            }
        }
        if (y != null) {
            if (me.y !== controllingPartner.y) {
                me.controllingPartner = controllingPartner;

                me.y = controllingPartner.y;
                result = true;
            }
        }

        // Returns true if the sync was needed
        return result;
    }

    /**
     * The vertical scroll position of the widget.
     * @property {Number}
     */
    get y() {
        const
            me          = this,
            { element } = me;

        if (element && me.positionDirty) {
            if (me.translate) {
                const [x, y] = DomHelper.getTranslateXY(element);
                me._x = -x;
                me._y = -y;
            }
            else {
                me._x = element.scrollLeft;
                me._y = element.scrollTop;
            }
            me.positionDirty = false;
        }
        return me._y;
    }

    changeY(y) {
        // Only process initial Y if we were configured to start at non-zero
        if (!this.isConfiguring || y) {
            return y;
        }
        this._y = y;
    }

    updateY(y) {
        const { element, widget } = this;

        // When element is outside of DOM, this can have no effect
        if (element && !widget?.isConfiguring) {
            this.trigger('scrollStart', { y });

            if (this.translate) {
                DomHelper.setTranslateY(element, -y);
            }
            else {
                element.scrollTop = y;
            }
        }

        // The scroll position will need to be read before we can return it.
        // Do not read it back now, we may not have our element, or if we do,
        // that would cause a forced synchronous layout.
        this.positionDirty = true;
    }

    /**
     * The maximum `X` scrollable position of the widget.
     * @property {Number}
     * @readonly
     */
    get maxX() {
        return this.scrollWidth - this.clientWidth;
    }

    /**
     * The maximum `Y` scrollable position of the widget.
     * @property {Number}
     * @readonly
     */
    get maxY() {
        return this.scrollHeight - this.clientHeight;
    }

    /**
     * The furthest possible `scrollLeft` position of the widget. Will be -ve
     * if in writing direction is RTL.
     * @property {Number}
     * @readonly
     */
    get lastScrollLeft() {
        return (this.scrollWidth - this.clientWidth) * (this.isRTL ? -1 : 1);
    }

    updateOverflowX(overflowX, oldOverflowX) {
        const
            me                     = this,
            { element, translate } = me,
            { style, classList }   = element;

        if (oldOverflowX === 'hidden-scroll') {
            classList.remove('b-hide-scroll');
        }

        // Scroll, but without showing scrollbars.
        // For example a grid header. Only works on platforms which
        // support suppression of scrollbars through CSS.
        if (overflowX === 'hidden-scroll' && !translate) {
            const otherAxisScrollable = isScrollable[style.overflowY];

            // Can't do one axis hidden-scroll, and the other scrollable because the b-hide-scroll
            // class hides "all" scrollbars, so we have to make this axis hidden and use a wheel
            // listener to scroll the content.
            if (otherAxisScrollable) {
                overflowX = 'hidden';

                // Adds a wheel listener if we don't already have one.
                me.enableWheel();
            }
            else {
                classList.add('b-hide-scroll');
            }
        }
        if (!translate) {
            style.overflowX = scrollLiterals[overflowX] || overflowX;
        }
        if (!me.isConfiguring) {
            me.positionDirty = true;
            me.syncOverflowState();
        }
    }

    updateOverflowY(overflowY, oldOverflowY) {
        const
            me                     = this,
            { element, translate } = me,
            { style, classList }   = element;

        if (oldOverflowY === 'hidden-scroll') {
            classList.remove('b-hide-scroll');
        }

        // Scroll, but without showing scrollbars.
        // For example a grid header.
        // On platforms which show space-consuming scrollbars we hide scrollbars
        // and add a 'wheel' listener.
        if (overflowY === 'hidden-scroll' && !translate) {
            const otherAxisScrollable = isScrollable[style.overflowX];

            // Can't do one axis hidden-scroll, and the other scrollable because the b-hide-scroll
            // class hides "all" scrollbars, so we have to make this axis hidden and use a wheel
            // listener to scroll the content.
            if (otherAxisScrollable) {
                overflowY = 'hidden';

                // Adds a wheel listener if we don't already have one.
                me.enableWheel();
            }
            else {
                classList.add('b-hide-scroll');
            }
        }
        if (!translate) {
            style.overflowY = scrollLiterals[overflowY] || overflowY;
        }
        if (!me.isConfiguring) {
            me.positionDirty = true;
            me.syncOverflowState();
        }
    }

    enableWheel() {
        if (!this.wheelListenerRemover) {
            this.wheelListenerRemover = EventHelper.on({
                element : this.element,
                wheel   : 'onWheel',
                thisObj : this
            });
        }
    }

    onWheel(e) {
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && this.overflowX === 'hidden-scroll') {
            this.x += e.deltaX;
        }
        else if (this.overflowY === 'hidden-scroll') {
            this.y += e.deltaY;
        }
    }

    /**
     * The horizontal scroll range of the widget.
     * @property {Number}
     * @readonly
     */
    get scrollWidth() {
        return this.element?.scrollWidth ?? 0;
    }

    set scrollWidth(scrollWidth) {
        const
            me                 = this,
            { element, isRTL } = me;

        let stretcher = me.widthStretcher;

        // "Unsetting" scrollWidth removes the stretcher
        if (stretcher && scrollWidth == null) {
            stretcher.remove();
            me.widthStretcher = null;
        }
        else if (scrollWidth) {
            // Although DOM has crazy negative scrollLeft values in RTL, we treat the scrollWidth
            // as a pure magnitude. It is then applied correctly negated if RTL. In this way
            // app code can just use element widths and not consider RTL.
            scrollWidth = Math.abs(scrollWidth);

            if (!stretcher) {
                stretcher = me.widthStretcher = DomHelper.createElement({
                    className     : 'b-scroller-stretcher b-horizontal-stretcher',
                    // Should survive its surroundings being DomSynced
                    retainElement : true
                });
            }

            stretcher.style.transform = `translateX(${(scrollWidth - 1) * (isRTL ? -1 : 1)}px)`;

            if (element && !element.contains(stretcher)) {
                element.insertBefore(stretcher, element.firstElementChild);
            }
        }

        // Propagate call to partners so they will establish own scroller stretcher
        if (me.propagate !== false) {
            me.eachPartner(({ scroller }) => {
                // Raise a flag on partner to not propagate changes from it further
                scroller.propagate = false;
                scroller.scrollWidth = scrollWidth;
                delete scroller.propagate;
            });
        }

        me.positionDirty = true;

        me.syncOverflowState();
    }

    get scrollHeight() {
        return this.element?.scrollHeight ?? 0;
    }

    /**
     * The vertical scroll range of the widget. May be set to larger than the actual data
     * height to enable virtual scrolling. This is how the grid extends its scroll range
     * while only rendering a small subset of the dataset.
     * @property {Number}
     */
    set scrollHeight(scrollHeight) {
        const
            me        = this,
            stretcher = me.stretcher || (me.stretcher = DomHelper.createElement({
                className : 'b-scroller-stretcher'
            }));

        stretcher.style.transform = `translateY(${scrollHeight - 1}px)`;
        if (me.element && me.element.lastChild !== stretcher) {
            me.element.appendChild(stretcher);
        }

        me.positionDirty = true;

        me.syncOverflowState();
    }

    /**
     * The client width of the widget.
     * @property {Number}
     * @readonly
     */
    get clientWidth() {
        return this.element?.clientWidth || 0;
    }

    /**
     * The client height of the widget.
     * @property {Number}
     * @readonly
     */
    get clientHeight() {
        return this.element?.clientHeight || 0;
    }

    /**
     * The unique ID of this Scroller
     * @property {String}
     * @readonly
     */
    get id() {
        if (!this._id) {
            if (this.widget) {
                this._id = `${this.widget.id}-scroller`;
            }
            else {
                this._id = IdHelper.generateId('scroller-');
            }
        }
        return this._id;
    }

    //region Extract configs

    // This function is not meant to be called by any code other than Base#getCurrentConfig().
    preProcessCurrentConfigs(configs) {
        super.preProcessCurrentConfigs();

        delete configs.widget;
        delete configs.element;
    }

    //endregion
}
