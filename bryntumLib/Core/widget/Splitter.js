import Widget from './Widget.js';
import DomHelper from '../helper/DomHelper.js';
import EventHelper from '../helper/EventHelper.js';
import BrowserHelper from '../helper/BrowserHelper.js';

/**
 * @module Core/widget/Splitter
 */

const
    classesHV = ['b-horizontal', 'b-vertical'],
    hasFlex = el => DomHelper.getStyleValue(el.parentElement, 'display') === 'flex' &&
        (parseInt(DomHelper.getStyleValue(el, 'flex-basis'), 10) || parseInt(DomHelper.getStyleValue(el, 'flex-grow'), 10)),
    verticality = {
        horizontal : false,
        vertical   : true
    };

/**
 * A simple splitter widget that resizes the elements next to it or above/below it depending on orientation.
 *
 * @extends Core/widget/Widget
 * @classType splitter
 * @inlineexample Core/widget/Splitter.js
 */
export default class Splitter extends Widget {
    //region Config

    static get $name() {
        return 'Splitter';
    }

    // Factoryable type name
    static get type() {
        return 'splitter';
    }

    static get configurable() {
        return {
            /**
             * Fired when a drag starts
             * @event dragStart
             * @param {Core.widget.Splitter} source The Splitter
             * @param {MouseEvent|TouchEvent} event The DOM event
             */

            /**
             * Fired while dragging
             * @event drag
             * @param {Core.widget.Splitter} source The Splitter
             * @param {MouseEvent|TouchEvent} event The DOM event
             */

            /**
             * Fired after a drop
             * @event drop
             * @param {Core.widget.Splitter} source The Splitter
             * @param {MouseEvent|TouchEvent} event The DOM event
             */

            /**
             * Splitter orientation, see {@link #config-orientation}. When set to 'auto' then actually used orientation
             * can be retrieved using {@link #property-currentOrientation}.
             * @member {'auto'|'horizontal'|'vertical'} orientation
             * @readonly
             */
            /**
             * The splitters orientation, configurable with 'auto', 'horizontal' or 'vertical'.
             *
             * 'auto' tries to determine the orientation by either checking the `flex-direction` of the parent element
             * or by comparing the positions of the closest sibling elements to the splitter. If they are above and
             * below 'horizontal' is used, if not it uses 'vertical'.
             *
             * ```
             * new Splitter({
             *    orientation : 'horizontal'
             * });
             * ```
             *
             * To receive the actually used orientation when configured with 'auto', see
             * {@link #property-currentOrientation}.
             *
             * @config {'auto'|'horizontal'|'vertical'}
             * @default
             */
            orientation : 'auto',

            vertical : null,

            containerElement : {
                $config : 'nullify',
                value   : null
            },

            nextNeighbor : {
                $config : 'nullify',
                value   : null
            },

            previousNeighbor : {
                $config : 'nullify',
                value   : null
            }
        };
    }

    static get delayable() {
        return {
            syncState : 'raf'
        };
    }

    //endregion

    //region Init & destroy

    doDestroy() {
        this.mouseDetacher?.();

        super.doDestroy();
    }

    //endregion

    //region Template & element

    compose() {
        return {
            class : {
                'b-splitter' : 1
            },

            listeners : {
                pointerdown : 'onMouseDown',
                mouseenter  : 'syncState',

                ...(!BrowserHelper.supportsPointerEvents && {
                    mousedown  : 'onMouseDown',
                    touchstart : 'onMouseDown'
                })
            }
        };
    }

    //endregion

    //region Orientation

    /**
     * Get actually used orientation, which is either the configured value for `orientation` or if configured with
     * 'auto' the currently used orientation.
     * @property {String}
     * @readonly
     */
    get currentOrientation() {
        return this.vertical ? 'vertical' : 'horizontal';
    }

    get nextWidget() {
        return Widget.fromElement(this.element.nextElementSibling, 1);
    }

