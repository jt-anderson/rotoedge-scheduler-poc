/**
 * @module Core/data/stm/action/RemoveChildAction
 */
import ActionBase from './ActionBase.js';

const
    PARENT_MODEL_PROP = Symbol('PARENT_MODEL_PROP'),
    CHILD_MODELS_PROP = Symbol('CHILD_MODELS_PROP'),
    CONTEXT_PROP      = Symbol('CONTEXT_PROP');

/**
 * Action to record store remove child operation.
 * @extends Core/data/stm/action/ActionBase
 */
export default class RemoveChildAction extends ActionBase {

    static get defaultConfig() {
        return {
            /**
             * Reference to a parent model a child model has been removed to.
             *
             * @config {Core.data.Model}
             * @default
             */
            parentModel : undefined,

            /**
             * Children models removed.
             *
             * @config {Core.data.Model[]}
             * @default
             */
            childModels : undefined,

            /**
             * Map having children models as keys and values containing previous parent
             * index at the parent.
             *
             * @config {Object}
             * @default
             */
            context : undefined
        };
    }

    get type() {
        return 'RemoveChildAction';
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
                lhsIndex = context.get(lhs),
                rhsIndex = context.get(rhs);

            return (lhsIndex - rhsIndex);
        });

        // Now let's re-insert records back to where they were
        childModels.forEach(m => {
            parentModel.insertChild(m, context.get(m));
        });
    }

    redo() {
        this.parentModel.removeChild(this.childModels);
    }
}
