import React, {
  FunctionComponent,
  useRef,
  useState,
  FC,
  Fragment,
  useEffect,
} from "react";
import { BryntumScheduler } from "@bryntum/scheduler-react";
import { DateHelper, PresetManager, PresetStore } from "@bryntum/scheduler";
import { schedulerConfig } from "../lib/SchedulerConfig";
import OrderStore from "../lib/OrderStore.js";
import Dialog from "@mui/material/Dialog";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import { BryntumDateTimeField } from "@bryntum/scheduler-react";
import { cleanupResources } from "../lib/Util";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import IconButton from "@mui/material/IconButton";
import { customPresets } from "../lib/SchedulerTimeConfig";
import HardBreakStore from "../lib/HardBreakStore";

/**
 * @param {any[]} orders Array of orders that are placed on Scheduler
 * @param {boolean} [readOnly=true] Bool if scheduler is read only
 */
interface BscProps {
  orders?: any[];
  schedulerRef: any;
  events: any[];
  unassignedStore?: any;
  armId?: any;
  resources: any[];
  readOnly: boolean;
}

const BryntumSchedulerComponent: FunctionComponent<BscProps> = ({
  readOnly,
  schedulerRef,
  events,
  unassignedStore,
  armId,
  resources,
}) => {
  const [scheduledStore] = useState(new OrderStore()); // Schedule store
  const [hbIdIncrement, setHbIdIncrement] = useState(1);
  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [eventDetail, setEventDetail] = useState(null);
  const [activePreset, setActivePreset] = useState("oneWeekPreset");
  const [addHardBreakOpen, setAddHardBreakOpen] = useState(false);

  const closeEventDetailDialog = () => {
    setEventDetailOpen(false);
    setEventDetail(null);
  };

  const closeHardBreakDialog = () => {
    setAddHardBreakOpen(false);
  };

  const addHardBreakLine = (value: any) => {
    const { startDate } = value;
    const newHardBreakObj = {
      id: hbIdIncrement,
      startDate,
      // duration: 1,
      // durationUnit: "day",
      name: "Hard Break",
      cls: "hard-break-scheduler",
    };
    setHbIdIncrement(hbIdIncrement + 1);
    schedulerRef.current.instance.timeRangeStore.add(newHardBreakObj);
  };

  const removeHardBreakLine = (config: any) => {
    // This is by far the most hacky solution
    let { targetElement } = config;
    if (targetElement.tagName === "LABEL") {
      targetElement = targetElement.parentElement;
    }
    const data = targetElement.dataset.id;
    schedulerRef.current.instance.timeRangeStore.remove(data);
  };

  const saveChanges = () => {
    const schedulerInstance = schedulerRef.current.instance;
    const modifications: any = {
      scheduler: {
        added: schedulerInstance.eventStore.added.items,
        removed: schedulerInstance.eventStore.removed.items,
        modified: schedulerInstance.eventStore.modified.items,
      },
      unscheduledOrders: {
        added: unassignedStore.added.items,
        removed: unassignedStore.removed.items,
        modified: unassignedStore.modified.items,
      },
      resources: {
        added: schedulerInstance.resourceStore.added.items,
        removed: schedulerInstance.resourceStore.removed.items,
        modified: schedulerInstance.resourceStore.modified.items,
      },
      hardBreaks: {
        added: schedulerInstance.timeRangeStore.added.items,
        removed: schedulerInstance.timeRangeStore.removed.items,
        modified: schedulerInstance.timeRangeStore.modified.items,
      },
    };
    // To-Do: We need to reconnect the priority queue so we can update the items with new "load-after" orders.
    // This list of modifications will help; but the process is going to be a little complicated.
    console.log("modifications", modifications);
  };

  const cancelChanges = () => {
    scheduledStore.revertChanges(); // reset the scheduled orders
    unassignedStore.revertChanges(); // reset the unassigned orders
    scheduledStore.resourceStore.revertChanges(); // reset the rows
    schedulerRef.current.instance.timeRangeStore.revertChanges(); // reset the hard breaks
  };

  const handlePresetChange = (e: any) => {
    const presetId = e.target.value;
    schedulerRef.current.instance.zoomTo({
      preset: presetId,
      startDate: new Date(),
      endDate: new Date(),
    });

    setActivePreset(presetId);
  };

  useEffect(() => {
    // Add custom time presets to PresetManager once when page loads
    PresetManager.add(customPresets);
  }, [customPresets]);

  const hardBreakStore = new HardBreakStore({
    data: [
      {
        id: 123,
        startDate: "2022-10-25T11:00",
        // endDate        : '2019-01-01T13:00',
        name: "Hard Break",
        cls: "hard-break-scheduler",
      },
    ],
  });

  return (
    <Box flexDirection="column" className="flex-grow">
      {/* Both containers needs CSS properties in flex-grow class */}
      <div id="bryntumScheduler" className="flex-grow bryntumScheduler">
        <BryntumScheduler
          ref={schedulerRef}
          readOnly={readOnly}
          events={events}
          resources={resources}
          createEventOnDblClick={false}
          zoomOnTimeAxisDoubleClick={false}
          viewPreset={activePreset}
          presets={customPresets}
          eventEditFeature={false}
          eventDragCreateFeature={{ disabled: true }}
          scheduleMenuFeature={{ disabled: true }}
          crudManager={{
            validateResponse: true,
            eventStore: scheduledStore,
            timeRangeStore: hardBreakStore,
            autoLoad: true,
          }}
          eventRenderer={(config: any) => {
            const { renderData, eventRecord } = config;
            renderData.style = `border-radius:${"5px"}`;
            renderData.eventColor = eventRecord.item_currently_molding
              ? "blue"
              : "rgb(189 175 108)";
            return eventRecord.name;
          }}
          timeRangesFeature={{
            showCurrentTimeLine: {
              name: "Now",
            },
            showHeaderElements: true,
            enableResizing: true,
            showTooltip: true,
            callOnFunctions: true,
            // tooltipTemplate({ timeRange }) {
            //   return `${timeRange.name}`;
            // },
          }}
          eventDragFeature={{
            // Allow dragging events outside of the Scheduler
            constrainDragToTimeline: false,
            // With this method, you can let the scheduler now if the drop operation is valid or not
            //   validatorFn({ draggedRecords: any, event: any }) {
            // validatorFn(res: any) {
            //   if (!res.valid) {
            //     console.log("not vlaid!");
            //   }
            // },

            // This CSS selector defines where a user may drop events outside the scheduler element
            externalDropTargetSelector: "#unqueuedItemsContainer",
          }}
          eventMenuFeature={{
            items: {
              copyEvent: false,
              cutEvent: false,
              deleteEvent: false,
              unassign: !readOnly && {
                icon: null,
                text: "Unassign",
                weight: 300,
                onItem: (config: any) => {
                  scheduledStore.remove(config.eventRecord);
                  unassignedStore.add(config.eventRecord);
                  cleanupResources(schedulerRef.current.instance.resourceStore);
                },
              },
              moveForward: !readOnly && {
                text: "Move 1 Day Ahead",
                cls: "b-separator", // Add a visual line above the item
                weight: 400, // Add the item to the bottom
                onItem: (config: any) => {
                  config.eventRecord.shift(1, "day");
                },
              },
              eventDetails: {
                text: "See Order Details",
                weight: 400, // Add the item to the bottom
                onItem: (config: any) => {
                  setEventDetailOpen(true);
                  setEventDetail(config.eventRecord);
                },
              },
            },
            processItems: (config: any) => {
              const { eventRecord, items } = config;
              if (!eventRecord.draggable) {
                items.moveForward = false;
                items.unassign = false;
              }
            },
          }}
          timeAxisHeaderMenuFeature={{
            // The TimeAxis Header menu is created, but starts disabled
            // disabled: true,
            items: {
              eventsFilter: false,
              zoomLevel: false,
              dateRange: false,
              currentTimeLine: false,
              removeHardBreak: {
                text: "Remove Hard Break",
                weight: 400,
                onItem: removeHardBreakLine,
              },
            },
            processItems: (config: any) => {
              const { targetElement } = config;
              const timeRangeClasslist = targetElement?.classList;
              const timeRangeParentClasslist =
                targetElement?.parentElement?.classList;

              console.log("config", config);
              if (
                !timeRangeClasslist.value.includes("timerange") &&
                !timeRangeParentClasslist.value.includes("timerange")
              ) {
                config.items.removeHardBreak = false;
              }
            },
          }}
          listeners={{
            eventDrop(res: any) {
              console.log("drop event", res);
              const { browserEvent, eventRecords, externalDropTarget } = res;
              if (res.externalDropTarget) {
                scheduledStore.remove(eventRecords);
                unassignedStore.add(eventRecords);
                cleanupResources(schedulerRef.current.instance.resourceStore);
              }
            },
          }}
          {...schedulerConfig}
        />
      </div>
      <Box mt={1} display="flex" justifyContent="space-between">
        <Box display={"flex"}>
          <IconButton
            size={"small"}
            sx={{ display: "flex" }}
            color="primary"
            onClick={() => schedulerRef.current.instance.shiftPrevious()}
          >
            <ChevronLeftIcon />
          </IconButton>
          <ViewPresetDropdown
            selectedPreset={activePreset}
            presets={customPresets}
            handleChange={handlePresetChange}
          />
          <IconButton
            size={"small"}
            sx={{ display: "flex" }}
            color="primary"
            onClick={() => schedulerRef.current.instance.shiftNext()}
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
        {/* If readOnly is false, include toolbar to edit rows */}
        {!readOnly && (
          <Box display={"flex"}>
            <Button
              variant="outlined"
              size={"small"}
              sx={{ display: "flex", marginRight: 1 }}
              color="info"
              onClick={() => setAddHardBreakOpen(true)}
            >
              Add Hard Break
            </Button>
            <Button
              variant="outlined"
              size={"small"}
              sx={{ display: "flex", marginRight: 1 }}
              onClick={saveChanges}
            >
              Save Changes
            </Button>
            <Button
              variant="outlined"
              size={"small"}
              sx={{ display: "flex" }}
              color="error"
              onClick={cancelChanges}
            >
              Discard Changes
            </Button>
          </Box>
        )}
      </Box>
      <EventDetailDialog
        closeEventDetail={closeEventDetailDialog}
        event={eventDetail}
        eventDetailOpen={eventDetailOpen}
      />
      <AddHardBreakDialog
        onClose={closeHardBreakDialog}
        open={addHardBreakOpen}
        onSave={addHardBreakLine}
      />
    </Box>
  );
};

