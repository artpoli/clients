import { Observable, firstValueFrom, map } from "rxjs";

import { UserId } from "../../types/guid";
import { EncryptedString, EncString } from "../models/domain/enc-string";
import { ActiveUserState, StateProvider } from "../state";

import {
  BIOMETRIC_UNLOCK_ENABLED,
  ENCRYPTED_CLIENT_KEY_HALF,
  REQUIRE_PASSWORD_ON_START,
  DISMISSED_REQUIRE_PASSWORD_ON_START_CALLOUT,
  PROMPT_AUTOMATICALLY,
  PROMPT_CANCELLED,
} from "./biometric.state";

export abstract class BiometricStateService {
  /**
   * `true` if the currently active user has elected to store a biometric key to unlock their vault.
   */
  biometricUnlockEnabled$: Observable<boolean>; // used to be biometricUnlock
  /**
   * If the user has elected to require a password on first unlock of an application instance, this key will store the
   * encrypted client key half used to unlock the vault.
   *
   * Tracks the currently active user
   */
  encryptedClientKeyHalf$: Observable<EncString | undefined>;
  /**
   * whether or not a password is required on first unlock after opening the application
   *
   * tracks the currently active user
   */
  requirePasswordOnStart$: Observable<boolean>;
  /**
   * Indicates the user has been warned about the security implications of using biometrics and, depending on the OS,
   *
   * tracks the currently active user.
   */
  dismissedRequirePasswordOnStartCallout$: Observable<boolean>;
  /**
   * Whether the user has cancelled the biometric prompt.
   *
   * tracks the currently active user
   */
  promptCancelled$: Observable<boolean>;
  /**
   * Whether the user has elected to automatically prompt for biometrics.
   *
   * tracks the currently active user
   */
  promptAutomatically$: Observable<boolean>;

  /**
   * Updates the require password on start state for the currently active user.
   *
   * If false, the encrypted client key half will be removed.
   * @param value whether or not a password is required on first unlock after opening the application
   */
  abstract setRequirePasswordOnStart(value: boolean): Promise<void>;
  /**
   * Updates the biometric unlock enabled state for the currently active user.
   * @param enabled whether or not to store a biometric key to unlock the vault
   */
  abstract setBiometricUnlockEnabled(enabled: boolean): Promise<void>;
  /**
   * Gets the biometric unlock enabled state for the given user.
   * @param userId user Id to check
   */
  abstract getBiometricUnlockEnabled(userId: UserId): Promise<boolean>;
  abstract setEncryptedClientKeyHalf(encryptedKeyHalf: EncString, userId?: UserId): Promise<void>;
  abstract getEncryptedClientKeyHalf(userId: UserId): Promise<EncString>;
  abstract getRequirePasswordOnStart(userId: UserId): Promise<boolean>;
  abstract removeEncryptedClientKeyHalf(userId: UserId): Promise<void>;
  /**
   * Updates the active user's state to reflect that they've been warned about requiring password on start.
   */
  abstract setDismissedRequirePasswordOnStartCallout(): Promise<void>;
  /**
   * Updates the active user's state to reflect that they've cancelled the biometric prompt this lock.
   */
  abstract setPromptCancelled(): Promise<void>;
  /**
   * Resets the active user's state to reflect that they haven't cancelled the biometric prompt this lock.
   */
  abstract resetPromptCancelled(): Promise<void>;
  /**
   * Updates the currently active user's setting for auto prompting for biometrics on application start and lock
   * @param prompt Whether or not to prompt for biometrics on application start.
   */
  abstract setPromptAutomatically(prompt: boolean): Promise<void>;

  abstract logout(userId: UserId): Promise<void>;
}

export class DefaultBiometricStateService implements BiometricStateService {
  private biometricUnlockEnabledState: ActiveUserState<boolean>;
  private requirePasswordOnStartState: ActiveUserState<boolean>;
  private encryptedClientKeyHalfState: ActiveUserState<EncryptedString | undefined>;
  private dismissedRequirePasswordOnStartCalloutState: ActiveUserState<boolean>;
  private promptCancelledState: ActiveUserState<boolean>;
  private promptAutomaticallyState: ActiveUserState<boolean>;
  biometricUnlockEnabled$: Observable<boolean>;
  encryptedClientKeyHalf$: Observable<EncString | undefined>;
  requirePasswordOnStart$: Observable<boolean>;
  dismissedRequirePasswordOnStartCallout$: Observable<boolean>;
  promptCancelled$: Observable<boolean>;
  promptAutomatically$: Observable<boolean>;

