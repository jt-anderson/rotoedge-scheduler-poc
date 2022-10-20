import InstancePlugin from '../../mixin/InstancePlugin.js';
import Menu from '../../widget/Menu.js';
import Objects from '../../helper/util/Objects.js';
import DomHelper from '../../helper/DomHelper.js';
import StringHelper from '../../helper/StringHelper.js';
import EventHelper from '../../helper/EventHelper.js';

/**
 * @module Core/feature/base/ContextMenuBase
 */
let contextMenuKeyEvent;

/**
 * Abstract base class used by other context menu features.
 *
 * ## Keyboard shortcuts
 * This base class has the following default keyboard shortcuts:
 *
 * | Keys       | Action               | Action description                               |
 * |------------|----------------------|--------------------------------------------------|
 * | Space      | showContextMenuByKey | Shows context menu for currently focused element |
 * | Ctrl+Space | showContextMenuByKey | Shows context menu for currently focused element |
 *
 *
 * For more information on how to customize keyboard shortcuts, please see our guide
 * (Guides/Customization/Keyboard shortcuts)
 *
 * @extends Core/mixin/InstancePlugin
 * @abstract
 */
export default class ContextMenuBase extends InstancePlugin {
    static get $name() {
        return 'ContextMenuBase';
    }

    //region Config

    static get configurable() {
        return {
            /**
             * This is a type of the context menu used to generate correct names for methods and events.
             * Should be in camel case. Required to be set in subclass.
             * @config {String}
             * @readonly
             */
            type : null,

            /**
             * Gets the Menu instance that this feature is using.
             * @member {Core.widget.Menu} menu
             * @readonly
             */
            /**
             * A config which will be applied when creating the Menu component.
             * @config {Object}
             */
            menu : {
                $config : ['lazy', 'nullify'],
                value   : {
                    type         : 'menu',
                    autoShow     : false,
                    closeAction  : 'hide',
                    scrollAction : 'hide',
                    constrainTo  : globalThis
                }
            },

            /**
             * {@link Core/widget/Menu} items object containing named child menu items to apply to the feature's
             * provided context menu.
             *
             * This may add extra items as below, but may also remove any of the default items by configuring the name
             * of the item as `false`
             *
             * ```javascript
             * features : {
             *     cellMenu : {
             *         // This object is applied to the Feature's predefined default items
             *         items : {
             *             switchToDog : {
             *                 text : 'Dog',
             *                 icon : 'b-fa b-fa-fw b-fa-dog',
             *                 onItem({record}) {
             *                     record.dog = true;
             *                     record.cat = false;
             *                 },
             *                 weight : 500     // Make this second from end
             *             },
             *             switchToCat : {
             *                 text : 'Cat',
             *                 icon : 'b-fa b-fa-fw b-fa-cat',
             *                 onItem({record}) {
             *                     record.dog = false;
             *                     record.cat = true;
             *                 },
             *                 weight : 510     // Make this sink to end
             *             },
             *             add : false // We do not want the "Add" submenu to be available
             *         }
             *     }
             * }
             * ```
             *
             * @config {Object}
             */
            items : {},

            /**
             * Event which is used to show context menu.
             * Available options are: 'contextmenu', 'click', 'dblclick' or `false` to disable.
             * Default value is used from {@link Grid/view/GridBase#config-contextMenuTriggerEvent}
             * @config {String|Boolean}
             */
            triggerEvent : false,

            /**
             * See {@link #keyboard-shortcuts Keyboard shortcuts} for details
             * @config {Object} keyMap
             */
            keyMap : {
                ' '          : { handler : 'showContextMenuByKey', weight : 100 },
                'Ctrl+Space' : 'showContextMenuByKey'
            }
        };
    }

    // Plugin configuration. This plugin chains some of the functions in Grid.
    // The contextmenu event is emulated from a taphold gesture on touch platforms.
    static get pluginConfig() {
        return {
            assign : ['showContextMenu'],
            chain  : [
                'onElementContextMenu',
                'onElementClick',
                'onElementDblClick'
            ]
        };
    }

    //endregion

    //region Init

    construct(...args) {
        super.construct(...args);

        if (!this.type?.length) {
            throw new Error(`Config 'type' is required to be specified for context menu`);
        }
    }
    //endregion

    //region Events

    /**
     * This event fires on the owning widget when an item is selected in the context menu.
     * @event contextMenuItem
     * @on-owner
     * @param {Core.widget.Widget} source The owning widget
     * @param {Core.widget.Menu} menu The menu
     * @param {Object} item Selected menu item
     */

    /**
     * This event fires on the owning widget when a check item is toggled in the context menu.
     * @event contextMenuToggleItem
     * @on-owner
     * @param {Core.widget.Widget} source The owning widget
     * @param {Core.widget.Menu} menu The menu
     * @param {Object} item Selected menu item
     * @param {Boolean} checked Checked or not
     */

