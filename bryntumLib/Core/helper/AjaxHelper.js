import BrowserHelper from './BrowserHelper.js';

/**
 * @module Core/helper/AjaxHelper
 */

/**
 * Options for the `fetch` API. Please see
 * [fetch API](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch) for details
 * @typedef {Object} FetchOptions
 * @property {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} [method] The request method, e.g., GET, POST
 * @property {Object} [queryParams] A key-value pair Object containing the params to add to the query string
 * @property {Object} [headers] Any headers you want to add to your request, contained within a `Headers object or an
 * object literal with ByteString values
 * @property {Object} [body] Any body that you want to add to your request: this can be a Blob, BufferSource, FormData,
 * URLSearchParams, or USVString object. Note that a request using the GET or HEAD method cannot have a body.
 * @property {Object} [mode] The mode you want to use for the request, e.g., cors, no-cors, or same-origin.
 * @property {Object} [credentials] The request credentials you want to use for the request: omit, same-origin, or
 * include. To automatically send cookies for the current domain, this option must be provided
 * @property {Object} [parseJson] Specify `true` to parses the response and attach the resulting object to the
 * `Response` object as `parsedJson`
 */

const
    paramValueRegExp = /^(\w+)=(.*)$/,
    // For CodePens in docs, adjust URLs to be absolute
    resourceRoot     = globalThis.DocsBrowserInstance && BrowserHelper.queryString?.__resourceRoot  || '',
    parseParams      = function(paramString) {
        const
            result = {},
            params = paramString.split('&');

        // loop through each 'filter={"field":"name","operator":"=","value":"Sweden","caseSensitive":true}' string
        // So we cannot use .split('=')
        for (const nameValuePair of params) {
            const
                [match, name, value] = paramValueRegExp.exec(nameValuePair),
                decodedName          = decodeURIComponent(name),
                decodedValue         = decodeURIComponent(value);

            if (match) {
                let paramValue = result[decodedName];

                if (paramValue) {
                    if (!Array.isArray(paramValue)) {
                        paramValue = result[decodedName] = [paramValue];
                    }
                    paramValue.push(decodedValue);
                }
                else {
                    result[decodedName] = decodedValue;
                }
            }
        }
        return result;
    };
/**
 * Simplifies Ajax requests. Uses fetch & promises.
 *
 * ```javascript
 * AjaxHelper.get('some-url').then(response => {
 *     // process request response here
 * });
 * ```
 *
 * Uploading file to server via FormData interface.
 * Please visit [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) for details.
 *
 * ```javascript
 * const formData = new FormData();
 * formData.append('file', 'fileNameToUpload');
 * AjaxHelper.post('file-upload-url', formData).then(response => {
 *     // process request response here
 * });
 * ```
 *
 */
export default class AjaxHelper {
    /**
     * Make a request (using GET) to the specified url.
     * @param {String} url URL to `GET` from
     * @param {FetchOptions} [options] The options for the `fetch` API
     * @returns {Promise} The fetch Promise, which can be aborted by calling a special `abort` method
     * @async
     */
    static get(url, options) {
        return this.fetch(url, options);
    }

    /**
     * POST data to the specified URL.
     * @param {String} url URL to `POST` to
     * @param {String|Object|FormData} payload The data to post. If an object is supplied, it will be stringified
     * @param {FetchOptions} [options] The options for the `fetch` API
     * @returns {Promise} The fetch Promise, which can be aborted by calling a special `abort` method
     * @async
     */
    static post(url, payload, options = {}) {
        if (!(payload instanceof FormData) && !(typeof payload === 'string')) {
            payload = JSON.stringify(payload);

            options.headers = options.headers || {};

            options.headers['Content-Type'] = options.headers['Content-Type'] || 'application/json';
        }

        return this.fetch(url, Object.assign({
            method : 'POST',
            body   : payload
        }, options));
    }

    /**
     * Fetch the specified resource using the `fetch` API.
     * @param {String} url URL to fetch from
     * @param {FetchOptions} [options] The options for the `fetch` API
     * @returns {Promise} The fetch Promise, which can be aborted by calling a special `abort` method
     * @async
     */
    static fetch(url, options = {}) {
        let controller;

        // AbortController is not supported by LockerService
        // https://github.com/bryntum/support/issues/3689
        if (typeof AbortController !== 'undefined') {
            controller = options.abortController = new AbortController();
            options.signal = controller.signal;
        }

        if (!('credentials' in options)) {
            options.credentials = 'include';
        }

        if (options.queryParams) {
            const params = Object.entries(options.queryParams);
            if (params.length) {
                url += (url.includes('?') ? '&' : '?') + params.map(([param, value]) =>
                    `${param}=${encodeURIComponent(value)}`
                ).join('&');
            }
        }



        // Promise that will be resolved either when network request is finished or when json is parsed
        const promise = new Promise((resolve, reject) => {
            fetch(resourceRoot + url, options).then(
                response => {
                    if (options.parseJson) {
                        response.json().then(json => {
                            response.parsedJson = json;
                            resolve(response);
                        }).catch(error => {
                            response.parsedJson = null;
                            response.error = error;
                            reject(response);
                        });
                    }
                    else {
                        resolve(response);
                    }
                }
            ).catch(error => {
                error.stack = promise.stack;

                reject(error);
            });
        });

        promise.stack = new Error().stack;

        promise.abort = function() {
            controller?.abort();
        };

        return promise;
    }

    /**
     * Registers the passed URL to return the passed mocked up Fetch Response object to the
     * AjaxHelper's promise resolve function.
     * @param {String} url The url to return mock data for
     * @param {Object|Function} response A mocked up Fetch Response object which must contain
     * at least a `responseText` property, or a function to which the `url` and a `params` object
     * and the `Fetch` `options` object is passed which returns that.
     * @param {String} response.responseText The data to return.
     * @param {Boolean} [response.synchronous] resolve the Promise immediately
     * @param {Number} [response.delay=100] resolve the Promise after this number of milliseconds.
     */
    static mockUrl(url, response) {
        const me = this;

        (me.mockAjaxMap || (me.mockAjaxMap = {}))[url] = response;

        // Inject the override into the AjaxHelper instance
        if (!AjaxHelper.originalFetch) {
            AjaxHelper.originalFetch = AjaxHelper.fetch;
            AjaxHelper.fetch = me.mockAjaxFetch.bind(me);
        }
    }

    static mockAjaxFetch(url, options) {
        const urlAndParams = url.split('?');

        let result     = this.mockAjaxMap[urlAndParams[0]],
            parsedJson = null;

        if (result) {
            if (typeof result === 'function') {
                result = result(urlAndParams[0], urlAndParams[1] && parseParams(urlAndParams[1]), options);
            }
            try {
                parsedJson = options.parseJson && JSON.parse(result.responseText);
            }
            catch (error) {
                parsedJson   = null;
                result.error = error;
            }

            result = Object.assign({
                status     : 200,
                ok         : true,
                headers    : new Headers(),
                statusText : 'OK',
                url        : url,
                parsedJson : parsedJson,
                text       : () => new Promise((resolve) => {
                    resolve(result.responseText);
                }),
                json : () => new Promise((resolve) => {
                    resolve(parsedJson);
                })
            }, result);

            return new Promise(function(resolve, reject) {
                if (result.synchronous) {
                    resolve(result);
                }
                else {
                    setTimeout(function() {
                        resolve(result);
                    }, ('delay' in result ? result.delay : 100));
                }
            });
        }
        else {
            return AjaxHelper.originalFetch(url, options);
        }
    }
}
