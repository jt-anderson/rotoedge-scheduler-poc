import Base from '../../Base.js';
import Animator from '../../util/Animator.js';
import Factoryable from '../../mixin/Factoryable.js';
import DomHelper from '../../helper/DomHelper.js';
import FunctionHelper from '../../helper/FunctionHelper.js';
import ObjectHelper from '../../helper/ObjectHelper.js';
import Rectangle from '../../helper/util/Rectangle.js';

import './CollapseTool.js';

/**
 * @module Core/widget/panel/PanelCollapser
 */

const
    defaultedDirectionRe = /^(?:UP|DOWN|LEFT|RIGHT)$/,
    emptyArray           = [],
    emptySplit           = [emptyArray, emptyArray],
    revealerCls          = 'b-panel-collapse-revealer',
    sideDockRe           = /^(?:left|right)$/i,
    { round }            = Math,
    canonicalDirection   = ['up', 'down', 'left', 'right'].reduce((o, v) => {
        o[v.toUpperCase()] = o[v] = v;
        return o;
    }, {}),
    clipByDock = {
        top    : ['top', 'bottom'],
        right  : ['right', 'left'],
        bottom : ['bottom', 'top'],
        left   : ['left', 'right']
    },
    collapseDirectionByPlacement = {
        hl : 'LEFT',
        hr : 'RIGHT',
        vb : 'DOWN',
        vt : 'UP'
    },
    crossAxis = {
        h : 'w',
        w : 'h'
    },
    dockByDirection = {
        up    : 'top',
        right : 'right',
        down  : 'bottom',
        left  : 'left'
    },
    dockIsHorz = {
        top    : false,
        right  : true,
        bottom : false,
        left   : true
    },
    directionByDock = {
        top    : 'UP',
        right  : 'RIGHT',
        bottom : 'DOWN',
        left   : 'LEFT'
    };

let idSeed = 0;

/**
 * Instances of this class are used to implement the {@link Core.widget.Panel#config-collapsible} config.
 *
 * For example, the following creates an instance of this class:
 *
 * ```javascript
 *      {
 *          type        : 'panel',
 *          collapsible : true
 *      }
 * ```
 * In this mode, a panel will collapse inline, within its container.
 * @classtype inline
 */
export default class PanelCollapser extends Base.mixin(Factoryable) {
    static get $name() {
        return 'PanelCollapser';
    }

    // Factoryable type name
    static get type() {
        return 'inline';
    }

    static get configurable() {
        return {
            /**
             * An animation config object.
             * @config {Object} animation
             * @property {Number} [animation.duration=200] The duration of the animation (in milliseconds).
             */
            animation : {
                duration : 200
            },

            /**
             * Tracks whether or not the panel is collapsed.
             * @config {Boolean}
             * @private
             */
            collapsed : {
                value   : null,
                $config : null,
                default : false
            },

            /**
             * Specifies the direction of panel collapse. The default value for this config is determined dynamically
             * based on the {@link Core.widget.Panel#config-header header's} `dock` property and the containing layout's
             * flex direction and, therefore, often does not need to be explicitly specified.
             *
             * This config can be any of the following:
             * - `'up'`
             * - `'down'`
             * - `'left'`
             * - `'right'`
             *
             * @config {'up'|'down'|'left'|'right'}
             */
            direction : null,

            /**
             * The tooltip to use for the collapse tool when the panel is expanded.
             * @config {String}
             */
            collapseTooltip : 'L{Collapse}',

            /**
             * The tooltip to use for the expand tool when the panel is collapsed.
             * @config {String}
             */
            expandTooltip : 'L{Expand}',

            panel : {
                value : null,

                $config : 'nullify'
            },

            /**
             * To support the panel's collapsed size, a minimum width and height may be assigned to the panel's header,
             * based on this config and the panel's positioning style.
             *
             * When a panel is collapsed it may need to retain the pre-collapse dimension perpendicular to the collapse
             * {@link #config-direction}. For example, the height of a panel that collapses to the left. The dimension
             * parallel to the collapse (the width in this example) may also need to be supported using the pre-collapse
             * size of the panel's header.
             *
             * When this config is set to `true`, or by default when the owning panel is `position: absolute`, both
             * axes are given a minimum size based on the panel's pre-collapse size. When this config is `false`, no
             * minimum sizes will be assigned.
             *
             * This config can also be a string containing the single letters 'w' and/or 'h' indicating which axis/axes
             * of the panel header should be assigned a minimum size. That is, 'w' to assign only a minimum width, 'h'
             * for only a minimum height, or 'wh' to assign both.
             *
             * @config {String|Boolean}
             * @internal
             */
            supportAxis : null,

            /**
             * The collapse/expand tool. The `type` of this instance should not be changed but the tool instance can be
             * configured in other ways via this config property.
             * @config {Object|Core.widget.Tool}
             */
            tool : {
                type : 'collapsetool',

                handler(ev) {
                    // NOTE: As a tool, our this pointer is the Panel so we use it to access the current collapser
                    this.collapsible?.onCollapseClick(ev);
                }
            }
        };
    }

