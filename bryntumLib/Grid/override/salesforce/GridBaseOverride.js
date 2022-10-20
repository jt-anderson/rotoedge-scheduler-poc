import Override from '../../../Core/mixin/Override.js';
import GridBase from '../../view/GridBase.js';
import Rectangle from '../../../Core/helper/util/Rectangle.js';

// https://github.com/bryntum/support/issues/3422

/*
 * This override fixes refreshing scheduler on an hidden lightning tab
 * @private
 */
class GridBaseRefreshBodyContainer {
    static get target() {
        return {
            class : GridBase
        };
    }

    refreshBodyRectangle() {
        const
            { _bodyRectangle } = this,
            newRect            = Rectangle.client(this.bodyContainer);

        if (newRect.height !== 0 || !_bodyRectangle) {
            return this._bodyRectangle = newRect;
        }
        else {
            return this._bodyRectangle;
        }
    }
}

Override.apply(GridBaseRefreshBodyContainer);
