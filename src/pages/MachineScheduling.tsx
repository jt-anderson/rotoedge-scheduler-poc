import React, { useState, FC, useEffect, useCallback, useRef } from "react";
// MUI
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
// Custom component imports
import UnassignedTable from "../components/UnassignedTable";
import CustomDragContainer from "../components/SchedulerDragContainer";
import ArmDetail from "../components/ArmDetail";
// Custom library imports
import UnassignedStore from "../lib/UnassignedStore";
import {
  mapToOrderModel,
  normalizeOrder,
  getOrdersWithStartDates,
  mapToCounterWeightModel,
  mapToHardBreakModel,
} from "../lib/Util";
// Mock data imports
import { machines_response } from "../data/machines";
import { unloadedOrders } from "../data/sample-data";
import { machine_display_response } from "../data/machine-display";
import { enhanced_arm_loadqueue_62_response } from "../data/arm-enhanced-loadqueue";
import { arm_62_counter_weights } from "../data/counter-weight";
import {
  arm_62_unscheduled_orders,
  arm_63_unscheduled_orders,
} from "../data/arm-unscheduled-orders";
import RotoEdgeScheduler from "../components/Scheduler";
import { DateHelper } from "@bryntum/scheduler";

const MachineScheduling = () => {
  // Using state hook because I'm assuming this data will be set in a useEffect later
  const [machines] = useState(machines_response.machines);
  // useEffect(() => {
  //   const response = ...
  //   setMachines(response.machines)
  // }, [machines])

  return (
    <Box className={"flex-grow"} px={2} py={2} flexDirection="column">
      <Typography variant="h5">Machines</Typography>
      {machines.map((machine: any, i: number) => (
        <MachineAccordion key={`machine-schedule-${i}`} machine={machine} />
      ))}
    </Box>
  );
};

interface MachineAccordionProps {
  machine: any;
}
const MachineAccordion: FC<MachineAccordionProps> = ({ machine }) => {
  // Use the machine.id to query for the machine-display. In this case, we only have one machine (19) but
  // the query would go here.

  // Recommendation: machine-display-response returns an object with arms[] and orders[]. I would recommend that the
  // orders[] be nested inside each entry in arms[]. Unless all the orders for a machine are used for something
  // completely independent of the parent arm- we can avoid unecessary computation by nesting them as a direct child.

  // Important: When I nest the orders under each arm, I'm adding a flag to each order to tell the scheduler the order
  // is current molding.
  const armsWithOrders = machine_display_response.arms.map((arm: any) => ({
    ...arm,
    orders: machine_display_response.orders
      .map((order: any) => ({ ...order, item_currently_molding: true }))
      .filter((order: any) => order.arm === arm.id),
  }));

  const [machineArms] = useState(armsWithOrders);

  return (
    <Accordion
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`machine-${machine.id}-content`}
        id={`machine-${machine.id}-header`}
      >
        <Typography variant="h6">{machine.name}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="h6">Machine Arms</Typography>
        {machineArms.map((arm: any, i: number) => (
          <ArmAccordion
            key={`arm-accordion-${i}`}
            arm={arm}
            index={i}
            moldingArmOrders={arm.orders}
          />
        ))}
        {/* This is the list of all items on the machine. We can ignore this for integration. */}
        <Typography variant="h6" mt={2}>
          Machine Orders
        </Typography>
        <UnassignedTable rows={unloadedOrders} />
      </AccordionDetails>
    </Accordion>
  );
};

interface ArmAccordionProps {
  arm: any;
  index: number;
  moldingArmOrders: any[];
}