    static get factoryable() {
        return {
            defaultType : 'inline'
        };
    }

    get collapsing() {
        return this.collapsingExpanding === 'collapsing';
    }

    get collapsingExpanding() {
        const state = this.currentOperation?.collapsing;

        return (state == null) ? null : (state ? 'collapsing' : 'expanding');
    }

    get currentDock() {
        return this.panel?.header?.dock?.toLowerCase() ?? 'top';
    }

    get expanding() {
        return this.collapsingExpanding === 'expanding';
    }

    get collapseTool() {
        return this.panel?.tools?.collapse;
    }

    get collapseDim() {
        return sideDockRe.test(this.collapseDir) ? 'width' : 'height';
    }

    getCollapseDir(canonical) {
        let { direction, panel } = this;

        if (!direction || defaultedDirectionRe.test(direction)) {
            const placement = panel?.placement;

            if (placement) {
                direction = collapseDirectionByPlacement[placement];
            }
            else {
                direction = directionByDock[panel?.header?.dock || 'top'];
            }

            // direction in this case will be uppercase so that we can tell later that it was a default value vs a
            // user-defined one
        }

        return canonical ? canonicalDirection[direction] : direction;
    }

    get collapseDir() {
        return this.getCollapseDir(true);
    }

    get collapseDock() {
        const
            { panel } = this,
            headerDock = panel.hasHeader && panel.expandedHeaderDock,
            dock = dockByDirection[this.collapseDir];

        return (headerDock && dockIsHorz[dock] === dockIsHorz[headerDock]) ? headerDock : dock;
    }

    get toolsConfig() {
        const { direction, tool } = this;

        return tool && {
            collapse : ObjectHelper.assign({
                direction : direction.toLowerCase()
            }, tool)
        };
    }

    beforeCollapse(operation) {
        // TODO
    }

    changeTool(tool) {
        const
            me = this,
            { panel } = me;

        if (me.isConfiguring || me.isDestroying || !panel || panel.isDestroying) {
            return tool;
        }

        panel.tools = {
            collapse : tool
        };
    }

