import Widget from './Widget.js';
import ArrayHelper from '../helper/ArrayHelper.js';
import ObjectHelper from '../helper/ObjectHelper.js';
import Layout from './layout/Layout.js';
import DomHelper from '../helper/DomHelper.js';
import DomClassList from '../helper/util/DomClassList.js';
import './Ripple.js';
import Bag from '../util/Bag.js';

/**
 * @module Core/widget/Container
 */

const
    emptyObject  = Object.freeze({}),
    { isArray }  = Array,
    returnWeight = i => i.weight,
    // Allowing string weights (used by subgrids for backwards compatibility)
    sortByWeight = ({ weight : a }, { weight : b }) => {
        if (typeof a === 'string' || typeof b === 'string') {
            return String(a).localeCompare(String(b));
        }

        // Items without weight sort last
        return (a ?? Number.MAX_SAFE_INTEGER) - (b ?? Number.MAX_SAFE_INTEGER);
    },
    isNotHidden   = w => w && !w.hidden,
    stylesToCheck = ['display', 'flex-direction'],
    boxLayouts    = {
        default : 1,
        box     : 1
    };

/**
 * Widget that can contain other widgets. Layout is flexbox by default, see the {@link #config-layout} config.
 *
 * ```javascript
 * // create a container with two widgets
 * let container = new Container({
 *     items : [
 *         { type : 'text', label : 'Name' },
 *         { type : 'number', label : 'Score' }
 *     ]
 * });
 * ```
 *
 * Containers can have child widgets added, or removed during their lifecycle to accommodate business needs.
 *
 * For example:
 *
 *  ```javascript
 *  myTaskPopup.on({
 *      beforeShow() {
 *          if (task.type === task.MASTER) {
 *              // Insert the childTask multiselect before the masterTask field
 *              myPopup.insert(childTaskMultiselect, masterTaskField)
 *
 *              // We don't need this for master tasks
 *              myPopup.remove(masterTaskField);
 *          }
 *          else {
 *              // Insert the masterTask combo before the childTask multiselect
 *              myPopup.insert(masterTaskField, childTaskMultiselect)
 *
 *              // We don't need this for child tasks
 *              myPopup.remove(childTaskMultiselect);
 *          }
 *      }
 *  });
 * ```
 *
 * @extends Core/widget/Widget
 * @classType container
 * @inlineexample Core/widget/Container.js
 */
export default class Container extends Widget {

    static get $name() {
        return 'Container';
    }

    // Factoryable type name
    static get type() {
        return 'container';
    }

