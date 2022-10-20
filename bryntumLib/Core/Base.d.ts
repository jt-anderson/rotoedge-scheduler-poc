export default class Base {
    isDestroyed     : boolean

    constructor (props? : any)

    static new<T extends typeof Base>(this : T, ...configs) : InstanceType<T>

    construct(...args : any[])

    configure (config : object)

    destroy()

    doDestroy()
}
