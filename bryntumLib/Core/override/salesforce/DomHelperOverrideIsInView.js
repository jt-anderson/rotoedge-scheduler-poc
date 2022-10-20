/**
 * Fixes exception thrown by DomHelper.isInView method which does not expect secure elements and modified APIs
 * https://github.com/bryntum/support/issues/4127
 * @private
 */
import DomHelper from '../../helper/DomHelper.js';
import Rectangle from '../../helper/util/Rectangle.js';
import Override from '../../mixin/Override.js';

const getOffsetParent = node => node.ownerSVGElement ? node.ownerSVGElement.parentNode : node.offsetParent;

class DomHelperOverrideIsInView {
    static target = { class : DomHelper }

    static getViewportIntersection(target, docRect, method) {
        const
            { parentNode }    = target,
            { parentElement } = (parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? target.getRootNode().host : target),
            peStyle           = parentElement.ownerDocument.defaultView.getComputedStyle(parentElement),
            parentScroll      = peStyle.overflowX !== 'visible' || peStyle.overflowY !== 'visible',
            offsetParent      = getOffsetParent(target);

        let result = Rectangle.from(target, null, true);

        // Patch taken from this forum post: https://www.bryntum.com/forum/viewtopic.php?p=101138#p101138
        // There is no way we can test this problem on our side as it requires much more complicated application layout.
        // So we trust people's judgement and experience with salesforce apps.
        for (
            let viewport = parentScroll ? target.parentNode : offsetParent;
            result && viewport && viewport !== document.documentElement;
            viewport = viewport.parentNode
        ) {
            // Skip shadow root nodes and custom elements.
            while (viewport && viewport.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                viewport = viewport.host?.parentNode;
            }
            if (!viewport) {
                break;
            }

            const
                isTop        = viewport === document.body,
                style        = viewport.ownerDocument.defaultView.getComputedStyle(viewport),
                viewportRect = isTop ? docRect : Rectangle.inner(viewport, null, true);

            // If this level allows overflow to show, don't clip. Obv, <body> can't show overflowing els.
            if (isTop || style.overflow !== 'visible') {
                result = viewportRect[method](result, false, true);
            }
        }
        return result;
    }
}

Override.apply(DomHelperOverrideIsInView);
