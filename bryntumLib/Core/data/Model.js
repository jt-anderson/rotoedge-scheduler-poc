import Base from '../Base.js';
import ArrayHelper from '../helper/ArrayHelper.js';
import ObjectHelper from '../helper/ObjectHelper.js';
import StringHelper from '../helper/StringHelper.js';
import ModelStm from './stm/mixin/ModelStm.js';
import TreeNode from './mixin/TreeNode.js';
import DataField from './field/DataField.js';

// The built-in model field types:
import './field/ArrayDataField.js';
import './field/BooleanDataField.js';
import './field/DateDataField.js';
import './field/DurationUnitDataField.js';
import './field/IntegerDataField.js';
import './field/ModelDataField.js';
import './field/NumberDataField.js';
import './field/ObjectDataField.js';
import './field/StringDataField.js';

const
    { defineProperty } = Reflect,
    { hasOwn }         = ObjectHelper,
    _undefined         = undefined,
    internalProps      = {
        children : 1,
        data     : 1,
        meta     : 1
    },
    abbreviationFields = [
        'name',
        'title',
        'text',
        'label',
        'description'
    ],
    fieldDataTypes = {
        boolean : 1,
        number  : 1,
        date    : 1,
        object  : 1
    };

/**
 * @module Core/data/Model
 */

/**
 * A Model is the definition of a record which can be added to (or loaded into) a {@link Core.data.Store}. It defines
 * which fields the data contains and exposes an interface to access and manipulate that data. The Model data is
 * populated through simple a JSON object.
 *
 * By default a Model stores a shallow copy of its raw json, but for records in stores configured with
 * `useRawData: true` it stores the supplied json object as is.
 *
 * ## Defining fields
 *
 * A Model can either define its fields explicitly (see {@link #property-fields-static}) or have them created from its
 * data (see {@link #property-autoExposeFields-static}). This snippet shows a model with 4 fields defined explicitly:
 *
 * ```javascript
 * class Person extends Model {
 *     static get fields() {
 *         return [
 *             'name',
 *             { name : 'birthday', type : 'date', format : 'YYYY-MM-DD' },
 *             { name : 'shoeSize', type : 'number', defaultValue : 11 },
 *             { name : 'age', readOnly : true }
 *         ];
 *     }
 * }
 * ```
 *
 * The first field (name) has an unspecified type, which means the field's value is held as received with no conversion
 * applied. The second field (birthday) is defined to be a date, which will make the model parse any supplied value into
 * an actual date. The parsing is handled by {@link Core/helper/DateHelper#function-parse-static DateHelper.parse()}
 * using the specified `format`, or if no format is specified using
 * {@link Core/helper/DateHelper#property-defaultFormat-static DateHelper.defaultFormat}.
 *
 * The set of standard field types is as follows:
 *
 *  - {@link Core.data.field.ArrayDataField `array`}
 *  - {@link Core.data.field.BooleanDataField `boolean`}
 *  - {@link Core.data.field.DateDataField `date`}
 *  - {@link Core.data.field.IntegerDataField `integer`}
 *  - {@link Core.data.field.ObjectDataField `object`}
 *  - {@link Core.data.field.NumberDataField `number`}
 *  - {@link Core.data.field.StringDataField `string`}
 *
 * You can also set a `defaultValue` that will be used if the data does not contain a value for the field:
 *
 * ```javascript
 * { name : 'shoeSize', type : 'number', defaultValue : 11 }
 * ```
 *
 * To create a record from a Model, supply data to its constructor:
 *
 * ```javascript
 * let guy = new Person({
 *     id       : 1,
 *     name     : 'Dude',
 *     birthday : '2014-09-01'
 * });
 * ```
 *
 * If no id is specified, a temporary id will be generated.
 *
 * Please avoid using reserved names for your fields (such as `parent`, `children` and others that are used as Model
 * properties) to avoid possible data collisions and bugs.
 *
 * ## Nested fields
 *
 * Model supports mapping fields to nested data structures using dot `.` separated paths as the `dataSource`. For
 * example given this JSON object:
 *
 * ```json
 * {
 *     name : 'Borje Salming',
 *     team : {
 *         name   : 'Toronto Maple Leafs',
 *         league : 'NHL'
 *     }
 * }
 * ```
 *
 * A field can be mapped to the nested team name by using `dataSource : 'team.name'`:
 *
 * ```javascript
 * class Player extends Model {
 *     static get fields() {
 *         return [
 *             'name',
 *             // Field mapped to a property on a nested object
 *             { name : 'teamName', dataSource : 'team.name' }
 *         ]
 *     }
 * }
 * ```
 *
 * Usage:
 *
 * ```javascript
 * const player = new Player(json);
 *
 * console.log(player.teamName); // > Toronto Maple Leafs
 * player.teamName = 'Detroit Red Wings'; // The name property of the team object is updated
 * ```
 *
 * ### Updating a nested object
 *
 * Note that directly altering a property of the nested object wont register as an update of the record, record does not
 * track changes deeply. If nested fields (as described above) is not enough for your usecase you can map a field
 * directly to the nested object and then assign a shallow copy of it to the record on changes:
 *
 * ```javascript
 * class Player extends Model {
 *     static get fields() {
 *         return [
 *             ...,
 *             // Field mapped directly to the nested object
 *             { name : 'team', type : 'object' }
 *         ]
 *     }
 * }
 *
 * // "External object" to nest
 * const team = {
 *     name   : 'Brynas',
 *     league : 'SHL'
 * }
 *
 * const player = new Player({
 *     name : 'Borje Salming',
 *     team
 * });
 *
 * // This will not flag player as dirty
 * team.league = 'CHL';
 *
 * // Instead you have to reassign the mapped field
 * player.team = { ...player.team };
 * ```
 *
 * ## Array fields
 *
 * When a field holds an array we recommend using the {@link Core/data/field/ArrayDataField `array`} type for the field:
 *
 * ```javascript
 * class GroceryList extends Model {
 *     static get fields() {
 *         return [
 *             'name',
 *             { name : 'items', type : 'array' }
 *         ];
 *     }
 * }
 * ```
 *
 * <div class="note">
 * Modifying items in the array will not flag the field as updated, since the array itself does not change. For it to
 * register a change, you must assign it a new array (could be a copy of the old one). For more info, see
 * {@link Core/data/field/ArrayDataField}
 * </div>
 *
 * ## Persisting fields
 *
 * By default all fields are persisted. If you don't want particular field to get saved to the server, configure it with
 * `persist: false`. In this case field will not be among changes which are sent by
 * {@link Core/data/AjaxStore#function-commit store.commit()}, otherwise its behavior doesn't change.
 *
 * ```javascript
 * class Person extends Model {
 *     static get fields() {
 *         return [
 *             'name',
 *             { name : 'age', persist : false }
 *         ];
 *     }
 * }
 * ```
 *
 * ## The `idField`
 * By default Model expects its id to be stored in a field named "id". The name of the field can be customized by
 * setting {@link #property-idField-static}:
 *
 * ```javascript
 * class Person extends Model {
 *     static get fields() {
 *         return [
 *             'name',
 *             { name : 'age', persist : false },
 *             { name : 'personId' },
 *             { name : 'birthday', type : 'date' }
 *         ];
 *     }
 * }
 *
 * // Id drawn from 'id' property by default; use custom field here
 * Person.idField = 'personId';
 *
 * let girl = new Person({
 *     personId : 2,
 *     name     : 'Lady',
 *     birthday : '2011-11-05'
 * });
 * ```
 *
 * ## Getting and setting values
 *
 * Fields are used to generate getters and setters on the records. Use them to access or modify values (they are
 * reactive):
 *
 * ```javascript
 * console.log(guy.name);
 * girl.birthday = new Date(2011,10,6);
 * ```
 *
 * NOTE: In an application with multiple different models you should subclass Model, since the prototype is decorated
 * with getters and setters. Otherwise you might get unforeseen collisions.
 *
 * ## Field data mapping
 *
 * By default fields are mapped to data using their name. If you for example have a "name" field it expects data to be
 * `{ name: 'Some name' }`. If you need to map it to some other property, specify `dataSource` in your field definition:
 *
 * ```javascript
 * class Person extends Model {
 *     static get fields {
 *         return [
 *             { name : 'name', dataSource : 'TheName' }
 *         ];
 *     }
 * }
 *
 * // This is now OK:
 * let dude = new Person({ TheName : 'Manfred' });
 * console.log(dude.name); // --> Manfred
 * ```
 * ## Field inheritance
 *
 * Fields declared in a derived model class are added to those from its superclass. If a field declared by a derived
 * class has also been declared by its super class, the field properties of the super class are merged with those of
 * the derived class.
 *
 * For example:
 * ```javascript
 *  class Person extends Model {
 *      static get fields() {
 *          return [
 *              'name',
 *              { name : 'birthday', type : 'date', format : 'YYYY-MM-DD' }
 *          ];
 *      }
 *  }
 *
 *  class User extends Person {
 *      static get fields() {
 *          return [
 *              { name : 'birthday', dataSource : 'dob' },
 *              { name : 'lastLogin', type : 'date' }
 *          ];
 *      }
 *  }
 * ```
 *
 * In the above, the `Person` model declares the `birthday` field as a `date` with a specified `format`. The `User`
 * model extends `Person` and also declares the `birthday` field. This redeclared field only specifies `dataSource`, so
 * all of the other fields are preserved from `Person`. The `User` model also adds a `lastLogin` field.
 *
 * The `User` from above could have been declared like so to achieve the same `fields`:
 *
 * ```javascript
 *  class User extends Model {
 *      static get fields() {
 *          return [
 *              'name',
 *              { name : 'birthday', type : 'date', format : 'YYYY-MM-DD', dataSource : 'dob' },
 *              { name : 'lastLogin', type : 'date' }
 *          ];
 *      }
 *  }
 * ```
 *
 * ## Override default values
 *
 * In case you need to define default value for a specific field, or override an existing default value, you can
 * define a new or re-define an existing field definition in {@link #property-fields-static} static getter:
 *
 * ```javascript
 * class Person extends Model {
 *     static get fields() {
 *         return [
 *             { name : 'username', defaultValue : 'New person' },
 *             { name : 'birthdate', type : 'date' }
 *         ];
 *     }
 * }
 *
 * class Bot extends Person {
 *     static get fields() {
 *         return [
 *             { name : 'username', defaultValue : 'Bot' } // default value of 'username' field is overridden
 *         ];
 *     }
 * }
 * ```
 *
 * ## Read-only records
 *
 * Model has a default field called {@link #field-readOnly}, which is used to make the record read-only in the UI while
 * still allowing programmatic changes to it. Setting it to `true` will prevent it from being edited by the built in
 * editing features (cell editing in Grid, event draging in Scheduler, task editor in Gantt etc). Please note that it is
 * not made read-only on the data level, the record can still be manipulated by application code.
 *
 * ```javascript
 * // Prevent record from being manipulated by the user
 * record.readOnly = true;
 *
 * // Programmatic manipulation is still allowed
 * record.remove();
 * ```
 *
 * ## Tree API
 *
 * This class mixes in the {@link Core/data/mixin/TreeNode TreeNode} mixin which provides an API for tree related
 * functionality (only relevant if your store is configured to be a {@link Core/data/Store#config-tree tree}).
 *
 * @mixes Core/data/mixin/TreeNode
 * @mixes Core/data/stm/mixin/ModelStm
 */