    static get configurable() {
        return {
            /**
             * An object containing typed child widget config objects or Widgets. May also be specified
             * as an array.
             *
             * If configured as an Object, the property names are used as the child component's
             * {@link Core.widget.Widget#config-ref ref} name, and the value is the child component's config object.
             *
             * ```javascript
             *
             *  class MyContainer extends Container {
             *      static get configurable() {
             *          return {
             *              items : {
             *                  details : {
             *                      type : 'panel',
             *                      ....
             *                  },
             *                  button : {
             *                      type : 'button',
             *                      text : 'Save'
             *                  }
             *              }
             *          }
             *      }
             *  }
             *
             *  new MyContainer({
             *      title    : 'Test Container',
             *      floating : true,
             *      centered : true,
             *      width    : 600,
             *      height   : 400,
             *      layout   : 'fit',
             *      items    : {
             *          button : {
             *              disabled : true
             *          },
             *          details : {
             *              title : 'More coolness',
             *              html  : 'Details content'
             *      }
             *  }).show();
             * ```
             *
             * The order of the child widgets is determined by the order they are defined in `items`, but can also be
             * affected by configuring a {@link Core.widget.Widget#config-weight} on one or more widgets.
             *
             * If you want to customize child items of an existing class, you can do this using the child widget
             * 'ref' identifier (useful for reconfiguring Event Editor in Scheduler / Gantt):
             *
             * ```javascript
             *  new MyCustomTabPanel({
             *      items    : {
             *          // Reconfigure tabs
             *          firstTab : {
             *              title : 'My custom title'
             *          },
             *          secretTab : null // hide this tab
             *      }
             *  }).show();
             * ```
             *
             * @config {Object|Object[]|Core.widget.Widget[]}
             * @category Content
             */
            items : null,

            /**
             * An array of {@link #config-items child item} _config objects_ which is to be converted into
             * instances only when this Container is rendered, rather than eagerly at construct time.
             *
             * _This is mutually exclusive with the {@link #config-items} config._
             *
             * @config {Object|Object[]|Core.widget.Widget[]}
             * @category Content
             */
            lazyItems : {
                $config : ['lazy'],
                value   : null
            },

            /**
             * A config object containing default settings to apply to all child widgets.
             * @config {Object}
             * @category Content
             */
            defaults : null,

            defaultType : 'widget',

            /**
             * The CSS style properties to apply to the {@link Core.widget.Widget#property-contentElement}.
             *
             * By default, a Container's {@link Core.widget.Widget#property-contentElement} uses flexbox layout, so this
             * config may contain the following properties:
             *
             * - <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/flex-direction">flexDirection</a> default '`row`'
             * - <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/flex-wrap">flexWrap</a>
             * - <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/flex-flow">flexFlow</a>
             * - <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/justify-content">justifyContent</a>
             * - <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/align-items">alignItems</a>
             * - <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/align-content">alignContent</a>
             * - <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/place-content">placeContent</a>
             * @prp {Object}
             * @category Layout
             */
            layoutStyle : null,

            /**
             * An optional CSS class to add to child items of this container.
             * @config {String}
             * @category CSS
             */
            itemCls : null,

            /**
             * The {@link #config-layout} as an instance of {@link Core.widget.layout.Layout}.
             * This is a helper class which adds and removes child widgets to this Container's
             * DOM and applies CSS classes based upon its requirements.
             *
             * The {@link Core.widget.layout.Card card} layout provides for showing one child
             * widget at a time, and provides a switching API to change which child widget is
             * currently active.
             * @member {Core.widget.layout.Layout} layout
             * @category Layout
             */
            /**
             * The short name of a helper class which manages rendering and styling of child items.
             *
             * Or a config object which includes a `type` property which specifies which type
             * of layout to use, and how to configure that layout.
             *
             * By default, the only special processing that is applied is that the Container class's
             * {@link #config-itemCls} is added to child items.
             *
             * Containers use CSS flexbox in its default configuration to arrange child items. You may either use the
             * {@link #config-layoutStyle} configuration to tune how child items are layed out, or use one of the built
             * in helper classes which include:
             *
             *  - `fit` A single child item is displayed fitting exactly into the
             *  {@link Core.widget.Widget#property-contentElement}.
             *  - `card` Child items are displayed one at a time, size to fit the
             *  {@link Core.widget.Widget#property-contentElement} and are slid in from the side when activated.
             *  - `box` Child items are layed out using flexbox.
             *
             * For example:
             * ```javascript
             * {
             *     id     : 'myContainer',
             *     // Our child items flow downwards and are stretched to fill our width
             *     layout : {
             *         type       : 'box',
             *         direction  : 'column'
             *         align      : 'stretch'
             *     }
             * }
             * @config {String|Object}
             * @category Layout
             */
            layout : {
                type : 'default'
            },

            // TODO: deprecate namedItems, use items instead
            /**
             * An object containing named config objects which may be referenced by name in any {@link #config-items}
             * object. For example, a specialized {@link Core.widget.Menu Menu} subclass may have a `namedItems` default
             * value defined like this:
             *
             * ```javascript
             *  namedItems : {
             *      removeRow : {
             *          text : 'Remove row',
             *          onItem() {
             *              this.ownerGrid.remove(this.ownerGrid.selectedRecord);
             *          }
             *      }
             *  }
             * ```
             *
             * Then whenever that subclass is instantiated and configured with an {@link #config-items} object, the
             * items may be configured like this:
             *
             * ```javascript
             *  items : {
             *      removeRow : true,   // The referenced namedItem will be applied to this
             *      otherItemRef : {
             *          text : 'Option 2',
             *          onItem() {
             *          }
             *      }
             * }
             * ```
             * @config {Object}
             * @category Content
             */
            namedItems : null,

            /**
             * When set to `true`, this widget is considered as a whole when processing {@link Core.widget.Toolbar}
             * overflow. When `false`, this widget's child items are considered instead.
             * @config {Boolean}
             * @default false
             * @category Layout
             * @internal
             */
            overflowable : {
                value   : null,
                default : false,
                $config : null
            },

            /**
             * Specify `true` for a container used to show text markup. It will apply the CSS class `b-text-content`
             * which specifies a default max-width that makes long text more readable.
             *
             * This CSS class is automatically removed if the container adds/defines child Widgets.
             * @config {Boolean}
             * @default
             * @category Content
             */
            textContent : true,

            /**
             * Record whose values will be used to populate fields in the container.
             * @config {Object}
             * @internal
             */
            record : null,

            /**
             * Update assigned {@link #config-record} automatically on field changes
             * @config {Boolean}
             */
            autoUpdateRecord : null,

            /**
             * Update fields if the {@link #config-record} changes
             * @config {Boolean}
             * @internal
             */
            autoUpdateFields : null,

            /**
             * Specify `true` to make this container hide when it has no visible children (Either empty
             * or all children hidden).
             *
             * Container will show itself when there are visible children, ie: hidden children are
             * shown, or new visible children are added.
             * @config {Boolean}
             * @default
             * @category Layout
             */
            hideWhenEmpty : null,

            contentElMutationObserver : {
                $config : ['lazy', 'nullify'],
                value   : true
            },

            /**
             * Specify `true` to isolate record changes to this container and its ancestors. Prevents record
             * updates from propagating up from here and also prevents record updates from parent from
             * propagating down to us.
             *
             * @config {Boolean}
             * @default false
             * @internal
             */
            isolateFields : false,

            /**
             * Can be set to `true` to make a focus of a focusable encapsulating element rely
             * focus down into a focusable child. This is normally `false` to allow mousedown
             * to begin text selection in Popups.
             * @internal
             */
            focusDescendant : false,

            // Our own setValues/getValues system should not set/get HTML content
            defaultBindProperty : null,

            /**
             * A {@link #function-query} selector function which can identify the descendant widget to which
             * focus should be directed by default.
             *
             * By default, the first focusable descendant widget is chosen. This may direct focus to a different
             * widget:
             *
             * ```javascript
             *     new Popup({
             *         title        : 'Details',
             *         width        : '25em',
             *         centered     : true,
             *         modal        : true,
             *
             *         // Focus goes straight to OK button in the bottom toolbar on show
             *         defaultFocus : w => w.ref ==='okButton',
             *         items        : {
             *             nameField : {
             *                 type  : 'textfield',
             *                 label : 'Name'
             *             },
             *             ageField  : {
             *                 type  : 'numberfield',
             *                 label : 'Name'
             *             }
             *         },
             *         bbar     : {
             *             items : {
             *                 okButton : {
             *                     text    : 'OK',
             *                     handler : okFunction
             *                 },
             *                 cncelButton : {
             *                     text    : 'Cancel',
             *                     handler : cancelFunction
             *                 }
             *             }
             *         }
             *     }).show();
             * ```
             * @config {Function}
             */
            defaultFocus : null
        };
    }

