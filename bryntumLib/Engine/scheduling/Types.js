/**
 * The enumeration for the time units
 */
export var TimeUnit;
(function (TimeUnit) {
    TimeUnit["Millisecond"] = "millisecond";
    TimeUnit["Second"] = "second";
    TimeUnit["Minute"] = "minute";
    TimeUnit["Hour"] = "hour";
    TimeUnit["Day"] = "day";
    TimeUnit["Week"] = "week";
    TimeUnit["Month"] = "month";
    TimeUnit["Quarter"] = "quarter";
    TimeUnit["Year"] = "year";
})(TimeUnit || (TimeUnit = {}));
/**
 * The enumeration for the supported constraint types
 */
export var ConstraintType;
(function (ConstraintType) {
    /**
     * "Must start on" constraint.
     * Restricts an event to start on a [[HasDateConstraintMixin.constraintDate|specified date]].
     * The constraint cannot be used for a summary event.
     */
    ConstraintType["MustStartOn"] = "muststarton";
    /**
     * "Must finish on" constraint.
     * Restricts an event to finish on a [[HasDateConstraintMixin.constraintDate|specified date]].
     * The constraint cannot be used for a summary event.
     */
    ConstraintType["MustFinishOn"] = "mustfinishon";
    /**
     * "Start no earlier than" constraint.
     * Restricting an event to start on or after a [[HasDateConstraintMixin.constraintDate|specified date]].
     */
    ConstraintType["StartNoEarlierThan"] = "startnoearlierthan";
    /**
     * "Start no later than" constraint.
     * Restricting an event to start on or before a [[HasDateConstraintMixin.constraintDate|specified date]].
     *
     * The constraint cannot be used for a summary task.
     */
    ConstraintType["StartNoLaterThan"] = "startnolaterthan";
    /**
     * "Finish no earlier than" constraint.
     * Restricting an event to finish on or after a [[HasDateConstraintMixin.constraintDate|specified date]].
     *
     * The constraint cannot be used for a summary task.
     */
    ConstraintType["FinishNoEarlierThan"] = "finishnoearlierthan";
    /**
     * "Finish no later than" constraint.
     * Restricting an event to finish on or before a [[HasDateConstraintMixin.constraintDate|specified date]].
     */
    ConstraintType["FinishNoLaterThan"] = "finishnolaterthan";
})(ConstraintType || (ConstraintType = {}));
/**
 * The enumeration for the supported scheduling modes
 */
export var SchedulingMode;
(function (SchedulingMode) {
    SchedulingMode["Normal"] = "Normal";
    SchedulingMode["FixedDuration"] = "FixedDuration";
    SchedulingMode["FixedEffort"] = "FixedEffort";
    SchedulingMode["FixedUnits"] = "FixedUnits";
})(SchedulingMode || (SchedulingMode = {}));
/**
 * The enumeration for the dependency validation result
 */
export var DependencyValidationResult;
(function (DependencyValidationResult) {
    /**
     * Dependency has no errors
     */
    DependencyValidationResult[DependencyValidationResult["NoError"] = 0] = "NoError";
    /**
     * Indicates that the validated dependency builds a cycle
     */
    DependencyValidationResult[DependencyValidationResult["CyclicDependency"] = 1] = "CyclicDependency";
    /**
     * Indicates that a dependency with the same predecessor and successor as validated one's already exists
     */
    DependencyValidationResult[DependencyValidationResult["DuplicatingDependency"] = 2] = "DuplicatingDependency";
})(DependencyValidationResult || (DependencyValidationResult = {}));
/**
 * The enumeration for the supported dependency types
 */
export var DependencyType;
(function (DependencyType) {
    /**
     * Start-to-Start (_SS_)
     *
     * With this dependency type, the succeeding event is delayed to start not earlier than the preceding event starts.
     */
    DependencyType[DependencyType["StartToStart"] = 0] = "StartToStart";
    /**
     * Start-to-Finish (_SF_)
     *
     * The finish of the succeeding event is constrained by the start of the preceding event.
     * So the successor cannot finish before the predecessor starts.
     */
    DependencyType[DependencyType["StartToEnd"] = 1] = "StartToEnd";
    /**
     * Finish-to-Start (_FS_)
     *
     * This type of dependency, restricts the dependent event to not start earlier than the preceding event finishes.
     */
    DependencyType[DependencyType["EndToStart"] = 2] = "EndToStart";
    /**
     * Finish-to-Finish (_FF_)
     *
     * The succeeding event cannot finish before the completion of the preceding event.
     */
    DependencyType[DependencyType["EndToEnd"] = 3] = "EndToEnd";
})(DependencyType || (DependencyType = {}));
/**
 * The enumeration for the supported sources of the calendar for the dependency.
 */
export var DependenciesCalendar;
(function (DependenciesCalendar) {
    DependenciesCalendar["Project"] = "Project";
    DependenciesCalendar["FromEvent"] = "FromEvent";
    DependenciesCalendar["ToEvent"] = "ToEvent";
})(DependenciesCalendar || (DependenciesCalendar = {}));
/**
 * Engine provides with different project types, the enumeration describes the types currently available
 */
export var ProjectType;
(function (ProjectType) {
    ProjectType[ProjectType["SchedulerBasic"] = 1] = "SchedulerBasic";
    ProjectType[ProjectType["SchedulerPro"] = 2] = "SchedulerPro";
    ProjectType[ProjectType["Gantt"] = 3] = "Gantt";
})(ProjectType || (ProjectType = {}));
/**
 * The enumeration for the scheduling direction
 */
export var Direction;
(function (Direction) {
    /**
     * Forward (or As Soon As Possible (ASAP)) scheduling.
     */
    Direction["Forward"] = "Forward";
    /**
     * Backward (or As Late As Possible (ALAP)) scheduling.
     */
    Direction["Backward"] = "Backward";
    Direction["None"] = "None";
})(Direction || (Direction = {}));
export var ConstraintIntervalSide;
(function (ConstraintIntervalSide) {
    ConstraintIntervalSide["Start"] = "Start";
    ConstraintIntervalSide["End"] = "End";
})(ConstraintIntervalSide || (ConstraintIntervalSide = {}));
