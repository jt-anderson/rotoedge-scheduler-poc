import DH from '../../../Core/helper/DateHelper.js';

// Mixin for EventModel & TaskModel for both to work with Calendars rendering
export default Target => class CalendarCompatMixin extends Target {
    // TODO This can go away if Calendar would avoid rendering prior to the engine being ready (i.e., having calculated
    //  all endDate values)
    get endingDate() {
        const
            me = this,
            {
                endDate,
                startDate
            }  = me;

        if (endDate) {
            // Special case of startDate===endDate for allDay event:
            // if (Number(endDate) === Number(startDate) && me.allDay) {
            //     return DH.add(startDate, 1, 'd');
            // }
            // Nope... the above works fine except when the day start time is shifted. In this case we want the
            // event to appear as "all day" on the shifted day, but the above will push the endingDate beyond the
            // end of the shifted day.

            return endDate;
        }

        return DH.add(startDate, me.duration, me.durationUnit);
    }
};
