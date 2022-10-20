import EventHelper from '../../helper/EventHelper.js';
import Override from '../../mixin/Override.js';

const regExp = /-/;

let composedPathThrows;

/*
 * This override fixes fixEvent by wrapping passed event (which is not an Event instance) with another object to allow
 * overriding locked property `target`
 * @private
 */
class EventHelperOverride {
    static target = { class : EventHelper }

    static getComposedPathTarget(event) {
        let result;

        // composedPath throws in salesforce
        // https://github.com/bryntum/support/issues/4432
        // First time try to access composed path to check if it throws. If it does, do not use it anymore to ease
        // debugging pausing on caught exceptions
        if (composedPathThrows == null) {
            try {
                // try to access composedPath just in case it gets fixed at some point
                result = event.composedPath()[0];
                composedPathThrows = false;
            }
            catch {
                composedPathThrows = true;
            }
        }

        if (composedPathThrows) {
            if (event.path) {
                result = event.path[0];
            }
            else {
                result = event.target;
            }
        }
        else {
            result = event.composedPath()[0];
        }

        return result;
    }

    static fixEvent(event) {
        event = this._overridden.fixEvent.call(this, wrap(event));

        // custom element must have dash in it
        // https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name
        // event.path is not a public API, but it is implemented
        // https://github.com/salesforce/lwc/pull/859
        if (event.target && event.path && regExp.test(event.target.tagName)) {
            const
                targetElement  = event.path[0],
                originalTarget = event.target;

            // Can there be an event which actually originated from custom element, not its shadow dom?
            if (event.target !== targetElement) {
                Object.defineProperty(event, 'target', {
                    get          : () => targetElement,
                    configurable : true
                });

                // Save original target just in case
                Object.defineProperty(event, 'originalTarget', {
                    get          : () => originalTarget,
                    configurable : true
                });
            }
        }

        return event;
    }
}

const copyPropertyNames = [
    // undocumented
    'path',

    // Event
    'bubbles', 'cancelable', 'composed', 'currentTarget',
    'defaultPrevented', 'eventPhase', 'isTrusted', 'target',
    'timeStamp', 'type',

    // UIEvent
    'detail', 'view',

    // MouseEvent, TouchEvent, KeyboardEvent
    'altKey', 'ctrlKey', 'metaKey', 'shiftKey',

    // MouseEvent, FocusEvent
    'relatedTarget',

    // KeyboardEvent InputEvent
    'isComposing',

    // MouseEvent
    'button', 'buttons', 'clientX', 'clientY', 'movementX',
    'movementY', 'offsetX', 'offsetY', 'pageX', 'pageY',
    'screenX', 'screenY', 'webkitForce', 'x', 'y',

    // TouchEvent
    'changedTouches', 'targetTouches', 'touches',

    // KeyboardEvent
    'code', 'key', 'location', 'repeat',

    // WheelEvent
    'deltaMode', 'deltaX', 'deltaY', 'deltaZ',

    // InputEvent
    'data', 'dataTransfer', 'inputType',

    // PointerEvent
    'height', 'isPrimary', 'pointerId', 'pointerType', 'pressure',
    'tangentialPressure', 'tiltX', 'tiltY', 'twist', 'width',

    // TransitionEvent
    'elapsedTime', 'propertyName', 'pseudoElement'
];

const copyFunctionNames = [
    // Event
    'composedPath',
    'preventDefault',
    'stopImmediatePropagation',
    'stopPropagation',
    // MouseEvent, KeyboardEvent
    'getModifierState',
    // PointerEvent
    'getCoalescedEvents'
];

const createPropertyAccessor = function(propertyName) {
    return function() {
        return Object.getPrototypeOf(this)[propertyName];
    };
};

const createFunctionAccessor = function(propertyName) {
    return function() {
        return () => Object.getPrototypeOf(this)[propertyName]();
    };
};

const wrap = (event) => {
    // Locker Service returns secure object, which is in fact object with null prototype and not Event instance
    // We wrap that secure event with another object to allow redefining properties
    const wrapper = Object.create(event);

    // Accessing original event's properties or methods via the wrapper object
    // under Lightning Web Security will throw the "Illegal invocation" error,
    // so we redefine them as own properties acting as proxies to the original.
    const propertyDescriptors = {};

    copyPropertyNames.forEach((name) => {
        if (name in event) {
            propertyDescriptors[name] = {
                get          : createPropertyAccessor(name),
                configurable : true
            };
        }
    });

    copyFunctionNames.forEach((name) => {
        if (name in event) {
            propertyDescriptors[name] = {
                get          : createFunctionAccessor(name),
                configurable : true
            };
        }
    });

    Object.defineProperties(wrapper, propertyDescriptors);

    return wrapper;
};

Override.apply(EventHelperOverride);
