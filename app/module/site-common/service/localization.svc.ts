import {Inject, Injectable} from '@angular/core';
import {BehaviorSubject, Subscription} from 'rxjs';

import {Config_Svc} from './config.svc';
import {AppConfig_Mdl, ConfigUpdate_Mdl, LocalizableContent_Mdl, StorageService} from 'lm/site-common';

@Injectable()
export class Localization_Svc {
    localeUpdatedEvent: BehaviorSubject<any> = new BehaviorSubject<any>({});

    private currentLocale: any = {};
    private locItems: Array<LocalizableContent_Mdl> = [];
    private storageKey: string = 'locale';
    private locConfig: any = {};
    private configSvcSub: Subscription;
    private defaultLocale: string;

    constructor(private configSvc: Config_Svc,
                @Inject(StorageService) private storageSvc) {
        this.configSvcSub = this.configSvc.appConfigUpdate
            .subscribe((data: ConfigUpdate_Mdl) => {
                this.handleConfigChange(<AppConfig_Mdl>data.config);
            });
    }

    /**
     * Checks for existing locale in the config. If it's not registered in the config, abort mission.
     * If it exists, set the currentLocale object, update all registered locItems, and write hte new locale to
     * the storage service. Then, fire an event that we've updated.
     *
     * @param locale {string}   The locale to switch to as a string, i.e. "en-us"
     */
    setLocale(locale: string) {
        let localeObject = this.getLocaleFromConfig(locale);

        if (!locale || locale === this.currentLocale.name || !localeObject) {
            return;
        }
        this.currentLocale = localeObject;
        this.locItems.forEach(el => {
            el.setLocale(locale);
        });
        this.storageSvc.set(this.storageKey, localeObject.locale);
        this.localeUpdatedEvent.next(localeObject);
    }

    getCurrentLocale() {
        return this.currentLocale;
    }

    getLocales(): Array<string> {
        return this.locConfig.locales;
    }

    /**
     * Registers a given object as a "localizable content object". This means that it is an object where all first-level
     * keys are locales, for example "en-us" and "es-ar". Each key should contain an identical structure so that
     * locale objects can switch from one language to the next. Localizable objects can alternately be created without
     * any first-level locale keys as the model itself is smart enough to default to non-locale keys on the object  when
     * it can't find either a desired key or the default language key allowing this to be resilient in case a
     * non-localized content object is passed.
     * Note that the returned object is a wrapper LocalizableContent_Mdl object that automates language switching on
     * the content for the consumer.
     *
     * @param content   {object}    An object to be registered as a new localizable content object.
     * @returns         {LocalizableContent_Mdl}
     */
    registerContent(content: any) {
        let locItem = new LocalizableContent_Mdl(content, this.currentLocale.locale, this.unregisterContent.bind(this), this.defaultLocale);

        this.locItems.push(locItem);
        return locItem;
    }

    getDefaultLocale() {
        return this.defaultLocale;
    }

    private setDefaultLocale(locale: string) {
        this.locItems.forEach(el => {
            el.setDefaultLocale(locale);
        });
    }

    /**
     * Retrieve a locale from the local locConfig object which was imported from the global app config. This is a
     * descriptor object that contains the id and display name of the locale.
     *
     * @param locale    {string}    The name of the locale to search for
     * @returns         {null}      Returns null if no locale is found matching the request
     */
    private getLocaleFromConfig(locale: string) {
        let locales = this.locConfig.locales;
        let foundLocale = null;

        if (locales && Array.isArray(locales)) {
            foundLocale = locales.filter(el => {
                return el.locale === locale;
            })[0];
        }

        return foundLocale;
    }

    /**
     * When config changes happen, both current locale can update (if there wasn't one set, for instance) and default
     * locale can change as well. Need to update the locConfig to match the latest incoming data.
     *
     * @param cfg    {object}   The new config object to handle
     */
    private handleConfigChange(cfg: AppConfig_Mdl) {
        let currentDefaultLocale = this.defaultLocale;
        this.locConfig = cfg.localization;
        this.defaultLocale = this.locConfig.default;
        this.setLocale(this.storageSvc.get(this.storageKey) || this.currentLocale && this.currentLocale.locale || this.locConfig.default);
        if (currentDefaultLocale !== this.defaultLocale) {
            this.setDefaultLocale(this.defaultLocale);
        }
    }

    /**
     * Unregisters a content object. This is needed to remove content from the list of localizable content objects
     * that are updated as language switches occur.
     *
     * @param content
     */
    private unregisterContent(content: LocalizableContent_Mdl) {
        this.locItems.splice(this.locItems.indexOf(content), 1);
    }
}