    static get prototypeProperties() {
        return {
            // These classes have opinions about how fields should fill the space, so allow them to be replaced by the
            // less opinionated b-hbox/b-vbox classes when that is not desired. Using ":not(.b-toolbar-content)" in
            // the CSS does not scale now that FieldSet wants similar treatment... adding more ":not()"s is not only a
            // messy approach, it increases the selector specificity and causes interference with other selectors (e.g.
            // TimePicker's number field rules).
            flexRowCls : 'b-flex-row',
            flexColCls : 'b-flex-column',

            /**
             * @member {Boolean} initialItems
             * This property is `true` until the container's initial `items` config has been processed. This property
             * is set to `false` by the `updateItems` method.
             * @readonly
             * @internal
             */
            initialItems : true
        };
    }

    /**
     * The {@link Core.data.Model record} to be applied to the fields contained in this Container. Any descendant
     * widgets of this Container with a `name` property will have its value set to the value of that named property of
     * the record. If no record is passed, the widget has its value set to `null`.
     * @member {Core.data.Model} record
     */

    startConfigure(config) {
        // Set a flag so that code can test for presence of items.
        // Widgets which render child widgets outside of the Container scheme
        // can set this flag (eg Panels with tools and tbar).
        const items = config.items || config.lazyItems;

        if (!(this.hasItems = Boolean(items && (isArray(items) ? items : Object.keys(items)).length))) {
            this.initialItems = false;   // we won't be running updateItems, so clear this flag now
        }

        super.startConfigure(config);
    }

    /**
     * Returns the first widget in this Container.
     * @property {Core.widget.Widget}
     * @readonly
     */
    get firstItem() {
        return this.getAt(0);
    }

    /**
     * Returns the last widget in this Container.
     * @property {Core.widget.Widget}
     * @readonly
     */
    get lastItem() {
        return this.getAt(-1);
    }

    /**
     * Returns the widget at the specified `index` in this Container.
     * @param {Number} index The index of the widget to return. Negative numbers index for the last item. For example,
     * `index = -1` returns the last matching item, -2 the 2nd to last matching item etc..
     * @returns {Core.widget.Widget} The requested widget.
     */
    getAt(index) {
        return this.ensureItems().at(index);
    }

    /**
     * Removes the passed child/children from this Container.
     * @param  {...Core.widget.Widget} toRemove The child or children to remove.
     * @returns {Core.widget.Widget|Core.widget.Widget[]} All the removed items. An array if multiple items
     * were removed, otherwise, just the item removed.
     */
    remove(...toRemove) {
        let returnArray = true;

        if (toRemove.length === 1) {
            if (isArray(toRemove[0])) {
                toRemove = toRemove[0];
            }
            else {
                returnArray = false;
            }
        }

        const
            me         = this,
            { _items } = me,
            result     = [];

        for (let i = 0; i < toRemove.length; i++) {
            const childToRemove = toRemove[i];

            if (_items.includes(childToRemove)) {
                _items.remove(childToRemove);
                me.layout.removeChild(childToRemove);
                result.push(childToRemove);
                me.onChildRemove(childToRemove);
            }
        }

        return returnArray ? result : result[0];
    }

    /**
     * Removes all children from this Container.
     * @returns {Core.widget.Widget[]} All the removed items.
     */
    removeAll() {
        return this.remove(this.items);
    }

