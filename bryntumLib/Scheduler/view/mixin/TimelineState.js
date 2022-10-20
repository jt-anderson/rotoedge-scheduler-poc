import Base from '../../../Core/Base.js';
import ObjectHelper from '../../../Core/helper/ObjectHelper.js';

/**
 * @module Scheduler/view/mixin/TimelineState
 */

const copyProperties = [
    'barMargin'
];

/**
 * Mixin for Timeline base that handles state. It serializes the following timeline properties:
 *
 * * barMargin
 * * zoomLevel
 *
 * See {@link Grid.view.mixin.GridState} and {@link Core.mixin.State} for more information on state.
 *
 * @mixin
 */
export default Target => class TimelineState extends (Target || Base) {
    static get $name() {
        return 'TimelineState';
    }

    /**
     * Gets or sets timeline's state. Check out {@link Scheduler.view.mixin.TimelineState TimelineState} mixin for details.
     * @member {Object} state
     * @category State
     */

    /**
     * Get timeline's current state for serialization. State includes rowHeight, headerHeight, readOnly, selectedCell,
     * selectedRecordId, column states and store state etc.
     * @returns {Object} State object to be serialized
     * @private
     */
    getState() {
        const
            me    = this,
            state = ObjectHelper.copyProperties(super.getState(), me, copyProperties);

        state.zoomLevel = me.zoomLevel;

        state.zoomLevelOptions = {
            startDate  : me.startDate,
            endDate    : me.endDate,
            centerDate : me.viewportCenterDate,
            width      : me.tickSize
        };

        return state;
    }

    /**
     * Apply previously stored state.
     * @param {Object} state
     * @private
     */
    applyState(state) {
        const me = this;

        me.suspendRefresh();

        if (state.zoomLevel != null) {
            // Do not restore left scroll, infinite scroll should do all the work
            if (me.infiniteScroll) {
                if (state?.scroll?.scrollLeft) {
                    state.scroll.scrollLeft = {};
                }
            }

            if (me.isPainted) {
                me.zoomToLevel(state.zoomLevel, state.zoomLevelOptions);
            }
            else {
                me._zoomAfterPaint = { zoomLevel : state.zoomLevel, zoomLevelOptions : state.zoomLevelOptions };
            }
        }

        ObjectHelper.copyProperties(me, state, copyProperties);

        super.applyState(state);

        me.resumeRefresh(true);
    }

    onPaint(...args) {
        super.onPaint(...args);

        if (this._zoomAfterPaint) {
            const { zoomLevel, zoomLevelOptions } = this._zoomAfterPaint;

            this.zoomToLevel(zoomLevel, zoomLevelOptions);

            delete this._zoomAfterPaint;
        }
    }

    // This does not need a className on Widgets.
    // Each *Class* which doesn't need 'b-' + constructor.name.toLowerCase() automatically adding
    // to the Widget it's mixed in to should implement thus.
    get widgetClass() {}
};
