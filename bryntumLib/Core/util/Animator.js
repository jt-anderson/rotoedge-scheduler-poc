import Base from '../Base.js';
import DomHelper from '../helper/DomHelper.js';
import EventHelper from '../helper/EventHelper.js';
import ObjectHelper from '../helper/ObjectHelper.js';
import Promissory from '../helper/util/Promissory.js';

/**
 * @module Core/util/Animator
 */

const
    { assign } = ObjectHelper,
    now = () => performance.now(),
    nostart = { start : false },
    unitRe = /^[.\d]+([^\d].*)?$/,
    getTransitions = element => {
        const $bryntum = element.$bryntum || (element.$bryntum = {});

        return $bryntum.transitions || ($bryntum.transitions = Object.create(null));
    },
    milliseconds = (duration, unit) => {
        if (typeof duration === 'string') {
            unit = unitRe.exec(duration)?.[1];
            duration = parseFloat(duration);
        }

        // a number could be sec or ms so guess sec if duration is small
        return duration && (duration * ((unit === 's' || !unit && duration < 10) ? 1000 : 1));
    },
    syncTransitions = element => {
        const all = ObjectHelper.values(getTransitions(element)).filter(a => a.completed == null).map(a => a.toString());

        element.style.transition = all.join(', ');
    },
    Anim = Target => class Anim extends Target {
        static get prototypeProperties() {
            return {
                _delay    : null,
                _duration : null,
                _retain   : null,
                _timing   : null,
                _unit     : null,
                owner     : null,
                reverting : null
            };
        }

        constructor(...args) {
            super(...args);

            this.id = ++idSeed;
        }

        start() {
            this.startTime = now();
        }

        get delay() {
            return milliseconds(this._delay ?? this.owner?.delay ?? 0, this.unit);
        }

        set delay(v) {
            this._delay = v;
        }

        get duration() {
            const { owner, unit } = this;

            return milliseconds(this._duration ?? (owner ? owner.duration : Animator.defaultDuration), unit);
        }

        set duration(v) {
            this._duration = v;
        }

        get elapsed() {
            return now() - this.startTime;
        }

        get remaining() {
            return this.duration - this.elapsed;
        }

        get retain() {
            return this._retain ?? this.owner?.retain;
        }

        set retain(v) {
            this._retain = v;
        }

        get timing() {
            return this._timing ?? this.owner?.timing;
        }

        set timing(v) {
            this._timing = v;
        }

        get unit() {
            return this._unit ?? this.owner?.unit;
        }

        set unit(v) {
            this._unit = v;
        }
    };

let idSeed = 0;

/**
 * These objects are passed as values in the config object of an `Animator`. The `property` name is the key in the
 * config object.
 *
 * For example:
 * ```javascript
 *  const anim = Animator.run({
 *      element,
 *      opacity : {
 *          // AnimatorTransition properties
 *      }
 *  });
 * ```
 * The {@link Core.util.Animator#config-items anim.items} array will contain a single `AnimatorTransition` instance.
 *
 * @typedef {Object} AnimatorTransition
 * @property {Number|String} property The name of the style property from the key in the `Animator` config object (in
 * the above example, this will be `'opacity'`).
 * @property {Boolean} completed This readonly property is set to `true` when the transition completes.
 * @property {Number|String} [delay=0] The delay before starting the transition. Numbers less than 10 are assumed to be
 * seconds (instead of milliseconds) unless the `unit` property is specified.
 * @property {Number|String} [duration=200] The duration of the transition. Numbers less than 10 are assumed to be
 * seconds (instead of milliseconds) unless the `unit` property is specified.
 * @property {Number|String} [from] The value from which to start the transition.
 * @property {Boolean} [retain] Set to `true` to retain the style property value after the transition. This defaults to
 * `true` if a {@link Core.util.Animator#config-finalize} function is not specified.
 * @property {String} [timing='ease-in-out'] The transition
 * [timing function](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-timing-function).
 * @property {Number|String} to The final value to which the transition will animate.
 * @property {'s'|'ms'} [unit] The duration/delay unit (either `'s'` or `'ms'`).
 * @internal
 */

class AnimatorTransition extends Base.mixin(Anim) {
    static get $name() {
        return 'AnimatorTransition';
    }

    static get prototypeProperties() {
        return {
            element  : null,
            property : null,
            from     : null,
            to       : null,

            completed  : null,
            promissory : null,
            reverting  : null
        };
    }

