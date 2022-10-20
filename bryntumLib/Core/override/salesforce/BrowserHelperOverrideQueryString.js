import BrowserHelper from '../../helper/BrowserHelper.js';

Object.defineProperty(BrowserHelper, 'queryString', {
    get() {
        // location.href may be undefined in salesforce
        if (globalThis.location.href) {
            const params = new URL(globalThis.location.href).searchParams;

            // ?. to be nice to users with Chrome versions < 73
            return Object.fromEntries?.(params.entries());
        }
        else {
            return {};
        }
    }
});
