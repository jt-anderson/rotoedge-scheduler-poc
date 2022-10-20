import LocaleManager from '../../Core/localization/LocaleManager.js'
//<umd>

const locale = {

    RemoveDependencyCycleEffectResolution : {
        descriptionTpl : 'Remove dependency'
    },

    DeactivateDependencyCycleEffectResolution : {
        descriptionTpl : 'Deactivate dependency'
    },

    CycleEffectDescription : {
        descriptionTpl : 'A cycle has been found, formed by: {0}'
    },

    EmptyCalendarEffectDescription : {
        descriptionTpl : '"{0}" calendar does not provide any working time intervals.'
    },

    Use24hrsEmptyCalendarEffectResolution : {
        descriptionTpl : 'Use 24 hours calendar with non-working Saturdays and Sundays.'
    },

    Use8hrsEmptyCalendarEffectResolution : {
        descriptionTpl : 'Use 8 hours calendar (08:00-12:00, 13:00-17:00) with non-working Saturdays and Sundays.'
    },

    ConflictEffectDescription : {
        descriptionTpl : 'A scheduling conflict has been found: {0} is conflicting with {1}'
    },

    ConstraintIntervalDescription : {
        dateFormat : 'LLL'
    },

    ProjectConstraintIntervalDescription : {
        startDateDescriptionTpl : 'Project start date {0}',
        endDateDescriptionTpl   : 'Project end date {0}'
    },

    DependencyType : {
        long : [
            'Start-to-Start',
            'Start-to-Finish',
            'Finish-to-Start',
            'Finish-to-Finish'
        ]
    },

    ManuallyScheduledParentConstraintIntervalDescription : {
        startDescriptionTpl : 'Manually scheduled "{2}" forces its children to start no earlier than {0}',
        endDescriptionTpl   : 'Manually scheduled "{2}" forces its children to finish no later than {1}'
    },

    DisableManuallyScheduledConflictResolution : {
        descriptionTpl : 'Disable manual scheduling for "{0}"'
    },

    DependencyConstraintIntervalDescription : {
        descriptionTpl : 'Dependency ({2}) from "{3}" to "{4}"'
    },

    RemoveDependencyResolution : {
        descriptionTpl : 'Remove dependency from "{1}" to "{2}"'
    },

    DeactivateDependencyResolution : {
        descriptionTpl : 'Deactivate dependency from "{1}" to "{2}"'
    },

    DateConstraintIntervalDescription : {
        startDateDescriptionTpl : 'Task "{2}" {3} {0} constraint',
        endDateDescriptionTpl   : 'Task "{2}" {3} {1} constraint',
        constraintTypeTpl       : {
            startnoearlierthan  : 'Start-No-Earlier-Than',
            finishnoearlierthan : 'Finish-No-Earlier-Than',
            muststarton         : 'Must-Start-On',
            mustfinishon        : 'Must-Finish-On',
            startnolaterthan    : 'Start-No-Later-Than',
            finishnolaterthan   : 'Finish-No-Later-Than'
        }
    },

    RemoveDateConstraintConflictResolution : {
        descriptionTpl : 'Remove "{1}" constraint of task "{0}"'
    }

}

export default locale
//</umd>

LocaleManager.registerLocale('En', { desc : 'English', locale })
