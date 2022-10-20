/**
 * The date intervals in the scheduling engine are always inclusive on one end and opened on another.
 * The "opened" end is not considered to be a part of the interval.
 *
 * Depending from the scheduling direction (forward/backward) this property may need to be inverted.
 *
 * This enum specifies what edge of the interval is inclusive.
 */
export var EdgeInclusion;
(function (EdgeInclusion) {
    EdgeInclusion[EdgeInclusion["Left"] = 0] = "Left";
    EdgeInclusion[EdgeInclusion["Right"] = 1] = "Right";
})(EdgeInclusion || (EdgeInclusion = {}));
