import DataField from './DataField.js';

/**
 * @module Core/data/field/ObjectDataField
 */

/**
 * This field class handles fields that hold an object.
 *
 * ```javascript
 * class Person extends Model {
 *     static get fields() {
 *         return [
 *             'name',
 *             { name : 'address', type : 'object' }
 *         ];
 *     }
 * }
 * ```
 *
 * For the field to count as modified, the whole object has to be replaced:
 *
 * ```javascript
 * person.address = { ...address };
 * ```
 *
 * @extends Core/data/field/DataField
 * @classtype object
 */
export default class ObjectDataField extends DataField {
    static get $name() {
        return 'ObjectDataField';
    }

    static get type() {
        return 'object';
    }

    static get prototypeProperties() {
        return {
            complexMapping : true
        };
    }
}

ObjectDataField.initClass();
