import Base from '../Base.js';
import Delayable from '../mixin/Delayable.js';
import ObjectHelper from '../helper/ObjectHelper.js';
import StateStorage from './StateStorage.js';

/**
 * @module Core/state/StateProvider
 */

const
    Memory = class {
        constructor() {
            this.clear();
        }

        clear() {
            this._data = Object.create(null);
        }

        getItem(key) {
            return (key in this._data) ? this._data[key] : null;
        }

        removeItem(key) {
            delete this._data[key];
        }

        setItem(key, value) {
            this._data[key] = value;
        }
    },
    storages = {
        local  : () => localStorage,
        memory : () => new Memory()
    };

/**
 * Instances of this class are used to manage data storage for objects that use the {@link Core.mixin.State} mixin -
 * stateful components. When such component receives notification about changed state, it notifies state provider which
 * starts a short timeout before actually saving the state. Timeout is required to buffer several consequent
 * state changes into one.
 * When timeout expires provider asks stateful component to save its state immediately and eventually
 * {@link Core.state.StateStorage#function-setItem} of the underlying {@link #property-storage} gets called.
 *
 * There are two (2) implementations provided:
 *  - `local` : Stores data in the browser's `localStorage`. Because of this, all instances share data if they have
 *    the same {@link #config-prefix}.
 *  - `memory` : Stores data in the provider's memory. Each instance has its own storage.
 *
 * ## The `local` StateProvider
 *
 * This provider is typically created as a singleton for the page or application:
 *
 * ```javascript
 *  StateProvider.instance = 'local';
 * ```
 * With this provider in place, objects using the {@link Core.mixin.State} mixin will save data to this provider by
 * default.
 *
 * Because this provider uses `localStorage`, it uses a string prefix to isolate its data from other users. The default
 * prefix is `'bryntum-state:'`, but this can be configured to a different value. This could be desired, for example,
 * to isolate state data from multiple pages or for version changes.
 *
 * ```javascript
 *  StateProvider.instance = new StateProvider({
 *      storage : 'local',
 *      prefix  : 'myApp-v1:'
 *  });
 * ```
 * Alternatively, this provider can be instantiated directly, and given to stateful widgets like so:
 * ```javascript
 *  const stateProvider = new StateProvider({
 *      storage : 'local',
 *      prefix  : 'mainPage:'
 *  });
 *
 *  const panel = new Panel({
 *      stateProvider
 *  });
 * ```
 *
 * ## The `memory` StateProvider
 *
 * This provider can created as a singleton like above:
 *
 * ```javascript
 *  StateProvider.instance = 'memory';
 * ```
 * Alternatively, this provider can be instantiated directly, and given to stateful widgets like so:
 *
 * ```javascript
 *  const stateProvider = new StateProvider({ storage : 'memory' });
 *
 *  const panel = new Panel({
 *      stateProvider
 *  });
 * ```
 */
export default class StateProvider extends Base.mixin(Delayable) {
    static get $name() {
        return 'StateProvider';
    }

    static get configurable() {
        return {
            /**
             * The key prefix applied when saving data to `localStorage`.
             * @config {String}
             * @default
             */
            prefix : 'bryntum-state:',

            /**
             * Storage instance
             * @member {Core.state.StateStorage} storage
             */
            /**
             * One of the following storage types:
             *  - `local` : Stores data in the browser's `localStorage` using the {@link #config-prefix}.
             *  - `memory` : Stores data in the provider's memory.
             *
             * @config {String|Core.state.StateStorage}
             */
            storage : 'local'
        };
    }

    static get delayable() {
        return {
            writeStatefuls : 50
        };
    }

    /**
     * The default {@link Core.mixin.State#config-stateProvider} for stateful objects.
     * @property {Core.state.StateProvider}
     */
    static get instance() {
        return this._instance;
    }

    static set instance(inst) {
        if (inst == null) {
            inst = nullProvider;
        }
        else {
            if (typeof inst === 'string') {
                inst = {
                    storage : inst
                };
            }

            if (ObjectHelper.isObject(inst)) {
                inst = new StateProvider(inst);
            }
        }

        this._instance = inst;
    }

    doDestroy() {
        self.writeStatefuls.flush();

        super.doDestroy();
    }

    changeStorage(storage) {
        if (typeof storage === 'string') {
            if (!storages[storage]) {
                throw new Error(`Invalid storage type "${storage}" (expected one of: "${Object.keys(storages).join('", "')}")`);
            }

            storage = storages[storage];
            storage = storage();
        }

        return storage;
    }

    /**
     * This method is called to schedule saving the given `stateful` object.
     * @param {Core.mixin.State} stateful The stateful object to save.
     * @param {Object} [options] An object of options that affect the state saving process.
     * @param {String} [options.id] The key for the saved state.
     * @param {Boolean} [options.immediate] Pass `true` to save the data synchronously instead of on a delay.
     * @internal
     */
    saveStateful(stateful, options) {
        (this.pendingSaves || (this.pendingSaves = [])).push([stateful, options]);

        this.writeStatefuls();
    }

    /**
     * A delayable method that flushes pending stateful objects.
     * @private
     */
    writeStatefuls() {
        const { pendingSaves } = this;

        this.pendingSaves = null;

        for (let options, stateful, i = 0, n = pendingSaves?.length; i < n; ++i) {
            [stateful, options] = pendingSaves[i];

            if (!stateful.isDestroying && stateful.isSaveStatePending) {
                stateful.saveState({
                    ...options,
                    immediate : true
                });
            }
        }
    }

    // Overrideable methods:

    /**
     * Returns the stored state given its `key`.
     * @param {String} key The identifier of the state to return.
     * @returns {Object}
     * @internal
     */
    getValue(key) {
        this.writeStatefuls.flush();

        let value = this.storage.getItem(this.prefix + key);

        if (value) {
            value = JSON.parse(value);
        }

        return value;
    }

    /**
     * Saves the given state `value` under the specified `key`.
     * @param {String} key The identifier of the state.
     * @param {Object} value The state value to save.
     * @internal
     */
    setValue(key, value) {
        key = this.prefix + key;

        if (value == null) {
            this.storage.removeItem(key);
        }
        else {
            if (value || typeof value !== 'string') {
                value = JSON.stringify(value);
            }

            this.storage.setItem(key, value);
        }
    }
};

const nullProvider = StateProvider._instance = new StateProvider({
    storage : new StateStorage()
});