    afterConstruct() {
        super.afterConstruct();

        const
            me = this,
            { element, transitions } = me;

        let { property } = me;

        [property, me.to] = DomHelper.unitize(property, me.to);
        me.from = DomHelper.unitize(property, me.from)[1];
        me.promissory = new Promissory();
        me.property = property;

        const was = transitions[property];
        transitions[property] = me;

        let { from } = me;

        if (was) {
            // Remember where we come from. If there was an animation running, its "to" value is where we would have
            // been had it completed.
            me.from = was.to;
            from = null;
            was.destroy();
        }

        if (from === null) {
            from = me.getCurrentStyleValue();

            if (!was) {
                me.from = from;
            }
        }

        // Set transitioning style's initial value
        element.style[property] = from;
        // then read the style to ensure transition will animate
        me.getCurrentStyleValue();
    }

    doDestroy() {
        const me = this;

        me.finish(false);

        if (me.completed && !me.retain) {
            me.clearStyle();
        }

        super.doDestroy();
    }

    get promise() {
        return this.promissory?.promise;
    }

    get transitions() {
        return getTransitions(this.element);
    }

    clearStyle() {
        this.setStyle('');
    }

    finish(complete) {
        const
            me = this,
            { transitions, promissory, property } = me;

        if (promissory) {
            me.completed = complete;
            me.promissory = null;

            promissory.resolve(complete);

            if (transitions[property] === me) {
                delete transitions[property];

                if (!complete) {
                    // if we are the current transition, this destroy is a cancellation of the animation (not a
                    // revert), so remove our transition and clear the style to reset the element.
                    syncTransitions(me.element);
                    me.clearStyle();
                }
            }
            else {
                me.completed = false;  // this can most likely never happen, but better to be safe
            }
        }
    }

    getCurrentStyleValue() {
        return DomHelper.getStyleValue(this.element, this.property);
    }

    revert() {
        const { duration, elapsed, element, from, property, _retain : retain, _timing : timing } = this;

        return new AnimatorTransition({
            element,
            property,
            retain,
            timing,
            duration  : Math.round(Math.min(duration, elapsed)),
            reverting : this,
            to        : from,
            unit      : 'ms'
        });
    }

    setStyle(value) {
        this.element.style[this.property] = value;
    }

    start() {
        const
            me = this,
            { delay, duration, element, property } = me;

        EventHelper.onTransitionEnd({
            element,
            property,
            duration : delay + duration + 20,
            thisObj  : me.owner,
            handler  : () => me.finish?.(true)  // finish() is gone if destroyed
        });

        super.start();

        me.setStyle(me.to);
    }

    toString() {
        const { delay, duration, property, timing } = this;

        return `${property} ${duration}ms ${timing || 'ease-in-out'}${delay ? ` ${delay}ms` : ''}`;
    }
}

AnimatorTransition.initClass();

/**
 * Manages one or more {@link AnimatorTransition style transitions} or other `Animator` instances. Unlike typical
 * config objects, the config object for this class is a mixture of config properties and style names that define
 * {@link AnimatorTransition style transitions}.
 *
 * For example:
 * ```javascript
 *  const anim = Animator.run({
 *      element,
 *      duration : 500,
 *
 *      // style transitions:
 *      opacity : 0
 *  });
 *
 *  await anim.done();
 * ```
 *
 * The static {@link #function-run-static} method is typically used (as above) instead of the `new Animator()` style for
 * brevity (since a manually created `Animator` must also be manually {@link #function-start started}).
 *
 * An `Animator` can be {@link #function-done awaited} and will resolve once all of its transitions and/or child
 * animations complete or are aborted (via `destroy()`).
 *
 * ## Compound Transitions
 * The following custom transitions can present in the `Animator` config object as if they were normal style transitions:
 *
 * - {@link #function-puff-static}
 *
 * For example:
 * ```javascript
 *  const anim = Animator.run({
 *      element,
 *      marginLeft : -200,
 *      puff       : true   // true for default scale, a number, or config object
 *  });
 * ```
 * @extends Core/Base
 * @internal
 */
export default class Animator extends Base.mixin(Anim) {
    static get $name() {
        return 'Animator';
    }

