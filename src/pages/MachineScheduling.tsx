import React, {
  useState,
  FC,
  Fragment,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UnassignedTable from "../components/UnassignedTable";
import ArmScheduler from "../components/ArmScheduler";
import CustomDragContainer from "../components/SchedulerDragContainer";
import UnassignedStore from "../lib/UnassignedStore";
import Order from "../lib/Order";
import { machines_response } from "../data/machines";
import { unloadedOrders } from "../data/sample-data";
import { machine_display_response } from "../data/machine-display";
import { enhanced_arm_loadqueue_62_response } from "../data/arm-enhanced-loadqueue";
import {
  arm_62_unscheduled_orders,
  arm_63_unscheduled_orders,
} from "../data/arm-unscheduled-orders";
import {
  mapToOrderModel,
  normalizeOrder,
  getOrdersWithStartDates,
} from "../lib/Util";

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
        {machineArms.map((arm: any, i: number) => {
          return (
            <ArmAccordion
              key={`arm-accordion-${i}`}
              arm={arm}
              index={i}
              moldingArmOrders={arm.orders}
            />
          );
        })}
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
  // Required: Make a new ref for the external drag container (MUI table with assigned orders)
  const dragContainer = useRef(null);

  // This represents all of the orders tht are scheduled but are not currently molding
  const [scheduledOrders] = useState(
    arm.id === 62 ? enhanced_arm_loadqueue_62_response.objects : []
  );

  // This represents the items that have been assigned to the arm but haven't been scheduled
  const [unqueuedItems, setUnqueuedItems] = useState(
    arm.id === 62
      ? mapToOrderModel(arm_62_unscheduled_orders.unscheduled_orders)
      : arm.id === 63
      ? mapToOrderModel(arm_63_unscheduled_orders.unscheduled_orders)
      : []
  );

  // The schema for orders that are molding vs those that are scheduled is different so I'm normalizing them here
  // and mapping them to the model that is required by the Scheduler componennt
  const allNormalizedOrders = mapToOrderModel([
    ...moldingArmOrders,
    ...scheduledOrders.map((ord) => normalizeOrder(ord)),
  ]);

  // The final list of items that are scheduled on this arm
  const [allScheduledArmOrders] = useState(
    getOrdersWithStartDates(allNormalizedOrders)
  );

  // Create a new store based off the data in unqueuedItems
  const [unassignedStore] = useState(
    new UnassignedStore({
      data: unqueuedItems.map((item: any) => new Order(item)),
    })
  );

  /**
   * @param {Event} record Event record
   * Updates state hook when adding item to the unassigned store
   */
  const onUnassignedStoreAdd = useCallback(
    (props: any) => {
      const { records } = props;
      const flatData = records.map((rec: any) => rec.originalData);
      // const currentUnassignedItems = unassignedStore.getRecords();
      setUnqueuedItems([...unqueuedItems, ...flatData]);
    },
    [unqueuedItems]
  );

  /**
   * @param {Event} record Event record
   * Updates state hook when removing item from the unassigned store
   */
  const onUnassignedStoreRemove = useCallback(
    (props: any) => {
      const { records } = props;
      const recordsIds = records.map((rec: any) => +rec.data.id);

      const filteredItems = unqueuedItems.filter(
        (item: any) => !recordsIds.includes(item.id)
      );
      setUnqueuedItems(filteredItems);
    },
    [unqueuedItems]
  );

  useEffect(() => {
    // Bind callbacks for adding and removing items from the unassigned store.
    Object.assign(unassignedStore, {
      onAdd: onUnassignedStoreAdd,
      onRemove: onUnassignedStoreRemove,
    });
  }, [unassignedStore, onUnassignedStoreAdd, onUnassignedStoreRemove]);

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
        {/* Info about the arm and orders that are currently molding */}
        <ArmDetail moldingArmOrders={moldingArmOrders} />
        {/* The actual scheduler component for the arm */}
        {/* To-Do: Page will break if dragContainer ref is passed undefined. Add elegant handling if it's not passed.  */}
        <ArmScheduler
          armId={arm.id}
          unassignedStore={unassignedStore}
          dragContainer={dragContainer}
          scheduledArmOrders={allScheduledArmOrders}
        />
        {/* The draggable list of items that are scheduled to the arm but aren't scheduled on the scheduler yet */}
        <CustomDragContainer armId={arm.id} forwardRef={dragContainer}>
          <UnassignedTable rows={unqueuedItems} />
        </CustomDragContainer>
      </AccordionDetails>
    </Accordion>
  );
};

interface ArmDetailProps {
  moldingArmOrders: any[];
}
/**
 *
 * @param {loadedArmOrders} any[] Orders that are currently molding
 */
const ArmDetail: FC<ArmDetailProps> = ({ moldingArmOrders }) => {
  return (
    <Fragment>
      <Box sx={{ backgroundColor: "lime", height: "30px" }}></Box>
      <Box sx={{ display: "flex" }}>
        {moldingArmOrders.map((loadedOrder: any, i: number) => (
          <Box
            p={1}
            key={i}
            className={"loadedOrderInArm"}
            sx={{
              marginRight: i === moldingArmOrders.length - 1 ? "0px" : "2.5px",
            }}
          >
            <Typography variant={"body2"}>Item: {loadedOrder.item}</Typography>
            <Typography variant={"body2"}>
              Description: {loadedOrder.description}
            </Typography>
            <Typography variant={"body2"}>
              Order: {loadedOrder.number}
            </Typography>
            <Typography variant={"body2"}>
              Quantity: {loadedOrder.balance}
            </Typography>
          </Box>
        ))}
        <Box
          p={1}
          className={"loadedOrderInArm"}
          sx={{
            margin: "2.5px, 0",
            marginRight: "0px",
            marginLeft: moldingArmOrders.length === 0 ? "0px" : "2.5px",
            backgroundColor: "rgb(54, 215, 183)",
            minHeight: "80px",
          }}
        >
          <Typography variant={"body2"}>123 Available</Typography>
        </Box>
      </Box>
    </Fragment>
  );
};

export default MachineScheduling;
