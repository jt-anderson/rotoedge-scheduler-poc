import StringHelper from '../../Core/helper/StringHelper.js';
import ColumnStore from '../data/ColumnStore.js';
import WidgetColumn from './WidgetColumn.js';
import Checkbox from '../../Core/widget/Checkbox.js';

/**
 * @module Grid/column/CheckColumn
 */

/**
 * A column that displays a checkbox in the cell. The value of the backing field is toggled by the checkbox.
 *
 * Toggling of the checkboxes is disabled if a record is readOnly or if the CellEdit feature is not enabled.
 *
 * This column renders a {@link Core.widget.Checkbox checkbox} into each cell, and it is not intended to be changed.
 * If you want to hide certain checkboxes, you can use the {@link #config-renderer} method to access the checkbox widget
 * as it is being rendered.
 *
 * <div class="note">
 * It is <strong>not valid</strong> to use this column without a {@link #config-field} setting because the checked/unchecked
 * state needs to be backed up in a record because rows are recycled and the state will be lost when a row
 * is reused.
 * </div>
 *
 * @extends Grid/column/WidgetColumn
 *
 * @example
 * new Grid({
 *     appendTo : document.body,
 *
 *     columns : [
 *         {
 *              type: 'check',
 *              field: 'allow',
 *              // In the column renderer, we get access to the record and CheckBox widget
 *              renderer({ record, widgets }) {
 *                  // Hide checkboxes in certain rows
 *                  widgets[0].hidden = record.readOnly;
 *              }
 *         }
 *     ]
 * });
 *
 * @classType check
 * @inlineexample Grid/column/CheckColumn.js
 */
export default class CheckColumn extends WidgetColumn {
    static get $name() {
        return 'CheckColumn';
    }

    //region Config

    static get type() {
        return 'check';
    }

    static get fields() {
        return [
            'checkCls',
            'showCheckAll',
            'onAfterWidgetSetValue',
            'onBeforeWidgetSetValue',
            'callOnFunctions',
            'onBeforeToggle',
            'onToggle',
            'onToggleAll'
        ];
    }

    static get defaults() {
        return {
            align : 'center',

            /**
             * CSS class name to add to checkbox
             * @config {String}
             * @category Rendering
             */
            checkCls : null,

            /**
             * True to show a checkbox in the column header to be able to select/deselect all rows
             * @config {Boolean}
             */
            showCheckAll : false,

            widgets : [{
                type          : 'checkbox',
                valueProperty : 'checked'
            }]
        };
    }

    construct(config, store) {
        super.construct(...arguments);

        const me = this;

        Object.assign(me, {
            externalHeaderRenderer         : me.headerRenderer,
            externalOnBeforeWidgetSetValue : me.onBeforeWidgetSetValue,
            externalOnAfterWidgetSetValue  : me.onAfterWidgetSetValue,

            onBeforeWidgetSetValue : me.internalOnBeforeWidgetSetValue,
            onAfterWidgetSetValue  : me.internalOnAfterWidgetSetValue,
            headerRenderer         : me.internalHeaderRenderer
        });
        if (!me.field && !me.meta.isSelectionColumn) {
            console.warn('CheckColumn MUST be configured with a field, otherwise the checked state will not be persistent. Widgets are recycled and reused');
        }
    }

    doDestroy() {
        this.headerCheckbox?.destroy();
        super.doDestroy();
    }

    internalHeaderRenderer({ headerElement, column }) {
        let returnValue;

        headerElement.classList.add('b-check-header');

        if (column.showCheckAll) {
            headerElement.classList.add('b-check-header-with-checkbox');

            if (column.headerCheckbox) {
                headerElement.appendChild(column.headerCheckbox.element);
            }
            else {
                column.headerCheckbox = new Checkbox({
                    appendTo  : headerElement,
                    owner     : this.grid,
                    ariaLabel : 'L{Checkbox.toggleSelection}',
                    listeners : {
                        change  : 'onCheckAllChange',
                        thisObj : column
                    }
                });
            }
        }
        else {
            returnValue = column.headerText;
        }

        returnValue = column.externalHeaderRenderer ? column.externalHeaderRenderer.call(this, ...arguments) : returnValue;

        return column.showCheckAll ? undefined : returnValue;
    }

    updateCheckAllState(value) {
        if (this.headerCheckbox) {
            this.suspendEvents();
            this.headerCheckbox.checked = value;
            this.resumeEvents();
        }
    }

