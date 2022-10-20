import AjaxStore from '../../Core/data/AjaxStore.js';
import EventStoreMixin from './mixin/EventStoreMixin.js';
import GetEventsMixin from './mixin/GetEventsMixin.js';
import DayIndexMixin from './mixin/DayIndexMixin.js';
import SharedEventStoreMixin from './mixin/SharedEventStoreMixin.js';
import RecurringEventsMixin from './mixin/RecurringEventsMixin.js';
import EventModel from '../model/EventModel.js';
import PartOfProject from './mixin/PartOfProject.js';

import { CoreEventStoreMixin } from '../../Engine/quark/store/CoreEventStoreMixin.js';
import PartOfBaseProject from './mixin/PartOfBaseProject.js';

const EngineMixin = PartOfProject(CoreEventStoreMixin.derive(AjaxStore));

/**
 * @module Scheduler/data/EventStore
 */

/**
 * A store holding all the {@link Scheduler.model.EventModel events} to be rendered into a {@link Scheduler.view.Scheduler Scheduler}.
 *
 * This store only accepts a model class inheriting from {@link Scheduler.model.EventModel}.
 *
 * An EventStore is usually connected to a project, which binds it to other related stores (AssignmentStore,
 * ResourceStore and DependencyStore). The project also handles normalization/calculation of the data on the records in
 * the store. For example if a record is added with a `startDate` and an `endDate`, it will calculate the `duration`.
 *
 * The calculations happens async, records are not guaranteed to have up to date data until they are finished. To be
 * certain that calculations have finished, call `await project.commitAsync()` after store actions. Or use one of the
 * `xxAsync` functions, such as `loadDataAsync()`.
 *
 * Using `commitAsync()`:
 *
 * ```javascript
 * eventStore.data = [{ startDate, endDate }, ...];
 *
 * // duration of the record is not yet calculated
 *
 * await eventStore.project.commitAsync();
 *
 * // now it is
 * ```
 *
 * Using `loadDataAsync()`:
 *
 * ```javascript
 * await eventStore.loadDataAsync([{ startDate, endDate }, ...]);
 *
 * // duration is calculated
 * ```
 *
 * ## Using recurring events
 * When recurring events are in the database, **all recurring event definitions** which started before
 * the requested start date, and have not yet finished recurring MUST be loaded into the EventStore.
 *
 * Only the **base** recurring event **definitions** are stored in the EventStore. You do not
 * need to calculate the future occurrence dates of these events. This is all handled by the EventStore.
 *
 * When asked to yield a set of events for a certain date range for creating a UI through
 * {@link #function-getEvents}, the EventStore *automatically* interpolates any occurrences of
 * recurring events into the results. They do not occupy slots in the EventStore for every date
 * in their repetition range (that would be very inefficient, and *might* be infinite).
 *
 * @mixes Scheduler/data/mixin/PartOfProject
 * @mixes Scheduler/data/mixin/SharedEventStoreMixin
 * @mixes Scheduler/data/mixin/EventStoreMixin
 * @mixes Scheduler/data/mixin/RecurringEventsMixin
 * @mixes Scheduler/data/mixin/GetEventsMixin
 * @extends Core/data/AjaxStore
 */
export default class EventStore extends EngineMixin.mixin(
    SharedEventStoreMixin,
    RecurringEventsMixin,
    EventStoreMixin,
    DayIndexMixin,
    GetEventsMixin
) {

    static $name = 'EventStore';

    static get defaultConfig() {
        return {
            /**
             * Class used to represent records
             * @config {Scheduler.model.EventModel}
             * @default
             * @category Common
             */
            modelClass : EventModel
        };
    }
}
