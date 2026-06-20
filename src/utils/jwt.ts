import jwt from 'jsonwebtoken';
import { ENV_CONFIG } from '../config/environment';
import { logger } from './logger';

const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

export interface JWTPayload {
  userId: string;
  email?: string | undefined;
  username?: string;
  role: string;
  sessionId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JWTService {
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';

  /**
   * Generate access token
   */
  static generateAccessToken(payload: JWTPayload): string {
    try {
      const token = jwt.sign(
        payload,
        ENV_CONFIG.JWT_SECRET,
        {
          expiresIn: this.ACCESS_TOKEN_EXPIRY,
          issuer: 'teamwork-homecare',
          audience: 'teamwork-homecare-users'
        }
      );
      
      logger.info('Access token generated', { userId: payload.userId });
      return token;
    } catch (error) {
      const err = toError(error);
      logger.error('Failed to generate access token', { error: err, userId: payload.userId });
      throw new Error('Token generation failed');
    }
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(payload: JWTPayload): string {
    try {
      const token = jwt.sign(
        { ...payload, type: 'refresh' },
        ENV_CONFIG.JWT_REFRESH_SECRET,
        {
          expiresIn: this.REFRESH_TOKEN_EXPIRY,
          issuer: 'teamwork-homecare',
          audience: 'teamwork-homecare-users'
        }
      );
      
      logger.info('Refresh token generated', { userId: payload.userId });
      return token;
    } catch (error) {
      const err = toError(error);
      logger.error('Failed to generate refresh token', { error: err, userId: payload.userId });
      throw new Error('Refresh token generation failed');
    }
  }

  /**
   * Generate both access and refresh tokens
   */
  static generateTokenPair(payload: JWTPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload)
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, ENV_CONFIG.JWT_SECRET, {
        issuer: 'teamwork-homecare',
        audience: 'teamwork-homecare-users'
      }) as JWTPayload;

      logger.debug('Access token verified', { userId: decoded.userId });
      return decoded;
    } catch (error) {
      const err = toError(error) as jwt.JsonWebTokenError;
      logger.warn('Access token verification failed', { error: err.message });
      
      if (err.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (err.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, ENV_CONFIG.JWT_REFRESH_SECRET, {
        issuer: 'teamwork-homecare',
        audience: 'teamwork-homecare-users'
      }) as JWTPayload & { type: string };

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      logger.debug('Refresh token verified', { userId: decoded.userId });
      return decoded;
    } catch (error) {
      const err = toError(error) as jwt.JsonWebTokenError;
      logger.warn('Refresh token verification failed', { error: err.message });
      
      if (err.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired');
      } else if (err.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else {
        throw new Error('Refresh token verification failed');
      }
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string): string {
    if (!authHeader) {
      throw new Error('Authorization header is required');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new Error('Invalid authorization header format');
    }
    const token = parts[1];
    if (!token) {
      throw new Error('Authorization token is missing');
    }
    return token;
  }

  /**
   * Get token expiry time
   */
  static getTokenExpiry(token: string): Date {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token format');
      }
      return new Date(decoded.exp * 1000);
    } catch (error) {
      const err = toError(error);
      logger.error('Failed to get token expiry', { error: err });
      throw new Error('Failed to parse token expiry');
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    try {
      const expiry = this.getTokenExpiry(token);
      return expiry < new Date();
    } catch (error) {
      return true;
    }
  }

  /**
   * Generate password reset token
   */
  static generatePasswordResetToken(email: string): string {
    try {
      const token = jwt.sign(
        { email, type: 'password-reset' },
        ENV_CONFIG.JWT_SECRET,
        {
          expiresIn: '1h',
          issuer: 'teamwork-homecare',
          audience: 'teamwork-homecare-users'
        }
      );
      
      logger.info('Password reset token generated', { email });
      return token;
    } catch (error) {
      const err = toError(error);
      logger.error('Failed to generate password reset token', { error: err, email });
      throw new Error('Password reset token generation failed');
    }
  }

  /**
   * Verify password reset token
   */
  static verifyPasswordResetToken(token: string): { email: string } {
    try {
      const decoded = jwt.verify(token, ENV_CONFIG.JWT_SECRET, {
        issuer: 'teamwork-homecare',
        audience: 'teamwork-homecare-users'
      }) as any;

      if (decoded.type !== 'password-reset') {
        throw new Error('Invalid token type');
      }

      logger.debug('Password reset token verified', { email: decoded.email });
      return { email: decoded.email };
    } catch (error) {
      const err = toError(error) as jwt.JsonWebTokenError;
      logger.warn('Password reset token verification failed', { error: err.message });
      
      if (err.name === 'TokenExpiredError') {
        throw new Error('Password reset token has expired');
      } else if (err.name === 'JsonWebTokenError') {
        throw new Error('Invalid password reset token');
      } else {
        throw new Error('Password reset token verification failed');
      }
    }
  }

  /**
   * Generate email verification token
   */
  static generateEmailVerificationToken(email: string): string {
    try {
      const token = jwt.sign(
        { email, type: 'email-verification' },
        ENV_CONFIG.JWT_SECRET,
        {
          expiresIn: '24h',
          issuer: 'teamwork-homecare',
          audience: 'teamwork-homecare-users'
        }
      );
      
      logger.info('Email verification token generated', { email });
      return token;
    } catch (error) {
      const err = toError(error);
      logger.error('Failed to generate email verification token', { error: err, email });
      throw new Error('Email verification token generation failed');
    }
  }

  /**
   * Verify email verification token
   */
  static verifyEmailVerificationToken(token: string): { email: string } {
    try {
      const decoded = jwt.verify(token, ENV_CONFIG.JWT_SECRET, {
        issuer: 'teamwork-homecare',
        audience: 'teamwork-homecare-users'
      }) as any;

      if (decoded.type !== 'email-verification') {
        throw new Error('Invalid token type');
      }

      logger.debug('Email verification token verified', { email: decoded.email });
      return { email: decoded.email };
    } catch (error) {
      const err = toError(error) as jwt.JsonWebTokenError;
      logger.warn('Email verification token verification failed', { error: err.message });
      
      if (err.name === 'TokenExpiredError') {
        throw new Error('Email verification token has expired');
      } else if (err.name === 'JsonWebTokenError') {
        throw new Error('Invalid email verification token');
      } else {
        throw new Error('Email verification token verification failed');
      }
    }
  }
}

export default JWTService;