  constructor(private stateProvider: StateProvider) {
    this.biometricUnlockEnabledState = this.stateProvider.getActive(BIOMETRIC_UNLOCK_ENABLED);
    this.biometricUnlockEnabled$ = this.biometricUnlockEnabledState.state$.pipe(map(Boolean));

    this.requirePasswordOnStartState = this.stateProvider.getActive(REQUIRE_PASSWORD_ON_START);
    this.requirePasswordOnStart$ = this.requirePasswordOnStartState.state$.pipe(
      map((value) => !!value),
    );

    this.encryptedClientKeyHalfState = this.stateProvider.getActive(ENCRYPTED_CLIENT_KEY_HALF);
    this.encryptedClientKeyHalf$ = this.encryptedClientKeyHalfState.state$.pipe(
      map(encryptedClientKeyHalfToEncString),
    );

    this.dismissedRequirePasswordOnStartCalloutState = this.stateProvider.getActive(
      DISMISSED_REQUIRE_PASSWORD_ON_START_CALLOUT,
    );
    this.dismissedRequirePasswordOnStartCallout$ =
      this.dismissedRequirePasswordOnStartCalloutState.state$.pipe(map(Boolean));

    this.promptCancelledState = this.stateProvider.getActive(PROMPT_CANCELLED);
    this.promptCancelled$ = this.promptCancelledState.state$.pipe(map(Boolean));
    this.promptAutomaticallyState = this.stateProvider.getActive(PROMPT_AUTOMATICALLY);
    this.promptAutomatically$ = this.promptAutomaticallyState.state$.pipe(map(Boolean));
  }

  async setBiometricUnlockEnabled(enabled: boolean): Promise<void> {
    await this.biometricUnlockEnabledState.update(() => enabled);
  }

  async getBiometricUnlockEnabled(userId: UserId): Promise<boolean> {
    return await firstValueFrom(
      this.stateProvider.getUser(userId, BIOMETRIC_UNLOCK_ENABLED).state$.pipe(map(Boolean)),
    );
  }

  async setRequirePasswordOnStart(value: boolean): Promise<void> {
    let currentActiveId: UserId;
    await this.requirePasswordOnStartState.update(
      (_, [userId]) => {
        currentActiveId = userId;
        return value;
      },
      {
        combineLatestWith: this.requirePasswordOnStartState.combinedState$,
      },
    );
    if (!value) {
      await this.removeEncryptedClientKeyHalf(currentActiveId);
    }
  }

  async setEncryptedClientKeyHalf(encryptedKeyHalf: EncString, userId?: UserId): Promise<void> {
    const value = encryptedKeyHalf?.encryptedString ?? null;
    if (userId) {
      await this.stateProvider.getUser(userId, ENCRYPTED_CLIENT_KEY_HALF).update(() => value);
    } else {
      await this.encryptedClientKeyHalfState.update(() => value);
    }
  }

  async removeEncryptedClientKeyHalf(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, ENCRYPTED_CLIENT_KEY_HALF).update(() => null);
  }

  async getRequirePasswordOnStart(userId: UserId): Promise<boolean> {
    return !!(await firstValueFrom(
      this.stateProvider.getUser(userId, REQUIRE_PASSWORD_ON_START).state$,
    ));
  }

  async getEncryptedClientKeyHalf(userId: UserId): Promise<EncString> {
    return await firstValueFrom(
      this.stateProvider
        .getUser(userId, ENCRYPTED_CLIENT_KEY_HALF)
        .state$.pipe(map(encryptedClientKeyHalfToEncString)),
    );
  }

  async logout(userId: UserId): Promise<void> {
    await this.stateProvider.getUser(userId, ENCRYPTED_CLIENT_KEY_HALF).update(() => null);
    await this.stateProvider.getUser(userId, PROMPT_CANCELLED).update(() => null);
    // Persist auto prompt setting through logout
    // Persist dismissed require password on start callout through logout
  }

  async setDismissedRequirePasswordOnStartCallout(): Promise<void> {
    await this.dismissedRequirePasswordOnStartCalloutState.update(() => true);
  }

  async setPromptCancelled(): Promise<void> {
    await this.promptCancelledState.update(() => true);
  }

  async resetPromptCancelled(): Promise<void> {
    await this.promptCancelledState.update(() => null);
  }

  async setPromptAutomatically(prompt: boolean): Promise<void> {
    await this.promptAutomaticallyState.update(() => prompt);
  }
}

function encryptedClientKeyHalfToEncString(
  encryptedKeyHalf: EncryptedString | undefined,
): EncString {
  return encryptedKeyHalf == null ? null : new EncString(encryptedKeyHalf);
}
