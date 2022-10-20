/**
 * @module Core/localization/LocaleHelper
 */

/**
 * Provides locale management methods.
 */
export default class LocaleHelper {

    /**
     * Merges all properties of provided locales into new locale.
     * Locales are merged in order they provided and locales which go later replace same properties of previous locales.
     * @param {...Object} locales Locales to merge
     * @returns {Object} Merged locale
     */
    static mergeLocales(...locales) {
        const result = {};

        locales.forEach(locale => {
            Object.keys(locale).forEach(key => {
                if (typeof locale[key] === 'object') {
                    result[key] = { ...result[key], ...locale[key] };
                }
                else {
                    result[key] = locale[key];
                }
            });
        });
        return result;
    }

    /**
     * Removes all properties from `locale` that are present in the provided `toTrim`.
     * @param {Object} locale Locale to process
     * @param {Object} toTrim Object enumerating properties that should be removed
     * @param {boolean} [silent=true] When `true` ignores missing properties that should be removed (default).
     * When `false` throws exceptions in such cases.
     */
    static trimLocale(locale, toTrim, silent = true) {
        const
            remove = (key, subKey) => {
                if (locale[key]) {
                    if (subKey) {
                        if (locale[key][subKey]) {
                            delete locale[key][subKey];
                        }
                    }
                    else {
                        delete locale[key];
                    }
                }
            };

        Object.keys(toTrim).forEach(key => {
            if (Object.keys(toTrim[key]).length > 0) {
                Object.keys(toTrim[key]).forEach(subKey => remove(key, subKey));
            }
            else {
                remove(key);
            }
        });
    }

    /**
     * Put the locale under `globalThis.bryntum.locales` to make sure it can be discovered automatically
     * @param {String} localeName Locale name
     * @param {Object} config Locale config
     */
    static publishLocale(localeName, config) {
        const
            bryntum = globalThis.bryntum = globalThis.bryntum || {},
            locales = bryntum.locales = bryntum.locales || {};
        // Avoid registering locales twice
        locales[localeName] = !locales[localeName] ? config : this.mergeLocales(locales[localeName], config);
    }

}
