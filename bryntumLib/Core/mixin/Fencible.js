import ObjectHelper from '../helper/ObjectHelper.js';
import StringHelper from '../helper/StringHelper.js';
import Base from '../Base.js';

/**
 * @module Core/mixin/Fencible
 */

const
    { defineProperty } = Object,
    { hasOwn }         = ObjectHelper,
    fencibleSymbol     = Symbol('fencible'),
    NONE               = [],
    distinct           = array => Array.from(new Set(array)),
    parseNames         = names => names ? distinct(StringHelper.split(names)) : NONE,

    fenceMethod = (target, name, options) => {
        if (options === true) {
            options = name;
        }

        if (!ObjectHelper.isObject(options)) {
            options = {
                all : options
            };
        }

        let any = parseNames(options.any);

        const
            all      = parseNames(options.all),
            lock     = options.lock ? parseNames(options.lock) : distinct(all.concat(any)),
            implName = name + 'Impl',
            fence    = function(...params) {  // cannot use => since we need to receive "this" from the caller
                const
                    me = this,
                    // For static methods we have to be careful to use hasOwn to check the "point of entry" (i.e., the
                    // class reference used to call the method) since "." will climb the constructor's __proto__ chain
                    // to find properties from a super class. This does not happen to instances since we never put our
                    // fences object on the prototype chain.
                    fences = hasOwn(me, fencibleSymbol) ? me[fencibleSymbol] : (me[fencibleSymbol] = {}),
                    isFree = key => !fences[key];

                if (all.every(isFree) && (!any || any.some(isFree))) {
                    try {
                        lock.forEach(key => (fences[key] = (fences[key] || 0) + 1));

                        return me[implName](...params);
                    }
                    finally {
                        lock.forEach(key => --fences[key]);
                    }
                }
            };

        any = any.length ? any : null;  // [].some(f) is always false, but [].every(f) is always true

        !target[implName] && defineProperty(target, implName, {
            configurable : true,
            value        : target[name]
        });

        defineProperty(target, name, {
            configurable : true,
            value        : fence
        });
    };

/**
 * A description of how to protect a method from reentry.
 *
 * A value of `true` is transformed using the key as the `all` value. For example, this:
 *
 * ```javascript
 *  class Foo extends Base.mixin(Fencible) {
 *      static fenced = {
 *          foo : true
 *      };
 * ```
 *
 * Is equivalent to this:
 *
 * ```javascript
 *  class Foo extends Base.mixin(Fencible) {
 *      static fenced = {
 *          foo : {
 *              all : ['foo']
 *          }
 *      };
 * ```
 *
 * Strings are split on spaces to produce the `all` array. For example, this:
 *
 * ```javascript
 *  class Foo extends Base.mixin(Fencible) {
 *      static fenced = {
 *          foo : 'foo bar'
 *      };
 * ```
 *
 * Is equivalent to this:
 *
 * ```javascript
 *  class Foo extends Base.mixin(Fencible) {
 *      static fenced = {
 *          foo : {
 *              all : ['foo', 'bar']
 *          }
 *      };
 * ```
 * This indicates that `foo()` cannot be reentered if `foo()` or `bar()` are already executing. On entry to `foo()`,
 * both `foo()` and `bar()` will be fenced (prevented from entering).
 *
 * @typedef {Object} MethodFence
 * @property {String|String[]} [all] One or more keys that must all be currently unlocked to allow entry to the fenced
 * method. String values are converted to an array by splitting on spaces.
 * @property {String|String[]} [any] One or more keys of which at least one must be currently unlocked to allow entry
 * to the fenced method. String values are converted to an array by splitting on spaces.
 * @property {String|String[]} [lock] One or more keys that will be locked on entry to the fenced method and released
 * on exit. String values are converted to an array by splitting on spaces. By default, this array includes all keys
 * in `all` and `any`.
 */

/**
 * This mixin is used to apply reentrancy barriers to methods. For details, see
 * {@link Core.mixin.Fencible#property-fenced-static}.
 * @mixin
 * @internal
 */
export default Target => class Fencible extends (Target || Base) {
    static $name = 'Fencible';

    static declarable = [
        /**
         * This class property returns an object that specifies methods to be wrapped to prevent reentrancy.
         *
         * It is used like so:
         * ```javascript
         *  class Foo extends Base.mixin(Fencible) {
         *      static fenced = {
         *          reentrantMethod : true
         *      };
         *
         *      reentrantMethod() {
         *          // things() may cause reentrantMethod() to be called...
         *          // but we won't be allowed to reenter this method since we are already inside it
         *          this.things();
         *      }
         *  }
         * ```
         *
         * This can also be used to protect mutually reentrant method groups:
         *
         * ```javascript
         *  class Foo extends Base.mixin(Fencible) {
         *      static fenced = {
         *          foo : 'foobar'
         *          bar : 'foobar'
         *      };
         *
         *      foo() {
         *          console.log('foo');
         *          this.bar();
         *      }
         *
         *      bar() {
         *          console.log('bar');
         *          this.foo();
         *      }
         *  }
         *
         *  instance = new Foo();
         *  instance.foo();
         *  >> foo
         *  instance.bar();
         *  >> bar
         * ```
         *
         * The value for a fenced method value can be `true`, a string, an array of strings, or a
         * {@link #typedef-MethodFence} options object.
         *
         * Internally these methods are protected by assigning a wrapper function in their place. The original function
         * is moved to a new named property by appending 'Impl' to the original name. For example, in the above code,
         * `foo` and `bar` are wrapper functions that apply reentrancy protection and call `fooImpl` and `barImpl`,
         * respectively. This is important for inheritance and `super` calling because the new name must be used in
         * order to retain the guard function implementations.
         *
         * @static
         * @member {Object} fenced
         * @internal
         */
        'fenced'
    ];

    static setupFenced(cls) {
        let { fenced } = cls,
            statics = fenced.static,
            pairs = [];

        if (statics) {
            fenced = { ...fenced };
            delete fenced.static;

            pairs.push([statics, cls]);
        }

        pairs.push([fenced, cls.prototype]);

        for (const [methods, target] of pairs) {
            for (const methodName in methods) {
                fenceMethod(target, methodName, methods[methodName]);
            }
        }
    }

    // This does not need a className on Widgets.
    // Each *Class* which doesn't need 'b-' + constructor.name.toLowerCase() automatically adding
    // to the Widget it's mixed in to should implement thus.
    get widgetClass() {}
};
