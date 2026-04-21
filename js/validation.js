/**
 * Input Validation Utilities
 * Prevents injection attacks, XSS, and invalid data
 */

'use strict';

const Validators = {
  /**
   * Check max length
   */
  maxLength: (value, max, fieldName) => {
    if (value && value.length > max) {
      return `${fieldName} must not exceed ${max} characters`;
    }
    return null;
  },
  
  /**
   * Check min length
   */
  minLength: (value, min, fieldName) => {
    if (value && value.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    return null;
  },
  
  /**
   * Check pattern (regex)
   */
  pattern: (value, regex, fieldName, message) => {
    if (value && !regex.test(value)) {
      return message || `${fieldName} format is invalid`;
    }
    return null;
  },
  
  /**
   * Email validation
   */
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (value && !emailRegex.test(value)) {
      return 'Please enter a valid email address';
    }
    return null;
  },
  
  /**
   * Currency/number validation
   */
  currency: (value) => {
    if (!value) return null;
    const num = parseFloat(value);
    if (isNaN(num) || num < -999999.99 || num > 999999.99) {
      return 'Please enter a valid number between -999999.99 and 999999.99';
    }
    return null;
  },
  
  /**
   * Date validation (YYYY-MM-DD)
   */
  date: (value) => {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return 'Please enter a valid date (YYYY-MM-DD)';
    }
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) {
      return 'Please enter a valid date';
    }
    return null;
  },
  
  /**
   * Account name validation (alphanumeric, spaces, hyphens, periods)
   */
  accountName: (value) => {
    if (!value) return null;
    if (!/^[a-zA-Z0-9\s\-\.]+$/.test(value)) {
      return 'Account name can only contain letters, numbers, spaces, hyphens, and periods';
    }
    return null;
  },
  
  /**
   * Model name validation
   */
  modelName: (value) => {
    if (!value) return null;
    if (value.length > 200) return 'Model name too long (max 200 characters)';
    if (!/^[a-zA-Z0-9\s\-\.]+$/.test(value)) {
      return 'Model name can only contain letters, numbers, spaces, hyphens, and periods';
    }
    return null;
  },
  
  /**
   * Checklist section validation
   */
  checklistSection: (value) => {
    if (!value) return 'Section is required';
    if (value.length > 200) return 'Section name too long (max 200 characters)';
    return null;
  },
  
  /**
   * Checklist title validation
   */
  checklistTitle: (value) => {
    if (!value) return 'Title is required';
    if (value.length > 500) return 'Title too long (max 500 characters)';
    return null;
  },
  
  /**
   * Trade notes validation
   */
  tradeNotes: (value) => {
    if (!value) return null;
    if (value.length > 5000) {
      return 'Notes too long (max 5000 characters)';
    }
    return null;
  },
  
  /**
   * Display name validation
   */
  displayName: (value) => {
    if (!value) return null;
    if (value.length > 100) {
      return 'Display name too long (max 100 characters)';
    }
    return null;
  },
  
  /**
   * Password validation (strong)
   */
  password: (value) => {
    if (!value) return 'Password is required';
    if (value.length < 12) return 'Password must be at least 12 characters';
    if (!/[a-z]/.test(value)) return 'Password must contain lowercase letters';
    if (!/[A-Z]/.test(value)) return 'Password must contain uppercase letters';
    if (!/[0-9]/.test(value)) return 'Password must contain numbers';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) return 'Password must contain special characters (!@#$%^&*)';
    
    // Check for common passwords
    const commonPasswords = [
      'password123', 'qwerty123', 'abc12345', '123456789',
      'password', 'qwerty', 'passw0rd', 'p@ssword'
    ];
    if (commonPasswords.some(p => value.toLowerCase().includes(p))) {
      return 'Password is too common. Please choose a different one';
    }
    
    return null;
  },
  
  /**
   * Passwords match validation
   */
  passwordsMatch: (password, confirmPassword) => {
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  },
  
  /**
   * Starting balance validation
   */
  startingBalance: (value) => {
    if (!value) return 'Starting balance is required';
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      return 'Please enter a valid positive number';
    }
    if (num > 9999999.99) {
      return 'Starting balance too large (max 9999999.99)';
    }
    return null;
  },
  
  /**
   * Composite validation - run multiple validators
   */
  field: (value, rules) => {
    for (const rule of rules) {
      const error = rule(value);
      if (error) return error;
    }
    return null;
  }
};
