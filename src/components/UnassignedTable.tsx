import * as React from "react";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

interface UnassignedStoreProps {
  rows: any[];
}

const UnassignedTable: React.FC<UnassignedStoreProps> = (props) => {
  return (
    <TableContainer>
      <Table sx={{ minWidth: 650 }} aria-label="simple table">
        <TableHead>
          <TableRow sx={{ backgroundColor: "#f4f9ff" }}>
            <TableCell>Order</TableCell>
            <TableCell>Item</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Arm</TableCell>
            <TableCell>Ship Date</TableCell>
            <TableCell>Balance</TableCell>
            <TableCell>Loaded</TableCell>
            <TableCell>Mold Volume</TableCell>
            <TableCell>Oven Temperature</TableCell>
            <TableCell>Oven Time</TableCell>
            <TableCell>Takt Time</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow
              key={row.name}
              className="scheduler-unplanned-item"
              data-id={row.id}
              sx={{ backgroundColor: "#3598dc" }}
            >
              <TableCell>{row.work_order_number}</TableCell>
              <TableCell>{row.item}</TableCell>
              <TableCell>{row.description}</TableCell>
              <TableCell>{row.arm}</TableCell>
              <TableCell>{row.ship_date}</TableCell>
              <TableCell>{row.balance}</TableCell>
              <TableCell>{row.mold_load_status}</TableCell>
              <TableCell>{row.mold_volume}</TableCell>
              <TableCell>{row.temp}</TableCell>
              <TableCell>{row.time}</TableCell>
              <TableCell>{row.mold_takt}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default UnassignedTable;
