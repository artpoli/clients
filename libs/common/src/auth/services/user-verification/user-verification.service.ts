import { PinCryptoServiceAbstraction } from "../../../../../auth/src/common/abstractions/pin-crypto.service.abstraction";
import { CryptoService } from "../../../platform/abstractions/crypto.service";
import { I18nService } from "../../../platform/abstractions/i18n.service";
import { LogService } from "../../../platform/abstractions/log.service";
import { StateService } from "../../../platform/abstractions/state.service";
import { KeySuffixOptions } from "../../../platform/enums/key-suffix-options.enum";
import { UserKey } from "../../../types/key";
import { UserVerificationApiServiceAbstraction } from "../../abstractions/user-verification/user-verification-api.service.abstraction";
import { UserVerificationService as UserVerificationServiceAbstraction } from "../../abstractions/user-verification/user-verification.service.abstraction";
import { VerificationType } from "../../enums/verification-type";
import { SecretVerificationRequest } from "../../models/request/secret-verification.request";
import { VerifyOTPRequest } from "../../models/request/verify-otp.request";
import {
  MasterPasswordVerification,
  OtpVerification,
  PinVerification,
  ServerSideVerification,
  Verification,
  VerificationWithSecret,
  verificationHasSecret,
} from "../../types/verification";

/**
 * Used for general-purpose user verification throughout the app.
 * Use it to verify the input collected by UserVerificationComponent.
 */
export class UserVerificationService implements UserVerificationServiceAbstraction {
  constructor(
    private stateService: StateService,
    private cryptoService: CryptoService,
    private i18nService: I18nService,
    private userVerificationApiService: UserVerificationApiServiceAbstraction,
    private pinCryptoService: PinCryptoServiceAbstraction,
    private logService: LogService,
  ) {}

  /**
   * Create a new request model to be used for server-side verification
   * @param verification User-supplied verification data (Master Password or OTP)
   * @param requestClass The request model to create
   * @param alreadyHashed Whether the master password is already hashed
   */
  async buildRequest<T extends SecretVerificationRequest>(
    verification: ServerSideVerification,
    requestClass?: new () => T,
    alreadyHashed?: boolean,
  ) {
    this.validateSecretInput(verification);

    const request =
      requestClass != null ? new requestClass() : (new SecretVerificationRequest() as T);

    if (verification.type === VerificationType.OTP) {
      request.otp = verification.secret;
    } else {
      let masterKey = await this.cryptoService.getMasterKey();
      if (!masterKey && !alreadyHashed) {
        masterKey = await this.cryptoService.makeMasterKey(
          verification.secret,
          await this.stateService.getEmail(),
          await this.stateService.getKdfType(),
          await this.stateService.getKdfConfig(),
        );
      }
      request.masterPasswordHash = alreadyHashed
        ? verification.secret
        : await this.cryptoService.hashMasterKey(verification.secret, masterKey);
    }

    return request;
  }

  /**
   * Used to verify Master Password, PIN, or biometrics client-side, or send the OTP to the server for verification (with no other data)
   * Generally used for client-side verification only.
   * @param verification User-supplied verification data (OTP, MP, PIN, or biometrics)
   */
  async verifyUser(verification: Verification): Promise<boolean> {
    if (verificationHasSecret(verification)) {
      this.validateSecretInput(verification);
    }

    switch (verification.type) {
      case VerificationType.OTP:
        return this.verifyUserByOTP(verification);
      case VerificationType.MasterPassword:
        return this.verifyUserByMasterPassword(verification);
      case VerificationType.PIN:
        return this.verifyUserByPIN(verification);
        break;
      case VerificationType.Biometrics:
        return this.verifyUserByBiometrics();
      default: {
        // Compile-time check for exhaustive switch
        const _exhaustiveCheck: never = verification;
        return _exhaustiveCheck;
      }
    }
  }

  private async verifyUserByOTP(verification: OtpVerification): Promise<boolean> {
    const request = new VerifyOTPRequest(verification.secret);
    try {
      await this.userVerificationApiService.postAccountVerifyOTP(request);
    } catch (e) {
      throw new Error(this.i18nService.t("invalidVerificationCode"));
    }
    return true;
  }

  private async verifyUserByMasterPassword(
    verification: MasterPasswordVerification,
  ): Promise<boolean> {
    let masterKey = await this.cryptoService.getMasterKey();
    if (!masterKey) {
      masterKey = await this.cryptoService.makeMasterKey(
        verification.secret,
        await this.stateService.getEmail(),
        await this.stateService.getKdfType(),
        await this.stateService.getKdfConfig(),
      );
    }
    const passwordValid = await this.cryptoService.compareAndUpdateKeyHash(
      verification.secret,
      masterKey,
    );
    if (!passwordValid) {
      throw new Error(this.i18nService.t("invalidMasterPassword"));
    }
    // TODO: we should re-evaluate later on if user verification should have the side effect of modifying state. Probably not.
    await this.cryptoService.setMasterKey(masterKey);
    return true;
  }

  private async verifyUserByPIN(verification: PinVerification): Promise<boolean> {
    const userKey = await this.pinCryptoService.decryptUserKeyWithPin(verification.secret);

    return userKey != null;
  }

  private async verifyUserByBiometrics(): Promise<boolean> {
    let userKey: UserKey;
    // Biometrics crashes and doesn't return a value if the user cancels the prompt
    try {
      userKey = await this.cryptoService.getUserKeyFromStorage(KeySuffixOptions.Biometric);
    } catch (e) {
      this.logService.error(`Biometrics User Verification failed: ${e.message}`);
      // So, any failures should be treated as a failed verification
      return false;
    }

    return userKey != null;
  }

  async requestOTP() {
    await this.userVerificationApiService.postAccountRequestOTP();
  }

  /**
   * Check if user has master password or can only use passwordless technologies to log in
   * Note: This only checks the server, not the local state
   * @param userId The user id to check. If not provided, the current user is used
   * @returns True if the user has a master password
   */
  async hasMasterPassword(userId?: string): Promise<boolean> {
    const decryptionOptions = await this.stateService.getAccountDecryptionOptions({ userId });

    if (decryptionOptions?.hasMasterPassword != undefined) {
      return decryptionOptions.hasMasterPassword;
    }

    // TODO: PM-3518 - Left for backwards compatibility, remove after 2023.12.0
    return !(await this.stateService.getUsesKeyConnector({ userId }));
  }

  async hasMasterPasswordAndMasterKeyHash(userId?: string): Promise<boolean> {
    return (
      (await this.hasMasterPassword(userId)) &&
      (await this.cryptoService.getMasterKeyHash()) != null
    );
  }

  private validateSecretInput(verification: VerificationWithSecret) {
    if (verification?.secret == null || verification.secret === "") {
      switch (verification.type) {
        case VerificationType.OTP:
          throw new Error(this.i18nService.t("verificationCodeRequired"));
        case VerificationType.MasterPassword:
          throw new Error(this.i18nService.t("masterPasswordRequired"));
        case VerificationType.PIN:
          throw new Error(this.i18nService.t("pinRequired"));
      }
    }
  }
}
