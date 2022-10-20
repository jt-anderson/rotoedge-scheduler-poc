/**
 * Application configuration
 */
import { SchedulerConfig } from "@bryntum/scheduler";
import myViewPreset from "./SchedulerTimeConfig";
import { DateHelper } from "@bryntum/scheduler";

/****** Global Variables *******/

// The heigh of each scheduler bar + its margin
const ROW_HEIGHT: number = 45;
const ROW_MARGIN: number = 5;

// configured start date and end date
const START_DATE = new Date();
const END_DATE = DateHelper.add(START_DATE, 5, "days");

// if we should only include working hours (configured with vars below). Note:
// this should always be true- but can be useful to turn off for debugging
const ONLY_WORKING_HOURS = false;

// variables configuring the boundaries for the work week
const WORKING_START_DAY = 1; // Monday
const WORKING_END_DAY = 6; // Saturday
const WORKING_START_HOUR = 8; // 8:00 AM
const WORKING_END_HOUR = 17; // 5:00 PM

const schedulerConfig: Partial<SchedulerConfig> = {
  startDate: START_DATE,
  endDate: END_DATE,
  // https://www.bryntum.com/docs/scheduler/api/Scheduler/view/TimelineBase#config-workingTime
  workingTime: {
    fromDay: ONLY_WORKING_HOURS ? WORKING_START_DAY : undefined,
    toDay: ONLY_WORKING_HOURS ? WORKING_END_DAY : undefined,
    fromHour: ONLY_WORKING_HOURS ? WORKING_START_HOUR : undefined,
    toHour: ONLY_WORKING_HOURS ? WORKING_END_HOUR : undefined,
  },
  viewPreset: "defaultPreset",
  presets: [myViewPreset],

  rowHeight: ROW_HEIGHT,
  barMargin: ROW_MARGIN,
  multiEventSelect: true,
  autoHeight: true,
  // timeRangesFeature: true,
};

export {
  schedulerConfig,
  ROW_HEIGHT,
  ROW_MARGIN,
  ONLY_WORKING_HOURS,
  WORKING_START_DAY,
  WORKING_END_DAY,
  WORKING_START_HOUR,
  WORKING_END_HOUR,
  START_DATE,
};
