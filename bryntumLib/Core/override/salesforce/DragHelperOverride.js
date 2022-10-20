import DomHelper from '../../helper/DomHelper.js';
import DragHelper from '../../helper/DragHelper.js';
import Override from '../../mixin/Override.js';

class DragHelperOverride {
    static target = { class : DragHelper }

    // Return root element for the LWC component to listen to events
    // https://github.com/bryntum/support/issues/4545
    getMouseMoveListenerTarget(element) {
        return DomHelper.getRootElement(element);
    }
}

Override.apply(DragHelperOverride);
