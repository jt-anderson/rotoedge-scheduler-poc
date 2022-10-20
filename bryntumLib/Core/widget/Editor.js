import Widget from './Widget.js';
import Container from './Container.js';
import ObjectHelper from '../helper/ObjectHelper.js';
import EventHelper from '../helper/EventHelper.js';
import LocaleManager from '../../Core/localization/LocaleManager.js';
import Field from '../../Core/widget/Field.js';
import './layout/Fit.js';
import StringHelper from '../helper/StringHelper.js';
import DomHelper from '../helper/DomHelper.js';
import ResizeMonitor from '../helper/ResizeMonitor.js';
import Rectangle from '../helper/util/Rectangle.js';

/**
 * @module Core/widget/Editor
 */

/**
 * Displays an input field, optionally editing a field of a record at a particular position.
 *
 * Offers events to signal edit completion upon `ENTER` or focus loss (if configured to do so),
 * or edit cancellation on `ESC`, or focus loss if configured that way.
 * @extends Core/widget/Container
 *
 * @classType Editor
 */
export default class Editor extends Container {
    //region Config
    static get $name() {
        return 'Editor';
    }

    // Factoryable type name
    static get type() {
        return 'editor';
    }

    static get configurable() {
        return {
            positioned : true,
            hidden     : true,
            layout     : 'fit',

            /**
             * The alignment config for how this editor aligns to a target when asked to {@link #function-startEdit}
             * @config {Object}
             * @default
             */
            align : {
                align  : 't0-t0',
                offset : [0, 0]
            },

            /**
             * Controls whether to hide the target element when asked to {@link #function-startEdit}
             * @config {Boolean}
             * @default
             */
            hideTarget : false,

            /**
             * By default an Editor matches both dimensions, width and height of the element
             * it is targeted at in the {@link #function-startEdit} function.
             *
             * Configure this as false to allow the editor's configured dimensions, or its
             * CSS-imposed dimensions size it.
             *
             * This may also operate with more granularity by specifying both dimensions
             * in an object:
             *
             * ```javascript
             *     // Editor can exceed its target's height
             *     matchSize : {
             *         width  : true,
             *         height : false
             *     }
             * ```
             * @config {Boolean|Object}
             * @default
             */
            matchSize : true,

            /**
             * Controls whether the editor should match target element's font when asked to {@link #function-startEdit}
             * @config {Boolean}
             * @default
             */
            matchFont : true,

            /**
             * Controls whether the editor should expand its width if the input field has overflow {@link #function-startEdit}
             * @config {Boolean}
             * @default
             */
            fitTargetContent : false,

            /**
             * A config object, or the `type` string of the widget (usually a {@link Core.widget.Field Field} subclass,
             * i.e. {@link Core.widget.TextField TextField}) which this editor will encapsulate.
             * @config {Object|String}
             * @default
             */
            inputField : 'textfield',

            /**
             * What action should be taken when focus moves out of the editor, either by `TAB` or clicking outside.
             * May be `'complete'` or `'cancel`'. Any other value results in no action being taken upon focus leaving the editor
             * leaving the application to listen for the {@link #event-focusOut focusOut} event.
             * @config {'complete'|'cancel'|null}
             * @default
             */
            blurAction : 'complete',

            /**
             * The name of the `key` which completes the edit.
             *
             * See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values for key names.
             * @config {String}
             * @default
             */
            completeKey : 'Enter',

            /**
             * The name of the `key` which cancels the edit.
             *
             * See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values for key names.
             * @config {String}
             * @default
             */
            cancelKey : 'Escape',

            /**
             * How to handle a request to complete the edit if the field is invalid. There are three choices:
             *  - `block` The default. The edit is not exited, the field remains focused.
             *  - `allow` Allow the edit to be completed.
             *  - `revert` The field value is reverted and the edit is completed.
             * @config {'block'|'allow'|'revert'}
             * @default
             */
            invalidAction : 'block',

            /**
             * Configure as `true` to have editing complete as soon as the field fires its `change` event.
             * @config {Boolean}
             * @default false
             */
            completeOnChange : null,

            isolateFields : true
        };
    }

    //endregion

    //region Events

