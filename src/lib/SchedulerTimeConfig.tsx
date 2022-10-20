import { ViewPreset } from "@bryntum/scheduler";

const myViewPreset = new ViewPreset({
  id: "defaultPreset", // Unique id value provided to recognize your view preset. Not required, but having it you can simply set new view preset by id: scheduler.viewPreset = 'myPreset'

  name: "Derfault Preset", // A human-readable name provided to be used in GUI, e.i. preset picker, etc.

  tickWidth: 24, // Time column width in horizontal mode
  tickHeight: 50, // Time column height in vertical mode
  displayDateFormat: "HH:mm", // Controls how dates will be displayed in tooltips etc

  shiftIncrement: 1, // Controls how much time to skip when calling shiftNext and shiftPrevious.
  shiftUnit: "day", // Valid values are 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'.
  defaultSpan: 12, // By default, if no end date is supplied to a view it will show 12 hours

  timeResolution: {
    // Dates will be snapped to this resolution
    unit: "minute", // Valid values are 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'.
    increment: 15,
  },

  headers: [
    // This defines your header rows from top to bottom
    // See data formats: https://www.bryntum.com/docs/scheduler/api/Core/helper/DateHelper#formatting-dates
    {
      // For each row you can define 'unit', 'increment', 'dateFormat', 'renderer', 'align', and 'thisObj'
      unit: "month",
      dateFormat: "MMMM Y",
      headerCellCls: "scheduler-header-cell",
    },
    // {
    //   unit: "day",
    //   dateFormat: "M/D (d1)",
    // },
    {
      unit: "day",
      dateFormat: "M/D (d1)",
      headerCellCls: "scheduler-header-cell",
    },
    {
      unit: "day",
      dateFormat: "ddd",
      renderer: function (start: any, end: any, headerConfig: any, index: any) {
        return "";
      },
      headerCellCls: "empty-scheduler-header",
    },
  ],

  columnLinesFor: 1, // Defines header level column lines will be drawn for. Defaults to the last level.
});

export default myViewPreset;
