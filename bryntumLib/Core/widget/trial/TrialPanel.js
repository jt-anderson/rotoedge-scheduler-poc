import BrowserHelper from '../../helper/BrowserHelper.js';
import VersionHelper from '../../helper/VersionHelper.js';
import DomHelper from '../../helper/DomHelper.js';
import Popup from '../Popup.js';
import Toast from '../Toast.js';

export default class TrialPanel extends Popup {

    static $name = 'TrialPanel';

    static type = 'trialpanel';

    static get configurable() {
        return {
            productId  : null,
            storeEmail : false,
            width      : 400,
            anchor     : true,
            title      : 'L{title}',
            align      : {
                align            : 't-b',
                constrainPadding : 20
            },
            defaults : {
                labelWidth : 100
            },
            items : [
                {
                    type        : 'textfield',
                    localeClass : this,
                    label       : 'L{name} <sup>*</sup>',
                    name        : 'name',
                    ref         : 'nameField',
                    required    : true
                },
                {
                    type        : 'textfield',
                    inputType   : 'email',
                    localeClass : this,
                    label       : 'L{email} <sup>*</sup>',
                    name        : 'email',
                    ref         : 'emailField',
                    required    : true
                },
                {
                    type        : 'textfield',
                    localeClass : this,
                    label       : 'L{company} <sup>*</sup>',
                    name        : 'company',
                    ref         : 'companyField',
                    required    : true
                },
                {
                    type        : 'combo',
                    localeClass : this,
                    label       : 'L{product}',
                    editable    : false,
                    ref         : 'productField',
                    name        : 'productId',
                    style       : 'margin-bottom : 0',
                    items       : [
                        {
                            id         : 'calendar', // no-sanity
                            downloadId : 'calendar-vanilla',
                            text       : 'Bryntum Calendar'
                        },
                        {
                            id         : 'gantt', // no-sanity
                            downloadId : 'gantt-vanilla',
                            text       : 'Bryntum Gantt'
                        },
                        {
                            id         : 'grid', // no-sanity
                            downloadId : 'grid',
                            text       : 'Bryntum Grid'
                        },
                        {
                            id         : 'scheduler', // no-sanity
                            downloadId : 'scheduler-vanilla',
                            text       : 'Bryntum Scheduler'
                        },
                        {
                            id         : 'schedulerpro', // no-sanity
                            downloadId : 'schedulerpro',
                            text       : 'Bryntum Scheduler Pro'
                        },
                        {
                            id         : 'taskboard', // no-sanity
                            downloadId : 'taskboard-vanilla',
                            text       : 'Bryntum TaskBoard'
                        }
                    ],
                    required : true
                },
                {
                    type      : 'textfield',
                    inputType : 'hidden',
                    ref       : 'listNameField',
                    name      : 'listname'
                },
                {
                    type      : 'textfield',
                    inputType : 'hidden',
                    ref       : 'trackingField',
                    name      : 'custom meta_adtracking'
                },
                {
                    type      : 'textfield',
                    inputType : 'hidden',
                    ref       : 'redirectField',
                    name      : 'redirect'
                },
                {
                    type      : 'textfield',
                    inputType : 'hidden',
                    name      : 'meta_message',
                    value     : '1'
                },
                {
                    type      : 'textfield',
                    inputType : 'hidden',
                    name      : 'meta_required',
                    value     : 'name,email,custom company'
                },
                {
                    type      : 'textfield',
                    inputType : 'hidden',
                    name      : 'meta_forward_vars',
                    value     : '0'
                }
            ],

            bbar : [
                {
                    localeClass : this,
                    text        : 'L{cancel}',
                    width       : '12em',
                    onClick     : 'up.onCancelClick'
                },
                {
                    localeClass : this,
                    text        : 'L{submit}',
                    width       : '12em',
                    cls         : 'b-blue b-raised',
                    onClick     : 'up.onSubmitClick'
                }
            ]
        };
    }

    get bodyConfig() {
        return this.storeEmail ? Object.assign(super.bodyConfig,  {
            tag    : 'form',
            method : 'post',
            target : 'aweberFrame',
            action : 'https://www.aweber.com/scripts/addlead.pl'
        }) : super.bodyConfig;
    }

    changeProductId(value) {
        this.widgetMap.productField.value = value;
    }

    async onSubmitClick() {
        const me = this;
        if (!me.isValid) {
            return;
        }

        if (me.storeEmail) {
            me.addToMailList();
        }

        await me.triggerDownload();
    }

    addToMailList() {
        const
            {
                trackingField,
                redirectField,
                listNameField,
                companyField
            }             = this.widgetMap,
            { productId } = this.values;

        trackingField.value = BrowserHelper.getCookie('aw');
        redirectField.value = globalThis.location.href;

        companyField.input.name = 'custom company';

        switch (productId) {
            case 'gantt':
                listNameField.value = 'awlist5314739';
                break;
            case 'scheduler':
            case 'schedulerpro':
                listNameField.value = 'awlist5074881';
                break;
            case 'grid':
                listNameField.value = 'awlist5074883';
                break;
            case 'calendar':
                listNameField.value = 'awlist4475287';
                break;
        }

        this.bodyElement.submit();
    }

    async onCancelClick() {
        await this.hide();
    }

    async triggerDownload() {
        const
            me = this,
            {
                name,
                email,
                company
            }  = me.values;

        let productId = me.values.productId;

        switch (productId) {
            case 'gantt':
            case 'scheduler':
            case 'taskboard':
            case 'calendar':
                productId = `${productId}-vanilla`;
                break;
        }

        const a = DomHelper.createElement({
            parent   : document.body,
            tag      : 'a',
            download : `bryntum-${productId}-trial.zip`,
            href     : `/do_download.php?product_id=${productId}&thename=${name}&email=${email}&company=${company}`
        });

        a.click();

        a.parentElement.removeChild(a);

        await me.hide();

        Toast.show({
            html    : me.L('L{downloadStarting}'),
            timeout : 15000
        });

        if (!me.gaScript && !VersionHelper.isTestEnv) {
            me.gaScript = DomHelper.createElement({
                parent : document.head,
                tag    : 'script',
                src    : 'https://www.googletagmanager.com/gtag/js?id=UA-11046863-1'
            });

            me.gaScript.addEventListener('load', me.trackDownload.bind(me));
        }
    }

    // Google Analytics
    trackDownload() {
        globalThis.dataLayer = globalThis.dataLayer || [];

        function gtag() {
            globalThis.dataLayer.push(arguments);
        }

        // gtag('consent', 'default', {
        //     ad_storage        : 'denied',
        //     analytics_storage : 'denied'
        // });

        gtag('event', 'conversion', {
            send_to  : 'AW-1042491458/eweSCPibpAEQwtCM8QM',
            value    : 1.0,
            currency : 'USD'
        });

        gtag('event', 'Trial download started', {
            value    : 1.0,
            currency : 'USD'
        });
    }
}

// Register this widget type with its Factory
TrialPanel.initClass();