    get previousWidget() {
        return Widget.fromElement(this.element.previousElementSibling, 1);
    }

    updateContainerElement(containerElement) {
        const me = this;

        me.stateDetector = me.stateDetector?.disconnect();

        if (containerElement) {
            me.stateDetector = new MutationObserver(() => me.syncState());  // syncState runs on next raf

            me.stateDetector.observe(containerElement, {
                attributes : true,  // in case style changes flip our orientation (when == 'auto')
                childList  : true   // watch for our neighbors to render (so we can disable on hidden/collapsed state)
            });
        }
    }

    updateNextNeighbor(next) {
        this.watchNeighbor(next, 'next');
    }

    updatePreviousNeighbor(previous) {
        this.watchNeighbor(previous, 'previous');
    }

    watchNeighbor(neighbor, name) {
        this.detachListeners(name);

        neighbor?.on({
            name,
            thisObj  : this,
            collapse : 'syncState',
            expand   : 'syncState',
            hide     : 'syncState',
            show     : 'syncState'
        });
    }

    updateOrientation() {
        this.syncState.now();
    }

    updateVertical(vertical) {
        const classList = this.element?.classList;

        classList?.add(classesHV[vertical ? 1 : 0]);
        classList?.remove(classesHV[vertical ? 0 : 1]);
    }

    /**
     * Determine orientation when set to `'auto'` and detects neighboring widgets to monitor their hidden/collapsed
     * states.
     * @private
     */
    syncState() {
        const
            me                                      = this,
            { element, nextWidget, previousWidget } = me;

        let vertical = verticality[me.orientation] ?? null;

        me.nextNeighbor     = nextWidget;
        me.previousNeighbor = previousWidget;

        me.disabled = (
            nextWidget && ((nextWidget.collapsible && nextWidget.collapsed) || nextWidget.hidden)
        ) || (
            previousWidget && ((previousWidget.collapsible && previousWidget.collapsed) || previousWidget.hidden)
        );

        if (vertical !== null && nextWidget && previousWidget) {
            me.containerElement = null;
        }
        else {
            // we'll need to monitor parent element child list changes until our neighbors are added to the DOM
            me.containerElement = element.parentElement;

            // Orientation auto and already rendered, determine orientation to use
            if (me.rendered && element.offsetParent) {
                const flexDirection = DomHelper.getStyleValue(element.parentElement, 'flex-direction');

                // If used in a flex layout, determine orientation from flex-direction
                if (flexDirection) {
                    vertical = !flexDirection.startsWith('column');
                }
                // If used in some other layout, try to determine from sibling elements position
                else {
                    const
                        previous = element.previousElementSibling,
                        next = element.nextElementSibling;

                    if (!previous || !next) {
                        // To early in rendering, next sibling not rendered yet
                        return;
                    }

                    const
                        prevRect = previous.getBoundingClientRect(),
                        nextRect = next.getBoundingClientRect(),
                        topMost = prevRect.top < nextRect.top ? prevRect : nextRect,
                        bottomMost = topMost === nextRect ? prevRect : nextRect;

                    // orientation = topMost.top !== bottomMost.top ? 'horizontal' : 'vertical';
                    vertical = topMost.top === bottomMost.top;
                }
            }
        }

        me.vertical = vertical;
    }

    //endregion

    //region Events

