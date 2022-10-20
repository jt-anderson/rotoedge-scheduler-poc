import StateBase from './StateBase.js';

/**
 * @module Core/data/stm/state/Registry
 *
 * Provides map of registered STM states.
 *
 * Needed to remove states circular dependency.
 *
 * @internal
 */
const registry = new Map();

/**
 * Registers STM state class with the given name.
 *
 * @private
 *
 * @param {String} name
 * @param {Core.data.stm.state.StateBase} state
 */
export const registerStmState = (name, state) => {


    registry.set(name, state);
};

/**
 * Resolves STM state class with the given name.
 *
 * @private
 *
 * @param {String} name
 * @returns {Core.data.stm.state.StateBase} state
 */
export const resolveStmState = (state) => {
    if (typeof state === 'string') {
        state = registry.get(state);
    }



    return state;
};

// UMD/module compatible export
// NOTE: the most compatible way of exporting is:
//       import registry from './Registry.js';
//       { registerStmState, resolveStmState } = registry;
//          or
//       registry.registerStmState(...);
export default {
    registerStmState,
    resolveStmState
};
