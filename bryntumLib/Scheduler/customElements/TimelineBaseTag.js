import WidgetTag from '../../Core/customElements/WidgetTag.js';

/**
 * @module Scheduler/customElements/TimelineBaseTag
 */

/**
 * Abstract base class for SchedulerTag, SchedulerProTag and GanttTag.
 *
 * @extends Core/customElements/WidgetTag
 * @abstract
 */

export default class TimelineBaseTag extends WidgetTag {
    createInstance(config) {
        const
            me           = this,
            columns      = [],
            resources    = [],
            events       = [],
            assignments  = [],
            dependencies = [];

        // create columns and data
        for (const tag of me.children) {
            if (tag.tagName === 'COLUMN') {
                const columnConfig = Object.assign({}, tag.dataset);

                // if the column title is provide as the tag text
                if (!columnConfig.text && tag.innerHTML) {
                    columnConfig.text = tag.innerHTML;
                }

                if (columnConfig.width) {
                    columnConfig.width = parseInt(columnConfig.width);
                }

                if (columnConfig.flex) {
                    columnConfig.flex = parseInt(columnConfig.flex);
                }
                else if (!columnConfig.width) {
                    columnConfig.flex = 1;
                }

                columns.push(columnConfig);
            }
            else if (tag.tagName === 'DATA') {
                for (const storeType of tag.children) {
                    for (const record of storeType.children) {
                        const { tagName } = storeType;

                        let collection;

                        if (tagName === 'EVENTS' || tagName === 'TASKS') {
                            collection = events;
                        }
                        else if (tagName === 'RESOURCES') {
                            collection = resources;
                        }
                        else if (tagName === 'DEPENDENCIES') {
                            collection = dependencies;
                        }
                        else if (tagName === 'ASSIGNMENTS') {
                            collection = assignments;
                        }

                        me.processRecord(record, collection);
                    }
                }
            }
            else if (tag.tagName === 'PROJECT') {
                config.project = new me.projectModelClass({
                    autoLoad  : true,
                    transport : {
                        load : {
                            url : tag.dataset.loadUrl
                        }
                    }
                });
            }
        }

        // Gantt gets mad if both project and inline data is supplied
        if (events.length) {
            config.events = events;
        }

        if (resources.length) {
            config.resources = resources;
        }

        if (dependencies.length) {
            config.dependencies = dependencies;
        }

        return new this.widgetClass(Object.assign(config, {
            columns
        }));
    }

    processRecord(recordTag, output) {
        const row = {};

        Object.assign(row, this.convertDatasetToConfigs(recordTag.dataset, {}, true));

        if (recordTag.children.length) {
            row.children = [];
            for (const child of recordTag.children) {
                this.processRecord(child, row.children);
            }
        }

        output.push(row);
    }
}
