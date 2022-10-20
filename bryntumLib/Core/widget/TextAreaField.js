import Field from './Field.js';

/**
 * @module Core/widget/TextAreaField
 */

/**
 * TextAreaField widget for multiline text input. Wraps a native &lt;textarea&gt; HTML element.
 *
 * ```javascript
 * const textAreaField = new TextAreaField({
 *   placeholder: 'Enter some text'
 * });
 *```
 *
 * @extends Core/widget/Field
 * @classType textareafield
 * @inlineexample Core/widget/TextAreaField.js
 */
export default class TextAreaField extends Field {
    static get $name() {
        return 'TextAreaField';
    }

    // Factoryable type name
    static get type() {
        return 'textareafield';
    }

    // Factoryable type alias
    static get alias() {
        return 'textarea';
    }

    static get configurable() {
        return {
            /**
             * The resize style to apply to the `<textarea>` element.
             * @config {'none'|'both'|'horizontal'|'vertical'}
             * @default
             */
            resize : 'none',

            inputAttributes : {
                tag : 'textarea'
            }
        };
    }

    get inputElement() {
        const result = super.inputElement;

        result.style = (result.style || '') + `;resize:${this.resize}`;

        return result;
    }
}

// Register this widget type with its Factory
TextAreaField.initClass();
