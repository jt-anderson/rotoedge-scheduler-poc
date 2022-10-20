import ArrayHelper from './ArrayHelper.js';
import AsyncHelper from './AsyncHelper.js';
import BrowserHelper from './BrowserHelper.js';
import StringHelper from './StringHelper.js';
import Rectangle from './util/Rectangle.js';
import ObjectHelper from './ObjectHelper.js';
import DomClassList from './util/DomClassList.js';
import GlobalEvents from '../GlobalEvents.js';
import VersionHelper from './VersionHelper.js';
import EventHelper from './EventHelper.js';

// Point must be imported because it needs to inject itself into the Rectangle class
//import './util/Point.js';
// TODO import VersionHelper from './VersionHelper.js';

// https://app.assembla.com/spaces/bryntum/tickets/7903-rendering-fails
// HACK: this value is required to calculate width if it was configured relative to font size (em) but no element is set
const
    DEFAULT_FONT_SIZE = 14,
    t0t0              = { align : 't0-t0' },
    // eslint-disable-next-line no-undef
    ELEMENT_NODE      = Node.ELEMENT_NODE,
    // eslint-disable-next-line no-undef
    TEXT_NODE         = Node.TEXT_NODE,
    { isObject }      = ObjectHelper,

    // Transform matrix parse Regex. CSS transform computed style looks like this:
    // matrix(scaleX(), skewY(), skewX(), scaleY(), translateX(), translateY())
    // or
    // matrix3d(scaleX(), skewY(), 0, 0, skewX(), scaleY(), 0, 0, 0, 0, 1, 0, translateX(), translateY())
    // This is more reliable than using the style literal which may include
    // relative styles such as "translateX(-20em)", or not include the translation at all if it's from a CSS rule.
    // Use a const so as to only compile RexExp once
    // Extract repeating number regexp to simplify next expressions. Available values are: https://developer.mozilla.org/en-US/docs/Web/CSS/number
    numberRe            = /[+-]?\d*\.?\d+[eE]?-?\d*/g, // -2.4492935982947064e-16 should be supported
    numberReSrc         = numberRe.source,
    translateMatrix2dRe = new RegExp(`matrix\\((?:${numberReSrc}),\\s?(?:${numberReSrc}),\\s?(?:${numberReSrc}),\\s?(?:${numberReSrc}),\\s?(${numberReSrc}),\\s?(${numberReSrc})`),
    translateMatrix3dRe = new RegExp(`matrix3d\\((?:-?\\d*),\\s?(?:-?\\d*),\\s?(?:-?\\d*),\\s?(?:-?\\d*),\\s?(?:-?\\d*),\\s?(?:-?\\d*),\\s?(?:-?\\d*),\\s?(?:-?\\d*),\\s?(?:-?\\d*),\\s?(?:-?\\d*),\\s?(?:-?\\d*),\\s?(?:-?\\d*),\\s?(-?\\d*),\\s?(-?\\d*)`),
    translateMatrixRe   = new RegExp(`(?:${translateMatrix2dRe.source})|(?:${translateMatrix3dRe.source})`),
    pxTtranslateXRe     = new RegExp(`translate(3d|X)?\\((${numberReSrc})px(?:,\\s?(${numberReSrc})px)?`),
    pxTtranslateYRe     = new RegExp(`translate(3d|Y)?\\((${numberReSrc})px(?:,\\s?(${numberReSrc})px)?`),
    whiteSpaceRe        = /\s+/,
    semicolonRe         = /\s*;\s*/,
    colonRe             = /\s*:\s*/,
    digitsRe            = /^-?((\d+(\.\d*)?)|(\.?\d+))$/,
    elementPropKey      = '$bryntum',

    // A blank value means the expando name is the same as the key in this object, otherwise the key in this object is
    // the name of the domConfig property and the value is the name of the DOM element expando property.
    elementCreateExpandos = {
        elementData   : '',
        for           : 'htmlFor',
        retainElement : ''
    },

    // DomHelper#createElement properties which require special processing.
    // All other configs such as id and type are applied directly to the element.
    elementCreateProperties  = {
        // these two are handled by being in elementCreateExpands:
        // elementData  : 1,
        // for          : 1,
        tag          : 1,
        html         : 1,
        text         : 1,
        children     : 1,
        tooltip      : 1,
        style        : 1,
        dataset      : 1,
        parent       : 1,
        nextSibling  : 1,
        ns           : 1,
        reference    : 1,
        class        : 1,
        className    : 1,
        unmatched    : 1, // Used by syncId approach
        onlyChildren : 1, // Used by sync to not touch the target element itself,
        listeners    : 1,
        compareHtml  : 1, // Sync
        syncOptions  : 1, // Sync
        keepChildren : 1  // Sync
    },

    styleIgnoreProperties    = {
        length     : 1,
        parentRule : 1,
        style      : 1
    },

    nativeEditableTags = {
        INPUT    : 1,
        TEXTAREA : 1
    },
    nativeFocusableTags = {
        BUTTON   : 1,
        IFRAME   : 1,
        EMBED    : 1,
        INPUT    : 1,
        OBJECT   : 1,
        SELECT   : 1,
        TEXTAREA : 1,
        BODY     : 1
    },
    win              = globalThis,
    doc              = document,
    emptyObject      = Object.freeze({}),
    arraySlice       = Array.prototype.slice,
    immediatePromise = Promise.resolve(),
    fontProps        = [
        'font-size',
        'font-size-adjust',
        'font-style',
        'font-weight',
        'font-family',
        'font-kerning',
        'font-stretch',
        'line-height',
        'text-transform',
        'text-decoration',
        'letter-spacing',
        'word-break'
    ],
    isHiddenWidget = e => e._hidden,
    parentNode     = el => el.parentNode || el.host,
    mergeChildren  = (dest, src, options) => {
        if (options.key === 'children') {
            // Normally "children" is an array (for which we won't be here, due to isObject check in caller). To
            // maintain declarative order of children as an object, we need some special sauce:
            return ObjectHelper.mergeItems(dest, src, options);
        }

        return ObjectHelper.blend(dest, src, options);
    },
    isVisible = e => {
        const style = e.ownerDocument.defaultView.getComputedStyle(e);

        return style.getPropertyValue('display') !== 'none' && style.getPropertyValue('visibility') !== 'hidden';
    },
    getRootNode = doc.documentElement.getRootNode ? el => el.getRootNode() : el => {
        while (el.parentNode) el = el.parentNode;
        return el;
    },
    // Both Shadow Root Element and Anchor <a> Element have `host` property.
    // https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/host
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLHyperlinkElementUtils/host
    // Need make sure `host` is an Element.
    isShadowRoot = el => el.host && el.host instanceof Element,
    // Check whether the element has an offsetParent.
    // Nodes such as SVG which do not expose such a property must have an ancestor which has an offsetParent.
    // If position:fixed, there's no offsetParent, so continue to interrogate parentNode
    hasLayout = el => el && (el === doc.body || Boolean(el.offsetParent) || (('offsetParent' in el && DomHelper.getStyleValue(el, 'position') !== 'fixed') ? el.offsetParent : hasLayout(el.parentNode))),

    // Check for node being in document.
    // If part of shadow DOM, see if the root's host is in the DOM
    isInDocument             = el => el && (doc.body.contains(el) || ((root = getRootNode(el)) && isShadowRoot(root) && isInDocument(root.host))),
    elementOrConfigToElement = elementOrConfig => {
        if (elementOrConfig instanceof Node) {
            return elementOrConfig;
        }
        if (typeof elementOrConfig === 'string') {
            return DH.createElementFromTemplate(elementOrConfig);
        }
        return DH.createElement(elementOrConfig);
    },
    canonicalStyles = Object.create(null),
    canonicalizeStyle = (name, hasUnit) => {
        const entry = canonicalStyles[name] || [StringHelper.hyphenate(name), hasUnit];

        if (!canonicalStyles[name]) {
            canonicalStyles[entry[0]] = canonicalStyles[name] = entry;
        }

        return entry;
    },
    getOffsetParent = node => node.ownerSVGElement ? node.ownerSVGElement.parentNode : node.offsetParent,
    slideInAnimationName = /b-slide-in-from-\w+/;

export { hasLayout, isVisible, isInDocument };

// Push the styles that have units into the map:
[
    'top', 'right', 'bottom', 'left', 'width', 'height', 'maxWidth', 'maxHeight', 'minWidth', 'minHeight',
    'borderSpacing', 'borderWidth', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'fontSize', 'letterSpacing', 'lineHeight', 'outlineWidth', 'textIndent', 'wordSpacing'
].forEach(name => canonicalizeStyle(name, true));

// We only do the measurement once, if the value is null
let scrollBarWidth = null,
    idCounter      = 0,
    themeInfo      = null,
    root, templateElement, htmlParser, scrollBarMeasureElement;

/**
 * @module Core/helper/DomHelper
 */

/**
 * An object that describes a DOM element. Used for example by {@link #function-createElement-static createElement()}
 * and by {@link Core.helper.DomSync#function-sync-static DomSync.sync()}.
 *
 * ```javascript
 * DomHelper.createElement({
 *    class : {
 *        big   : true,
 *        small : false
 *    },
 *    children : [
 *        { tag : 'img', src : 'img.png' },
 *        { html : '<b style="color: red">Red text</b>' }
 *    ]
 * });
 * ```
 *
 * @typedef {Object} DomConfig
 * @property {String} [tag='div'] Tag name, for example 'span'
 * @property {HTMLElement} [parent] Parent element
 * @property {HTMLElement} [nextSibling] Element's next sibling in the parent element
 * @property {String|Object} [class] CSS classes, as a string or an object (truthy keys will be applied)
 * @property {String|Object} [className] Alias for `class`
 * @property {String|Object} [style] Style, as a string or an object (keys will be hyphenated)
 * @property {Object} [elementData] Data object stored as an expando on the resulting element
 * @property {Object} [dataset] Dataset applied to the resulting element
 * @property {DomConfig[]|Object|String[]|HTMLElement[]} [children] Child elements, as an array that can include
 * DomConfigs that will be turned into elements, plain strings that will be used as text nodes or existing elements that
 * will be moved. Also accepts an object map of DomConfigs, but please note that it cannot be used with
 * `DomHelper.createElement()`
 * @property {String} [html] Html string, used as the resulting elements `innerHTML`. Mutually exclusive with the `children` property
 * @property {Object} [tooltip] Tooltip config applied to the resulting element
 * @property {String} [text] Text content, XSS safe when you want to display text in the element. Mutually exclusive with the `children` property
 * @property {String} [id] Element's `id`
 * @property {String} [href] Element's `href`
 * @property {String} [ns] Element's namespace
 * @property {String} [src] Element's `src`
 */

/**
 * Helps with dom querying and manipulation.
 *
 * ```javascript
 * DomHelper.createElement({
 *   tag: 'div',
 *   className: 'parent',
 *   style: 'background: red',
 *   children: [
 *      { tag: 'div', className: 'child' },
 *      { tag: 'div', className: 'child' }
 *   ]
 * });
 * ```
 */
export default class DomHelper {

    /**
     * Animates the specified element to slide it into view within the visible viewport
     * of its parentElement from the direction of movement.
     *
     * So in a left-to-right Widget, `direction` 1 means it slides in from the right
     * and `direction` -1 means it slides in from the left. RTL reverses the movement.
     *
     * See the forward/backward navigations in {@link Core.widget.DatePicker} for an example
     * of this in action.
     *
     * If "next" should arrive from below and "previous" should arrive from above, add the
     * class `b-slide-vertical` to the element.
     * @param {HTMLElement} element The element to slide in.
     * @param {Number} direction
     * * `1` to slide in from the "next" direction.
     * * `-1` to slide in from the "previous" direction.
     *
     * If the element is inside an RTL widget the directions are reversed.
     * @async
     */
    static async slideIn(element, direction = 1) {
        const
            cls           = `b-slide-in-${direction > 0 ? 'next' : 'previous'}`,
            { classList } = element,
            { style }     = element.parentNode,
            { overflow }  = style;

        style.overflow = 'hidden';
        classList.add(cls);
        await EventHelper.waitForTransitionEnd({
            element,
            animationName : slideInAnimationName
        });
        style.overflow = overflow;
        classList.remove(cls);
    }

