import BrowserHelper from '../../helper/BrowserHelper.js';
import Button from '../../widget/Button.js';
import TrialPanel from './TrialPanel.js';

/**
 * @module Core/widget/trial/TrialButton
 */

/**
 * Download trial button.
 *
 * @classType trialbutton
 * @extends Core/widget/Button
 * @internal
 */
export default class TrialButton extends Button {

    static $name = 'TrialButton';

    static type = 'trialbutton';

    static get configurable() {
        return {
            /**
             * Product identifier.
             * @config {String}
             */
            productId : null,

            /**
             * Store emails using aweber mail list posting.
             * @config {Boolean}
             */
            storeEmail : false,

            hidden   : !BrowserHelper.isBryntumOnline(['online', 'test']),
            cls      : 'b-raised b-green',
            ref      : 'downloadTrial',
            icon     : 'b-fa-download',
            text     : 'L{downloadTrial}',
            menuIcon : null
        };
    }

    construct(...args) {
        super.construct(...args);
        this.menu = new TrialPanel({
            autoShow   : false,
            productId  : this.productId,
            storeEmail : this.storeEmail
        });
    }

}

TrialButton.initClass();
