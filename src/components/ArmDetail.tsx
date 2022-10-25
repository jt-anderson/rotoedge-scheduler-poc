import React, { FC, Fragment } from "react";
// MUI
import { Box, Typography } from "@mui/material";

// This isn't required for integration. This should already exist in experimental application.
interface ArmDetailProps {
  moldingArmOrders: any[];
}
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

export default ArmDetail;