    /**
     * Returns `true` if the passed element is focusable either programmatically or through pointer gestures.
     * @param {HTMLElement} element The element to test.
     * @returns {Boolean} Returns `true` if the passed element is focusable
     */
    static isFocusable(element, skipAccessibilityCheck = false) {
        if (!skipAccessibilityCheck) {
            // If element is hidden or in a hidden Widget, it's not focusable.
            if (!DH.isVisible(element) || DH.Widget.fromElement(element, isHiddenWidget)) {
                return false;
            }
        }

        const nodeName = element.nodeName;

        /*
         * An element is focusable if:
         *   - It is natively focusable, or
         *   - It is an anchor or link with href attribute, or
         *   - It has a tabIndex, or
         *   - It is an editing host (contenteditable="true")
         */
        return nativeFocusableTags[nodeName] ||
            ((nodeName === 'A' || nodeName === 'LINK') && !!element.href) ||
            element.getAttribute('tabIndex') != null ||
            element.contentEditable === 'true';
    }

    /**
     * Returns `true` if the passed element accepts keystrokes to edit its contents.
     * @returns {Boolean} Returns `true` if the passed element is editable.
     */
    static isEditable(element) {
        return element.isContentEditable || nativeEditableTags[element.nodeName];
    }

    /**
     * Returns the rectangle of the element which is currently visible in the browser viewport, i.e. user can find it on
     * screen, or `false` if it is scrolled out of view.
     * @param {HTMLElement} target The element to test.
     * @param {Boolean} [whole=false] Whether to check that whole element is visible, not just part of it.
     * If this is passed as true, the result will be a boolean, `true` or `false`.
     * @privateparam {Core.widget.Widget} [caller] the Widget aligning to the target.
     * @returns {Core.helper.util.Rectangle|Boolean} Returns the rectangle of the element which is currently visible in
     * the browser viewport, or `false` if it is out of view.
     */
    static isInView(target, whole = false, caller) {
        // If the target cannot yield a Rectangle, shortcut all processing.
        if (!hasLayout(target)) {
            return false;
        }

        const
            positioned        = caller?.positioned && DomHelper.getStyleValue(caller.element, 'position') !== 'fixed',
            docRect           = Rectangle.from(globalThis),
            method            = whole ? 'contains' : 'intersect',
            cOp               = positioned && caller.element.offsetParent,
            cOpR              = positioned && Rectangle.from(cOp);

        // If we get to the top, the visible rectangle is the entire document.
        docRect.height = doc.scrollingElement.scrollHeight;

        // If they asked to test the body, it's always in view
        if (target === doc.body) {
            return docRect;
        }

        const result = this.getViewportIntersection(target, docRect, method);

        // We must use the *viewport* coordinate system to ascertain viewability
        if (result && positioned) {
            result.translate(doc.scrollingElement.scrollLeft, doc.scrollingElement.scrollTop);
        }

        // Return any rectangle to its positioned coordinate system
        return positioned && result ? result.translate(-cOpR.x + cOp.scrollLeft, -cOpR.y + cOp.scrollTop) : result;
    }

    /**
     * This method goes up the DOM tree checking that all ancestors are visible in the viewport
     * @param {HTMLElement} target Starting html element
     * @param {Core.helper.util.Rectangle} docRect Window rectangle
     * @param {String} method 'contains' or 'intersect'
     * @returns {Core.helper.util.Rectangle}
     */
    static getViewportIntersection(target, docRect, method) {
        const
            { parentNode }    = target,
            { parentElement } = (parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? target.getRootNode().host : target),
            peStyle           = parentElement.ownerDocument.defaultView.getComputedStyle(parentElement),
            parentScroll      = peStyle.overflowX !== 'visible' || peStyle.overflowY !== 'visible',
            offsetParent      = getOffsetParent(target);

        let result = Rectangle.from(target, null, true);

        for (let viewport = parentScroll ? target.parentNode : offsetParent; result && viewport !== doc.documentElement; viewport = viewport.parentNode) {
            // Skip shadow root node.
            if (viewport.nodeType === Node.DOCUMENT_FRAGMENT_NODE && viewport.host) {
                viewport = viewport.host.parentNode;
            }

            const
                isTop        = viewport === doc.body,
                style        = viewport.ownerDocument.defaultView.getComputedStyle(viewport),
                viewportRect = isTop ? docRect : Rectangle.inner(viewport, null, true);

            // If this level allows overflow to show, don't clip. Obv, <body> can't show overflowing els.
            if (isTop || style.overflow !== 'visible') {
                result = viewportRect[method](result, false, true);
            }
        }
        return result;
    }

    /**
     * Returns `true` if the passed element is deeply visible. Meaning it is not hidden using `display`
     * or `visibility` and no ancestor node is hidden.
     * @param {HTMLElement} element The element to test.
     * @returns {Boolean} `true` if deeply visible.
     */
    static isVisible(element) {
        const document = element.ownerDocument;

        // Use the parentNode function so that we can traverse upwards through shadow DOM
        // to correctly ascertain visibility of nodes in web components.
        for (; element; element = parentNode(element)) {
            // Visible if we've reached top of the owning document without finding a hidden Element.
            if (element === document) {
                return true;
            }
            // Must not evaluate a shadow DOM's root fragment.
            if (element.nodeType === element.ELEMENT_NODE && !isVisible(element)) {
                return false;
            }
        }

        // We get here if the node is detached.
        return false;
    }

    /**
     * Returns true if DOM Event instance is passed. It is handy to override to support Locker Service.
     * @param event
     * @internal
     * @returns {Boolean}
     */
    static isDOMEvent(event) {
        return event instanceof Event;
    }

    /**
     * Merges specified source DOM config objects into a `dest` object.
     * @param {Object} dest The destination DOM config object.
     * @param {...Object} sources The DOM config objects to merge into `dest`.
     * @returns {Object} The `dest` object.
     * @internal
     */
    static merge(dest, ...sources) {
        return ObjectHelper.blend(dest, sources, { merge : mergeChildren });
    }

    /**
     * Updates in-place a DOM config object whose `children` property may be an object instead of the typical array.
     * The keys of such objects become the `reference` property upon conversion.
     *
     * @param {DomConfig} domConfig
     * @param {Function} [namedChildren] A function to call for each named child element.
     * @privateparam {Boolean} [ignoreRefs] Not meant to be manually set, used when recursing.
     * @returns {Object} Returns the altered DOM config
     * @internal
     */
    static normalizeChildren(domConfig, namedChildren, ignoreRefs) {
        let children = domConfig?.children,
            child, i, name, kids, ref;

        // Allow redirecting/opting out of ref ownership in a hierarchy
        if (domConfig?.syncOptions?.ignoreRefs) {
            ignoreRefs = true;
        }

        if (children && !(domConfig instanceof Node)) {
            if (Array.isArray(children)) {
                for (i = 0; i < children.length; ++i) {
                    DH.normalizeChildren(children[i], namedChildren, ignoreRefs);
                }
            }
            else {
                kids = children;

                domConfig.children = children = [];

                for (name in kids) {
                    child = kids[name];

                    if (child?.isWidget) {
                        child = child.element;
                    }

                    // $ prefix indicates element is not a reference:
                    ref = !name.startsWith('$') && !DH.isElement(child);

                    ref && namedChildren?.(name, /* hoist = */!ignoreRefs);

                    if (child) {
                        if (!(child instanceof Node)) {
                            if (child.reference === false) {
                                delete child.reference;
                            }
                            else if (ref && typeof child !== 'string') {
                                child.reference = name;
                            }

                            DH.normalizeChildren(child, namedChildren, ignoreRefs);
                        }

                        children.push(child);
                    }
                }
            }
        }

        return domConfig;
    }

    static roundPx(px, devicePixelRatio = globalThis.devicePixelRatio || 1) {
        const
            multiplier = 1 / devicePixelRatio;
        return Math.round(px / multiplier) * multiplier;
    }

    /**
     * Returns true if element has opened shadow root
     * @param {HTMLElement} element Element to check
     * @returns {Boolean}
     */
    static isCustomElement(element) {
        return Boolean(element?.shadowRoot);
    }

    /**
     * Resolves element from point, checking shadow DOM if required
     * @param {Number} x
     * @param {Number} y
     * @returns {HTMLElement}
     */
    static elementFromPoint(x, y) {
        let el = document.elementFromPoint(x, y);

        // Try to check shadow dom if it exists
        if (DH.isCustomElement(el)) {
            el = el.shadowRoot.elementFromPoint(x, y) || el;
        }

        return el;
    }

    /**
     * Resolves child element from point __in the passed element's coordinate space__.
     * @param {HTMLElement} parent The element to find the occupying element in.
     * @param {Number|Core.helper.util.Point} x Either the `X` part of a point, or the point to find.
     * @param {Number} [y] The `Y` part of the point.
     * @returns {HTMLElement}
     * @internal
     */
    static childFromPoint(el, x, y, /* internal */ parent = el) {
        const p = y == null ? x : new Rectangle(x, y, 0, 0);

        let result = null;

        Array.from(el.children).some(el => {
            if (Rectangle.from(el, parent).contains(p)) {
                // All rectangles must be relative to the topmost el, so that must be
                // passed down as the "parent" of all Rectangles.
                result = (el.children.length) && DH.childFromPoint(el, p, null, parent) || el;
                return true;
            }
        });

        return result;
    }

    /**
     * Converts a name/value pair of a style name and its value into the canonical (hyphenated) name of the style
     * property and a value with the `defaultUnit` suffix appended if no unit is already present in the `value`.
     *
     * For example:
     * ```javascript
     *  const [property, value] = DomHelper.unitize('marginLeft', 50);
     *  console.log(property, value);
     * ```
     *
     * ```
     *  > margin-left 50px
     * ```
     * @param {String} name
     * @param {String|Number} value
     * @param {String} [defaultUnit]
     * @returns {String[]}
     * @internal
     */
    static unitize(name, value, defaultUnit = 'px') {
        const [trueName, hasUnits] = canonicalizeStyle(name);

        if (value != null) {
            value = String(value);
            value = (hasUnits && digitsRe.test(value)) ? value + defaultUnit : value;
        }

        return [trueName, value];
    }

    /**
     * Returns active element checking shadow dom too
     * @readonly
     * @property {HTMLElement}
     */
    static get activeElement() {


        let el = document.activeElement;

        while (el.shadowRoot) {
            el = el.shadowRoot.activeElement;
        }

        return el;
    }

    // returns active element for DOM tree / shadow DOM tree to which element belongs
    static getActiveElement(element) {
        if (element?.isWidget) {
            element = element.element;
        }

        // If no element passed, fallback to document
        let el = (element?.getRootNode() || document).activeElement;

        while (el?.shadowRoot) {
            el = el.shadowRoot.activeElement;
        }

        return el;
    }

    // Returns the visible root (either document.body or a web component shadow root)
    static getRootElement(element) {
        const root = element.getRootNode?.();

        return root?.body || root || element.ownerDocument.body;
    }

    // Returns the topmost HTMLElement inside the current context (either document.body or a direct child of a web component shadow root)
    static getOutermostElement(element) {
        const root = element.getRootNode?.();

        if (root?.body) {
            return root?.body;
        }

        // we are in a shadow root
        // parentNode might be null in salesforce
        while (element.parentNode !== root && element.parentNode) {
            element = element.parentNode;
        }

        return element;
    }

    static isValidFloatRootParent(target) {
        return target === document.body || target.constructor.name === 'ShadowRoot';
    }

    /**
     * Returns the `id` of the passed element. Generates a unique `id` if the element does not have one.
     * @param {HTMLElement} element The element to return the `id` of.
     */
    static getId(element) {
        return element.id || (element.id = 'b-element-' + (++idCounter));
    }

    /**
     * Returns common widget/node ancestor for from/to arguments
     * @param {Core.widget.Widget|HTMLElement} from
     * @param {Core.widget.Widget|HTMLElement} to
     * @returns {Core.widget.Widget|HTMLElement}
     * @internal
     */
    static getCommonAncestor(from, to) {
        if (from === to) {
            return from;
        }

        while (from && !(from[from.isWidget ? 'owns' : 'contains']?.(to) || from === to)) {
            from = from.owner || from.parentNode;
        }

        return from;
    }

    //region Internal

