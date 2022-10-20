// This query is fired when the page loads. It contains information about the arms and orders that are currently
// molding
//http://experimental.rotoedgepro.com/api/inventory/machine-display/?machineId=19

const machine_display_response = {
  arms: [
    {
      id: 62,
      machine: "310-WA",
      machine_id: 19,
      capacity_left: 235.08,
      loaded_count: 2,
      created: "12:33 PM, May 09, 2022",
      updated: "07:06 AM, Aug 15, 2022",
      name: "310-WA-A1",
      number: 1,
      capacity: 300,
      shutdown: false,
      critical: false,
    },
    {
      id: 63,
      machine: "310-WA",
      machine_id: 19,
      capacity_left: 300,
      loaded_count: 0,
      created: "01:14 PM, May 09, 2022",
      updated: "07:06 AM, Aug 15, 2022",
      name: "310-WA-A2",
      number: 2,
      capacity: 300,
      shutdown: false,
      critical: false,
    },
    // {
    //   id: 72,
    //   machine: "310-WA",
    //   machine_id: 19,
    //   capacity_left: 300,
    //   loaded_count: 0,
    //   created: "01:29 PM, May 16, 2022",
    //   updated: "07:06 AM, Aug 15, 2022",
    //   name: "310-WA-A3",
    //   number: 3,
    //   capacity: 300,
    //   shutdown: false,
    //   critical: false,
    // },
  ],
  orders: [
    {
      id: 40,
      parent_work_order: "-",
      number: "0013831",
      item: "01-10626-001",
      item_takt: 6,
      description: "Fuel Tank-Diesel 14.4G- XL Yel",
      type: "Moldable",
      factory: "Vancouver, WA",
      factory_code: "VAN",
      status: "Open",
      molded_count: 0,
      secondary_count: 0,
      foamed_count: 0,
      assembled_count: 0,
      shipped_count: 0,
      open_date: "May 21, 2021",
      due_date: "Sep 15, 2021",
      ship_date: "Sep 10, 2021",
      closed_date: null,
      open: true,
      color: "loaded",
      work_order_number: "0013831",
      mold_load_status: "1/1",
      mold_fully_loaded: true,
      created: "03:26 PM, May 09, 2022",
      updated: "10:06 AM, Jul 20, 2022",
      deleted: false,
      deleted_at: null,
      restored_at: null,
      balance: 50,
      special_instructions: null,
      needs_post_molding: false,
      sage_synced: true,
      excel_synced: false,
      bom_pulled: false,
      assembly_child_synced: false,
      parent: null,
      arm: 62,
      scheduled_resource_id: "62-r1",
    },
    {
      id: 49,
      parent_work_order: "-",
      number: "0014196",
      item: "01-10671-001",
      item_takt: 5,
      description: "3500 Cover MX4774 - DK BLUE",
      type: "Moldable",
      factory: "Vancouver, WA",
      factory_code: "VAN",
      status: "Open",
      molded_count: 0,
      secondary_count: 0,
      foamed_count: 0,
      assembled_count: 0,
      shipped_count: 0,
      open_date: "Jun 30, 2021",
      due_date: "Oct 15, 2021",
      ship_date: "Sep 27, 2021",
      closed_date: null,
      open: true,
      color: "loaded",
      work_order_number: "0014196",
      mold_load_status: "1/1",
      mold_fully_loaded: true,
      created: "03:26 PM, May 09, 2022",
      updated: "10:06 AM, Jul 20, 2022",
      deleted: false,
      deleted_at: null,
      restored_at: null,
      balance: 200,
      special_instructions: null,
      needs_post_molding: false,
      sage_synced: true,
      excel_synced: false,
      bom_pulled: false,
      assembly_child_synced: false,
      parent: null,
      arm: 62,
      scheduled_resource_id: "62-r2",
    },
  ],
};

export { machine_display_response };