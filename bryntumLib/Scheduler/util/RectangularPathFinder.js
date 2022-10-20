import Base from '../../Core/Base.js';
import ArrayHelper from '../../Core/helper/ArrayHelper.js';
import WalkHelper from '../../Core/helper/WalkHelper.js';

// Start adjusting if there is system scaling > 130%
const
    THRESHOLD      = Math.min(1 / globalThis.devicePixelRatio, 0.75),
    BOX_PROPERTIES = ['start', 'end', 'top', 'bottom'],
    equalEnough    = (a, b) => Math.abs(a - b) < 0.1,
    sideToSide     = {
        l : 'left',
        r : 'right',
        t : 'top',
        b : 'bottom'
    };

/**
 * @module Scheduler/util/RectangularPathFinder
 */

/**
 * Class which finds rectangular path, i.e. path with 90 degrees turns, between two boxes.
 * @private
 */
export default class RectangularPathFinder extends Base {
    static get configurable() {
        return {
            /**
             * Default start connection side: 'left', 'right', 'top', 'bottom'
             * @config {'top'|'bottom'|'left'|'right'}
             * @default
             */
            startSide : 'right',

            // /**
            //  * Default start arrow size in pixels
            //  * @config {Number}
            //  * @default
            //  */
            // startArrowSize : 0,

            /**
             * Default start arrow staff size in pixels
             * @config {Number}
             * @default
             */
            startArrowMargin : 12,

            /**
             * Default starting connection point shift from box's arrow pointing side middle point
             * @config {Number}
             * @default
             */
            startShift : 0,

            /**
             * Default end arrow pointing direction, possible values are: 'left', 'right', 'top', 'bottom'
             * @config {'top'|'bottom'|'left'|'right'}
             * @default
             */
            endSide : 'left',

            // /**
            //  * Default end arrow size in pixels
            //  * @config {Number}
            //  * @default
            //  */
            // endArrowSize : 0,

            /**
             * Default end arrow staff size in pixels
             * @config {Number}
             * @default
             */
            endArrowMargin : 12,

            /**
             * Default ending connection point shift from box's arrow pointing side middle point
             * @config {Number}
             * @default
             */
            endShift : 0,

            /**
             * Start / End box vertical margin, the amount of pixels from top and bottom line of a box where drawing
             * is prohibited
             * @config {Number}
             * @default
             */
            verticalMargin : 2,

            /**
             * Start / End box horizontal margin, the amount of pixels from left and right line of a box where drawing
             * @config {Number}
             * @default
             */
            horizontalMargin : 5,

            /**
             * Other rectangular areas (obstacles) to search path through
             * @config {Object[]}
             * @default
             */
            otherBoxes : null,

            /**
             * The owning Scheduler. Mandatory so that it can determin RTL state.
             * @config {Scheduler.view.Scheduler}
             * @private
             */
            client : {}
        };
    }

