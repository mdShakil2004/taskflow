import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { config } from "../../config";
import { AppError } from "../../shared/errors/app-error";
import { logger } from "../../shared/utils/logger";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../shared/utils/jwt";
import { authRepository } from "./auth.repository";
import { LoginInput, LogoutInput, RefreshInput, RegisterInput } from "./auth.schema";

function refreshExpiryDate(): Date {
  const days = config.REFRESH_TOKEN_TTL_DAYS;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function issueTokenPair(userId: string) {
  const accessToken = signAccessToken(userId);
  const jti = uuidv4();
  const refreshToken = signRefreshToken(userId, jti);
  await authRepository.storeRefreshToken({
    userId,
    token: refreshToken,
    expiresAt: refreshExpiryDate(),
  });
  return { accessToken, refreshToken };
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await authRepository.findUserByEmail(input.email);
    if (existing) {
      throw AppError.conflict("EMAIL_ALREADY_REGISTERED", "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, config.BCRYPT_ROUNDS);

    const { user, organization, role } = await authRepository.createUserWithMembership({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      organizationId: input.organizationId,
      organizationName: input.organizationName,
    });

    const tokens = await issueTokenPair(user.id);

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName },
      organization: { id: organization.id, name: organization.name, role },
      ...tokens,
    };
  },

  async login(input: LoginInput) {
    const user = await authRepository.findUserByEmail(input.email);
    // Use an identical error for "no such user" and "wrong password" so the
    // API never reveals which emails are registered.
    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const tokens = await issueTokenPair(user.id);
    return { user: { id: user.id, email: user.email, fullName: user.fullName }, ...tokens };
  },

  async refresh(input: RefreshInput) {
    let payload;
    try {
      payload = verifyRefreshToken(input.refreshToken);
    } catch {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
    }

    const stored = await authRepository.findActiveRefreshTokenByRawToken(input.refreshToken);
    if (!stored) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token not recognized");
    }

    if (stored.revokedAt) {
      // Reuse of a rotated-out (already revoked) token is a strong signal of
      // token theft. As a defensive measure, revoke the entire session family.
      logger.warn({ userId: stored.userId }, "Revoked refresh token reuse detected — revoking all sessions");
      await authRepository.revokeAllRefreshTokensForUser(stored.userId);
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token has been revoked");
    }

    if (stored.expiresAt < new Date()) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token has expired");
    }

    // Rotation: issue a brand new pair and revoke the presented token,
    // linking it to its replacement.
    const accessToken = signAccessToken(payload.sub);
    const newJti = uuidv4();
    const newRefreshToken = signRefreshToken(payload.sub, newJti);
    const newTokenRow = await authRepository.storeRefreshToken({
      userId: payload.sub,
      token: newRefreshToken,
      expiresAt: refreshExpiryDate(),
    });
    await authRepository.rotateRefreshToken({ oldTokenId: stored.id, newTokenId: newTokenRow.id });

    return { accessToken, refreshToken: newRefreshToken };
  },

  async logout(input: LogoutInput) {
    let payload;
    try {
      payload = verifyRefreshToken(input.refreshToken);
    } catch {
      // Logout is idempotent from the client's perspective even if the token
      // is already invalid/expired — there's nothing left to revoke.
      return;
    }

    if (input.allDevices) {
      await authRepository.revokeAllRefreshTokensForUser(payload.sub);
      return;
    }

    await authRepository.revokeRefreshTokenByRawToken(input.refreshToken);
  },

  async listMyOrganizations(userId: string) {
    const memberships = await authRepository.listMembershipsForUser(userId);
    return memberships.map((m) => ({
      organizationId: m.organization.id,
      organizationName: m.organization.name,
      role: m.role,
    }));
  },
};
