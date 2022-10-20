import Field from './Field.js';

/**
 * @module Core/widget/PasswordField
 */

/**
 * Password field widget. Wraps native &lt;input type="password"&gt;
 *
 * ```javascript
 * let textField = new PasswordField({
 *     placeholder : 'Enter password'
 * });
 * ```
 *
 * {@inlineexample Core/widget/PasswordField.js}
 * @classType passwordfield
 * @extends Core/widget/Field
 */
export default class PasswordField extends Field {

    // Factoryable type name
    static get type() {
        return 'passwordfield';
    }

    // Factoryable type alias
    static get alias() {
        return 'password';
    }

    static get $name() {
        return 'PasswordField';
    }

    construct(config = {}) {
        config.inputType = 'password';

        super.construct(...arguments);

        this.element.classList.add('b-textfield');
    }
}

// Register this widget type with its Factory
PasswordField.initClass();
