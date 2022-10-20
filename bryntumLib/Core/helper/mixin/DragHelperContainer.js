import Base from '../../Base.js';
import GlobalEvents from '../../GlobalEvents.js';
import DomHelper from '../../helper/DomHelper.js';
import Rectangle from '../../helper/util/Rectangle.js';

// TODO: Use mousedown pos and not center too reposition

/**
 * @module Core/helper/mixin/DragHelperContainer
 */

/**
 * Mixin for DragHelper that handles dragging elements between containers (or rearranging within)
 *
 * @mixin
 * @private
 */
export default Target => class DragHelperContainer extends (Target || Base) {
    static get $name() {
        return 'DragHelperContainer';
    }

    //region Init

    /**
     * Initialize container drag mode.
     * @private
     */
    initContainerDrag() {
        const me = this;
        //use container drag as default mode
        if (!me.mode) {
            me.mode = 'container';
        }
        if (me.mode === 'container' && !me.containers) {
            throw new Error('Container drag mode must specify containers');
        }
    }

    //endregion

    //region Grab, update, finish

    /**
     * Grab an element which can be dragged between containers.
     * @private
     * @param event
     * @returns {Boolean}
     */
    grabContainerDrag(event) {
        const me = this;

        // allow specified selectors to prevent drag
        if (!me.ignoreSelector || !DomHelper.up(event.target, me.ignoreSelector)) {
            // go up from "handle" to draggable element
            const element = DomHelper.getAncestor(event.target, me.containers, me.outerElement);

            if (element) {
                const box = element.getBoundingClientRect();

                me.context = {
                    element,
                    valid            : true,
                    action           : 'container',
                    offsetX          : event.pageX - box.left,
                    offsetY          : event.pageY - box.top,
                    originalPosition : {
                        parent : element.parentElement,
                        prev   : element.previousElementSibling,
                        next   : element.nextElementSibling
                    }
                };
            }

            return true;
        }

        return false;
    }

    /**
     * Starts dragging, called when mouse moves first time after grabbing
     * @private
     * @param event
     */
    startContainerDrag(event) {
        const
            me                          = this,
            { context, floatRootOwner } = me,
            { element : dragElement }   = context,
            clonedNode                  = dragElement.cloneNode(true),
            box                         = dragElement.getBoundingClientRect(),
            outerWidgetEl               = floatRootOwner?.element.closest('.b-outer');

        // init drag proxy
        clonedNode.classList.add(me.dragProxyCls);
        clonedNode.classList.add(me.draggingCls);

        // Append drag proxy to float root, fall back to root context node
        (floatRootOwner?.floatRoot || DomHelper.getRootElement(dragElement)).appendChild(clonedNode);
        context.dragProxy = clonedNode;

        // Always set the proxy element width manually, drag target could be sized with flex or % width
        clonedNode.style.width  = box.width + 'px';
        clonedNode.style.height = box.height + 'px';
        DomHelper.setTranslateXY(context.dragProxy, box.left, box.top);

        // style dragged element
        context.dragging = dragElement;
        dragElement.classList.add(me.dropPlaceholderCls);

        // If element being dragged is also a child of the float root, add +1 to the cloned node z-index
        if (outerWidgetEl?.parentElement?.matches('.b-float-root')) {
            clonedNode.style.zIndex = floatRootOwner.floatRootMaxZIndex + 1;
        }
    }

    /**
     * Move the placeholder element into its new position on valid drag.
     * @private
     * @param event
     */
    updateContainerDrag(event) {
        const
            me          = this,
            { context } = me;

        if (!context.started || !context.targetElement) {
            return;
        }

        const
            containerElement = DomHelper.getAncestor(context.targetElement, me.containers, 'b-gridbase'),
            willLoseFocus    = context.dragging?.contains(DomHelper.getActiveElement(context.dragging));

        if (containerElement && DomHelper.isDescendant(context.element, containerElement)) {
            // dragging over part of self, do nothing
            return;
        }

        // The dragging element contains focus, and moving it within the DOM
        // will cause focus loss which might affect an encapsulating autoClose Popup.
        // Prevent focus loss handling during the DOM move.
        if (willLoseFocus) {
            GlobalEvents.suspendFocusEvents();
        }
        if (containerElement && context.valid) {
            me.moveNextTo(containerElement, event);
        }
        else {
            // dragged outside of containers, revert position
            me.revertPosition();
        }
        if (willLoseFocus) {
            GlobalEvents.resumeFocusEvents();
        }

        event.preventDefault();
    }

    /**
     * Finalize drag, fire drop.
     * @private
     * @param event
     * @fires drop
     */
    finishContainerDrag(event) {
        const
            me          = this,
            { context } = me,
            // extracting variables to make code more readable
            { dragging, dragProxy, valid, draggedTo, insertBefore, originalPosition } = context;

        if (dragging) {
            // needs to have a valid target
            context.valid = valid && draggedTo &&
                    // no drop on self or parent
                    (dragging !== insertBefore || originalPosition.parent !== draggedTo);

            context.finalize = (valid = context.valid) => {
                // revert if invalid (and context still exists, might have been aborted from outside)
                if (!valid && me.context) {
                    me.revertPosition();
                }

                dragging.classList.remove(me.dropPlaceholderCls);
                dragProxy.remove();

                me.reset();
            };

            // allow async finalization by setting async to true on context in drop handler,
            // requires implementer to call context.finalize later to finish the drop
            context.async = false;

            me.trigger('drop', { context, event });

            if (!context.async) {
                // finalize immediately
                context.finalize();
            }
        }
    }

    /**
     * Aborts a drag operation.
     * @private
     * @param {Boolean} [invalid]
     * @param {Object} [event]
     * @param {Boolean} [silent]
     */
    abortContainerDrag(invalid = false, event = null, silent = false) {
        const
            me          = this,
            { context } = me;

        if (context.dragging) {
            context.dragging.classList.remove(me.dropPlaceholderCls);
            context.dragProxy.remove();

            me.revertPosition();
        }

        if (!silent) {
            me.trigger(invalid ? 'drop' : 'abort', { context, event });
        }

        me.reset();
    }

    //endregion

    //region Helpers

    /**
     * Updates the drag proxy position.
     * @private
     * @param event
     */
    updateContainerProxy(event) {
        const
            me          = this,
            { context } = me,
            proxy       = context.dragProxy;

        let newX = event.pageX - context.offsetX,
            newY = event.pageY - context.offsetY;

        if (typeof me.minX === 'number') {
            newX = Math.max(me.minX, newX);
        }

        if (typeof me.maxX === 'number') {
            newX = Math.min(me.maxX - proxy.offsetWidth, newX);
        }

        if (typeof me.minY === 'number') {
            newY = Math.max(me.minY, newY);
        }

        if (typeof me.maxY === 'number') {
            newY = Math.min(me.maxY  - proxy.offsetHeight, newY);
        }

        if (me.lockX) {
            DomHelper.setTranslateY(proxy, newY);
        }
        else if (me.lockY) {
            DomHelper.setTranslateX(proxy, newX);
        }
        else {
            DomHelper.setTranslateXY(proxy, newX, newY);
        }

        let targetElement;

        if (event.type === 'touchmove') {
            const touch = event.changedTouches[0];
            targetElement = DomHelper.elementFromPoint(touch.clientX, touch.clientY);
        }
        else {
            targetElement = event.target;
        }

        context.targetElement = targetElement;
    }

    /**
     * Positions element being dragged in relation to targetElement.
     * @private
     * @param targetElement
     * @param event
     */
    moveNextTo(targetElement, event) {
        const
            { context } = this,
            dragElement = context.dragging,
            parent      = targetElement.parentElement;

        if (targetElement !== dragElement) {
            // dragged over a container and not over self, calculate where to insert

            const centerX = Rectangle.from(targetElement).center.x;

            if ((this.isRTL && event.pageX > centerX) || (!this.isRTL && event.pageX < centerX)) {
                // dragged left of target center, insert before
                parent.insertBefore(dragElement, targetElement);
                context.insertBefore = targetElement;
            }
            else {
                // dragged right of target center, insert after
                if (targetElement.nextElementSibling) {
                    // check that not dragged to the immediate left of self. in such case, position should not change
                    if (targetElement.nextElementSibling !== dragElement) {
                        context.insertBefore = targetElement.nextElementSibling;
                        parent.insertBefore(dragElement, targetElement.nextElementSibling);
                    }
                    else if (!context.insertBefore && dragElement.parentElement.lastElementChild !== dragElement) {
                        // dragged left initially, should stay in place (checked in finishContainerDrag)
                        // TODO: or flag as invalid drag? since no change...
                        context.insertBefore = targetElement.nextElementSibling;
                    }
                }
                else {
                    parent.appendChild(dragElement);
                    context.insertBefore = null;
                }
            }

            context.draggedTo = parent;
        }
    }

    /**
     * Moves element being dragged back to its original position.
     * @private
     */
    revertPosition() {
        const
            { context }      = this,
            { dragging }     = context,
            { parent, next } = context.originalPosition;

        // revert to correct location
        if (next) {
            const isNoop = next.previousSibling === dragging || (!next && dragging === parent.lastChild);

            if (!isNoop) {
                parent.insertBefore(dragging, next);
            }
        }
        else {
            parent.appendChild(dragging);
        }

        // no target container
        context.draggedTo = null;
    }

    //endregion
};