    /**
     * Fired before the editor is shown to start an edit operation. Returning `false` from a handler vetoes the edit operation.
     * @event beforeStart
     * @param {HTMLElement} target The element which the Editor is to overlay to edit its content.
     * @param {Core.data.Model} [record] The record being edited.
     * @param {String} [field] The name of the field if a record is being edited.
     * @param {Object} value - The value to be edited.
     * @param {String|Object} align - How to align the editor. See {@link #function-alignTo}
     * @param {Boolean} hideTarget `true` if the target is to be hidden during the edit.
     * @param {Boolean|Object} matchSize Whether to match the target size. See {@link #config-matchSize}
     * @param {Boolean} matchFont Whether to match the target's font. See {@link #config-matchFont}
     * @param {Boolean} focus Whether to focus the editor's field.
     * @preventable
     */
    /**
     * Fired when an edit operation has begun.
     * @event start
     * @param {Object} value - The starting value of the field.
     * @param {Core.widget.Editor} source - The Editor that triggered the event.
     */
    /**
     * Fired when an edit completion has been requested, either by `ENTER`, or focus loss (if configured to complete on blur).
     * The completion may be vetoed, in which case, focus is moved back into the editor.
     * @event beforeComplete
     * @param {Object} oldValue - The original value.
     * @param {Object} value - The new value.
     * @param {Core.widget.Editor} source - The Editor that triggered the event.
     * @param {Function} [finalize] An async function may be injected into this property
     * which performs asynchronous finalization tasks such as complex validation of confirmation. The
     * value `true` or `false` must be returned.
     * @param {Object} [finalize.context] An object describing the editing context upon requested completion of the edit.
     * @preventable
     */
    /**
     * Edit has been completed, and any associated record or element has been updated.
     * @event complete
     * @param {Object} oldValue - The original value.
     * @param {Object} value - The new value.
     * @param {Core.widget.Editor} source - The Editor that triggered the event.
     */
    /**
     * Fired when cancellation has been requested, either by `ESC`, or focus loss (if configured to cancel on blur).
     * The cancellation may be vetoed, in which case, focus is moved back into the editor.
     * @event beforeCancel
     * @param {Object} oldValue - The original value.
     * @param {Object} value - The new value.
     * @param {Event} event - Included if the cancellation was triggered by a DOM event
     * @param {Core.widget.Editor} source - The Editor that triggered the event.
     * @preventable
     */
    /**
     * Edit has been canceled without updating the associated record or element.
     * @event cancel
     * @param {Object} oldValue - The original value.
     * @param {Object} value - The value of the field.
     * @param {Event} event - Included if the cancellation was triggered by a DOM event
     * @param {Core.widget.Editor} source - The Editor that triggered the event.
     */
    /**
     * Fire to relay a `keypress` event from the field.
     * @event keypress
     * @param {Event} event - The key event.
     */

    //endregion

    afterConfigure() {
        const me = this;

        super.afterConfigure();

        me.onTargetSizeChange = me.onTargetSizeChange.bind(me);

        EventHelper.on({
            element     : me.element,
            keydown     : 'onKeyDown',
            contextmenu : 'stopMouseEvents',
            mousedown   : 'stopMouseEvents',
            mouseover   : 'stopMouseEvents',
            mouseout    : 'stopMouseEvents',
            mouseup     : 'stopMouseEvents',
            click       : 'stopMouseEvents',
            dblclick    : 'stopMouseEvents',
            thisObj     : me
        });

        me.on({
            beforeHide : 'beforeEditorHide',
            hide       : 'afterEditorHide',
            thisObj    : me
        });

        LocaleManager.on({
            locale  : 'onLocaleChange',
            thisObj : me
        });
    }

    onLocaleChange() {
        const { inputField } = this;

        if (inputField && !inputField.isDestroyed) {
            // All Field subclasses have this method, but if `inputField` is a custom widget,
            // `syncInputFieldValue` has to be implemented
            if (inputField.syncInputFieldValue) {
                inputField.syncInputFieldValue(true);
            }
            else if (!(inputField instanceof Field)) {

            }
        }
    }

