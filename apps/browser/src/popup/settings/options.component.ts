import { Component, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AutofillSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/autofill-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { ClearClipboardDelaySetting } from "@bitwarden/common/autofill/types";
import {
  UriMatchStrategy,
  UriMatchStrategySetting,
} from "@bitwarden/common/models/domain/domain-service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { VaultSettingsService } from "@bitwarden/common/vault/abstractions/vault-settings/vault-settings.service";

import { enableAccountSwitching } from "../../platform/flags";

@Component({
  selector: "app-options",
  templateUrl: "options.component.html",
})
export class OptionsComponent implements OnInit {
  enableAutoFillOnPageLoad = false;
  autoFillOnPageLoadDefault = false;
  autoFillOnPageLoadOptions: any[];
  enableAutoTotpCopy = false; // TODO: Does it matter if this is set to false or true?
  enableContextMenuItem = false;
  showCardsCurrentTab = false;
  showIdentitiesCurrentTab = false;
  showClearClipboard = true;
  defaultUriMatch: UriMatchStrategySetting = UriMatchStrategy.Domain;
  uriMatchOptions: any[];
  clearClipboard: ClearClipboardDelaySetting;
  clearClipboardOptions: any[];
  showGeneral = true;
  showDisplay = true;
  accountSwitcherEnabled = false;

  constructor(
    private messagingService: MessagingService,
    private autofillSettingsService: AutofillSettingsServiceAbstraction,
    private domainSettingsService: DomainSettingsService,
    i18nService: I18nService,
    private vaultSettingsService: VaultSettingsService,
  ) {
    this.uriMatchOptions = [
      { name: i18nService.t("baseDomain"), value: UriMatchStrategy.Domain },
      { name: i18nService.t("host"), value: UriMatchStrategy.Host },
      { name: i18nService.t("startsWith"), value: UriMatchStrategy.StartsWith },
      { name: i18nService.t("regEx"), value: UriMatchStrategy.RegularExpression },
      { name: i18nService.t("exact"), value: UriMatchStrategy.Exact },
      { name: i18nService.t("never"), value: UriMatchStrategy.Never },
    ];
    this.clearClipboardOptions = [
      { name: i18nService.t("never"), value: null },
      { name: i18nService.t("tenSeconds"), value: 10 },
      { name: i18nService.t("twentySeconds"), value: 20 },
      { name: i18nService.t("thirtySeconds"), value: 30 },
      { name: i18nService.t("oneMinute"), value: 60 },
      { name: i18nService.t("twoMinutes"), value: 120 },
      { name: i18nService.t("fiveMinutes"), value: 300 },
    ];
    this.autoFillOnPageLoadOptions = [
      { name: i18nService.t("autoFillOnPageLoadYes"), value: true },
      { name: i18nService.t("autoFillOnPageLoadNo"), value: false },
    ];

    this.accountSwitcherEnabled = enableAccountSwitching();
  }

  async ngOnInit() {
    this.enableAutoFillOnPageLoad = await firstValueFrom(
      this.autofillSettingsService.autofillOnPageLoad$,
    );

    this.autoFillOnPageLoadDefault = await firstValueFrom(
      this.autofillSettingsService.autofillOnPageLoadDefault$,
    );

    this.enableContextMenuItem = await firstValueFrom(
      this.autofillSettingsService.enableContextMenu$,
    );

    this.showCardsCurrentTab = await firstValueFrom(this.vaultSettingsService.showCardsCurrentTab$);
    this.showIdentitiesCurrentTab = await firstValueFrom(
      this.vaultSettingsService.showIdentitiesCurrentTab$,
    );

    this.enableAutoTotpCopy = await firstValueFrom(this.autofillSettingsService.autoCopyTotp$);

    const defaultUriMatch = await firstValueFrom(
      this.domainSettingsService.defaultUriMatchStrategy$,
    );
    this.defaultUriMatch = defaultUriMatch == null ? UriMatchStrategy.Domain : defaultUriMatch;

    this.clearClipboard = await firstValueFrom(this.autofillSettingsService.clearClipboardDelay$);
  }

  async updateContextMenuItem() {
    await this.autofillSettingsService.setEnableContextMenu(this.enableContextMenuItem);
    this.messagingService.send("bgUpdateContextMenu");
  }

  async updateAutoTotpCopy() {
    await this.autofillSettingsService.setAutoCopyTotp(this.enableAutoTotpCopy);
  }

  async updateAutoFillOnPageLoad() {
    await this.autofillSettingsService.setAutofillOnPageLoad(this.enableAutoFillOnPageLoad);
  }

  async updateAutoFillOnPageLoadDefault() {
    await this.autofillSettingsService.setAutofillOnPageLoadDefault(this.autoFillOnPageLoadDefault);
  }

  async updateShowCardsCurrentTab() {
    await this.vaultSettingsService.setShowCardsCurrentTab(this.showCardsCurrentTab);
  }

  async updateShowIdentitiesCurrentTab() {
    await this.vaultSettingsService.setShowIdentitiesCurrentTab(this.showIdentitiesCurrentTab);
  }

  async saveClearClipboard() {
    await this.autofillSettingsService.setClearClipboardDelay(this.clearClipboard);
  }
}