interface EventDetailDialogProps {
  event: any;
  closeEventDetail: any;
  eventDetailOpen: boolean;
}

const EventDetailDialog: FC<EventDetailDialogProps> = ({
  event,
  closeEventDetail,
  eventDetailOpen,
}) => {
  if (!event) {
    return <Fragment></Fragment>;
  }
  const { data } = event;
  console.log("event", event);
  const durationUnrounded = DateHelper.as("hour", event.duration);
  const durationRounded = Math.round(durationUnrounded * 100) / 100;
  return (
    <Dialog onClose={closeEventDetail} open={eventDetailOpen} maxWidth={false}>
      <Box mx={4} my={2}>
        <Typography variant="h6">{`WO: ${data.work_order_number} (${data.balance} Parts)`}</Typography>
        <Divider sx={{ margin: "10px 0" }} />
        <InfoLabel label={"Work Order:"} value={data.work_order_number} />
        <InfoLabel label={"Item:"} value={data.item} />
        <InfoLabel label={"Remaining Balance:"} value={data.balance} />
        <InfoLabel label={"Description:"} value={data.description} />
        <Divider sx={{ margin: "10px 0" }} />

        <InfoLabel
          label={"Scheduled Start Date:"}
          value={DateHelper.format(event.startDate, "dddd, h:mmA, M/D/YY")}
        />
        <InfoLabel
          label={"Scheduled End Date:"}
          value={DateHelper.format(event.endDate, "dddd, h:mmA, M/D/YY")}
        />
        <InfoLabel
          label={"Scheduled Duration:"}
          value={`${durationRounded} Hours`}
        />
        <InfoLabel label={"Ship Date:"} value={data.ship_date} />
        <Divider sx={{ margin: "10px 0" }} />
        <InfoLabel label={"Mold Volume:"} value={data.mold_volume} />
        <InfoLabel label={"Oven Temp:"} value={data.temp} />
        <InfoLabel label={"Oven Time:"} value={data.time} />
        <InfoLabel label={"Takt Time:"} value={data.mold_takt} />
      </Box>
    </Dialog>
  );
};

