// react imports
import React, { FC, useState, useEffect, Fragment } from "react";
import { Link, Route } from "react-router-dom";
// MUI import
import EventNote from "@mui/icons-material/EventNote";
import Input from "@mui/icons-material/Input";
import Cached from "@mui/icons-material/Cached";
import HomeIcon from "@mui/icons-material/Home";
// custom imports
import NavBar from "./components/NavBar";
import MachineScheduling from "./pages/MachineScheduling";
import Home from "./pages/Home";

const Demo: FC = () => {
  const [navList, setNavList] = useState<any>([
    {
      identifier: "home",
      name: "Home",
      location: "/",
      icon: <HomeIcon />,
    },
    {
      identifier: "machineScheduling",
      name: "Machine Scheduling",
      location: "/machineScheduling",
      icon: <EventNote />,
    },
  ]);

  const navListDictionary = Object.assign(
    {},
    ...navList.map((nav: any) => ({ [nav.identifier]: nav }))
  );

  return (
    <Fragment>
      <NavBar navList={navList} />
      <>
        <Route path={navListDictionary.home.location} component={Home} />
        <Route
          path={navListDictionary.machineScheduling.location}
          component={MachineScheduling}
        />
      </>
    </Fragment>
  );
};

export default Demo;
