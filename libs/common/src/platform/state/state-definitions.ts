import { StateDefinition } from "./state-definition";

/**
 * `StateDefinition`s comes with some rules, to facilitate a quick review from
 * platform of this file, ensure you follow these rules, the ones marked with (tested)
 * have unit tests that you can run locally.
 *
 * 1. (tested) Names should not be null or undefined
 * 2. (tested) Name and storage location should be unique
 * 3. (tested) Name and storage location can't differ from another export by only casing
 * 4. (tested) Name should be longer than 3 characters. It should be descriptive, but brief.
 * 5. (tested) Name should not contain spaces or underscores
 * 6. Name should be human readable
 * 7. Name should be in camelCase format (unit tests ensure the first character is lowercase)
 * 8. Teams should only use state definitions they have created
 * 9. StateDefinitions should only be used for keys relating to the state name they chose
 *
 */

export const ACCOUNT_MEMORY = new StateDefinition("account", "memory");

export const CRYPTO_DISK = new StateDefinition("crypto", "disk");
export const CRYPTO_MEMORY = new StateDefinition("crypto", "memory");

export const SSO_DISK = new StateDefinition("ssoLogin", "disk");

export const ENVIRONMENT_DISK = new StateDefinition("environment", "disk");

export const VAULT_ONBOARDING = new StateDefinition("vaultOnboarding", "disk", {
  web: "disk-local",
});

export const GENERATOR_DISK = new StateDefinition("generator", "disk");
export const GENERATOR_MEMORY = new StateDefinition("generator", "memory");

export const BIOMETRIC_SETTINGS_DISK = new StateDefinition("biometricSettings", "disk");

// Admin Console
export const ORGANIZATIONS_DISK = new StateDefinition("organizations", "disk");
export const POLICIES_DISK = new StateDefinition("policies", "disk");
export const PROVIDERS_DISK = new StateDefinition("providers", "disk");

export const BILLING_DISK = new StateDefinition("billing", "disk");

export const FOLDER_DISK = new StateDefinition("folder", "disk", { web: "memory" });

export const SYNC_STATE = new StateDefinition("sync", "disk", { web: "memory" });

export const VAULT_SETTINGS_DISK = new StateDefinition("vaultSettings", "disk", {
  web: "disk-local",
});

export const COLLECTION_DATA = new StateDefinition("collection", "disk", {
  web: "memory",
});

export const BADGE_SETTINGS_DISK = new StateDefinition("badgeSettings", "disk");

export const AUTOFILL_SETTINGS_DISK = new StateDefinition("autofillSettings", "disk");
export const AUTOFILL_SETTINGS_DISK_LOCAL = new StateDefinition("autofillSettingsLocal", "disk", {
  web: "disk-local",
});

export const VAULT_FILTER_DISK = new StateDefinition("vaultFilter", "disk", {
  web: "disk-local",
});

export const CLEAR_EVENT_DISK = new StateDefinition("clearEvent", "disk");

export const NEW_WEB_LAYOUT_BANNER_DISK = new StateDefinition("newWebLayoutBanner", "disk", {
  web: "disk-local",
});

// Secrets Manager
export const SM_ONBOARDING_DISK = new StateDefinition("smOnboarding", "disk", {
  web: "disk-local",
});
