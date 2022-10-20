import Base from '../Base.js';
import Store from './Store.js';
import StateTrackingManager from './stm/StateTrackingManager.js';

export default class Model extends Base {
    id                  : string | number

    internalId          : string | number
    generation          : number

    static fields?      : any[]

    fields              : any[]

    stores              : Store[]

    readonly firstStore : Store

    data                : object

    parent              : this
    children            : this[]
    previousSibling     : this
    nextSibling         : this

    childLevel          : number
    parentIndex         : number

    indexPath           : number[]
    wbsCode             : string

    isLeaf              : boolean
    isPhantom           : boolean
    isRoot              : boolean

    isBatchUpdating     : boolean

    isDestroyed         : boolean
    isDestroying        : boolean

    stm                 : StateTrackingManager

    configure (config : object) : void

    constructor (...args : any[])

    construct (data? : object, store? : Store, meta? : object, skipExpose? : boolean, processingTree? : boolean) : void

    afterConstruct () : void
    afterConfigure () : void

    get (fieldName : string) : any
    set (fieldName : string | object, value? : any, silent? : boolean) : object
    setData (toSet : object |string, value? : any) : void
    getData (fieldName : string) : any

    applyValue (useProp : boolean, key : string, value : any, skipAccessors : boolean, field : any) : void
    afterChange (toSet : any, wasSet : any, silent : boolean, fromRelationUpdate : boolean, skipAccessors : boolean) : void

    joinStore (store : Store) : void
    unjoinStore (store : Store, isReplacing : boolean) : void

    appendChild<T extends Model> (child : T|T[]) : T|T[]|null
    insertChild<T extends Model> (child : T|T[], before? : T) : T|T[]|null

    remove (silent? : boolean) : void

    traverse (fn : (node : this) => void, skipSelf? : boolean, includeFilteredOutRecords? : boolean) : void

    getFieldDefinition (fieldName : string) : object
    getFieldDefinitionFromDataSource (dataSource : string) : any

    copy (newId : this[ 'id' ], deep : any) : this

    beginBatch (silentUpdates? : boolean) : void
    endBatch (silent? : boolean, skipAccessors? : boolean): void

    afterSet (field : string | object, value : any, silent : boolean, fromRelationUpdate : boolean, preResult : any[], wasSet : any) : void

    isFieldModified (field : string) : boolean
    isModified () : boolean
    get isValid () : boolean

    shouldRecordFieldChange (fieldName : string, oldValue : any, newValue : any) : boolean
}
