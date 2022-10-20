/**
 * @module Core/data/stm/action/RemoveAction
 */
import ActionBase from './ActionBase.js';
import Store from '../../Store.js';

const
    STORE_PROP      = Symbol('STORE_PROP'),
    MODEL_LIST_PROP = Symbol('MODEL_LIST_PROP'),
    CONTEXT_PROP    = Symbol('CONTEXT_PROP');

/**
 * Action to record the fact of models removed from a store.
 * @extends Core/data/stm/action/ActionBase
 */
export default class RemoveAction extends ActionBase {

    static get defaultConfig() {
        return {
            /**
             * Reference to a store models have been removed from.
             *
             * @config {Core.data.Store}
             * @default
             */
            store : undefined,

            /**
             * List of models removed from the store.
             *
             * @config {Core.data.Model[]}
             * @default
             */
            modelList : undefined,

            /**
             * Models removing context.
             *
             * @config {Object}
             * @default
             */
            context : undefined,

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
        return 'RemoveAction';
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

    get context() {
        return this[CONTEXT_PROP];
    }

    set context(context) {


        this[CONTEXT_PROP] = context;
    }

    undo() {
        const { store, context, modelList, silent } = this;

        // Let's sort models by index such that models with lesser index
        // were inserted back first, thus making valid index of models following.
        modelList.sort((lhs, rhs) => {
            const
                lhsIndex = context.get(lhs),
                rhsIndex = context.get(rhs);

            // Here, in contrast to InsertAction, index is always present
            return lhsIndex - rhsIndex;
        });

        modelList.forEach(m => {
            const index = context.get(m);

            // Insert at previous index
            store.insert(index, m, silent);
        });
    }

    redo() {
        this.store.remove(this.modelList, this.silent);
    }
}
