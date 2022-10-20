import Base from '../../Base.js';
import ArrayHelper from '../../helper/ArrayHelper.js';
import EventHelper from '../../helper/EventHelper.js';
import ObjectHelper from '../../helper/ObjectHelper.js';

/**
 * @module Core/widget/mixin/KeyMap
 */

/**
 * Mixin for widgets that allows for standardized and customizable keyboard shortcuts functionality. Can be configured
 * on any widget or compatible feature.
 *
 * ```javascript
 * const grid = new Grid({
 *     keyMap: {
 *         // Changing keyboard navigation to respond to WASD keys.
 *         w : 'navigateUp',
 *         a : 'navigateLeft',
 *         s : 'navigateDown',
 *         d : 'navigateRight',
 *
 *         // Removes mappings for arrow keys.
 *         ArrowUp    : null,
 *         ArrowLeft  : null,
 *         ArrowDown  : null,
 *         ArrowRight : null
 *     }
 * });
 * ```
 *
 * For more information on how to customize keyboard shortcuts, please see our guide (Guides/Customization/Keyboard
 * shortcuts)
 * @mixin
 */
export default Target => class KeyMap extends (Target || Base) {
    static $name = 'KeyMap';

    get widgetClass() {}

    /**
     * Override to attach the keyMap keydown event listener to something else than this.element
     * @private
     */
    get keyMapElement() {
        return this.element;
    }

    /**
     * Override to make keyMap resolve subcomponent actions to something else than this.features.
     * @private
     */
    get keyMapSubComponents() {
        return this.features;
    }

    static configurable = {
        keyMap : {
            value : null,

            $config : {
                merge   : 'objects',
                nullify : true
            }
        }
    }

    /**
     * Called on keyMapElement keyDown
     * @private
     */
    performKeyMapAction(keyEvent) {
        const { keyMap } = this;
        let actionHandled = false;

        // We ignore if event is marked as handled
        if (keyMap && !keyEvent.handled) {
            // Match a defined key combination, such as `Ctrl + Enter`
            const keyCombination = ObjectHelper.keys(keyMap).find(keyString => {
                const
                    keys         = keyString.split('+'),
                    requireAlt   = keys.includes('Alt'),
                    requireShift = keys.includes('Shift'),
                    requireCtrl  = keys.includes('Ctrl');
                // Last key should be the actual key,
                let actualKey    = keys[keys.length - 1].toLowerCase();

                if (actualKey === 'space') {
                    actualKey = ' ';
                }

                // Modifiers in any order before the actual key
                return actualKey === keyEvent.key.toLowerCase() &&
                        ((!keyEvent.altKey && !requireAlt) || (keyEvent.altKey && requireAlt)) &&
                        ((!keyEvent.ctrlKey && !requireCtrl) || (keyEvent.ctrlKey && requireCtrl)) &&
                        ((!keyEvent.shiftKey && !requireShift) || (keyEvent.shiftKey && requireShift));
            });

            // Is there an action (fn to call) for that key combination
            if (keyMap[keyCombination]) {
                // Internally, action can be an array of actions in case of key conflicts
                const actions = ArrayHelper.asArray(keyMap[keyCombination]);
                let preventDefault;
                // The actions will be called in the order they were added to the array.
                for (let action of actions) {
                    preventDefault = true;
                    // Support for providing a config object as handler function to prevent keyEvent.preventDefault
                    if (ObjectHelper.isObject(action)) {
                        if (!action.handler) {
                            continue;
                        }
                        if (action.preventDefault === false) {
                            preventDefault = false;
                        }
                        action = action.handler;
                    }

                    if (typeof action === 'string') {
                        const {
                            thisObj,
                            handler
                        } = this.resolveKeyMapAction(action);

                        // Check if action is available, for example widget is enabled
                        if (thisObj.isActionAvailable?.(keyCombination, action, keyEvent) !== false) {

                            // If action function returns false, that means that it did not handle the action
                            if (handler.call(thisObj, keyEvent) !== false) {
                                actionHandled = true;
                                break;
                            }
                        }
                    }
                    else if (action.call(this) !== false) {
                        actionHandled = true;
                        break;
                    }
                }

                if (actionHandled) {
                    if (preventDefault) {
                        keyEvent.preventDefault();
                    }
                    keyEvent.handled = true;
                }
            }
        }

        return actionHandled;
    }

    /**
     * Resolves correct `this` and handler function.
     * If subComponent (action includes a dot) it will resolve in keyMapSubComponents (defaults to this.features).
     *
     * For example, in feature configurable:
     * `keyMap: {
     *     ArrowUp: 'navigateUp'
     * }`
     *
     * Will be translated (by InstancePlugin) to:
     * `keyMap: {
     *     ArrowUp: 'featureName.navigateUp'
     * }
     *
     * And resolved to correct function path here.
     *
     * Override to change action function mapping.
     * @private
     */
    resolveKeyMapAction(action) {
        const { keyMapSubComponents } = this;

        if (keyMapSubComponents && action.includes('.')) {
            const [component, actionName] = action.split('.');
            if (component && actionName) {
                return {
                    thisObj : keyMapSubComponents[component],
                    handler : keyMapSubComponents[component][actionName]
                };
            }
        }
        return {
            thisObj : this,
            handler : this[action]
        };
    }

    updateKeyMap(keyMap) {
        this.keyMapDetacher?.();
        if (!ObjectHelper.isEmpty(keyMap)) {
            this.keyMapDetacher = EventHelper.on({
                element : this.keyMapElement,
                keydown : 'keyMapOnKeyDown',
                thisObj : this
            });
        }
    }

    // Hook on to this to catch keydowns before keymap does
    keyMapOnKeyDown(event) {
        this.performKeyMapAction(event);
    }

    /**
     * This function is used for merging two keyMaps with each other. It can be used for example by a Grid's feature to
     * merge the fetature's keyMap into the Grid's with the use of a subPrefix.
     * @param {Object} target - The existing keyMap.
     * @param {Object} source - The keyMap we want to merge into target.
     * @param {Object} subPrefix - If keyMap actions in source should be prefixed, the prefix should be provided here.
     * As example, the prefix * `rowCopyPaste` will give the action 'rowCopyPaste.action'.
     * @private
     */
    mergeKeyMaps(target, source, subPrefix = null) {
        const mergedKeyMap = {};

        if (target) {
            ObjectHelper.assign(mergedKeyMap, target);
        }

        for (const key in source) {
            let newAction;
            // Mapping keymap actions to their corresponding feature's name, like group.toggleGroup
            if (ObjectHelper.isObject(source[key]) && source[key].handler) {
                newAction = ObjectHelper.assignIf({
                    handler : (subPrefix ? subPrefix + '.' : '') + source[key].handler
                }, source[key]);
            }
            else {
                newAction = (subPrefix ? subPrefix + '.' : '') + source[key];
            }

            // If current key already exists in clients keymap
            const currentKeyMapping = target?.[key];
            if (currentKeyMapping) {
                const
                    actions = ArrayHelper.asArray(currentKeyMapping),
                    weight = ObjectHelper.isObject(newAction) ? newAction.weight ?? 0 : 0;

                if (!weight) {
                    actions?.unshift(newAction);
                }
                else {
                    let index = actions.findIndex(action => action?.weight > weight);
                    if (index < 0) {
                        index = actions.length;
                    }
                    actions.splice(index, 0, newAction);
                }
                mergedKeyMap[key] = actions;
            }
            else {
                mergedKeyMap[key] = newAction;
            }
        }
        return mergedKeyMap;
    }

};
