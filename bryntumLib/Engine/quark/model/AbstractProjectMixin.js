import { Mixin } from "../../../ChronoGraph/class/BetterMixin.js";
import Delayable from "../../../Core/mixin/Delayable.js";
import Events from "../../../Core/mixin/Events.js";
import Model from "../../../Core/data/Model.js";
export class EventsWrapper extends Mixin([], Events) {
}
export class DelayableWrapper extends Mixin([], Delayable) {
}
/**
 * This is an abstract project, which just lists the available stores.
 *
 * The actual project classes are [[SchedulerCoreProjectMixin]], [[SchedulerBasicProjectMixin]],
 * [[SchedulerProProjectMixin]], [[GanttProjectMixin]].
 */
export class AbstractProjectMixin extends Mixin([
    EventsWrapper,
    DelayableWrapper,
    Model
], (base) => {
    const superProto = base.prototype;
    class AbstractProjectMixin extends base {
        get isRepopulatingStores() {
            return false;
        }
        get isInitialCommit() {
            return !this.isInitialCommitPerformed || this.hasLoadedDataToCommit;
        }
        construct(config = {}) {
            // Define default values for these flags here
            // if defined where declared then TS compiles them this way:
            // constructor() {
            //     super(...arguments)
            //     this.isInitialCommitPerformed   = false
            //     this.isLoadingInlineData        = false
            //     this.isWritingData              = false
            //
            // }
            // which messes the flags values for inline data loading (since it's async)
            this.isInitialCommitPerformed = false;
            this.isLoadingInlineData = false;
            this.isWritingData = false;
            this.hasLoadedDataToCommit = false;
            // 5 years roughly === 5 * 365 * 24 * 60 * 60 * 1000
            this.maxCalendarRange = ('maxCalendarRange' in config) ? config.maxCalendarRange : 157680000000;
            superProto.construct.call(this, config);
            this.silenceInitialCommit = ('silenceInitialCommit' in config) ? config.silenceInitialCommit : true;
            this.adjustDurationToDST = ('adjustDurationToDST' in config) ? config.adjustDurationToDST : false;
        }
        // Template method called when a stores dataset is replaced. Implemented in SchedulerBasicProjectMixin
        repopulateStore(store) { }
        // Template method called when replica should be repopulated. Implemented in SchedulerBasicProjectMixin
        repopulateReplica() { }
        // Template method called when a store is attached to the project
        attachStore(store) { }
        // Template method called when a store is detached to the project
        detachStore(store) { }
        async commitAsync() {
            throw new Error("Abstract method called");
        }
        // Different implementations for Core and Basic engines
        isEngineReady() {
            throw new Error("Abstract method called");
        }
    }
    return AbstractProjectMixin;
}) {
}