    /**
     * Start editing
     * @param {Object} editObject An object containing details about what to edit.
     * @param {HTMLElement|Core.helper.util.Rectangle} editObject.target the element or Rectangle to align to.
     * @param {String} [editObject.align=t0-t0] How to align to the target.
     * @param {Boolean} [editObject.matchSize=true] Match editor size to target size.
     * @param {Boolean} [editObject.matchFont=true] Match editor's font-size size to target's font-size.
     * @param {Core.data.Model} [editObject.record] The record to edit.
     * @param {String} [editObject.field] The field name in the record to edit. This defaults to the `name` of the
     * {@link #config-inputField}. Also if record has method set + capitalized field, method will be called, e.g. if
     * record has method named `setFoobar` and this config is `foobar`, then instead of `record.foobar = value`,
     * `record.setFoobar(value)` will be called.
     * @param {Object} [editObject.value] The value to edit.
     * @param {Boolean} [editObject.focus=true] Focus the field.
     * @param {Boolean} [editObject.fitTargetContent] Pass `true` to allow the Editor to expand beyond the width of its
     * target element if its content overflows horizontally. This is useful if the editor has triggers to display, such
     * as a combo.
     * @returns {Boolean} `true` if editing has been started, `false` if an {@link #event-beforeStart} listener
     * has vetoed the edit.
     */
    startEdit(editObject) {
        const me = this;

        editObject = ObjectHelper.assignIf(editObject, {
            align            : me.align,
            hideTarget       : me.hideTarget,
            matchSize        : me.matchSize,
            matchFont        : me.matchFont,
            fitTargetContent : me.fitTargetContent,
            focus            : true
        });

        if (me.trigger('beforeStart', editObject) !== false) {
            const
                {
                    target,
                    hideTarget,
                    matchSize,
                    matchFont,
                    fitTargetContent,
                    record,
                    field = me.inputField.name,
                    focus
                } = editObject,
                { inputField }   = me,
                { input }        = inputField,
                targetFontSize   = DomHelper.getStyleValue(target, 'font-size'),
                targetFontFamily = DomHelper.getStyleValue(target, 'font-family');

            let { value, align } = editObject;

            if (record && field) {
                me.record = record;
                me.dataField = field;
                if (value === undefined) {
                    value = record[field];
                }
            }

            if (matchSize) {
                if (target instanceof HTMLElement) {
                    me.updateSize(target, matchSize);
                }

                // If we are editing and sizing based on an element,
                // we need to update editor size if grid cell size changes
                // Removed in 'hide' listener
                if (target instanceof HTMLElement) {
                    ResizeMonitor.addResizeListener(target, me.onTargetSizeChange);
                }
            }

            if (input) {
                if (matchFont) {
                    input.style.fontSize = targetFontSize;
                    input.style.fontFamily = targetFontFamily;
                }
                else {
                    input.style.fontSize = input.style.fontFamily = '';
                }
            }

            me.assigningValues = true;

            // In case our finalize code set it to invalid, start it clear of errors.
            if (inputField.clearError) {
                inputField.clearError();
            }

            inputField.value = value;

            me.assigningValues = false;

            // Simplest form is 't0-t0', but may be passed as full object spec.
            // It gets expanded below so must be an object.
            if (typeof align === 'string') {
                align = { align };
            }

            // Allow target to be out of view. We always align to it.
            me.showBy({
                target,
                allowTargetOut : true,
                ...align
            });

            if (fitTargetContent) {
                // Input doesn't fit, so widen it
                const overflow = input.scrollWidth - input.clientWidth;
                if (overflow > 0) {
                    me.width += overflow + DomHelper.scrollBarWidth;
                }
            }

            focus && inputField.focus?.();

            if (target.nodeType === Element.ELEMENT_NODE) {
                target.classList.add('b-editing');
                if (hideTarget) {
                    target.classList.add('b-hide-visibility');
                }
            }

            me.editing = true;

            // Passed value may have been '10/06/2019', send the live field value to startedit
            me.trigger('start', { value : inputField.value });

            if (Array.isArray(inputField.value) && inputField.editingRecords && inputField.value[0]?.isModel) {
                // If this editor is editing model instances, save a cloned copy in case fields
                // are changed
                me.oldValue = inputField.value.map(record => record.copy(record.id));
            }
            else {
                me.oldValue = inputField.value;

                // If the value from the value getter is an array, we must clone it because
                // if it's the same *instance*, the ObjectHelper.isEqual test in completeEdit
                // will find that there are no changes.
                if (Array.isArray(me.oldValue)) {
                    me.oldValue = me.oldValue.slice();
                }
            }

            // The initialValue is what the revertOnEscape uses by preference before it uses its valueOnFocus.
            // In an Editor, it can focus in and out but still need that correct initial value.
            inputField.initialValue = me.oldValue;

            return true;
        }

        return false;
    }

