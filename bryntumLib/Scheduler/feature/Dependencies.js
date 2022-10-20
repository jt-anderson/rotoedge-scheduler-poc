import DomSync from '../../Core/helper/DomSync.js';
import VersionHelper from '../../Core/helper/VersionHelper.js';
import Rectangle from '../../Core/helper/util/Rectangle.js';
import Delayable from '../../Core/mixin/Delayable.js';
import InstancePlugin from '../../Core/mixin/InstancePlugin.js';
import GridFeatureManager from '../../Grid/feature/GridFeatureManager.js';
import AttachToProjectMixin from '../data/mixin/AttachToProjectMixin.js';
import DependencyCreation from './mixin/DependencyCreation.js';
import DependencyGridCache from './mixin/DependencyGridCache.js';
import DependencyLineGenerator from './mixin/DependencyLineGenerator.js';
import DependencyTooltip from './mixin/DependencyTooltip.js';

/**
 * @module Scheduler/feature/Dependencies
 */

/**
 * Feature that draws dependencies between events. Uses a {@link Scheduler.data.DependencyStore} to determine which
 * dependencies to draw, if none is defined one will be created automatically. Dependencies can also be specified as
 * `scheduler.dependencies`, see example below:
 *
 * {@inlineexample Scheduler/feature/Dependencies.js}
 *
 * Dependencies also work in vertical mode:
 *
 * {@inlineexample Scheduler/feature/DependenciesVertical.js}
 *
 * To customize the dependency tooltip, you can provide the {@link #config-tooltip} config and specify a
 * {@link Core.widget.Tooltip#config-getHtml} function. For example:
 *
 * ```javascript
 * const scheduler = new Scheduler({
 *     features : {
 *         dependencies : {
 *             tooltip : {
 *                 getHtml({ activeTarget }) {
 *                     const dependencyModel = scheduler.resolveDependencyRecord(activeTarget);
 *
 *                     if (!dependencyModel) return null;
 *
 *                     const { fromEvent, toEvent } = dependencyModel;
 *
 *                     return `${fromEvent.name} (${fromEvent.id}) -> ${toEvent.name} (${toEvent.id})`;
 *                 }
 *             }
 *         }
 *     }
 * }
 * ```
 *
 * ## Styling dependency lines
 *
 * You can easily customize the arrows drawn between events. To change all arrows, apply the following basic SVG CSS:
 *
 * ```css
 * .b-sch-dependency {
 *    stroke-width: 2;
 *    stroke : red;
 * }
 *
 * .b-sch-dependency-arrow {
 *     fill: red;
 * }
 * ```
 *
 * To style an individual dependency line, you can provide a [cls](#Scheduler/model/DependencyModel#field-cls) in your
 * data:
 *
 * ```json
 * {
 *     "id"   : 9,
 *     "from" : 7,
 *     "to"   : 8,
 *     "cls"  : "special-dependency"
 * }
 * ```
 *
 * ```scss
 * // Make line dashed
 * .b-sch-dependency {
 *    stroke-dasharray: 5, 5;
 * }
 * ```
 *
 * To customize the marker used for the lines (the arrow header), you can supply a SVG path definition to the
 * {@link #config-markerDef} config:
 *
 * {@inlineexample Scheduler/feature/DependenciesMarker.js}
 *
 * You can also specify a {@link #config-radius} to get lines with rounded "corners", for a less box look:
 *
 * {@inlineexample Scheduler/feature/DependenciesRadius.js}
 *
 * For advanced use cases, you can also manipulate the {@link DomConfig} used to create a dependency line in a
 * {@link #config-renderer} function.
 *
 * This feature is **off** by default. For info on enabling it, see {@link Grid.view.mixin.GridFeatures}.
 *
 * @mixes Core/mixin/Delayable
 * @mixes Scheduler/feature/mixin/DependencyCreation
 * @mixes Scheduler/feature/mixin/DependencyTooltip
 *
 * @extends Core/mixin/InstancePlugin
 * @demo Scheduler/dependencies
 * @classtype dependencies
 * @feature
 */