export default class Model extends Base.mixin(ModelStm, TreeNode) {
    static get $name() {
        return 'Model';
    }

    static get declarable() {
        return [
            /**
             * Array of defined fields for this model class. Subclasses add new fields by implementing this static
             * getter:
             *
             * ```javascript
             * // Model defining two fields
             * class Person extends Model {
             *     static get fields() {
             *         return [
             *             { name : 'username', defaultValue : 'New person' },
             *             { name : 'birthdate', type : 'date' }
             *         ];
             *     }
             * }
             *
             * // Subclass overriding one of the fields
             * class Bot extends Person {
             *     static get fields() {
             *         return [
             *             // Default value of 'username' field is overridden, any other setting from the parents
             *             // definition is preserved
             *             { name : 'username', defaultValue : 'Bot' }
             *         ];
             *     }
             * }
             * ```
             *
             * Fields in a subclass are merged with those from the parent class, making it easy to override mappings,
             * formats etc.
             *
             * @member {String[]|Object[]|Core.data.field.DataField[]} fields
             * @readonly
             * @static
             * @category Fields
             */
            'fields'
        ];
    }

    static get fields() {
        return [
            // The index of this item in its parent (respects filtering)
            {
                name     : 'parentIndex',
                type     : 'number',
                persist  : false,
                internal : true
            },

            /**
             * Flag the record as read-only on the UI level, preventing the end user from manipulating it using editing
             * features such as cell editing and event dragging.
             *
             * Does not prevent altering the record programmatically, it can still be manipulated by application code.
             *
             * For more info, see the "Read-only records" section above.
             *
             * @field {Boolean} readOnly
             * @category Common
             */
            {
                name : 'readOnly',
                type : 'boolean'
            }
        ];
    }

    /**
     * Template static getter which is supposed to be overridden to define default field values for the Model class.
     * Overrides `defaultValue` config specified by the {@link #property-fields-static} getter.
     * Returns a named object where key is a field name and value is a default value for the field.
     *
     * NOTE: This is a legacy way of defining default values, we recommend using {@link #property-fields-static} moving
     * forward.
     *
     * ```javascript
     * class Person extends Model {
     *     static get fields() {
     *         return [
     *             { name : 'username', defaultValue : 'New person' }
     *         ];
     *     }
     * }
     *
     * class Bot extends Person {
     *     static get defaults() {
     *         return {
     *             username : 'Bot' // default value of 'username' field is overridden
     *         };
     *     }
     * }
     * ```
     *
     * @member {Object} defaults
     * @static
     * @category Fields
     */
    // TODO: deprecate in 5.0 in favor of static fields getter
    // static get defaults() {
    //     return {};
    // }

    /**
     * The name of the data field which provides the ID of instances of this Model.
     * @property {String}
     * @category Fields
     */
    static set idField(idField) {
        this._assignedIdField = true;
        this._idField = idField;
    }

    static get idField() {
        return this._idField;
    }

    /**
     * The name of the data field which holds children of this Model when used in a tree structure
     * ```javascript
     * MyModel.childrenField = 'kids';
     * const parent = new MyModel({
     *     name : 'Dad',
     *     kids : [
     *         { name : 'Daughter' },
     *         { name : 'Son' }
     *     ]
     * });
     * ```
     * @property {String}
     * @category Fields
     */
    static set childrenField(childrenField) {
        this._childrenField = childrenField;
    }

    static get childrenField() {
        if (!this._childrenField) {
            const dataField = this.fieldMap.children;
            this._childrenField = dataField?.dataSource || 'children';
        }
        return this._childrenField;
    }

    /**
     * Returns index path to this node. This is the index of each node in the node path
     * starting from the topmost parent. (only relevant when its part of a tree store).
     * @returns {Number[]} The index of each node in the path from the topmost parent to this node.
     * @category Parent & children
     * @private
     */
    get indexPath() {
        const indices = [];

        let node = this,
            depth = node.childLevel;

        for (node = this; node && !node.isRoot; node = node.parent) {
            indices[depth--] = node.parentIndex + 1;
        }

        return indices;
    }

    /**
     * Unique identifier for the record. Might be mapped to another dataSource using idField, but always exposed as
     * record.id. Will get a generated value if none is specified in records data.
     * @field {String|Number} id
     * @category Common
     */

    //region Init

    /**
     * Constructs a new record from the supplied data.
     * @param {Object} [data] Raw data
     * @param {Core.data.Store} [store] Data store
     * @param {Object} [meta] Meta data
     * @privateparam {Boolean} [skipExpose] Skip exposing properties from data
     * @privateparam {Boolean} [forceUseRaw] Force using raw data, used by copy to not clone data twice
     * @function constructor
     * @category Lifecycle
     */
    construct(data = {}, store = null, meta = null, skipExpose = false, forceUseRaw = false) {
        const
            me     = this,
            stores = ArrayHelper.asArray(store) ?? [],
            { constructor, fieldMap } = me;

        // null passed to Base construct inhibits config processing.
        let configs = null;

        store = stores[0];

        me.meta = {
            modified : {},
            ...constructor.metaConfig,
            ...meta
        };

        // Should apply configs?
        if (constructor.applyConfigs) {
            // Extract from data and combine with defaultConfigs
            for (const key in me.getDefaultConfiguration()) {
                if (!configs) {  // if (first config)
                    configs = {};

                    if (!me.useRawData || !me.useRawData.enabled) {
                        // Shallow copy of data to not mutate incoming object
                        data = { ...data };
                    }
                }

                // Loop through configs excluding fields
                if (key in data) {
                    // Let defaults override any config supplied with an `undefined` value
                    if (data[key] !== undefined) {
                        // Use as config
                        configs[key] = data[key];
                    }

                    // Always remove config from data
                    delete data[key];
                }
            }
        }

        super.construct(configs);

        // make getters/setters for fields, needs to be done before processing data to make sure defaults are available
        if (!skipExpose) {
            constructor.exposeProperties(data, false);
        }

        // It's only valid to do this once, on construction of the first instance
        if (!hasOwn(constructor, 'idFieldProcessed')) {
            // idField can be overridden from meta, or from the store if we have not had an idField set programmatically
            // and if we have not had an id field defined above the base Model class level.

            let overriddenIdField = me.meta.idField;

            if (!overriddenIdField) {
                // Might have been set to Model after construction but before load
                if (constructor._assignedIdField) {
                    overriddenIdField = constructor.idField;
                }
                // idField on store was deprecated, but should still work to not break code
                // TODO: Remove in 3.0? Or reintroduce it...
                else if (store) {
                    overriddenIdField = store.idField;
                }
            }

            // If it's overridden to something different than we already have, replace the 'id' field in the fieldMap
            if (overriddenIdField && overriddenIdField !== fieldMap.id.dataSource) {
                constructor.addField({
                    name       : 'id',
                    dataSource : overriddenIdField,
                    internal   : true
                });
            }
            constructor.idFieldProcessed = true;
        }

        // assign internalId, unique among all records
        me._internalId = Model._internalIdCounter++;

        // relation code expects store to be available for relation lookup, but actual join done below
        me.stores = [];
        me.unjoinedStores = [];

        // Superclass constructors may set this in their own way before this is called.
        if (!me.originalData) {
            me.originalData = data;
        }

        me.data = constructor.processData(data, false, store, me, forceUseRaw);

        // Consider undefined and null as missing id and generate one
        if (me.id == null) {
            // Assign a generated id silently, record should not be considered modified
            me.setData('id', me.generateId(store));
        }
        if (me.data[constructor.childrenField]) {
            me.processChildren(stores);
        }
        me.generation = 0;
    }

