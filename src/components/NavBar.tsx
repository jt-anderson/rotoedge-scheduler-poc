// react imports
import React, { FC, useState, useEffect } from "react";
import { Link } from "react-router-dom";
// MUI imports
import { styled, useTheme, Theme, CSSObject } from "@mui/material/styles";
import {
  IconButton,
  Toolbar,
  Divider,
  List,
  ListItemText,
  Box,
  Backdrop,
  ListItemButton,
  CircularProgress,
} from "@mui/material/";
import MuiAppBar, { AppBarProps as MuiAppBarProps } from "@mui/material/AppBar";
import MuiDrawer from "@mui/material/Drawer";
// Icon imports
import Menu from "@mui/icons-material/Menu";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronLeft";
import Typography from "@mui/material/Typography";

// ======================================================= copy pastaed from MUI docs for the permanent sidebar
const drawerWidth: number = 240;
const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: "hidden",
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create("width", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: "hidden",
  width: `calc(${theme.spacing(5)} + 1px)`,
  [theme.breakpoints.up("sm")]: {
    width: `calc(${theme.spacing(7)} + 1px)`,
  },
});

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  padding: theme.spacing(0, 1),
  // necessary for pages to be below app bar
  ...theme.mixins.toolbar,
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open",
})<AppBarProps>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: theme.transitions.create(["width", "margin"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(["width", "margin"], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== "open",
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: "nowrap",
  boxSizing: "border-box",
  ...(open && {
    ...openedMixin(theme),
    "& .MuiDrawer-paper": openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    "& .MuiDrawer-paper": closedMixin(theme),
  }),
}));
// ============================================================================================ end copy pasta

interface NavigationProps {
  navList: any[];
  //   openDrawer: () => void;
  //   closeDrawer: () => void;
  //   drawerIsOpen: boolean;
  //   drawerStickOpen: boolean;
}

/**
 * The sidebar navigation comp
 * @param openDrawer opens the parent component drawer
 * @param closeDrawer closes the parent component drawer
 * @param drawerIsOpen track drawer open status, when closed, close all opened nav lists
 * @param drawerStickOpen
 */
const Navigation: FC<NavigationProps> = ({ navList }) => {
  //   {name: 'loading', icon: <Input />},
  //   {name: 'molding', icon: <Cached />},

  return (
    <List>
      {navList.map((nav: any, index: number) => (
        <div key={index}>
          <ListItemButton title={nav.name} component={Link} to={nav.location}>
            {nav.icon}
            <ListItemText sx={{ ml: 2 }} primary={nav.name} />
          </ListItemButton>
        </div>
      ))}
    </List>
  );
};

interface NavHeaderProps {
  navList: any[];
}
/**
 * Drawerheader comp
 * @constructor
 */
const NavHeader: FC<NavHeaderProps> = ({ navList }) => {
  const theme = useTheme();
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [loading] = useState<boolean>(false);

  const handleDrawerOpen = () => setDrawerOpen(true);
  const handleDrawerClose = () => setDrawerOpen(false);

  useEffect(() => {
    // Manually updating the width of the container because material-ui is annoyning
    // if we don't use all of their components -____-
    const el = document.getElementById("container");
    if (drawerOpen && el != null) {
      el.style.marginLeft = "240px";
      el.style.transitionDuration = "200ms";
    } else if (!drawerOpen && el != null) {
      el.style.marginLeft = "57px";
      el.style.transitionDuration = "170ms";
    }
  }, [drawerOpen]);

  return (
    <Box sx={{ display: "flex" }}>
      {loading ? (
        // Is armloading
        <Backdrop
          sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
          open={loading}
        >
          <CircularProgress color="inherit" />
        </Backdrop>
      ) : (
        // done armloading
        <>
          <AppBar position="fixed" open={drawerOpen}>
            <Toolbar style={{ justifyContent: "space-between" }}>
              <IconButton
                size="medium"
                edge="start"
                color="inherit"
                aria-label="menu"
                title="Display menu"
                onClick={handleDrawerOpen}
              >
                <Menu />
              </IconButton>
              <Typography
                variant="h6"
                component="div"
                sx={{ flexGrow: 1, ml: 4 }}
              >
                RotoEdge Pro - Scheduler Demo
              </Typography>
            </Toolbar>
          </AppBar>
          <Drawer
            anchor="left"
            variant="permanent"
            open={drawerOpen}
            onClose={handleDrawerClose}
          >
            <DrawerHeader>
              <IconButton onClick={handleDrawerClose}>
                {theme.direction === "rtl" ? (
                  <ChevronRightIcon />
                ) : (
                  <ChevronLeftIcon />
                )}
              </IconButton>
            </DrawerHeader>
            <Divider />
            <Navigation navList={navList} />
          </Drawer>
        </>
      )}
    </Box>
  );
};

export default NavHeader;
