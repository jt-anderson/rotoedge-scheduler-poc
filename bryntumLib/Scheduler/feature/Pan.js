import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from '../../Grid/feature/GridFeatureManager.js';
import BrowserHelper from '../../Core/helper/BrowserHelper.js';
import DragBase from './base/DragBase.js';

/**
 * @module Scheduler/feature/Pan
 */

/**
 * Makes the scheduler's timeline pannable by dragging with the mouse. Try it out in the demo below.
 *
 * {@inlineexample Scheduler/feature/Pan.js}
 *
 * This feature is **off** by default. For info on enabling it, see {@link Grid.view.mixin.GridFeatures}.
 *
 * **NOTE:** Incompatible with the {@link Scheduler.feature.EventDragCreate EventDragCreate} and the
 * {@link Scheduler.feature.EventDragSelect EventDragSelect} features.
 *
 *
 * @example
 * // enable Pan
 * let scheduler = new Scheduler({
 *   features : {
 *     pan : true,
 *     eventDragCreate : false
 *   }
 * });
 *
 * @extends Core/mixin/InstancePlugin
 * @classtype pan
 * @feature
 */
export default class Pan extends InstancePlugin {
    // region Init

    static get $name() {
        return 'Pan';
    }

    static get defaultConfig() {
        return {
            /**
             * Set to false to not pan horizontally
             * @config {Boolean}
             * @default
             */
            horizontal : true,

            /**
             * Set to false to not pan vertically
             * @config {Boolean}
             * @default
             */
            vertical : true,

            /**
             * Set to false to not pan horizontally when dragging in the time axis header
             * @config {Boolean}
             * @default
             */
            enableInHeader : true
        };
    }

    construct(timeline, config) {
        const targetSelectors = [
            '.b-grid-cell',
            '.b-timeline-subgrid'
        ];

        super.construct(timeline, config);

        if (this.enableInHeader) {
            targetSelectors.push('.b-sch-header-timeaxis-cell', '.b-sch-header-text');
        }
        this.targetSelector = targetSelectors.join(',');
    }

    //endregion

    //region Plugin config

    // Plugin configuration. This plugin chains some of the functions in Scheduler.
    static get pluginConfig() {
        return {
            chain : ['onElementMouseDown', 'onElementMouseMove', 'onElementMouseUp']
        };
    }

    //endregion

    onElementMouseDown({ button, touches, target, clientX, clientY }) {
        const
            me                = this,
            { client }        = me,
            dragFeature       = Object.values(client.features).find(feature => feature instanceof DragBase),
            enablePanOnEvents = client.readOnly || !dragFeature || dragFeature.disabled;

        // only react to mouse input, and left button
        if (touches || button !== 0 || me.disabled) {
            return;
        }

        // only react to mousedown directly on grid cell, subgrid element or if drag is disabled - the events too
        if (target.matches(me.targetSelector) || (enablePanOnEvents && target.closest(client.eventSelector))) {
            me.mouseX   = clientX;
            me.mouseY   = clientY;
            me.onHeader = me.enableInHeader && target.closest('.b-sch-header-timeaxis-cell');
        }
    }

    onElementMouseMove(event) {
        const me = this;

        // Detect if a mouseup happened outside our element (or browser window for that matter). Note 'buttons' is not supported by Safari
        if (event.buttons === 0 && (!BrowserHelper.isSafari && event.isTrusted)) {
            me.onElementMouseUp();
            return;
        }

        if (typeof me.mouseX === 'number') {
            const
                { client } = me,
                xScroller  = client.subGrids.normal.scrollable,
                yScroller  = client.scrollable,
                x          = event.clientX,
                y          = event.clientY;

            event.preventDefault();

            if (me.vertical && (client.isVertical || !me.onHeader)) {
                yScroller.scrollBy(0, me.mouseY - y);
            }

            if (me.horizontal && (client.isHorizontal || !me.onHeader)) {
                xScroller.scrollBy(me.mouseX - x);
            }

            me.mouseX = x;
            me.mouseY = y;
        }
    }

    onElementMouseUp(event) {
        this.mouseX = this.mouseY = null;
    }

    /**
     * Yields `true` if a pan gesture is in process.
     * @property {Boolean}
     * @readonly
     */
    get isActive() {
        return Boolean(this.mouseX);
    }

    //endregion
}

GridFeatureManager.registerFeature(Pan, false, ['Scheduler', 'Gantt']);