    /**
     * Set this property to `true` when adding a record on a conditional basis, that is, it is yet
     * to be confirmed as an addition.
     *
     * When this is set, the {@link #property-isPersistable} value of the record is **false**, and upon being
     * added to a Store it will *not* be eligible to be synced with the server as an added record.
     *
     * Subsequently *clearing* this property means this record will become persistable and eligible
     * for syncing as an added record.
     * @property {Boolean}
     */
    set isCreating(isCreating) {
        const me = this;

        // A no-change must not have any effect.
        if (Boolean(me.meta.isCreating) !== isCreating) {
            // This flag contributes to the evaluation of isPersistable.
            // A record is not persistable if it isCreating.
            me.meta.isCreating = isCreating;

            // Owning Stores may have things to do at this lifecycle point
            me.stores.forEach(s => {
                s.onIsCreatingToggle(me, isCreating);
            });
        }
    }

    get isCreating() {
        return Boolean(this.meta.isCreating);
    }

    /**
     * Compares this Model instance to the passed instance. If they are of the same type, and all fields
     * (except, obviously, `id`) are equal, this returns `true`.
     * @param {Core.data.Model} other The record to compare this record with.
     * @returns {Boolean} `true` if the other is of the same class and has all fields equal.
     */
    equals(other) {
        if (other instanceof this.constructor) {
            for (let fields = this.$meta.fields.defs, i = 0, { length } = fields; i < length; i++) {
                const
                    field    = fields[i],
                    { name } = field;

                if (name !== 'id' && !field.isEqual(this[name], other[name])) {
                    return false;
                }
            }
            return true;
        }
        return false;
    }

    get subclass() {
        return new this.constructor(Object.setPrototypeOf({
            id : _undefined
        }, this.data), this.stores[0], null, true);
    }

    /**
     * Processes raw data, converting values and setting defaults.
     * @private
     * @param {Object} data Raw data
     * @param {Boolean} [ignoreDefaults] Ignore setting default values, used when updating
     * @returns {Object} Processed data
     * @category Fields
     */
    static processData(data, ignoreDefaults = false, store, record, forceUseRaw) {
        const
            { fieldMap, defaultValues } = this,
            { useRawData = { enabled : false } } = store || { },
            // Store configured with useRawData uses the supplied data object, polluting it. When not configured with
            // useRawData it instead makes a copy (intentionally deep, in case data has a prototype chain or contains
            // arrays or objects)
            processed = (forceUseRaw || useRawData.enabled) ? data : ObjectHelper.clone(data);

        let fieldName;

        ignoreDefaults = ignoreDefaults || useRawData.disableDefaultValue || forceUseRaw;

        if (!ignoreDefaults) {
            for (fieldName in defaultValues) {
                if (processed[fieldName] === _undefined) {
                    let defaultValue = defaultValues[fieldName];

                    // Avoid sharing arrays across instances
                    if (Array.isArray(defaultValue)) {
                        defaultValue = defaultValue.slice();
                    }
                    processed[fieldName] = defaultValue;
                }
            }
        }

        if (!useRawData.disableTypeConversion && !forceUseRaw) {
            // Convert field types which need converting
            for (fieldName in fieldMap) {
                const
                    field                = fieldMap[fieldName],
                    { name, dataSource } = field,
                    // Value might have been supplied either using mapped dataSource (when loading JSON etc. for example
                    // event.myStartDate) or as field name (from internal code, for example event.startDate). If [name]
                    // exists but not [dataSource], use it.
                    hasSource            = dataSource !== name,
                    complex              = field.complexMapping,
                    sourceExists         = hasSource && (complex
                        ? ObjectHelper.pathExists(data, dataSource)
                        : dataSource in data),
                    useNameForValue      = (name in data) && (!hasSource || !sourceExists),
                    convert              = !useRawData.disableTypeConversion && field.convert;

                // Only action field definitions which have a convert function or remap data
                if (useNameForValue || convert) {
                    // When ignoringDefaults, do not convert unspecified values
                    if (!ignoreDefaults || useNameForValue || sourceExists) {
                        const
                            value     = useNameForValue
                                ? processed[name]
                                : complex
                                    ? ObjectHelper.getPath(processed, dataSource)
                                    : processed[dataSource],
                            converted = convert ? field.convert(value, record) : value;

                        if (complex) {
                            ObjectHelper.setPath(processed, dataSource, converted);
                        }
                        else {
                            processed[dataSource] = converted;
                        }

                        // Remove [startDate] from internal data holder, only keeping [myStartDate]
                        if (hasSource) {
                            delete processed[name];
                        }
                    }
                }
            }
        }

        return processed;
    }

    static setupClass(meta) {
        super.setupClass(meta);

        if (!meta.fields) {
            // Normally setupFields will only run when a Model defines a fields getter, but we want to always run it:
            this.setupFields(this, meta);
        }
    }

    static setupFields(cls, meta) {
        const
            classFields = hasOwn(cls, 'fields') && cls.fields,
            base        = meta.super.fields,
            fieldsInfo  = meta.fields = {
                defs : base?.defs.slice() ?? [],

                // Set to true when an instance's data object is run through exposeProperties
                exposedData : false,

                // These objects are all keyed by field name:
                defaults : base ? { ...base.defaults } : {}, // value=field.defaultValue
                exposed  : Object.create(base?.exposed  ?? null),   // value=true if we've done defineProperty
                ordinals : Object.create(base?.ordinals ?? null),   // value=index in the defs array
                map      : Object.create(base?.map      ?? null),   // value=definition object
                sources  : Object.create(base?.sources  ?? null)    // value=source definition object
            };

        // We use Object.create(null) as the base for these maps because some models declare "constructor" as a field
        // NOTE: instead of chaining the defaults, we copy them so the defaults object can be used with Object.assign
        // in other contexts (since it does not copy inherited properties from the prototype chain)

        // Clone the superclass's defaults, and override that with our own defaults.
        // As we find fields with a defaultValue, more defaults may be added
        if (hasOwn(cls, 'defaults')) {
            Object.assign(fieldsInfo.defaults, cls.defaults);
        }

        // Hook up our field maps with the class hierarchy's fieldMaps.
        // We need to be able to look up field definitions by the name, or by the dataSource property name

        // If the idField is overridden at this level, create a new field
        if (hasOwn(cls, 'idField')) {
            cls.addField({
                name       : 'id',
                dataSource : cls.idField,
                internal   : true
            });
            fieldsInfo.exposed[cls.idField] = true;
        }

        // Process fields defined in the class definition
        if (classFields?.length) {
            classFields.map(cls.addField, cls);
        }

        cls.exposeRelations();
    }

    static get defaultValues() {
        return this.$meta.fields.defaults;
    }

    /**
     * An array containing all the _defined_ fields for this Model class. This will include all superclass's
     * defined fields.
     * @property {Core.data.field.DataField[]}
     * @static
     * @readonly
     * @category Fields
     */
    static get allFields() {
        return this.$meta.fields.defs;
    }

    /**
     * Same as {@link #property-allFields-static}.
     * @property {Core.data.field.DataField[]}
     * @readonly
     * @category Fields
     */
    get allFields() {
        return this.$meta.fields.defs;
    }

    /**
     * An object containing all the _defined_ fields for this Model class. This will include all superclass's
     * defined fields through its prototype chain. So be aware that `Object.keys` and `Object.entries` will only
     * access this class's defined fields.
     * @property {Object}
     * @static
     * @readonly
     * @category Fields
     */
    static get fieldMap() {
        return this.$meta.fields.map;
    }

    /**
     * Same as {@link #property-fieldMap-static}.
     * @property {Object}
     * @readonly
     * @category Fields
     */
    get fieldMap() {
        return this.$meta.fields.map;
    }

    static get fieldDataSourceMap() {
        return this.$meta.fields.sources;
    }

    /**
     * Makes getters and setters for fields (from definitions and data). Called once when class is defined and once when
     * data is loaded first time.
     * @internal
     * @param {Object} [data] Raw data
     * @param {Boolean} [raw=true] True if data is raw (contains data sources), False if data contains field names
     * @category Fields
     */
    static exposeProperties(data, raw = true) {
        const
            me               = this,
            fieldsInfo       = me.$meta.fields,
            // exposeProperties method is called from two different places: from the model constructor which receives
            // field names, and from store loadData method, which handles raw data. When loading data to store we need
            // to use names as specified in the dataSource. And when calling a model constructor we need to use field
            // names
            fieldMapProperty = raw ? 'exposed' : 'map';

        // Process the raw data properties and expose them as fields unless the property name
        // has already been used by the "dataSource" of a defined field.
        if (data && me.autoExposeFields && !fieldsInfo.exposedData) {
            let dataProperty, fieldDef, type;

            for (dataProperty in data) {
                // We need to skip children field because it can be `true` and that would create boolean field.
                // See https://github.com/bryntum/support/issues/2705
                if (!fieldsInfo[fieldMapProperty][dataProperty] && dataProperty !== me.childrenField) {
                    type = ObjectHelper.typeOf(data[dataProperty]);

                    // Create a field definition in our fieldMap with the flag that it's from data
                    fieldDef = {
                        name       : dataProperty,
                        dataSource : dataProperty,
                        fromData   : true
                    };

                    if (fieldDataTypes[type]) {
                        fieldDef.type = type;
                    }

                    me.addField(fieldDef);
                }
            }

            fieldsInfo.exposedData = true;
        }

        me.exposeRelations();
    }

