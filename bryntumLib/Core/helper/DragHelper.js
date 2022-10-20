import Base from '../Base.js';
import Events from '../mixin/Events.js';
import DragHelperContainer from './mixin/DragHelperContainer.js';
import DragHelperTranslate from './mixin/DragHelperTranslate.js';
import DomHelper from './DomHelper.js';
import EventHelper from './EventHelper.js';
import ObjectHelper from './ObjectHelper.js';
import Rectangle from './util/Rectangle.js';

/**
 * @module Core/helper/DragHelper
 */

const rootElementListeners = {
    move       : 'onMouseMove',
    up         : 'onMouseUp',
    docclick   : 'onDocumentClick',
    touchstart : 'onTouchStart',
    touchmove  : 'onTouchMove',
    touchend   : 'onTouchEnd',
    keydown    : 'onKeyDown'
};

/**
 * ## Intro
 * A drag drop helper class which lets you move elements in page. It supports:
 *
 *  * Dragging the actual element
 *  * Dragging a cloned version of the element
 *  * Dragging extra `relatedElements` along with the main element
 *  * Firing useful events {@link #event-beforeDragStart}, {@link #event-dragStart}, {@link #event-drag}, {@link #event-drop}, {@link #event-abort}
 *  * Validation by setting a `valid` Boolean on the drag context object provided to event listeners
 *  * Aborting drag with ESCAPE key
 *  * Constraining drag to be only horizontal or vertical using {@link #config-lockX} and {@link #config-lockY}
 *  * Defining X / Y boundaries using {@link #config-minX}, {@link #config-maxX} and {@link #config-minY}, {@link #config-maxY}
 *  * Async finalization (e.g. to show confirmation prompts)
 *  * Animated final transition after mouse up of a valid drop (see {@link #function-animateProxyTo})
 *  * Animated abort transition after an invalid or aborted drop
 *
 * {@inlineexample Core/helper/DragHelper.js}
 *
 * ## Two modes
 *
 * DragHelper supports two {@link #config-mode modes}:
 *
 * * `container` - moving / rearranging elements within and between specified containers
 * * `translateXY` - freely repositioning an element, either using the element or a cloned version of it - a "drag proxy" (default mode)
 *
 * ## Container drag mode
 *
 * Container drag should be used when moving or rearranging child elements within and between specified containers
 *
 * Example:
 * ```javascript
 * // dragging element between containers
 * let dragHelper = new DragHelper({
 *   mode       : 'container',
 *   containers : [ container1, container2 ]
 * });
 *```
 *
 * ## Translate drag mode
 *
 * Use translate drag to reposition an element within its container using transform CSS.
 *
 * Example:
 * ```javascript
 * // dragging element within container
 * let dragHelper = new DragHelper({
 *   mode           : 'translateXY',
 *   targetSelector : 'div.movable'
 * });
 * ```
 *
 * ## Observable events
 * In the various events fired by the DragHelper, you will have access to the raw DOM event and some useful `context` about the drag operation:
 *
 * ```javascript
 *  myDrag.on({
 *      drag : ({event , context}) {
 *            // The element which we're moving, could be a cloned version of grabbed, or the grabbed element itself
 *           const element = context.element;
 *
 *           // The original mousedown element upon which triggered the drag operation
 *           const grabbed = context.grabbed;
 *
 *           // The target under the current mouse / pointer / touch position
 *           const target = context.target;
 *       }
 *  });
 * ```
 *
 * ## Simple drag helper subclass with a drop target specified:
 * ```javascript
 * export default class MyDrag extends DragHelper {
 *      static get defaultConfig() {
 *          return {
 *              // Don't drag the actual cell element, clone it
 *              cloneTarget        : true,
 *              mode               : 'translateXY',
 *              // Only allow drops on DOM elements with 'yourDropTarget' CSS class specified
 *              dropTargetSelector : '.yourDropTarget',
 *
 *              // Only allow dragging elements with the 'draggable' CSS class
 *              targetSelector : '.draggable'
 *          };
 *      }
 *
 *      construct(config) {
 *          const me = this;
 *
 *          super.construct(config);
 *
 *          me.on({
 *              dragstart : me.onDragStart
 *          });
 *      }
 *
 *      onDragStart({ event, context }) {
 *          const target = context.target;
 *
 *          // Here you identify what you are dragging (an image of a user, grid row in an order table etc) and map it to something in your
 *          // data model. You can store your data on the context object which is available to you in all drag-related events
 *          context.userId = target.dataset.userId;
 *      }
 *
 *      onEquipmentDrop({ context, event }) {
 *          const me = this;
 *
 *          if (context.valid) {
 *              const userId   = context.userId,
 *                    droppedOnTarget = context.target;
 *
 *              console.log(`You dropped user ${userStore.getById(userId).name} on ${droppedOnTarget}`, droppedOnTarget);
 *
 *              // Dropped on a scheduled event, display toast
 *              WidgetHelper.toast(`You dropped user ${userStore.getById(userId).name} on ${droppedOnTarget}`);
 *          }
 *      }
 *  };
 * ```
 *
 * ## Dragging multiple elements
 *
 * You can tell the DragHelper to also move additional `relatedElements` when a drag operation is starting. Simply
 * provide an array of elements on the context object:
 *
 * ```javascript
 * new DragHelper ({
 *     callOnFunctions : true,
 *
 *     onDragStart({ context }) {
 *          // Let drag helper know about extra elements to drag
 *          context.relatedElements = Array.from(element.querySelectorAll('.b-resource-avatar'));
 *     }
 * });
 * ```
 *
 * ## Creating a custom drag proxy
 *
 * Using the {@link #function-createProxy} you can create any markup structure to use when dragging cloned targets.
 *
 * ```javascript
 * new DragHelper ({
 *    callOnFunctions      : true,
 *    // Don't drag the actual cell element, clone it
 *    cloneTarget          : true,
 *    // We size the cloned element using CSS
 *    autoSizeClonedTarget : false,
 *
 *    mode               : 'translateXY',
 *    // Only allow drops on certain DOM nodes
 *    dropTargetSelector : '.myDropTarget',
 *    // Only allow dragging cell elements in a Bryntum Grid
 *    targetSelector     : '.b-grid-row:not(.b-group-row) .b-grid-cell'
 *
 *    // Here we receive the element where the drag originated and we can choose to return just a child element of it
 *    // to use for the drag proxy (such as an icon)
 *    createProxy(element) {
 *        return element.querySelector('i').cloneNode();
 *    }
 * });
 * ```
 *
 * ## Animating a cloned drag proxy to a point before finalizing
 *
 * To provide users with the optimal user experience, you can set a `transitionTo` object (with `target` element and
 * `align` spec) on the DragHelper´s `context` object inside a {@link #event-drop} listener (only applies to translate
 * {@link #config-mode mode} operations). This will trigger a final animation of the drag proxy which should represent
 * the change of data state that will be triggered by the drop.
 *
 * You can see this in action in Gantt´s `drag-resource-from-grid` demo.
 *
 * ```javascript
 * new DragHelper ({
 *    callOnFunctions      : true,
 *    // Don't drag the actual cell element, clone it
 *    cloneTarget          : true,
 *    // We size the cloned element using CSS
 *    autoSizeClonedTarget : false,
 *
 *    mode               : 'translateXY',
 *    // Only allow drops on certain DOM nodes
 *    dropTargetSelector : '.myDropTarget',
 *    // Only allow dragging cell elements in a Bryntum Grid
 *    targetSelector     : '.b-grid-row:not(.b-group-row) .b-grid-cell'
 *
 *    // Here we receive the element where the drag originated and we can choose to return just a child element of it
 *    // to use for the drag proxy (such as an icon)
 *    createProxy(element) {
 *        return element.querySelector('i').cloneNode();
 *    },
 *
 *    async onDrop({ context, event }) {
 *       // If it's a valid drop, provide a point to animate the proxy to before finishing the operation
 *      if (context.valid) {
 *          await this.animateProxyTo(someElement, {
 *               // align left side of drag proxy to right side of the someElement
 *               align  : 'l0-r0'
 *          });
 *      }
 *      else {
 *          Toast.show(`You cannot drop here`);
 *      }
 *   }
 * });
 * ```
 *
 * @mixes Core/mixin/Events
 * @extends Core/Base
 */
