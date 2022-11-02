import React, { Fragment } from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import EventNote from "@mui/icons-material/EventNote";
import HomeIcon from "@mui/icons-material/Home";
// custom imports
import NavBar from "./components/NavBar";
import Home from "./pages/Home";
import MachineScheduling from "./pages/MachineScheduling";
import "./App.css";

const navList = [
  {
    name: "Home",
    location: "/",
    icon: <HomeIcon />,
    component: <Home />,
  },
  {
    name: "Machine Scheduling",
    location: "/machineScheduling",
    icon: <EventNote />,
    component: <MachineScheduling />,
  },
];

ReactDOM.render(
  <BrowserRouter>
    <Fragment>
      <NavBar navList={navList} />
      <Routes>
        {navList.map((navItem: any, i: any) => (
          <Route
            key={`nav-item-${i}`}
            path={navItem.location}
            element={navItem.component}
          />
        ))}
      </Routes>
    </Fragment>
  </BrowserRouter>,
  document.getElementById("container")
);