    /**
     * Returns list of horizontal and vertical segments connecting two boxes
     * <pre>
     *    |    | |  |    |       |
     *  --+----+----+----*-------*---
     *  --+=>Start  +----*-------*--
     *  --+----+----+----*-------*--
     *    |    | |  |    |       |
     *    |    | |  |    |       |
     *  --*----*-+-------+-------+--
     *  --*----*-+         End <=+--
     *  --*----*-+-------+-------+--
     *    |    | |  |    |       |
     * </pre>
     * Path goes by lines (-=) and turns at intersections (+), boxes depicted are adjusted by horizontal/vertical
     * margin and arrow margin, original boxes are smaller (path can't go at original box borders). Algorithm finds
     * the shortest path with minimum amount of turns. In short it's mix of "Lee" and "Dijkstra pathfinding"
     * with turns amount taken into account for distance calculation.
     *
     * The algorithm is not very performant though, it's O(N^2), where N is amount of
     * points in the grid, but since the maximum amount of points in the grid might be up to 34 (not 36 since
     * two box middle points are not permitted) that might be ok for now.
     *
     * @param {Object} lineDef An object containing any of the class configuration option overrides as well
     *                         as `startBox`, `endBox`, `startHorizontalMargin`, `startVerticalMargin`,
     *                         `endHorizontalMargin`, `endVerticalMargin` properties
     * @param {Object} lineDef.startBox An object containing `start`, `end`, `top`, `bottom` properties
     * @param {Object} lineDef.endBox   An object containing `start`, `end`, `top`, `bottom` properties
     * @param {Number} lineDef.startHorizontalMargin Horizontal margin override for start box
     * @param {Number} lineDef.startVerticalMargin   Vertical margin override for start box
     * @param {Number} lineDef.endHorizontalMargin   Horizontal margin override for end box
     * @param {Number} lineDef.endVerticalMargin     Vertical margin override for end box
     *
     *
     * @returns {Object[]|Boolean} Array of line segments or false if path cannot be found
     * @returns {Number} return.x1
     * @returns {Number} return.y1
     * @returns {Number} return.x2
     * @returns {Number} return.y2
     */
    //
    //@ignore
    //@privateparam {Function[]|Function} noPathFallbackFn
    //     A function or array of functions which will be tried in case a path can't be found
    //     Each function will be given a line definition it might try to adjust somehow and return.
    //     The new line definition returned will be tried to find a path.
    //     If a function returns false, then next function will be called if any.
    //
    findPath(lineDef, noPathFallbackFn) {
        const
            me              = this,
            originalLineDef = lineDef;

        let lineDefFull,
            startBox,
            endBox,
            startShift,
            endShift,
            startSide,
            endSide,
            // startArrowSize,
            // endArrowSize,
            startArrowMargin,
            endArrowMargin,
            horizontalMargin,
            verticalMargin,
            startHorizontalMargin,
            startVerticalMargin,
            endHorizontalMargin,
            endVerticalMargin,
            otherHorizontalMargin,
            otherVerticalMargin,
            otherBoxes,

            connStartPoint, connEndPoint,
            pathStartPoint, pathEndPoint,
            gridStartPoint, gridEndPoint,
            startGridBox, endGridBox,
            grid, path, tryNum;

        noPathFallbackFn = ArrayHelper.asArray(noPathFallbackFn);

        for (tryNum = 0; lineDef && !path;) {
            lineDefFull = Object.assign(me.config, lineDef);

            startBox              = lineDefFull.startBox;
            endBox                = lineDefFull.endBox;
            startShift            = lineDefFull.startShift;
            endShift              = lineDefFull.endShift;
            startSide             = lineDefFull.startSide;
            endSide               = lineDefFull.endSide;
            // startArrowSize        = lineDefFull.startArrowSize;
            // endArrowSize          = lineDefFull.endArrowSize;
            startArrowMargin      = lineDefFull.startArrowMargin;
            endArrowMargin        = lineDefFull.endArrowMargin;
            horizontalMargin      = lineDefFull.horizontalMargin;
            verticalMargin        = lineDefFull.verticalMargin;
            startHorizontalMargin = lineDefFull.hasOwnProperty('startHorizontalMargin') ? lineDefFull.startHorizontalMargin : horizontalMargin;
            startVerticalMargin   = lineDefFull.hasOwnProperty('startVerticalMargin') ? lineDefFull.startVerticalMargin : verticalMargin;
            endHorizontalMargin   = lineDefFull.hasOwnProperty('endHorizontalMargin') ? lineDefFull.endHorizontalMargin : horizontalMargin;
            endVerticalMargin     = lineDefFull.hasOwnProperty('endVerticalMargin') ? lineDefFull.endVerticalMargin : verticalMargin;
            otherHorizontalMargin = lineDefFull.hasOwnProperty('otherHorizontalMargin') ? lineDefFull.otherHorizontalMargin : horizontalMargin;
            otherVerticalMargin   = lineDefFull.hasOwnProperty('otherVerticalMargin') ? lineDefFull.otherVerticalMargin : verticalMargin;
            otherBoxes            = lineDefFull.otherBoxes;

            startSide = me.normalizeSide(startSide);
            endSide   = me.normalizeSide(endSide);

            connStartPoint = me.getConnectionCoordinatesFromBoxSideShift(startBox, startSide, startShift);
            connEndPoint   = me.getConnectionCoordinatesFromBoxSideShift(endBox, endSide, endShift);

            startGridBox   = me.calcGridBaseBoxFromBoxAndDrawParams(startBox, startSide/*, startArrowSize*/, startArrowMargin, startHorizontalMargin, startVerticalMargin);
            endGridBox     = me.calcGridBaseBoxFromBoxAndDrawParams(endBox, endSide/*, endArrowSize*/, endArrowMargin, endHorizontalMargin, endVerticalMargin);

            // Iterate over points and merge those which are too close to each other (e.g. if difference is less than one
            // over devicePixelRatio we won't even see this effect in GUI)
            // https://github.com/bryntum/support/issues/3923
            BOX_PROPERTIES.forEach(property => {
                // We're talking subpixel precision here, so it doesn't really matter which value we choose
                if (Math.abs(startGridBox[property] - endGridBox[property]) <= THRESHOLD) {
                    endGridBox[property] = startGridBox[property];
                }
            });

            if (me.shouldLookForPath(startBox, endBox, startGridBox, endGridBox)) {
                otherBoxes     = otherBoxes?.map(box =>
                    me.calcGridBaseBoxFromBoxAndDrawParams(box, false/*, 0*/, 0, otherHorizontalMargin, otherVerticalMargin)
                );
                pathStartPoint = me.getConnectionCoordinatesFromBoxSideShift(startGridBox, startSide, startShift);
                pathEndPoint   = me.getConnectionCoordinatesFromBoxSideShift(endGridBox, endSide, endShift);
                grid           = me.buildPathGrid(startGridBox, endGridBox, pathStartPoint, pathEndPoint, startSide, endSide, otherBoxes);
                gridStartPoint = me.convertDecartPointToGridPoint(grid, pathStartPoint);
                gridEndPoint   = me.convertDecartPointToGridPoint(grid, pathEndPoint);
                path           = me.findPathOnGrid(grid, gridStartPoint, gridEndPoint, startSide, endSide);
            }



            // Loop if
            // - path is still not found
            // - have no next line definition (which should be obtained from call to one of the functions from noPathFallbackFn array
            // - have noPathFallBackFn array
            // - current try number is less then noPathFallBackFn array length
            for (lineDef = false; !path && !lineDef && noPathFallbackFn && tryNum < noPathFallbackFn.length; tryNum++) {
                lineDef = (noPathFallbackFn[tryNum])(lineDefFull, originalLineDef);
            }
        }

        if (path) {
            path = me.prependPathWithArrowStaffSegment(path, connStartPoint/*, startArrowSize*/, startSide);
            path = me.appendPathWithArrowStaffSegment(path, connEndPoint/*, endArrowSize*/, endSide);
            path = me.optimizePath(path);
        }

        return path;
    }

