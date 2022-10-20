import DependencyModel from '../../model/DependencyModel.js';
import RectangularPathFinder from '../../util/RectangularPathFinder.js';
import DomHelper from '../../../Core/helper/DomHelper.js';
import Rectangle from '../../../Core/helper/util/Rectangle.js';

// TODO Tests

// Determine a line segments drawing direction
function drawingDirection(pointSet) {
    if (pointSet.x1 === pointSet.x2) {
        return pointSet.y2 > pointSet.y1 ? 'd' : 'u';
    }

    return pointSet.x2 > pointSet.x1 ? 'r' : 'l';
}

// Determine a line segments length
function segmentLength(pointSet) {
    return pointSet.x1 === pointSet.x2 ? pointSet.y2 - pointSet.y1 : pointSet.x2 - pointSet.x1;
}

// Define an arc to tie two line segments together
function arc(pointSet, nextPointSet, radius) {
    const
        corner  = drawingDirection(pointSet) + drawingDirection(nextPointSet),
        // Flip x if this or next segment is drawn right to left
        rx      = radius * (corner.includes('l') ? -1 : 1),
        // Flip y if this or next segment is drawn bottom to top
        ry      = radius * (corner.includes('u') ? -1 : 1),
        // Positive (0) or negative (1) angle
        sweep   = corner === 'ur' || corner === 'lu' || corner === 'dl' || corner === 'rd' ? 1 : 0;

    return `a${rx},${ry} 0 0 ${sweep} ${rx},${ry}`;
}

// Define a line for a set of points, tying it together with the next set with an arc when applicable
function line(pointSet, nextPointSet, location, radius, prevRadius) {

    // Horizontal or vertical line
    let line      = pointSet.x1 === pointSet.x2 ? 'v' : 'h',
        useRadius = radius;

    // Add an arc?
    if (radius) {
        const
            // Length of this line segment
            length     = segmentLength(pointSet),
            // Length of the next one. Both are needed to determine max radius (half of the shortest delta)
            nextLength = nextPointSet ? Math.abs(segmentLength(nextPointSet)) : Number.MAX_SAFE_INTEGER,
            // Line direction
            sign       = Math.sign(length);

        // If we are not passed a radius from the previous line drawn, we use the configured radius. It is used to shorten
        // this lines length to fit the arc that connects it to the previous line
        if (prevRadius == null) {
            prevRadius = radius;
        }

        // We cannot use a radius larger than half our or our successor's length, doing so would make the segment too long
        // when the arc is created
        if (Math.abs(length) < radius * 2 || nextLength < radius * 2) {
            useRadius = Math.min(Math.abs(length), nextLength) / 2;
        }

        const
            // Radius of neighbouring arcs, subtracted from length below...
            subtract  = location === 'single' ? 0 : location === 'first' ? useRadius : location === 'between' ? prevRadius + useRadius : /*last*/ prevRadius,
            // ...to produce the length of the line segment to draw
            useLength = length - subtract * sign;

        // Apply line segment length, unless it passed over 0 in which case we stick to 0
        line += Math.sign(useLength) !== sign ? 0 : useLength;

        // Add an arc if applicable
        if (location !== 'last' && location !== 'single' && useRadius > 0) {
            line += ` ${arc(pointSet, nextPointSet, useRadius)}`;
        }
    }
    // Otherwise take a shorter code path
    else {
        line += segmentLength(pointSet);
    }

    return {
        line,
        currentRadius : radius !== useRadius ? useRadius : null
    };
}

// Define an SVG path base on points from the path finder.
// Each segment in the path can be joined by an arc
function pathMapper(radius, points) {
    const { length } = points;

    if (!length) {
        return '';
    }

    let currentRadius = null;

    return `M${points[0].x1},${points[0].y1} ${points.map((pointSet, i) => {
        // Segment placement among all segments, used to determine if an arc should be added
        const
            location =
                  length === 1 ? 'single'
                      : i === length - 1 ? 'last'
                          : i === 0 ? 'first'
                              : 'between',
            lineSpec = line(pointSet, points[i + 1], location, radius, currentRadius);
        
        ({ currentRadius } = lineSpec);
        
        return lineSpec.line;
    }).join(' ')}`;
}