export default class DragHelper extends Base.mixin(Events, DragHelperContainer, DragHelperTranslate) {
    //region Config

    static get defaultConfig() {
        return {
            /**
             * Drag proxy CSS class
             * @config {String}
             * @default
             * @private
             */
            dragProxyCls : 'b-drag-proxy',

            /**
             * CSS class added when drag is invalid
             * @config {String}
             * @default
             */
            invalidCls : 'b-drag-invalid',

            /**
             * CSS class added to the source element in Container drag
             * @config {String}
             * @default
             * @private
             */
            draggingCls : 'b-dragging',

            /**
             * CSS class added to the source element in Container drag
             * @config {String}
             * @default
             * @private
             */
            dropPlaceholderCls : 'b-drop-placeholder',

            /**
             * The amount of pixels to move mouse before it counts as a drag operation
             * @config {Number}
             * @default
             */
            dragThreshold : 5,

            /**
             * The outer element where the drag helper will operate (attach events to it and use as outer limit when looking for ancestors)
             * @config {HTMLElement}
             * @default
             */
            outerElement : document.body,

            /**
             * Outer element that limits where element can be dragged
             * @config {HTMLElement}
             */
            dragWithin : null,

            /**
             * Set to true to stack any related dragged elements below the main drag proxy element. Only applicable when
             * using translate {@link #config-mode} with {@link #config-cloneTarget}
             * @config {Boolean}
             */
            unifiedProxy : null,

            monitoringConfig : null,

            /**
             * Constrain translate drag to dragWithin elements bounds (set to false to allow it to "overlap" edges)
             * @config {Boolean}
             * @default
             */
            constrain : true,

            /**
             * Smallest allowed x when dragging horizontally.
             * @config {Number}
             */
            minX : null,

            /**
             * Largest allowed x when dragging horizontally.
             * @config {Number}
             */
            maxX : null,

            /**
             * Smallest allowed y when dragging horizontally.
             * @config {Number}
             */
            minY : null,

            /**
             * Largest allowed y when dragging horizontally.
             * @config {Number}
             */
            maxY : null,

            /**
             * Enabled dragging, specify mode:
             * <table>
             * <tr><td>container<td>Allows reordering elements within one and/or between multiple containers
             * <tr><td>translateXY<td>Allows dragging within a parent container
             * </table>
             * @config {'container'|'translateXY'}
             * @default
             */
            mode : 'translateXY',

            /**
             * A function that determines if dragging an element is allowed. Gets called with the element as argument,
             * return true to allow dragging or false to prevent.
             * @config {Function}
             */
            isElementDraggable : null,

            /**
             * A CSS selector used to determine if dragging an element is allowed.
             * @config {String}
             */
            targetSelector : null,

            /**
             * A CSS selector used to determine if a drop is allowed at the current position.
             * @config {String}
             */
            dropTargetSelector : null,

            /**
             * A CSS selector added to each drop target element while dragging.
             * @config {String}
             */
            dropTargetCls : null,

            /**
             * A CSS selector used to target a child element of the mouse down element, to use as the drag proxy element.
             * Applies to translate {@link #config-mode mode} when using {@link #config-cloneTarget}.
             * @config {String}
             */
            proxySelector : null,

            /**
             * Set to `true` to clone the dragged target, and not move the actual target DOM node.
             * @config {Boolean}
             * @default
             */
            cloneTarget : false,

            /**
             * Set to `false` to not apply width/height of cloned drag proxy elements.
             * @config {Boolean}
             * @default
             */
            autoSizeClonedTarget : true,

            /**
             * Set to true to hide the original element while dragging (applicable when `cloneTarget` is true).
             * @config {Boolean}
             * @default
             */
            hideOriginalElement : false,

            /**
             * Containers whose elements can be rearranged (and moved between the containers). Used when
             * mode is set to "container".
             * @config {HTMLElement[]}
             */
            containers : null,

            /**
             * A CSS selector used to exclude elements when using container mode
             * @config {String}
             */
            ignoreSelector : null,

            startEvent : null,

            /**
             * Configure as `true` to disallow dragging in the `X` axis. The dragged element will only move vertically.
             * @config {Boolean}
             * @default
             */
            lockX : false,

            /**
             * Configure as `true` to disallow dragging in the `Y` axis. The dragged element will only move horizontally.
             * @config {Boolean}
             * @default
             */
            lockY : false,

            /**
             * The amount of milliseconds to wait after a touchstart, before a drag gesture will be allowed to start.
             * @config {Number}
             * @default
             */
            touchStartDelay : 300,

            /**
             * Scroll manager of the target. If specified, scrolling while dragging is supported.
             * @config {Core.util.ScrollManager}
             */
            scrollManager : null,

            /**
             * A method provided to snap coordinates to fixed points as you drag
             * @config {Function}
             * @internal
             */
            snapCoordinates : null,

            /**
             * When using {@link #config-unifiedProxy}, use this amount of pixels to offset each extra element when dragging multiple items
             * @config {Number}
             * @default
             */
            unifiedOffset : 5,

            /**
             * Configure as `false` to take ownership of the proxy element after a valid drop (advanced usage).
             * @config {Boolean}
             * @default
             */
            removeProxyAfterDrop : true,

            clickSwallowDuration : 50,

            ignoreSamePositionDrop : true,

            // for container mode
            floatRootOwner : null,

            mouseMoveListenerElement : document,

            testConfig : {
                transitionDuration   : 10,
                clickSwallowDuration : 50,
                touchStartDelay      : 100
            },

            rtlSource : null
        };
    }

