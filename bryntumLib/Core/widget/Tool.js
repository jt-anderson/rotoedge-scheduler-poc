import Widget from './Widget.js';
import ClickRepeater from '../util/ClickRepeater.js';
import Rotatable from './mixin/Rotatable.js';

/**
 * @module Core/widget/Tool
 */

/**
 * Base class for tools.
 *
 * May be configured with a `cls` and a `handler` which is a function (or name of a function)
 * in the owning Panel.
 * @extends Core/widget/Widget
 *
 * @classType tool
 */
export default class Tool extends Widget.mixin(Rotatable) {
    static get $name() {
        return 'Tool';
    }

    // Factoryable type name
    static get type() {
        return 'tool';
    }

    static get configurable() {
        return {
            /**
             * Specify `'start'` to place the tool before the owner's central element (e.g., the `title` of the panel).
             * @config {'start'|'end'}
             * @default 'end'
             * @category Float & align
             */
            align : {
                value   : null,
                $config : {
                    merge : 'replace'
                }
            },

            /**
             * If provided, turns the tool into a link
             * @config {String}
             */
            href : null,

            /**
             * The function to call when this tool is clicked. May be a function or function name
             * prepended by `"up."` that is resolvable in an ancestor component (such as an owning
             * Grid, Scheduler, Calendar, Gantt or TaskBoard)
             * @param {Event} handler.event The DOM event which activated the tool.
             * @param {Core.widget.Panel} handler.panel The owning Panel of the tool.
             * @param {Core.widget.Tool} handler.tool The clicked Tool.
             * @config {Function|String} handler
             */

            /**
             * A {@link Core.util.ClickRepeater } config object to specify how click-and-hold gestures repeat the click
             * action.
             * @config {ClickRepeaterConfig}
             */
            repeat : null
        };
    }

    compose() {
        const { align, href } = this;

        return {
            tag   : href != null ? 'a' : 'button',
            class : {
                [`b-align-${align || 'end'}`] : 1,
                'b-icon'                      : 1
            },
            listeners : {
                click : 'onInternalClick'
            }
        };
    }

    get focusElement() {
        return this.element;
    }

    get panel() {
        // Only fire toolclick if we are in a Panel's header.
        // If a Tool is used in any other context than a Panel tool config, it
        // sohuld be used via its click and action events.
        if (this.parent?.isPanel && this.element?.parentNode === this.parent.headerElement) {
            return this.parent;
        }
    }

    changeAlign(align) {
        return align;  // replace Widget.changeAlign
    }

    onInternalClick(domEvent) {
        const
            me                 = this,
            { handler, panel } = me,
            bryntumEvent       = { domEvent, tool : me };

        // Safari && FF trigger click on disabled button, Chrome does not. Handling it here
        if (me.disabled) {
            return;
        }

        /**
         * Fires when the tool is clicked
         * @event click
         * @param {Core.widget.Tool} source The Tool
         * @param {Event} domEvent DOM event
         */
        me.trigger('click', bryntumEvent);

        // A handler may have resulted in destruction.
        if (!me.isDestroyed) {
            /**
             * Fires when the default action is performed (the button is clicked)
             * @event action
             * @param {Core.widget.Tool} source The Tool
             * @param {Event} domEvent DOM event
             */
            me.trigger('action', bryntumEvent);

            if (!me.isDestroyed && panel?.trigger('toolclick', bryntumEvent) !== false) {
                handler && me.callback(handler, panel, [domEvent, panel, me]);
            }
        }
    }

    onInternalKeyDown(keyEvent) {
        const keyName = keyEvent.key.trim() || keyEvent.code;

        // Don't allow key invocations to bubble and trigger owning
        // widget's key handlers.
        if (keyName === 'Enter') {
            keyEvent.cancelBubble = true;
            keyEvent.stopPropagation();
        }
    }

    updateDisabled(disabled, was) {
        super.updateDisabled(disabled, was);

        disabled && this.repeat?.cancel();
    }

    changeRepeat(repeat, oldRepeat) {
        oldRepeat?.destroy();

        return repeat && ClickRepeater.new({
            element : this.element
        }, repeat);
    }
}

// Register this widget type with its Factory
Tool.initClass();