    refreshEdit() {
        if (this.isVisible) {
            const { record, dataField, inputField } = this;

            if (record && dataField) {
                const value = record[dataField];

                // Only update the field if the value has changed
                if (!ObjectHelper.isEqual(inputField.value, value)) {
                    inputField.value = value;
                }
            }
        }
    }

    finishEdit() {
        const { target, aligningToElement } = this.lastAlignSpec;

        if (aligningToElement) {
            target.classList.remove('b-editing');
            target.classList.remove('b-hide-visibility');
        }

        this.editing = false;

        // Internal event, to be able to destroy etc no matter if completed or cancelled
        this.trigger('finishEdit');
    }

    onKeyDown(event) {
        const me = this;

        switch (event.key) {
            case me.completeKey:
                me.completeEdit(null, event);
                event.stopImmediatePropagation();
                break;
            case me.cancelKey:
                me.cancelEdit(event);
                event.stopImmediatePropagation();
                break;
        }

        // In case destroyed by complete or cancel
        me.trigger?.('keydown', { event });
    }

    stopMouseEvents(e) {
        // React editor wrapper uses this flag to enable mouse events pass through to editor
        if (!this.allowMouseEvents) {
            e.stopPropagation();
        }
    }

    onFocusOut(event) {
        super.onFocusOut(event);

        const me = this;

        if (!me.isFinishing && me.editing) {
            // Calls have different signatures.
            switch (me.blurAction) {
                case 'cancel':
                    me.cancelEdit(event);
                    break;
                case 'complete':
                    me.completeEdit(null, event);
            }
        }
    }

