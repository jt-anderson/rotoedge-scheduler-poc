import GridHeader from '../../Grid/view/Header.js';

/**
 * @module Scheduler/view/Header
 */

/**
 * Custom header subclass which handles the existence of the special TimeAxisColumn
 *
 * @extends Grid/view/Header
 * @private
 */
export default class Header extends GridHeader {
    static get $name() {
        return 'SchedulerHeader';
    }

    refreshContent() {
        // Only render contents into the header once as it contains the special rendering of the TimeAxisColumn
        // In case ResizeObserver polyfill is used headers element will have resize monitors inserted and we should
        // take that into account
        // https://github.com/bryntum/support/issues/3444
        if (!this.headersElement?.querySelector('.b-sch-timeaxiscolumn')) {
            super.refreshContent();
        }
    }
}
