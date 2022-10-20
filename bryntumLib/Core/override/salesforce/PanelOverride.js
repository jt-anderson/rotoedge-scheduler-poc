import Panel from '../../widget/Panel.js';
import Override from '../../mixin/Override.js';
import createTreeWalker from './TreeWalker.js';

/*
 * TreeWalker doesn't function correctly in salesforce, node cannot be changed. So we use polyfill here instead of default.
 * https://github.com/salesforce/lwc/issues/1795
 * @private
 */
class PanelOverride {
    static get target() {
        return {
            class : Panel
        };
    }

    setupTreeWalker(...args) {
        return createTreeWalker(...args);
    }
}

Override.apply(PanelOverride);
