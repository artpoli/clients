import { mock } from "jest-mock-extended";
import { firstValueFrom, of, tap } from "rxjs";

import { PinServiceAbstraction } from "../../../../auth/src/common/abstractions";
import { FakeAccountService, mockAccountServiceWith } from "../../../spec/fake-account-service";
import { FakeActiveUserState, FakeSingleUserState } from "../../../spec/fake-state";
import { FakeStateProvider } from "../../../spec/fake-state-provider";
import { KdfConfigService } from "../../auth/abstractions/kdf-config.service";
import { FakeMasterPasswordService } from "../../auth/services/master-password/fake-master-password.service";
import { VAULT_TIMEOUT } from "../../services/vault-timeout/vault-timeout-settings.state";
import { CsprngArray } from "../../types/csprng";
import { UserId } from "../../types/guid";
import { UserKey, MasterKey } from "../../types/key";
import { VaultTimeoutStringType } from "../../types/vault-timeout.type";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { EncryptService } from "../abstractions/encrypt.service";
import { KeyGenerationService } from "../abstractions/key-generation.service";
import { LogService } from "../abstractions/log.service";
import { PlatformUtilsService } from "../abstractions/platform-utils.service";
import { StateService } from "../abstractions/state.service";
import { Utils } from "../misc/utils";
import { EncString } from "../models/domain/enc-string";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";
import { CryptoService } from "../services/crypto.service";
import { UserKeyDefinition } from "../state";

import { USER_ENCRYPTED_ORGANIZATION_KEYS } from "./key-state/org-keys.state";
import { USER_ENCRYPTED_PROVIDER_KEYS } from "./key-state/provider-keys.state";
import {
  USER_ENCRYPTED_PRIVATE_KEY,
  USER_EVER_HAD_USER_KEY,
  USER_KEY,
} from "./key-state/user-key.state";

