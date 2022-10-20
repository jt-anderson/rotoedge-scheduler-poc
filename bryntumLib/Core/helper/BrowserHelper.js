/**
 * @module Core/helper/BrowserHelper
 */

/**
 * Static helper class that does browser or platform detection and provides other helper functions.
 */
export default class BrowserHelper {

    //region Init

    static cacheFlags(platform = navigator.platform, userAgent = navigator.userAgent) {
        const me = this;

        // os
        me._isLinux = Boolean(platform.match(/Linux/));
        me._isMac = Boolean(platform.match(/Mac/));
        me._isWindows = Boolean(platform.match(/Win32/));

        // Edge user agent contains webkit too.
        // This is not a typo. Edge has "Safari/537.36 Edg/96.0.1054.34"
        me._isWebkit = Boolean(userAgent.match(/WebKit/) && !userAgent.match(/Edg/));

        me._firefoxVersion = me.getVersion(userAgent, /Firefox\/(\d+)\./);
        me._isFirefox = me._firefoxVersion > 0;

        me._chromeVersion = me.getVersion(userAgent, /Chrom(?:e|ium)\/(\d+)\./);
        me._isChrome = me._chromeVersion > 0;

        me._isSafari = Boolean(userAgent.match(/Safari/)) && !me._isChrome;
        me._isMobileSafari = Boolean(userAgent.match(/Mobile.*Safari/));

        me._safariVersion = me.getVersion(userAgent, /Version\/(.*).Safari/);

        me._isAndroid = Boolean(userAgent.match(/Android/g));
    }

    //endregion

    //region Device

    /**
     * Yields `true` if the current browser supports CSS style `overflow:clip`.
     * @property {Boolean}
     * @readonly
     * @internal
     */
    static get supportsOverflowClip() {
        if (this._supportsOverflowClip == null) {
            const div = document.createElement('div');

            div.style.overflow = 'clip';
            div.style.display = 'none';
            // If we're called before DOMContentLoaded, body won't be available.
            // HTML element works for style calcs.
            document.documentElement.appendChild(div);
            this._supportsOverflowClip = div.ownerDocument.defaultView.getComputedStyle(div).getPropertyValue('overflow') === 'clip';
            div.remove();
        }
        return this._supportsOverflowClip;
    }

    /**
     * Yields `true` if the current browser supports CSS style `position:sticky`.
     * @property {Boolean}
     * @readonly
     * @internal
     */
    static get supportsSticky() {
        return true;
    }

    /**
     * Returns matched version for userAgent.
     * @param {String} versionRe version match regular expression
     * @returns {Number} matched version
     * @readonly
     * @internal
     */
    static getVersion(userAgent, versionRe) {
        const match = userAgent.match(versionRe);
        return match ? parseFloat(match[1]) : 0;
    }

    /**
     * Determines if the user is using a touch device.
     * @property {Boolean}
     * @readonly
     * @internal
     */
    static get isTouchDevice() {
        // Allow tests or client code to set
        if ('_isTouchDevice' in this) {
            return this._isTouchDevice;
        }
        return globalThis.matchMedia('(pointer:coarse)').matches;
    }

    static get supportsPointerEvents() {
        return Boolean(globalThis.PointerEvent || globalThis.MSPointerEvent);
    }

    // Reports true by default for our tests
    static get isHoverableDevice() {
        if (this._isHoverableDevice === undefined) {
            this._isHoverableDevice = globalThis.matchMedia('(any-hover: hover)').matches;
        }

        return this._isHoverableDevice;
    }

    //endregion

    //region Platform

    static get isBrowserEnv() {
        // This window reference is left on purpose, globalThis is always defined
        return typeof window !== 'undefined';
    }

    /**
     * Checks if platform is Mac.
     * @property {Boolean}
     * @readonly
     * @category Platform
     */
    static get isMac() {
        return this._isMac;
    }

    /**
     * Checks if platform is Windows.
     * @property {Boolean}
     * @readonly
     * @category Platform
     */
    static get isWindows() {
        return this._isWindows;
    }

    /**
     * Checks if platform is Linux.
     * @property {Boolean}
     * @readonly
     * @category Platform
     */
    static get isLinux() {
        return this._isLinux;
    }

    /**
     * Checks if platform is Android.
     * @property {Boolean}
     * @readonly
     * @category Platform
     */
    static get isAndroid() {
        return this._isAndroid;
    }

    //endregion

    //region Browser

    /**
     * Checks if browser is Webkit.
     * @property {Boolean}
     * @readonly
     * @category Browser
     */
    static get isWebkit() {
        return this._isWebkit;
    }

    /**
     * Checks if browser is Chrome or Chromium based browser.
     * Returns truthy value for Edge Chromium.
     * @property {Boolean}
     * @readonly
     * @category Browser
     */
    static get isChrome() {
        return this._isChrome;
    }

    /**
     * Returns the major Chrome version or 0 for other browsers.
     * @property {Number}
     * @readonly
     * @category Browser
     */
    static get chromeVersion() {
        return this._chromeVersion;
    }

    /**
     * Checks if browser is Firefox.
     * @property {Boolean}
     * @readonly
     * @category Browser
     */
    static get isFirefox() {
        return this._isFirefox;
    }