    onElementContextMenu(event) {
        this.onElementEvent(event);
    }

    onElementClick(event) {
        this.onElementEvent(event);
    }

    onElementDblClick(event) {
        this.onElementEvent(event);
    }

    onElementEvent(event) {
        // Check if already handled, to only show one context menu
        if (!event.handled && this.triggerEvent === event.type) {
            const originalEvent = event;

            // Point the context menu target at the original invoking key event's target
            if (contextMenuKeyEvent) {
                const { target } = contextMenuKeyEvent;
                // To define properties on the event object in salesforce env first we need to "fix" it
                // https://github.com/bryntum/support/issues/4432
                event = EventHelper.fixEvent(new MouseEvent(event.type, event));
                Object.defineProperty(event, 'target', { get : () => target, configurable : true });
                event.preventDefault = function() {
                    originalEvent.preventDefault();
                    // Set handled to let other menus know not to act on this fake event
                    originalEvent.handled = true;
                };
            }
            this.internalShowContextMenu(event);
        }
    }

    showContextMenuByKey(event) {
        // Convert space on a non-editable element to a contextmenu event
        if (!DomHelper.isEditable(event.target)) {
            const target = this.getKeyboardContextMenuTarget(event.target);

            if (target) {
                contextMenuKeyEvent = event;
                DomHelper.triggerMouseEvent(target, this.triggerEvent);
                event.handled = true;
                event.preventDefault();
                event.stopImmediatePropagation();
                contextMenuKeyEvent = null;
                // Returning true to let KeyMap know that the event is handled.
                return true;
            }
        }
        // Returning false to let KeyMap know that other actions can be called for this event.
        return false;
    }

    // Pick a target child of a keydowned element to fire a contextmenu event through.
    getKeyboardContextMenuTarget(targetElement) {
        const targetRect = DomHelper.isInView(targetElement);

        return targetElement.children.length ? DomHelper.childFromPoint(targetElement, targetRect.width / 2, targetRect.height / 2) : targetElement;
    }

    //endregion

    //region Menu handlers

    internalShowContextMenu(domEvent) {
        const me = this;

        if (me.disabled) {
            return;
        }

        const data = me.getDataFromEvent(domEvent);

        if (!domEvent.handled && data && me.shouldShowMenu(data)) {
            data.domEvent = domEvent;
            me.showContextMenu(data);
        }
    }

    getDataFromEvent(event) {
        return {
            event,
            targetElement : this.getTargetElementFromEvent(event)
        };
    }

    getTargetElementFromEvent(event) {
        return event.target;
    }

    /**
     * Shows the context menu.
     * @param {Event} event The initiating event.
     * @param {Object|HTMLElement} [alignSpec] Menu alignment specification, or an element to align to
     * @param {HTMLElement|Core.helper.util.Rectangle} alignSpec.target The Element or Rectangle to align to.
     * @param {Boolean} [alignSpec.anchor] True to show a pointer arrow connecting to the target. Defaults to false.
     * @param {Boolean} [alignSpec.overlap] True to allow this to overlap the target.
     * @param {String} alignSpec.align The alignment specification string, `[trbl]n-[trbl]n`.
     * @on-owner
     */
    showContextMenu(event, alignSpec) {
        const
            me               = this,
            isDOMEvent       = DomHelper.isDOMEvent(event),
            menuContext      = isDOMEvent ? me.getDataFromEvent(event) : event,
            domEvent         = isDOMEvent ? event : menuContext.domEvent;

        // If our menu was visible from last invocation, hide it.
        // Apps may need the ${type}MenuShow event which is triggered in onShow.
        me._menu?.hide();

        if (me.disabled) {
            return;
        }

        /**
         * @member {Object} menuContext
         * An informational object containing contextual information about the last activation
         * of the context menu. The base properties are listed below. Some subclasses may add extra
         * contextual information such as `eventRecord` and `resourceRecord` to the block.
         * @property {Event} menuContext.event The initiating event.
         * @property {Number[]} menuContext.point The client `X` and `Y` position of the initiating event.
         * @property {HTMLElement} menuContext.targetElement The target to which the menu is being applied.
         * @property {Object} menuContext.items The context menu **configuration** items.
         * @property {Core.data.Model[]} menuContext.selection The record selection in the client (Grid, Scheduler, Gantt or Calendar).
         * @readonly
         */
        me.menuContext = menuContext;

        const
            {
                type,
                client,
                processItems
            }         = me,
            elCenter  = DomHelper.isInView(menuContext.targetElement).center;

        Objects.assign(menuContext, {
            feature   : me,
            point     : domEvent?.clientX ? [domEvent.clientX + 1, domEvent.clientY + 1] : [elCenter.x, elCenter.y],
            menu      : me,
            items     : {},
            selection : client.selectedRecords
        });

        // Call the chainable method which other features use to add or remove their own menu items.
        me.callChainablePopulateMenuMethod(menuContext);

        // Merge with user defined items
        Objects.merge(menuContext.items, me.baseItems);

        // Do not drop through to browser context menu if all our items have been hidden, or processItems
        // returns false to veto the show.
        me.preventDefaultEvent(menuContext);

        // Allow user a chance at processing the items and preventing the menu from showing
        if ((!processItems || me.callback(processItems, client, [menuContext]) !== false) && me.hasActiveMenuItems(menuContext)) {
            me.populateItemsWithData(menuContext);

            // beforeContextMenuShow is a lifecycle method which may be implemented in subclasses to preprocess the event.
            if (me.beforeContextMenuShow(menuContext) !== false) {
                const { menu } = me;
                // Trigger event that allows preventing menu or manipulating its items.
                if (client.trigger(`${type}MenuBeforeShow`, menuContext) !== false) {
                    menu.items = menuContext.items;
                    menu.showBy(alignSpec || menuContext.point);

                    // Any drag drop type action should hide the menu
                    me.touchMoveDetacher?.();
                    me.touchMoveDetacher = EventHelper.on({
                        element   : client.element,
                        touchmove : () => menu.hide(),
                        once      : true
                    });

                    // A DOM event will not be present if this is being called programatically
                    // with a generated eventParams block which has no `domEvent` property.
                    // ContextMenuBase#internalShowContextMenu injects that property when
                    // reacting to a contextmenu event.
                    if (domEvent) {
                        domEvent.preventDefault();
                        // Let others know that this event has been handled
                        domEvent.handled = true;
                    }
                }
            }
        }
    }

