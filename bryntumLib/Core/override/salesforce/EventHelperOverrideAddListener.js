import EventHelper from '../../helper/EventHelper.js';
import Override from '../../mixin/Override.js';

/*
 * This override fixes error `[LWC error]: The `addEventListener` method on ShadowRoot does not support any options.`
 * @private
 */
// Issue: https://github.com/bryntum/support/issues/3618
// Issue introduced by fix to this ticket: https://github.com/bryntum/support/issues/3552
class EventHelperOverrideAddListener {
    static get target() {
        return {
            class : EventHelper
        };
    }

    static addListener(target, event, handler, options) {
        // If we try to add listener to DocumentFragment we should clear options
        if (target?.nodeType === 11 && options && 'capture' in options) {
            delete options.capture;
        }

        return this._overridden.addListener.call(this, target, event, handler, options);
    }
}

Override.apply(EventHelperOverrideAddListener);