    collapse(collapsed) {
        const
            me = this,
            { panel } = me,
            operation = {
                id        : ++idSeed,
                completed : false,
                panel
            };

        let { currentOperation } = me;

        collapsed = collapsed ?? true;

        if (ObjectHelper.isObject(collapsed)) {
            operation.collapsed = true;
            ObjectHelper.assign(operation, collapsed);
            collapsed = operation.collapsed;
            delete operation.collapsed;
        }

        operation.collapsing = collapsed;
        operation.previous = currentOperation ?? null;

        if (collapsed !== me.collapsed) {
            // We aren't in the desired state (yet)

            if (currentOperation) {
                if (currentOperation.collapsing !== collapsed) {
                    // we are not heading to the desired state, so revert it:
                    operation.animation = currentOperation.animation.revert({
                        finalize() {
                            me.collapseFinalize?.(operation, true);  // ?. in case we are destroyed
                        }
                    });
                    operation.collapsing = collapsed;
                    currentOperation = operation;
                }
            }
            else {
                // No currentOperation, so this is the first request to change state.

                // don't mutate our parameter or config object
                operation.animation = ObjectHelper.clone((('animation' in operation) ? operation : me).animation);

                if (me.beforeCollapse(operation) !== false) {
                    if (operation.animation) {
                        operation.animation.finalize = complete => me.collapseFinalize?.(operation, complete);
                    }

                    panel.changingCollapse = true;

                    me[collapsed ? 'collapseBegin' : 'expandBegin'](operation);

                    if (operation.animation) {
                        currentOperation = operation;
                    }
                    else {
                        operation.completed = true;
                        me[collapsed ? 'collapseEnd' : 'expandEnd'](operation);
                    }

                    panel.changingCollapse = false;

                    if (!operation.animation) {
                        me.onComplete(collapsed ? 'collapse' : 'expand');
                    }
                }
            }
        }
        else if (currentOperation && currentOperation.collapsing !== collapsed) {
            // We are still in the desired state but we are animating to the now undesired state...
            me[collapsed ? 'expandRevert' : 'collapseRevert'](operation);

            // revert the animation and clear it when done
            operation.animation = currentOperation.animation.revert({
                finalize() {
                    me.collapseFinalize?.(operation, false);  // ?. in case we are destroyed
                }
            });

            currentOperation = operation;
        }
        // else if (currentOperation) we are already reverting

        me.currentOperation = currentOperation;

        return currentOperation?.animation?.done() ?? Promise.resolve(collapsed === me.collapsed);
    }

    collapseFinalize(operation, complete) {
        const
            me = this,
            { currentOperation, panel } = me,
            action = panel.collapsed ? 'expand' : 'collapse';

        if (currentOperation === operation) {
            me.currentOperation = null;
            operation.completed = complete;

            panel.changingCollapse = true;
            me[action + 'End'](operation);
            panel.changingCollapse = false;

            complete && me.onComplete(action);
        }
    }

    applyHeaderDock(collapsed, flush = true) {
        const
            me = this,
            { currentDock, panel } = me,
            dock = collapsed ? me.collapseDock : panel.expandedHeaderDock;

        if (dock !== currentDock && panel.hasHeader) {
            panel.header = {
                dock
            };

            flush && panel.recompose.flush();
        }
    }

    composeHeader(header) {
        header.class[revealerCls] = 1;

        return header;
    }

    composeTitle(title) {
        title.class[revealerCls] = 1;

        return title;
    }

    collapseBegin(operation) {
        const
            me = this,
            { animation } = operation,
            { collapseDim, collapseTool, panel } = me,
            { element } = panel,
            collapseToolClasses = collapseTool?.element.classList;

        me.configuredWidth = panel._lastWidth;
        me.configuredHeight = panel._lastHeight;

        me.applyHeaderDock(true);

        // Lock the bodyWrap to its current size while we animate the height of the outer element and clip it. We
        // also leave the bodyWrap locked to its expanded size to avoid crushing the content while collapsed since
        // that could cause virtual rendering widgets to have 0 height to work with and explode or at least waste
        // time adjusting back and forth.
        const
            panelRect = panel.rectangle(),
            bodyWrapRect = me.lockInnerSize().moveTo(0, 0),  // we must lockInnerSize even if !animation
            bodyWrapClipRect = bodyWrapRect.clone(),
            clipDir = clipByDock[me.collapseDock],
            headerRect = panel.headerElement?.getBoundingClientRect(),
            collapsedSize = round(headerRect?.[collapseDim] || 0);

        if (animation) {
            bodyWrapClipRect[clipDir[0]] = bodyWrapClipRect[clipDir[1]];

            element.classList.add('b-collapsing');

            // Flip to collapsed while skipping the animation (via b-collapsing)
            collapseToolClasses?.add('b-collapsed', 'b-collapsing');

            if (collapseTool) {
                collapseTool.collapsing = true;
            }

            if (collapseToolClasses) {
                collapseToolClasses.remove('b-collapsed');  // put the tool back to pre-collapse state
                panel.rectangle();                          // force a layout to allow us to enable transitions
                collapseToolClasses.remove('b-collapsing'); // enable transitions
                collapseToolClasses.add('b-collapsed');     // start the tool's transition
            }

            animation.element = element;
            animation.retain = true;
            animation[collapseDim] = {
                from : round(panelRect[collapseDim]),
                to   : collapsedSize
            };

            // While we animate the panel, we also need to clip the bodyWrap or it would be exposed on cases where
            // overflow=visible (like a tooltip w/anchor element)... doubtful we'd collapse such a panel but perhaps
            // there are  (or will be) other reasons to set overflow=visible on the panel.
            animation.items = [{
                element : panel.bodyWrapElement,
                retain  : false,
                clip    : {
                    from : `rect(${bodyWrapRect})`,
                    to   : `rect(${bodyWrapClipRect})`
                }
            }];

            operation.animation = Animator.run(animation);
        }
        else {
            // When animating we retain this style, so we need to just jam it on the element now since we aren't doing
            // the animation:
            element.style[collapseDim] = `${collapsedSize}px`;

            if (collapseTool) {
                collapseToolClasses.add('b-collapsing', 'b-collapsed'); // disable transition & snap to correct state
                collapseTool.rectangle();                   // force a layout
                collapseToolClasses.remove('b-collapsing'); // now we can remove this cls w/o triggering a transition
            }
        }
    }

