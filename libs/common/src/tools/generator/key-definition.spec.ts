import {
  ENCRYPTED_HISTORY,
  ENCRYPTED_USERNAME_SETTINGS,
  PASSPHRASE_SETTINGS,
  PASSWORD_SETTINGS,
  PLAINTEXT_USERNAME_SETTINGS,
} from "./key-definitions";

describe("Key definitions", () => {
  describe("PASSWORD_SETTINGS", () => {
    it("should pass through deserialization", () => {
      const value = {};
      const result = PASSWORD_SETTINGS.deserializer(value);
      expect(result).toBe(value);
    });
  });

  describe("PASSPHRASE_SETTINGS", () => {
    it("should pass through deserialization", () => {
      const value = {};
      const result = PASSPHRASE_SETTINGS.deserializer(value);
      expect(result).toBe(value);
    });
  });

  describe("ENCRYPTED_USERNAME_SETTINGS", () => {
    it("should pass through deserialization", () => {
      const value = {};
      const result = ENCRYPTED_USERNAME_SETTINGS.deserializer(value);
      expect(result).toBe(value);
    });
  });

  describe("PLAINTEXT_USERNAME_SETTINGS", () => {
    it("should pass through deserialization", () => {
      const value = {};
      const result = PLAINTEXT_USERNAME_SETTINGS.deserializer(value);
      expect(result).toBe(value);
    });
  });

  describe("ENCRYPTED_HISTORY", () => {
    it("should pass through deserialization", () => {
      const value = {};
      const result = ENCRYPTED_HISTORY.deserializer(value as any);
      expect(result).toBe(value);
    });
  });
});