    // Compares boxes relative position in the given direction.
    //  0 - 1 is to the left/top of 2
    //  1 - 1 overlaps with left/top edge of 2
    //  2 - 1 is inside 2
    // -2 - 2 is inside 1
    //  3 - 1 overlaps with right/bottom edge of 2
    //  4 - 1 is to the right/bottom of 2
    static calculateRelativePosition(box1, box2, vertical = false) {
        const
            startProp = vertical ? 'top' : 'start',
            endProp   = vertical ? 'bottom' : 'end';

        let result;

        if (box1[endProp] < box2[startProp]) {
            result = 0;
        }
        else if (box1[endProp] <= box2[endProp] && box1[endProp] >= box2[startProp] && box1[startProp] < box2[startProp]) {
            result = 1;
        }
        else if (box1[startProp] >= box2[startProp] && box1[endProp] <= box2[endProp]) {
            result = 2;
        }
        else if (box1[startProp] < box2[startProp] && box1[endProp] > box2[endProp]) {
            result = -2;
        }
        else if (box1[startProp] <= box2[endProp] && box1[endProp] > box2[endProp]) {
            result = 3;
        }
        else {
            result = 4;
        }

        return result;
    }

    // Checks if relative position of the original and marginized boxes is the same
    static boxOverlapChanged(startBox, endBox, gridStartBox, gridEndBox, vertical = false) {
        const
            calculateOverlap = RectangularPathFinder.calculateRelativePosition,
            originalOverlap  = calculateOverlap(startBox, endBox, vertical),
            finalOverlap     = calculateOverlap(gridStartBox, gridEndBox, vertical);

        return originalOverlap !== finalOverlap;
    }