    collapseEnd(operation) {
        const
            me = this,
            { collapseTool } = me;

        me.panel.element.classList.remove('b-collapsing');

        if (collapseTool) {
            collapseTool.collapsing = false;
        }

        if (operation.completed) {
            me.collapsed = true;
        }
        else {
            me.applyHeaderDock(false);
            me.restoreConfiguredSize();
            me.lockInnerSize(false);
        }
    }

    collapseRevert(operation) {
        this.collapseTool?.element.classList.remove('b-collapsed');
    }

    expandBegin(operation) {
        const
            me = this,
            { animation } = operation,
            { collapseDim, collapseTool, panel } = me,
            { element } = panel,
            fromRect = panel.rectangle();

        element.classList.remove('b-collapsed', 'b-collapsing');

        // This style is retained by the collapse animation and must be cleared to get a right measurement of the
        // expanded panel
        panel.element.style[collapseDim] = '';

        me.restoreConfiguredSize();
        me.lockInnerSize(false);  // unlock the bodyWrap size

        const
            toRect = panel.rectangle(),
            // Lock the bodyWrap to its current size while we animate the height of the outer element and unclip it:
            bodyWrapRect = me.lockInnerSize().moveTo(0, 0),
            bodyWrapClipRect = bodyWrapRect.clone(),
            clipDir = clipByDock[me.collapseDock];

        collapseTool?.element.classList.remove('b-collapsed');

        if (animation) {
            bodyWrapClipRect[clipDir[0]] = bodyWrapClipRect[clipDir[1]];
            element.classList.add('b-collapsed', 'b-expanding');

            animation.element = element;
            animation[collapseDim] = {
                from : round(fromRect[collapseDim]),
                to   : round(toRect[collapseDim])
            };
            animation.items = [{
                element : panel.bodyWrapElement,
                retain  : false,
                clip    : {
                    from : `rect(${bodyWrapClipRect})`,
                    to   : `rect(${bodyWrapRect})`
                }
            }];

            operation.animation = Animator.run(animation);
        }
    }

    expandEnd(operation) {
        const me = this;

        me.panel.element.classList.remove('b-expanding');

        if (operation.completed) {
            me.collapsed = false;
            me.applyHeaderDock(false);
            me.restoreConfiguredSize();
            me.lockInnerSize(false);
        }
    }

    expandRevert(operation) {
        this.collapseTool?.element.classList.add('b-collapsed');
    }

    get innerElement() {
        return this.panel.bodyWrapElement;
    }

    get innerSizeElement() {
        return this.innerElement;
    }

    get supportAxis() {
        let { _supportAxis } = this;

        const fullSupport = _supportAxis === true;

        if (fullSupport || _supportAxis == null) {
            _supportAxis = this.collapseDim[0];  // 'w' or 'h'

            if (fullSupport || DomHelper.getStyleValue(this.panel.element, 'position') === 'absolute') {
                _supportAxis += crossAxis[_supportAxis];
            }
        }

        return _supportAxis || '';
    }

