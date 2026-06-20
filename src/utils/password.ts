import bcrypt from 'bcryptjs';
import { logger } from './logger';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

export class PasswordService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly MIN_LENGTH = 8;
  private static readonly MAX_LENGTH = 128;

  /**
   * Hash a password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      const hashedPassword = await bcrypt.hash(password, this.SALT_ROUNDS);
      logger.debug('Password hashed successfully');
      return hashedPassword;
    } catch (error) {
      logger.error('Failed to hash password', { error });
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Compare a plain text password with a hashed password
   */
  static async comparePassword(password: string, hashedPassword: string | null | undefined): Promise<boolean> {
    try {
      // Check if hashedPassword is provided
      if (!hashedPassword || typeof hashedPassword !== 'string') {
        logger.warn('Password comparison failed: hashed password is missing or invalid');
        return false;
      }

      // Check if password is provided
      if (!password || typeof password !== 'string') {
        logger.warn('Password comparison failed: password is missing or invalid');
        return false;
      }

      const isMatch = await bcrypt.compare(password, hashedPassword);
      logger.debug('Password comparison completed', { isMatch });
      return isMatch;
    } catch (error) {
      logger.error('Failed to compare password', { 
        error: error instanceof Error ? error.message : String(error),
        hashedPasswordLength: hashedPassword?.length 
      });
      // Return false instead of throwing to allow graceful handling
      return false;
    }
  }

  /**
   * Validate password strength
   */
  static validatePasswordStrength(password: string): PasswordValidationResult {
    const errors: string[] = [];

    // Check minimum length
    if (password.length < this.MIN_LENGTH) {
      errors.push(`Password must be at least ${this.MIN_LENGTH} characters long`);
    }

    // Check maximum length
    if (password.length > this.MAX_LENGTH) {
      errors.push(`Password must be no more than ${this.MAX_LENGTH} characters long`);
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    // Check for at least one digit
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common and easily guessable');
    }

    // Check for repeated characters
    if (/(.)\1{2,}/.test(password)) {
      errors.push('Password cannot contain more than 2 consecutive identical characters');
    }

    // Check for sequential characters
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      '0123456789',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm'
    ];

    for (const sequence of sequences) {
      for (let i = 0; i <= sequence.length - 3; i++) {
        const subseq = sequence.substring(i, i + 3);
        if (password.toLowerCase().includes(subseq)) {
          errors.push('Password cannot contain sequential characters');
          break;
        }
      }
      if (errors.length > 0) break;
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate a random password
   */
  static generateRandomPassword(length: number = 16): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one character from each required category
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    
    // Fill the rest with random characters
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Check if password has been compromised (basic check)
   */
  static isPasswordCompromised(password: string): boolean {
    // This is a basic implementation. In production, you might want to
    // integrate with services like HaveIBeenPwned API
    const compromisedPatterns = [
      /password/i,
      /123456/,
      /qwerty/i,
      /admin/i,
      /test/i,
      /guest/i,
      /user/i
    ];

    return compromisedPatterns.some(pattern => pattern.test(password));
  }

  /**
   * Validate password for user registration
   */
  static validateRegistrationPassword(password: string): PasswordValidationResult {
    const result = this.validatePasswordStrength(password);
    
    if (this.isPasswordCompromised(password)) {
      result.errors.push('Password has been compromised and cannot be used');
      result.isValid = false;
    }

    return result;
  }

  /**
   * Validate password for password change
   */
  static validatePasswordChange(newPassword: string, currentPassword: string): PasswordValidationResult {
    const result = this.validateRegistrationPassword(newPassword);
    
    // Check if new password is different from current
    if (newPassword === currentPassword) {
      result.errors.push('New password must be different from current password');
      result.isValid = false;
    }

    // Check if new password contains too many characters from current password
    if (currentPassword.length > 0) {
      const similarity = this.calculatePasswordSimilarity(newPassword, currentPassword);
      if (similarity > 0.7) {
        result.errors.push('New password is too similar to current password');
        result.isValid = false;
      }
    }

    return result;
  }

  /**
   * Calculate similarity between two passwords
   */
  private static calculatePasswordSimilarity(password1: string, password2: string): number {
    const longer = password1.length > password2.length ? password1 : password2;
    const shorter = password1.length > password2.length ? password2 : password1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = Array.from({ length: str2.length + 1 }, () => Array<number>(str1.length + 1).fill(0));
 
    for (let i = 0; i <= str1.length; i++) matrix[0]![i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j]![0] = j;
 
    for (let j = 1; j <= str2.length; j++) {
      const currentRow = matrix[j]!;
      const prevRow = matrix[j - 1]!;
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const deletion = currentRow[i - 1]! + 1;
        const insertion = prevRow[i]! + 1;
        const substitution = prevRow[i - 1]! + indicator;
        currentRow[i] = Math.min(deletion, insertion, substitution);
      }
    }
 
    return matrix[str2.length]![str1.length]!;
  }

  /**
   * Hash password with additional security measures
   */
  static async hashPasswordWithSalt(password: string, userSalt?: string): Promise<{ hash: string; salt: string }> {
    try {
      // Generate a random salt if not provided
      const salt = userSalt || await bcrypt.genSalt(this.SALT_ROUNDS);
      
      // Hash the password with the salt
      const hash = await bcrypt.hash(password, salt);
      
      logger.debug('Password hashed with custom salt');
      return { hash, salt };
    } catch (error) {
      logger.error('Failed to hash password with salt', { error });
      throw new Error('Password hashing with salt failed');
    }
  }

  /**
   * Verify password against hash and salt
   */
  static async verifyPasswordWithSalt(password: string, hash: string, salt: string): Promise<boolean> {
    try {
      // Recreate the hash using the provided salt
      const testHash = await bcrypt.hash(password, salt);
      
      // Compare the hashes
      const isValid = testHash === hash;
      
      logger.debug('Password verified with salt', { isValid });
      return isValid;
    } catch (error) {
      logger.error('Failed to verify password with salt', { error });
      throw new Error('Password verification with salt failed');
    }
  }
}

export default PasswordService;
