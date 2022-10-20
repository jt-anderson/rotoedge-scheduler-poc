import Base from '../Base.js';
import Events from '../mixin/Events.js';

/**
 * @module Core/helper/WebSocketManager
 */

/**
 * This class allows to send and receive messages from websocket server passing responses via events. This helper is
 * meant to be used with a demo websocket server. It sends messages that are JSON strings including "command" key and
 * arbitrary data keys. For example:
 *
 * ```
 * // request string to notify other clients that new client is connected
 * "{ \"command\": \"hello\", \"userName\": \"new user\" }"
 *
 * // response message from the websocket server with list of connected users
 * "{ \"command\": \"users\", \"users\": [\"new user\"] }"
 * ```
 *
 * Usage:
 * ```javascript
 * connector = new WebSocketManager({
 *     address     : 'ws://localhost:8080',
 *     userName    : 'Test client',
 *     autoConnect : false
 * });
 *
 * const opened = await connector.open();
 *
 * if (!opened) {
 *     console.log('Could not open connection');
 * }
 *
 * connector.on({
 *     message({ data }) {
 *         console.log(data);
 *     }
 * });
 *
 * // Sends "{ \"command\": \"hello\", \"userName\": \"mark\" }" string to the websocket server
 * // When response arrives helper will log following message: "{ command: 'users', users: ['mark'] }"
 * connector.send('hello', { userName : 'mark' });
 * ```
 * @class
 * @extends Core/Base
 * @mixes Core/mixin/Events
 * @private
 */
export default class WebSocketManager extends Events(Base) {
    // This allows to hook into for testing purposes
    static webSocketImplementation = typeof WebSocket === 'undefined' ? null : WebSocket

    static configurable = {
        /**
         * WebSocket server address
         * @config {String}
         */
        address : '',

        /**
         * User name allowing to identify client
         * @config {String}
         */
        userName : 'User',

        /**
         * Connect to websocket server immediately after instantiation
         * @config {Boolean}
         */
        autoConnect : true
    }

    construct(config = {}) {
        const me = this;

        super.construct(config);

        me.onWsOpen = me.onWsOpen.bind(me);
        me.onWsClose = me.onWsClose.bind(me);
        me.onWsMessage = me.onWsMessage.bind(me);
        me.onWsError = me.onWsError.bind(me);

        if (me.autoConnect && me.address) {
            me.open();
        }
    }

    doDestroy() {
        const me = this;

        if (me.connector) {
            me.detachSocketListeners(me.connector);
            me.connector.close();
            me.connector = null;
        }
        super.doDestroy();
    }

    //#region Websocket state

    get isConnecting() {
        return this.connector?.readyState === this.constructor.webSocketImplementation.CONNECTING;
    }

    get isOpened() {
        return this.connector?.readyState === this.constructor.webSocketImplementation.OPEN;
    }

    get isClosing() {
        return this.connector?.readyState === this.constructor.webSocketImplementation.CLOSING;
    }

    get isClosed() {
        return this.connector?.readyState === this.constructor.webSocketImplementation.CLOSED;
    }

    //#endregion

    //#region Websocket init

    createWebSocketConnector() {
        const connector = this.connector = new this.constructor.webSocketImplementation(this.address);

        this.attachSocketListeners(connector);
    }

    destroyWebSocketConnector() {
        this.detachSocketListeners(this.connector);

        this.connector.close();

        this.connector = null;
    }

    attachSocketListeners(connector) {
        const me = this;

        connector.addEventListener('open', me.onWsOpen);
        connector.addEventListener('close', me.onWsClose);
        connector.addEventListener('message', me.onWsMessage);
        connector.addEventListener('error', me.onWsError);
    }

    detachSocketListeners(connector) {
        const me = this;

        connector.removeEventListener('open', me.onWsOpen);
        connector.removeEventListener('close', me.onWsClose);
        connector.removeEventListener('message', me.onWsMessage);
        connector.removeEventListener('error', me.onWsError);
    }

    //#endregion

    //#region Websocket methods

    /**
     * Connect to the server and start listening for messages
     * @returns {Promise} Returns true if connection was successful and false otherwise
     */
    async open() {
        const me = this;

        if (me._openPromise) {
            return me._openPromise;
        }

        if (!me.address) {
            console.warn('Server me.address cannot be empty');
            return;
        }

        if (me.isOpened) {
            return true;
        }

        me.createWebSocketConnector();

        let detacher;

        // Wait for `open` or `close` event
        me._openPromise = new Promise(resolve => {
            detacher = me.on({
                open() {
                    resolve(true);
                },
                error() {
                    resolve(false);
                }
            });
        }).then(value => {
            // Detach listeners
            detacher();

            // Cleanup the promise
            me._openPromise = null;

            // If quit early with a timeout then remove reference to the WebSocket instance
            if (!value) {
                me.destroyWebSocketConnector();
            }

            return value;
        }).catch(() => {
            me._openPromise = null;
            me.destroyWebSocketConnector();
        });

        return me._openPromise;
    }

    /**
     * Close socket and disconnect from the server
     */
    close() {
        if (this.connector) {
            this.destroyWebSocketConnector();
            this.trigger('close');
        }
    }

    /**
     * Send data to the websocket server
     * @param {String} command
     * @param {*} data
     */
    send(command, data = {}) {
        this.connector?.send(JSON.stringify({ command, ...data }));
    }

    //#endregion

    //#region websocket event listeners

    onWsOpen(event) {
        this.trigger('open', { event });
    }

    onWsClose(event) {
        this.trigger('close', { event });
    }

    onWsMessage(message) {
        try {
            const data = JSON.parse(message.data);
            this.trigger('message', { data });
        }
        catch (error) {
            this.trigger('error', { error });
        }
    }

    onWsError(error) {
        this.trigger('error', { error });
    }

    //#endregion
}
