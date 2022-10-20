/* globals ResizeObserver: true */
import DomHelper, { hasLayout } from './DomHelper.js';
import ArrayHelper from './ArrayHelper.js';

let resizeFireTimer = null;

const resizedQueue = [],
    isAbsolutelyPositioned = n => n.nodeType === n.ELEMENT_NODE && n.ownerDocument.defaultView?.getComputedStyle(n).getPropertyValue('position') === 'absolute';

/**
 * @module Core/helper/ResizeMonitor
 */

/**
 * Allows size monitoring of elements (or optionally a Window instance).
 *
 * ```
 * ResizeMonitor.addResizeListener(
 *   myElement,
 *   element => {
 *      console.log(element, ' changed size');
 *   }
 * );
 * ```
 *
 * @internal
 */
export default class ResizeMonitor {
    /**
     * Adds a resize listener to the passed element which is called when the element
     * is resized by layout.
     * @param {HTMLElement} element The element to listen for resizing.
     * @param {Function} handler The handling function. Will be passed the element.
     */
    static addResizeListener(element, handler) {
        const me = this;

        if (element === document || element === globalThis) {
            element = document.body;
        }

        if (element.nodeType === element.DOCUMENT_FRAGMENT_NODE) {
            element = element.host;
        }

        if (!element.classList.contains('b-resize-monitored')) {
            element.classList.add('b-resize-monitored');
            element._bResizemonitor = {
                handlers : []
            };
        }

        // If we're looking at the document, or body, use a window resize listener.
        if (element === document.body) {
            if (!me.hasWindowResizeListener) {
                // Throttle the reaction to window resize to only fire once every 100ms
                globalThis.addEventListener('resize', me.onWindowResize);
                me.hasWindowResizeListener = true;
            }
        }
        // Regular element - use ResizeObserver by preference
        else if (globalThis.ResizeObserver) {
            if (!me.resizeObserver) {
                me.resizeObserver = new ResizeObserver(me.onElementResize);
            }
            me.resizeObserver.observe(element);
        }
        // Polyfill ResizeObserver
        else {
            element.classList.add('b-no-resizeobserver');

            const [monitors, expand, shrink] = DomHelper.createElement({
                parent    : element,
                className : 'b-resize-monitors',
                children  : [{
                    className : 'b-resize-monitor-expand'
                }, {
                    className : 'b-resize-monitor-shrink'
                }]
            }, { returnAll : true });
            expand.scrollLeft = expand.scrollTop = shrink.scrollLeft = shrink.scrollTop = 1000000;
            expand.addEventListener('scroll', me.onSizeMonitorScroll, true);
            shrink.addEventListener('scroll', me.onSizeMonitorScroll, true);

            // Also need to fake a resize-scroll on DOM mutation
            (handler.targetMutationMonitor = new MutationObserver((m) => {
                const
                    addedNodes   = [],
                    removedNodes = [];

                // MutationObserver may report a mutation which consists of removing a node and adding it back again.
                // We need to filter such nodes
                for (const mr of m) {
                    if (mr.type === 'childList') {
                        addedNodes.push.apply(addedNodes, mr.addedNodes);
                        removedNodes.push.apply(removedNodes, mr.removedNodes);
                    }
                }

                const changedNodes = [
                    ...addedNodes.filter(r => !removedNodes.includes(r)),
                    ...removedNodes.filter(r => !addedNodes.includes(r))
                ];

                if (changedNodes.length === 0) {
                    return;
                }

                // If the changed nodes were absolutely positioned, then they won't
                // cause a resize, so return
                if (changedNodes.length > 0 && changedNodes.every(isAbsolutelyPositioned)) {
                    return;
                }

                // We only want the size monitor listener to trigger, so this event must NOT bubble
                // to any application or other framework listeners.
                expand.dispatchEvent(new CustomEvent('scroll', { bubbles : false }));
            })).observe(element, {
                childList : true,
                subtree   : true
            });

            // store reference for easier cleanup later
            handler.monitorElement = monitors;
        }
        element._bResizemonitor.handlers.push(handler);
    }

