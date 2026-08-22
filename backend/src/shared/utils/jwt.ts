import jwt from "jsonwebtoken";
import { config } from "../../config";

// Access and refresh tokens intentionally use different secrets so that
// compromising one does not compromise the other. Payloads carry only the
// minimum needed for authentication (subject + token type) — never role,
// org, or other authorization data, which is always re-resolved from the DB.

export interface AccessTokenPayload {
  sub: string;
  type: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
  jti: string; // unique id, lets us correlate this token with its DB row
}

export function signAccessToken(userId: string): string {
  const payload: AccessTokenPayload = { sub: userId, type: "access" };
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload;
  if (decoded.type !== "access") {
    throw new Error("Invalid token type");
  }
  return decoded;
}

export function signRefreshToken(userId: string, jti: string): string {
  const payload: RefreshTokenPayload = { sub: userId, type: "refresh", jti };
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: `${config.REFRESH_TOKEN_TTL_DAYS}d` as jwt.SignOptions["expiresIn"],
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const decoded = jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  if (decoded.type !== "refresh") {
    throw new Error("Invalid token type");
  }
  return decoded;
}
