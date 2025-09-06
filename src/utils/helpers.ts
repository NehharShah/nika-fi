import { v4 as uuidv4 } from 'uuid';
import { Decimal } from 'decimal.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { businessRules, config } from '../config';
import { PaginationParams, SortParams, ValidationError } from '../types';

/**
 * Referral Code Utilities
 */
export class ReferralCodeGenerator {
  private static readonly CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  
  /**
   * Generate a unique referral code
   * Format: NIKA + 4 random characters (e.g., NIKA1A2B)
   */
  public static generate(): string {
    const prefix = businessRules.referralCodePrefix;
    const randomPart = Array.from({ length: businessRules.referralCodeLength - prefix.length }, () =>
      this.CHARACTERS.charAt(Math.floor(Math.random() * this.CHARACTERS.length))
    ).join('');
    
    return prefix + randomPart;
  }

  /**
   * Validate referral code format
   */
  public static isValid(code: string): boolean {
    if (!code || typeof code !== 'string') return false;
    if (code.length !== businessRules.referralCodeLength) return false;
    if (!code.startsWith(businessRules.referralCodePrefix)) return false;
    
    const pattern = new RegExp(`^${businessRules.referralCodePrefix}[A-Z0-9]+$`);
    return pattern.test(code);
  }

  /**
   * Generate referral URL
   */
  public static generateUrl(code: string, baseUrl?: string): string {
    const base = baseUrl || 'https://app.nika.trade';
    return `${base}/signup?ref=${code}`;
  }
}

/**
 * Password Utilities
 */