    /**
     * Returns the base, configured-in menu items set from the configured items, taking into
     * account the namedItems the feature offers.
     * @property {Object[]}
     * @readonly
     * @internal
     */
    get baseItems() {
        if (!this._baseItems) {
            const
                me             = this,
                { namedItems } = me,
                baseItems      = (me._baseItems = Objects.assign({}, me.items));

            // Substitute any named items into any of our items that reference them.
            for (const ref in baseItems) {
                const item = baseItems[ref];

                if (item) {
                    // If this class or instance has a "namedItems" object
                    // named by this ref, then use it as the basis for the item
                    if (namedItems && (ref in namedItems)) {
                        baseItems[ref] = typeof item === 'object' ? Objects.merge(Objects.clone(namedItems[ref]), item) : namedItems[ref];
                    }
                    else if (item === true) {
                        delete baseItems[ref];
                    }
                }
            }
        }

        return this._baseItems;
    }

    /**
     * Hides the context menu
     * @internal
     */
    hideContextMenu(animate) {
        this.menu?.hide(animate);
    }

    callChainablePopulateMenuMethod(eventParams) {
        // For example `populateCellMenu`
        this.client[`populate${StringHelper.capitalize(this.type)}Menu`]?.(eventParams);
    }

    hasActiveMenuItems(eventParams) {
        // We only have a viable menu if we have some non-null items which are visible.
        // Some Menu features hide certain menu options under conditions like
        // client being readOnly. This can result in no menu options being visible.
        // Under these circumstances, showContextMenu must not attempt to show an empty Menu.
        return Object.values(eventParams.items).some(item => item && !item.hidden);
    }

    /**
     * Override this function and return `false` to prevent the context menu from being shown. Returns `true` by default.
     * @returns {Boolean}
     * @internal
     */
    shouldShowMenu() {
        return true;
    }

    beforeContextMenuShow(eventParams) {}

    populateItemsWithData(eventParams) {}

    preventDefaultEvent(eventParams) {
        eventParams.event?.preventDefault();
    }

    //endregion

    //region Configurables

    changeTriggerEvent(triggerEvent) {
        return triggerEvent || this.client.contextMenuTriggerEvent;
    }

    changeMenu(menu, oldMenu) {
        const
            me = this,
            {
                client,
                type
            } = me;

        if (menu) {
            return Menu.reconfigure(oldMenu, menu ? Menu.mergeConfigs({
                owner       : client,
                rootElement : client.rootElement,
                onItem(itemEvent) {
                    client.trigger(`${type}MenuItem`, itemEvent);
                },
                onToggle(itemEvent) {
                    client.trigger(`${type}MenuToggleItem`, itemEvent);
                },
                onDestroy() {
                    me.menu = null;
                },
                // Load up the item event with the contextual info
                onBeforeItem(itemEvent) {
                    Object.assign(itemEvent, me.menuContext);
                },
                onShow({ source : menu }) {
                    me.menuContext.menu = menu;
                    client.trigger(`${type}MenuShow`, me.menuContext);
                }
            }, menu) : null, me);
        }
        else if (oldMenu?.isWidget) {
            oldMenu.destroy();
        }
    }

    //endregion

}
