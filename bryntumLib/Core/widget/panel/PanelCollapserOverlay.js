import Animator from '../../util/Animator.js';
import PanelCollapser from './PanelCollapser.js';
import Delayable from '../../mixin/Delayable.js';
import ObjectHelper from '../../helper/ObjectHelper.js';
import EventHelper from '../../helper/EventHelper.js';
import DomHelper from '../../helper/DomHelper.js';
import DomClassList from '../../helper/util/DomClassList.js';

/**
 * @module Core/widget/panel/PanelCollapserOverlay
 */

const
    { dockIsHorz } = PanelCollapser.maps,
    clipByDir = {
        up    : ['top', 'bottom'],
        right : ['right', 'left'],
        down  : ['bottom', 'top'],
        left  : ['left', 'right']
    },
    collapseExposeEdge = {
        top    : 0,
        down   : 0,
        left   : 1,
        bottom : 2,
        up     : 2,
        right  : 3
    },
    emptyObject = {},
    translateByDir = {
        up : {
            from : `translate(0,0)`,
            to   : 'translate(0,-100%)'
        },
        down : {
            from : `translate(0,0)`,
            to   : 'translate(0,100%)'
        },
        left : {
            from : `translate(0,0)`,
            to   : 'translate(-100%,0)'
        },
        right : {
            from : `translate(0,0)`,
            to   : 'translate(100%,0)'
        }
    };

/**
 * A panel collapse implementation that adds the ability to reveal the collapsed panel as a floating overlay.
 * @extends Core/widget/panel/PanelCollapser
 * @classtype overlay
 */
export default class PanelCollapserOverlay extends PanelCollapser.mixin(Delayable) {
    static get $name() {
        return 'PanelCollapserOverlay';
    }

    static get type() {
        return 'overlay';
    }

    static get configurable() {
        return {
            /**
             * The number of milliseconds to wait once the mouse leaves a {@link Core.widget.Panel#config-revealed}
             * panel before returning to an unrevealed state. Clicking outside the revealed panel will immediately
             * return the panel to its collapsed state.
             *
             * This may be disabled by configuring {@link #config-autoClose} as `null`.
             *
             * If this value is negative, the panel will not automatically recollapse due to the mouse leaving, however,
             * clicks outside the panel will still recollapse it.
             *
             * If this value is `null`, the panel will not automatically recollapse for either outside clicks or if
             * the mouse leaves the panel.
             * @config {Number}
             * @default
             */
            autoCloseDelay : 1000,

            /**
             * By default, clicking outside the revealed overlay hides the revealed overlay.
             *
             * If the revealed overlay was shown using the {@link #property-recollapseTool}
             * then moving the mouse outside of the revealed overlay hides the revealed overlay.
             *
             * Configure this as `false` to disable auto hiding, making overlayed
             * state permanent, and changeable using the {@link #function-toggleReveal} method.
             * @config {Boolean}
             * @default
             */
            autoClose : true,

            revealing : {
                value   : null,
                $config : null,
                default : false
            },

            /**
             * The reveal/hide tool which slides the collapsed panel over the top of the UI.
             * @member {Core.widget.Tool} recollapseTool
             */
            /**
             * The reveal/hide tool which slides the collapsed panel over the top of the UI.
             * 
             * The `type` of this instance should not be changed but the tool instance can be
             * configured in other ways via this config property.
             * @config {Object|Core.widget.Tool}
             */
            recollapseTool : {
                type       : 'collapsetool',
                cls        : 'b-recollapse',
                collapsify : 'overlay',

                handler() {
                    // NOTE: As a tool, our this pointer is the Panel so we use it to access the current collapser
                    this.collapsible?.toggleReveal();
                }
            }
        };
    }

    static get delayable() {
        return {
            doAutoClose : 0
        };
    }

    doAutoClose() {
        this.toggleReveal(false);
    }

    updateAutoCloseDelay(delay) {
        const { doAutoClose } = this;

        if (!(doAutoClose.suspended = delay == null || delay < 0)) {
            doAutoClose.delay = delay;
            doAutoClose.immediate = !delay;
        }
    }

    changeRecollapseTool(tool) {
        const
            me = this,
            { panel } = me;

        if (me.isConfiguring || me.isDestroying || !panel || panel.isDestroying) {
            return tool;
        }

        panel.tools = {
            recollapse : tool
        };
    }

    beforeCollapse(operation) {
        if (super.beforeCollapse(operation) === false) {
            return false;
        }

        if (this.panel.revealed) {
            operation.animation = null;
        }
    }

