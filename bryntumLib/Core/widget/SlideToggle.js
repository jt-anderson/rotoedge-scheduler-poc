import Checkbox from './Checkbox.js';

/**
 * @module Core/widget/SlideToggle
 */

/**
 * SlideToggle field is a variation of {@link Core.widget.Checkbox} with a sliding toggle instead of box with check mark.
 * It wraps <code>&lt;input type="checkbox"&gt;</code>.
 * Color can be specified and you can optionally configure {@link #config-text} to display in a label to the right of
 * the toggle in addition to a standard field {@link #config-label}.
 *
 * {@inlineexample Core/widget/SlideToggle.js vertical}
 *
 * This field can be used as an {@link Grid.column.Column#config-editor} for the {@link Grid.column.Column}.
 *
 * @extends Core/widget/Checkbox
 * @classType slidetoggle
 */
export default class SlideToggle extends Checkbox {
    static get $name() {
        return 'SlideToggle';
    }

    static get type() {
        return 'slidetoggle';
    }

    static get properties() {
        return {
            toggledCls : 'b-slidetoggle-checked'
        };
    }

    construct(config) {
        if (config?.checked) {
            config.cls = (config.cls || '') + ' ' + this.constructor.properties.toggledCls;
        }

        super.construct(config);
    }

    get innerElements() {
        const innerEls = super.innerElements;

        innerEls.splice(1, 0, this.toggleElement);

        if (this.text) {
            innerEls[innerEls.length - 1].class = 'b-slidetoggle-label';
        }
        else {
            // Remove label, not used
            innerEls.pop();
        }
        return innerEls;
    }

    get toggleElement() {
        return {
            class     : 'b-slidetoggle-toggle',
            reference : 'slideToggle',
            children  : [
                {
                    class     : 'b-slidetoggle-thumb',
                    reference : 'slideThumb'
                }
            ]
        };
    }

    internalOnChange() {
        super.internalOnChange();

        this.element.classList[this.value ? 'add' : 'remove'](this.toggledCls);
    }

    updateRtl(...args) {
        // Skip transition when changing `direction`, otherwise the thumb will animate weirdly
        this.slideThumb.style.transition = 'none';

        super.updateRtl(...args);

        this.setTimeout(() => this.slideThumb.style.transition = '', 0);
    }
}

SlideToggle.initClass();