    /**
     * Add a field definition in addition to those predefined in `fields`.
     * @param {String|Object} fieldDef A field name or definition
     * @category Fields
     */
    static addField(fieldDef) {
        if (fieldDef == null) {
            return;
        }

        if (typeof fieldDef === 'string') {
            fieldDef = {
                name : fieldDef
            };
        }

        const
            me                = this.initClass(),
            fieldsInfo        = me.$meta.fields,
            { ordinals }      = fieldsInfo,
            propertiesExposed = fieldsInfo.exposed,
            { name }          = fieldDef,
            existing          = fieldsInfo.map[name],
            dataSource        = fieldDef.dataSource || (fieldDef.dataSource = name);

        let field, key;

        if (!existing || (fieldDef.type && fieldDef.type !== existing.type)) {
            field = DataField.create(fieldDef);
            field.definedBy = existing ? existing.definedBy : me;
            field.ordinal = existing ? existing.ordinal : (ordinals[name] = fieldsInfo.defs.length);
        }
        else {
            field = Object.create(existing);

            for (key in fieldDef) {
                if (key !== 'type') {
                    field[key] = fieldDef[key];
                }
            }
        }

        field.owner = me;
        fieldsInfo.defs[field.ordinal] = field;
        fieldsInfo.map[name] = field;

        if (!fieldsInfo.sources[dataSource]) {
            fieldsInfo.sources[dataSource] = field;
        }

        // With complex mapping avoid exposing object as model field
        if (dataSource.includes('.')) {
            field.complexMapping = true;

        }
        if (field.complexMapping) {  // model fields have this set on their prototype...
            propertiesExposed[dataSource.split('.')[0]] = true;
        }
        else {
            // When iterating through the raw data, if autoExposeFields is set
            // We do not need to create properties for raw property names we've processed here
            propertiesExposed[dataSource] = true;
        }

        // Maintain an object of defaultValues for fields.
        if ('defaultValue' in field) {
            fieldsInfo.defaults[dataSource] = field.defaultValue;
        }

        // Create a property on this Model's prototype, named for the defined field name
        // which reads the correct property out of the raw data object.
        if (!internalProps[name]) {
            // Either creates a new accessor or redefines an existing
            field.defineAccessor(me.prototype);
        }

        me._nonPersistableFields = null;
        me._alwaysWriteFields = null;

        return field;
    }

    /**
     * Remove a field definition by name.
     * @param {String} fieldName Field name
     * @category Fields
     */
    static removeField(fieldName) {
        const
            me = this.initClass(),
            fieldsInfo = me.$meta.fields,
            definition = fieldsInfo.map[fieldName],
            { ordinals } = fieldsInfo,
            index = ordinals[fieldName];

        if (definition) {
            fieldsInfo.defs.splice(index, 1);

            delete ordinals[fieldName];
            delete fieldsInfo.defaults[fieldName];
            delete fieldsInfo.exposed[fieldName];
            delete fieldsInfo.map[fieldName];
            delete fieldsInfo.sources[definition.dataSource];

            for (const name in ordinals) {
                if (ordinals[name] > index) {
                    --ordinals[name];
                }
            }

            // Note: if field was exposed by superclass, this won't do anything...
            delete me.prototype[fieldName];
        }
    }

    /**
     * Makes getters and setters for related records. Populates a Model#relation array with the relations, to allow it
     * to be modified later when assigning stores.
     * @internal
     * @category Relations
     */
    static exposeRelations() {
        const me = this;

        if (hasOwn(me, 'relationsExposed')) {
            return;
        }

        if (me.relationConfig) {
            me.relationsExposed = true;
            me.relations = [];

            me.relationConfig.forEach(relation => {
                me.relations.push(relation);

                const name = relation.relationName;

                // getter and setter for related object
                if (!Reflect.ownKeys(me.prototype).includes(name)) {
                    defineProperty(me.prototype, name, {
                        enumerable : true,
                        get        : function() {
                            // noinspection JSPotentiallyInvalidUsageOfClassThis
                            return this.getForeign(name);
                        },
                        set : function(value) {
                            // noinspection JSPotentiallyInvalidUsageOfClassThis
                            this.setForeign(name, value, relation);
                        }
                    });
                }
            });
        }
    }

    //endregion

    //region Fields

    /**
     * Flag checked from Store when loading data that determines if fields found in first records should be exposed in
     * same way as predefined fields.
     * @property {Boolean}
     * @category Fields
     */
    static get autoExposeFields() {
        return true;
    }

    /**
     * Convenience getter to get field definitions from class.
     * @property {Core.data.field.DataField[]}
     * @readonly
     * @category Fields
     */
    get fields() {
        return this.$meta.fields.defs;
    }

    /**
     * Convenience function to get the definition for a field from class.
     * @param {String} fieldName Field name
     * @returns {Core.data.field.DataField}
     * @category Fields
     */
    getFieldDefinition(fieldName) {
        return this.$meta.fields.map[fieldName];
    }

    getFieldDefinitionFromDataSource(dataSource) {
        return this.$meta.fields.sources[dataSource];
    }

    /**
     * Get the names of all fields in data.
     * @property {String[]}
     * @readonly
     * @category Fields
     */
    get fieldNames() {
        return Object.keys(this.data);
    }

    /**
     * Get the definition for a field by name. Caches results.
     * @param {String} fieldName Field name
     * @returns {Core.data.field.DataField} Field definition or null if none found
     * @category Fields
     */
    static getFieldDefinition(fieldName) {
        return this.$meta.fields.map[fieldName];
    }

    /**
     * Returns dataSource configuration for a given field name
     * @param {String} fieldName
     * @returns {String} Field `dataSource` mapping
     * @internal
     */
    static getFieldDataSource(fieldName) {
        return this.getFieldDefinition(fieldName).dataSource;
    }

    /**
     * Get the data source used by specified field. Returns the fieldName if no data source specified.
     * @param {String} fieldName Field name
     * @returns {String}
     * @category Fields
     */
    getDataSource(fieldName) {
        const def = this.constructor.getFieldDefinition(fieldName);

        return def?.dataSource || def?.name;
    }

    /**
     * Processes input to a field, converting to expected type.
     * @param {String} fieldName Field name
     * @param {*} value Value to process
     * @returns {*} Converted value
     * @category Fields
     */
    static processField(fieldName, value, record) {
        const field = this.fieldMap[fieldName];
        return field?.convert ? field.convert(value, record) : value;
    }

    //endregion

    //region Relations

    /**
     * Initializes model relations. Called from store when adding a record.
     * @private
     * @category Relations
     */
    initRelations() {
        const me        = this,
            relations = me.constructor.relations;

        if (!relations) return;

        // TODO: feels strange to have to look at the store for relation config but didn't figure out anything better.
        // TODO: because other option would be to store it on each model instance, not better...

        me.stores.forEach(store => {
            if (!store.modelRelations) {
                store.initRelations();
            }

            // TODO: not at all tested for multiple stores, can't imagine it works as is
            const relatedRecords = [];

            store.modelRelations?.forEach(config => {
                relatedRecords.push({ related : me.initRelation(config), config });
            });
            store.updateRecordRelationCache(me, relatedRecords);
        });
    }

    /**
     * Initializes/updates a single relation.
     * @param config Relation config
     * @returns {Core.data.Model} Related record
     * @private
     * @category Relations
     */
    initRelation(config) {
        const
            me          = this,
            keyValue    = me.get(config.fieldName),
            foreign     = keyValue !== _undefined && typeof config.store !== 'string' && config.store.getById(keyValue),
            placeHolder = { id : keyValue, placeHolder : true };

        if (!me.meta.relationCache) {
            me.meta.relationCache = {};
        }

        // apparently scheduler tests expect cache to work without matched related record, thus the placeholder
        me.meta.relationCache[config.relationName] = foreign || (keyValue != null ? placeHolder : null);

        return foreign;
    }

    removeRelation(config) {
        // (have to check for existence before deleting to work in Safari)
        if (this.meta.relationCache[config.relationName]) {
            delete this.meta.relationCache[config.relationName];
            if (config.nullFieldOnRemove) {
                // Setting to null silently, to not trigger additional relation behaviour
                this.setData(config.fieldName, null);
            }
        }
    }

    getForeign(name) {
        return this.meta.relationCache?.[name];
    }

    setForeign(name, value, config) {
        const id = Model.asId(value);
        return this.set(config.fieldName, id);
    }

    //endregion

    //region Get/set values, data handling