    applyHeaderDock(collapsed, flush = true) {
        this.panel?.recompose();

        super.applyHeaderDock(collapsed, flush);
    }

    collapseBegin(operation) {
        const
            me = this,
            { collapseDir, innerElement } = me,
            { animation } = operation,
            { collapseTool, panel } = me;

        me.configuredWidth = panel._lastWidth;
        me.configuredHeight = panel._lastHeight;

        me.applyHeaderDock(true);

        const innerElementRect = me.lockInnerSize();

        collapseTool?.element.classList.add('b-collapsed');

        if (animation) {
            panel.element.classList.add('b-collapsing');

            innerElementRect.moveTo(0, 0);

            const
                innerElementClipRect = innerElementRect.clone(),
                clipDir = clipByDir[collapseDir];

            innerElementClipRect[clipDir[0]] = innerElementClipRect[clipDir[1]];

            animation.element = me.innerElement;
            animation.transform = translateByDir[collapseDir];
            animation.items = [{
                element : innerElement,
                clip    : {
                    from : `rect(${innerElementRect})`,
                    to   : `rect(${innerElementClipRect})`
                }
            }];

            operation.animation = Animator.run(animation);
        }
    }

    onComplete(action) {
        super.onComplete(action);

        const
            me          = this,
            { panel }   = me,
            { element } = panel;

        me.autoCloseLeaveDetacher = me.autoCloseLeaveDetacher?.();
        me.autoCloseClickDetacher = me.autoCloseClickDetacher?.();

        // The act of hiding the revealed panel ("unrevealing") causes a mouseleave event (once the panel slides out
        // from under the cursor) and that starts the autoClose timer. If the user then reveals the panel again within
        // the 1sec delay (by default), the autoClose timer will still fire and unreveal the panel.
        me.doAutoClose.cancel();

        if (action === 'reveal' && me.autoClose) {
            // Only listen for mouseleave to close if we contain focus.
            // If we do not, then we have been revealed using the API from some other
            // part of the UI, so mouseleave closing would not be appropriate.
            if (panel.containsFocus) {
                me.autoCloseLeaveDetacher = EventHelper.on({
                    element,

                    mouseenter : ev => {
                        me.doAutoClose.cancel();
                    },

                    mouseleave : ev => {
                        me.doAutoClose();
                    }
                });
            }

            me.autoCloseClickDetacher = EventHelper.on({
                element : document.body,

                mousedown : ev => {
                    if (ev.target !== element && !element.contains(ev.target) && me.autoCloseDelay != null) {
                        // Detect the UI element which invoked the reveal.
                        // If the panel contains focus, use the "from" element.
                        // If not, then the focus is still on the invoking element.
                        const el = panel.containsFocus && panel.focusInEvent?.relatedTarget ||
                            DomHelper.getActiveElement(element);

                        if (!el?.contains(ev.target)) {
                            me.doAutoClose.now();
                        }
                    }
                }
            });
        }
    }

    expandBegin(operation) {
        const
            me = this,
            { animation } = operation,
            { collapseDir, collapseTool, innerElement, panel } = me,
            { element } = panel;

        element.classList.remove('b-collapsed', 'b-collapsing');
        me.restoreConfiguredSize();
        me.lockInnerSize(false);  // unlock the bodyWrap size

        const
            toRect = me.lockInnerSize().moveTo(0, 0),
            clipRect = toRect.clone(),
            clipDir = clipByDir[collapseDir];

        collapseTool?.element.classList.remove('b-collapsed');

        if (animation) {
            element.classList.add('b-collapsed', 'b-expanding');

            clipRect[clipDir[0]] = clipRect[clipDir[1]];

            animation.element = innerElement;
            animation.transform = {
                from : translateByDir[collapseDir].to,
                to   : translateByDir[collapseDir].from
            };
            animation.clip = {
                from : `rect(${clipRect})`,
                to   : `rect(${toRect})`
            };

            operation.animation = Animator.run(animation);
        }
    }

    expandEnd(operation) {
        super.expandEnd(operation);

        const { panel } = this;

        if (operation.completed) {
            panel.revealed = false;
        }

        panel.element.classList.remove('b-expanding');
    }

    expandRevert(operation) {
        super.expandRevert(operation);

        this.panel.element.classList.add('b-expanding');
    }

    get innerElement() {
        return this.panel.overlayElement;
    }

    get innerSizeElement() {
        return this.panel.element;
    }

