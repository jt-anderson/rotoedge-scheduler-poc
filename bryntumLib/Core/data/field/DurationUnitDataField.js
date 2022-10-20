import DateHelper from '../../helper/DateHelper.js';
import StringDataField from './StringDataField.js';

/**
 * @module Core/data/field/DurationUnitDataField
 */

/**
 * This field class handles field of type `durationunit` (string type). See {@link Core.data.Duration} for more information.
 *
 * ```javascript
 * class Event extends Model {
 *     static get fields() {
 *         return [
 *             { name : 'durationUnit', type : 'durationunit' }
 *         ];
 *     }
 * }
 * ```
 *
 * @extends Core/data/field/StringDataField
 * @classtype durationunit
 */
export default class DurationUnitDataField extends StringDataField {
    static get $name() {
        return 'DurationUnitDataField';
    }

    static get type() {
        return 'durationunit';
    }

    isEqual(first, second) {
        return DateHelper.compareUnits(first, second) === 0;
    }
}

DurationUnitDataField.initClass();
