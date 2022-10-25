import { ViewPreset } from "@bryntum/scheduler";

// https://www.bryntum.com/docs/scheduler/api/Core/helper/DateHelper#formatting-dates

const dayPreset = new ViewPreset({
  id: "dayPreset", // Unique id value provided to recognize your view preset. Not required, but having it you can simply set new view preset by id: scheduler.viewPreset = 'myPreset'
  name: "Day", // A human-readable name provided to be used in GUI, e.i. preset picker, etc.
  tickWidth: 24, // Time column width in horizontal mode
  tickHeight: 50, // Time column height in vertical mode
  displayDateFormat: "HH:mm", // Controls how dates will be displayed in tooltips etc
  shiftIncrement: 1, // Controls how much time to skip when calling shiftNext and shiftPrevious.
  shiftUnit: "hour", // Valid values are 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'.
  defaultSpan: 24, // By default, if no end date is supplied to a view it will show 12 hours
  timeResolution: {
    // Dates will be snapped to this resolution
    unit: "minute", // Valid values are 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'.
    increment: 5,
  },
  mainHeaderLevel: 1,
  headers: [
    // This defines your header rows from top to bottom
    {
      unit: "day",
      dateFormat: "M/D (ddd)",
      headerCellCls: "scheduler-header-cell",
    },
    {
      unit: "hour",
      dateFormat: "h A",
      headerCellCls: "scheduler-header-cell",
    },
    {
      unit: "hour",
      dateFormat: "h A",
      renderer: function (start: any, end: any, headerConfig: any, index: any) {
        return "";
      },
      headerCellCls: "empty-scheduler-header",
    },
  ],
  columnLinesFor: 1, // Defines header level column lines will be drawn for. Defaults to the last level.
});

const weekPreset = new ViewPreset({
  id: "oneWeekPreset", // Unique id value provided to recognize your view preset. Not required, but having it you can simply set new view preset by id: scheduler.viewPreset = 'myPreset'
  name: "One Week", // A human-readable name provided to be used in GUI, e.i. preset picker, etc.
  tickWidth: 24, // Time column width in horizontal mode
  tickHeight: 50, // Time column height in vertical mode
  displayDateFormat: "HH:mm", // Controls how dates will be displayed in tooltips etc
  shiftIncrement: 1, // Controls how much time to skip when calling shiftNext and shiftPrevious.
  shiftUnit: "day", // Valid values are 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'.
  defaultSpan: 7, // By default, if no end date is supplied to a view it will show 12 hours
  timeResolution: {
    // Dates will be snapped to this resolution
    unit: "minute", // Valid values are 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'.
    increment: 15,
  },
  mainHeaderLevel: 1,
  headers: [
    // This defines your header rows from top to bottom
    {
      // For each row you can define 'unit', 'increment', 'dateFormat', 'renderer', 'align', and 'thisObj'
      unit: "month",
      dateFormat: "MMMM",
      headerCellCls: "scheduler-header-cell",
    },
    {
      unit: "day",
      dateFormat: "M/D (d1)",
      headerCellCls: "scheduler-header-cell",
    },
    {
      unit: "day",
      dateFormat: "M/D (d1)",
      renderer: function (start: any, end: any, headerConfig: any, index: any) {
        return "";
      },
      headerCellCls: "empty-scheduler-header",
    },
  ],
  columnLinesFor: 1, // Defines header level column lines will be drawn for. Defaults to the last level.
});

const twoWeekPreset = new ViewPreset({
  id: "twoWeekPreset", // Unique id value provided to recognize your view preset. Not required, but having it you can simply set new view preset by id: scheduler.viewPreset = 'myPreset'
  name: "Two Weeks", // A human-readable name provided to be used in GUI, e.i. preset picker, etc.
  tickWidth: 24, // Time column width in horizontal mode
  tickHeight: 50, // Time column height in vertical mode
  displayDateFormat: "HH:mm", // Controls how dates will be displayed in tooltips etc
  shiftIncrement: 1, // Controls how much time to skip when calling shiftNext and shiftPrevious.
  shiftUnit: "day", // Valid values are 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'.
  defaultSpan: 14, // By default, if no end date is supplied to a view it will show 12 hours
  timeResolution: {
    // Dates will be snapped to this resolution
    unit: "minute", // Valid values are 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'.
    increment: 15,
  },
  mainHeaderLevel: 1,
  headers: [
    // This defines your header rows from top to bottom
    {
      // For each row you can define 'unit', 'increment', 'dateFormat', 'renderer', 'align', and 'thisObj'
      unit: "month",
      dateFormat: "MMMM",
      headerCellCls: "scheduler-header-cell",
    },
    {
      unit: "day",
      dateFormat: "M/D (d1)",
      headerCellCls: "scheduler-header-cell",
    },
    {
      unit: "day",
      dateFormat: "M/D (d1)",
      renderer: function (start: any, end: any, headerConfig: any, index: any) {
        return "";
      },
      headerCellCls: "empty-scheduler-header",
    },
  ],
  columnLinesFor: 1, // Defines header level column lines will be drawn for. Defaults to the last level.
});

const monthPreset = new ViewPreset({
  id: "monthPreset", // Unique id value provided to recognize your view preset. Not required, but having it you can simply set new view preset by id: scheduler.viewPreset = 'myPreset'
  name: "Month", // A human-readable name provided to be used in GUI, e.i. preset picker, etc.
  tickWidth: 24, // Time column width in horizontal mode
  tickHeight: 50, // Time column height in vertical mode
  displayDateFormat: "HH:mm", // Controls how dates will be displayed in tooltips etc
  shiftIncrement: 1, // Controls how much time to skip when calling shiftNext and shiftPrevious.
  shiftUnit: "day", // Valid values are 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'.
  defaultSpan: 31, // By default, if no end date is supplied to a view it will show 12 hours
  timeResolution: {
    // Dates will be snapped to this resolution
    unit: "minute", // Valid values are 'millisecond', 'second', 'minute', 'hour', 'day', 'week', 'month', 'quarter', 'year'.
    increment: 15,
  },
  mainHeaderLevel: 1,
  headers: [
    {
      // For each row you can define 'unit', 'increment', 'dateFormat', 'renderer', 'align', and 'thisObj'
      unit: "month",
      dateFormat: "MMMM Y",
      headerCellCls: "scheduler-header-cell",
    },
    {
      unit: "days",
      dateFormat: "D",
      headerCellCls: "scheduler-header-cell",
    },
    {
      unit: "days",
      dateFormat: "D",
      renderer: function (start: any, end: any, headerConfig: any, index: any) {
        return "";
      },
      headerCellCls: "empty-scheduler-header",
    },
  ],
  columnLinesFor: 1, // Defines header level column lines will be drawn for. Defaults to the last level.
});

const customPresets = [dayPreset, weekPreset, twoWeekPreset, monthPreset];

export { customPresets };
