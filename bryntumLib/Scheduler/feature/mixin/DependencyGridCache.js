import DateHelper from '../../../Core/helper/DateHelper.js';

const
    TICKS_PER_CELL = 25, // TODO Consider basing on visible tick count
    ROWS_PER_CELL  = 25; // TODO Consider basing on visible row count

// Mixin that handles the dependency grid cache
//
// Grid cache explainer
// ────────────────────
// The purpose of the grid cache is to reduce the amount of dependencies we have to iterate over when drawing by
// partitioning them into a virtual grid. With for example 10k deps we would have to iterate over all 10k on
// each draw since any of them might be intersecting the view.
//
// The cells are horizontally based on ticks (50 per cell) and vertically on rows (also 50 per cell. Each cell
// lists which dependencies intersect it. When drawing we only have to iterate over the dependencies for the
// cells that intersect the viewport.
//
// The grid cache is populated when dependencies are drawn. Any change to deps, resources, events or assignments
// clears the cache.
//
// The dependency drawn below will be included in the set that is considered for drawing if tickCell 0 or
// tickCell 1 and rowCell 0 intersects the current view (it is thus represented twice in the grid cache)
//
//       tickCell 0           tickCell 1
//       tick 0-49            tick 50-99
//    ┌────────────────────┬─────────────────────┐
// r r│0,0                 │1,0                  │
// o o│     │              │                     │
// w w│     │     !!!!!!!!!│!!!!!!!!!!!          │
// C  │     │     ! View   │          !          │
// e 0│     │     ! port   │          !          │
// l -│     │     !        │          !          │
// l 4│     └─────!────────┼──────────!────►     │
// 0 9│           !        │          !          │
//    ├────────────────────┼─────────────────────┤
// r r│0,1        !        │1,1       !          │
// o o│           !        │          !          │
// w w│           !!!!!!!!!│!!!!!!!!!!!          │
// C  │                    │                     │
// e 5│                    │                     │
// l 0│                    │                     │
// l -│                    │                     │
// 1 9│                    │                     │
//   9└────────────────────┴─────────────────────┘
//               uoᴉʇɐɹʇsnꞁꞁᴉ əɥɔɐɔ pᴉɹ⅁
export default Target => class DependencyGridCache extends Target {
    static $name = 'DependencyGridCache';

    gridCache = null;

    // Dependencies that might intersect the current viewport and thus should be considered for drawing
    getDependenciesToConsider(startMS, endMS, startIndex, endIndex) {
        const
            me            = this,
            { gridCache } = me,
            { timeAxis }  = me.client;

        if (gridCache) {
            const
                dependencies = new Set(),
                fromMSCell   = Math.floor((startMS - timeAxis.startMS) / me.MS_PER_CELL),
                toMSCell     = Math.floor((endMS - timeAxis.startMS) / me.MS_PER_CELL),
                fromRowCell  = Math.floor(startIndex / ROWS_PER_CELL),
                toRowCell    = Math.floor(endIndex / ROWS_PER_CELL);

            for (let i = fromMSCell; i <= toMSCell; i++) {
                const msCell = gridCache[i];
                if (msCell) {
                    for (let j = fromRowCell; j <= toRowCell; j++) {
                        const intersectingDependencies = msCell[j];
                        if (intersectingDependencies) {
                            for (let i = 0; i < intersectingDependencies.length; i++) {
                                dependencies.add(intersectingDependencies[i]);
                            }
                        }
                    }
                }
            }

            return dependencies;
        }
    }

    // A (single) dependency was drawn, we might want to store info about it in the grid cache
    afterDrawDependency(dependency, fromIndex, toIndex, fromDateMS, toDateMS) {
        const me = this;

        if (me.constructGridCache) {
            const
                { timeAxis } = me.client,
                fromMSCell   = Math.floor((fromDateMS - timeAxis.startMS) / me.MS_PER_CELL),
                toMSCell     = Math.floor((toDateMS - timeAxis.startMS) / me.MS_PER_CELL),
                fromRowCell  = Math.floor(fromIndex / ROWS_PER_CELL),
                toRowCell    = Math.floor(toIndex / ROWS_PER_CELL);

            for (let i = fromMSCell; i <= toMSCell; i++) {
                const msCell = me.gridCache[i] ?? (me.gridCache[i] = {});
                for (let j = fromRowCell; j <= toRowCell; j++) {
                    const rowCell = msCell[j] ?? (msCell[j] = []);
                    rowCell.push(dependency);
                }
            }
        }
    }

    // All dependencies are about to be drawn, check if we need to build the grid cache
    beforeDraw() {
        const me = this;

        if (!me.gridCache) {
            me.constructGridCache = true;
            // Adjust number of ms used in grid cache to match current view preset
            me.MS_PER_CELL = DateHelper.asMilliseconds(TICKS_PER_CELL, me.client.timeAxis.mainUnit);
            // Start with empty cache, will be populated as deps are drawn
            me.gridCache = {};
        }
    }

    // All dependencies are drawn, we no longer need to rebuild the cache
    afterDraw() {
        this.constructGridCache = false;
    }

    reset() {
        this.gridCache = null;
    }
};
