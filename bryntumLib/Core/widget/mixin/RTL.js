import Base from '../../Base.js';
import BrowserHelper from '../../helper/BrowserHelper.js';

export default Target => class RTL extends (Target || Base) {
    static $name = 'RTL';

    get widgetClass() {}

    static configurable = {
        // Force rtl
        rtl : null
    };

    updateRtl(rtl) {
        const { element } = this;

        if (element) {
            element.classList.toggle('b-rtl', rtl === true);
            element.classList.toggle('b-ltr', rtl === false);
        }
    }

    updateElement(element) {
        const
            me                = this,
            // Pull in the appendTo, insertBefore and insertFirst configs to ascertain our
            // render context which also calculates the host writing direction and sets rtl if necessary.
            [parentElement] = me.getRenderContext();

        // Acquire our rtl setting from our owner, or our parent element unless it's already been set
        if (me.rtl == null) {
            if (me.owner?.rtl || (parentElement?.nodeType === 1 && getComputedStyle(parentElement).getPropertyValue('direction') === 'rtl')) {
                me.rtl = true;
            }
        }
        
        const { rtl } = me;

        element.classList.toggle('b-rtl', rtl === true);
        element.classList.toggle('b-ltr', rtl === false);
        return element;
    }

    // Render is only called on outer widgets, children read their setting from their owner unless explicitly set
    render(...args) {
        super.render && super.render(...args);

        // TODO: Remove in 6.0
        if (
            (BrowserHelper.isChrome && BrowserHelper.chromeVersion < 87) ||
            (BrowserHelper.isFirefox && BrowserHelper.firefoxVersion < 66) ||
            (BrowserHelper.isSafari && BrowserHelper.safariVersion < 14.1)
        ) {
            this.element.classList.add('b-legacy-inset');
        }
        // Detect if rtl (catches both attribute `dir="rtl"` and CSS `direction: rtl`, as well as if owner uses rtl)
        if (getComputedStyle(this.element).direction === 'rtl' || this.owner?.rtl) {
            this.rtl = true;
        }
    }
};