    /**
     * Internal convenience fn to allow specifying either an element or a CSS selector to retrieve one
     * @private
     * @param {String|HTMLElement} elementOrSelector element or selector to lookup in DOM
     * @returns {HTMLElement}
     */
    static getElement(elementOrSelector) {
        // also used for SVG elements, so need to use more basic class, that is also returned by querySelector
        if (elementOrSelector instanceof Element) {
            return elementOrSelector;
        }

        return doc.querySelector(elementOrSelector);
    }

    /**
     * Sets attributes passed as object to given element
     * @param {String|Element} elementOrSelector
     * @param {Object} attributes
     * @internal
     */
    static setAttributes(elementOrSelector, attributes) {
        const element = DH.getElement(elementOrSelector);

        if (element && attributes) {
            for (const key in attributes) {
                if (attributes[key] == null) {
                    element.removeAttribute(key);
                }
                else {
                    element.setAttribute(key, attributes[key]);
                }
            }
        }
    }

    /**
     * Sets a CSS [length](https://developer.mozilla.org/en-US/docs/Web/CSS/length) style value.
     * @param {String|HTMLElement} element The element to set the style in, or, if just the result is required,
     * the style magnitude to return with units added. If a nullish value is passed, an empty string
     * is returned.
     * @param {String} [style] The name of a style property which specifies a [length](https://developer.mozilla.org/en-US/docs/Web/CSS/length)
     * @param {Number|String} [value] The magnitude. If a number is used, the value will be set in `px` units.
     * @returns {String} The style value string.
     */
    static setLength(element, style, value) {
        if (arguments.length === 1) {
            value = typeof element === 'number' ? `${element}px` : element ?? '';
        }
        else {
            element = DH.getElement(element);
            value = element.style[style] = typeof value === 'number' ? `${value}px` : value ?? '';
        }

        return value;
    }

    /**
     * Returns string percentified and rounded value for setting element's height, width etc.
     * @param {String|Number} value percent value
     * @param {Number} digits number of decimal digits for rounding
     * @returns {string} percentified value or empty string if value can not be parsed
     * @internal
     */
    static percentify(value, digits = 2) {
        const mult = Math.pow(10, digits);
        return value == null || value === '' || isNaN(value) ? '' : `${Math.round(value * mult) / mult}%`;
    }

    //endregion

    //region Children, going down...

    /**
     * Gets the first direct child of `element` that matches `selector`.
     * @param {HTMLElement} element Parent element
     * @param {String} selector CSS selector
     * @returns {HTMLElement}
     * @category Query children
     */
    static getChild(element, selector) {
        return element.querySelector(':scope>' + selector);
    }

    /**
     * Checks if `element` has any child that matches `selector`.
     * @param {HTMLElement} element Parent element
     * @param {String} selector CSS selector
     * @returns {Boolean} true if any child matches selector
     * @category Query children
     */
    static hasChild(element, selector) {
        return DH.getChild(element, selector) != null;
    }

    /**
     * Returns all child elements (not necessarily direct children) that matches `selector`.
     *
     * If `selector` starts with `'>'` or `'# '`, then all components of the `selector` must match inside of `element`.
     * The scope selector, `:scope` is prepended to the selector (and if `#` was used, it is removed).
     *
     * These are equivalent:
     *
     *      DomHelper.children(el, '# .foo .bar');
     *
     *      el.querySelectorAll(':scope .foo .bar');
     *
     * These are also equivalent:
     *
     *      DomHelper.children(el, '> .foo .bar');
     *
     *      el.querySelectorAll(':scope > .foo .bar');
     *
     * @param {HTMLElement} element The parent element
     * @param {String} selector The CSS selector
     * @returns {HTMLElement[]} Matched elements, somewhere below `element`
     * @category Query children
     */
    static children(element, selector) {
        // a '#' could be '#id' but '# ' (hash and space) is not a valid selector...
        if (selector[0] === '>' || selector.startsWith('# ')) {
            if (selector[0] === '#') {
                selector = selector.substr(2);
            }

            selector = ':scope ' + selector;
        }

        return Array.from(element.querySelectorAll(selector));
    }

    // Salesforce doesn't yet support childElementCount. So we relace all native usages with this wrapper and
    // override it for salesforce environment.
    // https://github.com/bryntum/support/issues/3008
    static getChildElementCount(element) {
        return element.childElementCount;
    }

    /**
     * Looks at the specified `element` and all of its children for the one that first matches `selector.
     * @param {HTMLElement} element Parent element
     * @param {String} selector CSS selector
     * @returns {HTMLElement} Matched element, either element or an element below it
     * @category Query children
     */
    static down(element, selector) {
        if (!element) {
            return null;
        }

        if (element.matches && element.matches(selector)) {
            return element;
        }
        selector = ':scope ' + selector;
        return element.querySelector(selector);
    }

    /**
     * Checks if childElement is a descendant of parentElement (contained in it or a sub element)
     * @param {HTMLElement} parentElement Parent element
     * @param {HTMLElement} childElement Child element, at any level below parent (includes nested shadow roots)
     * @returns {Boolean}
     * @category Query children
     */
    static isDescendant(parentElement, childElement) {
        const
            parentRoot = DH.getRootElement(parentElement),
            childRoot = DH.getRootElement(childElement);

        if (parentRoot !== childRoot && childRoot.host) {
            return DH.isDescendant(parentRoot, childRoot.host);
        }
        return parentElement.contains(childElement);
    }

    /**
     * Returns the specified element of the given `event`. If the `event` is an `Element`, it is returned. Otherwise,
     * the `eventName` argument is used to retrieve the desired element property from `event` (this defaults to the
     * `'target'` property).
     * @param {Event|Element} event
     * @param {String} [elementName]
     * @returns {Element}
     */
    static getEventElement(event, elementName = 'target') {
        return (!event || DH.isElement(event)) ? event : event[elementName];
    }

    /**
     * Returns `true` if the provided value is _likely_ a DOM element. If the element can be assured to be from the
     * same document, `instanceof Element` is more reliable.
     * @param {*} value
     * @returns {Boolean}
     */
    static isElement(value) {
        return value?.nodeType === document.ELEMENT_NODE && DH.isNode(value);
    }

    /**
     * Returns `true` if the provided value is _likely_ a DOM node. If the node can be assured to be from the same
     * document, `instanceof Node` is more reliable.
     * @param {*} value
     * @returns {Boolean}
     */
    static isNode(value) {
        // cannot use instanceof across frames. Using it here won't help since we'd need the same logic if it were
        // false... meaning we'd have the same chances of a false-positive.
        return Boolean(value) && typeof value.nodeType === 'number' && !isObject(value);
    }

    /**
     * Iterates over each result returned from `element.querySelectorAll(selector)`. First turns it into an array to
     * work in IE. Can also be called with only two arguments, in which case the first argument is used as selector and
     * document is used as the element.
     * @param {HTMLElement} element Parent element
     * @param {String} selector CSS selector
     * @param {Function} fn Function called for each found element
     * @category Query children
     */
    static forEachSelector(element, selector, fn) {
        if (typeof element === 'string') {
            // Legacy internal API, no longer valid
            throw new Error('DomHelper.forEachSelector must provide a root element context (for shadow root scenario)');
        }
        DH.children(element, selector).forEach(fn);
    }

    /**
     * Iterates over the direct child elements of the specified element. First turns it into an array to
     * work in IE.
     * @param {HTMLElement} element Parent element
     * @param {Function} fn Function called for each child element
     * @category Query children
     */
    static forEachChild(element, fn) {
        Array.from(element.children).forEach(fn);
    }

    /**
     * Removes each element returned from `element.querySelectorAll(selector)`.
     * @param {HTMLElement} element
     * @param {String} selector
     * @category Query children
     */
    static removeEachSelector(element, selector) {
        DH.forEachSelector(element, selector, child => child.remove());
    }

    static removeClsGlobally(element, ...classes) {
        classes.forEach(cls => DH.forEachSelector(element, '.' + cls, child => child.classList.remove(cls)));
    }

    //endregion

    //region Parents, going up...

    static isOrphaned(element) {
        return !isInDocument(element);
    }

    /**
     * Looks at the specified element and all of its parents for the one that first matches selector.
     * @param {HTMLElement} element Element
     * @param {String} selector CSS selector
     * @returns {HTMLElement} Matched element, either the passed in element or an element above it
     * @category Query parents
     */
    static up(element, selector) {
        return element && element.closest(selector);
    }

    static getAncestor(element, possibleAncestorParents, outerElement = null) {
        let found  = false,
            ancestor,
            parent = element;

        possibleAncestorParents = ArrayHelper.asArray(possibleAncestorParents);

        while ((parent = parent.parentElement)) {
            if (possibleAncestorParents.includes(parent)) {
                found = true;
                break;
            }
            if (outerElement && parent === outerElement) break;
            ancestor = parent;
        }

        if (!found) return null;
        return ancestor || element;
    }

    /**
     * Retrieves all parents to the specified element.
     * @param {HTMLElement} element Element
     * @returns {HTMLElement[]} All parent elements, bottom up
     * @category Query parents
     */
    static getParents(element) {
        const parents = [];

        while (element.parentElement) {
            parents.push(element.parentElement);
            element = element.parentElement;
        }

        return parents;
    }

    //endregion

    //region Creation

    /**
     * Converts the passed id to an id valid for usage as id on a DOM element.
     * @param {String} id
     * @returns {String}
     */
    static makeValidId(id, replaceValue = '') {
        return StringHelper.makeValidDomId(id, replaceValue);
    }