    shouldLookForPath(startBox, endBox, gridStartBox, gridEndBox) {
        let result = true;

        // Only calculate overlap if boxes are narrow in horizontal direction
        if (
            // We refer to the original arrow margins because during lookup those might be nullified and we need some
            // criteria to tell if events are too narrow
            (startBox.end - startBox.start <= this.startArrowMargin || endBox.end - endBox.start <= this.endArrowMargin) &&
            Math.abs(RectangularPathFinder.calculateRelativePosition(startBox, endBox, true)) === 2
        ) {
            result = !RectangularPathFinder.boxOverlapChanged(startBox, endBox, gridStartBox, gridEndBox);
        }

        return result;
    }

    getConnectionCoordinatesFromBoxSideShift(box, side, shift) {
        let coords;

        // Note that we deal with screen geometry here, not logical dependency sides
        // Possible 'start' and 'end' have been resolved to box sides.
        switch (side) {
            case 'left':
                coords = {
                    x : box.start,
                    y : (box.top + box.bottom) / 2 + shift
                };
                break;
            case 'right':
                coords = {
                    x : box.end,
                    y : (box.top + box.bottom) / 2 + shift
                };
                break;
            case 'top':
                coords = {
                    x : (box.start + box.end) / 2 + shift,
                    y : box.top
                };
                break;
            case 'bottom':
                coords = {
                    x : (box.start + box.end) / 2 + shift,
                    y : box.bottom
                };
                break;
        }

        return coords;
    }

    calcGridBaseBoxFromBoxAndDrawParams(box, side/*, arrowSize*/, arrowMargin, horizontalMargin, verticalMargin) {
        let gridBox;

        switch (this.normalizeSide(side)) {
            case 'left':
                gridBox = {
                    start  : box.start - Math.max(/*arrowSize + */arrowMargin, horizontalMargin),
                    end    : box.end + horizontalMargin,
                    top    : box.top - verticalMargin,
                    bottom : box.bottom + verticalMargin
                };
                break;
            case 'right':
                gridBox = {
                    start  : box.start - horizontalMargin,
                    end    : box.end + Math.max(/*arrowSize + */arrowMargin, horizontalMargin),
                    top    : box.top - verticalMargin,
                    bottom : box.bottom + verticalMargin
                };
                break;
            case 'top':
                gridBox = {
                    start  : box.start - horizontalMargin,
                    end    : box.end + horizontalMargin,
                    top    : box.top - Math.max(/*arrowSize + */arrowMargin, verticalMargin),
                    bottom : box.bottom + verticalMargin
                };
                break;
            case 'bottom':
                gridBox = {
                    start  : box.start - horizontalMargin,
                    end    : box.end + horizontalMargin,
                    top    : box.top - verticalMargin,
                    bottom : box.bottom + Math.max(/*arrowSize + */arrowMargin, verticalMargin)
                };
                break;
            default:
                gridBox = {
                    start  : box.start - horizontalMargin,
                    end    : box.end + horizontalMargin,
                    top    : box.top - verticalMargin,
                    bottom : box.bottom + verticalMargin
                };
        }

        return gridBox;
    }

    normalizeSide(side) {
        const { rtl } = this.client;

        side => sideToSide[side] || side;

        if (side === 'start') {
            return rtl ? 'right' : 'left';
        }
        if (side === 'end') {
            return rtl ? 'left' : 'right';
        }
        return side;
    }