    /**
     * Complete the edit, and, if associated with a record, update the record if possible.
     * If editing is completed, the editor is hidden.
     *
     * If the field is invalid, the `{@link #config-invalidAction}` config is used to decide
     * upon the course of action.
     *
     * If a {@link #event-beforeComplete} handler returns `false` then editing is not completed.
     *
     * If the field's values has not been changed, then editing is terminated through {@link #function-cancelEdit}.
     *
     * @returns {Boolean} `true` if editing ceased, `false` if the editor is still active.
     */
    async completeEdit(finalize, triggeredByEvent) {
        const me = this,
            { inputField, oldValue, record } = me,
            invalidAction = inputField.invalidAction || (inputField.allowInvalid === false ? 'block' : me.invalidAction),
            { value } = inputField;

        // If we are not editing, we should manipulated the field or not fire any events
        if (!me.isVisible) {
            return;
        }

        // If we're configured not to allow invalid values, refocus the field in case complete was triggered by focusout.
        if (!inputField.isValid && invalidAction !== 'allow') {
            if (invalidAction === 'block') {
                inputField.focus?.();
                return false;
            }
            else if (invalidAction === 'revert') {
                me.cancelEdit(triggeredByEvent);
                return true;
            }
        }
        // No change means a cancel.
        else if (ObjectHelper.isEqual(value, oldValue)) {
            me.cancelEdit(triggeredByEvent);
            return true;
        }
        // Allow veto of the completion
        else {
            const context = { inputField, record, value, oldValue };

            if (me.trigger('beforeComplete', context) === false) {
                inputField.focus?.();
            }
            else {
                // CellEdit#onEditorBeforeComplete injects editorContext into the basic context
                if (!finalize) {
                    finalize = context.finalize || (context.editorContext?.finalize);
                }

                // Allow async finalization of the editing, implementer may want to show a confirmation popup etc
                if (finalize) {
                    let result = await finalize(context);

                    if (result === true) {
                        me.onEditComplete();
                    }
                    else {
                        if (inputField.setError) {
                            const
                                error = result || inputField.invalidValueError,
                                clearError = () => {
                                    listeners();
                                    inputField.clearError(error);
                                },
                                listeners = inputField.on({
                                    change : clearError,
                                    input  : clearError
                                });

                            // Mark as invalid. Because this is decided upon without the knowledge
                            // of the field, this state will be rescinded upon the next change of
                            // input field.
                            inputField.setError(error);
                        }
                        if (invalidAction === 'block') {
                            inputField.focus?.();
                        }
                        else if (invalidAction === 'revert') {
                            inputField.value = oldValue;
                            result = true;
                        }
                        result = false;
                    }
                    return result;
                }
                // Successful completion
                else {
                    me.onEditComplete();
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Cancel the edit and hide the editor.
     */
    cancelEdit(triggeredByEvent) {
        const me = this,
            { inputField, oldValue } = me,
            { value } = inputField;

        if (me.editing && !me.isFinishing && me.trigger('beforeCancel', { value, oldValue, event : triggeredByEvent }) !== false) {
            // Hiding must not trigger our blurAction
            me.isFinishing = true;
            me.hide();
            me.trigger('cancel', { value, oldValue, event : triggeredByEvent });
            me.finishEdit();
            me.isFinishing = false;
        }
    }

    // Handle updating what needs to be updated.
    onEditComplete() {
        const me = this,
            { record, dataField, inputField, oldValue } = me,
            { value } = inputField;

        if (!me.isFinishing) {
            // Hiding must not trigger our blurAction
            me.isFinishing = true;
            me.hide();

            if (record) {
                const setterName = `set${StringHelper.capitalize(dataField)}`;

                if (record[setterName]) {
                    record[setterName](value);
                }
                else if (dataField.includes('.')) {
                    record.set(dataField, value);
                }
                else {
                    record[dataField] = value;
                }
            }

            me.trigger('complete', { value, oldValue });
            me.finishEdit();
            me.isFinishing = false;
        }
    }

    doDestroy() {
        if (this.createdInputField) {
            this.inputField.destroy();
        }
        super.doDestroy();
    }

    set owner(owner) {
        this._owner = owner;
    }

    // This is a positioned widget appended to a Widget's contentElement. It may have no owner link.
    // Grab the owner by finding what widget it is inside.
    get owner() {
        return this._owner || Widget.fromElement(this.element.parentNode);
    }

    changeInputField(inputField, oldInputField) {
        const me = this;

        if (oldInputField) {
            oldInputField.destroy();
        }

        if (typeof inputField === 'string') {
            inputField = {
                type : inputField
            };
        }

        if (!(inputField instanceof Widget)) {
            inputField = Widget.create(inputField);
            me.createdInputField = true; // So we know we can destroy it
        }

        if (me.completeOnChange) {
            inputField.on({
                change  : 'onInputFieldChange',
                thisObj : me
            });
        }

        inputField.parent = me;
        return inputField;
    }

    updateInputField(inputField) {
        this.removeAll();
        this.add(inputField);
    }

    get inputField() {
        return this.items[0];
    }

    onInputFieldChange() {
        if (this.containsFocus) {
            this.completeEdit();
        }
    }

    onTargetSizeChange(resizedElement, oldRect, newRect) {
        if (oldRect && newRect) {
            this.updateSize(resizedElement);
        }
    }

    updateSize(targetEl, matchSize = this.lastMatchSize) {
        const
            me   = this,
            rect = Rectangle.inner(targetEl);

        // matchSize is granular allowing either dimension to be matched
        me.width = matchSize.width === false ? 'auto' : rect.width - me.align.offset[0];
        me.height = matchSize.height === false ? 'auto' : rect.height;

        me.lastMatchSize = matchSize;
    }

    beforeEditorHide() {
        // If we are hidden during an edit, *not as part of our finishing sequence*
        // then cancel the edit. For example we were scrolled out of view with
        // align having allowTargetOut : false
        if (this.editing && !this.isFinishing) {
            this.cancelEdit();
        }
    }

    afterEditorHide() {
        // Floating Widgets automatically remove themselves.
        // Editors which are positioned also need to get out the way of content
        // to allow content updating to be unobstructed.
        if (this.positioned) {
            this.element.remove();
        }
        ResizeMonitor.removeResizeListener(this.lastAlignSpec.target, this.onTargetSizeChange);
    }
}

// Register this widget type with its Factory
Editor.initClass();