    /**
     * Appends the passed widget / widgets or config(s) describing widgets to this Container.
     *
     * If the widgets specify a `weight`, they are inserted at the correct index compared to the existing items weights.
     *
     * @param {Object|Object[]|Core.widget.Widget|Core.widget.Widget[]} toAdd The child or children instances (or config objects) to add.
     * @returns {Core.widget.Widget|Core.widget.Widget[]} All the added widgets. An array if multiple items
     * were added, otherwise just the item added.
     */
    add(...toAdd) {
        const
            me     = this,
            result = [];

        let items = me.ensureItems(),
            returnArray = true,
            childToAdd, i, index;

        if (toAdd.length === 1) {
            if (isArray(toAdd[0])) {
                toAdd = toAdd[0];
            }
            else {
                returnArray = false;
            }
        }

        for (i = 0; i < toAdd.length; i++) {
            childToAdd = toAdd[i];

            // Items with weight are inserted at correct index
            if (childToAdd?.weight != null) {
                // Cannot use cached items, weights might be unordered in set being added
                index = ArrayHelper.findInsertionIndex(childToAdd, items.values, sortByWeight);
                result.push(me.insert(childToAdd, index));
            }
            // Those without are appended
            else if (childToAdd) {
                if (childToAdd.isWidget) {
                    childToAdd.parent = me;
                }
                else {
                    childToAdd = me.createWidget(childToAdd);
                }

                if (!items.includes(childToAdd)) {
                    items.add(childToAdd);
                    me.onChildAdd(childToAdd);
                    me.layout.appendChild(childToAdd);
                    result.push(childToAdd);
                }
            }
        }

        return returnArray ? result : result[0];
    }

    ensureItems() {
        const me = this;

        me.getConfig('items');
        me.getConfig('lazyItems');

        // Force creation of our items Bag
        if (!me._items) {
            me.items = [];
        }

        return me._items;
    }

    /**
     * Inserts the passed widget into this Container at the specified position.
     * @param  {Core.widget.Widget} toAdd The child to insert.
     * @param {Number|Core.widget.Widget} index The index to insert at or the existing child to insert before.
     * @returns {Core.widget.Widget} The added widget.
     */
    insert(toAdd, index) {
        const
            me    = this,
            items = me.ensureItems();

        if (toAdd instanceof Widget) {
            toAdd.parent = me;
        }
        else {
            toAdd = me.createWidget(toAdd);
        }

        if (items.includes(index)) {
            index = me.indexOfChild(index);
        }

        index = Math.min(index, items.count);

        const newValues = items.values;
        newValues.splice(index, 0, toAdd);
        items.values = newValues;

        // Register inserted item
        me.onChildAdd(toAdd);

        me.layout.insertChild(toAdd, index);

        return toAdd;
    }

    indexOfChild(child) {
        return this.items.indexOf(child);
    }

    changeLazyItems(lazyItems) {
        this.items = lazyItems;
        this.layout.renderChildren();
    }

    changeItems(items, oldItems) {
        const
            me       = this,
            newItems = [],
            result   = new Bag();

        if (isArray(items)) {
            me.processItemsArray(items, newItems);
        }
        else if (items) {
            me.processItemsObject(items, me.namedItems, newItems);
        }

        // Allow child items to have a weight to establish their order
        if (newItems.some(returnWeight)) {
            newItems.sort(sortByWeight);
        }

        result.add(newItems);

        // Remove previous child payload if any
        if (oldItems) {
            oldItems.forEach(w => {
                me.remove(w);

                // Destroy outgoing-only widgets which we created.
                if (!result.includes(w) && w._createdBy === me) {
                    w.destroy();
                }
            });
        }

        return result;
    }

    afterConstruct() {
        const
            { rtl }       = this,
            { classList } = this.contentElement;

        // Content element must get class.
        // Panels and Toolbars use an inner element to arrange child items.
        classList.toggle('b-rtl', rtl === true);
        classList.toggle('b-ltr', rtl === false);
    }

    updateRtl(rtl) {
        super.updateRtl(rtl);

        const { contentElement } = this;

        // contentElement may not exist at config time. The afterConstruct handles it in those cases.
        if (contentElement) {
            // Content element must get class.
            // Panels and Toolbars use an inner element to arrange child items.
            contentElement.classList.toggle('b-rtl', rtl === true);
            contentElement.classList.toggle('b-ltr', rtl === false);
        }
    }
    
    updateItems(items, oldItems) {
        let index = 0;

        items.forEach(item => {  // no "index" argument from Bag
            this.onChildAdd(item);

            // If this is *change* to items from actual old items, when the old items is not a placeholder inserted
            // from very early items access
            if (oldItems && !oldItems.temporary) {
                this.layout.insertChild(item, index);
            }

            ++index;
        });

        this.initialItems = false;
    }

    updateHideWhenEmpty() {
        this.syncChildCount(this.rendered);
    }

