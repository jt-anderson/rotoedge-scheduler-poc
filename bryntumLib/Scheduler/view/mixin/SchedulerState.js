import Base from '../../../Core/Base.js';
import ObjectHelper from '../../../Core/helper/ObjectHelper.js';

/**
 * @module Scheduler/view/mixin/SchedulerState
 */

const copyProperties = [
    'eventLayout',
    'mode',
    'eventColor',
    'eventStyle',
    'tickSize',
    'fillTicks'
];

/**
 * A Mixin for Scheduler that handles state. It serializes the following scheduler properties, in addition to what
 * is already stored by its superclass {@link Grid/view/mixin/GridState}:
 *
 * * eventLayout
 * * barMargin
 * * mode
 * * tickSize
 * * zoomLevel
 * * eventColor
 * * eventStyle
 *
 * See {@link Grid.view.mixin.GridState} and {@link Core.mixin.State} for more information on state.
 *
 * @mixin
 */
export default Target => class SchedulerState extends (Target || Base) {
    static get $name() {
        return 'SchedulerState';
    }

    /**
     * Gets or sets scheduler's state. Check out {@link Scheduler.view.mixin.SchedulerState SchedulerState} mixin
     * and {@link Grid.view.mixin.GridState} for more details.
     * @member {Object} state
     * @property {String} state.eventLayout
     * @property {String} state.eventStyle
     * @property {String} state.eventColor
     * @property {Number} state.barMargin
     * @property {Number} state.tickSize
     * @property {Boolean} state.fillTicks
     * @property {Number} state.zoomLevel
     * @property {'horizontal'|'vertical'} state.mode
     * @property {Object[]} state.columns
     * @property {Boolean} state.readOnly
     * @property {Number} state.rowHeight
     * @property {Object} state.scroll
     * @property {Number} state.scroll.scrollLeft
     * @property {Number} state.scroll.scrollTop
     * @property {Array} state.selectedRecords
     * @property {String} state.style
     * @property {Object} state.subGrids
     * @property {Object} state.store
     * @property {Object} state.store.sorters
     * @property {Object} state.store.groupers
     * @property {Object} state.store.filters
     */

    /**
     * Get scheduler's current state for serialization. State includes rowHeight, headerHeight, readOnly, selectedCell,
     * selectedRecordId, column states and store state etc.
     * @returns {Object} State object to be serialized
     * @private
     */
    getState() {
        return ObjectHelper.copyProperties(super.getState(), this, copyProperties);
    }

    /**
     * Apply previously stored state.
     * @param {Object} state
     * @private
     */
    applyState(state) {
        this.suspendRefresh();

        let propsToCopy = copyProperties.slice();

        if (state?.eventLayout === 'layoutFn') {
            delete state.eventLayout;
            propsToCopy.splice(propsToCopy.indexOf('eventLayout'), 1);
        }

        // Zoom level will set tick size, no need to update model additionally
        if (state?.zoomLevelOptions?.width) {
            propsToCopy = propsToCopy.filter(p => p !== 'tickSize');
        }

        ObjectHelper.copyProperties(this, state, propsToCopy);

        super.applyState(state);

        this.resumeRefresh(true);
    }

    // This does not need a className on Widgets.
    // Each *Class* which doesn't need 'b-' + constructor.name.toLowerCase() automatically adding
    // to the Widget it's mixed in to should implement thus.
    get widgetClass() {}
};
