import { DateHelper, DragHelper, DomHelper } from "@bryntum/scheduler";
import Order from "./Order";
import {
  ROW_HEIGHT,
  ROW_MARGIN,
  // ONLY_WORKING_HOURS
} from "./SchedulerConfig";
import { mapToCounterWeightModel } from "./Util";

export default class Drag extends DragHelper {
  static get defaultConfig() {
    return {
      // Don't drag the actual row element, clone it
      cloneTarget: true,
      // Only allow drops on the schedule area
      dropTargetSelector: ".b-timeline-subgrid",
      // Only allow drag of row elements inside on the unplanned grid
      // This classname is specific to the CustomDragContainer component
      targetSelector: ".scheduler-counter-weight",
    };
  }

  idIncrement = 704;

  construct(config) {
    const me = this;

    super.construct(config);

    // Configure DragHelper with schedule's scrollManager to allow scrolling while dragging
    me.scrollManager = me.schedule.scrollManager;

    me.on({
      dragstart: me.onTaskDragStart,
      drag: me.onTaskDrag,
      drop: me.onTaskDrop,
      thisObj: me,
    });
  }

  onTaskDragStart({ context }) {
    // assign 'this' to variable 'me' for easy access
    const me = this,
      // destructure schedule
      { schedule } = me,
      // x-coordinate where mouse was clicked
      mouseX = context.clientX,
      // y-coordinate where mouse was clicked
      mouseY = context.pageY,
      // grab mutable element that will represent the object while it's being dragged
      proxy = context.element,
      newCounterWeight = mapToCounterWeightModel({
        id: this.idIncrement,
        // Doing some funky calculation to get the duration from the width of the counter weight draggable box
        duration: Math.ceil(
          proxy.clientWidth /
            schedule.timeAxisViewModel.getSingleUnitInPixels("millisecond")
        ),
        duration_unit: "millisecond",
      }),
      task = new Order(newCounterWeight);

    this.idIncrement += 1;

    if (task === undefined) {
      // task not found
      return;
    }

    // we know the task exists so calculate the width and height of the bar
    const newHeight = ROW_HEIGHT - ROW_MARGIN * 2,
      newWidth = schedule.timeAxisViewModel.getDistanceForDuration(
        task.duration // in ms
      );

    // save a reference to the task so we can access it later
    context.task = task;

    // mutate dragged element (grid row) into an event bar
    proxy.classList.remove("b-grid-row");
    proxy.classList.add("b-unassigned-class");
    proxy.classList.add("custom-dragged-element");
    proxy.classList.add(`b-${schedule.mode}`);
    proxy.innerHTML = `${task.name}`;
    proxy.style.height = `${newHeight}px`;
    proxy.style.width = `${newWidth}px`;

    // update context x and y values based on where we clicked + the height / width of data bar (which is calculated
    // based off the duration of the event)
    context.newX =
      context.elementStartX =
      context.elementX =
        mouseX - newWidth / 2;

    context.newY =
      context.elementStartY =
      context.elementY =
        mouseY - newHeight / 2;

    // Make sure the proxy element is centered for x and y values
    DomHelper.setTranslateX(proxy, context.newX);
    DomHelper.setTranslateY(proxy, context.newY);

    // prevent tooltips from showing while dragging
    me.schedule.element.classList.add("b-dragging-event");
  }

  onTaskDrag({ context }) {
    const me = this,
      { schedule } = me,
      { task } = context,
      coordinate = DomHelper[
        `getTranslate${schedule.isHorizontal ? "X" : "Y"}`
      ](context.element),
      startDate = schedule.getDateFromCoordinate(coordinate, "round", false),
      endDate =
        startDate &&
        DateHelper.add(startDate, task.duration, task.durationUnit),
      // Coordinates required when used in vertical mode, since it does not use actual columns
      resource =
        context.target && schedule.resolveResourceRecord(context.target);

    // Don't allow drops anywhere, only allow drops if the drop is on the timeaxis and on top of a Resource
    context.valid &=
      Boolean(startDate && resource) &&
      (schedule.allowOverlap ||
        schedule.isDateRangeAvailable(startDate, endDate, null, resource));

    // Save reference to resource so we can use it in onTaskDrop
    context.resource = resource;
  }

  // Drop callback after a mouse up, take action and transfer the unplanned task to the real EventStore (if it's valid)
  onTaskDrop({ context }) {
    const me = this,
      task = context.task,
      target = context.target;

    // If drop was done in a valid location, set the startDate and transfer the task to the Scheduler event store
    if (context.valid && target) {
      // ---------------- CREATING NEW EVENT ---------------------
      const date = me.schedule.getDateFromCoordinate(
        DomHelper.getTranslateX(context.element),
        "round",
        false
      );
      // Try resolving event record from target element, to determine if drop was on another event
      // targetEventRecord = me.schedule.resolveEventRecord(context.target);

      if (date) {
        // me.unassignedStore.remove(task);
        // me.grid.store.remove(task);

        task.setStartDate(date, true);
        task.assign(context.resource);
        me.schedule.eventStore.add(task);
      }
    }

    me.schedule.element.classList.remove("b-dragging-event");
    context.task = undefined;
  }

  getParents(elem) {
    var parents = [];
    while (
      elem.parentNode &&
      elem.parentNode.nodeName.toLowerCase() !== "body"
    ) {
      elem = elem.parentNode;
      parents.push(elem);
    }
    return parents;
  }
}