    /**
     * A property, which, when *read*, returns an array of the child items of this container in rendered order.
     *
     * This property may also be *set* to change the child items of the container. Just as in the
     * {@link #config-items initial items configuration}, the new value may either be an array of
     * Widgets/Widget configs or an object.
     *
     * If specified as an Object, the property names are used as the child Widget's
     * {@link Core.widget.Widget#config-ref ref} name, and the value is the child Widget/Widget config.
     *
     * When setting this, any items which are *only* in the outgoing child items which were created
     * by this container from raw config objects are destroyed.
     *
     * Usage patterns:
     *
     * ```javascript
     * myContainer.items = {
     *     name : {
     *         type  : 'textfield',
     *         label : 'User name'
     *     },
     *     age : {
     *         type  : 'numberfield',
     *         label : 'User age'
     *     }
     * };
     * ```
     *
     * or
     *
     * ```javascript
     * myContainer.items = [{
     *     ref   : 'name',
     *     type  : 'textfield',
     *     label : 'User name'
     * },
     *     ref   : 'age',
     *     type  : 'numberfield',
     *     label : 'User age'
     * }];
     * ```
     * @property {Core.widget.Widget[]}
     * @accepts {Core.widget.Widget[]|Object}
     */
    get items() {
        const me = this;

        // If we are being asked for items, ingest lazyItems.
        me.getConfig('lazyItems');

        // The documented API for items is an Array.
        // Internal code should access _items
        if (!me._items) {
            // Currently initializing items, flag set by the config system
            if (me.initializingItems) {
                // This is a created array. User may mutate it.
                return [];
            }
            // Accessing items very early, not set up yet. Need a placeholder
            me._items = new Bag();
            me._items.temporary = true;
        }

        // This is the Collection's array. User may not mutate it.
        return me._items.values;
    }

    processItemsArray(items, result) {
        const len = items.length;

        let i, item;

        for (i = 0; i < len; i++) {
            item = items[i];

            if (item instanceof Widget) {
                item.parent = this;
                item.element.classList.remove(...Widget.outerCls);
            }
            else {
                item = this.createWidget(item);
            }

            // If the widget creation function returns null, nothing to add
            if (item) {
                if (item.ref || item.id) {
                    // Add early to widgetMap, to allow using 'up.widgetMap.ref' in later siblings configs
                    this.addDescendant(item);
                }

                result.push(item);
            }
        }
    }

    processItemsObject(items, namedItems, result) {
        let item, ref;

        for (ref in items) {
            item = items[ref];

            // It might come in as itemRef : false
            if (item) {
                // If this class or instance has a "namedItems" object
                // named by this ref, then use it as the basis for the item
                if (namedItems && ref in namedItems) {
                    item = typeof item === 'object' ? ObjectHelper.merge(ObjectHelper.clone(namedItems[ref]), item) : namedItems[ref];
                }

                // Allow namedItems to be overridden with itemKey : false to indicate unavailability of an item
                if (item) {
                    if (item instanceof Widget) {
                        item.parent = this;
                    }
                    else {

                        if (item instanceof Object) {
                            item.ref = ref;
                        }
                        item = this.createWidget(item);
                    }

                    // If the widget creation function returns null, nothing to add
                    if (item) {
                        item.ref = ref;

                        // Add early to widgetMap, to allow later siblings to use 'up.'
                        this.addDescendant(item);

                        result.push(item);
                    }
                }
            }
        }
    }

    onChildAdd(item) {
        // Don't just assign the property across since the default value is undefined
        // which means false. Only set to true if we are readOnly
        if (item.innerItem && this.readOnly) {
            item.readOnly = true;
        }

        this.onChildAddLayout(item);

        if (item.ref || item.id) {
            for (let current = this; current; current = current.parent) {
                // Silently add the descendant to the ancestor's widgetMap without kicking off
                // the ancestor's items processing by directly accessing the widgetMap property.
                current.addDescendant(item);
            }
        }

        this.syncChildCount(true);
    }

    onChildAddLayout(item) {
        // Set innerItem=false on an item that should not be managed by the layout...
        if (item.innerItem) {
            // Keep layout informed of child item state
            this.layout.onChildAdd(item);
        }
    }

    onChildHide(hidden) {
        super.onChildHide(hidden);

        // Only sync when it's a direct child, not just the "owner" link of a floater
        if (this._items?.includes(hidden)) {
            this.syncChildCount(true);
        }
    }

    onChildShow(shown) {
        super.onChildShow(shown);

        // Only sync when it's a direct child, not just the "owner" link of a floater
        if (this._items?.includes(shown)) {
            this.syncChildCount(true);
        }
    }

    syncChildCount(enforceHideWhenEmpty) {
        // If called during configuration, the element may not be available because
        // some non-item widgets (eg, Tools) instantiate and declare themselves through
        // onChildAdd before the element is set.
        // But also there may be no items because of     lazyItems.
        // So do the initial sync at render time.
        if (!this.isConfiguring) {
            const
                me                         = this,
                {
                    // This must be our direct child item payload, not all items owned by this Container.
                    // It's used to sync the b-first-visible-child/b-last-visible-child class presence.
                    items,
                    hasItems
                }                          = me,
                visibleItems               = items.filter(isNotHidden),
                { length : visibleLength } = visibleItems;

            /**
             * @member {Number} visibleChildCount The number of *visible* child items shown in this Container.
             * @readonly
             * @category Widget hierarchy
             */
            me.visibleChildCount = visibleLength;

            // Do not toggle visibility on render - we're just here to sync class names.
            // hiding and showing must only depend upon children being dynamically
            // hidden or shown.
            if (me.hideWhenEmpty && enforceHideWhenEmpty) {
                const shouldHide = Boolean(!visibleLength);

                if (Boolean(me._hidden) !== shouldHide) {
                    me.hidden = shouldHide;
                }
            }

            items.forEach(childItem => childItem.element.classList.remove('b-last-visible-child', 'b-first-visible-child'));

            if (visibleLength) {
                visibleItems[0].element.classList.add('b-first-visible-child');
                visibleItems[visibleLength - 1].element.classList.add('b-last-visible-child');
            }

            // Keep hasItems property up to date. It's used by the isFocusable getter.
            // Note that because this is to do with focusability, this includes all
            // possible items, not just contained items.
            me.hasItems = Boolean(me.childItems.length);

            me.contentElement.classList[visibleLength ? 'remove' : 'add']('b-no-visible-children');

            // Reevaluate whether we should have the b-text-content class
            if (!me.isComposable) {
                me.updateTextContent(me._textContent);
            }
            else if (hasItems !== me.hasItems) {
                me.recompose();
            }
        }
    }

