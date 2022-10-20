import React, {
  FunctionComponent,
  useRef,
  useState,
  FC,
  Fragment,
} from "react";
import { BryntumScheduler } from "@bryntum/scheduler-react";
import { DateHelper } from "@bryntum/scheduler";
import { schedulerConfig } from "../lib/SchedulerConfig";
import OrderStore from "../lib/OrderStore.js";
import Dialog from "@mui/material/Dialog";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import { BryntumDateTimeField } from "@bryntum/scheduler-react";
import { cleanupResources } from "../lib/Util";

/**
 * @param {any[]} orders Array of orders that are placed on Scheduler
 * @param {boolean} [readOnly=true] Bool if scheduler is read only
 */
interface BscProps {
  orders?: any[];
  readOnly: boolean;
  forwardRef: any;
  events: any[];
  unassignedStore: any;
  armId?: any;
  // resourceStore: any;
  resources: any[];
}

const BryntumSchedulerComponent: FunctionComponent<BscProps> = ({
  readOnly = true,
  forwardRef,
  events,
  unassignedStore,
  armId,
  // resourceStore,
  resources,
}) => {
  const [addHardBreakOpen, setAddHardBreakOpen] = useState(false);

  // event store is needed by scheduler
  const [scheduledStore] = useState(new OrderStore());

  const [hbIdIncrement, setHbIdIncrement] = useState(1);
  const [hardBreaks, setHardBreaks]: any[] = useState([]);

  const [eventDetailOpen, setEventDetailOpen] = useState(false);
  const [eventDetail, setEventDetail] = useState(null);

  const [orders, setOrders] = useState(events);

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
    setHardBreaks([...hardBreaks, newHardBreakObj]);
  };

  const cancelChanges = () => {
    const eventIds = events.map((e) => e.id);
    const toRemove: any = [];
    scheduledStore.allRecords.forEach((order: any) => {
      if (!eventIds.includes(order.id)) {
        toRemove.push(order);
      }
    });
    scheduledStore.remove(toRemove);
    unassignedStore.add(toRemove);
    cleanupResources(forwardRef.current.instance.resourceStore);
    setHardBreaks([]);
  };

  // console.log("hardBreaks", hardBreaks);

  return (
    <Box flexDirection="column" className="flex-grow">
      {/* Both containers needs CSS properties in flex-grow class */}
      <div id="bryntumScheduler" className="flex-grow bryntumScheduler">
        <BryntumScheduler
          ref={forwardRef}
          events={orders}
          resources={resources}
          timeRanges={hardBreaks}
          onTimeRangeHeaderClick={() => {
            console.log("onTimeRangeHeaderClick clicked");
          }}
          onTimeRangeHeaderContextMenu={() => {
            console.log("onTimeRangeHeaderContextMenu clicked");
          }}
          crudManager={{
            eventStore: scheduledStore,
            // resourceStore: resourceStore,
            autoLoad: true,
          }}
          eventRenderer={(config: any) => {
            const { renderData, eventRecord } = config;
            // renderData.style = `background:${bgColor};border-color:${bgColor};color:${encodeHtml(resourceRecord.textColor)}`;
            renderData.style = `border-radius:${"5px"}`;
            renderData.eventColor = eventRecord.item_currently_molding
              ? "blue"
              : "rgb(189 175 108)";

            const { work_order_number, balance } = eventRecord;
            return `WO: ${work_order_number} (${balance} Parts)`;
          }}
          features={{
            timeRanges: {
              showCurrentTimeLine: {
                name: "Now",
              },
              showHeaderElements: true,
              enableResizing: true,
              showTooltip: true,
              // tooltipTemplate({ timeRange }) {
              //   return `${timeRange.name}`;
              // },
            },
            timeAxisHeaderMenu: {
              items: {
                zoomLevel: false,
              },
            },
            eventEdit: false,
            eventDragCreate: {
              disabled: true,
            },
            eventDrag: {
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
            },
            eventMenu: {
              items: {
                copyEvent: false,
                cutEvent: false,
                deleteEvent: false,
                unassign: {
                  icon: null,
                  text: "Unassign",
                  weight: 300,
                  onItem: (config: any) => {
                    scheduledStore.remove(config.eventRecord);
                    unassignedStore.add(config.eventRecord);
                    cleanupResources(forwardRef.current.instance.resourceStore);
                  },
                },
                moveForward: {
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
            },
            scheduleMenu: {
              // The Schedule menu is created, but starts disabled
              disabled: true,
            },
            timeAxisHeaderMenu: {
              // The TimeAxis Header menu is created, but starts disabled
              // disabled: true,
              items: {
                eventsFilter: false,
                zoomLevel: false,
                dateRange: false,
                currentTimeLine: false,
                removeHardBreak: {
                  text: "Remove Hard Break",
                  weight: 400, // Add the item to the bottom
                  onItem: (config: any) => {
                    const popHardBreak = hardBreaks.slice(
                      0,
                      hardBreaks.length - 1
                    );
                    // console.log("popHardBreak", popHardBreak);
                    setHardBreaks(popHardBreak);
                  },
                },
              },
              processItems: (config: any) => {
                const { targetElement } = config;
                const timeRangeClasslist = targetElement?.classList;
                const timeRangeParentClasslist =
                  targetElement?.parentElement?.classList;
                if (
                  timeRangeClasslist &&
                  timeRangeParentClasslist &&
                  (timeRangeClasslist.value.includes("timerange") ||
                    timeRangeParentClasslist.value.includes("timerange"))
                ) {
                  // We don't want to do anything :)
                } else {
                  config.items.removeHardBreak = false;
                }
              },
            },
            // timeRangeHeaderMenu: {
            //   items: {
            //     moveForward: {
            //       text: "Move 1 Day Ahead",
            //       cls: "b-separator", // Add a visual line above the item
            //       weight: 400, // Add the item to the bottom
            //       onItem: (config: any) => {
            //         // config.eventRecord.shift(1, "day");
            //         console.log("hm");
            //       },
            //     },
            //   },
            // },
          }}
          listeners={{
            // We listen for the `eventDrop` event and take action if dropped on the external grid
            // eventDrop({ browserEvent, eventRecords, externalDropTarget }) {
            eventDrop(res: any) {
              console.log("drop event", res);
              const { browserEvent, eventRecords, externalDropTarget } = res;
              if (res.externalDropTarget) {
                scheduledStore.remove(eventRecords);
                unassignedStore.add(eventRecords);
                cleanupResources(forwardRef.current.instance.resourceStore);
              }
            },
          }}
          {...schedulerConfig}
        />
      </div>
      <Box mt={1} display="flex" justifyContent="flex-end">
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

      {/* If readOnly is false, include toolbar to edit rows */}
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
  variant?: string;
}

const InfoLabel: FC<InfoLabelProps> = ({ label, value, variant = "body1" }) => {
  return (
    <Box display="flex" justifyContent={"space-between"}>
      <Typography mr={4} variant={variant}>
        {" "}
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
  const dateTimeRef = useRef(null);

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
            const value = dateTimeRef?.current?.instance.value;
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

export default BryntumSchedulerComponent;