export default class Dependencies extends InstancePlugin.mixin(
    AttachToProjectMixin,
    Delayable,
    DependencyCreation,
    DependencyGridCache,
    DependencyLineGenerator,
    DependencyTooltip
) {
    static $name = 'Dependencies';

    /**
     * Fired when dependencies are rendered
     * @on-owner
     * @event dependenciesDrawn
     */

    //region Config

    static configurable = {
        /**
         * The CSS class to add to a dependency line when hovering over it
         * @config {String}
         * @default
         * @private
         */
        overCls : 'b-sch-dependency-over',

        /**
         * The CSS class applied to dependency lines
         * @config {String}
         * @default
         * @private
         */
        baseCls : 'b-sch-dependency',

        /**
         * The CSS class applied to a too narrow dependency line (to hide markers)
         * @config {String}
         * @default
         * @private
         */
        noMarkerCls : 'b-sch-dependency-markerless',

        /**
         * SVG path definition used as marker (arrow head) for the dependency lines.
         * Should fit in a viewBox that is 9 x 6.
         *
         * ```javascript
         * const scheduler = new Scheduler({
         *     features : {
         *         dependencies : {
         *             // Circular marker
         *             markerDef : 'M 2,3 a 3,3 0 1,0 6,0 a 3,3 0 1,0 -6,0'
         *         }
         *     }
         * });
         * ```
         *
         * @config {String}
         * @default 'M3,0 L3,6 L9,3 z'
         */
        markerDef : null,

        /**
         * Radius (in px) used to draw arcs where dependency line segments connect. Specify it to get a rounded look.
         * The radius will during drawing be reduced as needed on a per segment basis to fit lines.
         *
         * ```javascript
         * const scheduler = new Scheduler({
         *     features : {
         *         dependencies : {
         *             // Round the corner where line segments connect, similar to 'border-radius: 5px'
         *             radius : 5
         *         }
         *     }
         * });
         * ```
         *
         * <div class="note">Using a radius slightly degrades dependency rendering performance. If your app displays
         * a lot of dependencies, it might be worth taking this into account when deciding if you want to use radius
         * or not</div>
         *
         * @config {Number}
         */
        radius : null,

        /**
         * Renderer function, supply one if you want to manipulate the {@link DomConfig} object used to draw a
         * dependency line between two assignments.
         *
         * ```javascript
         * const scheduler = new Scheduler({
         *     features : {
         *         dependencies : {
         *             renderer({ domConfig, fromAssignmentRecord : from, toAssignmentRecord : to }) {
         *                 // Add a custom CSS class to dependencies between important assignments
         *                 domConfig.class.important = from.important || to.important;
         *                 domConfig.class.veryImportant = from.important && to.important;
         *             }
         *         }
         *     }
         * }
         * ```
         *
         * @param {Object} renderData
         * @param {DomConfig} renderData.domConfig that will be used to create the dependency line, can be manipulated by the
         * renderer
         * @param {Scheduler.model.DependencyModel} renderData.dependencyRecord The dependency being rendered
         * @param {Scheduler.model.AssignmentModel} renderData.fromAssignmentRecord Drawing line from this assignment
         * @param {Scheduler.model.AssignmentModel} renderData.toAssignmentRecord Drawing line to this assignment
         * @param {Object[]} renderData.points A collection of points making up the line segments for the dependency
         * line. Read-only in the renderer, any manipulation should be done to `domConfig`
         * @param {Core.helper.util.Rectangle} renderData.fromBox Bounds for the fromAssignment's element
         * @param {Core.helper.util.Rectangle} renderData.toBox Bounds for the toAssignment's element
         * @param {'top'|'right'|'bottom'|'left'} renderData.fromSide Drawn from this side of the fromAssignment
         * @param {'top'|'right'|'bottom'|'left'} renderData.toSide Drawn to this side of the fromAssignment
         * @prp {Function}
         */
        renderer : null,

        /**
         * Specify `true` to highlight incoming and outgoing dependencies when hovering an event.
         * @prp {Boolean}
         */
        highlightDependenciesOnEventHover : null
    };

    static delayable = {
        doRefresh : 'raf'
    };

    static pluginConfig = {
        chain  : ['render', 'onPaint', 'onElementClick', 'onElementDblClick', 'onElementMouseOver', 'onElementMouseOut'],
        assign : ['getElementForDependency', 'getElementsForDependency', 'resolveDependencyRecord']
    };

    domConfigs  = new Map();
    drawingLive = false;
    lastScrollX = null;
    highlighted = new Map();

    //endregion

    //region Init & destroy

    construct(client, config) {
        super.construct(client, config);

        client.on({
            svgCanvasCreated                            : 'onSVGReady',
            // These events trigger live refresh behaviour
            animationStart                              : 'refresh',
            // eventDrag in Scheduler, taskDrag in Gantt
            [client.scheduledEventName + 'DragStart']   : 'refresh',
            [client.scheduledEventName + 'ResizeStart'] : 'refresh',
            // These draw as early as possible (in same frame)
            scroll                                      : 'draw',
            horizontalScroll                            : {
                fn   : 'onHorizontalScroll',
                prio : -100 // After Scheduler draws on scroll, since we target elements
            },
            // These events shift the surroundings to such extent that grid cache needs rebuilding to be sure that
            // all dependencies are considered
            timelineViewportResize  : 'reset',
            timeAxisViewModelUpdate : 'reset',
            toggleNode              : 'reset',
            thisObj                 : this
        });

        client.rowManager.on({
            refresh           : 'reset', // For example when changing barMargin or rowHeight
            changeTotalHeight : 'reset', // For example when collapsing groups
            thisObj           : this
        });
    }

    doDisable(disable) {
        if (!this.isConfiguring) {
            // Need a flag to clear dependencies when disabled, since drawing is otherwise disabled too
            this._isDisabling = disable;
            this.draw();
            this._isDisabling = false;
        }

        super.doDisable(disable);
    }

    //endregion

    //region RefreshTriggers

    // TODO: Need toggleNode, viewportResize, translateRow, changeTotalHeight, idChange ?

    attachToProject(project) {
        super.attachToProject(project);

        project?.on({
            name            : 'project',
            commitFinalized : 'reset',
            thisObj         : this
        });
    }

    attachToResourceStore(resourceStore) {
        super.attachToResourceStore(resourceStore);

        resourceStore?.on({
            name    : 'resourceStore',
            change  : 'reset',
            refresh : 'reset',
            thisObj : this
        });
    }

    attachToEventStore(eventStore) {
        super.attachToEventStore(eventStore);

        eventStore?.on({
            name    : 'eventStore',
            refresh : 'reset',
            thisObj : this
        });
    }

    attachToAssignmentStore(assignmentStore) {
        super.attachToAssignmentStore(assignmentStore);

        assignmentStore?.on({
            name    : 'assignmentStore',
            refresh : 'reset',
            thisObj : this
        });
    }

    attachToDependencyStore(dependencyStore) {
        super.attachToDependencyStore(dependencyStore);

        dependencyStore?.on({
            name    : 'dependencyStore',
            change  : 'reset',
            refresh : 'reset',
            thisObj : this
        });
    }

    onHorizontalScroll({ subGrid, scrollX }) {
        if (scrollX !== this.lastScrollX && subGrid === this.client.timeAxisSubGrid) {
            this.lastScrollX = scrollX;
            this.draw();
        }
    }

    onPaint() {
        this.refresh();
    }

    //endregion

    //region Dependency types

    // Used by DependencyField
    static getLocalizedDependencyType(type) {
        // Do not remove. Assertion strings for Localization sanity check.
        // 'L{DependencyType.SS}'
        // 'L{DependencyType.SF}'
        // 'L{DependencyType.FS}'
        // 'L{DependencyType.FF}'
        // 'L{DependencyType.StartToStart}'
        // 'L{DependencyType.StartToEnd}'
        // 'L{DependencyType.EndToStart}'
        // 'L{DependencyType.EndToEnd}'
        // 'L{DependencyType.long}'
        // 'L{DependencyType.short}'

        return type ? this.L(`L{DependencyType.${type}}`) : '';
    }

    //endregion

    //region Elements

    getElementForDependency(dependency, fromAssignment, toAssignment) {
        return this.getElementsForDependency(dependency, fromAssignment, toAssignment)[0];
    }

    // NOTE: If we ever make this public we should change it to use the syncIdMap. Currently not needed since only
    // used in tests
    getElementsForDependency(dependency, fromAssignment, toAssignment) {
        // Selector targeting all instances of a dependency
        let selector = `[data-dep-id="${dependency.id}"]`;

        // Optionally narrow it down to a single instance (assignment)
        if (fromAssignment) {
            selector += `[data-from-id="${fromAssignment.id}"]`;
        }
        if (toAssignment) {
            selector += `[data-to-id="${toAssignment.id}"]`;
        }

        return Array.from(this.client.svgCanvas.querySelectorAll(selector));
    }

    /**
     * Returns the dependency record for a DOM element
     * @param {HTMLElement} element The dependency line element
     * @returns {Scheduler.model.DependencyModel} The dependency record
     */
    resolveDependencyRecord(element) {
        return element.elementData?.dependency;
    }

    isDependencyElement(element) {
        return element.matches(`.${this.baseCls}`);
    }

    //endregion

    //region DOM Events

    onElementClick(event) {
        const dependency = this.resolveDependencyRecord(event.target);

        if (dependency) {
            const eventName = event.type === 'click' ? 'Click' : 'DblClick';

            /**
             * Fires on the owning Scheduler/Gantt when a click is registered on a dependency line.
             * @event dependencyClick
             * @on-owner
             * @param {Scheduler.view.Scheduler} source The scheduler
             * @param {Scheduler.model.DependencyModel} dependency
             * @param {MouseEvent} event
             */
            /**
             * Fires on the owning Scheduler/Gantt when a click is registered on a dependency line.
             * @event dependencyDblClick
             * @on-owner
             * @param {Scheduler.view.Scheduler} source The scheduler
             * @param {Scheduler.model.DependencyModel} dependency
             * @param {MouseEvent} event
             */
            this.client.trigger(`dependency${eventName}`, {
                dependency,
                event
            });
        }
    }

    onElementDblClick(event) {
        return this.onElementClick(event);
    }

    onElementMouseOver(event) {
        const
            me         = this,
            dependency = me.resolveDependencyRecord(event.target);

        if (dependency) {
            /**
             * Fires on the owning Scheduler/Gantt when the mouse moves over a dependency line.
             * @event dependencyMouseOver
             * @on-owner
             * @param {Scheduler.view.Scheduler} source The scheduler
             * @param {Scheduler.model.DependencyModel} dependency
             * @param {MouseEvent} event
             */
            me.client.trigger('dependencyMouseOver', {
                dependency,
                event
            });

            if (me.overCls) {
                me.highlight(dependency);
                me.drawDependency(dependency);
            }
        }
    }

    onElementMouseOut(event) {
        const
            me         = this,
            dependency = me.resolveDependencyRecord(event.target);

        if (dependency) {
            /**
             * Fires on the owning Scheduler/Gantt when the mouse moves out of a dependency line.
             * @event dependencyMouseOut
             * @on-owner
             * @param {Scheduler.view.Scheduler} source The scheduler
             * @param {Scheduler.model.DependencyModel} dependency
             * @param {MouseEvent} event
             */
            me.client.trigger('dependencyMouseOut', {
                dependency,
                event
            });

            if (me.overCls) {
                me.unhighlight(dependency);
                me.drawDependency(dependency);
            }
        }
    }

    //endregion

    //region Export

    // Export calls this fn to determine if a dependency should be included or not
    isDependencyVisible(dependency) {
        const
            me                     = this,
            { resourceStore }      = me.client,
            { fromEvent, toEvent } = dependency;

        // Bail out early in case source or target doesn't exist
        if (!fromEvent || !toEvent) {
            return false;
        }

        const
            fromResource = fromEvent.resource,
            toResource   = toEvent.resource;

        // Verify these are real existing Resources and not collapsed away (resource not existing in resource store)
        if (!resourceStore.isAvailable(fromResource) || !resourceStore.isAvailable(toResource)) {
            return false;
        }

        return fromEvent.isModel &&
            !fromResource.instanceMeta(resourceStore).hidden &&
            !toResource.instanceMeta(resourceStore).hidden;
    }

    //endregion

    //region Highlight

    updateHighlightDependenciesOnEventHover(enable) {
        const me = this;

        if (enable) {
            const { client } = me;

            client.on({
                name                                       : 'highlightOnHover',
                [`${client.scheduledEventName}MouseEnter`] : params => me.highlightEventDependencies(params.eventRecord || params.taskRecord),
                [`${client.scheduledEventName}MouseLeave`] : params => me.unhighlightEventDependencies(params.eventRecord || params.taskRecord),
                thisObj                                    : me
            });
        }
        else {
            me.detachListeners('highlightOnHover');
        }
    }

    highlight(dependency, cls = this.overCls) {
        let classes = this.highlighted.get(dependency);

        if (!classes) {
            this.highlighted.set(dependency, classes = new Set());
        }

        classes.add(cls);

        this.reset();
    }

    unhighlight(dependency, cls = this.overCls) {
        const classes = this.highlighted.get(dependency);

        if (classes) {
            classes.delete(cls);

            if (!classes.size) {
                this.highlighted.delete(dependency);
            }
        }
        this.reset();
    }

    highlightEventDependencies(timespan, cls) {
        timespan.dependencies.forEach(dep => this.highlight(dep, cls));
    }

    unhighlightEventDependencies(timespan, cls) {
        timespan.dependencies.forEach(dep => this.unhighlight(dep, cls));
    }

    //endregion

    //region Drawing

    // Implemented in DependencyGridCache to return dependencies that might intersect the current viewport and thus
    // should be considered for drawing. Fallback value here is used when there is no grid cache (which happens when it
    // is reset. Also useful in case we want to have it configurable or opt out automatically for small datasets)
    getDependenciesToConsider(startMS, endMS, startIndex, endIndex) {
        // Get records from grid cache
        return super.getDependenciesToConsider?.(startMS, endMS, startIndex, endIndex) ??
            // Falling back to using all valid deps (fix for not trying to draw conflicted deps)
            this.project.dependencyStore.records.filter(d => d.isValid);
    }

    // String key used as syncId
    getDependencyKey(dependency, fromAssignment, toAssignment) {
        return `dep:${dependency.id};from:${fromAssignment.id};to:${toAssignment.id}`;
    }

    // TODO Was public
    // Draw a single dependency, if it is in view (overridden in Gantt)
    drawDependency(dependency, batch = false, forceBoxes = null) {
        const
            me                     = this,
            {
                domConfigs,
                client,
                rowStore
            } = me,
            {
                eventStore,
                resourceStore,
                visibleResources,
                useInitialAnimation
            }                      = client,
            { idMap }              = rowStore,
            topIndex               = rowStore.indexOf(visibleResources.first),
            bottomIndex            = rowStore.indexOf(visibleResources.last),
            { startMS, endMS }     = client.visibleDateRange,
            { fromEvent, toEvent } = dependency;

        if (
            // No point in trying to draw dep between unscheduled/non-existing events
            fromEvent.isScheduled && toEvent.isScheduled &&
            // Or between filtered out events
            eventStore.includes(fromEvent) && eventStore.includes(toEvent) &&
            // Or unassigned ones
            fromEvent.assigned && toEvent.assigned
        ) {
            for (const from of fromEvent.assigned) {
                for (const to of toEvent.assigned) {
                    const
                        // Using direct lookup in idMap instead of indexOf() for performance.
                        // Resource might be filtered out or not exist at all
                        fromIndex  = idMap[from.resource?.id]?.index,
                        toIndex    = idMap[to.resource?.id]?.index,
                        fromDateMS = Math.min(fromEvent.startDateMS, toEvent.startDateMS),
                        toDateMS   = Math.max(fromEvent.endDateMS, toEvent.endDateMS);

                    // Draw only if dependency intersects view, unless it is part of an export
                    if (client.isExporting || fromIndex != null && toIndex != null &&
                        (resourceStore.isAvailable(from.resource) && (resourceStore.isAvailable(to.resource))) && !(
                        // Both ends above view
                        (fromIndex < topIndex && toIndex < topIndex) ||
                        // Both ends below view
                        (fromIndex > bottomIndex && toIndex > bottomIndex) ||
                        // Both ends before view
                        (fromDateMS < startMS && toDateMS < startMS) ||
                        // Both ends after view
                        (fromDateMS > endMS && toDateMS > endMS)
                    )) {
                        const
                            key       = me.getDependencyKey(dependency, from, to),
                            domConfig = me.getDomConfig(dependency, from, to, forceBoxes);

                        if (domConfig) {
                            // Allow deps to match animation delay of their events (the bottommost one) when fading in
                            if (useInitialAnimation) {
                                domConfig.style = {
                                    animationDelay : `${Math.max(fromIndex, toIndex) / 20 * 1000}ms`
                                };
                            }

                            domConfigs.set(key, domConfig);
                        }
                        // No room to draw a line
                        else {
                            domConfigs.delete(key);
                        }
                    }

                    // Give mixins a shot at running code after a dependency is drawn. Used by grid cache to cache the
                    // dependency (when needed)
                    me.afterDrawDependency(dependency, fromIndex, toIndex, fromDateMS, toDateMS);
                }
            }
        }

        if (!batch) {
            me.domSync();
        }
    }

    // Hooks used by grid cache, to keep code in this file readable
    afterDrawDependency(dependency, fromIndex, toIndex, fromDateMS, toDateMS) {
        super.afterDrawDependency?.(dependency, fromIndex, toIndex, fromDateMS, toDateMS);
    }

    beforeDraw() {
        super.beforeDraw?.();
    }

    afterDraw() {
        super.afterDraw?.();
    }

    // Update DOM
    domSync(targetElement = this.client.svgCanvas) {
        DomSync.sync({
            targetElement,
            domConfig : {
                onlyChildren : true,
                children     : Array.from(this.domConfigs.values())
            },
            syncIdField      : 'syncId',
            releaseThreshold : 0,
            strict           : true,
            callback() {
                // TODO trigger events
            }
        });
    }

    get rowStore() {
        return this.client.resourceStore;
    }

    // Draw all dependencies intersecting the current viewport immediately
    draw() {
        const
            me         = this,
            { client } = me;

        if (client.refreshSuspended || !client.foregroundCanvas || !client.isEngineReady || (me.disabled && !me._isDisabling) || client.isExporting) {
            return;
        }

        // Cache subgrid bounds for the duration of this draw call to not have to figure it out per dep
        me.relativeTo = Rectangle.from(client.foregroundCanvas);
        me.domConfigs.clear();

        // Nothing to draw if there are no rows or no ticks or we are disabled
        if (client.firstVisibleRow && client.lastVisibleRow && client.timeAxis.count && !me.disabled) {
            const
                {
                    visibleDateRange,
                    visibleResources
                }            = client,
                startIndex   = me.rowStore.indexOf(visibleResources.first),
                endIndex     = me.rowStore.indexOf(visibleResources.last),
                dependencies = me.getDependenciesToConsider(visibleDateRange.startMS, visibleDateRange.endMS, startIndex, endIndex);

            // Give mixins a shot at doing something before deps are drawn. Used by grid cache to determine if
            // the cache should be rebuilt
            me.beforeDraw();

            for (const dependency of dependencies) {
                me.drawDependency(dependency, true);
            }

            // Give mixins a shot at doing something after all deps are drawn
            me.afterDraw();
        }

        me.domSync();

        client.trigger('dependenciesDrawn');
    }

    //endregion

    //region Refreshing

    // Performs a draw on next frame, not intended to be called directly, call refresh() instead
    doRefresh() {
        const
            me         = this,
            { client } = me;

        me.draw();

        // Refresh each frame during animations, during dragging & resizing
        me.drawingLive = client.isAnimating || client.useInitialAnimation ||
            client.features[`${client.scheduledEventName}Drag`]?.isActivelyDragging ||
            client.features[`${client.scheduledEventName}Resize`]?.isResizing;

        me.drawingLive && me.refresh();
    }

    /**
     * Redraws dependencies on the next animation frame
     */
    refresh() {
        // Queue up a draw unless refresh is suspended
        if (!this.client.refreshSuspended && !this.disabled && this.client.isPainted) {
            this.doRefresh();
        }
    }

    // Resets grid cache and performs a draw on next frame. Conditions when it should be called:
    // * Zooming
    // * Shifting time axis
    // * Resizing window
    // * CRUD
    // ...
    reset() {
        super.reset?.();
        this.refresh();
    }

    /**
     * Draws all dependencies for the specified task.
     * @deprecated 5.1 The Dependencies feature was refactored and this fn is no longer needed
     */
    drawForEvent() {
        VersionHelper.deprecate('Scheduler', '6.0.0', 'Dependencies.drawForEvent() is no longer needed');
        this.refresh();
    }

    //endregion

    //region Scheduler hooks

    render() {
        // Pull in the svg canvas early to have it available during drawing
        this.client.getConfig('svgCanvas');
    }

    //endregion
}

GridFeatureManager.registerFeature(Dependencies, false, ['Scheduler', 'ResourceHistogram']);
GridFeatureManager.registerFeature(Dependencies, true, 'SchedulerPro');