    syncFlexDirection() {
        const
            me        = this,
            { contentElement, flexColCls, flexRowCls } = me,
            classList = new DomClassList(contentElement.className),
            styles    = DomHelper.getStyleValue(contentElement, stylesToCheck);

        // We might not be flexing at all anymore.
        classList[flexRowCls] = classList[flexColCls] = 0;

        // If we are, add a flag class to indicate direction
        if (styles.display === 'flex') {
            classList[styles['flex-direction'] === 'row' ? flexRowCls : flexColCls] = 1;
        }

        // Will only mutate the DOM if there are changes to apply.
        // We don't want to cause an infinite loop through our MutationObserver.
        DomHelper.syncClassList(contentElement, classList);
    }

    addDescendant(item) {
        const
            ref       = item.ref || item.id,
            widgetMap = this._widgetMap || (this._widgetMap = {});

        if (!widgetMap[ref]) {
            widgetMap[ref] = item;
        }
    }

    onChildRemove(item) {
        const ref = item.ref || item.id;

        if (ref) {
            for (let current = this; current; current = current.parent) {
                if (current.widgetMap[ref] === item) {
                    delete current.widgetMap[ref];
                }
            }
        }

        // Keep layout informed of child item state
        this.layout.onChildRemove(item);

        this.syncChildCount(true);
    }

    /**
     * An object which contains a map of descendant widgets keyed by their {@link Core.widget.Widget#config-ref}.
     * All descendant widgets will be available in the `widgetMap`.
     * @property {Object}
     * @readonly
     * @category Widget hierarchy
     */
    get widgetMap() {
        if (!this._widgetMap) {
            this._widgetMap = {};
        }

        // Force evaluation of the configured items by the getter
        // so that configs are promoted to widgets and the widgetMap
        // is created, and if there are widgets, populated.
        if (!this.initializingItems) {
            this.getConfig('items');
        }

        return this._widgetMap;
    }

    changeRecord(record) {
        // The config system's non-change vetoing must be bypassed.
        // The record might have changed, or the destination fields may be out of sync.
        this._record = record == null ? emptyObject : null;

        return record;
    }

    updateRecord(record) {
        const me = this;

        me.recordUpdateDetacher?.();

        /**
         * Fired before this container will load record values into its child fields. This is useful if you
         * want to modify the UI before data is loaded (e.g. set some input field to be readonly)
         * @event beforeSetRecord
         * @param {Core.widget.Container} source The container
         * @param {Core.data.Model} record The record
         */
        this.trigger('beforeSetRecord', { record });

        this.setValues(record, {
            onlyName  : true,
            highlight : Boolean(this.$highlight)
        });

        if (me.autoUpdateFields && record?.firstStore) {
            me.recordUpdateDetacher = record.firstStore.on({
                update  : me.onRecordUpdated,
                thisObj : me
            });
        }
    }

    setRecord(record, highlightChanges) {
        this.$highlight = highlightChanges;
        this.record     = record;
        this.$highlight = false;
    }

    onRecordUpdated({ record }) {
        if (record === this.record) {
            this.setValues(this.record, true, true);
        }
    }

    /**
     * A function called by descendant widgets after they trigger their 'change' event, in reaction to field changes.
     * By default implements the functionality for the `autoUpdateRecord` config.
     *
     * @param {Object} params Normally the event params used when triggering the 'change' event
     * @internal
     */
    onFieldChange({ source, userAction }) {
        // When configured with `autoUpdateRecord`, changes from descendant fields/widgets are applied to the loaded
        // record using the fields `name`. Only changes from valid fields will be applied
        if (this.autoUpdateRecord && userAction) {
            const
                { record }               = this,
                { name, isValid, value } = source;

            if (record && name && isValid) {
                record[name] = value;
            }
        }
    }

    getValues(filterFn) {
        const values = {};

        this.eachWidget((widget, control) => {
            // Do not drill down when reaching a container that isolates its fields
            if (widget.isolateFields) {
                control.down = false;
            }
            else if (('name' in widget) && (!filterFn || filterFn(widget))) {
                values[widget.name] = widget.value;
            }
        }, true);

        return values;
    }

