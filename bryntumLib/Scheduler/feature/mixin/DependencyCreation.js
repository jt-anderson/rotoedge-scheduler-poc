import Base from '../../../Core/Base.js';
import DomHelper from '../../../Core/helper/DomHelper.js';
import Objects from '../../../Core/helper/util/Objects.js';
import Rectangle from '../../../Core/helper/util/Rectangle.js';
import Tooltip from '../../../Core/widget/Tooltip.js';
import EventHelper from '../../../Core/helper/EventHelper.js';
import DependencyBaseModel from '../../model/DependencyBaseModel.js';
import StringHelper from '../../../Core/helper/StringHelper.js';

/**
 * @module Scheduler/feature/mixin/DependencyCreation
 */

// TODO: refactor this class using StateChart utility to be implemented in Core/util/StateChart.js or XState library if allowed to be used
/**
 * Mixin for Dependencies feature that handles dependency creation (drag & drop from terminals which are shown on hover).
 * Requires {@link Core.mixin.Delayable} to be mixed in alongside.
 *
 * @mixin
 */
export default Target => class DependencyCreation extends (Target || Base) {
    static get $name() {
        return 'DependencyCreation';
    }

    //region Config

    static get defaultConfig() {
        return {
            /**
             * `false` to require a drop on a target event bar side circle to define the dependency type.
             * If dropped on the event bar, the `defaultValue` of the DependencyModel `type` field will be used to
             * determine the target task side.
             *
             * @member {Boolean} allowDropOnEventBar
             */
            /**
             * `false` to require a drop on a target event bar side circle to define the dependency type.
             * If dropped on the event bar, the `defaultValue` of the DependencyModel `type` field will be used to
             * determine the target task side.
             *
             * @config {Boolean}
             * @default
             */
            allowDropOnEventBar : true,

            /**
             * `false` to not show a tooltip while creating a dependency
             * @config {Boolean}
             * @default
             */
            showCreationTooltip : true,

            /**
             * A tooltip config object that will be applied to the dependency creation {@link Core.widget.Tooltip}
             * @config {TooltipConfig}
             */
            creationTooltip : null,

            /**
             * A template function that will be called to generate the HTML contents of the dependency creation tooltip.
             * You can return either a HTML string or a {@link DomConfig} object.
             * @prp {Function} creationTooltipTemplate
             * @param {Object} data Data about the dependency being created
             * @param {Scheduler.model.TimeSpan} data.source The from event
             * @param {Scheduler.model.TimeSpan} data.target The target event
             * @param {String} data.fromSide The from side (start, end, top, bottom)
             * @param {String} data.toSide The target side (start, end, top, bottom)
             * @param {Boolean} data.valid The validity of the dependency
             * @returns {String|Object}
             */

            /**
             * CSS class used for terminals
             * @config {String}
             * @default
             */
            terminalCls : 'b-sch-terminal',

            /**
             * Where (on event bar edges) to display terminals. The sides are `'start'`, `'top'`,
             * `'end'` and `'bottom'`
             * @config {String[]}
             */
            terminalSides : ['start', 'top', 'end', 'bottom'],

            /**
             * Set to `false` to not allow creating dependencies
             * @config {Boolean}
             * @default
             */
            allowCreate : true
        };
    }

    //endregion

    //region Init & destroy

    construct(view, config) {
        super.construct(view, config);

        const me = this;

        me.view = view;
        me.eventName = view.scheduledEventName;

        view.on('readOnly', () => me.updateCreateListeners());

        me.updateCreateListeners();
    }

    doDestroy() {
        const me = this;

        me.detachListeners('view');

        me.creationData = null;

        me.pointerUpMoveDetacher?.();
        me.creationTooltip?.destroy();

        super.doDestroy();
    }

    updateCreateListeners() {
        const me = this;

        if (!me.view) {
            return;
        }

        me.detachListeners('view');

        if (me.isCreateAllowed) {
            me.view.on({
                name                          : 'view',
                [`${me.eventName}mouseenter`] : 'onTimeSpanMouseEnter',
                [`${me.eventName}mouseleave`] : 'onTimeSpanMouseLeave',
                thisObj                       : me
            });
        }
    }

    set allowCreate(value) {
        this._allowCreate = value;

        this.updateCreateListeners();
    }

    get allowCreate() {
        return this._allowCreate;
    }

    get isCreateAllowed() {
        return this.allowCreate && !this.view.readOnly && !this.disabled;
    }

    //endregion

    //region Events

    /**
     * Show terminals when mouse enters event/task element
     * @private
     */
    onTimeSpanMouseEnter({
        event, source, [`${this.eventName}Record`]: record, [`${this.eventName}Element`]: element
    }) {
        if (!record.isCreating && !record.readOnly && (!this.client.features.nestedEvents || record.parent.isRoot)) {
            const
                me              = this,
                eventBarElement = DomHelper.down(element, source.eventInnerSelector);

            me.showTerminals(record, eventBarElement);

            if (me.creationData && event.target.closest(me.client.eventSelector)) {
                me.creationData.timeSpanElement = eventBarElement;
                me.onOverTargetEventBar(event);
            }
        }
    }

    /**
     * Hide terminals when mouse leaves event/task element
     * @private
     */
    onTimeSpanMouseLeave(event) {
        const
            me               = this,
            { creationData } = me,
            element          = event[`${me.eventName}Element`],
            target           = event.event.relatedTarget,
            timeSpanElement  = creationData?.timeSpanElement;

        if (!creationData || !timeSpanElement || !DomHelper.isDescendant(timeSpanElement, target)) {
            me.hideTerminals(element);
        }

        if (creationData && !creationData.finalizing) {
            creationData.timeSpanElement = null;
            me.onOverNewTargetWhileCreating(undefined, undefined, event);
        }
    }

    onTerminalMouseOver(event) {
        if (this.creationData) {
            this.onOverTargetEventBar(event);
        }
    }

    /**
     * Remove hover styling when mouse leaves terminal. Also hides terminals when mouse leaves one it and not creating a
     * dependency.
     * @private
     */
    onTerminalMouseOut(event) {
        const
            me               = this,
            { creationData } = me,
            eventElement     = DomHelper.up(event.target, me.view.eventSelector);

        if (eventElement && (!me.showingTerminalsFor || !DomHelper.isDescendant(eventElement, me.showingTerminalsFor)) && (!creationData || eventElement !== creationData.timeSpanElement)) {
            me.hideTerminals(eventElement);
            me.view.unhover(eventElement, event);
        }

        if (creationData) {
            me.onOverNewTargetWhileCreating(event.relatedTarget, creationData.target, event);
        }
    }

    /**
     * Start creating a dependency when mouse is pressed over terminal
     * @private
     */
    onTerminalPointerDown(event) {
        const me = this;

        // ignore non-left button clicks
        if (event.button === 0 && !me.creationData) {
            const
                scheduler              = me.view,
                timeAxisSubGridElement = scheduler.timeAxisSubGridElement,
                terminalNode           = event.target,
                timeSpanElement        = terminalNode.closest(scheduler.eventInnerSelector),
                viewBounds             = Rectangle.from(scheduler.element, document.body);

            event.stopPropagation();

            me.creationData = {
                source         : scheduler.resolveTimeSpanRecord(timeSpanElement),
                fromSide       : terminalNode.dataset.side,
                startPoint     : Rectangle.from(terminalNode, timeAxisSubGridElement).center,
                startX         : event.pageX - viewBounds.x + scheduler.scrollLeft,
                startY         : event.pageY - viewBounds.y + scheduler.scrollTop,
                valid          : false,
                sourceResource : scheduler.resolveResourceRecord?.(event),
                tooltip        : me.creationTooltip
            };

            me.pointerUpMoveDetacher = EventHelper.on({
                pointerup : {
                    element : scheduler.rootElement,
                    handler : 'onMouseUp'
                },
                pointermove : {
                    element : timeAxisSubGridElement,
                    handler : 'onMouseMove'
                },
                thisObj : me
            });

            // If root element is anything but Document (it could be Document Fragment or regular Node in case of LWC)
            // then we should also add listener to document to cancel dependency creation
            me.documentPointerUpDetacher = EventHelper.on({
                pointerup : {
                    element : document,
                    handler : 'onDocumentMouseUp'
                },
                keydown : {
                    element : document,
                    handler : ({ key }) => {
                        if (key === 'Escape') {
                            me.abort();
                        }
                    }
                },
                thisObj : me
            });
        }
    }

    /**
     * Update connector line showing dependency between source and target when mouse moves. Also check if mouse is over
     * a valid target terminal
     * @private
     */
    onMouseMove(event) {
        const
            me                            = this,
            { view, creationData : data } = me,
            viewBounds                    = Rectangle.from(view.element, document.body),
            deltaX                        = (event.pageX - viewBounds.x + view.scrollLeft) - data.startX,
            deltaY                        = (event.pageY - viewBounds.y + view.scrollTop) - data.startY,
            length                        = Math.round(Math.sqrt(deltaX * deltaX + deltaY * deltaY)) - 3,
            angle                         = Math.atan2(deltaY, deltaX);

        let { connector } = me;

        if (!connector) {
            if (me.onRequestDragCreate(event) === false) {
                return;
            }
            connector = me.connector;
        }

        connector.style.width     = `${length}px`;
        connector.style.transform = `rotate(${angle}rad)`;

        me.lastMouseMoveEvent = event;
    }

    onRequestDragCreate(event) {
        const
            me                            = this,
            { view, creationData : data } = me;

        /**
         * Fired on the owning Scheduler/Gantt before a dependency creation drag operation starts. Return `false to
         * prevent it
         * @event beforeDependencyCreateDrag
         * @on-owner
         * @param {Scheduler.model.TimeSpan} source The source task
         */
        if (view.trigger('beforeDependencyCreateDrag', { data, source : data.source }) === false) {
            me.abort();
            return false;
        }

        view.element.classList.add('b-creating-dependency');

        me.createConnector(data.startPoint.x, data.startPoint.y);

        /**
         * Fired on the owning Scheduler/Gantt when a dependency creation drag operation starts
         * @event dependencyCreateDragStart
         * @on-owner
         * @param {Scheduler.model.TimeSpan} source The source task
         */
        view.trigger('dependencyCreateDragStart', { data, source : data.source  });

        if (me.showCreationTooltip) {
            const tip = me.creationTooltip || (me.creationTooltip = me.createDragTooltip());

            me.creationData.tooltip = tip;

            tip.disabled = false;
            tip.show();

            tip.onMouseMove(event);
        }

        view.scrollManager.startMonitoring({
            scrollables : [
                {
                    element   : view.timeAxisSubGrid.scrollable.element,
                    direction : 'horizontal'
                },
                {
                    element   : view.scrollable.element,
                    direction : 'vertical'
                }
            ],
            callback : () => me.lastMouseMoveEvent && me.onMouseMove(me.lastMouseMoveEvent)
        });
    }

    onOverTargetEventBar(event) {
        const
            me                                                = this,
            { view, creationData: data, allowDropOnEventBar } = me,
            { target }                                        = event,
            overEventRecord                                   = view.resolveTimeSpanRecord(target);

        if (Objects.isPromise(data.valid) || (!allowDropOnEventBar && !target.classList.contains(me.terminalCls))) {
            return;
        }

        if (overEventRecord !== data.source) {
            me.onOverNewTargetWhileCreating(target, overEventRecord, event);
        }
    }

    async onOverNewTargetWhileCreating(targetElement, overEventRecord, event) {
        const
            me                                                            = this,
            { view, creationData : data, allowDropOnEventBar, connector } = me;

        if (Objects.isPromise(data.valid)) {
            return;
        }

        // stop target updating if dependency finalizing in progress
        if (data.finalizing) {
            return;
        }

        // Connector might not exist at this point because `pointerout` on the terminal might fire before `pointermove`
        // on the time axis subgrid. This is difficult to reproduce, so shouldn't be triggered often.
        // https://github.com/bryntum/support/issues/3116#issuecomment-894256799
        if (!connector) {
            return;
        }

        connector.classList.remove('b-valid', 'b-invalid');
        data.timeSpanElement && DomHelper.removeClsGlobally(data.timeSpanElement, 'b-sch-terminal-active');

        if (!overEventRecord || overEventRecord === data.source || (!allowDropOnEventBar && !targetElement.classList.contains(me.terminalCls))) {
            data.target = data.toSide = null;
            data.valid = false;
            connector.classList.add('b-invalid');
        }
        else {
            const
                target     = data.target = overEventRecord,
                { source } = data;

            let toSide  = targetElement.dataset.side;

            // If we allow dropping anywhere on a task, resolve target side based on the default type of the
            // dependency model used
            if (allowDropOnEventBar && !targetElement.classList.contains(me.terminalCls)) {
                toSide = me.getTargetSideFromType(me.dependencyStore.modelClass.fieldMap.type.defaultValue || DependencyBaseModel.Type.EndToStart);
            }

            if (view.resolveResourceRecord) {
                data.targetResource = view.resolveResourceRecord(event);
            }

            let dependencyType;

            data.toSide = toSide;

            const
                fromSide       = data.fromSide,
                updateValidity = valid => {
                    if (!me.isDestroyed) {
                        data.valid = valid;
                        targetElement.classList.add(valid ? 'b-valid' : 'b-invalid');
                        connector.classList.add(valid ? 'b-valid' : 'b-invalid');
                        /**
                         * Fired on the owning Scheduler/Gantt when asynchronous dependency validation completes
                         * @event dependencyValidationComplete
                         * @on-owner
                         * @param {Scheduler.model.TimeSpan} source The source task
                         * @param {Scheduler.model.TimeSpan} target The target task
                         * @param {Number} dependencyType The dependency type, see {@link Scheduler.model.DependencyBaseModel#property-Type-static}
                         */
                        view.trigger('dependencyValidationComplete', {
                            data,
                            source,
                            target,
                            dependencyType
                        });
                    }
                };

            // NOTE: Top/Bottom sides are not taken into account due to
            //       scheduler doesn't check for type value anyway, whereas
            //       gantt will reject any other dependency types undefined in
            //       DependencyBaseModel.Type enumeration.
            switch (true) {
                case fromSide === 'start' && toSide === 'start':
                    dependencyType = DependencyBaseModel.Type.StartToStart;
                    break;
                case fromSide === 'start' && toSide === 'end':
                    dependencyType = DependencyBaseModel.Type.StartToEnd;
                    break;
                case fromSide === 'end' && toSide === 'start':
                    dependencyType = DependencyBaseModel.Type.EndToStart;
                    break;
                case fromSide === 'end' && toSide === 'end':
                    dependencyType = DependencyBaseModel.Type.EndToEnd;
                    break;
            }

            /**
             * Fired on the owning Scheduler/Gantt when asynchronous dependency validation starts
             * @event dependencyValidationStart
             * @on-owner
             * @param {Scheduler.model.TimeSpan} source The source task
             * @param {Scheduler.model.TimeSpan} target The target task
             * @param {Number} dependencyType The dependency type, see {@link Scheduler.model.DependencyBaseModel#property-Type-static}
             */
            view.trigger('dependencyValidationStart', {
                data,
                source,
                target,
                dependencyType
            });

            const valid = data.valid = me.dependencyStore.isValidDependency(source, target, dependencyType);

            // Promise is returned when using the engine
            if (Objects.isPromise(valid)) {
                const asyncValid = await valid;
                updateValidity(asyncValid);
            }
            else {
                updateValidity(valid);
            }

            const validityCls = valid ? 'b-valid' : 'b-invalid';
            connector.classList.add(validityCls);
            data.timeSpanElement?.querySelector(`.b-sch-terminal[data-side=${toSide}]`).classList.add('b-sch-terminal-active', validityCls);
        }

        me.updateCreationTooltip();
    }

    /**
     * Create a new dependency if mouse release over valid terminal. Hides connector
     * @private
     */
    async onMouseUp() {
        const
            me   = this,
            data = me.creationData;

        data.finalizing = true;
        me.pointerUpMoveDetacher?.();

        if (data.valid) {
            /**
             * Fired on the owning Scheduler/Gantt when a dependency drag creation operation is about to finalize
             *
             * @event beforeDependencyCreateFinalize
             * @on-owner
             * @preventable
             * @async
             * @param {Scheduler.model.TimeSpan} source The source task
             * @param {Scheduler.model.TimeSpan} target The target task
             * @param {'start'|'end'|'top'|'bottom'} fromSide The from side (start / end / top / bottom)
             * @param {'start'|'end'|'top'|'bottom'} toSide The to side (start / end / top / bottom)
             */
            const result = await me.view.trigger('beforeDependencyCreateFinalize', data);

            if (result === false) {
                data.valid = false;
            }
            // Await any async validation logic before continuing
            else if (Objects.isPromise(data.valid)) {
                data.valid = await data.valid;
            }

            if (data.valid) {
                let dependency = me.createDependency(data);

                if (dependency !== null) {
                    if (Objects.isPromise(dependency)) {
                        dependency = await dependency;
                    }

                    data.dependency = dependency;

                    /**
                     * Fired on the owning Scheduler/Gantt when a dependency drag creation operation succeeds
                     * @event dependencyCreateDrop
                     * @on-owner
                     * @param {Scheduler.model.TimeSpan} source The source task
                     * @param {Scheduler.model.TimeSpan} target The target task
                     * @param {Scheduler.model.DependencyBaseModel} dependency The created dependency
                     */
                    me.view.trigger('dependencyCreateDrop', { data, source : data.source, target : data.target, dependency });
                    me.doAfterDependencyDrop(data);
                }
            }
            else {
                me.doAfterDependencyDrop(data);
            }
        }
        else {
            data.valid = false;
            me.doAfterDependencyDrop(data);
        }

        me.abort();
    }

    doAfterDependencyDrop(data) {
        /**
         * Fired on the owning Scheduler/Gantt after a dependency drag creation operation finished, no matter to outcome
         * @event afterDependencyCreateDrop
         * @on-owner
         * @param {Scheduler.model.TimeSpan} source The source task
         * @param {Scheduler.model.TimeSpan} target The target task
         * @param {Scheduler.model.DependencyBaseModel} dependency The created dependency
         */
        this.view.trigger('afterDependencyCreateDrop', {
            data,
            ...data
        });
    }

    onDocumentMouseUp({ target }) {
        if (!this.view.timeAxisSubGridElement.contains(target)) {
            this.abort();
        }
    }

    /**
     * Aborts dependency creation, removes proxy and cleans up listeners
     */
    abort() {
        const
            me                     = this,
            { view, creationData } = me;

        // Remove terminals from source and target events.
        if (creationData) {
            const { source, sourceResource, target, targetResource } = creationData;

            if (source) {
                const el = view.getElementFromEventRecord(source, sourceResource);
                if (el) {
                    me.hideTerminals(el);
                }
            }
            if (target) {
                const el = view.getElementFromEventRecord(target, targetResource);
                if (el) {
                    me.hideTerminals(el);
                }
            }
        }

        if (me.creationTooltip) {
            me.creationTooltip.disabled = true;
        }

        me.creationData = me.lastMouseMoveEvent = null;

        me.pointerUpMoveDetacher?.();

        me.documentPointerUpDetacher?.();

        me.removeConnector();
    }

    //endregion

    //region Connector

    /**
     * Creates a connector line that visualizes dependency source & target
     * @private
     */
    createConnector(x, y) {
        const
            me       = this,
            { view } = me;

        me.clearTimeout(me.removeConnectorTimeout);
        me.connector = DomHelper.createElement({
            parent    : view.timeAxisSubGridElement,
            className : `${me.baseCls}-connector`,
            style     : `left:${x}px;top:${y}px`
        });

        view.element.classList.add('b-creating-dependency');
    }

    createDragTooltip() {
        const
            me       = this,
            { view } = me;

        return me.creationTooltip = Tooltip.new({
            id             : `${view.id}-dependency-drag-tip`,
            cls            : 'b-sch-dependency-creation-tooltip',
            loadingMsg     : '',
            anchorToTarget : false,
            // Keep tip visible until drag drop operation is finalized
            forElement     : view.timeAxisSubGridElement,
            trackMouse     : true,
            // Do not constrain at all, want it to be able to go outside of the viewport to not get in the way
            constrainTo    : null,

            header : {
                dock : 'right'
            },

            listeners : {
                // Show initial content immediately
                beforeShow : 'updateCreationTooltip',
                thisObj    : me
            }
        }, me.creationTooltip);
    }

    /**
     * Remove connector
     * @private
     */
    removeConnector() {
        const
            me                  = this,
            { connector, view } = me;

        if (connector) {
            connector.classList.add('b-removing');
            connector.style.width = '0';
            me.removeConnectorTimeout = me.setTimeout(() => {
                connector.remove();
                me.connector = null;
            }, 200);
        }

        view.element.classList.remove('b-creating-dependency');
        me.creationTooltip && me.creationTooltip.hide();

        view.scrollManager.stopMonitoring();
    }

    //endregion

    //region Terminals

    /**
     * Show terminals for specified event at sides defined in #terminalSides.
     * @param {Scheduler.model.TimeSpan} timeSpanRecord Event/task to show terminals for
     * @param {HTMLElement} element Event/task element
     */
    showTerminals(timeSpanRecord, element) {
        const me = this;

        if (!me.isCreateAllowed) {
            return;
        }

        const
            cls                 = me.terminalCls,
            terminalsVisibleCls = `${cls}s-visible`;

        // We operate on the event bar, not the wrap
        element = DomHelper.down(element, me.view.eventInnerSelector);

        // bail out if terminals already shown or if view is readonly
        // do not draw new terminals if we are resizing event
        if (!element.classList.contains(terminalsVisibleCls) && !me.view.element.classList.contains('b-resizing-event') && !me.view.readOnly) {

            // create terminals for desired sides
            me.terminalSides.forEach(side => {
                // Allow code to use left for the start side and right for the end side
                side = me.fixSide(side);

                const terminal = DomHelper.createElement({
                    parent    : element,
                    className : `${cls} ${cls}-${side}`,
                    dataset   : {
                        side,
                        feature : true
                    }
                });

                terminal.detacher = EventHelper.on({
                    element     : terminal,
                    mouseover   : 'onTerminalMouseOver',
                    mouseout    : 'onTerminalMouseOut',
                    // Needs to be pointerdown to match DragHelper, otherwise will be preventing wrong event
                    pointerdown : {
                        handler : 'onTerminalPointerDown',
                        capture : true
                    },
                    thisObj : me
                });
            });

            element.classList.add(terminalsVisibleCls);
            timeSpanRecord.internalCls.add(terminalsVisibleCls);

            me.showingTerminalsFor = element;
        }
    }

    fixSide(side) {
        if (side === 'left') {
            return 'start';
        }
        if (side === 'right') {
            return 'end';
        }
        return side;
    }

    /**
     * Hide terminals for specified event
     * @param {HTMLElement} eventElement Event element
     */
    hideTerminals(eventElement) {
        // remove all terminals
        const
            me                  = this,
            eventParams         = me.client.getTimeSpanMouseEventParams(eventElement),
            timeSpanRecord      = eventParams?.[`${me.eventName}Record`],
            terminalsVisibleCls = `${me.terminalCls}s-visible`;

        DomHelper.forEachSelector(eventElement, `.${me.terminalCls}`, terminal => {
            terminal.detacher && terminal.detacher();
            terminal.remove();
        });

        DomHelper.down(eventElement, me.view.eventInnerSelector).classList.remove(terminalsVisibleCls);
        timeSpanRecord.internalCls.remove(terminalsVisibleCls);

        me.showingTerminalsFor = null;
    }

    //endregion

    //region Dependency creation

    /**
     * Create a new dependency from source terminal to target terminal
     * @internal
     */
    createDependency(data) {
        const
            { source, target, fromSide, toSide } = data,
            type                                 = (fromSide === 'start' ? 0 : 2) + (toSide === 'end' ? 1 : 0);

        const newDependency = this.dependencyStore.add({
            from : source.id,
            to   : target.id,
            type,
            fromSide,
            toSide
        });

        return newDependency !== null ? newDependency[0] : null;
    }

    getTargetSideFromType(type) {
        if (type === DependencyBaseModel.Type.StartToStart || type === DependencyBaseModel.Type.EndToStart) {
            return 'start';
        }

        return 'end';
    }

    //endregion

    //region Tooltip

    /**
     * Update dependency creation tooltip
     * @private
     */
    updateCreationTooltip() {
        const
            me            = this,
            data          = me.creationData,
            { valid }     = data,
            tip           = me.creationTooltip,
            { classList } = tip.element;

        // Promise, when using engine
        if (Objects.isPromise(valid)) {
            classList.remove('b-invalid');
            classList.add('b-checking');

            return new Promise(resolve => valid.then(valid => {
                data.valid = valid;

                if (!tip.isDestroyed) {
                    resolve(me.updateCreationTooltip());
                }
            }));
        }

        tip.html = me.creationTooltipTemplate(data);
    }

    creationTooltipTemplate(data) {
        const
            me                 = this,
            { tooltip, valid } = data,
            { classList }      = tooltip.element;

        Object.assign(data, {
            fromText : StringHelper.encodeHtml(data.source.name),
            toText   : StringHelper.encodeHtml(data.target?.name ?? ''),
            fromSide : data.fromSide,
            toSide   : data.toSide || ''
        });

        let tipTitleIconClsSuffix,
            tipTitleText;

        classList.toggle('b-invalid', !valid);
        classList.remove('b-checking');

        // Valid
        if (valid === true) {
            tipTitleIconClsSuffix = 'valid';
            tipTitleText          = me.L('L{Dependencies.valid}');
        }
        // Invalid
        else {
            tipTitleIconClsSuffix = 'invalid';
            tipTitleText          = me.L('L{Dependencies.invalid}');
        }

        tooltip.title = `<i class="b-icon b-icon-${tipTitleIconClsSuffix}"></i>${tipTitleText}`;

        return {
            children : [{
                className : 'b-sch-dependency-tooltip',
                children  : [
                    { dataset : { ref : 'fromLabel' }, tag : 'label', text : me.L('L{Dependencies.from}') },
                    { dataset : { ref : 'fromText' }, text : data.fromText },
                    { dataset : { ref : 'fromBox' }, className : `b-sch-box b-${data.fromSide}` },
                    { dataset : { ref : 'toLabel' }, tag : 'label', text : me.L('L{Dependencies.to}') },
                    { dataset : { ref : 'toText' }, text : data.toText },
                    { dataset : { ref : 'toBox' }, className : `b-sch-box b-${data.toSide}` }
                ]
            }]
        };
    }

    //endregion
};
