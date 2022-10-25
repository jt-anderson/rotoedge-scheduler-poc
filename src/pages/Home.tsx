import React, { useState, FC } from "react";
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
import ArmScheduler from "../components/ArmScheduler";
import ArmDetail from "../components/ArmDetail";
// Custom library imports
import {
  mapToOrderModel,
  normalizeOrder,
  getOrdersWithStartDates,
} from "../lib/Util";
// Mock data imports
import { machines_response } from "../data/machines";
import { unloadedOrders } from "../data/sample-data";
import { machine_display_response } from "../data/machine-display";
import { enhanced_arm_loadqueue_62_response } from "../data/arm-enhanced-loadqueue";

const Home = () => {
  const [machines] = useState(machines_response.machines);

  return (
    <Box className={"flex-grow"} px={2} py={2} flexDirection="column">
      <Typography variant="h5">Machines (Read Only Demo)</Typography>
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
  // This represents all of the orders that are scheduled but are not currently molding
  const [scheduledOrders] = useState(
    arm.id === 62 ? enhanced_arm_loadqueue_62_response.objects : []
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
    getOrdersWithStartDates(allNormalizedOrders)
  );

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
        <ArmScheduler
          armId={arm.id}
          scheduledArmOrders={allScheduledArmOrders}
        />
      </AccordionDetails>
    </Accordion>
  );
};

export default Home;