    /**
     * Returns the major Firefox version or 0 for other browsers.
     * @property {Number}
     * @readonly
     * @category Browser
     */
    static get firefoxVersion() {
        return this._firefoxVersion;
    }

    /**
     * Checks if browser is Safari.
     * @property {Boolean}
     * @readonly
     * @category Browser
     */
    static get isSafari() {
        return this._isSafari;
    }

    static get safariVersion() {
        return this._safariVersion;
    }

    /**
     * Checks if browser is mobile Safari
     * @property {Boolean}
     * @readonly
     * @category Browser
     */
    static get isMobileSafari() {
        return this._isMobileSafari;
    }

    /**
     * Returns `true` if the browser supports passive event listeners.
     * @property {Boolean}
     * @internal
     * @deprecated Since 5.0. All modern browsers now support passive event listeners.
     * @category Browser
     */
    static get supportsPassive() {
        return true;
    }

    //endregion

    //region Storage

    // https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
    static get storageAvailable() {
        let storage, x;

        try {
            storage = localStorage;
            x = '__storage_test__';

            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        }
        catch (e) {
            return e instanceof DOMException && (
            // everything except Firefox
                e.code === 22 ||
                // Firefox
                e.code === 1014 ||
                // test name field too, because code might not be present
                // everything except Firefox
                e.name === 'QuotaExceededError' ||
                // Firefox
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
                // acknowledge QuotaExceededError only if there's something already stored
                storage.length !== 0;
        }
    }

    static setLocalStorageItem(key, value) {
        this.storageAvailable && localStorage.setItem(key, value);
    }

    static getLocalStorageItem(key) {
        return this.storageAvailable && localStorage.getItem(key);
    }

    static removeLocalStorageItem(key) {
        this.storageAvailable && localStorage.removeItem(key);
    }

    //endregion

    //region Helpers

    /**
     * Returns parameter value from search string by parameter name.
     * @param {String} paramName search parameter name
     * @param {String} [defaultValue] default value if parameter not found
     * @param {String} [search] search string. Defaults to `document.location.search`
     * @returns {String} search parameter string value
     * @category Helper
     */
    static searchParam(paramName, defaultValue = null, search = document.location.search) {
        const
            re    = new RegExp(`[?&]${paramName}=?([^&]*)`),
            match = search.match(re);
        return (match && match[1]) || defaultValue;
    }

    /**
     * Returns cookie by name.
     * @param {String} name cookie name
     * @returns {String} cookie string value
     * @category Helper
     */
    static getCookie(name) {
        const
            nameEq      = encodeURIComponent(name) + '=',
            cookieItems = document.cookie.split(';');

        for (let i = 0; i < cookieItems.length; i++) {
            let c = cookieItems[i];

            while (c.charAt(0) === ' ') {
                c = c.substring(1, c.length);
            }

            if (c.indexOf(nameEq) === 0) {
                return decodeURIComponent(c.substring(nameEq.length, c.length));
            }
        }

        return '';
    }

    /**
     * Triggers a download of a file with the specified name / URL.
     * @param {String} filename The filename of the file to be downloaded
     * @param {String} [url] The URL where the file is to be downloaded from
     * @internal
     * @category Download
     */
    static download(filename, url) {
        const a = document.createElement('a');

        a.download = filename;
        a.href = url || filename;
        a.style.cssText = 'display:none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    /**
     * Triggers a download of a Blob with the specified name.
     * @param {Blob} blob The Blob to be downloaded
     * @param {String} filename The filename of the file to be downloaded
     * @internal
     * @category Download
     */
    static downloadBlob(blob, filename) {
        const url = globalThis.URL.createObjectURL(blob);

        this.download(filename, url);
        globalThis.URL.revokeObjectURL(url);
    }

    static get queryString() {
        // new URLSearchParams throws in salesforce
        // https://github.com/salesforce/lwc/issues/1812
        const params = new URL(globalThis.location.href).searchParams;

        // ?. to be nice to users with Chrome versions < 73
        return Object.fromEntries?.(params.entries());
    }

    static copyToClipboard(code) {
        let success = true;
        const textArea = document.createElement('textarea');

        textArea.value = code;
        textArea.style.height = textArea.style.width = 0;
        document.body.appendChild(textArea);

        textArea.select();
        try {
            document.execCommand('copy');
        }
        catch (e) {
            success = false;
        }
        textArea.remove();

        return success;
    }

    static isBryntumOnline(searchStrings) {
        searchStrings = Array.isArray(searchStrings) ? searchStrings : [searchStrings];
        return Boolean(/^(www\.)?bryntum\.com/.test(globalThis.location.host) || searchStrings?.some(str => this.queryString[str] != null));
    }

    /**
     * Returns truthy value if page contains Content Security Policy meta tag or globalThis.bryntum.CSP is truthy value
     * @returns {Boolean}
     * @internal
     **/
    static get isCSP() {
        const { bryntum, document } =  globalThis;
        if (bryntum.CSP == null) {
            bryntum.CSP = Boolean(document.querySelector('meta[http-equiv="Content-Security-Policy"]'));
        }
        return bryntum.CSP;
    }

    //endregion
}

if (BrowserHelper.isBrowserEnv) {
    BrowserHelper.cacheFlags();
}