    buildPathGrid(startGridBox, endGridBox, pathStartPoint, pathEndPoint, startSide, endSide, otherGridBoxes) {
        let xs, ys,
            y, x, ix, iy, xslen, yslen, ib, blen, box, permitted, point;

        const
            points       = {},
            linearPoints = [];

        xs = [
            startGridBox.start,
            (startSide === 'left' || startSide === 'right') ? (startGridBox.start + startGridBox.end) / 2 : pathStartPoint.x,
            startGridBox.end,
            endGridBox.start,
            (endSide === 'left' || endSide === 'right') ? (endGridBox.start + endGridBox.end) / 2 : pathEndPoint.x,
            endGridBox.end
        ];
        ys = [
            startGridBox.top,
            (startSide === 'top' || startSide === 'bottom') ? (startGridBox.top + startGridBox.bottom) / 2 : pathStartPoint.y,
            startGridBox.bottom,
            endGridBox.top,
            (endSide === 'top' || endSide === 'bottom') ? (endGridBox.top + endGridBox.bottom) / 2 : pathEndPoint.y,
            endGridBox.bottom
        ];

        if (otherGridBoxes) {
            otherGridBoxes.forEach(box => {
                xs.push(box.start, (box.start + box.end) / 2, box.end);
                ys.push(box.top, (box.top + box.bottom) / 2, box.bottom);
            });
        }

        xs = [...new Set(xs.sort((a, b) => a - b))];
        ys = [...new Set(ys.sort((a, b) => a - b))];

        // TODO: fastest way to make unique, Set is slower
        // for ( let i = 0, I = array.length; i < I; i++ ) {
        //     if ( ~array.indexOf( array[ i ], i + 1 ) ) {
        //         array.splice( i, 1 );
        //         i--;
        //         I--;
        //     }
        // }

        for (iy = 0, yslen = ys.length; iy < yslen; ++iy) {
            points[iy] = points[iy] || {};
            y          = ys[iy];
            for (ix = 0, xslen = xs.length; ix < xslen; ++ix) {
                x = xs[ix];

                permitted = (
                    (x <= startGridBox.start || x >= startGridBox.end || y <= startGridBox.top || y >= startGridBox.bottom) &&
                    (x <= endGridBox.start || x >= endGridBox.end || y <= endGridBox.top || y >= endGridBox.bottom)
                );

                if (otherGridBoxes) {
                    for (ib = 0, blen = otherGridBoxes.length; permitted && ib < blen; ++ib) {
                        box       = otherGridBoxes[ib];
                        permitted = (x <= box.start || x >= box.end || y <= box.top || y >= box.bottom) ||
                            // Allow point if it is a path start/end even if point is inside any box
                            (x === pathStartPoint.x && y === pathStartPoint.y) ||
                            (x === pathEndPoint.x && y === pathEndPoint.y);
                    }
                }

                point = {
                    distance : Number.MAX_SAFE_INTEGER,
                    permitted,
                    x,
                    y,
                    ix,
                    iy
                };

                points[iy][ix] = point;
                linearPoints.push(point);
            }
        }

        return {
            width        : xs.length,
            height       : ys.length,
            xs           : xs,
            ys           : ys,
            points       : points,
            linearPoints : linearPoints
        };
    }

    convertDecartPointToGridPoint(grid, point) {
        const
            x = grid.xs.indexOf(point.x),
            y = grid.ys.indexOf(point.y);

        return grid.points[y][x];
    }

    findPathOnGrid(grid, gridStartPoint, gridEndPoint, startSide, endSide) {
        const me = this;

        let path = false;

        if (gridStartPoint.permitted && gridEndPoint.permitted) {
            grid = me.waveForward(grid, gridStartPoint, 0);
            path = me.collectPath(grid, gridEndPoint, endSide);
        }

        return path;
    }

