import Tooltip from '../../../Core/widget/Tooltip.js';

/**
 * @module Scheduler/feature/mixin/DependencyTooltip
 */

const
    // Map dependency type to side of a box, for displaying an icon in the tooltip
    fromBoxSide = [
        'start',
        'start',
        'end',
        'end'
    ],
    toBoxSide   = [
        'start',
        'end',
        'start',
        'end'
    ];

/**
 * Mixin that adds tooltip support to the {@link Scheduler/feature/Dependencies} feature.
 * @mixin
 */
export default Target => class DependencyTooltip extends Target {
    static $name = 'DependencyTooltip';

    static configurable = {
        /**
         * Set to true to show a tooltip when hovering a dependency line
         * @config {Boolean}
         */
        showTooltip : true,

        /**
         * A template function allowing you to configure the contents of the tooltip shown when hovering a
         * dependency line. You can return either a HTML string or a {@link DomConfig} object.
         * @prp {Function} tooltipTemplate
         * @param {Scheduler.model.DependencyBaseModel} dependency The dependency record
         * @returns {String|Object}
         */
        tooltipTemplate(dependency) {
            return {
                children : [{
                    className : 'b-sch-dependency-tooltip',
                    children  : [
                        { tag : 'label', text : this.L('L{Dependencies.from}') },
                        { text : dependency.fromEvent.name },
                        { className : `b-sch-box b-${dependency.fromSide || fromBoxSide[dependency.type]}` },
                        { tag : 'label', text : this.L('L{Dependencies.to}') },
                        { text : dependency.toEvent.name },
                        { className : `b-sch-box b-${dependency.toSide || toBoxSide[dependency.type]}` }
                    ]
                }]
            };
        },

        /**
         * A tooltip config object that will be applied to the dependency hover tooltip. Can be used to for example
         * customize delay
         * @config {TooltipConfig}
         */
        tooltip : {
            $config : 'nullify',

            value : {}
        }
    };

    changeTooltip(tooltip, old) {
        const me = this;

        old?.destroy();

        if (!me.showTooltip || !tooltip) {
            return null;
        }

        return Tooltip.new({
            align          : 'b-t',
            id             : `${me.client.id}-dependency-tip`,
            //TODO: need some way better to specify this. maybe each feature should be queried?
            forSelector    : `.b-timelinebase:not(.b-eventeditor-editing):not(.b-resizing-event):not(.b-dragcreating):not(.b-dragging-event):not(.b-creating-dependency) .${me.baseCls}`,
            forElement     : me.client.timeAxisSubGridElement,
            showOnHover    : true,
            hoverDelay     : 0,
            hideDelay      : 0,
            anchorToTarget : false,
            textContent    : false, // Skip max-width setting
            trackMouse     : false,
            getHtml        : me.getHoverTipHtml.bind(me)
        }, tooltip);
    }

    /**
     * Generates DomConfig content for the tooltip shown when hovering a dependency
     * @param {Object} tooltipConfig
     * @returns {DomConfig} DomConfig used as tooltips content
     * @private
     */
    getHoverTipHtml({ activeTarget }) {
        return this.tooltipTemplate(this.resolveDependencyRecord(activeTarget));
    }
};