    lockInnerSize(lock = true) {
        const
            me = this,
            { innerElement, panel } = me,
            supportAxis = lock ? me.supportAxis : '',
            panelEl = panel.element,
            headerEl = panel.headerElement,
            headerRect = lock && headerEl && Rectangle.from(headerEl, panelEl),
            innerRect = lock && Rectangle.from(me.innerSizeElement, panelEl),
            innerStyle = innerElement.style;

        // We have to prop up the cross-axis of the panel header in cases where the panel is not receiving a size from
        // its container (an auto layout). Otherwise, the header may shrink in width (when docked top) once the bodyWrap
        // flips to position:absolute... it will no longer be providing a natural size to prop up the panel, so we
        // shift that responsibility to the header element while we are collapsed.
        if (headerEl) {
            headerEl.style.minWidth = supportAxis.includes('w') ? `${headerRect.width}px` : '';
            headerEl.style.minHeight = supportAxis.includes('h') ? `${headerRect.height}px` : '';
        }

        // We must set w/h on the inner element before we flip it to position:absolute to avoid layout changes on items
        // in the panel (like grids)
        innerStyle.width  = lock ? `${innerRect.width}px`   : '';
        innerStyle.height = lock ? `${innerRect.height}px`  : '';

        innerElement.classList[lock ? 'add' : 'remove']('b-panel-collapse-size-locker');

        return innerRect;
    }

    onCollapseClick(e) {
        let collapsed = this.collapsing ? false : this.expanding ? true : !this.collapsed;

        if (e.altKey) {
            collapsed = {
                animation : null,
                collapsed
            };
        }

        this.collapse(collapsed);
    }

    onComplete(action) {
        this.panel?.trigger(action);
    }

    onHeaderClick({ event }) {
        if (event.button === 0 && this.panel.collapsed && event.target.classList.contains(revealerCls)) {
            this.onRevealerClick();
        }
    }

    onPanelConfigChange({ name, value }) {
        const
            me        = this,
            { panel } = me;

        if (name === 'collapsed') {
            if (panel.isPainted) {
                me.collapsed = value;
            }
        }
        else if (name === 'header' && !panel.changingCollapse) {
            me.syncDirection();
        }
    }

    onPanelPaint() {
        this.syncDirection();

        if (this.panel.collapsed && !this.collapsed) {
            this.collapse({
                animation : null,
                collapsed : true
            });
        }
    }

    onRevealerClick() {
        this.panel.expand();
    }

    restoreConfiguredSize(which) {
        const { configuredHeight, configuredWidth, panel } = this;

        which = which ?? 'wh';

        if (configuredWidth != null && which.includes('w')) {
            panel.width = configuredWidth;
        }

        if (configuredHeight != null && which.includes('h')) {
            panel.height = configuredHeight;
        }
    }

    splitHeaderItems() {
        return emptySplit;
    }

    syncDirection() {
        const
            me = this,
            { direction } = me;

        if (!direction || defaultedDirectionRe.test(direction)) {
            // getCollapseDir() returns uppercase values when they are being defaulted, so we can tell if the value
            // is from the user (which must be lowercase)
            me.direction = me.getCollapseDir();
        }
    }

    updateCollapsed(collapsed) {
        const { collapseTool, panel } = this;

        if (panel) {
            panel.collapsed = collapsed;
            panel.element.classList[collapsed ? 'add' : 'remove']('b-collapsed');
        }

        if (collapseTool) {
            collapseTool.collapsed = collapsed;
        }
    }

    updateDirection(direction) {
        const { collapseTool, panel } = this;

        if (collapseTool) {
            collapseTool.direction = canonicalDirection[direction];
        }

        if (panel?.rendered) {
            panel.recompose();
        }
    }

    updatePanel(panel) {
        const me = this;

        me.syncDirection();

        me.panelChangeDetacher?.();
        me.panelChangeDetacher = panel && FunctionHelper.after(panel, 'onConfigChange', 'onPanelConfigChange', me, {
            return : false
        });
    }

    wrapCollapser(key, body) {
        return [key, body];
    }
}

PanelCollapser.maps = {
    clipByDock,
    dockByDirection,
    dockIsHorz
};

// Register this widget type with its Factory
PanelCollapser.initClass();
