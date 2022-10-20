/**
 * Main Application script
 */
import React, {
  FunctionComponent,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import BryntumSchedulerComponent from "./components/Scheduler";
import "./App.scss";
import OrderStore from "./lib/OrderStore.js";
import CustomDragContainer from "./components/SchedulerDragContainer";
import UnassignedTable from "./components/UnassignedTable";
import CustomDrag from "./lib/CustomDragHelper";
import { BryntumScheduler } from "@bryntum/scheduler-react";
import UnassignedStore from "./lib/UnassignedStore";
import { EventModel } from "@bryntum/scheduler";
import Order from "./lib/Order";
import { loadedOrders, unloadedOrders } from "./data/sample-data";

const App: FunctionComponent = () => {
  // create the refs for each component. we create them at this level so that
  // the drag helper has access to them
  const dragContainer = useRef(null);
  const scheduler = useRef<BryntumScheduler>(null);

  const [unqueuedItems, setUnqueuedItems] = useState(unloadedOrders);

  const [events, setEvents] = useState(loadedOrders);

  const [rows, setRows] = useState([
    {
      id: "r1",
      name: "Row 1",
    },
    {
      id: "r2",
      name: "Row 2",
    },
    {
      id: "r3",
      name: "Row 3",
    },
  ]);

  const [unassignedStore] = useState(
    new UnassignedStore({ data: unqueuedItems.map((item) => new Order(item)) })
  );

  /**
   * @param {Event} record Event record
   * Updates state hook when adding item to store
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
   * Updates state hook when removing item from store
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
    // Bind callbacks for adding and removing items from the store.
    Object.assign(unassignedStore, {
      onAdd: onUnassignedStoreAdd,
      onRemove: onUnassignedStoreRemove,
    });

    // Instantiate the drag class here. It's config ties the scheduler to the container
    // for drag and drop events. (ONLY for dragging items onto the scheduler. Dragging items back to the
    // unqueued list has logic handled in the Scheduler component itself.)
    new CustomDrag({
      unassignedStore,
      schedule: scheduler.current?.instance,
      outerElement: dragContainer.current,
      constrain: false,
    });
  }, [unassignedStore, onUnassignedStoreAdd, onUnassignedStoreRemove]);

  return (
    <div id="innerAppContainer">
      <div id="schedulerContainer">
        <BryntumSchedulerComponent
          readOnly={false}
          forwardRef={scheduler}
          events={events}
          rows={rows}
          unassignedStore={unassignedStore}
        />
      </div>
      <CustomDragContainer forwardRef={dragContainer}>
        {/* {unassignedStore.allRecords.map((item: any) => {
          return (
            <div
              key={item.id}
              style={{
                height: "50px",
                width: "200px",
                border: "solid 1px blue",
              }}
              className="scheduler-unplanned-item"
              data-id={item.id} // This is important! bind a data-attribute with the key as "data-id" and the value as the ID of each object
            >
              {item.name}
            </div>
          );
        })} */}
        <UnassignedTable rows={unassignedStore.allRecords} />
      </CustomDragContainer>
    </div>
  );
};

// If you plan to use stateful React collections for data binding please check this guide
// https://www.bryntum.com/docs/scheduler/guide/Scheduler/integration/react/data-binding

export default App;
