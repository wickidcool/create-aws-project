import { describe, it, expect } from '@jest/globals';
import { validateProjectName } from '../../validation/project-name.js';

describe('validateProjectName', () => {
  describe('valid names', () => {
    it('should accept simple kebab-case names', () => {
      expect(validateProjectName('my-app')).toBe(true);
    });

    it('should accept names with numbers', () => {
      expect(validateProjectName('app123')).toBe(true);
    });

    it('should accept names ending with numbers', () => {
      expect(validateProjectName('my-app-2')).toBe(true);
    });

    it('should accept single-word names', () => {
      expect(validateProjectName('myapp')).toBe(true);
    });

    it('should accept names starting with numbers (npm allows this)', () => {
      expect(validateProjectName('123app')).toBe(true);
    });

    it('should accept scoped packages (npm allows this)', () => {
      expect(validateProjectName('@scope/pkg')).toBe(true);
    });

    it('should accept underscores (npm allows this)', () => {
      expect(validateProjectName('my_app')).toBe(true);
    });
  });

  describe('invalid names', () => {
    it('should reject names with spaces', () => {
      const result = validateProjectName('My App');
      expect(result).not.toBe(true);
      expect(typeof result).toBe('string');
    });

    it('should reject empty string', () => {
      const result = validateProjectName('');
      expect(result).toBe('Project name is required');
    });

    it('should reject whitespace-only string', () => {
      const result = validateProjectName('   ');
      expect(result).toBe('Project name is required');
    });

    it('should reject names with uppercase letters', () => {
      const result = validateProjectName('MyApp');
      expect(result).not.toBe(true);
      expect(typeof result).toBe('string');
    });

    it('should reject names starting with dot', () => {
      const result = validateProjectName('.hidden');
      expect(result).not.toBe(true);
      expect(typeof result).toBe('string');
    });

    it('should reject node_modules as a name', () => {
      const result = validateProjectName('node_modules');
      expect(result).not.toBe(true);
      expect(typeof result).toBe('string');
    });
  });
});