    //endregion

    //region Events

    /**
     * Fired before dragging starts, return `false` to prevent the drag operation.
     * @preventable
     * @event beforeDragStart
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {HTMLElement} context.element The original element upon which the mousedown event triggered a drag operation
     * @param {MouseEvent|TouchEvent} event
     */

    /**
     * Fired when dragging starts. The event includes a `context` object. If you want to drag additional elements you can
     * provide these as an array of elements assigned to the `relatedElements` property of the context object.
     * @event dragStart
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {HTMLElement} context.element The element which we're moving, could be a cloned version of grabbed, or the grabbed element itself
     * @param {HTMLElement} context.grabbed The original element upon which the mousedown event triggered a drag operation
     * @param {HTMLElement[]} context.relatedElements Array of extra elements to include in the drag.
     * @param {MouseEvent|TouchEvent} event
     */

    /**
     * Fired while dragging, you can signal that the drop is valid or invalid by setting `context.valid = false;`
     * @event drag
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {HTMLElement} context.element The element which we are moving, could be a cloned version of grabbed, or the grabbed element itself
     * @param {HTMLElement} context.target The target element below the cursor
     * @param {HTMLElement} context.grabbed The original element upon which the mousedown event triggered a drag operation
     * @param {HTMLElement[]} context.relatedElements An array of extra elements dragged with the main dragged element
     * @param {Boolean} context.valid Set this to true or false to indicate whether the drop position is valid.
     * @param {MouseEvent} event
     */

