import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from '../../Grid/feature/GridFeatureManager.js';
import DomHelper from '../../Core/helper/DomHelper.js';
import EventHelper from '../../Core/helper/EventHelper.js';
import Rectangle from '../../Core/helper/util/Rectangle.js';
import Delayable from '../../Core/mixin/Delayable.js';

/**
 * @module Scheduler/feature/EventDragSelect
 */

/**
 * Enables users to click and drag to select events (or assignments in multi assignment mode) inside the Scheduler's
 * timeline.
 *
 * {@inlineexample Scheduler/feature/EventDragSelect.js}
 *
 * This feature is **off** by default. For info on enabling it, see {@link Grid.view.mixin.GridFeatures}.
 *
 * **NOTE:** Incompatible with the {@link Scheduler.feature.EventDragCreate} and the {@link Scheduler.feature.Pan} features.
 *
 * ```javascript
 * const scheduler = new Scheduler({
 *   features : {
 *     eventDragSelect : true,
 *     eventDragCreate : false
 *   }
 * });
 * ```
 *
 * @demo Scheduler/dragselection
 * @extends Core/mixin/InstancePlugin
 * @mixes Core/mixin/Delayable
 * @classtype eventDragSelect
 * @feature
 */
export default class EventDragSelect extends Delayable(InstancePlugin) {
    // region Init

    static $name = 'EventDragSelect';

    targetSelector = '.b-sch-timeaxis-cell, .b-timeaxissubgrid';

    construct(client, config) {

        client.multiEventSelect = true;

        super.construct(client, config);
    }

    //endregion

    //region Plugin config

    // Plugin configuration. This plugin chains some of the functions in Scheduler.
    static pluginConfig = {
        chain : ['onElementMouseDown', 'onElementMouseMove']
    };

    //endregion

    onElementMouseDown(event) {
        const
            me                   = this,
            { client }           = me,
            { foregroundCanvas } = client,
            canvasRect           = Rectangle.from(foregroundCanvas, true);

        // only react to mouse input, and left button
        if (event.touches || event.button !== 0 || me.disabled) {
            return;
        }

        // only react to mousedown directly on grid cell or subgrid element
        if (event.target.matches(me.targetSelector)) {
            me.startX = event.clientX - canvasRect.x;
            me.startY = event.clientY - canvasRect.y;

            me.element = DomHelper.createElement({
                tag           : 'div',
                className     : 'b-dragselect-rect',
                parent        : client.foregroundCanvas,
                retainElement : true,
                style         : {
                    transform : `translate(${me.startX}px, ${me.startY}px)`
                }
            });

            client.element.classList.add('b-dragselecting');

            client.clearEventSelection();
            me.subGridElementRect = Rectangle.from(client.timeAxisSubGridElement, true);

            // No key processing during drag selection
            client.navigator.disabled = true;

            client.enableScrollingCloseToEdges(client.timeAxisSubGrid);

            me.mouseUpDetacher = EventHelper.on({
                element : document,
                mouseup : 'onDocumentMouseUp',
                thisObj : me
            });
        }
    }

    get eventRectangles() {
        const { client } = this;

        return Array.from(client.element.querySelectorAll(client.eventSelector)).map(el => ({
            rectangle : Rectangle.from(el, true),
            record    : client.resolveAssignmentRecord(el)
        }));
    }

    onElementMouseMove(event) {
        const me = this;

        if (typeof me.startX === 'number') {
            const
                canvasRect  = me.rectangle = Rectangle.from(me.client.foregroundCanvas, true),
                x           = Math.min(Math.max(event.clientX - canvasRect.x, 0), canvasRect.width + 1),
                y           = Math.min(Math.max(event.clientY - canvasRect.y, 0), canvasRect.height + 1),
                rect        = new Rectangle(me.startX, me.startY, x - me.startX, y - me.startY);

            DomHelper.setTranslateXY(me.element, rect.x, rect.y);
            me.element.style.width  = `${rect.width}px`;
            me.element.style.height = `${rect.height}px`;

            me.updateSelection();
        }
    }

    onDocumentMouseUp(event) {
        const
            me                                 = this,
            { client }                         = me,
            { selectedAssignments, navigator } = client;

        client.disableScrollingCloseToEdges(client.timeAxisSubGrid);

        me.element?.remove();
        client.element.classList.remove('b-dragselecting');
        me.startX = me.startY = null;

        // Navigator will react to the 'click' event which clears selection, bypass this
        navigator.skipNextClick = client.timeAxisSubGridElement.contains(event.target);
        navigator.disabled = false;

        // If we selected something, focus last selected event so keyboard navigation works
        if (selectedAssignments.length) {
            navigator.skipScrollIntoView = true;
            client.activeAssignment = selectedAssignments[selectedAssignments.length - 1];
            navigator.activeItem?.focus();
            navigator.skipScrollIntoView = false;
        }

        me.mouseUpDetacher();
    }

    updateSelection() {
        const
            me            = this,
            selectionRect = me.rectangle = Rectangle.from(me.element, true),
            {
                eventRectangles,
                client
            }             = me,
            // If any currently selected assignments have had their DOM representation
            // released due to being scrolled out of view, they must remain selected.
            // Collect assignments which have no DOM representation as the initial
            // selection.
            selection     = client.selectedAssignments.reduce((r, a) => {
                if (!client.getElementFromAssignmentRecord(a)) {
                    r.push(a);
                }
                return r;
            }, []);

        for (const assignmentData of eventRectangles) {
            const shouldSelect = selectionRect.intersect(assignmentData.rectangle, true);

            if (shouldSelect && !assignmentData.selected) {
                assignmentData.selected = true;
                selection.push(assignmentData.record);
            }
        }

        // Replace selection
        client.selectedAssignments = selection;
    }
}

GridFeatureManager.registerFeature(EventDragSelect, false, 'Scheduler');