    /**
     * Creates an Element, accepts a {@link #typedef-DomConfig} object. Example usage:
     *
     * ```javascript
     * DomHelper.createElement({
     *   tag         : 'table', // defaults to 'div'
     *   className   : 'nacho',
     *   html        : 'I am a nacho',
     *   children    : [ { tag: 'tr', ... }, myDomElement ],
     *   parent      : myExistingElement // Or its id
     *   style       : 'font-weight: bold;color: red',
     *   dataset     : { index: 0, size: 10 },
     *   tooltip     : 'Yay!',
     *   ns          : 'http://www.w3.org/1999/xhtml'
     * });
     * ```
     *
     * @param {DomConfig} config Element config object
     * @param {Object} [options] An object specifying creation options. If this is a boolean value, it is
     * understood to be the `returnAll` option.
     * @param {Boolean} [options.ignoreRefs] Pass `true` to ignore element references.
     * @param {Boolean} [options.returnAll] Specify true to return all elements & child elements
     * created as an array.
     * @returns {HTMLElement|HTMLElement[]|Object} Single element or array of elements `returnAll` was set to true.
     * If any elements had a `reference` property, this will be an object containing a reference to
     * all those elements, keyed by the reference name.
     * @category Creation
     */
    static createElement(config = {}, options) {
        let returnAll = options,
            element, i, ignoreChildRefs, ignoreRefOption, ignoreRefs, key, name, value, refOwner, refs, syncIdField;

        if (typeof returnAll === 'boolean') {
            throw new Error('Clean up');
        }
        else if (options) {
            ignoreRefs = options.ignoreRefs;
            refOwner = options.refOwner;
            refs = options.refs;
            returnAll = options.returnAll;
            syncIdField = options.syncIdField;

            if (ignoreRefs) {
                ignoreChildRefs = true;
                ignoreRefs = ignoreRefs !== 'children';
            }
        }

        if (typeof config.parent === 'string') {
            config.parent = document.getElementById(config.parent);
        }

        // nextSibling implies a parent
        const
            parent = config.parent || (config.nextSibling && config.nextSibling.parentNode),
            { dataset, html, reference, syncOptions, text } = config;

        if (syncOptions) {
            syncIdField = syncOptions.syncIdField || syncIdField;
            ignoreRefOption = syncOptions.ignoreRefs;

            if (ignoreRefOption) {
                ignoreChildRefs = true;
                ignoreRefs = ignoreRefOption !== 'children';

                options = {
                    ...options,
                    ignoreRefs : true
                };
            }
        }

        if (ignoreRefs) {
            refOwner = null;
        }

        if (config.ns) {
            element = doc.createElementNS(config.ns, config.tag || 'svg');
        }
        else {
            element = doc.createElement(config.tag || 'div');
        }

        if (text != null) {
            DH.setInnerText(element, text);
        }
        else if (html != null) {
            if (html instanceof DocumentFragment) {
                element.appendChild(html);
            }
            else {
                element.innerHTML = html;
            }
        }

        if (config.tooltip) {
            DH.Widget.attachTooltip(element, config.tooltip);
        }

        if (config.style) {
            DH.applyStyle(element, config.style);
        }

        if (dataset) {
            for (name in dataset) {
                value = dataset[name];

                if (value != null) {
                    element.dataset[name] = value;
                }
            }
        }

        if (parent) {
            this.addChild(parent, element, config.nextSibling);
        }

        if (refOwner) {
            // Tag each element created by the refOwner's id to enable DomSync
            element.$refOwnerId = refOwner.id;
        }

        if (reference && !ignoreRefs) {
            // SalesForce platform does not allow custom attributes, but existing code
            // uses querySelector('[reference]'), so bypass it when we can:
            if (refOwner) {
                element.$reference = reference;

                refOwner.attachRef(reference, element, config);
            }
            else {
                // TODO fixup callers to do the above
                if (!refs) {
                    options = Object.assign({}, options);
                    options.refs = refs = {};
                }

                refs[reference] = element;
                element.setAttribute('data-reference', reference);
            }
        }

        const
            className = config.className || config.class, // matches DomSync
            keys = Object.keys(config);

        if (className) {
            element.setAttribute('class', DomClassList.normalize(className));
        }

        for (i = 0; i < keys.length; ++i) {
            name = keys[i];
            value = config[name];

            // We have to use setAttribute() for custom attributes to work and this is inline with how DomSync
            // handles attributes. For "expando" properties, however, we have to simply assign them.
            if ((key = elementCreateExpandos[name]) != null) {
                element[key || name] = value;
            }
            else if (!elementCreateProperties[name] && name && value != null) {
                // if (config.ns) {
                //     element.setAttributeNS(config.ns, name, value);
                // }
                // else {
                //     element.setAttribute(name, value);
                // }
                element.setAttribute(name, value);
            }
        }

        // ARIA. In the absence of a defined role or the elememnt being hidden from ARIA,
        // omit unfocusable elements from the accessibility tree.
        if (!config['aria-hidden'] && !config.role && !DomHelper.isFocusable(element, true) && !element.htmlFor) {
            element.setAttribute('role', 'presentation');
        }

        // Mimic the way DomSync issues callbacks as elements are created (needed by TaskBoard to trigger custom
        // taskRenderer calls as elements get produced).
        options?.callback?.({
            action        : 'newElement',
            domConfig     : config,
            targetElement : element,
            syncId        : refOwner ? reference : (options.syncIdField && config.dataset?.[options.syncIdField])
        });

        // if returnAll is true, use array
        if (returnAll === true) {
            options.returnAll = returnAll = [element];
        }
        // if it already is an array, add to it (we are probably a child)
        else if (Array.isArray(returnAll)) {
            returnAll.push(element);
        }

        if (config.children) {
            if (syncIdField) {
                // Map syncId -> child element to avoid querying dom later on
                element.syncIdMap = {};
            }

            config.children.forEach(child => {
                // Skip null children, convenient to allow those for usage with Array.map()
                if (child) {
                    // Append string children as text nodes
                    if (typeof child === 'string') {
                        const textNode = document.createTextNode(child);

                        if (refOwner) {
                            textNode.$refOwnerId = refOwner.id;
                        }

                        element.appendChild(textNode);
                    }
                    // Just append Elements directly.
                    else if (isNaN(child.nodeType)) {
                        child.parent = element;

                        if (!child.ns && config.ns) {
                            child.ns = config.ns;
                        }

                        const
                            childElement = DH.createElement(child, {
                                ...options,
                                ignoreRefs : config.syncOptions?.ignoreRef ?? ignoreChildRefs
                            }),
                            syncId = child.dataset?.[syncIdField];

                        // syncId is used with DomHelper.sync to match elements. Populate a map here to make finding them faster
                        if (syncId != null) {
                            element.syncIdMap[syncId] = childElement;
                        }

                        // Do not want to alter the initial config
                        delete child.parent;
                    }
                    else {
                        element.appendChild(child);
                    }
                }
            });
        }

        // Store used config, to be able to compare on sync to determine if changed without hitting dom
        element.lastDomConfig = config;

        // If references were used, return them in an object
        // If returnAll was specified, return the array
        // By default, return the root element
        return refs || returnAll || element;
    }

    /**
     * Create element(s) from a template (html string). Note that
     * `textNode`s are discarded unless the `raw` option is passed
     * as `true`.
     *
     * If the template has a single root element, then the single element will be returned
     * unless the `array` option is passed as `true`.
     *
     * If there are multiple elements, then an Array will be returned.
     *
     * @param {String} template The HTML string from which to create DOM content
     * @param {Object} [options] An object containing properties to modify how the DOM is created and returned.
     * @param {Boolean} [options.array] `true` to return an array even if there's only one resulting element.
     * @param {Boolean} [options.raw] Return all child nodes, including text nodes.
     * @param {Boolean} [options.fragment] Return a DocumentFragment.
     * @private
     */
    static createElementFromTemplate(template, options = emptyObject) {
        const { array, raw, fragment } = options;
        let result;

        // Use template by preference if it exists. It's faster on most supported platforms
        // https://jsperf.com/domparser-vs-template/
        if (DH.supportsTemplate) {
            (templateElement || (templateElement = doc.createElement('template'))).innerHTML = template;

            result = templateElement.content;
            if (fragment) {
                // The template is reused, so therefore is its fragment.
                // If we release the fragment to a caller, it must be a clone.
                return result.cloneNode(true);
            }
        }
        else {
            result = (htmlParser || (htmlParser = new DOMParser())).parseFromString(template, 'text/html').body;

            // We must return a DocumentFragment.
            // myElement.append(fragment) inserts the contents of the fragment, not the fragment itself.
            if (fragment) {
                const nodes = result.childNodes;
                result = document.createDocumentFragment();
                while (nodes.length) {
                    result.appendChild(nodes[0]);
                }
                return result;
            }
        }

        // Raw means all child nodes are returned
        if (raw) {
            result = result.childNodes;
        }
        // Otherwise, only element nodes
        else {
            result = result.children;
        }

        return result.length === 1 && !array ? result[0] : arraySlice.call(result);
    }

    /**
     * Dispatches a MouseEvent of the passed type to the element at the visible centre of the passed element.
     * @param {HTMLElement} targetElement The element whose center receives the mouse event.
     * @param {String} [type=contextmenu] The mouse event type to dispatch.
     * @internal
     */
    static triggerMouseEvent(targetElement, type = 'contextmenu') {
        const
            isInView         = this.isInView(targetElement),
            targetRect       = isInView || Rectangle.from(targetElement),
            targetPoint      = targetRect.center,
            contextmenuEvent = new MouseEvent(type, {
                clientX : targetPoint.x,
                clientY : targetPoint.y,
                bubbles : true
            });

        targetElement.dispatchEvent(contextmenuEvent);
    }

    /**
     * Inserts an `element` at first position in `into`.
     * @param {HTMLElement} into Parent element
     * @param {HTMLElement} element Element to insert, or an element config passed on to createElement()
     * @returns {HTMLElement}
     * @category Creation
     */
    static insertFirst(into, element) {
        if (element && element.nodeType !== ELEMENT_NODE && element.tag) {
            element = DH.createElement(element);
        }
        return into.insertBefore(element, into.firstElementChild);
    }

    /**
     * Inserts a `element` before `beforeElement` in `into`.
     * @param {HTMLElement} into Parent element
     * @param {HTMLElement} element Element to insert, or an element config passed on to createElement()
     * @param {HTMLElement} beforeElement Element before which passed element should be inserted
     * @returns {HTMLElement}
     * @category Creation
     */
    static insertBefore(into, element, beforeElement) {
        if (element && element.nodeType !== ELEMENT_NODE && element.tag) {
            element = DH.createElement(element);
        }
        return beforeElement ? into.insertBefore(element, beforeElement) : DH.insertFirst(into, element);
    }

    static insertAt(parentElement, newElement, index) {
        const siblings = Array.from(parentElement.children);

        if (index >= siblings.length) {
            return DH.append(parentElement, newElement);
        }

        const beforeElement = siblings[index];

        return DH.insertBefore(parentElement, newElement, beforeElement);
    }

    /**
     * Appends element to parentElement.
     * @param {HTMLElement} parentElement Parent element
     * @param {HTMLElement|Object|String} elementOrConfig Element to insert, or an element config passed on to createElement(), or an html string passed to createElementFromTemplate
     * @returns {HTMLElement}
     * @category Creation
     */
    static append(parentElement, elementOrConfig) {
        if (elementOrConfig.forEach) {
            // Ensure all elements of an Array are HTMLElements.
            // The other implementor of forEach is a NodeList which needs no conversion.
            if (Array.isArray(elementOrConfig)) {
                elementOrConfig = elementOrConfig.map(elementOrConfig => elementOrConfigToElement(elementOrConfig));
            }
            if (parentElement.append) {
                parentElement.append(...elementOrConfig);
            }
            else {
                const docFrag = document.createDocumentFragment();

                elementOrConfig.forEach(function(child) {
                    docFrag.appendChild(child);
                });

                parentElement.appendChild(docFrag);
            }
            return elementOrConfig;
        }
        else {
            return parentElement.appendChild(elementOrConfigToElement(elementOrConfig));
        }
    }

    //endregion

    //region Get position

    /**
     * Returns the element's `transform translateX` value in pixels.
     * @param {HTMLElement} element
     * @returns {Number} X transform
     * @category Position, get
     */
    static getTranslateX(element) {
        const transformStyle = element.style.transform;
        let matches = pxTtranslateXRe.exec(transformStyle);

        // Use inline transform style if it contains "translate(npx, npx" or "translate3d(npx, npx" or "translateX(npx"
        if (matches) {
            return parseFloat(matches[2]);
        }
        else {
            // If the inline style is the matrix() form, then use that, otherwise, use computedStyle
            matches =
                translateMatrixRe.exec(transformStyle) ||
                translateMatrixRe.exec(DH.getStyleValue(element, 'transform'));
            return matches ? parseFloat(matches[1] || matches[3]) : 0;
        }
    }

    /**
     * Returns the element's `transform translateY` value in pixels.
     * @param {HTMLElement} element
     * @returns {Number} Y coordinate
     * @category Position, get
     */
    static getTranslateY(element) {
        const transformStyle = element.style.transform;
        let matches = pxTtranslateYRe.exec(transformStyle);

        // Use inline transform style if it contains "translate(npx, npx" or "translate3d(npx, npx" or "translateY(npx"
        if (matches) {
            // If it was translateY(npx), use first item in the parens.
            const y = parseFloat(matches[matches[1] === 'Y' ? 2 : 3]);
            // FF will strip `translate(x, 0)` -> `translate(x)`, so need to check for isNaN also
            return isNaN(y) ? 0 : y;
        }
        else {
            // If the inline style is the matrix() form, then use that, otherwise, use computedStyle
            matches =
                translateMatrixRe.exec(transformStyle) ||
                translateMatrixRe.exec(DH.getStyleValue(element, 'transform'));
            return matches ? parseFloat(matches[2] || matches[4]) : 0;
        }
    }

    /**
     * Gets both X and Y coordinates as an array [x, y]
     * @param {HTMLElement} element
     * @returns {Number[]} [x, y]
     * @category Position, get
     */
    static getTranslateXY(element) {
        return [DH.getTranslateX(element), DH.getTranslateY(element)];
    }

    /**
     * Get elements X offset within a containing element
     * @param {HTMLElement} element
     * @param {HTMLElement} container
     * @returns {Number} X offset
     * @category Position, get
     */
    static getOffsetX(element, container = null) {
        return container ? element.getBoundingClientRect().left - container.getBoundingClientRect().left : element.offsetLeft;
    }

    /**
     * Get elements Y offset within a containing element
     * @param {HTMLElement} element
     * @param {HTMLElement} container
     * @returns {Number} Y offset
     * @category Position, get
     */
    static getOffsetY(element, container = null) {
        return container ? element.getBoundingClientRect().top - container.getBoundingClientRect().top : element.offsetTop;
    }

    /**
     * Gets elements X and Y offset within containing element as an array [x, y]
     * @param {HTMLElement} element
     * @param {HTMLElement} container
     * @returns {Number[]} [x, y]
     * @category Position, get
     */
    static getOffsetXY(element, container = null) {
        return [DH.getOffsetX(element, container), DH.getOffsetY(element, container)];
    }

