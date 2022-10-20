/**
 * @module Core/data/stm/action/RemoveAllAction
 */
import ActionBase from './ActionBase.js';
import Store from '../../Store.js';

const
    STORE_PROP       = Symbol('STORE_PROP'),
    ALL_RECORDS_PROP = Symbol('ALL_RECORDS_PROP');

/**
 * Action to record store remove all operation.
 * @extends Core/data/stm/action/ActionBase
 */
export default class RemoveAllAction extends ActionBase {

    static get defaultConfig() {
        return {
            /**
             * Reference to a store cleared.
             *
             * @config {Core.data.Store}
             * @default
             */
            store : undefined,

            /**
             * All store records removed
             *
             * @config {Core.data.Model[]}
             * @default
             */
            allRecords : undefined,

            /**
             * Flag showing if undo/redo should be done silently i.e. with events suppressed
             *
             * @config {Boolean}
             * @default
             */
            silent : false
        };
    }

    get type() {
        return 'RemoveAllAction';
    }



    get store() {
        return this[STORE_PROP];
    }

    set store(store) {


        this[STORE_PROP] = store;
    }

    get allRecords() {
        return this[ALL_RECORDS_PROP];
    }

    set allRecords(records) {


        this[ALL_RECORDS_PROP] = records.slice(0);
    }

    undo() {
        const { store, allRecords, silent } = this;
        store.add(allRecords, silent);
    }

    redo() {
        this.store.removeAll(this.silent);
    }
}
