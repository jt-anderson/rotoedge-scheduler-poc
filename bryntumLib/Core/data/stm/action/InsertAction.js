import ActionBase from './ActionBase.js';
import Store from '../../Store.js';

/**
 * @module Core/data/stm/action/InsertAction
 */

const
    STORE_PROP        = Symbol('STORE_PROP'),
    MODEL_LIST_PROP   = Symbol('MODEL_LIST_PROP'),
    INSERT_INDEX_PROP = Symbol('INSERT_INDEX_PROP'),
    CONTEXT_PROP      = Symbol('CONTEXT_PROP');

/**
 * Action to record the fact of models inserting into a store.
 * @extends Core/data/stm/action/ActionBase
 */
export default class InsertAction extends ActionBase {

    static get defaultConfig() {
        return {
            /**
             * Reference to a store models have been inserted into.
             *
             * @config {Core.data.Store}
             * @default
             */
            store : undefined,

            /**
             * List of models inserted into the store.
             *
             * @config {Core.data.Model[]}
             * @default
             */
            modelList : undefined,

            /**
             * Index the models have been inserted at.
             *
             * @config {Number}
             * @default
             */
            insertIndex : undefined,

            /**
             * Models move context (if models has been moved), if any.
             * Map this {@link Core/data/Model} instances as keys and their
             * previous index as values
             *
             * @config {Map}
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
        return 'InsertAction';
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

    get insertIndex() {
        return this[INSERT_INDEX_PROP];
    }

    set insertIndex(index) {


        this[INSERT_INDEX_PROP] = index;
    }

    get context() {
        return this[CONTEXT_PROP];
    }

    set context(context) {


        this[CONTEXT_PROP] = context;
    }

    undo() {
        const { store, modelList, context, silent } = this;

        // Let's sort models by index such that models with lesser index
        // were inserted back first, thus making valid index of models following.

        modelList.sort((lhs, rhs) => {
            const
                lhsIndex = context.get(lhs),
                rhsIndex = context.get(rhs);

            return lhsIndex !== undefined && rhsIndex !== undefined ? lhsIndex - rhsIndex : 0;
        });

        modelList.forEach(m => {
            const index = context.get(m);

            // Flag the inserted record that we undo to skip adding it to "store.removed"
            m._undoingInsertion = true;

            if (index !== undefined) {
                // Insert at previous index
                store.insert(index, m, silent);
            }
            else {
                // Just remove
                store.remove(m, silent);
            }

            m._undoingInsertion = false;
        });
    }

    redo() {
        const me = this;
        me.store.insert(me.insertIndex, me.modelList, me.silent);
    }
}