    /**
     * Focus element without scrolling the element into view.
     * @param {HTMLElement} element
     */
    static focusWithoutScrolling(element) {

        function resetScroll(scrollHierarchy) {
            scrollHierarchy.forEach(({ element, scrollLeft, scrollTop }) => {
                // Check first to avoid triggering unnecessary `scroll` events
                if (element.scrollLeft !== scrollLeft) {
                    element.scrollLeft = scrollLeft;
                }
                if (element.scrollTop !== scrollTop) {
                    element.scrollTop = scrollTop;
                }
            });
        }

        // Check browsers which do support focusOptions. Currently only Safari lags.
        // https://caniuse.com/mdn-api_htmlelement_focus_preventscroll_option
        const preventScrollSupported = !BrowserHelper.isSafari;

        if (preventScrollSupported) {
            element.focus({ preventScroll : true });
        }
        else {
            // Examine every parentNode of the target and cache the scrollLeft and scrollTop,
            // and restore all values after the focus has taken place
            const
                parents         = DH.getParents(element),
                scrollHierarchy = parents.map(parent => ({
                    element    : parent,
                    scrollLeft : parent.scrollLeft,
                    scrollTop  : parent.scrollTop
                }));

            element.focus();

            // Reset in async.
            setTimeout(() => resetScroll(scrollHierarchy), 0);
        }
    }

    /**
     * Get elements X position on page
     * @param {HTMLElement} element
     * @returns {Number}
     * @category Position, get
     */
    static getPageX(element) {
        return element.getBoundingClientRect().left + win.pageXOffset;
    }

    /**
     * Get elements Y position on page
     * @param {HTMLElement} element
     * @returns {Number}
     * @category Position, get
     */
    static getPageY(element) {
        return element.getBoundingClientRect().top + win.pageYOffset;
    }

    /**
     * Returns extremal (min/max) size (height/width) of the element in pixels
     * @param {HTMLElement} element
     * @param {String} style minWidth/minHeight/maxWidth/maxHeight
     * @returns {Number}
     * @internal
     */
    static getExtremalSizePX(element, style) {
        const
            prop    = StringHelper.hyphenate(style),
            measure = prop.split('-')[1];

        let value   = DH.getStyleValue(element, prop);

        if (/%/.test(value)) {
            // Element might be detached from DOM
            if (element.parentElement) {
                value = parseInt(DH.getStyleValue(element.parentElement, measure), 10);
            }
            else {
                value = NaN;
            }
        }
        else {
            value = parseInt(value, 10);
        }

        return value;
    }

    //endregion

    //region Set position

    /**
     * Set element's `scale`.
     * @param {HTMLElement} element
     * @param {Number} scaleX The value by which the element should be scaled in the X axis (0 to 1)
     * @param {Number} [scaleY] The value by which the element should be scaled in the Y axis (0 to 1).
     * Defaults to `scaleX`
     * @category Position, set
     * @internal
     */
    static setScale(element, scaleX, scaleY = scaleX) {
        const t = DH.getStyleValue(element, 'transform').split(/,\s*/);

        if (t.length > 1) {
            if (t[0].startsWith('matrix3d')) {
                t[0] = `matrix3d(${scaleX}`;
                t[5] = scaleY;
            }
            else {
                t[0] = `matrix(${scaleX}`;
                t[3] = scaleY;
            }
            element.style.transform = t.join(',');
        }
        else {
            element.style.transform = `scale(${scaleX}, ${scaleY})`;
        }
    }

    /**
     * Set element's `X` translation in pixels.
     * @param {HTMLElement} element
     * @param {Number} x The value by which the element should be translated from its default position.
     * @category Position, set
     */
    static setTranslateX(element, x) {
        const t = DH.getStyleValue(element, 'transform').split(/,\s*/);

        // Avoid blurry text on non-retina displays
        x = DH.roundPx(x);

        if (t.length > 1) {
            t[t[0].startsWith('matrix3d') ? 12 : 4] = x;
            element.style.transform = t.join(',');
        }
        else {
            element.style.transform = `translateX(${x}px)`;
        }
    }

    /**
     * Set element's `Y` translation in pixels.
     * @param {HTMLElement} element
     * @param {Number} y  The value by which the element should be translated from its default position.
     * @category Position, set
     */
    static setTranslateY(element, y) {
        const t = DH.getStyleValue(element, 'transform').split(/,\s*/);

        // Avoid blurry text on non-retina displays
        y = DH.roundPx(y);

        if (t.length > 1) {
            t[t[0].startsWith('matrix3d') ? 13 : 5] = y;
            element.style.transform = t.join(',') + ')';
        }
        else {
            element.style.transform = `translateY(${y}px)`;
        }
    }

    /**
     * Set element's style `top`.
     * @param {HTMLElement} element
     * @param {Number|String} y The top position. If numeric, `'px'` is used as the unit.
     * @category Position, set
     */
    static setTop(element, y) {
        DH.setLength(element, 'top', y);
    }

    /**
     * Set element's style `left`.
     * @param {HTMLElement} element
     * @param {Number|String} x The top position. If numeric, `'px'` is used as the unit.
     * @category Position, set
     */
    static setLeft(element, x) {
        DH.setLength(element, 'left', x);
    }

    static setTopLeft(element, y, x) {
        DH.setLength(element, 'top', y);
        DH.setLength(element, 'left', x);
    }

    /**
     * Set elements `X` and `Y` translation in pixels.
     * @param {HTMLElement} element
     * @param {Number} [x] The `X translation.
     * @param {Number} [y] The `Y translation.
     * @category Position, set
     */
    static setTranslateXY(element, x, y) {
        if (x == null) {
            return DH.setTranslateY(element, y);
        }
        if (y == null) {
            return DH.setTranslateX(element, x);
        }

        // Avoid blurry text on non-retina displays
        x = DH.roundPx(x);
        y = DH.roundPx(y);

        const
            t    = DH.getStyleValue(element, 'transform').split(/,\s*/),
            is3d = t[0].startsWith('matrix3d');

        if (t.length > 1) {
            t[is3d ? 12 : 4] = x;
            t[is3d ? 13 : 5] = y;
            element.style.transform = t.join(',') + ')';
        }
        else {
            element.style.transform = `translate(${x}px, ${y}px)`;
        }
    }

    /**
     * Increase `X` translation
     * @param {HTMLElement} element
     * @param {Number} x The number of pixels by which to increase the element's `X` translation.
     * @category Position, set
     */
    static addTranslateX(element, x) {
        DH.setTranslateX(element, DH.getTranslateX(element) + x);
    }

    /**
     * Increase `Y` position
     * @param {HTMLElement} element
     * @param {Number} y The number of pixels by which to increase the element's `Y` translation.
     * @category Position, set
     */
    static addTranslateY(element, y) {
        DH.setTranslateY(element, DH.getTranslateY(element) + y);
    }

    /**
     * Increase X position
     * @param {HTMLElement} element
     * @param {Number} x
     * @category Position, set
     */
    static addLeft(element, x) {
        DH.setLeft(element, DH.getOffsetX(element) + x);
    }

    /**
     * Increase Y position
     * @param {HTMLElement} element
     * @param {Number} y
     * @category Position, set
     */
    static addTop(element, y) {
        DH.setTop(element, DH.getOffsetY(element) + y);
    }

    /**
     * Align the passed element with the passed target according to the align spec.
     * @param {HTMLElement} element The element to align.
     * @param {HTMLElement|Core.helper.util.Rectangle} target The target element or rectangle to align to
     * @param {Object} [alignSpec] See {@link Core.helper.util.Rectangle#function-alignTo} Defaults to `{ align : 't0-t0' }`
     * @param {Boolean} [round] Round the calculated Rectangles (for example if dealing with scrolling which
     * is integer based).
     */
    static alignTo(element, target, alignSpec = t0t0, round) {
        target = (target instanceof Rectangle) ? target : Rectangle.from(target, true);

        const
            elXY       = DH.getTranslateXY(element),
            elRect     = Rectangle.from(element, true);

        if (round) {
            elRect.roundPx();
            target.roundPx();
        }

        const targetRect = elRect.alignTo(Object.assign(alignSpec, {
            target
        }));

        DH.setTranslateXY(element, elXY[0] + targetRect.x - elRect.x, elXY[1] + targetRect.y - elRect.y);
    }

    //endregion

    //region Styles & CSS

    /**
     * Returns a style value or values for the passed element.
     * @param {HTMLElement} element The element to read styles from
     * @param {String|String[]} propName The property or properties to read
     * @param {Boolean} [inline=false] Pass as `true` to read the element's inline style.
     * Note that this could return inaccurate results if CSS rules apply to this element.
     * @returns {String|Object} The value or an object containing the values keyed by the requested property name.
     * @category CSS
     */
    static getStyleValue(element, propName, inline, pseudo) {
        const styles = inline ? element.style : element.ownerDocument.defaultView.getComputedStyle(element, pseudo);

        if (Array.isArray(propName)) {
            const result = {};

            for (const prop of propName) {
                result[prop] = styles.getPropertyValue(StringHelper.hyphenate(prop));
            }

            return result;
        }

        // Use the elements owning view to get the computed style.
        // Ensure the property name asked for is hyphenated.
        // getPropertyValue doesn't work with camelCase
        return styles.getPropertyValue(StringHelper.hyphenate(propName));
    }

    /**
     * Returns an object with the parse style values for the top, right, bottom, and left
     * components of the given edge style.
     *
     * The return value is an object with `top`, `right`, `bottom`, and `left` properties
     * for the respective components of the edge style, as well as `width` (the sum of
     * `left` and `right`) and `height` (the sum of `top` and `bottom`).
     *
     * @param {HTMLElement} element
     * @param {String} edgeStyle The element's desired edge style such as 'padding', 'margin',
     * or 'border'.
     * @param {String} [edges='trbl'] A string with one character codes for each edge. Only
     * those edges will be populated in the returned object. By default, all edges will be
     * populated.
     * @returns {Object}
     */
    static getEdgeSize(element, edgeStyle, edges) {
        const
            suffix = (edgeStyle === 'border') ? '-width' : '',
            ret = {
                raw : {}
            };

        for (const edge of ['top', 'right', 'bottom', 'left']) {
            if (!edges || edges.includes(edge[0])) {
                // This produces px units even if the provided style is em or other (i.e.,
                // getComputedStyle normalizes this):
                ret[edge] = parseFloat(
                    ret.raw[edge] = DH.getStyleValue(element, `${edgeStyle}-${edge}${suffix}`)
                );
            }
        }

        // These may not even be requested (based on "edges") but conditional code here
        // would be wasted since the caller would still need to know not to use them...
        // Replace NaN with 0 to keep calculations correct if they only asked for one side.
        ret.width = (ret.left || 0) + (ret.right || 0);
        ret.height = (ret.top || 0) + (ret.bottom || 0);

        return ret;
    }

    /**
     * Splits a style string up into object form. For example `'font-weight:bold;font-size:150%'`
     * would convert to
     *
     * ```javascript
     * {
     *     font-weight : 'bold',
     *     font-size : '150%'
     * }
     * ```
     * @param {String} style A DOM style string
     * @returns {Object} the style declaration in object form.
     */
    static parseStyle(style) {
        if (typeof style === 'string') {
            const styles = style.split(semicolonRe);

            style = {};
            for (let i = 0, { length } = styles; i < length; i++) {
                const propVal = styles[i].split(colonRe);

                style[propVal[0]] = propVal[1];
            }
        }
        return style || {};
    }

    /**
     * Applies specified style to the passed element. Style can be an object or a string.
     * @param {HTMLElement} element Target element
     * @param {String|Object} style Style to apply, 'border: 1px solid black' or { border: '1px solid black' }
     * @param {Boolean} [overwrite] Specify `true` to replace style instead of applying changes
     * @category CSS
     */
    static applyStyle(element, style, overwrite = false) {
        if (typeof style === 'string') {
            if (overwrite) {
                // Only assign if either end has any styles, do not want to add empty `style` tag on element
                if (style.length || element.style.cssText.length) {
                    element.style.cssText = style;
                }
            }
            else {
                // Add style so as not to delete configs in style such as width, height, flex etc.
                // If a style is already there, the newest, appended one will take precedence.
                element.style.cssText += style;
            }
        }
        else if (style) {
            if (overwrite) {
                element.style.cssText = '';
                //element.removeAttribute('style');
            }

            // Has a sub-style block in object form? Use it to override style block
            if (style.style && typeof style.style !== 'string') {
                style = ObjectHelper.assign({}, style, style.style);
            }

            let key, value;

            // Prototype chained objects may be passed, so use direct loop.
            for (key in style) {
                // Ignore readonly properties of the CSSStyleDeclaration object:
                // https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration
                // Also ignores sub-style blocks, which are applied above
                if (!styleIgnoreProperties[key]) {
                    [key, value] = DH.unitize(key, style[key]);

                    // Cannot use element.style[key], wont work with CSS vars
                    element.style.setProperty(key, value);
                }
            }

            // Has sub-styles as string? Add to cssText after applying style block, to override it
            if (typeof style.style === 'string') {
                element.style.cssText += style.style;
            }
        }
    }