    static get prototypeProperties() {
        return {
            /**
             * The optional delay before starting the animation. Numbers less than 10 are assumed to be seconds
             * (instead of milliseconds) unless the `unit` property is specified.
             * @config {Number|String} delay
             */

            /**
             * The duration of the animation. Numbers less than 10 are assumed to be seconds (instead of milliseconds)
             * unless the `unit` property is specified.
             * @config {Number|String} duration
             * @default
             */

            /**
             * The element to animate.
             * @config {HTMLElement} element
             */
            element : null,

            /**
             * A callback function called when the animation completes. This is called after restoring styles to the
             * original values (based on {@link #config-retain}). When this function is provided, `retain` defaults to
             * `false`. By implementing this function, a CSS class can be applied to the {@link #config-element} to
             * give the proper style, while the inline styles are removed (e.g., a hide animation based on opacity).
             *
             * For example:
             * ```javascript
             *  const anim = Animator.run({
             *      element,
             *      duration : 500,
             *      opacity  : 0,
             *
             *      finalize() {
             *          element.classList.add('hidden');
             *      }
             *  });
             *
             *  await anim.done();
             * ```
             * @config {Function} finalize
             */
            finalize : null,

            /**
             * A callback function called when the animation completes. This is called prior to restoring styles to the
             * original values (based on {@link #config-retain}).
             * @config {Function} prefinalize
             * @internal
             */
            prefinalize : null,

            /**
             * Set to `true` to retain the style property values after the animation. This defaults to `true` if a
             * {@link #config-finalize} function is not specified, and `false` otherwise. When a `finalize` function
             * is provided, it is typically to apply a CSS class to achieve the desired styling so that inline styles
             * can be removed.
             * @config {Boolean} retain
             */

            /**
             * The [timing function](https://developer.mozilla.org/en-US/docs/Web/CSS/transition-timing-function) for
             * the animation.
             * @config {String} timing
             * @default 'ease-in-out'
             */

            /**
             * The duration/delay unit (either `'s'` or `'ms'`).
             * @config {'s'|'ms'} unit
             */

            /**
             * This readonly property is set to `true` when the animation completes or `false` if the animation is
             * aborted (by calling the `destroy()` method).
             * @member {Boolean} completed
             * @readonly
             */
            completed : null,

            /**
             * An array containing a mixture of `Animator` and/or `AnimatorTransition` objects, depending on what was
             * specified at construction time.
             * @member {Core.util.Animator[]|AnimatorTransition[]} items
             * @readonly
             */
            /**
             * When passed at construction time, `items` can be an array of other `Animator` config objects. This can be
             * used to animate multiple elements and wait for this instance to be {@link #function-done done}.
             * @config {Core.util.Animator[]} items
             */
            items : null
        };
    }

    static register(name, fn) {
        if (ObjectHelper.isObject(name)) {
            ObjectHelper.entries(name).forEach(entry => Animator.register(...entry));
            return;
        }

        Animator.fx[name] = fn;

        Animator[name] = options => {
            if (DomHelper.isElement(options)) {
                options = {
                    element : options,
                    [name]  : {}
                };
            }
            else {
                options = {
                    element : options.element,
                    [name]  : options
                };

                delete options[name].element;
            }

            return Animator.run(options);
        };
    }

    /**
     * A short-hand way to create an `Animator` instance and call its {@link #function-start} method.
     *
     * ```javascript
     *  const anim = Animator.run({
     *      element,
     *      duration : 500,
     *
     *      // style transitions:
     *      opacity : 0
     *  });
     *
     *  await anim.done();
     * ```
     * @param {Core.util.Animator|Object} options A config object for an `Animator` instance.
     * @returns {Core.util.Animator}
     */
    static run(options) {
        return (new Animator(options)).start();
    }

    constructor(options) {
        super(null);  // our options is not like a normal config object since is has styles mixed in w/configs

        const
            me = this,
            items = [],
            properties = {};

        let anim, fx, key, t;

        if (Array.isArray(options)) {
            me.items = options;
        }
        else {
            for (key in options) {
                (Animator.specialPropsRe.test(key) ? me : properties)[key] = options[key];
            }
        }

        ObjectHelper.keys(properties).forEach(property => {
            t = properties[property];

            // ignore values of null, undefined, false and NaN (NaN !== NaN)
            if (t != null && t !== false && t === t) {  // eslint-disable-line no-self-compare
                if (!(fx = Animator.fx[property])) {
                    t = assign(me.defaults, (typeof t === 'object') ? t : { to : t });
                    t.owner = me;
                    t.property = property;

                    anim = new AnimatorTransition(t);
                }
                else {
                    t = assign(me.defaults, fx(t, me, property));
                    t.owner = me;

                    anim = new Animator(t);
                }

                items.push(anim);
            }
        });

        // me.items can be set if options was an array or if options.items was passed.
        me.items?.forEach(item => {
            if (ObjectHelper.isInstantiated(item)) {
                item.owner = me;
            }
            else {
                item = assign(me.defaults, item);
                item.owner = me;

                item = new Animator(item);
            }

            items.push(item);
        });

        me.items = items;
        me.promise = ((items.length === 1) ? items[0].promise : Promise.all(items.map(it => it.promise))).then(res => {
            me.finish?.(res);

            return me.completed || false;
        });
    }