    /**
     * Fired after a drop at an invalid position
     * @event abort
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {HTMLElement} context.element The element which we are moving, could be a cloned version of grabbed, or the grabbed element itself
     * @param {HTMLElement} context.target The target element below the cursor
     * @param {HTMLElement} context.grabbed The original element upon which the mousedown event triggered a drag operation
     * @param {HTMLElement[]} context.relatedElements An array of extra elements dragged with the main dragged element
     * @param {MouseEvent} event
     */

    /**
     * Fires after {@link #event-abort} and after drag proxy has animated back to its original position
     * @private
     * @event abortFinalized
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {HTMLElement} context.element The element which we are moving, could be a cloned version of grabbed, or the grabbed element itself
     * @param {HTMLElement} context.target The target element below the cursor
     * @param {HTMLElement} context.grabbed The original element upon which the mousedown event triggered a drag operation
     * @param {MouseEvent} event
     */
    //endregion

    //region Init

    /**
     * Initializes a new DragHelper.
     * @param {Object} config Configuration object, accepts options specified under Configs above
     * @example
     * new DragHelper({
     *   containers: [div1, div2],
     *   isElementDraggable: element => element.className.contains('handle'),
     *   outerElement: topParent,
     *   listeners: {
     *     drop: onDrop,
     *     thisObj: this
     *   }
     * });
     * @function constructor
     */
    construct(config) {
        const me = this;

        super.construct(config);

        me.initListeners();

        if (me.isContainerDrag) {
            me.initContainerDrag();
        }
        else {
            me.initTranslateDrag();
        }

        me.onScrollManagerScrollCallback = me.onScrollManagerScrollCallback.bind(me);
    }