    static getCSSText(style) {
        if (typeof style === 'string') {
            return style;
        }

        let cssText = '';

        for (const key in style) {
            // Ignore readonly properties of the CSSStyleDeclaration object:
            // https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration
            if (!styleIgnoreProperties[key]) {
                cssText += `${StringHelper.hyphenate(key)}:${style[key]};`;
            }
        }

        return cssText;
    }

    /**
     * Add multiple classes to elements classList.
     * @param {HTMLElement} element
     * @param {String[]} classes
     * @deprecated Since 5.0. Use {@link https://developer.mozilla.org/en-US/docs/Web/API/DOMTokenList/add add} method
     * for {@link https://developer.mozilla.org/en-US/docs/Web/API/Element/classList Element.classlist}
     * @category CSS
     */
    static addClasses(element, classes) {
        VersionHelper.deprecate('Core', '6.0.0', 'DomHelper.addClasses should be replaced by native classList.add');
        element.classList.add(...classes);
    }

    /**
     * Remove multiple classes from elements classList.
     * @param {HTMLElement} element
     * @param {String[]} classes
     * @deprecated Since 5.0. Use {@link https://developer.mozilla.org/en-US/docs/Web/API/DOMTokenList/remove remove} method
     * for {@link https://developer.mozilla.org/en-US/docs/Web/API/Element/classList Element.classlist}
     * @category CSS
     */
    static removeClasses(element, classes) {
        VersionHelper.deprecate('Core', '6.0.0', 'DomHelper.removeClasses should be replaced by native classList.remove');
        element.classList.remove(...classes);
    }

    /**
     * Toggle multiple classes in elements classList. Helper for toggling multiple classes at once.
     * @param {HTMLElement} element
     * @param {String[]} classes
     * @param {Boolean} [force] Specify true to add classes, false to remove. Leave blank to toggle
     * @category CSS
     */
    static toggleClasses(element, classes, force = null) {
        classes = ArrayHelper.asArray(classes);

        if (force === true) {
            element.classList.add(...classes);
        }
        else if (force === false) {
            element.classList.remove(...classes);
        }
        else {
            classes.forEach(cls => element.classList.toggle(cls));
        }
    }

    /**
     * Adds a CSS class to an element during the specified duration
     * @param {HTMLElement} element Target element
     * @param {String} cls CSS class to add temporarily
     * @param {Number} duration Duration in ms, 0 means cls will not be applied
     * @param {Core.mixin.Delayable} delayable The delayable to tie the setTimeout call to
     * @typings delayable -> {typeof Delayable}
     * @category CSS
     */
    static addTemporaryClass(element, cls, duration, delayable = globalThis) {
        if (duration > 0) {
            element.classList.add(cls);

            delayable.setTimeout({
                fn                : cls => element.classList.remove(cls),
                delay             : duration,
                name              : cls,
                args              : [cls],
                cancelOutstanding : true
            });
        }
    }

    /**
     * Reads computed style from the element and returns transition duration for a given property in milliseconds
     * @param {HTMLElement} element Target DOM element
     * @param {String} property Animated property name
     * @returns {Number} Duration in ms
     * @internal
     */
    static getPropertyTransitionDuration(element, property) {
        const
            style      = globalThis.getComputedStyle(element),
            properties = style.transitionProperty.split(', '),
            durations  = style.transitionDuration.split(', '),
            index      = properties.indexOf(StringHelper.hyphenate(property));

        let result;

        if (index !== -1) {
            // get floating value of transition duration in seconds and convert into milliseconds
            result = parseFloat(durations[index]) * 1000;
        }

        return result;
    }

    /**
     * Reads computed style from the element and returns the animation duration for any
     * attached animation in milliseconds
     * @param {HTMLElement} element Target DOM element
     * @returns {Number} Duration in ms
     * @internal
     */
    static getAnimationDuration(element) {
        return parseFloat(DH.getStyleValue(element, 'animation-duration')) * 1000;
    }

    //endregion

    //region Effects

    /**
     * Highlights the passed element or Rectangle according to the theme's highlighting rules.
     * Usually an animated framing effect.
     *
     * The framing effect is achieved by adding the CSS class `b-fx-highlight` which references
     * a `keyframes` animation named `b-fx-highlight-animation`. You may override the animation
     * name referenced, or the animation itself in your own CSS.
     *
     * @param {HTMLElement|Core.helper.util.Rectangle} element The element or Rectangle to highlight.
     */
    static highlight(element, delayable = globalThis) {
        if (element instanceof Rectangle) {
            return element.highlight();
        }
        return new Promise(resolve => {
            delayable.setTimeout(() => {
                element.classList.add('b-fx-highlight');
                delayable.setTimeout(() => {
                    element.classList.remove('b-fx-highlight');
                    resolve();
                }, 1000);
            }, 0);
        });
    }

    //endregion

    //region Measuring / Scrollbar

    /**
     * Measures the scrollbar width using a hidden div. Caches result
     * @property {Number}
     * @readonly
     */
    static get scrollBarWidth() {
        // Ensure the measurement is only done once, when the value is null and body is available.
        // Leave measure element in place. It needs to be remeasured when the zoom level is changed
        // which is detected using a window resize listener, so *may* be called frequently.
        if (scrollBarWidth === null && doc.body) {
            const element = scrollBarMeasureElement || (scrollBarMeasureElement = DH.createElement({
                parent : doc.body,
                style  : 'position:absolute;top:-9999em;height:100px;overflow-y:scroll'
            }));
            if (element.parentNode !== doc.body) {
                doc.body.appendChild(element);
            }
            scrollBarWidth = element.offsetWidth;
        }

        return scrollBarWidth;
    }

    static get scrollBarPadElement() {
        return {
            className : 'b-yscroll-pad',
            children  : [{
                className : 'b-yscroll-pad-sizer'
            }]
        };
    }

    /**
     * Resets DomHelper.scrollBarWidth cache, triggering a new measurement next time it is read
     */
    static resetScrollBarWidth() {
        scrollBarWidth = null;
    }

    /**
     * Measures the text width using a hidden div
     * @param {String} text
     * @param {HTMLElement} sourceElement
     * @returns {Number} width
     * @category Measure
     */
    static measureText(text, sourceElement, useHTML = false, parentElement = undefined) {
        const offScreenDiv = DH.getMeasureElement(sourceElement, parentElement);

        offScreenDiv[useHTML ? 'innerHTML' : 'innerText'] = text;

        const result = offScreenDiv.clientWidth;
        offScreenDiv.className = '';

        return result;
    }

    /**
     * Measures a relative size, such as a size specified in `em` units for the passed element.
     * @param {String} size The CSS size value to measure.
     * @param {HTMLElement} sourceElement
     * @param {Boolean} [round] Pass true to return exact width, not rounded value
     * @returns {Number} size The size in pixels of the passed relative measurement.
     * @category Measure
     */
    static measureSize(size, sourceElement, round = true) {
        if (!size) {
            return 0;
        }

        if (typeof size === 'number') {
            return size;
        }

        if (!size.length) {
            return 0;
        }

        if (/^\d+(px)?$/.test(size)) {
            return parseInt(size);
        }

        if (sourceElement) {
            const offScreenDiv = DH.getMeasureElement(sourceElement);
            offScreenDiv.innerHTML = '';
            offScreenDiv.style.width = DH.setLength(size);
            const result = round ? offScreenDiv.offsetWidth : offScreenDiv.getBoundingClientRect().width;
            offScreenDiv.style.width = offScreenDiv.className = '';
            return result;
        }

        if (/^\d+em$/.test(size)) {
            return parseInt(size) * DEFAULT_FONT_SIZE;
        }

        return isNaN(size) ? 0 : parseInt(size);
    }

    // parentElement allows measurement to happen inside a specific element, allowing scoped css rules to match
    static getMeasureElement(sourceElement, parentElement = doc.body) {
        const
            sourceElementStyle = win.getComputedStyle(sourceElement),
            offScreenDiv       = parentElement.offScreenDiv = parentElement.offScreenDiv || DH.createElement({
                parent    : parentElement,
                style     : 'position:fixed;top:-10000px;left:-10000px;visibility:hidden;contain:strict',
                className : 'b-measure-element',
                children  : [{
                    style : 'white-space:nowrap;display:inline-block;will-change:contents;width:auto;contain:none'
                }]
            }, { returnAll : true })[1];

        fontProps.forEach(prop => {
            if (offScreenDiv.style[prop] !== sourceElementStyle[prop]) {
                offScreenDiv.style[prop] = sourceElementStyle[prop];
            }
        });
        offScreenDiv.className = sourceElement.className;

        // In case the measure element was moved/removed, re-add it
        if (offScreenDiv.parentElement.parentElement !== parentElement) {
            parentElement.appendChild(offScreenDiv.parentElement);
        }

        return offScreenDiv;
    }

    /**
     * Strips the tags from a html string, returning text content.
     *
     * ```javascript
     * DomHelper.stripTags('<div class="custom"><b>Bold</b><i>Italic</i></div>'); // -> BoldItalic
     * ```
     *
     * @internal
     * @param {String} htmlString HTML string
     * @returns {String} Text content
     */
    static stripTags(htmlString) {
        const
            // we need to avoid any kind of evaluation of embedded XSS scripts or "web bugs" (img tags that issue
            // GET requests)
            parser = DH.$domParser || (DH.$domParser = new DOMParser()),
            doc = parser.parseFromString(htmlString, 'text/html');

        return doc.body.textContent;
    }

    //endregion

    //region Sync

    /**
     * Sync one source element attributes, children etc. to a target element. Source element can be specified as a html
     * string or an actual HTMLElement.
     *
     * NOTE: This function is superseded by {@link Core/helper/DomSync#function-sync-static DomSync.sync()}, which works
     * with DOM configs. For most usecases, use it instead.
     *
     * @param {String|HTMLElement} sourceElement Source "element" to copy from
     * @param {HTMLElement} targetElement Target element to apply to, can also be specified as part of the config object
     * @returns {HTMLElement} Returns the updated targetElement (which is also updated in place)
     */
    static sync(sourceElement, targetElement) {
        if (typeof sourceElement === 'string') {
            if (sourceElement === '') {
                targetElement.innerHTML = '';
                return;
            }
            else {
                sourceElement = DH.createElementFromTemplate(sourceElement);
            }
        }

        DH.performSync(sourceElement, targetElement);

        return targetElement;
    }

    // Internal helper used for recursive syncing
    static performSync(sourceElement, targetElement) {
        // Syncing identical elements is a no-op
        if (sourceElement.outerHTML !== targetElement.outerHTML) {
            DH.syncAttributes(sourceElement, targetElement);
            DH.syncContent(sourceElement, targetElement);
            DH.syncChildren(sourceElement, targetElement);

            return true;
        }
        return false;
    }

    // Attributes as map { attr : value, ... }, either from an html element or from a config
    static getSyncAttributes(element) {
        const
            attributes = {},
            // Attribute names, simplifies comparisons and calls to set/removeAttribute
            names      = [];

        // Extract from element
        for (let i = 0; i < element.attributes.length; i++) {
            const attr = element.attributes[i];
            if (attr.specified) {
                const name = attr.name.toLowerCase();
                attributes[name] = attr.value;
                names.push(name);
            }
        }

        return { attributes, names };
    }