    // Returns neighbors from Von Neiman ambit (see Lee pathfinding algorithm description)
    getGridPointNeighbors(grid, gridPoint, predicateFn) {
        const
            ix     = gridPoint.ix,
            iy     = gridPoint.iy,
            result = [];

        let neighbor;

        // NOTE:
        // It's important to push bottom neighbors first since this method is used
        // in collectPath(), which recursively collects path from end to start node
        // and if bottom neighbors are pushed first in result array then collectPath()
        // will produce a line which is more suitable (pleasant looking) for our purposes.
        if (iy < grid.height - 1) {
            neighbor = grid.points[iy + 1][ix];
            (!predicateFn || predicateFn(neighbor)) && result.push(neighbor);
        }
        if (iy > 0) {
            neighbor = grid.points[iy - 1][ix];
            (!predicateFn || predicateFn(neighbor)) && result.push(neighbor);
        }
        if (ix < grid.width - 1) {
            neighbor = grid.points[iy][ix + 1];
            (!predicateFn || predicateFn(neighbor)) && result.push(neighbor);
        }
        if (ix > 0) {
            neighbor = grid.points[iy][ix - 1];
            (!predicateFn || predicateFn(neighbor)) && result.push(neighbor);
        }

        return result;
    }

    waveForward(grid, gridStartPoint, distance) {
        const me = this;

        // I use the WalkHelper here because a point on a grid and it's neighbors might be considered as a hierarchy.
        // The point is the parent node, and it's neighbors are the children nodes. Thus the grid here is hierarchical
        // data structure which can be walked. WalkHelper walks non-recursively which is exactly what I need as well.
        WalkHelper.preWalkUnordered(
            // Walk starting point - a node is a grid point and it's distance from the starting point
            [gridStartPoint, distance],
            // Children query function
            // NOTE: It's important to fix neighbor distance first, before waving to a neighbor, otherwise waving might
            //       get through a neighbor point setting it's distance to a value more than (distance + 1) whereas we,
            //       at the children querying moment in time, already know that the possibly optimal distance is (distance + 1)
            ([point, distance]) => me.getGridPointNeighbors(
                grid,
                point,
                neighborPoint => neighborPoint.permitted && (neighborPoint.distance > distance + 1)
            ).map(
                neighborPoint => [neighborPoint, distance + 1] // Neighbor distance fixation
            ),
            // Walk step iterator function
            ([point, distance]) => point.distance = distance // Neighbor distance applying
        );

        return grid;
    }

    collectPath(grid, gridEndPoint, endSide) {
        const
            me   = this,
            path = [];

        let pathFound = true,
            neighbors,
            lowestDistanceNeighbor,
            xDiff, yDiff;

        while (pathFound && gridEndPoint.distance) {
            neighbors = me.getGridPointNeighbors(grid, gridEndPoint, point =>
                point.permitted && (point.distance === gridEndPoint.distance - 1)
            );

            pathFound = neighbors.length > 0;

            if (pathFound) {
                // Prefer turnless neighbors first
                neighbors = neighbors.sort((a, b) => {
                    let xDiff, yDiff;

                    xDiff = a.ix - gridEndPoint.ix;
                    yDiff = a.iy - gridEndPoint.iy;

                    const resultA = (
                        ((endSide === 'left' || endSide === 'right') && yDiff === 0) ||
                        ((endSide === 'top' || endSide === 'bottom') && xDiff === 0)
                    ) ? -1 : 1;

                    xDiff = b.ix - gridEndPoint.ix;
                    yDiff = b.iy - gridEndPoint.iy;

                    const resultB = (
                        ((endSide === 'left' || endSide === 'right') && yDiff === 0) ||
                        ((endSide === 'top' || endSide === 'bottom') && xDiff === 0)
                    ) ? -1 : 1;

                    if (resultA > resultB) return 1;
                    if (resultA < resultB) return -1;
                    // apply additional sorting to be sure to pick bottom path in IE
                    if (resultA === resultB) return a.y > b.y ? -1 : 1;
                });

                lowestDistanceNeighbor = neighbors[0];

                path.push({
                    x1 : lowestDistanceNeighbor.x,
                    y1 : lowestDistanceNeighbor.y,
                    x2 : gridEndPoint.x,
                    y2 : gridEndPoint.y
                });

                // Detecting new side, either xDiff or yDiff must be 0 (but not both)
                xDiff = lowestDistanceNeighbor.ix - gridEndPoint.ix;
                yDiff = lowestDistanceNeighbor.iy - gridEndPoint.iy;

                switch (true) {
                    case !yDiff && xDiff > 0:
                        endSide = 'left';
                        break;
                    case !yDiff && xDiff < 0:
                        endSide = 'right';
                        break;
                    case !xDiff && yDiff > 0:
                        endSide = 'top';
                        break;
                    case !xDiff && yDiff < 0:
                        endSide = 'bottom';
                        break;
                }

                gridEndPoint = lowestDistanceNeighbor;
            }
        }

        return pathFound && path.reverse() || false;
    }