// Mixin that holds the code needed to generate DomConfigs for dependency lines
export default Target => class DependencyLineGenerator extends Target {
    static $name = 'DependencyLineGenerator';

    lineCache = {};

    onSVGReady() {
        // TODO Get rid of pathFinderConfig?? Move to configurable
        const me = this;

        me.pathFinder = new RectangularPathFinder({
            ...me.pathFinderConfig,
            client : me.client
        });
        me.lineDefAdjusters = me.createLineDefAdjusters();

        me.createMarker();
    }

    updateRadius() {
        if (!this.isConfiguring) {
            this.reset();
        }
    }

    updateRenderer() {
        if (!this.isConfiguring) {
            this.reset();
        }
    }

    //region Marker

    createMarker() {
        const
            me            = this,
            { markerDef } = me,
            svg           = this.client.svgCanvas,
            // SVG markers has to use an id, we want the id to be per scheduler when using multiple
            markerId      = markerDef ? `${me.client.id}-arrowEnd` : 'arrowEnd';

        me.marker?.remove();

        svg.style.setProperty('--scheduler-dependency-marker', `url(#${markerId})`);

        me.marker = DomHelper.createElement({
            parent        : svg,
            id            : markerId, // no-sanity
            tag           : 'marker',
            className     : 'b-sch-dependency-arrow',
            ns            : 'http://www.w3.org/2000/svg',
            markerHeight  : 11,
            markerWidth   : 11,
            refX          : 8,
            refY          : 3,
            viewBox       : '0 0 9 6',
            orient        : 'auto-start-reverse',
            markerUnits   : 'userSpaceOnUse',
            retainElement : true,
            children      : [{
                tag : 'path',
                ns  : 'http://www.w3.org/2000/svg',
                d   : me.markerDef ?? 'M3,0 L3,6 L9,3 z'
            }]
        });
    }

    updateMarkerDef() {
        if (!this.isConfiguring) {
            this.createMarker();
        }
    }

    //endregion

    //region DomConfig

    getAssignmentElement(assignment) {
        return this.client.getElementFromAssignmentRecord(assignment);
    }

    // Generate a DomConfig for a dependency line between two assignments (tasks in Gantt)
    getDomConfig(dependency, fromAssignment, toAssignment, forceBoxes) {
        const
            me     = this,
            key    = me.getDependencyKey(dependency, fromAssignment, toAssignment),
            // Under certain circumstances (scrolling) we might be able to reuse the previous DomConfig.
            cached = me.lineCache[key];

        // Create line def if not cached or we are live drawing and have event elements (dragging, transitioning etc)
        if (me.constructLineCache || !cached || forceBoxes || (me.drawingLive && (me.getAssignmentElement(fromAssignment) || me.getAssignmentElement(toAssignment)))) {
            const
                lineDef     = me.prepareLineDef(dependency, fromAssignment, toAssignment, forceBoxes),
                points      = lineDef && me.pathFinder.findPath(lineDef, me.lineDefAdjusters),
                { client }  = me,
                { toEvent } = dependency;

            if (points) {
                const
                    highlighted = me.highlighted.get(dependency),
                    domConfig   = {
                        tag     : 'path',
                        ns      : 'http://www.w3.org/2000/svg',
                        d       : pathMapper(me.radius ?? 0, points),
                        dataset : {
                            syncId : key,
                            depId  : dependency.id,
                            fromId : fromAssignment.id,
                            toId   : toAssignment.id
                        },
                        elementData : {
                            dependency,
                            points
                        },
                        class : {
                            [me.baseCls]                                : 1,
                            [dependency.cls]                            : dependency.cls,
                            // Data highlight
                            [dependency.highlighted]                    : dependency.highlighted,
                            // Feature highlight
                            [highlighted && [...highlighted].join(' ')] : highlighted,
                            [me.noMarkerCls]                            : lineDef.hideMarker,
                            'b-inactive'                                : dependency.active === false,
                            'b-sch-bidirectional-line'                  : dependency.bidirectional,
                            'b-readonly'                                : dependency.readOnly,
                            // If target event is outside of the view add special CSS class to hide marker (arrow)
                            'b-sch-dependency-ends-outside'             :
                                (!toEvent.milestone && (toEvent.endDate <= client.startDate || client.endDate <= toEvent.startDate)) ||
                                (toEvent.milestone && (toEvent.endDate < client.startDate || client.endDate < toEvent.startDate))
                        }
                    };

                me.renderer?.({
                    domConfig,
                    points,
                    dependencyRecord     : dependency,
                    fromAssignmentRecord : fromAssignment,
                    toAssignmentRecord   : toAssignment,
                    fromBox              : lineDef.startBox,
                    toBox                : lineDef.endBox,
                    fromSide             : lineDef.startSide,
                    toSide               : lineDef.endSide
                });

                return me.lineCache[key] = domConfig;
            }

            // Nothing to draw or cache
            return me.lineCache[key] = null;
        }

        return cached;
    }

    //endregion

    //region Bounds

    // Generates `otherBoxes` config for rectangular path finder, which push dependency line to the row boundary.
    // It should be enough to return single box with top/bottom taken from row top/bottom and left/right taken from source
    // box, extended by start arrow margin to both sides.
    generateBoundaryBoxes(box, side) {
        // We need two boxes for the bottom edge, because otherwise path cannot be found. Ideally that shouldn't be
        // necessary. Other solution would be to adjust bottom by -1px, but that would make some dependency lines to take
        // 1px different path on a row boundary, which doesn't look nice (but slightly more performant)
        if (side === 'bottom') {
            return [
                {
                    start  : box.left,
                    end    : box.left + box.width / 2,
                    top    : box.rowTop,
                    bottom : box.rowBottom
                },
                {
                    start  : box.left + box.width / 2,
                    end    : box.right,
                    top    : box.rowTop,
                    bottom : box.rowBottom
                }
            ];
        }
        else {
            return [
                {
                    start  : box.left - this.pathFinder.startArrowMargin,
                    end    : box.right + this.pathFinder.startArrowMargin,
                    top    : box.rowTop,
                    bottom : box.rowBottom
                }
            ];
        }


    }

    // Bounding box for an assignment, uses elements bounds if rendered
    getAssignmentBounds(assignment) {
        const
            { client } = this,
            element    = this.getAssignmentElement(assignment);

        if (element && !client.isExporting) {
            const rectangle = Rectangle.from(element, this.relativeTo);

            if (client.isHorizontal) {
                let row = client.getRowById(assignment.resource.id);

                // Outside of its row? It is being dragged, resolve new row
                if (rectangle.y < row.top || rectangle.bottom > row.bottom) {
                    const overRow = client.rowManager.getRowAt(rectangle.center.y, true);
                    if (overRow) {
                        row = overRow;
                    }
                }

                rectangle.rowTop = row.top;
                rectangle.rowBottom = row.bottom;
            }

            return rectangle;
        }

        return client.isEngineReady && client.getAssignmentEventBox(assignment, true);
    }

    //endregion

    //region Sides

    getConnectorStartSide(timeSpanRecord) {
        return this.client.currentOrientation.getConnectorStartSide(timeSpanRecord);
    }

    getConnectorEndSide(timeSpanRecord) {
        return this.client.currentOrientation.getConnectorEndSide(timeSpanRecord);
    }

    getDependencyStartSide(dependency) {
        const { fromEvent, type, fromSide } = dependency;

        if (fromSide) {
            return fromSide;
        }

        switch (true) {
            case type === DependencyModel.Type.StartToEnd:
            case type === DependencyModel.Type.StartToStart:
                return this.getConnectorStartSide(fromEvent);

            case type === DependencyModel.Type.EndToStart:
            case type === DependencyModel.Type.EndToEnd:
                return this.getConnectorEndSide(fromEvent);

            default:
                // Default value might not be applied yet when rendering early in Pro / Gantt
                return this.getConnectorEndSide(fromEvent);
        }
    }

    getDependencyEndSide(dependency) {
        const { toEvent, type, toSide } = dependency;

        if (toSide) {
            return toSide;
        }

        // Fallback to view trait if dependency end side is not given /*or can be obtained from type*/
        switch (true) {
            case type === DependencyModel.Type.EndToEnd:
            case type === DependencyModel.Type.StartToEnd:
                return this.getConnectorEndSide(toEvent);

            case type === DependencyModel.Type.EndToStart:
            case type === DependencyModel.Type.StartToStart:
                return this.getConnectorStartSide(toEvent);

            default:
                // Default value might not be applied yet when rendering early in Pro / Gantt
                return this.getConnectorStartSide(toEvent);
        }
    }

    //endregion

    //region Line def

    // An array of functions used to alter path config when no path found.
    // It first tries to shrink arrow margins and secondly hides arrows entirely
    createLineDefAdjusters() {
        const { client } = this;

        function shrinkArrowMargins(lineDef) {
            const { barMargin } = client;

            let adjusted = false;

            if (lineDef.startArrowMargin > barMargin || lineDef.endArrowMargin > barMargin) {
                lineDef.startArrowMargin = lineDef.endArrowMargin = barMargin;
                adjusted = true;
            }

            return adjusted ? lineDef : adjusted;
        }

        function resetArrowMargins(lineDef) {
            let adjusted = false;

            if (lineDef.startArrowMargin > 0 || lineDef.endArrowMargin > 0) {
                lineDef.startArrowMargin = lineDef.endArrowMargin = 0;
                adjusted = true;
            }

            return adjusted ? lineDef : adjusted;
        }

        function shrinkHorizontalMargin(lineDef, originalLineDef) {
            let adjusted = false;

            if (lineDef.horizontalMargin > 2) {
                lineDef.horizontalMargin = 1;
                adjusted = true;
                originalLineDef.hideMarker = true;
            }

            return adjusted ? lineDef : adjusted;
        }

        return [
            shrinkArrowMargins,
            resetArrowMargins,
            shrinkHorizontalMargin
        ];
    }

    // Overridden in Gantt
    adjustLineDef(dependency, lineDef) {
        return lineDef;
    }

    // Prepare data to feed to the path finder
    prepareLineDef(dependency, fromAssignment, toAssignment, forceBoxes) {
        const
            me             = this,
            startSide      = me.getDependencyStartSide(dependency),
            endSide        = me.getDependencyEndSide(dependency),
            startRectangle = forceBoxes?.from ?? me.getAssignmentBounds(fromAssignment),
            endRectangle   = forceBoxes?.to ?? me.getAssignmentBounds(toAssignment),
            otherBoxes     = [];

        if (!startRectangle || !endRectangle) {
            return null;
        }

        let {
            startArrowMargin,
            verticalMargin
        } = me.pathFinder;

        if (me.client.isHorizontal) {
            // Only add otherBoxes if assignments are in different resources
            if (startRectangle.rowTop != null && startRectangle.rowTop !== endRectangle.rowTop) {
                otherBoxes.push(...me.generateBoundaryBoxes(startRectangle, startSide));
            }

            // Do not change start arrow margin in case dependency is bidirectional
            if (!dependency.bidirectional) {
                if (/(top|bottom)/.test(startSide)) {
                    startArrowMargin = me.client.barMargin / 2;
                }

                verticalMargin = me.client.barMargin / 2;
            }
        }

        return me.adjustLineDef(dependency, {
            startBox              : startRectangle,
            endBox                : endRectangle,
            otherBoxes,
            startArrowMargin,
            verticalMargin,
            otherVerticalMargin   : 0,
            otherHorizontalMargin : 0,
            startSide,
            endSide
        });
    }

    //endregion

    //region Cache

    // All dependencies are about to be drawn, check if we need to build the line cache
    beforeDraw() {
        super.beforeDraw();

        if (!Object.keys(this.lineCache).length) {
            this.constructLineCache = true;
        }
    }

    // All dependencies are drawn, we no longer need to rebuild the cache
    afterDraw() {
        super.afterDraw();

        this.constructLineCache = false;
    }

    reset() {
        super.reset();

        this.lineCache = {};
    }

    //endregion

};