    get toolsConfig() {
        const
            me = this,
            { direction } = me,
            config = super.toolsConfig,
            tool = me.recollapseTool;

        if (tool) {
            return {
                ...config,

                recollapse : tool && ObjectHelper.assign({
                    direction : direction.toLowerCase()
                }, tool)
            };
        }

        return config;
    }

    lockInnerSize(lock = true) {
        const
            me = this,
            { panel } = me,
            panelRect = lock && panel.rectangle(),  // must read this before we call super
            inset = lock ? [0, 0, 0, 0] : '',
            // now we can call super:
            innerRect = super.lockInnerSize(lock);

        // The panel overlay is visible because we switch to "overflow:visible" in collapsed state. By doing this,
        // however, the header animation undesirably escapes as well. Fortunately, we can use the clip-path to hide
        // this by only allowing the desired side to escape while all other sides remain clipped. Even more fortunate
        // for us is that clip-path is expressed as an inset from the normal rectangle of the element (so we don't
        // need to adjust it if the collapsed panel is resized), and further, unlike CSS path style, clip-path works
        // for all elements not only absolutely positioned ones.
        if (lock) {
            // TODO see if there's a way to read the box-shadow style to pick up the right value (10 is the default)
            inset[collapseExposeEdge[me.collapseDir]] = `-${panelRect[me.collapseDim] + 10}px`;
        }

        panel.element.style.clipPath = lock ? `inset(${inset.join(' ')}` : '';

        return innerRect;
    }

    onOverlayTransitionDone(ev) {
        const
            me = this,
            { panel } = me;

        if (ev.srcElement === panel.overlayElement && me.revealing) {
            me.revealing = false;

            me.onComplete(panel.revealed ? 'reveal' : 'unreveal');
        }
    }

    onRevealerClick() {
        this.toggleReveal();
    }

    splitHeaderItems({ as, dock } = emptyObject) {
        return this.panel?.splitHeaderItems({ as, dock, overlay : true });
    }

    /**
     * Toggles the revealed state of the Panel to match the passed boolean flag.
     * @param {Boolean} [state]  If not specified, this method toggles current state. Otherwise, pass `true` to reveal
     * the overlay, or `false` to hide it.
     */
    toggleReveal(state) {
        const { panel } = this;

        if (panel.collapsed) {
            if (state == null) {
                state = !panel.revealed;
            }

            if (panel.revealed !== state) {
                this.revealing = true;
                panel.revealed = !panel.revealed;
            }
        }
    }

    updateRevealing(value) {
        const
            me = this,
            horzDirRe = /left|right/i,
            { panel } = me,
            dim = horzDirRe.test(me.collapseDir) ? 'height' : 'width';

        if (panel) {
            me.innerElement.style[dim] = panel.rectangle()[dim] + 'px';

            panel.element.classList[value ? 'add' : 'remove']('b-panel-overlay-revealing');
        }
    }

    wrapCollapser(key, body) {
        const
            me = this,
            { collapseDir, panel } = me,
            { expandedHeaderDock, header, uiClassList } = panel,
            recollapse = panel.tools?.recollapse,
            [before, after] = me.splitHeaderItems({ dock : me.collapseDock, as : 'element' }),
            horz = dockIsHorz[expandedHeaderDock],
            title = panel.hasHeader ? (panel.title || header?.title || '\xA0') : null;

        if (recollapse) {
            recollapse.direction = collapseDir;
        }

        return [
            'overlayElement',
            {
                class : {
                    ...uiClassList,
                    [`b-panel-overlay-header-${expandedHeaderDock}`] : 1,
                    [`b-panel-overlay-${collapseDir}`]               : 1,
                    [`b-${horz ? 'h' : 'v'}box`]                     : 1,
                    'b-panel-overlay'                                : 1,
                    'b-box-center'                                   : 1
                },

                listeners : {
                    transitionend : ev => me.onOverlayTransitionDone(ev)
                },

                children : {
                    overlayHeaderElement : title && {
                        tag   : 'header',
                        class : new DomClassList({
                            ...uiClassList,
                            [`b-dock-${expandedHeaderDock}`] : 1,
                            'b-panel-header'                 : 1,
                            'b-panel-overlay-header'         : 1
                        }, header?.cls),

                        children : [
                            ...before,
                            {
                                reference : 'overlayTitleElement',
                                html      : title,
                                class     : {
                                    ...uiClassList,
                                    [`b-align-${header?.titleAlign || 'start'}`] : 1,
                                    'b-header-title'                             : 1
                                }
                            },
                            ...after
                        ]
                    },

                    [key] : body
                }
            }
        ];
    }
}

// Register this widget type with its Factory
PanelCollapserOverlay.initClass();
