import { Router } from 'express';
import AuthController from '../controllers/auth.controller';
import { authenticate, requireAdmin, logAuthEvent } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

const router = Router();

// Rate limiting configurations - DISABLED FOR DEVELOPMENT
// TODO: Re-enable rate limiting in production when needed
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // Limit each IP to 100 requests per windowMs
//   message: {
//     success: false,
//     message: 'Too many authentication attempts, please try again later'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   handler: (req, res) => {
//     logger.warn('Rate limit exceeded for auth endpoint', {
//       ip: req.ip,
//       userAgent: req.get('User-Agent'),
//       endpoint: req.path
//     });
//     res.status(429).json({
//       success: false,
//       message: 'Too many authentication attempts, please try again later'
//     });
//   }
// });

// const loginLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // Limit each IP to 5 login attempts per windowMs
//   message: {
//     success: false,
//     message: 'Too many login attempts, please try again in 15 minutes'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   skipSuccessfulRequests: true,
//   handler: (req, res) => {
//     logger.warn('Login rate limit exceeded', {
//       ip: req.ip,
//       userAgent: req.get('User-Agent'),
//       email: req.body?.email
//     });
//     res.status(429).json({
//       success: false,
//       message: 'Too many login attempts, please try again in 15 minutes'
//     });
//   }
// });

// const registerLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000, // 1 hour
//   max: 3, // Limit each IP to 3 registrations per hour
//   message: {
//     success: false,
//     message: 'Too many registration attempts, please try again later'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   handler: (req, res) => {
//     logger.warn('Registration rate limit exceeded', {
//       ip: req.ip,
//       userAgent: req.get('User-Agent'),
//       email: req.body?.email
//     });
//     res.status(429).json({
//       success: false,
//       message: 'Too many registration attempts, please try again later'
//     });
//   }
// });

// const passwordResetLimiter = rateLimit({
//   windowMs: 60 * 60 * 1000, // 1 hour
//   max: 3, // Limit each IP to 3 password reset attempts per hour
//   message: {
//     success: false,
//     message: 'Too many password reset attempts, please try again later'
//   },
//   standardHeaders: true,
//   legacyHeaders: false,
//   handler: (req, res) => {
//     logger.warn('Password reset rate limit exceeded', {
//       ip: req.ip,
//       userAgent: req.get('User-Agent'),
//       email: req.body?.email
//     });
//     res.status(429).json({
//       success: false,
//       message: 'Too many password reset attempts, please try again later'
//     });
//   }
// });

// Apply general rate limiting to all auth routes - DISABLED
// router.use(authLimiter);

// Public routes (no authentication required)

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return JWT token
 * @access  Public
 */
router.post('/login', 
  // loginLimiter, // DISABLED - Rate limiting disabled for development
  logAuthEvent('login_attempt'),
  AuthController.login
);

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register',
  // registerLimiter, // DISABLED - Rate limiting disabled for development
  logAuthEvent('registration_attempt'),
  AuthController.register
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh',
  logAuthEvent('token_refresh'),
  AuthController.refreshToken
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password',
  // passwordResetLimiter, // DISABLED - Rate limiting disabled for development
  logAuthEvent('forgot_password_request'),
  AuthController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/reset-password',
  // passwordResetLimiter, // DISABLED - Rate limiting disabled for development
  logAuthEvent('password_reset_attempt'),
  AuthController.resetPassword
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email address with token
 * @access  Public
 */
router.post('/verify-email',
  logAuthEvent('email_verification_attempt'),
  AuthController.verifyEmail
);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend email verification
 * @access  Public
 */
router.post('/resend-verification',
  // rateLimit({ ... }), // DISABLED - Rate limiting disabled for development
  logAuthEvent('resend_verification'),
  AuthController.resendVerification
);

// Protected routes (authentication required)

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user and invalidate tokens
 * @access  Private
 */
router.post('/logout',
  authenticate,
  logAuthEvent('logout'),
  AuthController.logout
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 */
router.post('/change-password',
  authenticate,
  // rateLimit({ ... }), // DISABLED - Rate limiting disabled for development
  logAuthEvent('password_change_attempt'),
  AuthController.changePassword
);

/**
 * @route   POST /api/v1/auth/2fa/enable
 * @desc    Enable two-factor authentication
 * @access  Private
 */
router.post('/2fa/enable',
  authenticate,
  logAuthEvent('2fa_enable_attempt'),
  AuthController.enableTwoFactor
);

/**
 * @route   POST /api/v1/auth/2fa/verify
 * @desc    Verify 2FA token
 * @access  Private
 */
router.post('/2fa/verify',
  authenticate,
  logAuthEvent('2fa_verify_attempt'),
  AuthController.verifyTwoFactor
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me',
  authenticate,
  AuthController.getProfile
);

/**
 * @route   PUT /api/v1/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile',
  authenticate,
  logAuthEvent('profile_update'),
  AuthController.updateProfile
);

/**
 * @route   GET /api/v1/auth/status
 * @desc    Check authentication status
 * @access  Private
 */
router.get('/status',
  authenticate,
  AuthController.checkStatus
);

/**
 * @route   GET /api/v1/auth/sessions
 * @desc    Get user's active sessions
 * @access  Private
 */
router.get('/sessions',
  authenticate,
  AuthController.getSessions
);

/**
 * @route   DELETE /api/v1/auth/sessions/:sessionId
 * @desc    Revoke specific session
 * @access  Private
 */
router.delete('/sessions/:sessionId',
  authenticate,
  logAuthEvent('session_revoke'),
  AuthController.revokeSession
);

/**
 * @route   DELETE /api/v1/auth/sessions
 * @desc    Revoke all sessions
 * @access  Private
 */
router.delete('/sessions',
  authenticate,
  // rateLimit({ ... }), // DISABLED - Rate limiting disabled for development
  logAuthEvent('all_sessions_revoke'),
  AuthController.revokeAllSessions
);

// Admin only routes

/**
 * @route   GET /api/v1/auth/admin/users
 * @desc    Get all users (admin only)
 * @access  Private (Admin)
 */
router.get(
  '/admin/users',
  authenticate,
  requireAdmin,
  AuthController.getUsers
);

router.put(
  '/admin/users/:userId/status',
  authenticate,
  requireAdmin,
  AuthController.updateUserStatus
);

// Health check for auth routes
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Auth routes are healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      login: 'POST /api/v1/auth/login',
      register: 'POST /api/v1/auth/register',
      refresh: 'POST /api/v1/auth/refresh',
      logout: 'POST /api/v1/auth/logout',
      forgotPassword: 'POST /api/v1/auth/forgot-password',
      resetPassword: 'POST /api/v1/auth/reset-password',
      verifyEmail: 'POST /api/v1/auth/verify-email',
      resendVerification: 'POST /api/v1/auth/resend-verification',
      changePassword: 'POST /api/v1/auth/change-password',
      getProfile: 'GET /api/v1/auth/me',
      updateProfile: 'PUT /api/v1/auth/profile',
      checkStatus: 'GET /api/v1/auth/status',
      getSessions: 'GET /api/v1/auth/sessions',
      revokeSession: 'DELETE /api/v1/auth/sessions/:sessionId',
      revokeAllSessions: 'DELETE /api/v1/auth/sessions'
    }
  });
});

export default router;
