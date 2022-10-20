import BrowserHelper from './BrowserHelper.js';

/**
 * @module Core/helper/VersionHelper
 */

let isSiesta = false;

try {
    isSiesta = Boolean(
        globalThis.parent?.Siesta ||
        (typeof process !== 'undefined') && (globalThis.StartTest || globalThis.Siesta)
    );
}
catch (e) {}

// Set Default to hoverable device for our tests to run reliably
if (isSiesta) {
    BrowserHelper._isHoverableDevice = true;
}

/**
 * Helper for version handling
 * @private
 * @example
 *
 * VersionHelper.setVersion('grid', '1.5');
 *
 * if (VersionHelper.getVersion('grid').isNewerThan('1.0')) {
 *   ...
 * }
 */
export default class VersionHelper {
    /**
     * Set version for specified product
     * @private
     * @param {String} product
     * @param {String} version
     */
    static setVersion(product, version) {
        product = product.toLowerCase();

        VH[product] = {
            version,
            isNewerThan(otherVersion) {
                return VersionHelper.semanticCompareVersion(otherVersion, version, '<');
            },
            isOlderThan(otherVersion) {
                return VersionHelper.semanticCompareVersion(otherVersion, version, '>');
            }
        };

        let bundleFor = '';

        // Var productName is only defined in bundles, it is internal to bundle so not available on window. Used to
        // tell importing combinations of grid/scheduler/gantt bundles apart from loading same bundle twice
        // eslint-disable-next-line no-undef
        if (typeof productName !== 'undefined') {
            // eslint-disable-next-line no-undef
            bundleFor = productName;
        }

        // Set "global" flag to detect bundle being loaded twice
        const globalKey = `${bundleFor}.${product}${version.replace(/\./g, '-')}`;

        if (BrowserHelper.isBrowserEnv && !globalThis.bryntum.silenceBundleException) {
            if (globalThis.bryntum[globalKey] === true) {
                if (isSiesta) {
                    globalThis.BUNDLE_EXCEPTION = true;
                }
                else {
                    throw new Error('Bryntum bundle included twice, check cache-busters and file types (.js).\n' +
                    'Simultaneous imports from "*.module.js" and "*.umd.js" bundles are not allowed.');
                }
            }
            else {
                globalThis.bryntum[globalKey] = true;
            }
        }
    }

    /**
     * Get (previously set) version for specified product
     * @private
     * @param {String} product
     */
    static getVersion(product) {
        product = product.toLowerCase();

        if (!VH[product]) {
            throw new Error('No version specified! Please check that you import VersionHelper correctly into the class from where you call `deprecate` function.');
        }

        return VH[product].version;
    }

    /**
     * Checks the version1 against the passed version2 using the comparison operator.
     * Supports `rc`, `beta`, `alpha` release states. Eg. `1.2.3-alpha-1`.
     * State which is not listed above means some version below `alpha`.
     * @param {String} version1 The version to test against
     * @param {String} version2 The version to test against
     * @param {String} [comparison] The comparison operator, `<=`, `<`, `=`, `>` or `>=`.
     * @returns {Boolean} `true` if the test passes.
     * @internal
     */
    static semanticCompareVersion(version1, version2, comparison = '=') {
        version1 = version1 || '';
        version2 = version2 || '';
        const
            version1Arr  = version1.split(/[-.]/),
            version2Arr  = version2.split(/[-.]/),
            isLower      = comparison.includes('<'),
            normalizeArr = (arr, maxLength) => {
                const
                    states = ['rc', 'beta', 'alpha'],
                    result = arr.map(v => {
                        if (states.includes(v)) {
                            return -states.indexOf(v) - 2;
                        }
                        const res = Number.parseInt(v);
                        return Number.isNaN(res) ? -states.length : res;
                    });

                while (result.length < maxLength) {
                    result.push(-1);
                }
                return result;
            },
            compareArr   = () => {
                const
                    maxLength = Math.max(version1Arr.length, version2Arr.length),
                    arr1      = normalizeArr(version1Arr, maxLength),
                    arr2      = normalizeArr(version2Arr, maxLength);

                for (let i = 0; i < maxLength; i++) {
                    if (arr1[i] !== arr2[i]) {
                        return isLower ? arr1[i] < arr2[i] : arr1[i] > arr2[i];
                    }
                }
                return true;
            };

        switch (comparison) {
            case '=':
                return version1 === version2;
            case '<=':
            case '>=':
                return (version1 === version2) || compareArr();
            case '<':
            case '>':
                return (version1 !== version2) && compareArr();
        }

        return false;
    }

    /**
     * Checks the passed product against the passed version using the passed test.
     * @param {String} product The name of the product to test the version of
     * @param {String} version The version to test against
     * @param {String} test The test operator, `<=`, `<`, `=`, `>` or `>=`.
     * @returns {Boolean} `true` if the test passes.
     * @internal
     */
    static checkVersion(product, version, test) {
        return VersionHelper.semanticCompareVersion(VH.getVersion(product), version, test);
    }

    /**
     * Based on a comparison of current product version and the passed version this method either outputs a console.warn
     * or throws an error.
     * @param {String} product The name of the product
     * @param {String} invalidAsOfVersion The version where the offending code is invalid (when any compatibility layer
     * is actually removed).
     * @param {String} message Required! A helpful warning message to show to the developer using a deprecated API.
     * @internal
     */
    static deprecate(product, invalidAsOfVersion, message) {
        const justWarn = VH.checkVersion(product, invalidAsOfVersion, '<');



        if (justWarn) {


            // During the grace period (until the next major release following the deprecated code), just show a console warning
            console.warn(`Deprecation warning: You are using a deprecated API which will change in v${invalidAsOfVersion}. ${message}`);
        }
        else {
            throw new Error(`Deprecated API use. ${message}`);
        }
    }

    /**
     * Returns truthy value if environment is in testing mode.
     * @returns {Boolean}
     * @internal
     **/
    static get isTestEnv() {
        return isSiesta;
    }

    static get isDebug() {
        let result = false;

        return result;
    }
}

const VH = VersionHelper;



if (BrowserHelper.isBrowserEnv) {
    (globalThis.bryntum || (globalThis.bryntum = {})).getVersion = VH.getVersion.bind(VH);
    globalThis.bryntum.checkVersion = VH.checkVersion.bind(VH);
    globalThis.bryntum.deprecate = VH.deprecate.bind(VH);
    globalThis.bryntum.isTestEnv = VH.isTestEnv;
}
