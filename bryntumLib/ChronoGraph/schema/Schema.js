import { Base } from "../class/Base.js";
import { ensureEntityOnPrototype } from "../replica/Entity.js";
//---------------------------------------------------------------------------------------------------------------------
/**
 * This class describes a schema. Schemas are not used yet in ChronoGraph.
 *
 * Schema is just a collection of entities ([[EntityMeta]])
 */
export class Schema extends Base {
    constructor() {
        super(...arguments);
        this.entities = new Map();
    }
    /**
     * Checks whether the schema has an entity with the given name.
     *
     * @param name
     */
    hasEntity(name) {
        return this.entities.has(name);
    }
    /**
     * Returns an entity with the given name or `undefined` if there's no such in this schema
     *
     * @param name
     */
    getEntity(name) {
        return this.entities.get(name);
    }
    /**
     * Adds an entity to the schema.
     * @param entity
     */
    addEntity(entity) {
        const name = entity.name;
        if (!name)
            throw new Error(`Entity must have a name`);
        if (this.hasEntity(name))
            throw new Error(`Entity with name [${String(name)}] already exists`);
        entity.schema = this;
        this.entities.set(name, entity);
        return entity;
    }
    /**
     * Returns a class decorator which can be used to decorate classes as entities.
     */
    getEntityDecorator() {
        // @ts-ignore : https://github.com/Microsoft/TypeScript/issues/29828
        return (target) => {
            const entity = entityDecoratorBody(target);
            this.addEntity(entity);
            return target;
        };
    }
}
export const entityDecoratorBody = (target) => {
    const name = target.name;
    if (!name)
        throw new Error(`Can't add entity - the target class has no name`);
    return ensureEntityOnPrototype(target.prototype);
};
/**
 * Entity decorator. It is required to be applied only if entity declares no field.
 * If record declares any field, there no strict need to apply this decorator.
 * Its better to do this anyway, for consistency.
 *
 * ```ts
 * @entity()
 * class Author extends Entity.mix(Base) {
 * }
 *
 * @entity()
 * class SpecialAuthor extends Author {
 * }
 * ```
 */
export const entity = () => {
    // @ts-ignore : https://github.com/Microsoft/TypeScript/issues/29828
    return (target) => {
        entityDecoratorBody(target);
        return target;
    };
};