interface InfoLabelProps {
  label: string;
  value: string;
  variant?: any; // Need MUI Variant typescript type
}

const InfoLabel: FC<InfoLabelProps> = ({ label, value, variant = "body1" }) => {
  return (
    <Box display="flex" justifyContent={"space-between"}>
      <Typography mr={4} variant={variant}>
        {label}
      </Typography>
      <Typography variant={variant}> {value}</Typography>
    </Box>
  );
};

interface AddHardBreakDialogProps {
  onSave: any;
  open: boolean;
  onClose: any;
}

const AddHardBreakDialog: FC<AddHardBreakDialogProps> = ({
  onSave,
  open,
  onClose,
}) => {
  const dateTimeRef: any = useRef(null);

  if (!open) {
    return <Fragment></Fragment>;
  }

  return (
    <Dialog onClose={onClose} open={open} maxWidth={false}>
      <Box mx={4} my={2}>
        <Typography variant="h6">Add Hard Break</Typography>
        <Divider sx={{ margin: "10px 0" }} />

        <BryntumDateTimeField ref={dateTimeRef} value={new Date()} />
        <Button
          variant="outlined"
          size={"small"}
          sx={{ display: "flex", marginTop: 4 }}
          onClick={() => {
            const value = dateTimeRef.current?.instance.value;
            if (value) {
              onSave({ startDate: value });
            }
            onClose();
          }}
        >
          Add
        </Button>
      </Box>
    </Dialog>
  );
};

interface ViewPresetDropdownProps {
  handleChange: any;
  presets: any[];
  selectedPreset: any;
}
const ViewPresetDropdown: FC<ViewPresetDropdownProps> = ({
  handleChange,
  presets,
  selectedPreset,
}) => {
  return (
    <Box sx={{ minWidth: 150 }}>
      <FormControl fullWidth>
        <InputLabel id="demo-simple-select-label">Zoom</InputLabel>
        <Select
          labelId="demo-simple-select-label"
          id="view-preset-select"
          value={selectedPreset}
          label="Zoom"
          onChange={handleChange}
          sx={{ marginRight: 1, marginLeft: 1 }}
        >
          {presets.map((preset: any, i: number) => (
            <MenuItem key={i} value={preset.id}>
              {preset.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default BryntumSchedulerComponent;