    /**
     * Removes a resize listener from the passed element.
     * @param {HTMLElement} element The element to listen for resizing.
     * @param {Function} handler The handling function to remove.
     */
    static removeResizeListener(element, handler) {
        if (element) {
            if (element === document || element === globalThis) {
                element = document.body;
            }
            const resizeMonitor = element._bResizemonitor;

            let listenerCount = 0;

            if (resizeMonitor && resizeMonitor.handlers) {
                ArrayHelper.remove(resizeMonitor.handlers, handler);

                // See if we should unobserve the element
                listenerCount = resizeMonitor.handlers.length;
            }

            // Down to no listeners.
            if (!listenerCount) {
                element.classList.remove('b-resize-monitored');

                if (this.resizeObserver) {
                    this.resizeObserver.unobserve(element);
                }
                // Remove the polyfill resize listeners
                else {
                    // remove any added elements
                    if (handler.monitorElement) {
                        handler.monitorElement.remove();
                        handler.monitorElement = null;
                    }
                    // remove the DOM mutation observer
                    if (handler.targetMutationMonitor) {
                        handler.targetMutationMonitor.disconnect();
                    }
                }
            }
        }
    }

    static onElementResize(entries) {
        for (const resizeObserverEntry of entries) {
            const
                resizedElement = resizeObserverEntry.target,
                resizeMonitor  = resizedElement._bResizemonitor,
                newRect        = resizeObserverEntry.contentRect || resizedElement.getBoundingClientRect();

            if (hasLayout(resizedElement)) {
                if (!resizeMonitor.rectangle || newRect.width !== resizeMonitor.rectangle.width || newRect.height !== resizeMonitor.rectangle.height) {
                    const oldRect = resizeMonitor.rectangle;
                    resizeMonitor.rectangle = newRect;
                    for (const resizeHandler of resizeMonitor.handlers) {
                        resizeHandler(resizedElement, oldRect, newRect);
                    }
                }
            }
        }
    }

    static onSizeMonitorScroll(e) {
        // If no body exists or the element has gone, ignore the event; the listener will be removed automatically.
        if (document.body?.contains(e.target)) {
            e.stopImmediatePropagation();

            const monitorNode    = e.target.parentNode,
                resizedElement = monitorNode.parentNode,
                resizeMonitor  = resizedElement._bResizemonitor,
                newRect        = resizedElement.getBoundingClientRect();

            if (!resizeMonitor.rectangle || newRect.width !== resizeMonitor.rectangle.width || newRect.height !== resizeMonitor.rectangle.height) {
                resizedQueue.push([resizedElement, resizeMonitor.rectangle, newRect]);
                resizeMonitor.rectangle = newRect;
                if (!resizeFireTimer) {
                    resizeFireTimer = requestAnimationFrame(ResizeMonitor.fireResizeEvents);
                }
            }
            monitorNode.firstChild.scrollLeft = monitorNode.firstChild.scrollTop = monitorNode.childNodes[1].scrollTop = monitorNode.childNodes[1].scrollLeft = 1000000;
        }
    }

    static onWindowResize(e) {
        const
            resizedElement = document.body,
            resizeMonitor  = resizedElement._bResizemonitor,
            oldRect        = resizeMonitor.rectangle;

        resizeMonitor.rectangle = document.documentElement.getBoundingClientRect();

        for (const resizeHandler of resizeMonitor.handlers) {
            resizeHandler(resizedElement, oldRect, resizeMonitor.rectangle);
        }
    }

    static fireResizeEvents() {
        for (const resizedEntry of resizedQueue) {
            for (const resizeHandler of resizedEntry[0]._bResizemonitor.handlers) {
                // Checking offsetParent to avoid resizing of elements which are not visible or exist in DOM
                if (resizedEntry[0].offsetParent) {
                    resizeHandler.apply(this, resizedEntry);
                }
            }
        }
        resizeFireTimer = null;
        resizedQueue.length = 0;
    }
}
