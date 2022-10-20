import ActionBase from './ActionBase.js';
import Store from '../../Store.js';

/**
 * @module Core/data/stm/action/AddAction
 */
const
    STORE_PROP      = Symbol('STORE_PROP'),
    MODEL_LIST_PROP = Symbol('MODEL_LIST_PROP');

/**
 * Action to record the fact of models adding to a store.
 * @extends Core/data/stm/action/ActionBase
 */
export default class AddAction extends ActionBase {

    static get defaultConfig() {
        return {
            /**
             * Reference to a store models have been added into.
             *
             * @config {Core.data.Store}
             * @default
             */
            store : undefined,

            /**
             * List of models added into the store.
             *
             * @config {Core.data.Model[]}
             * @default
             */
            modelList : undefined,

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
        return 'AddAction';
    }



    get store() {
        return this[STORE_PROP];
    }

    set store(store) {


        this[STORE_PROP] = store;
    }

    get modelList() {
        return this[MODEL_LIST_PROP];
    }

    set modelList(list) {


        this[MODEL_LIST_PROP] = list.slice(0);
    }

    undo() {
        this.store.remove(this.modelList, this.silent);
    }

    redo() {
        this.store.add(this.modelList, this.silent);
    }
}
