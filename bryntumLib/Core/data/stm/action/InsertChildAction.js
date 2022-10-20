/**
 * @module Core/data/stm/action/InsertChildAction
 */
import ActionBase from './ActionBase.js';

const
    PARENT_MODEL_PROP = Symbol('PARENT_MODEL_PROP'),
    CHILD_MODELS_PROP = Symbol('CHILD_MODELS_PROP'),
    INSERT_INDEX_PROP = Symbol('INSERT_INDEX_PROP'),
    CONTEXT_PROP      = Symbol('CONTEXT_PROP');

/**
 * Action to record the fact of adding a children models into a parent model.
 * @extends Core/data/stm/action/ActionBase
 */
export default class InsertChildAction extends ActionBase {

    static get defaultConfig() {
        return {
            /**
             * Reference to a parent model a child model has been added to.
             *
             * @config {Core.data.Model}
             * @default
             */
            parentModel : undefined,

            /**
             * Children models inserted.
             *
             * @config {Core.data.Model[]}
             * @default
             */
            childModels : undefined,

            /**
             * Index a children models are inserted at
             *
             * @config {Number}
             * @default
             */
            insertIndex : undefined,

            /**
             * Map having children models as keys and values containing previous parent
             * of each model and index at the previous parent.
             *
             * @config {Object}
             * @default
             */
            context : undefined
        };
    }

    get type() {
        return 'InsertChildAction';
    }



    get parentModel() {
        return this[PARENT_MODEL_PROP];
    }

    set parentModel(model) {


        this[PARENT_MODEL_PROP] = model;
    }

    get childModels() {
        return this[CHILD_MODELS_PROP];
    }

    set childModels(models) {


        this[CHILD_MODELS_PROP] = models.slice(0);
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

    set context(ctx) {


        this[CONTEXT_PROP] = ctx;
    }

    undo() {
        const { parentModel, context, childModels } = this;

        // Let's sort models by parent index such that models with lesser index
        // were inserted back first, thus making valid parent index of models following.
        childModels.sort((lhs, rhs) => {
            const
                { lhsParent, lhsIndex } = context.get(lhs) || {},
                { rhsParent, rhsIndex } = context.get(rhs) || {};

            return lhsParent && lhsParent === rhsParent ? (lhsIndex - rhsIndex) : 0;
        });

        // Now let's re-insert records back to where they were or remove them
        // if they weren't anywhere
        childModels.forEach(m => {
            const { parent, index } = context.get(m) || {};

            if (parent) {
                // If we move within same parent then index must be adjusted
                if (parent === parentModel) {
                    let adjustedIndex;

                    // we need to increment index if the node was moved up
                    adjustedIndex = index > m.parentIndex ? index + 1 : index;

                    // null index if we need to move to the end
                    adjustedIndex = index === parent.children.length - 1 ? null : adjustedIndex;

                    // if insertBefore is undefined the node will be appended to the end
                    const insertBefore = parent.children[adjustedIndex];

                    parent.insertChild(m, insertBefore);
                }
                else {
                    // Insert at previous index
                    parent.insertChild(m, parent.children[index]);
                }
            }
            else {
                // Just remove
                parentModel.removeChild(m);
            }
        });
    }

    redo() {
        const
            { parentModel, insertIndex, childModels } = this,
            insertBefore = parentModel.children[insertIndex];

        parentModel.insertChild(childModels, insertBefore);
    }
}