    prependPathWithArrowStaffSegment(path, connStartPoint/*, startArrowSize*/, startSide) {
        if (path.length > 0) {
            const
                firstSegment   = path[0],
                prependSegment = {
                    x2 : firstSegment.x1,
                    y2 : firstSegment.y1
                };

            switch (startSide) {
                case 'left':
                    prependSegment.x1 = connStartPoint.x/* - startArrowSize*/;
                    prependSegment.y1 = firstSegment.y1;
                    break;
                case 'right':
                    prependSegment.x1 = connStartPoint.x/* + startArrowSize*/;
                    prependSegment.y1 = firstSegment.y1;
                    break;
                case 'top':
                    prependSegment.x1 = firstSegment.x1;
                    prependSegment.y1 = connStartPoint.y/* - startArrowSize*/;
                    break;
                case 'bottom':
                    prependSegment.x1 = firstSegment.x1;
                    prependSegment.y1 = connStartPoint.y/* + startArrowSize*/;
                    break;
            }

            path.unshift(prependSegment);
        }

        return path;
    }

    appendPathWithArrowStaffSegment(path, connEndPoint/*, endArrowSize*/, endSide) {
        if (path.length > 0) {
            const
                lastSegment   = path[path.length - 1],
                appendSegment = {
                    x1 : lastSegment.x2,
                    y1 : lastSegment.y2
                };

            switch (endSide) {
                case 'left':
                    appendSegment.x2 = connEndPoint.x/* - endArrowSize*/;
                    appendSegment.y2 = lastSegment.y2;
                    break;
                case 'right':
                    appendSegment.x2 = connEndPoint.x/* + endArrowSize*/;
                    appendSegment.y2 = lastSegment.y2;
                    break;
                case 'top':
                    appendSegment.x2 = lastSegment.x2;
                    appendSegment.y2 = connEndPoint.y/* - endArrowSize*/;
                    break;
                case 'bottom':
                    appendSegment.x2 = lastSegment.x2;
                    appendSegment.y2 = connEndPoint.y/* + endArrowSize*/;
                    break;
            }

            path.push(appendSegment);
        }

        return path;
    }

    optimizePath(path) {
        const optPath = [];

        let prevSegment,
            curSegment;

        if (path.length > 0) {
            prevSegment = path.shift();
            optPath.push(prevSegment);

            while (path.length > 0) {
                curSegment = path.shift();
                // both segments are as good as equal
                if (
                    equalEnough(prevSegment.x1, curSegment.x1) && equalEnough(prevSegment.y1, curSegment.y1) &&
                    equalEnough(prevSegment.x2, curSegment.x2) && equalEnough(prevSegment.y2, curSegment.y2)
                ) {
                    prevSegment = curSegment;
                }
                // both segments are horizontal or very nearly so
                else if (equalEnough(prevSegment.y1, prevSegment.y2) && equalEnough(curSegment.y1, curSegment.y2)) {
                    prevSegment.x2 = curSegment.x2;
                }
                // both segments are vertical or very nearly so
                else if (equalEnough(prevSegment.x1, prevSegment.x2) && equalEnough(curSegment.x1, curSegment.x2)) {
                    prevSegment.y2 = curSegment.y2;
                }
                // segments have different orientation (path turn)
                else {
                    optPath.push(curSegment);
                    prevSegment = curSegment;
                }
            }
        }

        return optPath;
    }
}