export class PasswordUtils {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Hash a password
   */
  public static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify a password against its hash
   */
  public static async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   */
  public static validate(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * JWT Token Utilities
 */
export class TokenUtils {
  /**
   * Generate JWT token for user
   */
  public static generate(payload: object): string {
    const secret = config.jwt.secret || 'fallback-secret-for-jwt';
    return jwt.sign(payload, secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Verify and decode JWT token
   */
  public static verify(token: string): any {
    return jwt.verify(token, config.jwt.secret);
  }

  /**
   * Decode JWT token without verification (for debugging)
   */
  public static decode(token: string): any {
    return jwt.decode(token);
  }
}

/**
 * Decimal Utilities for Financial Calculations
 */
export class DecimalUtils {
  /**
   * Safely convert string to Decimal with validation
   */
  public static fromString(value: string, fieldName?: string): Decimal {
    try {
      const decimal = new Decimal(value);
      if (!decimal.isFinite()) {
        throw new Error(`Invalid decimal value: ${value}`);
      }
      return decimal;
    } catch (error) {
      const validationError = ErrorUtils.createApiError('INVALID_DECIMAL', `Invalid decimal value for ${fieldName || 'field'}: ${value}`);
      (validationError as any).field = fieldName || 'value';
      (validationError as any).value = value;
      throw validationError;
    }
  }

  /**
   * Round decimal to specified precision for financial calculations
   */
  public static round(value: Decimal, precision: number = businessRules.feeCalculationRounding): Decimal {
    return value.toDecimalPlaces(precision, Decimal.ROUND_HALF_UP);
  }

  /**
   * Format decimal for display (removes unnecessary trailing zeros)
   */
  public static format(value: Decimal, maxDecimalPlaces: number = 8): string {
    return value.toFixed(maxDecimalPlaces).replace(/\.?0+$/, '');
  }

  /**
   * Convert Decimal to number safely (throws if precision would be lost)
   */
  public static toNumber(value: Decimal): number {
    const num = value.toNumber();
    if (!Number.isFinite(num)) {
      throw new Error('Cannot convert Decimal to number: value is too large or invalid');
    }
    return num;
  }

  /**
   * Check if value is within acceptable range for financial calculations
   */
  public static isValidFinancialAmount(value: Decimal): boolean {
    return value.isFinite() && 
           value.gte(0) && 
           value.lte(new Decimal('1e12')); // 1 trillion max
  }
}

/**
 * Pagination Utilities
 */
export class PaginationUtils {
  /**
   * Calculate pagination parameters
   */
  public static calculatePagination(
    page: number = 1, 
    limit: number = 20,
    maxLimit: number = 100
  ): PaginationParams {
    const normalizedPage = Math.max(1, Math.floor(page));
    const normalizedLimit = Math.min(maxLimit, Math.max(1, Math.floor(limit)));
    const offset = (normalizedPage - 1) * normalizedLimit;

    return {
      page: normalizedPage,
      limit: normalizedLimit,
      offset,
    };
  }

  /**
   * Calculate pagination metadata
   */
  public static calculateMeta(
    page: number,
    limit: number,
    totalItems: number
  ): {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  } {
    const totalPages = Math.ceil(totalItems / limit);
    
    return {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }
}

/**
 * Validation Utilities
 */
export class ValidationUtils {
  /**
   * Validate email format
   */
  public static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate username format
   */
  public static isValidUsername(username: string): boolean {
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    return usernameRegex.test(username) && 
           username.length >= 3 && 
           username.length <= 30;
  }

  /**
   * Sanitize string input
   */
  public static sanitizeString(input: string, maxLength: number = 1000): string {
    return input.trim().substring(0, maxLength);
  }

  /**
   * Validate date range
   */
  public static isValidDateRange(startDate?: Date, endDate?: Date): boolean {
    if (!startDate && !endDate) return true;
    if (startDate && endDate) {
      return startDate <= endDate;
    }
    return true;
  }

  /**
   * Validate sort parameters
   */
  public static validateSortParams(
    field: string, 
    direction: string,
    allowedFields: string[]
  ): SortParams | null {
    if (!allowedFields.includes(field)) return null;
    if (!['asc', 'desc'].includes(direction.toLowerCase())) return null;
    
    return {
      field,
      direction: direction.toLowerCase() as 'asc' | 'desc',
    };
  }
}

/**
 * Error Handling Utilities
 */
export class ErrorUtils {
  /**
   * Create standardized API error
   */
  public static createApiError(code: string, message: string, details?: any): Error {
    const error = new Error(message) as any;
    error.code = code;
    error.details = details;
    return error;
  }

  /**
   * Check if error is a known API error
   */
  public static isApiError(error: any): boolean {
    return error && typeof error.code === 'string';
  }

  /**
   * Extract error message safely
   */
  public static getErrorMessage(error: any): string {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.error) return error.error;
    return 'An unknown error occurred';
  }
}

/**
 * Performance Utilities
 */
export class PerformanceUtils {
  private static timers = new Map<string, number>();

  /**
   * Start performance timer
   */
  public static startTimer(label: string): void {
    this.timers.set(label, Date.now());
  }

  /**
   * End performance timer and return duration
   */
  public static endTimer(label: string): number {
    const start = this.timers.get(label);
    if (!start) return 0;
    
    const duration = Date.now() - start;
    this.timers.delete(label);
    return duration;
  }

  /**
   * Execute function with performance timing
   */
  public static async timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.startTimer(label);
    try {
      const result = await fn();
      const duration = this.endTimer(label);
      console.log(`${label} completed in ${duration}ms`);
      return result;
    } catch (error) {
      this.endTimer(label);
      throw error;
    }
  }
}

/**
 * Cache Utilities (simple in-memory cache)
 */
export class CacheUtils {
  private static cache = new Map<string, { value: any; expires: number }>();

  /**
   * Set cache value with TTL
   */
  public static set(key: string, value: any, ttlMs: number): void {
    const expires = Date.now() + ttlMs;
    this.cache.set(key, { value, expires });
  }

  /**
   * Get cache value
   */
  public static get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() > cached.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.value;
  }

  /**
   * Delete cache value
   */
  public static delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  public static clear(): void {
    this.cache.clear();
  }

  /**
   * Clean expired entries
   */
  public static cleanup(): void {
    const now = Date.now();
    for (const [key, { expires }] of this.cache.entries()) {
      if (now > expires) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * UUID Utilities
 */
export class UuidUtils {
  /**
   * Generate UUID v4
   */
  public static generate(): string {
    return uuidv4();
  }

  /**
   * Validate UUID format
   */
  public static isValid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