const ArmAccordion: FC<ArmAccordionProps> = ({
  arm,
  index,
  moldingArmOrders,
}) => {
  // Make a new ref for the external drag container (MUI table with unassigned orders)
  const dragContainer = useRef(null);

  // ================== SCHEDULED ORDERS SECTION =======================

  // This represents all of the orders that are scheduled but are not currently molding
  const [scheduledOrders] = useState(
    arm.id === 62 ? enhanced_arm_loadqueue_62_response.objects : []
  );

  const [counterWeights] = useState(
    arm.id === 62
      ? arm_62_counter_weights.map((cw) => mapToCounterWeightModel(cw))
      : []
  );

  // The schema for orders that are molding vs those that are scheduled is different so I'm normalizing them here
  // and mapping them to the model that is required by the Scheduler componennt
  const allNormalizedOrders = mapToOrderModel([
    ...moldingArmOrders,
    ...scheduledOrders.map((ord) => normalizeOrder(ord)),
  ]);

  // The final list of items that are scheduled on this arm. We grab their start dates based off
  // the priority queue of "load-after" fields.
  const [allScheduledArmOrders] = useState(
    getOrdersWithStartDates([...allNormalizedOrders, ...counterWeights])
  );

  // ================== HARD BREAKS SECTION =======================

  const [hardBreaks] = useState(
    [
      {
        id: 123,
        start: DateHelper.add(new Date(), 1, "day"),
        notes: "something!",
      },
    ].map((hardBreak: any) => mapToHardBreakModel(hardBreak))
  );

  // ================== UNSCHEDULED ORDERS SECTION =======================

  // This represents the items that have been assigned to the arm but haven't been scheduled
  const [unscheduledOrders, setUnscheduledOrders] = useState(
    arm.id === 62
      ? mapToOrderModel(arm_62_unscheduled_orders.unscheduled_orders)
      : arm.id === 63
      ? mapToOrderModel(arm_63_unscheduled_orders.unscheduled_orders)
      : []
  );

  // Create a new unassigned store based off the data in unscheduledOrders. We create it here so we can
  // expose its methods to the Scheduler component. This is the drawback of having to create our own
  // implementation of drag-and-drop.
  const [unassignedStore] = useState(
    new UnassignedStore({
      data: unscheduledOrders,
    })
  );

  /**
   * @param {Event} record Event record
   * Updates state hook when adding item to the unassigned store
   */
  const onUnassignedStoreAdd = useCallback(
    (props: any) => {
      const { records } = props;
      const flatData: any[] = records.map((rec: any) => rec.originalData);
      setUnscheduledOrders([...unscheduledOrders, ...flatData]);
    },
    [unscheduledOrders]
  );

  /**
   * @param {Event} record Event record
   * Updates state hook when removing item from the unassigned store
   */
  const onUnassignedStoreRemove = useCallback(
    (props: any) => {
      const { records } = props;
      const recordsIds = records.map((rec: any) => +rec.data.id);

      const filteredItems = unscheduledOrders.filter(
        (item: any) => !recordsIds.includes(item.id)
      );
      setUnscheduledOrders(filteredItems);
    },
    [unscheduledOrders]
  );

  /**
   * @param {String} action string representing the action that fired onUpdate
   * @param {Object} changes Object with three arrays: added, removed, and modified
   * This function is called when the unassignedStore.revertChanges() fun is called
   */
  const onUnassignedStoreRevert = useCallback(
    (props: any) => {
      const { action, changes } = props;
      if (action === "clearchanges") {
        const toAdd = changes.removed.map((obj: any) => obj.data);
        const idsToRemove = changes.added.map((obj: any) => obj.data.id);
        const newState = [...unscheduledOrders, ...toAdd].filter(
          (item: any) => !idsToRemove.includes(item.id)
        );
        setUnscheduledOrders(newState);
      }
    },
    [unscheduledOrders]
  );

  useEffect(() => {
    // Bind callbacks for adding, removing, and reverting items from the unassigned store.
    Object.assign(unassignedStore, {
      onAdd: onUnassignedStoreAdd,
      onRemove: onUnassignedStoreRemove,
      onRefresh: onUnassignedStoreRevert,
    });
  }, [
    unassignedStore,
    onUnassignedStoreAdd,
    onUnassignedStoreRemove,
    onUnassignedStoreRevert,
  ]);

  return (
    <Accordion
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-start",
        backgroundColor: "rgb(244, 249, 255);",
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`arm-${arm.id}-content`}
        id={`arm-${arm.id}-header`}
      >
        <Typography>
          {arm.name} (Arm {index + 1})
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {/* Info about the arm and orders that are currently molding. Not necessary for integration */}
        <ArmDetail moldingArmOrders={moldingArmOrders} />
        {/* The scheduler component for the arm */}
        <RotoEdgeScheduler
          armId={arm.id}
          unassignedStore={unassignedStore}
          dragContainer={dragContainer}
          orders={allScheduledArmOrders}
          hardBreaks={hardBreaks}
          readOnly={false}
        />
        {/* The draggable list of items that are scheduled to the arm but aren't scheduled on the scheduler yet */}
        <CustomDragContainer armId={arm.id} dragContainerRef={dragContainer}>
          {/* API Table component could go here in place of <UnassignedTable /> */}
          <UnassignedTable rows={unscheduledOrders} />
        </CustomDragContainer>
      </AccordionDetails>
    </Accordion>
  );
};

export default MachineScheduling;
