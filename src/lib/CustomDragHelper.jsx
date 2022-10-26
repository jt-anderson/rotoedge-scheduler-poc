import { DateHelper, DragHelper, DomHelper } from "@bryntum/scheduler";
import { ROW_HEIGHT, ROW_MARGIN, ONLY_WORKING_HOURS } from "./SchedulerConfig";

export default class Drag extends DragHelper {
  static get defaultConfig() {
    return {
      // Don't drag the actual row element, clone it
      cloneTarget: true,
      // Only allow drops on the schedule area
      dropTargetSelector: ".b-timeline-subgrid",
      // Only allow drag of row elements inside on the unplanned grid
      // This classname is specific to the CustomDragContainer component
      targetSelector: ".scheduler-unplanned-item",
    };
  }

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
      // important - Each object that is draggable needs a data attribute on it's container with the object's id.
      taskId = context.grabbed.getAttribute("data-id"),
      // https://www.bryntum.com/docs/scheduler/api/Scheduler/model/EventModel
      task = me.unassignedStore.findRecord("id", +taskId);

    // If we can't identify the task, don't allow the item to be dragged (this might occur for a couple
    // of reasons). the dragged item could not be identified in the store so make sure:
    // 1. the draggable item has a container with a data attribute ('data-id') of the item's ID
    // 2. the CustomDrag class has an object called 'unassignedStore' which is correctly populated with
    // the data store of items of assigned but unscheduled orders to that arm.
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
        me.unassignedStore.remove(task);
        // me.grid.store.remove(task);

        task.setStartDate(date, true);
        task.assign(context.resource);
        me.schedule.eventStore.add(task);
      }
    }

    me.schedule.element.classList.remove("b-dragging-event");
  }

  getParents(elem) {
    var parents = [];
    while (
      elem.parentNode &&
      elem.parentNode.nodeName.toLowerCase() != "body"
    ) {
      elem = elem.parentNode;
      parents.push(elem);
    }
    return parents;
  }
}
