import React, { useRef, useState, useEffect, FC } from "react";
import BryntumSchedulerComponent from "./Scheduler";
import CustomDrag from "../lib/CustomDragHelper";
import { BryntumScheduler } from "@bryntum/scheduler-react";

interface ArmSchedulerProps {
  unassignedStore?: any;
  dragContainer?: any;
  scheduledArmOrders: any;
  armId: number;
  readOnly?: boolean;
}

const ArmScheduler: FC<ArmSchedulerProps> = ({
  unassignedStore,
  dragContainer,
  scheduledArmOrders,
  armId,
  readOnly = true,
}) => {
  const isReadOnly = readOnly || !dragContainer || !unassignedStore;

  const scheduler = useRef<BryntumScheduler>(null);

  // Get unique resources from the orders that are scheduled on the arm
  let resources = scheduledArmOrders.reduce((accumulator: any, order: any) => {
    if (!accumulator.includes(order.scheduled_resource_id)) {
      accumulator.push(order.scheduled_resource_id);
    }
    return accumulator;
  }, []);

  // Push a default resource because we always want one more than the initial length
  resources.push(`${armId}-r${resources.length + 1}`);
  // Map to objects with the resource as the id. Needed for resource store
  resources = resources.map((res: any) => ({ id: res }));

  const [rows] = useState(resources);

  useEffect(() => {
    // Instantiate the drag class here. It's config ties the scheduler to the container
    // for drag and drop events. (ONLY for dragging items onto the scheduler. Dragging items back to the
    // unqueued list has logic handled in the Scheduler component itself.)
    if (!isReadOnly) {
      new CustomDrag({
        armId,
        unassignedStore,
        schedule: scheduler.current?.instance,
        outerElement: dragContainer.current,
        dropTargetSelector: `.scheduler-${armId} .b-timeline-subgrid`,
      });
    }
  }, []);

  return (
    <div id="schedulerContainer" className={`scheduler-${armId}`}>
      <BryntumSchedulerComponent
        armId={armId}
        schedulerRef={scheduler}
        events={scheduledArmOrders}
        // resourceStore={resourceStore}
        resources={rows}
        unassignedStore={unassignedStore}
        readOnly={isReadOnly}
      />
    </div>
  );
};

export default ArmScheduler;
