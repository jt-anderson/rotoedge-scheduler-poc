import Override from '../../mixin/Override.js';
import DomHelper from '../../helper/DomHelper.js';
import { NodeFilter } from './TreeWalker.js';

/*
 * @private
 */

const
    emptyArray  = [],
    emptyObject = {},
    arraySlice  = Array.prototype.slice;

let htmlParser;

function cloneAttributesAndChildren(node) {
    let newNode;

    if (node.nodeType === 1) {
        newNode = document.createElement(node.tagName);

        DomHelper.syncAttributes(node, newNode);

        const children = clone(node.childNodes);
        children.forEach(child => newNode.appendChild(child));
    }
    if (node.nodeType === 3) {
        newNode = document.createTextNode(node.wholeText);
    }

    return newNode;
}

/*
 * `elements` is Node/NodeList, containing nodes produced by DOMParser. Such nodes don't work in LockerService, because
 * they are not cached. Only way to get into the cache is to use `document.createElement`.
 * @param elements
 * @returns {Node|Node[]}
 */
function clone(elements) {
    if (elements instanceof Node) {
        return cloneAttributesAndChildren(elements);
    }
    else {
        const result = [];

        for (let i = 0, l = elements.length; i < l; i++) {
            result.push(cloneAttributesAndChildren(elements[i]));
        }

        return result;
    }
}

// LockerService returns empty content for template element and thus should not be used. When disabled, DOMParser is used
DomHelper.supportsTemplate = false;

class DomHelperOverride {
    static get target() {
        return {
            class : DomHelper
        };
    }

    static getRootElement(element) {
        const root = element.getRootNode?.();

        // Try return root first child first - that would be the container element required by LWC, where we should render
        // our content
        return root?.body || root?.firstChild || root || element.ownerDocument.body;
    }

    // https://github.com/bryntum/support/issues/3008
    static getChildElementCount(element) {
        // Only count element nodes, non-element nodes like text should not be counted
        return element.children.length;
    }

    static isValidFloatRootParent(element) {
        // This is a usual sign of first child of document-fragment
        return element.isConnected && !element.parentElement;
    }

    static createElementFromTemplate(template, options = emptyObject) {
        const { array, raw, fragment } = options;
        let result;

        result = (htmlParser || (htmlParser = new DOMParser())).parseFromString(template, 'text/html').body;

        // We must return a DocumentFragment.
        // myElement.append(fragment) inserts the contents of the fragment, not the fragment itself.
        if (fragment) {
            // Empty string results in *no document.body* on IE!
            const nodes = result ? result.childNodes : emptyArray;

            result = document.createDocumentFragment();

            for (let i = 0, l = nodes.length; i < l; i++) {
                result.appendChild(clone(nodes[i]));
            }

            return result;
        }
        else {
            // Raw means all child nodes are returned
            if (raw) {
                result = result.childNodes;
            }
            // Otherwise, only element nodes
            else {
                result = result.children;
            }

            result = result.length === 1 && !array ? result[0] : arraySlice.call(result);

            return clone(result);
        }
    }

    // Override instance check for DOMEvent. Used for ContextMenuBase and ScheduleMenu
    static isDOMEvent(event) {
        return event && 'stopImmediatePropagation' in event;
    }

    static get NodeFilter() {
        return NodeFilter;
    }

    static addChild(parent, child, sibling) {
        // LWS does not allow to insert to body, only append
        if (parent === document.body) {
            parent.appendChild(child);
        }
        else {
            this._overridden.addChild.call(this, parent, child, sibling);
        }
    }
}

Override.apply(DomHelperOverride);

// Node.contains API fix
// Fixes starting editing on keydown
// https://github.com/salesforce/lwc/issues/1791
const contains = Node.prototype.contains;
Node.prototype.contains = function(value) {
    if (value === this) {
        return true;
    }
    else {
        return contains.apply(this, arguments);
    }
};
