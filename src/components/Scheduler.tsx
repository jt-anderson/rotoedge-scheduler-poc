import React, {
  FunctionComponent,
  useRef,
  useState,
  FC,
  Fragment,
  useEffect,
} from "react";
import { BryntumScheduler } from "@bryntum/scheduler-react";
import { DateHelper, PresetManager, ResourceStore } from "@bryntum/scheduler";
import { schedulerConfig } from "../lib/SchedulerConfig";
import OrderStore from "../lib/OrderStore.js";
import Dialog from "@mui/material/Dialog";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import { BryntumDateTimeField } from "@bryntum/scheduler-react";
import { cleanupResources, getResourcesFromOrders } from "../lib/Util";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import IconButton from "@mui/material/IconButton";
import { customPresets } from "../lib/SchedulerTimeConfig";
import HardBreakStore from "../lib/HardBreakStore";
import CustomDrag from "../lib/CustomDragHelper";

/**
 * @param {any[]} orders Array of orders that are placed on Scheduler
 * @param {boolean} [readOnly=true] Bool if scheduler is read only
 */
interface BscProps {
  readOnly?: boolean;
  orders: any[];
  unassignedStore?: any;
  armId: any;
  dragContainer?: any;
}

const BryntumSchedulerComponent: FunctionComponent<BscProps> = ({
  readOnly = true,
  orders,
  unassignedStore,
  armId,
  dragContainer,
}) => {
  // Scheduler is read only if the param is true, or there was no dragContainer / unassignedStore passed
  const isReadOnly = readOnly || !dragContainer || !unassignedStore;
  // Create ref for scheduler
  const schedulerRef: any = useRef<BryntumScheduler>(null);
  // State hook for incremental IDs for hard break lines. There is most certainly a
  // better way of doing this
  const [hbIdIncrement, setHbIdIncrement] = useState(1);
  // Bool for when the dialog for adding a hard break is open
  const [addHardBreakOpen, setAddHardBreakOpen] = useState(false);
  // Bool for when the details about an order is open
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  // Reference to the order that is being viewed
  const [orderDetail, setOrderDetail] = useState(null);
  // The ID of the time preset. Defaults to oneWeek
  const [activePreset, setActivePreset] = useState("oneWeekPreset");
  // EventStore for the scheduler. Holds the orders
  const [scheduledStore] = useState(new OrderStore({ data: orders }));
  // ResourceStore for the scheduler. We grab the resources (rows) based off the passed orders
  const [rowStore] = useState(
    new ResourceStore({ data: getResourcesFromOrders(orders, armId) })
  );
  // Time range store for scheduler. Holds data about hard breaks
  const [hardBreakStore] = useState(
    new HardBreakStore({
      data: [
        {
          id: 123,
          startDate: DateHelper.add(new Date(), 12, "hour"),
          name: "Hard Break",
          cls: "hard-break-scheduler",
        },
      ],
    })
  );

  // Function thats called when the order details dialog is closed
  const closeOrderDetailDialog = () => {
    setOrderDetailOpen(false);
    setOrderDetail(null);
  };

  // Function thats called when the hard break dialog is closed
  const closeHardBreakDialog = () => {
    setAddHardBreakOpen(false);
  };

  // Function thats called when a hard break line is added
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

  // Function thats called when a hard break line is removed
  const removeHardBreakLine = (config: any) => {
    // This is by far the most hacky solution
    let { targetElement } = config;
    if (targetElement.tagName === "LABEL") {
      targetElement = targetElement.parentElement;
    }
    const data = targetElement.dataset.id;
    schedulerRef.current.instance.timeRangeStore.remove(data);
  };

  // Callback when the save button is clicked. Note: These details are useful but we'll need to do
  // more work to realign the priority queue. See note below
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

  // Callback when the discard changes button is clicked. Reverts all relevant stores.
  const cancelChanges = () => {
    scheduledStore.revertChanges(); // reset the scheduled orders
    unassignedStore.revertChanges(); // reset the unassigned orders
    scheduledStore.resourceStore.revertChanges(); // reset the rows
    schedulerRef.current.instance.timeRangeStore.revertChanges(); // reset the hard breaks
  };

  // Callback when a time preset is changed. It helps to pass the current date as the begin / end
  // date to allow the scheduler to refresh and fit the view correctly.
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
    // Instantiate the drag class here. It's config ties the scheduler to the container
    // for drag and drop orders. (ONLY for dragging items onto the scheduler. Dragging items back to the
    // unqueued list has logic handled in the Scheduler component itself.)
    if (!isReadOnly) {
      new CustomDrag({
        armId,
        unassignedStore,
        schedule: schedulerRef.current?.instance,
        outerElement: dragContainer.current,
        dropTargetSelector: `.scheduler-${armId} .b-timeline-subgrid`,
      });
    }
    // Add custom time presets to PresetManager one time when page loads
    PresetManager.add(customPresets);
  });

  return (
    <div id="schedulerContainer" className={`scheduler-${armId}`}>
      <Box flexDirection="column" className="flex-grow">
        {/* Both containers needs CSS properties in flex-grow class */}
        <div id="bryntumScheduler" className="flex-grow bryntumScheduler">
          <BryntumScheduler
            ref={schedulerRef}
            readOnly={readOnly}
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
              resourceStore: rowStore,
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
            }}
            eventDragFeature={{
              // Allow dragging orders outside of the Scheduler
              constrainDragToTimeline: false,
              // This CSS selector defines where a user may drop orders outside the scheduler element
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
                    cleanupResources(
                      schedulerRef.current.instance.resourceStore
                    );
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
                orderDetails: {
                  text: "See Order Details",
                  weight: 400, // Add the item to the bottom
                  onItem: (config: any) => {
                    setOrderDetailOpen(true);
                    setOrderDetail(config.eventRecord);
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
                if (
                  (!timeRangeClasslist.value.includes("timerange") &&
                    !timeRangeParentClasslist.value.includes("timerange")) ||
                  isReadOnly
                ) {
                  config.items.removeHardBreak = false;
                }
              },
            }}
            listeners={{
              eventDrop(res: any) {
                const { eventRecords } = res;
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
          {/* If read only, don't include toolbar to edit rows */}
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
        <OrderDetailDialog
          closeOrderDetail={closeOrderDetailDialog}
          event={orderDetail}
          orderDetailOpen={orderDetailOpen}
        />
        <AddHardBreakDialog
          onClose={closeHardBreakDialog}
          open={addHardBreakOpen}
          onSave={addHardBreakLine}
        />
      </Box>
    </div>
  );
};

interface OrderDetailDialogProps {
  event: any;
  closeOrderDetail: any;
  orderDetailOpen: boolean;
}

const OrderDetailDialog: FC<OrderDetailDialogProps> = ({
  event,
  closeOrderDetail,
  orderDetailOpen,
}) => {
  if (!event) {
    return <Fragment></Fragment>;
  }
  const { data } = event;
  const durationUnrounded = DateHelper.as("hour", event.duration);
  const durationRounded = Math.round(durationUnrounded * 100) / 100;
  return (
    <Dialog onClose={closeOrderDetail} open={orderDetailOpen} maxWidth={false}>
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
