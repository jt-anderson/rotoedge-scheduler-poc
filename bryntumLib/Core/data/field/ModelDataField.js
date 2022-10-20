import DataField from './DataField.js';

/**
 * @module Core/data/field/ModelDataField
 */

/**
 * This field class handles fields that hold other records.
 *
 * ```javascript
 * class Person extends Model {
 *     static get fields() {
 *         return [
 *             'name',
 *             { name : 'address', type : 'model' }
 *         ];
 *     }
 * }
 * ```
 *
 * @internal
 * @extends Core/data/field/DataField
 * @classtype model
 */
export default class ModelDataField extends DataField {
    static get $name() {
        return 'ModelDataField';
    }

    static get type() {
        return 'model';
    }

    static get prototypeProperties() {
        return {
            complexMapping : true
        };
    }

    isEqual(first, second) {
        // Check for semantic equality. An instance of the same Model class of the same ID is equal.
        return (first && second) && (second instanceof first.constructor) && second.id == first.id;
    }
}

ModelDataField.initClass();