    /**
     * Syncs attributes from sourceElement to targetElement.
     * @private
     * @param {HTMLElement} sourceElement
     * @param {HTMLElement} targetElement
     */
    static syncAttributes(sourceElement, targetElement) {
        const
            // Extract attributes from elements (sourceElement might be a config)
            {
                attributes : sourceAttributes,
                names      : sourceNames
            }          = DH.getSyncAttributes(sourceElement),
            {
                attributes : targetAttributes,
                names      : targetNames
            }          = DH.getSyncAttributes(targetElement),
            // Used to ignore data-xx attributes when we will be setting entire dataset
            hasDataset = sourceNames.includes('dataset'),
            // Intersect arrays to determine what needs adding, removing and syncing
            toAdd      = sourceNames.filter(attr => !targetNames.includes(attr)),
            toRemove   = targetNames.filter(attr => !sourceNames.includes(attr) && (!hasDataset || !attr.startsWith('data-'))),
            toSync     = sourceNames.filter(attr => targetNames.includes(attr));

        if (toAdd.length > 0) {
            for (let i = 0; i < toAdd.length; i++) {
                const attr = toAdd[i];

                // Style requires special handling
                if (attr === 'style') {
                    DH.applyStyle(targetElement, sourceAttributes.style, true);
                }
                // So does dataset
                else if (attr === 'dataset') {
                    Object.assign(targetElement.dataset, sourceAttributes.dataset);
                }
                // Other attributes are set using setAttribute (since it calls toString() DomClassList works fine)
                else {
                    targetElement.setAttribute(attr, sourceAttributes[attr]);
                }
            }
        }

        if (toRemove.length > 0) {
            for (let i = 0; i < toRemove.length; i++) {
                targetElement.removeAttribute(toRemove[i]);
            }
        }

        if (toSync.length > 0) {
            for (let i = 0; i < toSync.length; i++) {
                const attr = toSync[i];
                // Set all attributes that has changed, with special handling for style
                if (attr === 'style') {
                    // TODO: Check for changes?
                    DH.applyStyle(targetElement, sourceAttributes.style, true);
                }
                // And dataset
                else if (attr === 'dataset') {
                    // TODO: Any cost to assigning same values?
                    Object.assign(targetElement.dataset, sourceAttributes.dataset);
                }
                // And class, which might be a DomClassList or an config for a DomClassList
                else if (attr === 'class' && (sourceAttributes.class.isDomClassList || typeof sourceAttributes.class === 'object')) {
                    let classList;

                    if (sourceAttributes.class.isDomClassList) {
                        classList = sourceAttributes.class;
                    }
                    else {
                        // TODO : Reuse a single DomClassList?
                        classList = new DomClassList(sourceAttributes.class);
                    }

                    if (!classList.isEqual(targetAttributes.class)) {
                        targetElement.setAttribute('class', classList);
                    }
                }
                else if (targetAttributes[attr] !== sourceAttributes[attr]) {
                    targetElement.setAttribute(attr, sourceAttributes[attr]);
                }
            }
        }
    }

    /**
     * Sync content (innerText) from sourceElement to targetElement
     * @private
     * @param {HTMLElement} sourceElement
     * @param {HTMLElement} targetElement
     */
    static syncContent(sourceElement, targetElement) {
        if (DH.getChildElementCount(sourceElement) === 0) {
            targetElement.innerText = sourceElement.innerText;
        }
    }

    static setInnerText(targetElement, text) {
        // setting firstChild.data is faster than innerText (and innerHTML),
        // but in some cases the inner node is lost and needs to be recreated
        const { firstChild } = targetElement;

        if (firstChild?.nodeType === Element.TEXT_NODE) {
            firstChild.data = text;
        }
        else {
            // textContent is supposed to be faster than innerText, since it does not trigger layout
            targetElement.textContent = text;
        }
    }

    /**
     * Sync traversing children
     * @private
     * @param {HTMLElement} sourceElement Source element
     * @param {HTMLElement} targetElement Target element
     */
    static syncChildren(sourceElement, targetElement) {
        const
            me          = this,
            sourceNodes = arraySlice.call(sourceElement.childNodes),
            targetNodes = arraySlice.call(targetElement.childNodes);

        while (sourceNodes.length) {
            const
                sourceNode = sourceNodes.shift(),
                targetNode = targetNodes.shift();

            // only textNodes and elements allowed (no comments)
            if (sourceNode && sourceNode.nodeType !== TEXT_NODE && sourceNode.nodeType !== ELEMENT_NODE) {
                throw new Error(`Source node type ${sourceNode.nodeType} not supported by DomHelper.sync()`);
            }
            if (targetNode && targetNode.nodeType !== TEXT_NODE && targetNode.nodeType !== ELEMENT_NODE) {
                throw new Error(`Target node type ${targetNode.nodeType} not supported by DomHelper.sync()`);
            }

            if (!targetNode) {
                // out of target nodes, add to target
                targetElement.appendChild(sourceNode);
            }
            else {
                // match node

                if (sourceNode.nodeType === targetNode.nodeType) {
                    // same type of node, take action depending on which type
                    if (sourceNode.nodeType === TEXT_NODE) {
                        // text
                        targetNode.data = sourceNode.data;
                    }
                    else {
                        if (sourceNode.tagName === targetNode.tagName) {
                            me.performSync(sourceNode, targetNode);
                        }
                        else {
                            // new tag, remove targetNode and insert new element
                            targetElement.insertBefore(sourceNode, targetNode);
                            targetNode.remove();
                        }
                    }
                }
                // Trying to set text node as element, use it as innerText
                // (we get this in FF with store mutations and List)
                else if (sourceNode.nodeType === TEXT_NODE && targetNode.nodeType === ELEMENT_NODE) {
                    targetElement.innerText = sourceNode.data.trim();
                }
                else {
                    const logElement = sourceNode.parentElement || sourceNode;
                    throw new Error(`Currently no support for transforming nodeType.\n${logElement.outerHTML}`);
                }
            }
        }

        // Out of source nodes, remove remaining target nodes
        targetNodes.forEach(targetNode => {
            targetNode.remove();
        });
    }

    /**
     * Replaces the passed element's `className` with the class names
     * passed in either Array or String format or Object.
     *
     * This method compares the existing class set with the incoming class set and
     * avoids mutating the element's class name set if possible.
     *
     * This can avoid browser style invalidations.
     * @param {HTMLElement} element The element whose class list to synchronize.
     * @param {String[]|String|Object} newClasses The incoming class names to set on the element.
     * @returns {Boolean} `true` if the DOM class list was changed.
     * @category CSS
     */
    static syncClassList(element, newClasses) {
        const
            { classList } = element,
            isString      = typeof newClasses === 'string',
            newClsArray   = isString ? newClasses.split(whiteSpaceRe) : DomClassList.normalize(newClasses, 'array'),
            classCount    = newClsArray.length;

        let changed = classList.length !== classCount,
            i;

        // If the incoming and existing class lists are the same length
        // then check that each contains the same names. As soon as
        // we find a non-matching name, we know we have to update the
        // className.
        for (i = 0; !changed && i < classCount; i++) {

            changed = !classList.contains(newClsArray[i]);
        }

        if (changed) {
            element.className = isString ? newClasses : newClsArray.join(' ');
        }
        return changed;
    }

    /**
     * Applies the key state of the passed object or DomClassList to the passed element.
     *
     * Properties with a falsy value mean that property name is *removed* as a class name.
     *
     * Properties with a truthy value mean that property name is *added* as a class name.
     *
     * This is different from {@link #function-syncClassList-static}. That sets the `className` of the element to the
     * sum of all its truthy keys, regardless of what the pre-existing value of the `className` was, and ignoring falsy
     * keys.
     *
     * This _selectively_ updates the classes in the `className`. If there is a truthy key, the name is added. If there
     * is a falsy key, the name is removed.
     * @param {HTMLElement} element The element to apply the class list to .
     * @param {Object|Core.helper.util.DomClassList} classes The classes to add or remove.
     * @returns {Boolean} `true` if the DOM class list was changed.
     * @category CSS
     */
    static updateClassList(element, classes) {
        const { classList } = element;
        let cls, add, changed = false;

        for (cls in classes) {
            add = Boolean(classes[cls]);

            if (classList.contains(cls) !== add) {
                classList[add ? 'add' : 'remove'](cls);
                changed = true;
            }
        }
        return changed;
    }

    /**
     * Changes the theme to the passed theme name if possible.
     *
     * Theme names are case insensitive. The `href` used is all lower case.
     *
     * To use this method, the `<link rel="stylesheet">` _must_ use the default,
     * Bryntum-supplied CSS files where the `href` end with `<themeName>.css`, so that
     * it can be found in the document, and switched out for a new link with
     * the a modified `href`. The new `href` will use the same path, just
     * with the `themeName` portion substituted for the new name.
     *
     * If no `<link>` with that name pattern can be found, an error will be thrown.
     *
     * If you use this method, you  must ensure that the theme files are
     * all accessible on your server.
     *
     * Because this is an asynchronous operation, a `Promise` is returned.
     * The theme change event is passed to the success function. If the
     * theme was not changed, because the theme name passed is the current theme,
     * nothing is passed to the success function.
     *
     * The theme change event contains two properties:
     *
     *  - `prev` The previous Theme name.
     *  - `theme` The new Theme name.
     *
     * @param {String} newThemeName the name of the theme that should be applied
     * @privateparam {String} [defaultTheme] Optional, the name of the theme that should be used in case of fail
     * @returns {Promise} A promise who's success callback receives the theme change
     * event if the theme in fact changed. If the theme `href` could not be loaded,
     * the failure callback is called, passing the error event caught.
     * @async
     */
    static setTheme(newThemeName, defaultTheme) {
        newThemeName = newThemeName.toLowerCase();

        const
            { head }     = document,
            oldThemeName = DH.getThemeInfo(defaultTheme).name.toLowerCase();

        let oldThemeLinks = head.querySelectorAll('[data-bryntum-theme]:not([data-loading])'),
            loaded = 0;

        if (oldThemeName === newThemeName) {
            return immediatePromise;
        }

        // Remove any links currently loading
        DH.removeEachSelector(head, '#bryntum-theme[data-loading],link[data-bryntum-theme][data-loading]');

        const themeEvent = {
            theme : newThemeName,
            prev  : oldThemeName
        };

        function replaceTheme(oldThemeLink, resolve, reject) {
            const newThemeLink = DomHelper.createElement({
                tag     : 'link',
                rel     : 'stylesheet',
                dataset : {
                    loading      : true,
                    bryntumTheme : true
                },
                href        : oldThemeLink.href.replace(oldThemeName, newThemeName),
                nextSibling : oldThemeLink
            });

            newThemeLink.addEventListener('load', () => {
                delete newThemeLink.dataset.loading;
                themeInfo = null;
                // Flip all products to the new theme at the same time
                if (++loaded === oldThemeLinks.length) {
                    oldThemeLinks.forEach(link => link.remove());
                    GlobalEvents.trigger('theme', themeEvent);
                    resolve(themeEvent);
                }
            });

            newThemeLink.addEventListener('error', (e) => {
                delete newThemeLink.dataset.loading;
                reject(e);
            });
        }

        if (oldThemeLinks.length) {
            return new Promise((resolve, reject) => {
                oldThemeLinks.forEach((oldThemeLink, i) => {
                    replaceTheme(oldThemeLink, resolve, reject, i === oldThemeLinks.length - 1);
                });
            });
        }
        else {
            const oldThemeLink =
                      head.querySelector('#bryntum-theme:not([data-loading])') ||
                      head.querySelector(`[href*="${oldThemeName}.css"]:not([data-loading])`);

            // Theme link href ends with <themeName>.css also there could be a query - css?11111...
            if (!oldThemeLink?.href.includes(`${oldThemeName}.css`)) {
                throw new Error(`Theme link for ${oldThemeName} not found`);
            }

            oldThemeLinks = [oldThemeLink];

            return new Promise((resolve, reject) => replaceTheme(oldThemeLink, resolve, reject));
        }
    }

    /**
     * A theme information object about the current theme.
     *
     * Currently this has only one property:
     *
     *   - `name` The current theme name.
     * @property {Object}
     * @readonly
     */
    static get themeInfo() {
        return DomHelper.getThemeInfo();
    }