    flatGet(fieldName, dataSource) {
        // NOTE: There is an inlined copy of this fn in DataField, when changing here make sure it is updated too

        // When changes are batched, they get stored by field name, not dataSource
        if (this.batching && fieldName in this.meta.batchChanges) {
            return this.meta.batchChanges[fieldName];
        }

        return this.data[dataSource] ?? this.data[fieldName];
    }

    complexGet(fieldName, dataSource) {
        // When changes are batched, they get stored by field name, not dataSource
        if (this.batching && fieldName in this.meta.batchChanges) {
            return this.meta.batchChanges[fieldName];
        }

        return ObjectHelper.getPath(this.data, dataSource);
    }

    /**
     * Get value for specified field name. You can also use the generated getters if loading through a Store.
     * If model is currently in batch operation this will return updated batch values which are not applied to Model
     * until endBatch() is called.
     * @param {String} fieldName Field name to get value from
     * @returns {*} Fields value
     * @category Fields
     */
    get(fieldName) {
        if (!fieldName) {
            return;
        }

        const field = this.fieldMap[fieldName];

        // Getting property of nested record?
        if (!field && fieldName.includes('.')) {
            return this.complexGet(fieldName, fieldName);
        }

        if (field?.complexMapping) {
            return this.complexGet(fieldName, field.dataSource);
        }

        return this.flatGet(fieldName, field?.dataSource || fieldName);
    }

    /**
     * Internal function used to update a records underlying data block (record.data) while still respecting field
     * mappings. Needed in cases where a field needs setting without triggering any associated behaviour and it has a
     * dataSource with a different name.
     *
     * For example:
     * ```javascript
     * // startDate mapped to data.beginDate
     * { name : 'startDate', dataSource : 'beginDate' }
     *
     * // Some parts of our code needs to update the data block without triggering any of the behaviour associated with
     * // calling set. This would then not update "beginDate":
     * record.data.startDate = xx;
     *
     * // But this would
     * record.setData('startDate', xx);
     * ```
     * @internal
     * @category Editing
     */
    setData(toSet, value) {
        const { data, fieldMap } = this;

        // Two separate paths for performance reasons

        // setData('name', 'Quicksilver');
        if (typeof toSet === 'string') {
            const
                field      = fieldMap[toSet],
                dataSource = field?.dataSource ?? toSet;

            if (field?.complexMapping) {
                ObjectHelper.setPath(data, dataSource, value);
            }
            else {
                data[dataSource] = value;
            }
        }
        // setData({ name : 'Magneto', power : 'Magnetism' });
        else {
            const keys = Object.keys(toSet);

            for (let i = 0; i < keys.length; i++) {
                const
                    fieldName  = keys[i],
                    field      = fieldMap[fieldName],
                    dataSource = field?.dataSource ?? fieldName;

                if (dataSource) {
                    if (field?.complexMapping) {
                        ObjectHelper.setPath(data, dataSource, toSet[fieldName]);
                    }
                    else {
                        data[dataSource] = toSet[fieldName];
                    }
                }
            }
        }

    }

    /**
     * Returns raw data from the encapsulated data object for the passed field name
     * @param {String} fieldName The field to get data for.
     * @returns {*} The raw data value for the field.
     */
    getData(fieldName) {
        const
            field      = this.fieldMap[fieldName],
            dataSource = field?.dataSource ?? fieldName;

        if (dataSource) {
            if (field?.complexMapping) {
                return ObjectHelper.getPath(this.data, dataSource);
            }

            return this.data[dataSource];
        }
    }

    /**
     * Silently updates record's id with no flagging the property as modified.
     * Triggers onModelChange event for changed id.
     * @param {String|Number} value id value
     * @private
     */
    syncId(value) {
        const oldValue = this.id;
        if (oldValue !== value) {
            this.setData('id', value);
            const data = { id : { value, oldValue } };
            this.afterChange(data, data);
        }
    }

    /**
     * Set value for the specified field. You can also use the generated setters if loading through a Store.
     *
     * Setting a single field, supplying name and value:
     *
     * ```javascript
     * record.set('name', 'Clark');
     * ```
     *
     * Setting multiple fields, supplying an object:
     *
     * ```javascript
     * record.set({
     *     name : 'Clark',
     *     city : 'Metropolis'
     * });
     * ```
     *
     * @param {String|Object} field The field to set value for, or an object with multiple values to set in one call
     * @param {*} [value] Value to set
     * @param {Boolean} [silent] Set to true to not trigger events. If event is recurring, occurrences won't be updated automatically.
     * @fires Store#idChange
     * @fires Store#update
     * @fires Store#change
     * @category Editing
     */
    set(field, value, silent = false, fromRelationUpdate = false, skipAccessors = false) {
        const me = this;

        // We use beforeSet/inSet/afterSet approach here because mixin interested in overriding set() method
        // like STM, for example, might be mixed before Model class or after. In general I have no control over this.
        // STM mixed before, so the only option to wrap set() method body is actually to call
        // beforeSet()/afterSet().

        if (me.isBatchUpdating) {
            me.inBatchSet(field, value, silent || me.$silenceBatch);
            return null;
        }
        else {
            const
                preResult = me.beforeSet ? me.beforeSet(field, value, silent, fromRelationUpdate) : _undefined,
                wasSet    = me.inSet(field, value, silent, fromRelationUpdate, skipAccessors);
            me.afterSet?.(field, value, silent, fromRelationUpdate, preResult, wasSet);
            return wasSet;
        }
    }

    fieldToKeys(field, value) {
        if (typeof field !== 'string') {
            // will get in trouble when setting same field on multiple models without this
            return ObjectHelper.assign({}, field);
        }

        return {
            [field] : value
        };
    }

    inBatchSet(field, value, silent) {
        const
            me     = this,
            {
                meta,
                constructor,
                fieldMap
            }      = me,
            wasSet = {};

        let cmp, changed = false;

        if (typeof field !== 'string') {
            Object.keys(me.fieldToKeys(field, value)).forEach(key => {
                cmp = fieldMap[key] || ObjectHelper;
                value = constructor.processField(key, field[key], me);

                // Store batch changes
                if (!cmp.isEqual(meta.batchChanges[key], value)) {
                    wasSet[key] = {
                        value,
                        oldValue : me.get(key)
                    };
                    meta.batchChanges[key] = value;
                    changed = true;
                }
            });
        }
        else {
            cmp = fieldMap[field] || ObjectHelper;

            // Minor optimization for engine writing back a lot of changes
            if (!cmp.isEqual(meta.batchChanges[field], value)) {
                wasSet[field] = {
                    value,
                    oldValue : me.get(field)
                };
                meta.batchChanges[field] = value;
                changed = true;
            }
        }

        // Callers need to be able to detect changes
        if (changed) {
            me.generation++;

            if (!silent) {
                // Fire batched events for UIs which need to update themselves during batched updates.
                // An example is evenResize feature which batches the changes to the endDate
                // or startDate, but the UI must update during the drag.
                const event = {
                    action  : 'update',
                    record  : me,
                    records : [me],
                    changes : wasSet
                };
                me.stores.forEach(store => {
                    store.trigger('batchedUpdate', event);
                });
            }
        }
    }

    inSet(field, value, silent, fromRelationUpdate, skipAccessors = false) {
        const
            me       = this,
            {
                data,
                meta,
                fieldMap,
                constructor
            }        = me,
            {
                prototype : myProto,
                childrenField
            }        = constructor,
            wasSet   = {},
            toSet    = me.fieldToKeys(field, value),
            keys     = Object.keys(toSet);
        let
            changed  = false;

        // Give a chance to cancel action before records updated.
        if (!silent && !me.triggerBeforeUpdate(toSet)) {
            return null;
        }

        me.inSetting = true;

        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];

            // Currently not allowed to set children in a TreeNode this way, will be ignored
            if (key === childrenField) {
                continue;
            }

            const
                field    = fieldMap[key],
                cmp      = field || ObjectHelper,
                readOnly = field?.readOnly,
                mapping  = field?.dataSource ?? key,
                useProp  = !skipAccessors && !field && (key in myProto),
                oldValue = useProp ? me[mapping] : field?.complexMapping ? ObjectHelper.getPath(data, mapping) : data[mapping],
                value    = constructor.processField(key, toSet[key], me),
                val      = toSet[key] = { value },
                relation = me.getRelationConfig(key);