    onCheckAllChange({ checked }) {
        const me = this;

        // If this column is bound to a field, update all records
        if (me.field) {
            const { store } = me.grid;

            store.beginBatch();
            store.forEach(record => me.updateRecord(record, me.field, checked));
            store.endBatch();
        }

        /**
         * Fired when the header checkbox is clicked to toggle its checked status.
         * @event toggleAll
         * @param {Grid.column.CheckColumn} source This Column
         * @param {Boolean} checked The checked status of the header checkbox.
         */
        me.trigger('toggleAll', { checked });
    }
    //endregion

    internalRenderer({ value, isExport, record, cellElement }) {
        if (isExport) {
            return value == null ? '' : value;
        }

        const result = super.internalRenderer(...arguments);

        if (record.readOnly && !this.meta.isSelectionColumn) {
            cellElement.widgets[0].readOnly = true;
        }

        return result;
    }

    //region Widget rendering

    onBeforeWidgetCreate(widgetCfg, event) {
        widgetCfg.cls = this.checkCls;
    }

    onAfterWidgetCreate(widget, event) {
        event.cellElement.widget = widget;

        widget.on({
            beforeChange : 'onBeforeCheckboxChange',
            change       : 'onCheckboxChange',
            thisObj      : this
        });
    }

    internalOnBeforeWidgetSetValue(widget) {
        widget.record     = widget.cellInfo.record;
        this.isInitialSet = true;
        this.externalOnBeforeWidgetSetValue?.(...arguments);
    }

    internalOnAfterWidgetSetValue(widget) {
        this.isInitialSet = false;
        this.externalOnAfterWidgetSetValue?.(...arguments);
    }

    //endregion

    //region Events

    onBeforeCheckboxChange({ source, checked, userAction }) {
        const
            me         = this,
            { grid }   = me,
            { record } = source.cellInfo;

        // If we are bound to a data field, ensure we respect cellEdit setting
        if ((userAction && me.field && (!grid.features.cellEdit || grid.features.cellEdit.disabled)) || (me.meta.isSelectionColumn && !grid.isSelectable(record) && checked)) {
            return false;
        }

        if (!me.isInitialSet) {
            /**
             * Fired when a cell is clicked to toggle its checked status. Returning `false` will prevent status change.
             * @event beforeToggle
             * @param {Grid.column.Column} source This Column
             * @param {Core.data.Model} record The record for the row containing the cell.
             * @param {Boolean} checked The new checked status of the cell.
             */
            return me.trigger('beforeToggle', { record, checked });
        }
    }

    onCheckboxChange({ source, checked }) {
        if (!this.isInitialSet) {
            const
                me         = this,
                { record } = source.cellInfo,
                { field }  = me;

            if (field) {
                me.updateRecord(record, field, checked);

                // Keep header checkbox in sync with reality.
                if (checked) {
                    // We check whether *all* records in the store are checked including filtered out ones.
                    me.updateCheckAllState(me.grid.store.every(r => r[field], null, true));
                }
                else {
                    me.updateCheckAllState(false);
                }
            }

            /**
             * Fired when a cell is clicked to toggle its checked status.
             * @event toggle
             * @param {Grid.column.Column} source This Column
             * @param {Core.data.Model} record The record for the row containing the cell.
             * @param {Boolean} checked The new checked status of the cell.
             */
            me.trigger('toggle', { record, checked });
        }
    }

    updateRecord(record, field, checked) {
        const setterName = `set${StringHelper.capitalize(field)}`;
        if (record[setterName]) {
            record[setterName](checked);
        }
        else {
            record.set(field, checked);
        }
    }
    //endregion

    onCellKeyDown({ event, cellElement }) {

        // SPACE key toggles the checkbox
        if (event.key === ' ') {
            const checkbox = cellElement.widget;

            checkbox?.toggle();

            // Prevent native browser scrolling
            event.preventDefault();

            // KeyMap and other features (like context menu) must not process this.
            event.handled = true;
        }
    }

    // This function is not meant to be called by any code other than Base#getCurrentConfig().
    // It extracts the current configs (fields) for the column, with special handling for the hooks
    getCurrentConfig(options) {
        const result = super.getCurrentConfig(options);

        delete result.onBeforeWidgetSetValue;
        delete result.onAfterWidgetSetValue;

        if (this.externalOnBeforeWidgetSetValue) {
            result.onBeforeWidgetSetValue = this.externalOnBeforeWidgetSetValue;
        }

        if (this.externalOnAfterWidgetSetValue) {
            result.onAfterWidgetSetValue = this.externalOnAfterWidgetSetValue;
        }

        return result;
    }
}

ColumnStore.registerColumnType(CheckColumn, true);