    /**
     * A theme information object about the current theme.
     *
     * Currently this has only one property:
     *
     *   - `name` The current theme name.
     * @param {String} defaultTheme the name of the theme used as backup value in case of fail
     * @returns {Object} info, currently it contains only one property - 'name'.
     * @private
     */
    static getThemeInfo(defaultTheme) {
        if (!themeInfo) {
            const
                // The content it creates for 'b-theme-info' is described in corresponding theme in Core/resources/sass/themes
                // for example in Core/resources/sass/themes/material.scss
                // ```
                // .b-theme-info:before {
                //     content : '{"name":"Material"}';
                // }
                // ```
                testDiv   = DH.createElement({
                    parent    : document.body,
                    className : 'b-theme-info'
                }),
                // Theme desc object is in the :before pseudo element.
                themeData = DH.getStyleValue(testDiv, 'content', false, ':before');

            if (themeData) {
                // themeData could be invalid JSON string in case there is no content rule
                try {
                    themeInfo = JSON.parse(themeData.replace(/^["']|["']$|\\/g, ''));
                }
                catch (e) {
                    themeInfo = null;
                }
            }

            // CSS file has to be loaded to make the themeInfo available, so fallback to the default theme name
            themeInfo = themeInfo || (defaultTheme ? { name : defaultTheme } : null);

            testDiv.remove();
        }
        return themeInfo;
    }

    //endregion

    //region Transition

    static async transition({
        element : outerElement,
        selector = '[data-dom-transition]',
        duration,
        action,
        thisObj = this,
        addTransition = {},
        removeTransition = {}
    }) {
        const
            scrollers = new Set(),
            beforeElements = Array.from(outerElement.querySelectorAll(selector)),
            beforeMap      = new Map(beforeElements.map(element => {
                let depth = 0,
                    parent = element.parentElement;

                while (parent && parent !== outerElement) {
                    depth++;
                    parent = parent.parentElement;
                }

                element.$depth = depth;

                // Store scrolling elements and their current scroll pos, for restoring later
                if (element.scrollHeight > element.offsetHeight && getComputedStyle(element).overflow === 'auto') {
                    element.$scrollTop = element.scrollTop;
                    scrollers.add(element);
                }

                // Intersect our bounds with parents, to trim away overflow
                const
                    { parentElement } = element,
                    globalBounds      = Rectangle.from(element, outerElement),
                    localBounds       = Rectangle.from(element, parentElement),
                    style             = getComputedStyle(parentElement),
                    borderLeftWidth   = parseFloat(style.borderLeftWidth);

                if (borderLeftWidth) {
                    globalBounds.left -= borderLeftWidth;
                    localBounds.left -= borderLeftWidth;
                }

                return [
                    element.id,
                    { element, globalBounds, localBounds, depth, parentElement }
                ];
            }));

        action.call(thisObj);

        const
            afterElements = Array.from(outerElement.querySelectorAll(selector)),
            afterMap      = new Map(afterElements.map(element => {
                const
                    globalBounds    = Rectangle.from(element, outerElement),
                    localBounds     = Rectangle.from(element, element.parentElement),
                    style           = globalThis.getComputedStyle(element.parentElement),
                    borderLeftWidth = parseFloat(style.borderLeftWidth);

                if (borderLeftWidth) {
                    globalBounds.left -= borderLeftWidth;
                    localBounds.left -= borderLeftWidth;
                }

                return [
                    element.id,
                    { element, globalBounds, localBounds }
                ];
            })),
            styleProps    = ['position', 'top', 'left', 'width', 'height', 'padding', 'margin', 'zIndex', 'minWidth', 'minHeight', 'opacity', 'overflow'];

        // Convert to absolute layout, iterating elements remaining after action
        for (const [id, before] of beforeMap) {
            // We match before vs after on id and not actual element, allowing adding a new element with the same id to
            // transition from the old (which was removed or released). To match what will happen when DomSyncing with
            // multiple containing elements (columns in TaskBoard)
            const after = afterMap.get(id);

            if (after) {
                const
                    { element }              = after,
                    { style, parentElement } = element,
                    // Need to keep explicit zIndex to keep above other stuff
                    zIndex                   = parseInt(DH.getStyleValue(element, 'zIndex')),
                    {
                        globalBounds,
                        localBounds,
                        depth,
                        parentElement : beforeParent
                    }                        = before,
                    parentChanged            = beforeParent !== parentElement;

                // Store initial state, in case element has a style prop we need to restore later
                ObjectHelper.copyProperties(element.$initial = { parentElement }, style, styleProps);

                // Prevent transition during the process, forced further down instead
                // element.remove();

                let bounds;

                // Action moved element to another parent, move it to the outer element to allow transitioning to the
                // new parent. Also use coordinates relative to that element
                if (parentChanged) {
                    after.bounds = after.globalBounds;
                    bounds = globalBounds;
                    outerElement.appendChild(element);
                }
                // Keep element in current parent if it was not moved during the action call above.
                // Need to use coords relative to the parent
                else {
                    after.bounds = after.localBounds;
                    bounds = localBounds;
                    beforeParent.appendChild(element);
                }

                let overflow = 'hidden'; // Looks weird with content sticking out if height is transitioned

                if (scrollers.has(element)) {
                    element.$scrollPlaceholder = DH.createElement({
                        parent : element,
                        style  : {
                            height : element.scrollHeight
                        }
                    });

                    overflow = 'auto';
                }

                // Move element back to where it started
                Object.assign(style, {
                    position  : 'absolute',
                    top       : `${bounds.top}px`,
                    left      : `${bounds.left}px`,
                    width     : `${bounds.width}px`,
                    height    : `${bounds.height}px`,
                    minWidth  : 0,
                    minHeight : 0,
                    padding   : 0,
                    margin    : 0,
                    zIndex    : depth + (zIndex || 0),
                    overflow
                });

                after.processed = true;
            }
            // Existed before but not after = removed
            else {
                const
                    { element, localBounds : bounds, depth, parentElement } = before;

                element.$initial = { removed : true };

                Object.assign(element.style, {
                    position  : 'absolute',
                    top       : `${bounds.top}px`,
                    left      : `${bounds.left}px`,
                    width     : `${bounds.width}px`,
                    height    : `${bounds.height}px`,
                    minWidth  : 0,
                    minHeight : 0,
                    padding   : 0,
                    margin    : 0,
                    zIndex    : depth,
                    overflow  : 'hidden' // Looks weird with content sticking out if height is transitioned
                });

                parentElement.appendChild(element);

                // Inject among non-removed elements to have it transition away
                afterMap.set(id, { element, bounds, removed : true, processed : true });
                afterElements.push(element);
            }
        }

        // Handle new elements
        for (const [, after] of afterMap) {
            if (!after.processed) {
                const
                    { element }              = after,
                    { style, parentElement } = element,
                    bounds                   = after.bounds = after.localBounds;

                element.classList.add('b-dom-transition-adding');

                ObjectHelper.copyProperties(element.$initial = { parentElement }, style, styleProps);

                // Props in `addTransition` will be transitioned
                Object.assign(style, {
                    position : 'absolute',
                    top      : addTransition.top ? 0 : `${bounds.top}px`,
                    left     : addTransition.left ? 0 : `${bounds.left}px`,
                    width    : addTransition.width ? 0 : `${bounds.width}px`,
                    height   : addTransition.height ? 0 : `${bounds.height}px`,
                    opacity  : addTransition.opacity ? 0 : null,
                    zIndex   : parentElement.$depth + 1,
                    overflow : 'hidden' // Looks weird with content sticking out if height is transitioned
                });
            }
        }

        // Restore scroll after modifying layout
        for (const element of scrollers) {
            element.scrollTop = element.$scrollTop;
        }

        // Enable transitions
        outerElement.classList.add('b-dom-transition');
        // Trigger layout, to be able to transition below
        outerElement.firstElementChild.offsetWidth;

        // Transition to new layout
        for (const [, { element, bounds : afterBounds, removed }] of afterMap) {
            if (removed) {
                Object.assign(element.style, {
                    top     : removeTransition.top ? 0 : `${afterBounds.top}px`,
                    left    : removeTransition.left ? 0 : `${afterBounds.left}px`,
                    width   : removeTransition.width ? 0 : `${afterBounds.width}px`,
                    height  : removeTransition.height ? 0 : `${afterBounds.height}px`,
                    opacity : removeTransition.opacity ? 0 : element.$initial.opacity
                });
            }
            else {
                Object.assign(element.style, {
                    top     : `${afterBounds.top}px`,
                    left    : `${afterBounds.left}px`,
                    width   : `${afterBounds.width}px`,
                    height  : `${afterBounds.height}px`,
                    opacity : element.$initial.opacity
                });
            }
        }

        // Wait for transition to finish
        await AsyncHelper.sleep(duration);

        outerElement.classList.remove('b-dom-transition');

        // Restore layout after transition
        for (const element of afterElements) {
            if (element.$initial) {
                if (element.$initial.removed) {
                    element.remove();
                }
                else {
                    ObjectHelper.copyProperties(element.style, element.$initial, styleProps);

                    if (element.$scrollPlaceholder) {
                        element.$scrollPlaceholder.remove();
                        delete element.$scrollPlaceholder;
                    }

                    element.classList.remove('b-dom-transition-adding');

                    element.$initial.parentElement.appendChild(element);
                }
            }
        }

        // Restore scroll positions last when all layout is restored
        for (const element of scrollers) {
            element.scrollTop = element.$scrollTop;
            delete element.$scrollTop;
        }
    }

    //endregion

    static async loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');

            script.src = url;
            script.onload = resolve;
            script.onerror = reject;

            document.head.appendChild(script);
        });
    }

    static isNamedColor(color) {
        return color && !/^(#|hsl|rgb)/.test(color);
    }

    //#region Salesforce hooks

    // Wrap NodeFilter to support salesforce
    static get NodeFilter() {
        return NodeFilter;
    }

    static addChild(parent, child, sibling) {
        parent.insertBefore(child, sibling);
    }

    //#endregion
}

const DH = DomHelper;

let clearTouchTimer;
const
    clearTouchEvent = () => DH.isTouchEvent = false,
    setTouchEvent   = () => {
        DH.isTouchEvent = true;

        // Jump round the click delay
        clearTimeout(clearTouchTimer);
        clearTouchTimer = setTimeout(clearTouchEvent, 400);
    };

// Set event type flags so that mousedown and click handlers can know whether a touch gesture was used.
// This is used. This must stay until we have a unified DOM event system which handles both touch and mouse events.
doc.addEventListener('touchstart', setTouchEvent, true);
doc.addEventListener('touchend', setTouchEvent, true);

DH.canonicalStyles = canonicalStyles;
DH.supportsTemplate = 'content' in doc.createElement('template');
DH.elementPropKey = elementPropKey;
DH.numberRe = numberRe;

//region Polyfills

// TODO: include babels polyfills instead of keeping own?

if (!('children' in Node.prototype)) {
    const elementFilter = node => node.nodeType === node.ELEMENT_NODE;
    Object.defineProperty(Node.prototype, 'children', {
        get : function() {
            return Array.prototype.filter.call(this.childNodes, elementFilter);
        }
    });
}

if (!Element.prototype.matches) {
    Element.prototype.matches =
        Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.oMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function(s) {
            const matches = (this.document || this.ownerDocument).querySelectorAll(s);
            let i = matches.length;
            // eslint-disable-next-line no-empty
            while (--i >= 0 && matches.item(i) !== this) {}
            return i > -1;
        };
}

if (win.Element && !Element.prototype.closest) {
    Node.prototype.closest = Element.prototype.closest = function(s) {
        let el = this;
        if (!doc.documentElement.contains(el)) return null;

        do {
            if (el.matches(s)) return el;
            el = el.parentElement || el.parentNode;
        } while (el !== null && el.nodeType === el.ELEMENT_NODE);
        return null;
    };
}
else {
    // It's crazy that closest is not already on the Node interface!
    // Note that some Node types (eg DocumentFragment) do not have a parentNode.
    Node.prototype.closest = function(selector) {
        return this.parentNode?.closest(selector);
    };
}

// from MDN (public domain): https://developer.mozilla.org/en-US/docs/Web/API/ChildNode/remove
(function(arr) {
    arr.forEach(function(item) {
        if (Object.prototype.hasOwnProperty.call(item, 'remove')) {
            return;
        }
        Object.defineProperty(item, 'remove', {
            configurable : true,
            enumerable   : true,
            writable     : true,
            value        : function remove() {
                this.parentNode && this.parentNode.removeChild(this);
            }
        });
    });
})([Element.prototype, CharacterData.prototype, DocumentType.prototype]);

//endregion

// CTRL/+ and  CTRL/- zoom gestures must invalidate the scrollbar width.
// Window resize is triggered by this operation on Blink (Chrome & Edge), Firefox and Safari.
globalThis.addEventListener('resize', () => scrollBarWidth = null);
