// I didn't use these interfaces in my code becuase I wanted to wait until a schema
// was finalized. I'm including them because they hold the relevant schema that I did
// use.

// After we normalize orders, we can change the names here. Once they're changed, we'll
// need to update a couple of areas. in lib/Util.ts, update the normalizeOrder() and
// mapToOrderModel() functions. We'll also need to update the table in the <OrderDialog/>
// component (components/Scheduler.tsx).
export interface OrdersModel {
  // ... non-essential fields to the order
  arm: number; // Arm ID
  load_after: string; // In format `{order}; {item}`. IE: "0013413; 01-10118-002"
  load_after_id: number; // ID of previous order
  item_takt: number; // Takt effort - used to calc duration
  work_order_number: string; // Order number - used in name
  balance: number; // the number of parts - used to calc duration
  // Resource ID. in format `{arm.id}-r{number}`. IE: '62-r1', '62-r2' etc
  scheduled_resource_id: string;
}

export interface HardBreakModel {
  ID: number; // ID of hard break
  startDate: Date; // Date of hard break
  notes: string; // Could include notes about the hardbreak
}

export interface CounterWeightModel {
  // not implemented yet
  // These will essentially need to be an order model though. Only difference is
  // we'll explciitly store the duration and we'll need to handle the load-after id
  // ID that counter weights are unique and can be referenced by existing orders in the
  // priority queue.
}
