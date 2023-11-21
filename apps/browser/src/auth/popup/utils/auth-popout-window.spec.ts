import { createChromeTabMock } from "../../../autofill/jest/autofill-mocks";
import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/popup/browser-popup-utils";

import {
  AuthPopoutType,
  openUnlockPopout,
  closeUnlockPopout,
  openSsoAuthResultPopout,
  openTwoFactorAuthPopout,
  closeTwoFactorAuthPopout,
} from "./auth-popout-window";

describe("AuthPopoutWindow", () => {
  const openPopoutSpy = jest.spyOn(BrowserPopupUtils, "openPopout").mockImplementation();
  const sendMessageDataSpy = jest.spyOn(BrowserApi, "tabSendMessageData").mockImplementation();
  const closeSingleActionPopoutSpy = jest
    .spyOn(BrowserPopupUtils, "closeSingleActionPopout")
    .mockImplementation();

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("openUnlockPopout", () => {
    let senderTab: chrome.tabs.Tab;

    beforeEach(() => {
      senderTab = { windowId: 1 } as chrome.tabs.Tab;
    });

    it("opens a single action popup that allows the user to unlock the extension and sends a `bgUnlockPopoutOpened` message", async () => {
      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([]);

      await openUnlockPopout(senderTab);

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html", {
        singleActionKey: AuthPopoutType.unlockExtension,
        senderWindowId: 1,
      });
      expect(sendMessageDataSpy).toHaveBeenCalledWith(senderTab, "bgUnlockPopoutOpened", {
        skipNotification: false,
      });
    });

    it("sends an indication that the presenting the notification bar for unlocking the extension should be skipped", async () => {
      await openUnlockPopout(senderTab, true);

      expect(sendMessageDataSpy).toHaveBeenCalledWith(senderTab, "bgUnlockPopoutOpened", {
        skipNotification: true,
      });
    });

    it("closes any existing popup window types that are open to the unlock extension route", async () => {
      const unlockTab = createChromeTabMock({
        url: chrome.runtime.getURL("popup/index.html#/lock"),
      });
      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([unlockTab]);
      jest.spyOn(BrowserApi, "removeWindow");
      const senderTab = { windowId: 1 } as chrome.tabs.Tab;

      await openUnlockPopout(senderTab);

      expect(BrowserApi.tabsQuery).toHaveBeenCalledWith({ windowType: "popup" });
      expect(BrowserApi.removeWindow).toHaveBeenCalledWith(unlockTab.windowId);
    });

    it("closes any existing popup window types that are open to the login extension route", async () => {
      const loginTab = createChromeTabMock({
        url: chrome.runtime.getURL("popup/index.html#/home"),
      });
      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([loginTab]);
      jest.spyOn(BrowserApi, "removeWindow");
      const senderTab = { windowId: 1 } as chrome.tabs.Tab;

      await openUnlockPopout(senderTab);

      expect(BrowserApi.removeWindow).toHaveBeenCalledWith(loginTab.windowId);
    });
  });

  describe("closeUnlockPopout", () => {
    it("closes the unlock extension popout window", async () => {
      await closeUnlockPopout();

      expect(closeSingleActionPopoutSpy).toHaveBeenCalledWith(AuthPopoutType.unlockExtension);
    });
  });

  describe("openSsoAuthResultPopout", () => {
    it("opens a window that facilitates presentation of the results for SSO authentication", async () => {
      await openSsoAuthResultPopout({ code: "code", state: "state" });

      expect(openPopoutSpy).toHaveBeenCalledWith("popup/index.html#/sso?code=code&state=state", {
        singleActionKey: AuthPopoutType.ssoAuthResult,
      });
    });
  });

  describe("openTwoFactorAuthPopout", () => {
    it("opens a window that facilitates two factor authentication", async () => {
      await openTwoFactorAuthPopout({ data: "data", remember: "remember" });

      expect(openPopoutSpy).toHaveBeenCalledWith(
        "popup/index.html#/2fa;webAuthnResponse=data;remember=remember",
        { singleActionKey: AuthPopoutType.twoFactorAuth }
      );
    });
  });

  describe("closeTwoFactorAuthPopout", () => {
    it("closes the two-factor authentication window", async () => {
      await closeTwoFactorAuthPopout();

      expect(closeSingleActionPopoutSpy).toHaveBeenCalledWith(AuthPopoutType.twoFactorAuth);
    });
  });
});
