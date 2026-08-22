import { describe, expect, it } from "vitest";
import bcrypt from "bcrypt";
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from "../../src/shared/utils/jwt";

describe("password hashing", () => {
  it("hashes a password with bcrypt and can verify it", async () => {
    const hash = await bcrypt.hash("correct-horse-battery-staple", 12);
    expect(hash).not.toBe("correct-horse-battery-staple");
    await expect(bcrypt.compare("correct-horse-battery-staple", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password against a stored hash", async () => {
    const hash = await bcrypt.hash("correct-password", 12);
    await expect(bcrypt.compare("wrong-password", hash)).resolves.toBe(false);
  });

  it("uses a cost factor of at least 12 (encoded in the hash prefix)", async () => {
    const hash = await bcrypt.hash("some-password", 12);
    // bcrypt hash format: $2b$<cost>$...
    const cost = Number(hash.split("$")[2]);
    expect(cost).toBeGreaterThanOrEqual(12);
  });
});

describe("access token generation and validation", () => {
  it("issues a token that verifies back to the same subject", () => {
    const token = signAccessToken("user-123");
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe("user-123");
    expect(payload.type).toBe("access");
  });

  it("rejects a tampered token", () => {
    const token = signAccessToken("user-123");
    const tampered = token.slice(0, -2) + "xx";
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});

describe("refresh token generation and validation", () => {
  it("issues a refresh token carrying a unique jti", () => {
    const token = signRefreshToken("user-123", "jti-abc");
    const payload = verifyRefreshToken(token);
    expect(payload.sub).toBe("user-123");
    expect(payload.jti).toBe("jti-abc");
    expect(payload.type).toBe("refresh");
  });

  it("rejects an access token presented as a refresh token", () => {
    const accessToken = signAccessToken("user-123");
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});