    doDestroy() {
        this.reset(true);
        super.doDestroy();
    }

    /**
     * Initialize listener
     * @private
     */
    initListeners() {
        const
            me                 = this,
            { outerElement }   = me,
            dragStartListeners = {
                element     : outerElement,
                pointerdown : 'onPointerDown',
                thisObj     : me
            };

        me.mouseMoveListenerElement = me.getMouseMoveListenerTarget(outerElement);

        // These will be autoDetached upon destroy
        EventHelper.on(dragStartListeners);

        EventHelper.on({
            element : globalThis,
            blur    : 'onWindowBlur',
            thisObj : me
        });
    }

    // Salesforce hook: we override this method to move listener from the body (which is default root node) to element
    // inside of LWC
    getMouseMoveListenerTarget(element) {
        const root = element.getRootNode();

        let result = this.mouseMoveListenerElement;

        // If we are inside a closed shadow root and we are a child of a Widget, listen to mouse moves only inside outermost el
        if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE && root.mode === 'closed') {
            result = element.closest('.b-outer') || result;
        }

        return result;
    }

    get isRTL() {
        return Boolean(this.rtlSource?.rtl);
    }

    //endregion

    //region Events

    /**
     * Fires after drop. For valid drops, it exposes `context.async` which you can set to true to signal that additional
     * processing is needed before finalizing the drop (such as showing some dialog). When that operation is done, call
     * `context.finalize(true/false)` with a boolean that determines the outcome of the drop.
     *
     * You can signal that the drop is valid or invalid by setting `context.valid = false;`
     *
     * For translate type drags with {@link #config-cloneTarget}, you can also set `transitionTo` if you want to animate
     * the dragged proxy to a position before finalizing the operation. See class intro text for example usage.
     *
     * @event drop
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {HTMLElement} context.element The element which we are moving, could be a cloned version of grabbed, or the grabbed element itself
     * @param {HTMLElement} context.target The target element below the cursor
     * @param {HTMLElement} context.grabbed The original element upon which the mousedown event triggered a drag operation
     * @param {HTMLElement[]} context.relatedElements An array of extra elements dragged with the main dragged element
     * @param {Boolean} context.valid true if the drop position is valid
     */

    /**
     * Fires after {@link #event-drop} and after drag proxy has animated to its final position (if setting `transitionTo`
     * on the drag context object).
     * @private
     * @event dropFinalized
     * @param {Core.helper.DragHelper} source
     * @param {Object} context
     * @param {HTMLElement} context.element The element which we are moving, could be a cloned version of grabbed, or the grabbed element itself
     * @param {HTMLElement} context.target The target element below the cursor
     * @param {HTMLElement} context.grabbed The original element upon which the mousedown event triggered a drag operation
     */

    onPointerDown(event) {
        const me = this;

        if (
            // Left button or touch allowed
            event.button !== 0 ||
            // Visibility check is needed because mousedown on a just-created event element
            // will cause the EventEdit to cancel the add, remove the record and hide the element
            // *but* the mousedown event still bubbles to here and that will throw an error.
            !DomHelper.isVisible(event.target) ||
            // If a drag is ongoing already, finalize it and don't proceed with new drag (happens if pointerup happened
            // when current window wasn't focused - tab switch or window switch). Also handles the edge case of trying to
            // start a new drag while previous is awaiting finalization, in which case it just bails out.
            me.context
        ) {
            return;
        }

        // Check that element is draggable
        if (me.isElementDraggable && !me.isElementDraggable(event.target, event)) {
            return;
        }

        me.startEvent = event;

        const handled = me.isContainerDrag ? me.grabContainerDrag(event) : me.grabTranslateDrag(event);

        if (handled) {
            const dragListeners = {
                element : me.mouseMoveListenerElement,
                thisObj : me,
                keydown : rootElementListeners.keydown
            };

            if (event.pointerType === 'touch') {
                me.touchStartTimer = me.setTimeout(() => me.touchStartTimer = null, me.touchStartDelay, 'touchStartDelay');

                dragListeners.touchmove = {
                    handler : rootElementListeners.touchmove,
                    passive : false // We need to be able to preventDefault on the touchmove
                };

                // Touch desktops don't fire touchend event when touch has ended, instead pointerup is fired
                // iOS do fire touchend
                dragListeners.touchend = dragListeners.pointerup = rootElementListeners.touchend;
            }
            else {
                dragListeners.pointermove = rootElementListeners.move;
                dragListeners.pointerup = rootElementListeners.up;
            }

            // A listener detacher is returned;
            me.removeListeners = EventHelper.on(dragListeners);

            if (me.dragWithin && me.dragWithin !== me.outerElement && me.outerElement.contains(me.dragWithin)) {
                const
                    box = Rectangle.from(me.dragWithin, me.outerElement);

                me.minY = box.top;
                me.maxY = box.bottom;

                me.minX = box.left;
                me.maxX = box.right;
            }
        }
    }

    internalMove(event) {
        const
            me             = this,
            { context }    = me,
            distance       = EventHelper.getDistanceBetween(me.startEvent, event),
            abortTouchDrag = me.touchStartTimer && distance > me.dragThreshold;

        if (abortTouchDrag) {
            me.abort(true);
            return;
        }

        if (
            !me.touchStartTimer && context?.element && (context.started || distance >= me.dragThreshold) &&
            // Ignore text nodes
            event.target?.nodeType === Node.ELEMENT_NODE
        ) {

            if (!context.started) {
                if (me.trigger('beforeDragStart', { context, event }) === false) {
                    return me.abort();
                }

                if (me.isContainerDrag) {
                    me.startContainerDrag(event);
                }
                else {
                    me.startTranslateDrag(event);
                }

                context.started = true;

                // Now that the drag drop is confirmed to be starting, activate the configured scrollManager if present
                me.scrollManager?.startMonitoring(ObjectHelper.merge({
                    scrollables : [
                        {
                            element : me.dragWithin || me.outerElement
                        }
                    ],
                    callback : me.onScrollManagerScrollCallback
                }, me.monitoringConfig));

                // Global informational class for when DragHelper is dragging
                context.outermostEl = DomHelper.getOutermostElement(event.target);
                context.outermostEl.classList.add('b-draghelper-active');

                if (me.dropTargetSelector && me.dropTargetCls) {
                    DomHelper.getRootElement(me.outerElement).querySelectorAll(me.dropTargetSelector).forEach(
                        el => el.classList.add(me.dropTargetCls)
                    );
                }

                // This event signals that the drag is started, observers could then provide relatedElements that should
                // be dragged along with the mousedowned element
                me.trigger('dragStart', { context, event });

                me.onDragStarted?.();
            }

            me.update(event);

            // to prevent view drag (scroll) on ipad
            if (event.type === 'touchmove') {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        }
    }

    onScrollManagerScrollCallback(config) {
        const { lastMouseMoveEvent } = this;

        if (this.context?.element && lastMouseMoveEvent) {
            // Indicate that this is a 'fake' mousemove event as a result of the scrolling
            lastMouseMoveEvent.isScroll = true;

            this.update(lastMouseMoveEvent, config);
        }
    }

    onTouchMove(event) {
        this.internalMove(event);
    }

    /**
     * Move drag element with mouse.
     * @param event
     * @fires beforeDragStart
     * @fires dragStart
     * @private
     */
    onMouseMove(event) {
        this.internalMove(event);
    }

    /**
     * Updates drag, called when an element is grabbed and mouse moves
     * @private
     * @fires drag
     */
    update(event, scrollManagerConfig) {
        const
            me                   = this,
            { context }          = me,
            scrollingPageElement = document.scrollingElement || document.body; // two different modes used

        // In case of scrolling need to update target element based on [X, Y] of the mouse event
        // Salesforce workaround: we're listening on the document body and salesforce won't report correct target, so
        // we try to get it from composed path
        let target = me.getMouseMoveEventTarget(event);

        // "pointer-events:none" touchmove has no effect for the touchmove event target, meaning we cannot know
        // what's under the cursor as easily in touch devices
        if (event.type === 'touchmove') {
            const touch = event.changedTouches[0];

            target = DomHelper.elementFromPoint(touch.clientX + scrollingPageElement.scrollLeft, touch.clientY + scrollingPageElement.scrollTop);
        }

        context.target = target;

        let internallyValid = !me.dragWithin || me.dragWithin.contains(event.target);

        if (internallyValid && me.dropTargetSelector) {
            internallyValid = internallyValid && Boolean(target?.closest(me.dropTargetSelector));
        }

        // Move the drag proxy or dragged element before triggering the drag event
        if (me.isContainerDrag) {
            me.updateContainerProxy(event, scrollManagerConfig);
        }
        else {
            // Note, if you drag an element from Container A to Container B which is scrollable (handled by ScrollManager),
            // and you notice that the proxy element follows the scroll and goes away from the cursor,
            // make sure you set `outerElement` to the container of the source element (Container A)
            // and set `constrain` to `false`.
            me.updateTranslateProxy(event, scrollManagerConfig);
        }

        context.valid = internallyValid;

        // Allow external code to validate the context before updating a container drag
        me.trigger('drag', { context, event });

        // Move the placeholder element into its new place.
        // This will see the new state of context if mutated by a drag listener.
        if (me.isContainerDrag) {
            me.updateContainerDrag(event, scrollManagerConfig);
        }

        context.valid = context.valid && internallyValid;

        for (const element of me.draggedElements) {
            element.classList.toggle(me.invalidCls, !context.valid);
        }

        if (event) {
            me.lastMouseMoveEvent = event;
        }
    }

    get draggedElements() {
        const { context } = this;
        return [context.dragProxy || context.element, ...(context.relatedElements ?? [])];
    }

    /**
     * Abort dragging
     * @fires abort
     */
    async abort(silent = false) {
        const
            me          = this,
            { context } = me;

        me.scrollManager?.stopMonitoring?.();
        me.removeListeners();

        if (context?.started && !context.aborted) {
            // Force a synchronous layout so that transitions from this point will work.
            context.element.getBoundingClientRect();

            // Aborted drag not considered valid
            context.valid = false;

            if (me.isContainerDrag) {
                me.abortContainerDrag(undefined, undefined, silent);
            }
            else {
                me.abortTranslateDrag(undefined, undefined, silent);
            }

            context.aborted = true;
        }
        else {
            me.reset(true);
        }
    }

    // Empty class implementation. If listeners *are* added, the detacher is added
    // as an instance property. So this is always callable.
    removeListeners() {}

    // Called when a drag operation is completed, or aborted
    // Removes DOM listeners and resets context
    reset(silent) {
        const
            me          = this,
            { context } = me;

        if (context?.started) {
            for (const element of me.draggedElements) {
                element.classList.remove(me.invalidCls);
            }

            context.outermostEl.classList.remove('b-draghelper-active');

            if (me.isContainerDrag) {
                context.dragProxy.remove();
            }
            else {
                me.cleanUp();
            }

            if (me.dropTargetSelector && me.dropTargetCls) {
                DomHelper.getRootElement(me.outerElement).querySelectorAll(me.dropTargetSelector).forEach(
                    el => el.classList.remove(me.dropTargetCls)
                );
            }
        }

        me.removeListeners();

        /**
         * Fired after a drag operation is completed or aborted
         * @event reset
         * @private
         * @param {Core.helper.DragHelper} dragHelper
         */
        if (!silent) {
            me.trigger('reset');
        }

        me.context = me.lastMouseMoveEvent = null;
    }

    onTouchEnd(event) {
        this.onMouseUp(event);
    }

    /**
     * This is a capture listener, only added during drag, which prevents a click gesture
     * propagating from the terminating mouseup gesture
     * @param {MouseEvent} event
     * @private
     */
    onDocumentClick(event) {
        event.stopPropagation();
    }

    /**
     * Drop on mouse up (if dropped on valid target).
     * @param event
     * @private
     */
    onMouseUp(event) {
        const
            me          = this,
            { context } = me;

        me.removeListeners();

        if (context) {
            me.scrollManager?.stopMonitoring();

            if (context.started) {
                context.finalizing = true;
                if (me.isContainerDrag) {
                    me.finishContainerDrag(event);
                }
                else {
                    me.finishTranslateDrag(event);
                }

                // Prevent the impending document click from the mouseup event from propagating
                // into a click on our element.
                EventHelper.on({
                    element : document,
                    thisObj : me,
                    click   : rootElementListeners.docclick,
                    capture : true,
                    expires : me.clickSwallowDuration, // In case a click did not ensue, remove the listener
                    once    : true
                });
            }
            else {
                me.reset(true);
            }
        }
    }

    /**
     * Cancel on ESC key
     * @param event
     * @private
     */
    onKeyDown(event) {
        if (event.key === 'Escape') this.abort();
    }

    onWindowBlur() {
        // If window blur occurs while we are dragging (tab is switched, another window steals focus from browser)
        // pointer might be released and current window will not know about that. Thus allowing to pointerdown again
        // when focus comes back. In this case we want to let drag helper know that next pointerdown should be ignored.
        if (this.context && !this.context.finalizing) {
            this.abort();
        }
    }

    /**
     * Creates the proxy element to be dragged, when using {@link #config-cloneTarget}. Clones the original element by default.
     * Override it to provide your own custom HTML element structure to be used as the drag proxy.
     * @param {HTMLElement} element The element from which the drag operation originated
     * @returns {HTMLElement}
     */
    createProxy(element) {
        if (this.proxySelector) {
            element = element.querySelector(this.proxySelector) || element;
        }

        const proxy = element.cloneNode(true);

        proxy.removeAttribute('id');

        return proxy;
    }

    //endregion

    get isContainerDrag() {
        return this.mode === 'container';
    }

    /**
     * Animated the proxy element to be aligned with the passed element. Returns a Promise which resolves after the
     * DOM transition completes. Only applies to 'translateXY' mode.
     * @param {HTMLElement|Core.helper.util.Rectangle} element The target element or a Rectangle
     * @param {Object} [alignSpec] An object describing how to the align drag proxy to the target element
     * @param {String} [alignSpec.align] The alignment specification string, `[trbl]n-[trbl]n`.
     * @param {Number|Number[]} [alignSpec.offset] The 'x' and 'y' offset values to create an extra margin round the target
     * to offset the aligned widget further from the target. May be configured as -ve to move the aligned widget
     * towards the target - for example producing the effect of the anchor pointer piercing the target.
     */
    async animateProxyTo(targetElement, alignSpec = { align : 'c-c' }) {
        const
            { context, draggedElements } = this,
            { element }                  = context,
            targetRect                   = targetElement.isRectangle ? targetElement : Rectangle.from(targetElement);

        draggedElements.forEach(el => {
            el.classList.add('b-drag-final-transition');

            DomHelper.alignTo(el, targetRect, alignSpec);
        });

        await EventHelper.waitForTransitionEnd({
            element,
            property : 'all',
            thisObj  : this,
            once     : true
        });

        draggedElements.forEach(el => el.classList.remove('b-drag-final-transition'));
    }

    /**
     * Returns true if a drag operation is active
     * @property {Boolean}
     * @readonly
     */
    get isDragging() {
        return Boolean(this.context?.started);
    }

    //#region Salesforce hooks

    getMouseMoveEventTarget(event) {
        return !event.isScroll ? event.target : DomHelper.elementFromPoint(event.clientX, event.clientY);
    }

    //#endregion
}
