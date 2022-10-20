import LocaleManager from '../../Core/localization/LocaleManager.js'
//<umd>

const locale = {

    RemoveDependencyCycleEffectResolution : {
        descriptionTpl : 'Verwijder afhankelijkheid'
    },

    DeactivateDependencyCycleEffectResolution : {
        descriptionTpl : 'Deactiveer afhankelijkheid'
    },

    CycleEffectDescription : {
        descriptionTpl : 'Er is een oneindige lus gevonden. De volgende taken zijn de oorzaak: {0}'
    },

    EmptyCalendarEffectDescription : {
        descriptionTpl : '"{0}" kalender geeft geen werktijden en dagen aan.'
    },

    Use24hrsEmptyCalendarEffectResolution : {
        descriptionTpl : 'Gebruik een 24 uren kalender met vrije dagen op zaterdag en zondag.'
    },

    Use8hrsEmptyCalendarEffectResolution : {
        descriptionTpl : 'Gebruik een 8 uren kalender (08:00-12:00, 13:00-17:00) met vrije dagen op zaterdag en zondag.'
    },

    ConflictEffectDescription : {
        descriptionTpl : 'Er is een planning conflict gevonden: {0} conflicteert met {1}'
    },

    ConstraintIntervalDescription : {
        dateFormat : 'LLL'
    },

    ProjectConstraintIntervalDescription : {
        startDateDescriptionTpl : 'Project begin {0}',
        endDateDescriptionTpl   : 'Project einde {0}'
    },

    DependencyType : {
        long : [
            'Gelijk-Begin',
            'Begin-na-Einde',
            'Einde-na-Begin',
            'Gelijk-Einde'
        ]
    },

    ManuallyScheduledParentConstraintIntervalDescription : {
        startDescriptionTpl : 'Handmatig geplande taak "{2}" forceert subtaken niet eerder te starten dan {0}',
        endDescriptionTpl   : 'Handmatig geplande taak "{2}" forceert subtaken niet later te eindigen dan {1}'
    },

    DisableManuallyScheduledConflictResolution : {
        descriptionTpl : 'Schakel handmatig plannen voor "{0}" uit'
    },

    DependencyConstraintIntervalDescription : {
        descriptionTpl : 'Afhankelijkheid ({2}) van "{3}" paar "{4}"'
    },

    RemoveDependencyResolution : {
        descriptionTpl : 'Verwijder afhankelijkheid van "{1}" paar "{2}"'
    },

    DeactivateDependencyResolution : {
        descriptionTpl : 'Deactiveer afhankelijkheid van "{1}" paar "{2}"'
    },

    DateConstraintIntervalDescription : {
        startDateDescriptionTpl : 'Taak "{2}" {3} {0} beperking',
        endDateDescriptionTpl   : 'Taak "{2}" {3} {1} beperking',
        constraintTypeTpl       : {
            startnoearlierthan  : 'Moet-beginnen op',
            finishnoearlierthan : 'Niet-eerder-beginnen-dan',
            muststarton         : 'Niet-eerder-eindigen-dan',
            mustfinishon        : 'Niet-later-eindigen-dan',
            startnolaterthan    : 'Moet-eindigen-op',
            finishnolaterthan   : 'Niet-later-beginnen-dan'
        }
    },

    RemoveDateConstraintConflictResolution : {
        descriptionTpl : 'Verwijder "{1}" beperking van taak "{0}"'
    }

}

export default locale
//</umd>

LocaleManager.registerLocale('Nl', { desc : 'Nederlands', locale })