    get hasNoChildren() {
        // If we have *uningested* lazyItems, use them to find our items length.
        // In that case we must not cause ingestion of the lazyItems by referencing this.items.
        // If we have items, then only those that are visible have any bearing.
        // Popup also has to consult this property to decide on its CSS classes.
        const
            me                   = this,
            { items, lazyItems } = me.initialConfig,
            itemsArray           = items && (isArray(items) ? items : ObjectHelper.values(items)),
            lazyItemsArray       = lazyItems && (isArray(lazyItems) ? lazyItems : ObjectHelper.values(lazyItems)),
            // avoid triggering items initialization
            whichItems           = me.isConfiguring ? lazyItemsArray || itemsArray : me.items;

        return !whichItems?.filter(isNotHidden).length;
    }

    afterRecompose() {
        super.afterRecompose();
        this.realign();
    }

    updateTextContent(textContent) {
        const me = this;

        // Add the text content class if we have no visible immediate item children.
        if (!me.isComposable) {
            me.contentElement.classList[textContent && me.hasNoChildren ? 'add' : 'remove']('b-text-content');

            // Depending on CSS settings around how this widget handles text content and widthing
            // we *may* have to realign. Realign only goes ahead if we're visible and floating.
            if (me.rendered) {
                me.realign();
            }
        }
    }

    updateLayoutStyle(layoutStyle) {
        DomHelper.applyStyle(this.contentElement, layoutStyle);
    }

    updateElement(element) {
        super.updateElement(...arguments);

        if (element) {
            const
                { classList }    = this.contentElement,
                { containerCls } = this.layout;

            // Ensure contentElement gets its full complement of class names upon element creation
            classList.add('b-content-element');

            if (containerCls) {
                classList.add(containerCls);
            }
        }
    }

    onPaint() {
        super.onPaint?.(...arguments);

        // Bring the lazy config into existence now that we have a layout.
        this.getConfig('contentElMutationObserver');
    }

    changeContentElMutationObserver(contentElMutationObserver, oldContentElMutationObserver) {
        if (oldContentElMutationObserver) {
            // Clear the queue. Any remaining notifications will be undeliverable.
            oldContentElMutationObserver.takeRecords();
            oldContentElMutationObserver.disconnect();
        }

        // We need to monitor our contentElement for attribute changes.
        // Changes to the inline style, or the classList/className will trigger this.
        // At that point we can sync our layout flag classes.
        if (contentElMutationObserver) {
            // NOTE: Do not hoist the vars, that will pull things in during destruction
            const
                me = this,
                {
                    element,
                    contentElement
                }  = me;

            contentElMutationObserver = new MutationObserver(mutations => me.onContentElMutation(mutations));
            contentElMutationObserver.observe(contentElement, { attributes : true });

            // If our contentElement is an inner element (eg Panel, Toolbar)
            // then styling might apply from classes on the outer element
            // so monitor that too.
            if (contentElement !== element) {
                contentElMutationObserver.observe(element, { attributes : true });
            }
            me.syncFlexDirection();
        }

        return contentElMutationObserver;
    }

    onContentElMutation() {
        // We can only do it if we are visible, otherwise the computed style won't work
        // and the classes will be removed. Doesn't need doing for card and fit layouts.
        if (boxLayouts[this.layout.type] && this.isVisible) {
            this.syncFlexDirection();
        }
    }

    changeLayout(config, existingLayout) {
        return Layout.reconfigure(existingLayout, config, {
            owner    : this,
            defaults : {
                owner : this
            }
        });
    }

    // Items to iterate over
    get childItems() {
        return this.items;
    }

    /**
     * Returns a directly contained widget by id
     * @param {String} id The widget id
     * @returns {Core.widget.Widget}
     */
    getWidgetById(id) {
        return this.widgetMap[id];
    }

    /**
     * This function is called prior to creating widgets, override it in subclasses to allow containers to modify the
     * configuration of each widget. When adding a widget to a container hierarchy each parent containers
     * `processWidgetConfig` will be called. Returning false from the function prevents the widget from being added at
     * all.
     */
    processWidgetConfig(widget) {

    }

    /**
     * This method combines container {@link #config-defaults}
     * @param {Object} widgetConfig
     * @param {String|Function} [type] The type of widget described by `widgetConfig`.
     * @returns {Object}
     * @internal
     */
    setupWidgetConfig(widgetConfig, type) {
        const me = this;

        // A string becomes the defaultType (see below) with the html set to the string.
        if (typeof widgetConfig === 'string') {
            widgetConfig = {
                html : widgetConfig
            };
        }
        // An element is encapsulated by a Widget
        else if (widgetConfig.nodeType === Element.ELEMENT_NODE) {
            widgetConfig = {
                element : widgetConfig,
                id      : widgetConfig.id
            };
        }

        if (typeof type === 'string' || !type && (type /* assignment */= widgetConfig.type)) {
            type = Widget.resolveType(type, true);
        }

        // widgetConfig = ObjectHelper.assign({}, me.defaults, widgetConfig, { parent : me });
        widgetConfig = (type || Widget).mergeConfigs(me.defaults, widgetConfig, { parent : me });

        for (let ancestor = widgetConfig.parent; ancestor; ancestor = ancestor.parent) {
            if (ancestor.processWidgetConfig(widgetConfig) === false) {
                return null;
            }
        }

        if (me.trigger('beforeWidgetCreate', { widgetConfig }) === false) {
            return null;
        }

        return widgetConfig;
    }