            if (!readOnly && !cmp.isEqual(oldValue, value)) {
                // Indicate to observers that data has changed.
                me.generation++;
                val.oldValue = oldValue;

                changed = true;

                // Update `modified` state which is used in sync request
                if (cmp.isEqual(me.meta.modified[key], value)) {
                    // Remove changes if values are the same
                    Reflect.deleteProperty(meta.modified, key);
                }
                else if (!me.ignoreBag) { // Private flag in engine, speeds initial commit up by not recording changes
                    // Cache its original value
                    if (!(key in meta.modified)) {
                        meta.modified[key] = oldValue;
                    }

                    if (val.oldValue === _undefined) {
                        Reflect.deleteProperty(val, 'oldValue');
                    }
                }

                // The wasSet object keys must be the field *name*, not its dataSource.
                wasSet[key] = val;

                me.applyValue(useProp, mapping, value, skipAccessors, field);

                // changing foreign key
                if (relation && !fromRelationUpdate) {
                    me.initRelation(relation);
                    me.stores.forEach(store => store.cacheRelatedRecord(me, value, relation.relationName, val.oldValue));
                }
            }
        }

        if (changed) {
            me.afterChange(toSet, wasSet, silent, fromRelationUpdate, skipAccessors);
        }

        me.inSetting = false;

        return changed ? wasSet : null;
    }

    // Provided as a hook for Engine to do what needs to be done which ever way a field value is changed
    applyValue(useProp, key, value, skipAccessors, field) {
        let complexMapping = field?.complexMapping;

        // If we don't have a field, but we have a property define eg, the fullDuration property defined in TaskModel,
        // then use the property.
        // Setting parentId moves the node, always route through setter
        if (useProp || key === this.constructor.parentIdField) {
            // key is the dataSource, if we use property we need to use field name
            this[field?.name || key] = value;
            return;
        }

        // Might be setting value of nested object
        if (!field && key.includes('.')) {
            const nestedName = key.split('.')[0];

            field = this.constructor.fieldMap[nestedName];

            // We use complex mapping if the field's dataSource was defined as such,
            // OR if we are being asked to set using dot notation and field is of Object type.
            complexMapping = field?.complexMapping || field?.type === 'object';
        }

        // Use complex mapping?
        if (complexMapping) {
            ObjectHelper.setPath(this.data, key, value);
        }
        // Otherwise, push the value through into the data.
        else {
            this.data[key] = value;
        }
    }

    // skipAccessors argument is used in the engine override
    afterChange(toSet, wasSet, silent, fromRelationUpdate, skipAccessors) {
        this.stores.forEach(store => {
            store.onModelChange(this, toSet, wasSet, silent, fromRelationUpdate, skipAccessors);
        });
    }

    /**
     * This yields `true` if this record is eligible for syncing with the server.
     * It can yield `false` if the record is in the middle of a {@link #property-isBatchUpdating batched update},
     * or if it is a {@link #property-isCreating tentative record} yet to be confirmed as a new addition.
     * @property {Boolean}
     * @readonly
     */
    get isPersistable() {
        // Record is not persistable if the owning app is in the middle of a batch update
        // and the record is not flagged as being in the middle of a creation sequence.
        // This means that a "new" record can be added on a conditional basis with its
        // isCreating property set which means it is examplt from being synced until
        // the isCreating flag is cleared.
        return !this.isBatchUpdating && !this.isCreating;
    }

    /**
     * True if this model has any uncommitted changes.
     * @property {Boolean}
     * @readonly
     * @category Editing
     */
    get isModified() {
        return Boolean(this.meta.modified && Object.keys(this.meta.modified).length > 0);
    }

    // TODO: Make this the behaviour of isModified?
    get hasPersistableChanges() {
        return this.isPersistable && !ObjectHelper.isEmpty(this.rawModificationData);
    }

    /**
     * Returns true if this model has uncommitted changes for the provided field.
     * @param {String} fieldName Field name
     * @returns {Boolean} True if the field is changed
     * @category Editing
     */
    isFieldModified(fieldName) {
        return this.isModified && fieldName in this.meta.modified;
    }

    /**
     * Returns field value that should be persisted, or `undefined` if field is configured with `persist: false`.
     * @param {String|Core.data.field.DataField} nameOrField Name of the field to get value for, or its field definition
     * @private
     * @category Fields
     */
    getFieldPersistentValue(nameOrField) {
        const
            field = typeof nameOrField === 'string' ? this.getFieldDefinition(nameOrField) : nameOrField,
            name  = field?.name || nameOrField;

        let result;

        if (!field || field.persist) {
            result = this[name];
            // if serialize function is provided we use it to prepare the persistent value
            if (field?.serialize) {
                result = field.serialize(result, this);
            }
        }

        return result;
    }

    /**
     * Get a map of the modified fields in form of an object. The field *names* are used as the property names
     * in the returned object.
     * @property {Object}
     * @readonly
     * @category Editing
     */
    get modifications() {
        const data = this.rawModifications;

        if (data && Object.keys(data).length) {
            data[this.constructor.idField] = this.id;
        }

        return data;
    }

    get rawModifications() {
        const
            me = this,
            data = {};

        if (!me.isModified) {
            return null;
        }

        let keySet = false;

        Object.keys(me.meta.modified).forEach(key => {
            // TODO: isModified will report record as modified even if a modification won't be persisted here. Should it?
            const value = me.getFieldPersistentValue(key);
            if (value !== _undefined) {
                data[key] = value;
                keySet = true;
            }
        });

        return keySet ? data : null;
    }

    /**
     * Get a map of the modified fields in form of an object. The field´s {@link Core.data.field.DataField#config-dataSource}
     * is used as the property name in the returned object. The record´s id is always included.
     * @property {Object}
     * @readonly
     * @category Editing
     */
    get modificationData() {
        const data = this.rawModificationData;

        // If there are some persistable field changes, append record id
        if (data && Object.keys(data).length) {
            ObjectHelper.setPath(data, this.constructor.getFieldDefinition(this.constructor.idField).dataSource, this.id);
        }

        return data;
    }

    /**
     * Returns a map of the modified persistable fields
     * @internal
     * @property {Object}
     * @category Editing
     */
    get rawModificationData() {
        const
            me = this,
            { fieldMap } = me.constructor,
            data = {};

        if (!me.isModified) {
            return null;
        }

        let keySet = false;

        Object.keys(me.meta.modified).forEach(fieldName => {
            // TODO: isModified will report record as modified even if a modification wont be persisted here. Should it?
            const field = fieldMap[fieldName];

            // No field definition means there's no original dataSource to update
            if (field?.persist) {
                const value = me.getFieldPersistentValue(fieldName);

                if (value !== _undefined) {
                    ObjectHelper.setPath(data, field.dataSource, value);
                    keySet = true;
                }
            }
        });

        return keySet ? data : null;
    }

    /**
     * Get a map of the modified data fields along with any {@link Core/data/field/DataField#config-alwaysWrite} fields, in
     * form of an object. The field´s *dataSource* is used as the property name in the returned object.
     * Used internally by AjaxStore / CrudManager when sending updates.
     * @property {Object}
     * @readonly
     * @category Editing
     */
    get modificationDataToWrite() {
        const
            alwaysWriteFields = this.constructor.alwaysWriteFields,
            recordData        = this.modificationData;

        alwaysWriteFields.forEach(fieldName => {
            recordData[this.getFieldDefinition(fieldName).dataSource] = this.getFieldPersistentValue(fieldName);
        });

        return recordData;
    }

    /**
     * Returns data for **all** {@link Core.data.field.DataField#config-persist persistable} fields in form of an
     * object, using dataSource if present.
     * @property {Object}
     * @internal
     * @readonly
     * @category Editing
     */
    get persistableData() {
        const
            me   = this,
            data = {};

        me.fields.forEach(field => {
            const value = me.getFieldPersistentValue(field);

            if (value !== _undefined) {
                if (field?.complexMapping) {
                    ObjectHelper.setPath(data, field.dataSource, value);
                }
                else {
                    data[field.dataSource] = value;
                }
            }
        });

        return data;
    }

    /**
     * True if this models changes are currently being committed.
     * @property {Boolean}
     * @category Editing
     */
    get isCommitting() {
        return Boolean(this.meta.committing);
    }

    /**
     * Clear stored changes, used on commit. Does not revert changes.
     * @param {Boolean} [includeDescendants] Supply `false` to not clear node descendants
     * @privateparam {Boolean} [removeFromStoreChanges] Update related stores modified collection or not
     * @privateparam {Object|null} [changes] Set of changes to clear on the record
     * @category Editing
     */
    clearChanges(includeDescendants = true, removeFromStoreChanges = true, changes = null) {
        const
            me = this,
            { meta } = me;

        // If we've received an object with changes, we only need to clean that one up
        if (changes) {
            for (const key in changes) {
                delete meta.modified[key];
            }
        }
        else {
            meta.modified = {};
        }

        // We can only remove record from changes if we no modified fields in meta
        const noChanges = ObjectHelper.isEmpty(meta.modified);

        meta.committing = false;

        if (removeFromStoreChanges) {
            me.stores.forEach(store => {
                noChanges && store.modified.remove(me);
                store.added.remove(me);
                if (includeDescendants) {
                    const descendants = store.collectDescendants(me).all;
                    store.added.remove(descendants);
                    noChanges && store.modified.remove(descendants);
                }
            });
        }
    }

    /**
     * Reverts changes in this back to their original values.
     * @privateparam {Boolean} [silent] Specify `true` to not trigger events.
     * @category Editing
     */
    revertChanges(silent = false) {
        this.set(this.meta.modified, _undefined, silent);
    }

    applyChangeset(rawChanges, phantomIdField = '$PhantomId', remote = true) {
        const
            me                     = this,
            modelClass             = me.constructor,
            {
                idField,
                fieldDataSourceMap
            } = modelClass,
            rawChangesSimplePaths  = ObjectHelper.pathifyKeys(rawChanges),
            ownChangesSimplePaths  = ObjectHelper.pathifyKeys(me.modificationData),
            changes                = {},
            // Value of id field cannot be changed, it can only be set. In which case phantom id field will be in the
            // rawChanges objects
            idChanged              = phantomIdField in rawChanges;

        // Collect the changes into a change set for field names.
        for (const dataSource in rawChangesSimplePaths) {
            const
                field    = fieldDataSourceMap[dataSource],
                propName = field?.name ?? dataSource;

            // Only apply change to the model:
            // 1. if changes is remote
            // 2. or local change is not outdated
            // 3. we are setting id (in which case phantom id would be in raw changes). id value cannot be changed here,
            // only assigned if record is phantom - because we use id from the raw data to resolve this record in the
            // first place
            if (
                remote ||
                (
                    field?.name === idField
                        ? idChanged
                        : (rawChangesSimplePaths[dataSource] === ownChangesSimplePaths[dataSource])
                )
            ) {
                changes[propName] = rawChangesSimplePaths[dataSource];
            }
        }

        // Apply all changes in one go, making sure record is considered unmodified after
        const wasSet = me.set(changes);

        me.clearChanges(false, true, remote ? null : changes);

        // wasSet has format { field : { oldValue, value }}, convert to { field : value }
        return wasSet ? Object.entries(wasSet).reduce((result, [field, change]) => {
            result[field] = change.value;
            return result;
        }, {}) : {};
    }

    // TODO CrudManager tests expect all changes to be cleared, keeping this in case we reconsider that
    // Clear select changes, as opposed to clearChanges that always clears all
    // clearChangeset(changes) {
    //     const
    //         me           = this,
    //         { modified } = me.meta;
    //
    //     for (const fieldName in changes) {
    //         delete modified[fieldName];
    //     }
    //
    //     for (const store of me.stores) {
    //         ObjectHelper.isEmpty(modified) && store.modified.remove(me);
    //         store.added.remove(me);
    //     }
    // }

    //endregion

    //region Id

    /**
     * Gets the records internalId. It is assigned during creation, guaranteed to be globally unique among models.
     * @property {Number}
     * @category Identification
     */
    get internalId() {
        return this._internalId;
    }

    /**
     * Returns true if the record is new and has not been persisted (and received a proper id).
     * @property {Boolean}
     * @readonly
     * @category Identification
     */
    get isPhantom() {
        return this.id === '' || this.id == null || this.hasGeneratedId;
    }

    get isModel() {
        return true;
    }

    /**
     * Checks if record has a generated id. New records are assigned a generated id (starting with _generated), which should be
     * replaced on commit.
     * @property {Boolean}
     * @category Identification
     */
    get hasGeneratedId() {
        return typeof this.id === 'string' && this.id.startsWith('_generated');
    }

    static generateId(text = this.$$name) {
        return `_generated${text}${++Model._generatedIdIndex}`;
    }

    /**
     * Generates id for new record which starts with _generated.
     * @category Identification
     * @returns {String}
     */
    generateId() {
        return this.constructor.generateId();
    }

    /**
     * Gets the id of specified model or model data object, or the value if passed string/number.
     * @param {Core.data.Model|String|Number} model
     * @returns {String|Number} id
     * @category Identification
     */
    static asId(model) {
        return model?.isModel ? model.id : ObjectHelper.isObject(model) ? model[this.fieldMap.id.dataSource] : model;
    }

    //endregion

    //region JSON

    /**
     * Get the records data as a json string.
     *
     * ```javascript
     * const record = new Model({
     *     title    : 'Hello',
     *     children : [
     *         ...
     *     ]
     * });
     *
     * const jsonString = record.json;
     *
     * //jsonString:
     * '{"title":"Hello","children":[...]}'
     * ```
     *
     * @member {String}
     * @category JSON
     */
    get json() {
        return StringHelper.safeJsonStringify(this);  // calls our toJSON() method
    }

    /**
     * Used by `JSON.stringify()` to correctly convert this record to json.
     *
     * In most cases no point in calling it directly.
     *
     * ```
     * // This will call `toJSON()`
     * const json = JSON.stringify(record);
     * ```
     *
     * If called manually, the resulting object is a clone of `record.data` + the data of any children:
     *
     * ```
     * const record = new Model({
     *     title    : 'Hello',
     *     children : [
     *         ...
     *     ]
     * });
     *
     * const jsonObject = record.toJSON();
     *
     * // jsonObject:
     * {
     *     title : 'Hello',
     *     children : [
     *         ...
     *     ]
     * }
     * ```
     *
     * @returns {Object}
     * @category JSON
     */
    toJSON() {
        const
            { children, unfilteredChildren } = this,
            jsonData     = this.persistableData;

        if (unfilteredChildren || children) {
            jsonData[this.constructor.childrenField] = (unfilteredChildren || children).map(c => c.toJSON());
        }

        return jsonData;
    }

    /**
     * Represent the record as a string, by default as a JSON string. Tries to use an abbreviated version of the objects
     * data, using id + name/title/text/label/description. If no such field exists, the full data is used.
     *
     * ```javascript
     * const record = new Model({ id : 1, name : 'Steve Rogers', alias : 'Captain America' });
     * console.log(record.toString()); // logs { "id" : 1, "name" : "Steve Rogers" }
     * ```
     *
     * @returns {String}
     */
    toString() {
        const
            me        = this,
            nameField = abbreviationFields.find(field => field in me.constructor.fieldMap),
            data      = nameField ? { [me.constructor.idField] : me.id, [nameField] : me[nameField] } : me.data;

        return StringHelper.safeJsonStringify(data);
    }

    //endregion

    //region Batch

    /**
     * True if this Model is currently batching its changes.
     * @property {Boolean}
     * @readonly
     * @category Editing
     */
    get isBatchUpdating() {
        return Boolean(this.batching);
    }

    /**
     * Returns `true` if this Model currently has outstanding batched changes for the specified field name.
     * @param {String} fieldName The field name to check for batched updates on.
     * @returns {Boolean}
     */
    hasBatchedChange(fieldName) {
        return this.meta?.batchChanges?.[fieldName];
    }

    /**
     * Begin a batch, which stores changes and commits them when the batch ends.
     * Prevents events from being fired during batch.
     *
     * ```javascript
     * record.beginBatch();
     * record.name = 'Mr Smith';
     * record.team = 'Golden Knights';
     * record.endBatch();
     * ```
     *
     * Please note that you can also set multiple fields in a single call using {@link #function-set}, which in many
     * cases can replace using a batch:
     *
     * ```javascript
     * record.set({
     *   name : 'Mr Smith',
     *   team : 'Golden Knights'
     * });
     * ```
     * @category Editing
     * @privateparam {Boolean} silentUpdates Suppress firing the `batchUpdatedEvent`
     */
    beginBatch(silentUpdates = false) {
        const me = this;

        if (!me.batching) {
            me.batching = 0;
            me.meta.batchChanges = {};
        }

        if (silentUpdates) {
            me.$silenceBatch = (me.$silenceBatch || 0) + 1;
        }

        me.batching++;
    }

    /**
     * End a batch, triggering events if data has changed.
     * @param {Boolean} [silent] Specify `true` to not trigger events. If event is recurring, occurrences won't be updated automatically.
     * @category Editing
    */
    endBatch(silent = false, skipAccessors = false) {
        const
            me                = this,
            { parentIdField } = me.constructor;

        if (!me.batching) {
            return;
        }

        me.batching--;

        // Ideally we should track which batch was silenced, but that will complicate code more than what avoiding a few
        // triggered events is worth (this is private and we do not start batches while batches are ongoing in the
        // critical code path in engine)
        me.$silenceBatch && me.$silenceBatch--;

        if (me.batching > 0) {
            return;
        }

        // Set pending batch changes
        if (!ObjectHelper.isEmpty(me.meta.batchChanges)) {
            const batchChanges = { ...me.meta.batchChanges };
            me.meta.batchChanges = null;

            // Move to its new parent before applying the other changes.
            if (batchChanges[parentIdField]) {
                me.parentId = batchChanges[parentIdField];
                delete batchChanges[parentIdField];
            }

            me.set(batchChanges, _undefined, silent, false, skipAccessors);
        }
    }

    /**
     * Cancels current batch operation. Any changes during the batch are discarded.
     * @category Editing
     */
    cancelBatch() {
        if (this.batching) {
            const
                me               = this,
                { batchChanges } = me.meta,
                wasSet           = {};

            me.batching = null;
            me.meta.batchChanges = null;

            me.generation++;

            if (!me.$silenceBatch) {
                // Create a wasSet describing the revert back from the batched values to the real values.
                Object.entries(batchChanges).forEach(([key, oldValue]) => {
                    wasSet[key] = {
                        oldValue,
                        value : me[key]
                    };
                });

                // Fire batched events for UIs which need to update themselves during batched updates.
                // An example is evenResize feature which batches the changes to the endDate
                // or startDate, but the UI must update during the drag.
                const event = {
                    action  : 'update',
                    record  : me,
                    records : [me],
                    changes : wasSet
                };
                me.stores.forEach(store => {
                    store.trigger('batchedUpdate', event);
                });
            }

            me.$silenceBatch && me.$silenceBatch--;
        }
    }

    //endregion

    //region Events

    /**
     * Triggers beforeUpdate event for each store and checks if changes can be made from event return value.
     * @param {Object} changes Data changes
     * @returns {Boolean} returns true if data changes are accepted
     * @private
     */
    triggerBeforeUpdate(changes) {
        return !this.stores.some(s => {
            return s.trigger('beforeUpdate', { record : this, changes }) === false;
        });
    }

    //endregion

    //region Additional functionality

    /**
     * Makes a copy of this model, assigning the specified id or a generated id and also allowing you to pass field values to
     * the created copy.
     *
     * ```
     * const record = new Model({ name : 'Super model', hairColor : 'Brown' });
     * const clone = record.copy({ name : 'Super model clone' });
     * ```
     * @param {Number|String|Object} [newId] The id for the copied instance, or any field values to apply
     * (overriding the values from the source record). If no id provided, one will be auto-generated
     * @param {Boolean} [deep] True to also clone children
     * @returns {Core.data.Model} Copy of this model
     * @category Editing
     */
    copy(newId = null, deep) {
        const
            me      = this,
            data    = ObjectHelper.clone(me.data),
            idField = me.constructor.idField,
            // Chrono model is adding more logic to copy and that logic should be manageable from arguments. So there is
            // option to pass object as a last argument to switch method behavior. Used internally only, shouldn't be public.
            useDeep = ObjectHelper.isObject(deep) ?  deep.deep : deep;

        let  id;

        if (newId && typeof newId === 'object') {
            id = newId[idField];

            Object.assign(data, newId);
        }
        else {
            id = newId;
        }

        // Iterate over instance children, because data may not reflect actual children state
        if (useDeep && me.children) {
            data.children = me.children.map(child => child.copy(undefined, deep));
        }
        else {
            delete data.children;
            delete data.expanded;
        }

        if (newId !== false) {
            // We can use the value from the 'id' property, but as a fallback, generate the id.
            data[idField] = id || me.generateId(me.firstStore);
        }

        // Force using raw data when creating a copy, since data was cloned above anyway
        const copy = new me.constructor(data, null, null, false, true);

        // Store original record internal id to lookup from copy later
        copy.originalInternalId = me.internalId;

        return copy;
    }

    // Copies data using the real field names to trigger setters
    copyData(fromRecord) {
        const propertiesAndValues = {};

        fromRecord.allFields.forEach(({ name : fieldName }) => {
            if (fieldName !== fromRecord.constructor.idField) {
                propertiesAndValues[fieldName] = fromRecord[fieldName];
            }
        });

        this.set(propertiesAndValues);
    }

    /**
     * Removes this record from all stores (and in a tree structure, also from its parent if it has one).
     * @param {Boolean} [silent] Specify `true` to not trigger events. If event is recurring, occurrences won't be updated automatically.
     * @category Editing
     */
    remove(silent = false) {
        const me = this,
            { parent } = this;

        // Remove from parent if we're in a tree structure.
        // This informs the owning store(s)
        if (parent) {
            parent.removeChild(me);
        }
        // Store handles remove
        else if (me.stores.length) {
            // Not sure what should happen if you try to remove a special row (group row for example), bailing out
            if (!me.isSpecialRow) {
                me.stores.forEach(s => s.remove(me, silent, false, true));
            }
        }
    }

    /**
     * Get the first store that this model is assigned to.
     * @property {Core.data.Store}
     * @readonly
     * @category Misc
     */
    get firstStore() {
        return this.stores.length > 0 && this.stores[0];
    }

    /**
     * Get a relation config by name, from the first store.
     * @param {String} name
     * @returns {Object}
     * @private
     * @category Relations
     */
    getRelationConfig(name) {
        // using first store for relations, might have to revise later..
        return this.firstStore?.modelRelations?.find(r => r.fieldName === name);
    }

    //endregion

    //region Validation

    /**
     * Check if record has valid data. Default implementation returns true, override in your model to do actual validation.
     * @property {Boolean}
     * @category Editing
     */
    get isValid() {
        return true;
    }

    //endregion

    //region Store

    /**
     * Joins this record and any children to specified store, if not already joined.
     * @internal
     * @param {Core.data.Store} store Store to join
     * @category Misc
     */
    joinStore(store) {
        const
            me         = this,
            { stores } = me;

        if (!stores.includes(store)) {
            const { unjoinedStores } = me;

            super.joinStore(store);

            store.register(me);
            stores.push(store);
            if (unjoinedStores.includes(store)) {
                unjoinedStores.splice(unjoinedStores.indexOf(store), 1);
            }
            me.isLoaded && me.children.forEach(child => child.joinStore(store));
            me.initRelations();

            if (store.tree && !me.isRoot) {
                me.instanceMeta(store.id).collapsed = !me.expanded;
            }
        }
    }

    /**
     * Unjoins this record and any children from specified store, if already joined.
     * @internal
     * @param {Core.data.Store} store Store to join
     * @param {Boolean} [isReplacing] `true` if this record is being replaced
     * @category Misc
     */
    unjoinStore(store, isReplacing = false) {
        const me = this,
            { stores, unjoinedStores } = me;

        if (stores.includes(store)) {
            if (!store.isDestroying) {
                store.unregister(me);

                unjoinedStores.push(store);
            }

            // me.children may === true...
            // If filtered, *all* children must be unjoined when we are.
            (me.unfilteredChildren || me.children)?.forEach?.(child => child.unjoinStore(store, isReplacing));

            stores.splice(stores.indexOf(store), 1);
            // keep the cord to allow removed records to reach the store when needed

            super.unjoinStore && super.unjoinStore(store, isReplacing);

            // remove from relation cache
            store.uncacheRelatedRecord(me);
        }
    }

    /**
     * Returns true if this record is contained in the specified store, or in any store if store param is omitted.
     * @internal
     * @param {Core.data.Store} store Store to join
     * @returns {Boolean}
     * @category Misc
     */
    isPartOfStore(store) {
        if (store) {
            return store.includes(this);
        }

        return this.stores.length > 0;
    }

    /**
     * Returns true if this record is not part of any store.
     * @property {Boolean}
     * @readonly
     * @internal
     */
    get isRemoved() {
        return !this.isPartOfStore();
    }

    //endregion

    //region Per instance meta

    /**
     * Used to set per external instance meta data. For example useful when using a record in multiple grids to store some state
     * per grid.
     * @param {String|Object} instanceOrId External instance id or the instance itself, if it has id property
     * @private
     * @category Misc
     */
    instanceMeta(instanceOrId) {
        const
            { meta } = this,
            id       = instanceOrId.id || instanceOrId;

        if (!meta.map) {
            meta.map = {};
        }

        return meta.map[id] || (meta.map[id] = {});
    }

    get isGroupHeader() {
        return 'groupRowFor' in this.meta;
    }

    get isGroupFooter() {
        return 'groupFooterFor' in this.meta;
    }

    get isSpecialRow() {
        return Boolean(this.meta?.specialRow);
    }

    //endregion

    static get nonPersistableFields() {
        const me = this;

        if (!me._nonPersistableFields) {
            me._nonPersistableFields = {};

            me.allFields.forEach(field => {
                if (!field.persist || field.calculated) {
                    me._nonPersistableFields[field.name] = 1;
                }
            });
        }

        return me._nonPersistableFields;
    }

    static get alwaysWriteFields() {
        const me = this;

        if (!me._alwaysWriteFields) {
            me._alwaysWriteFields = [];

            me.allFields.forEach(field => {
                if (field.alwaysWrite) {
                    me._alwaysWriteFields.push(field.name);
                }
            });
        }

        return me._alwaysWriteFields;
    }

    // Id with spaces and dots replaced by -, for safe usage as an id in DOM
    get domId() {
        return typeof this.id === 'string' ? this.id.replace(/[ .]/g, '-') : this.id;
    }

    //region Extract config

    // These functions are not meant to be called by any code other than Base#getCurrentConfig()

    // Convert custom modelClass to string, keeping custom fields
    static toJavaScriptValue(options) {
        // Get name, skipping the automatically extended name that goes last (MyModel, not MyModelEx)
        const
            { names } = this.$meta,
            className = names[names.length - 2],
            superName =  names[names.length - 3];

        return `class ${className} extends ${superName} { static fields = ${StringHelper.toJavaScriptValue(this.fields, options)}; }`;
    }

    // Get fields current values
    getCurrentConfig(options) {
        const
            { data, children }              = this,
            { defaultValues, applyConfigs } = this.constructor,
            result                          = applyConfigs ? super.getCurrentConfig(options) : {};

        if (result) {
            for (const field of this.fields) {
                if (field.persist) {
                    const value = ObjectHelper.getPath(data, field.dataSource);
                    if (!field.isEqual(value, defaultValues[field.name])) {
                        ObjectHelper.setPath(result, field.dataSource, Base.processConfigValue(value, options));
                    }
                }
            }

            // Always include children
            if (children) {
                // Inline available children
                if (Array.isArray(children)) {
                    result.children = [];
                    for (const child of children) {
                        result.children.push(child.getCurrentConfig(options));
                    }
                }
                // Load on demand
                else {
                    result.children = children;
                }
            }

            if (this.hasGeneratedId) {
                delete result.id;
            }

            delete result.parentId;
            delete result.parentIndex;
        }

        return result;
    }

    //endregion
}

Model._idField = 'id';
Model._internalIdCounter = 1;
Model._assignedIdField = false;
Model._generatedIdIndex = 0;

Model.exposeProperties();