    onMouseDown(event) {
        event.preventDefault();

        if (event.touches) {
            event = event.touches[0];
        }

        const
            me          = this,
            { element } = me,
            prev        = element.previousElementSibling,
            next        = element.nextElementSibling,
            prevHasFlex = hasFlex(prev),
            nextHasFlex = hasFlex(next),
            flexed      = [];

        // First stop any ongoing drag operation, since we cannot trust that we always get the mouseup event
        me.mouseDetacher?.();

        // Remember flexed children, to enable maintaining their proportions on resize
        for (const child of element.parentElement.children) {
            if (hasFlex(child) && child !== element) {
                flexed.push({
                    element : child,
                    width   : child.offsetWidth,
                    height  : child.offsetHeight
                });
            }
        }

        me.context = {
            startX     : event.pageX,
            startY     : event.pageY,
            prevWidth  : prev.offsetWidth,
            prevHeight : prev.offsetHeight,
            nextWidth  : next.offsetWidth,
            nextHeight : next.offsetHeight,
            prevHasFlex,
            nextHasFlex,
            flexed,
            prev,
            next
        };

        const events = {
            element     : document,
            pointermove : 'onMouseMove',
            pointerup   : 'onMouseUp',
            thisObj     : me
        };

        // TODO : Re-evaluate if this is needed in 2023, https://caniuse.com/pointer
        if (!BrowserHelper.supportsPointerEvents) {
            events.mousemove = events.touchmove = 'onMouseMove';
            events.mouseup   = events.touchend  = 'onMouseUp';
        }

        element.classList.add('b-moving');
        me.mouseDetacher = EventHelper.on(events);
    }

    onMouseMove(event) {
        const
            me        = this,
            {
                context,
                nextWidget,
                previousWidget
            }         = me,
            prevStyle = context.prev.style,
            nextStyle = context.next.style,
            deltaX    = (event.pageX - context.startX) * (me.rtl ? -1 : 1),
            deltaY    = event.pageY - context.startY;

        event.preventDefault();

        Object.assign(context, {
            deltaX,
            deltaY
        });

        if (!context.started) {
            context.started = true;

            me.trigger('dragStart', { context, event });

            // Convert heights/widths to flex for flexed elements to maintain proportions
            // 100px high -> flex-grow 100
            context.flexed.forEach(flexed => {
                flexed.element.style.flexGrow = me.vertical ? flexed.width : flexed.height;
                //Remove flex-basis, since it interferes with resizing
                flexed.element.style.flexBasis = '0';
            });
        }

        // Adjust flex-grow or width/height for splitters closest siblings
        if (me.vertical) {
            const
                newPrevWidth = context.prevWidth + deltaX,
                newNextWidth = context.nextWidth - deltaX;

            if (context.prevHasFlex) {
                prevStyle.flexGrow = newPrevWidth;
            }
            else if (previousWidget) {
                previousWidget.width = newPrevWidth;
            }
            else {
                prevStyle.width = `${newPrevWidth}px`;
            }

            if (context.nextHasFlex) {
                nextStyle.flexGrow = newNextWidth;
            }
            else if (nextWidget) {
                nextWidget.width = newNextWidth;
            }
            else {
                nextStyle.width = `${newNextWidth}px`;
            }
        }
        else {
            const
                newPrevHeight = context.prevHeight + deltaY,
                newNextHeight = context.nextHeight - deltaY;

            if (context.prevHasFlex) {
                prevStyle.flexGrow = newPrevHeight;
            }
            else if (previousWidget) {
                previousWidget.height = newPrevHeight;
            }
            else {
                prevStyle.height = `${newPrevHeight}px`;
            }

            if (context.nextHasFlex) {
                nextStyle.flexGrow = newNextHeight;
            }
            else if (nextWidget) {
                nextWidget.height = newNextHeight;
            }
            else {
                nextStyle.height = `${newNextHeight}px`;
            }
        }

        me.trigger('drag', { context, event });
    }

    onMouseUp(event) {
        const me = this;

        me.mouseDetacher?.();
        me.mouseDetacher = null;
        me.element.classList.remove('b-moving');

        if (me.context.started) {
            me.trigger('drop', { context : me.context, event });
        }

        me.context = null;
    }

    //endregion

    render() {
        super.render(...arguments);

        this.syncState.now();

        if (this.vertical === null) {
            this.syncState();  // try again on next raf
        }
    }
}

// Register this widget type with its Factory
Splitter.initClass();