describe("cryptoService", () => {
  let cryptoService: CryptoService;

  const pinService = mock<PinServiceAbstraction>();
  const keyGenerationService = mock<KeyGenerationService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();
  const platformUtilService = mock<PlatformUtilsService>();
  const logService = mock<LogService>();
  const stateService = mock<StateService>();
  const kdfConfigService = mock<KdfConfigService>();
  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    masterPasswordService = new FakeMasterPasswordService();
    stateProvider = new FakeStateProvider(accountService);

    cryptoService = new CryptoService(
      pinService,
      masterPasswordService,
      keyGenerationService,
      cryptoFunctionService,
      encryptService,
      platformUtilService,
      logService,
      stateService,
      accountService,
      stateProvider,
      kdfConfigService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("instantiates", () => {
    expect(cryptoService).not.toBeFalsy();
  });

  describe("getUserKey", () => {
    let mockUserKey: UserKey;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    });

    it("retrieves the key state of the requested user", async () => {
      await cryptoService.getUserKey(mockUserId);

      expect(stateProvider.mock.getUserState$).toHaveBeenCalledWith(USER_KEY, mockUserId);
    });

    it("returns the User Key if available", async () => {
      stateProvider.singleUser.getFake(mockUserId, USER_KEY).nextState(mockUserKey);

      const userKey = await cryptoService.getUserKey(mockUserId);

      expect(userKey).toEqual(mockUserKey);
    });

    it("returns nullish if the user key is not set", async () => {
      const userKey = await cryptoService.getUserKey(mockUserId);

      expect(userKey).toBeFalsy();
    });
  });

  describe.each(["hasUserKey", "hasUserKeyInMemory"])(
    `%s`,
    (method: "hasUserKey" | "hasUserKeyInMemory") => {
      let mockUserKey: UserKey;

      beforeEach(() => {
        const mockRandomBytes = new Uint8Array(64) as CsprngArray;
        mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      });

      it.each([true, false])("returns %s if the user key is set", async (hasKey) => {
        stateProvider.singleUser
          .getFake(mockUserId, USER_KEY)
          .nextState(hasKey ? mockUserKey : null);
        expect(await cryptoService[method](mockUserId)).toBe(hasKey);
      });

      it("returns false when no active userId is set", async () => {
        accountService.activeAccountSubject.next(null);
        expect(await cryptoService[method]()).toBe(false);
      });

      it.each([true, false])(
        "resolves %s for active user id when none is provided",
        async (hasKey) => {
          stateProvider.activeUserId$ = of(mockUserId);
          stateProvider.singleUser
            .getFake(mockUserId, USER_KEY)
            .nextState(hasKey ? mockUserKey : null);
          expect(await cryptoService[method]()).toBe(hasKey);
        },
      );
    },
  );

  describe("getUserKeyWithLegacySupport", () => {
    let mockUserKey: UserKey;
    let mockMasterKey: MasterKey;
    let getMasterKey: jest.SpyInstance;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      mockMasterKey = new SymmetricCryptoKey(new Uint8Array(64) as CsprngArray) as MasterKey;

      getMasterKey = jest.spyOn(masterPasswordService, "masterKey$");
    });

    it("returns the User Key if available", async () => {
      stateProvider.singleUser.getFake(mockUserId, USER_KEY).nextState(mockUserKey);
      const getKeySpy = jest.spyOn(cryptoService, "getUserKey");

      const userKey = await cryptoService.getUserKeyWithLegacySupport(mockUserId);

      expect(getKeySpy).toHaveBeenCalledWith(mockUserId);
      expect(getMasterKey).not.toHaveBeenCalled();

      expect(userKey).toEqual(mockUserKey);
    });

    it("returns the user's master key when User Key is not available", async () => {
      masterPasswordService.masterKeySubject.next(mockMasterKey);

      const userKey = await cryptoService.getUserKeyWithLegacySupport(mockUserId);

      expect(getMasterKey).toHaveBeenCalledWith(mockUserId);
      expect(userKey).toEqual(mockMasterKey);
    });
  });

  describe("everHadUserKey$", () => {
    let everHadUserKeyState: FakeActiveUserState<boolean>;

    beforeEach(() => {
      everHadUserKeyState = stateProvider.activeUser.getFake(USER_EVER_HAD_USER_KEY);
    });

    it("should return true when stored value is true", async () => {
      everHadUserKeyState.nextState(true);

      expect(await firstValueFrom(cryptoService.everHadUserKey$)).toBe(true);
    });

    it("should return false when stored value is false", async () => {
      everHadUserKeyState.nextState(false);

      expect(await firstValueFrom(cryptoService.everHadUserKey$)).toBe(false);
    });

    it("should return false when stored value is null", async () => {
      everHadUserKeyState.nextState(null);

      expect(await firstValueFrom(cryptoService.everHadUserKey$)).toBe(false);
    });
  });

  describe("setUserKey", () => {
    let mockUserKey: UserKey;
    let everHadUserKeyState: FakeSingleUserState<boolean>;

    beforeEach(() => {
      const mockRandomBytes = new Uint8Array(64) as CsprngArray;
      mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
      everHadUserKeyState = stateProvider.singleUser.getFake(mockUserId, USER_EVER_HAD_USER_KEY);

      // Initialize storage
      everHadUserKeyState.nextState(null);
    });

    it("should set everHadUserKey if key is not null to true", async () => {
      await cryptoService.setUserKey(mockUserKey, mockUserId);

      expect(await firstValueFrom(everHadUserKeyState.state$)).toBe(true);
    });

    describe("Auto Key refresh", () => {
      it("sets an Auto key if vault timeout is set to 'never'", async () => {
        await stateProvider.setUserState(VAULT_TIMEOUT, VaultTimeoutStringType.Never, mockUserId);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(mockUserKey.keyB64, {
          userId: mockUserId,
        });
      });

      it("clears the Auto key if vault timeout is set to anything other than null", async () => {
        await stateProvider.setUserState(VAULT_TIMEOUT, 10, mockUserId);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setUserKeyAutoUnlock).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });

      it("clears the old deprecated Auto key whenever a User Key is set", async () => {
        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(stateService.setCryptoMasterKeyAuto).toHaveBeenCalledWith(null, {
          userId: mockUserId,
        });
      });
    });

    it("throws if key is null", async () => {
      await expect(cryptoService.setUserKey(null, mockUserId)).rejects.toThrow("No key provided.");
    });

    describe("Pin Key refresh", () => {
      const mockPinKeyEncryptedUserKey = new EncString(
        "2.AAAw2vTUePO+CCyokcIfVw==|DTBNlJ5yVsV2Bsk3UU3H6Q==|YvFBff5gxWqM+UsFB6BKimKxhC32AtjF3IStpU1Ijwg=",
      );
      const mockUserKeyEncryptedPin = new EncString(
        "2.BBBw2vTUePO+CCyokcIfVw==|DTBNlJ5yVsV2Bsk3UU3H6Q==|YvFBff5gxWqM+UsFB6BKimKxhC32AtjF3IStpU1Ijwg=",
      );

      it("sets a pinKeyEncryptedUserKeyPersistent if a userKeyEncryptedPin and pinKeyEncryptedUserKey is set", async () => {
        pinService.createPinKeyEncryptedUserKey.mockResolvedValue(mockPinKeyEncryptedUserKey);
        pinService.getUserKeyEncryptedPin.mockResolvedValue(mockUserKeyEncryptedPin);
        pinService.getPinKeyEncryptedUserKeyPersistent.mockResolvedValue(
          mockPinKeyEncryptedUserKey,
        );

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(pinService.storePinKeyEncryptedUserKey).toHaveBeenCalledWith(
          mockPinKeyEncryptedUserKey,
          false,
          mockUserId,
        );
      });

      it("sets a pinKeyEncryptedUserKeyEphemeral if a userKeyEncryptedPin is set, but a pinKeyEncryptedUserKey is not set", async () => {
        pinService.createPinKeyEncryptedUserKey.mockResolvedValue(mockPinKeyEncryptedUserKey);
        pinService.getUserKeyEncryptedPin.mockResolvedValue(mockUserKeyEncryptedPin);
        pinService.getPinKeyEncryptedUserKeyPersistent.mockResolvedValue(null);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(pinService.storePinKeyEncryptedUserKey).toHaveBeenCalledWith(
          mockPinKeyEncryptedUserKey,
          true,
          mockUserId,
        );
      });

      it("clears the pinKeyEncryptedUserKeyPersistent and pinKeyEncryptedUserKeyEphemeral if the UserKeyEncryptedPin is not set", async () => {
        pinService.getUserKeyEncryptedPin.mockResolvedValue(null);

        await cryptoService.setUserKey(mockUserKey, mockUserId);

        expect(pinService.clearPinKeyEncryptedUserKeyPersistent).toHaveBeenCalledWith(mockUserId);
        expect(pinService.clearPinKeyEncryptedUserKeyEphemeral).toHaveBeenCalledWith(mockUserId);
      });
    });
  });

  describe("clearKeys", () => {
    it("resolves active user id when called with no user id", async () => {
      let callCount = 0;
      stateProvider.activeUserId$ = stateProvider.activeUserId$.pipe(tap(() => callCount++));

      await cryptoService.clearKeys(null);
      expect(callCount).toBe(1);

      // revert to the original state
      accountService.activeAccount$ = accountService.activeAccountSubject.asObservable();
    });

    describe.each([
      USER_ENCRYPTED_ORGANIZATION_KEYS,
      USER_ENCRYPTED_PROVIDER_KEYS,
      USER_ENCRYPTED_PRIVATE_KEY,
      USER_KEY,
    ])("key removal", (key: UserKeyDefinition<unknown>) => {
      it(`clears ${key.key} for active user when unspecified`, async () => {
        await cryptoService.clearKeys(null);

        const encryptedOrgKeyState = stateProvider.singleUser.getFake(mockUserId, key);
        expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledTimes(1);
        expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledWith(null);
      });

      it(`clears ${key.key} for the specified user when specified`, async () => {
        const userId = "someOtherUser" as UserId;
        await cryptoService.clearKeys(userId);

        const encryptedOrgKeyState = stateProvider.singleUser.getFake(userId, key);
        expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledTimes(1);
        expect(encryptedOrgKeyState.nextMock).toHaveBeenCalledWith(null);
      });
    });
  });
});