    doDestroy() {
        this.items.forEach(a => a.destroy());

        super.doDestroy();
    }

    get defaults() {
        return {
            element : this.element
        };
    }

    get retain() {
        const { _retain, finalize, owner } = this;

        return _retain ?? (finalize ? false : (owner ? owner.retain : true));
    }

    set retain(v) {
        super.retain = v;
    }

    /**
     * Returns a `Promise` that resolves to a `Boolean` when this animation completes. The resolved value is that of
     * this instance's {@link #property-completed} property.
     * @async
     */
    done() {
        return this.promise;
    }

    finish(complete) {
        const
            me = this,
            { items } = me;

        syncTransitions(me.element);

        me.completed = (typeof complete === 'boolean') ? complete : !complete.some(a => !a);

        me.prefinalize?.(me.completed, me);

        while (items.length) {
            items.pop().destroy();
        }

        me.finalize?.(me.completed, me);
    }

    revert(options) {
        const
            me = this,
            { reverting } = me,
            start = !options || (options.start ?? true);

        let anim = me.defaults;

        if (reverting) {
            // If this anim is a revert of some previous anim and that anim had a finalizer, then reverting us should
            // (by default) carry forward the original finalizer:
            if (reverting.finalize) {
                anim.finalize = reverting.finalize;
            }

            if (reverting.prefinalize) {
                anim.prefinalize = reverting.prefinalize;
            }

            anim.retain = reverting._retain;
        }

        anim = assign(anim, options, {
            items     : me.items.map(it => it.revert(nostart)),
            reverting : me
        });

        anim = new Animator(anim);

        start && anim.start();

        return anim;
    }

    /**
     * Starts this animation and returns a reference to itself. This method is called automatically by the
     * {@link #function-run-static} method.
     * @returns {Core.util.Animator}
     */
    start() {
        const { element, items } = this;

        super.start();

        if (items.length) {
            syncTransitions(element);

            items.forEach(a => a.start());
        }

        return this;
    }
}

Animator.initClass().Transition = AnimatorTransition;

Animator.specialPropsRe = new RegExp(`^(?:${
    Object.keys(Animator.prototypeProperties).concat(
        Object.keys(Animator.superclass.prototypeProperties)
    ).map(s => (s[0] === '_') ? s.substr(1) : s).join('|')
})$`);

Animator.defaultDuration = 200;
Animator.fx = {};
Animator.register({
    /**
     * A compound animation to achieve `transform: scale()` and `opacity: 0`. The `scale` defaults to 8 but can be set
     * in the `anim` config object.
     *
     * For example
     * ```javascript
     *  const puff = Animator.puff(element);
     *
     *  const puff = Animator.puff({
     *      element,
     *      scale : 12
     *  });
     * ```
     *
     * This compound animation can also be specified in an `Animator` config object along with other style transitions:
     * ```javascript
     *  const anim = Animator.run({
     *      element,
     *      marginLeft : -200,
     *      puff       : true   // true for default scale, a number, or config object
     *  });
     * ```
     * @param {Element|Object|Core.util.Animator} anim The element to animate or the config object containing at least
     * the `element` property. This config object can contain an optional `scale` property to adjust the animation's
     * `transform: scale()` value.
     * @param {Number} [anim.scale=8] The scale value for the `transform:scale()` transition.
     * @returns {Core.util.Animator}
     * @static
     */
    puff(anim) {
        if (anim === true) {
            anim = {};
        }
        else if (typeof anim !== 'object') {  // string || number
            anim = {
                transform : `scale(${anim})`
            };
        }
        else if (anim.scale) {
            anim = ObjectHelper.clone(anim);
            anim.transform = `scale(${anim.scale})`;
            delete anim.scale;
        }

        return assign({
            opacity   : 0,
            transform : 'scale(8)'
        }, anim);
    }
});
