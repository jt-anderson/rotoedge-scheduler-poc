import { Base } from "../class/Base.js";
import { CI } from "../collection/Iterator.js";
import { matchAll } from "../util/Helpers.js";
//---------------------------------------------------------------------------------------------------------------------
export const DEBUG = false;
const emptyFn = (...args) => undefined;
export const DEBUG_ONLY = (func) => DEBUG ? func : emptyFn;
export const debug = DEBUG_ONLY((e) => {
    debugger;
});
//---------------------------------------------------------------------------------------------------------------------
export const warn = DEBUG_ONLY((e) => {
    if (typeof console !== 'undefined')
        console.warn(e);
});
//---------------------------------------------------------------------------------------------------------------------
export class StackEntry extends Base {
}
//---------------------------------------------------------------------------------------------------------------------
export class SourceLinePoint extends Base {
    constructor() {
        super(...arguments);
        this.stackEntries = [];
    }
    static fromError(e) {
        const res = SourceLinePoint.new({
            exception: e,
            stackEntries: parseErrorStack(e.stack)
        });
        return res;
    }
    static fromThisCall() {
        const sourceLinePoint = this.fromError(new Error());
        sourceLinePoint.stackEntries.splice(0, 2);
        return sourceLinePoint;
    }
}
//---------------------------------------------------------------------------------------------------------------------
// sample stack
// Error
//     at exceptionCatcher (http://lh/bryntum-suite/SchedulingEngine/lib/ChronoGraph/environment/Debug.js:15:11)
//     at Function.fromCurrentCall (http://lh/bryntum-suite/SchedulingEngine/lib/ChronoGraph/environment/Debug.js:39:38)
//     at Object.get (http://lh/bryntum-suite/SchedulingEngine/lib/ChronoGraph/replica/Entity.js:31:73)
//     at MinimalGanttProject.set (http://lh/bryntum-suite/SchedulingEngine/lib/ChronoGraph/replica/Entity.js:222:23)
//     at MinimalGanttProject.set data [as data] (http://lh/bryntum-suite/SchedulingEngine/lib/Engine/chrono/ChronoModelMixin.js:48:31)
//     at MinimalGanttProject.construct (http://lh/bryntum-suite/SchedulingEngine/lib/Core/data/Model.js:290:17)
//     at MinimalGanttProject.construct (http://lh/bryntum-suite/SchedulingEngine/lib/Core/mixin/Events.js:236:15)
//     at MinimalGanttProject.construct (http://lh/bryntum-suite/SchedulingEngine/lib/Engine/chrono/ChronoModelMixin.js:21:19)
//     at MinimalGanttProject.construct (http://lh/bryntum-suite/SchedulingEngine/lib/Engine/quark/model/scheduler_basic/SchedulerBasicProjectMixin.js:53:19)
//     at new Base (http://lh/bryntum-suite/SchedulingEngine/lib/Core/Base.js:55:14)"
const parseErrorStack = (stack) => {
    return CI(matchAll(/^   +at\s*(.*?)\s*\((https?:\/\/.*?):(\d+):(\d+)/gm, stack))
        .map(match => StackEntry.new({
        statement: match[1],
        sourceFile: match[2],
        sourceLine: Number(match[3]),
        sourceCharPos: Number(match[4])
    }))
        .toArray();
};
