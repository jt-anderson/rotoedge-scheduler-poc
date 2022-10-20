import Base from '../Base.js';
import Events from '../mixin/Events.js';

export default class Collection extends Events(Base) {

    findItem(propertyName : string, value : any, ignoreFilters? : boolean) : Set<any> | any

    addToIndices(item : any) : void

    removeFromIndices(item : any) : void

    rebuildIndices() : void

    invalidateIndices() : void

    addIndex(indexOptions : object) : void

    removeIndex(name : string) : void

}