    /**
     * This function converts a Widget config object into a Widget.
     * @param {Object} widget A Widget config object.
     * @internal
     */
    createWidget(widget) {
        const result = Widget.create(this.setupWidgetConfig(widget), this.defaultType);

        // If we created a widget from a config object, then upon items replacement
        // we must destroy outgoing widgets.
        result && (result._createdBy = this);
        return result;
    }

    // Reapply defaults, not used during config
    updateDefaults(defaults, oldDefaults) {
        if (!this.isConfiguring && defaults) {
            const entries = Object.entries(defaults);

            this.eachWidget(widget => {
                entries.forEach(([prop, value]) => {
                    // Apply defaults only if current value matches the old default
                    if (!oldDefaults || widget[prop] === oldDefaults[prop]) {
                        widget[prop] = value;
                    }
                });
            }, false);
        }
    }

    render() {
        // Pull in lazyItems at last second
        this.getConfig('lazyItems');

        this.layout.renderChildren();

        // If called during configuration, the element may not have been available because
        // some non-item widgets (eg, Tools) instantiate and declare themselves through
        // onChildAdd before the element is set.
        // But also there may have been no items because of lazyItems.
        // So do the initial sync at render time.
        this.syncChildCount();

        super.render(...arguments);
    }

    get focusElement() {
        // Find first focusable descendant widget that is not our close tool.
        const firstFocusable = this.query(this.defaultFocus || (w => w.isFocusable && w.ref !== 'close'));

        if (firstFocusable) {
            return firstFocusable.focusElement;
        }
        return super.focusElement;
    }

    doDestroy() {
        this._items?.forEach(widget => widget.destroy?.());
        this.layout.destroy();
        super.doDestroy();
    }

    /**
     * Returns `true` if all contained fields are valid, otherwise `false`
     * @property {Boolean}
     */
    get isValid() {
        let valid = true;

        this.eachWidget(widget => {
            // Touch each widget so that they all update their invalid state. This is important for required fields
            // since they don't initially complain if they start as empty.
            if (widget.isVisible && 'isValid' in widget && !widget.isValid) {
                valid = false;
            }
        }, true);

        return valid;
    }

    /**
     * Retrieves or sets all values from/to contained widgets.
     *
     * The property set or read from a contained widget is its {@link Core.widget.Widget#config-defaultBindProperty}.
     *
     * This defaults to the `value` for fields.
     *
     * You may add child widgets which may accept and yield a value to/from another property,
     * such as a `Button` having its {@link Core.widget.Button#config-href} set.
     *
     * Accepts and returns a map, using {@link Core.widget.Field#config-name name},
     * {@link Core.widget.Widget#config-ref ref} or {@link Core.widget.Widget#config-id id} (in that order) as keys.
     *
     * ```javascript
     * const container = new Container({
     *     appendTo : document.body,
     *     items    : {
     *         firstName : {
     *             type : 'textfield
     *         },
     *         surName : {
     *             type : 'textfield
     *         }
     *         saveButton : {
     *             type                : 'button',
     *             text                : 'Save',
     *             defaultBindProperty : 'href'
     *             href                : '#'
     *         }
     *     }
     * });
     *
     * container.values = {
     *     firstName  : 'Clark',
     *     surname    : 'Kent',
     *     saveButton : '#save-route'
     * };
     * ```
     *
     * @property {Object}
     */
    get values() {
        const values = {};

        this.gatherValue(values);

        return values;
    }

    set values(values) {
        // if the container itself has a value allow it to be grabbed as well
        this.assignValue(values);
    }

    /**
     * Returns `true` if currently setting values. Allows fields change highlighting to distinguishing between initially
     * setting values and later on changing values.
     * @property {Boolean}
     */
    get isSettingValues() {
        return Boolean(this.assigningValues);
    }

    get assigningValues() {
        // Fields query their parent, pass the question up in case containers are nested
        return this._assigningValues || this.parent?.assigningValues;
    }

    set assigningValues(v) {
        this._assigningValues = v;
    }

    assignValue(values, options) {
        // use default check for a value config from super...
        super.assignValue(values, options);

        if (!this.isolateFields) {
            this.setValues(values, options);
        }
    }

    gatherValue(values) {
        super.gatherValue(values);

        if (!this.isolateFields) {
            this.gatherValues(values);
        }
    }

    setValues(values, options) {
        options = options || this.assignValueDefaults;

        // Flag checked by Field to determine if it should highlight change or not
        this.assigningValues = options;

        this.eachWidget(widget => widget.assignValue(values, options), false);

        this.assigningValues = false;

    }
}

// Register this widget type with its Factory
Container.initClass();
