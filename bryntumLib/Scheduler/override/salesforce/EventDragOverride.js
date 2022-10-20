import EventHelper from '../../../Core/helper/EventHelper.js';
import Override from '../../../Core/mixin/Override.js';
import EventDrag from '../../feature/EventDrag.js';

class EventDragOverride {
    static target = { class : EventDrag }

    getMouseMoveEventTarget(event) {
        return EventHelper.getComposedPathTarget(event);
    }
}

Override.apply(EventDragOverride);
