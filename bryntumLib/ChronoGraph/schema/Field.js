import { Meta } from "../chrono/Identifier.js";
import { MinimalFieldIdentifierGen, MinimalFieldIdentifierSync, MinimalFieldVariable } from "../replica/Identifier.js";
import { isGeneratorFunction } from "../util/Helpers.js";
//---------------------------------------------------------------------------------------------------------------------
/**
 * This class describes a field of some [[EntityMeta]].
 */
export class Field extends Meta {
    constructor() {
        super(...arguments);
        /**
         * Boolean flag, indicating whether this field should be persisted
         */
        this.persistent = true;
    }
    getIdentifierClass(calculationFunction) {
        if (this.identifierCls)
            return this.identifierCls;
        if (!calculationFunction)
            return MinimalFieldVariable;
        return isGeneratorFunction(calculationFunction) ? MinimalFieldIdentifierGen : MinimalFieldIdentifierSync;
    }
}
