/**
 * @module Core/state/StateStorage
 */

/**
 * Empty class representing interface used by the {@link Core.state.StateProvider} to actually store the state data.
 * Implement methods of this class to take control of state persistence.
 * This class declares a subset of the [`Storage`](https://developer.mozilla.org/en-US/docs/Web/API/Storage) API which
 * allows using `window.localStorage` as storage.
 *
 * See [state](https://bryntum.com/examples/grid/state) demo for custom StateStorage implementation.
 * @abstract
 */
export default class StateStorage {
    /**
     * Clears data object
     */
    clear() {}

    /**
     * Returns key value
     * @param {String} key
     * @returns {String|null} JSON string
     */
    getItem(key) {
        return null;
    }

    /**
     * Removes key
     * @param {String} key
     */
    removeItem(key) {}

    /**
     * Sets key
     * @param {String} key
     * @param {String} value JSON string
     */
    setItem(key, value) {}
}
