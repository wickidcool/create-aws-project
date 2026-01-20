import Ajv, { ValidateFunction, JSONSchemaType, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';

// Initialize AJV with formats support (singleton)
const ajv = new Ajv({ allErrors: true, removeAdditional: true });
addFormats(ajv);

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Format AJV error objects into readable error messages
 */
function formatAjvErrors(errors: ErrorObject[]): string[] {
  return errors.map(err => {
    const field = err.instancePath.replace('/', '') || err.params['missingProperty'] || 'request';
    return `${field}: ${err.message}`;
  });
}

/**
 * Generic validation function with detailed errors
 *
 * @param schema - JSONSchema to validate against
 * @param data - Data to validate
 * @returns ValidationResult with detailed error messages
 */
export function validate<T>(
  schema: JSONSchemaType<T>,
  data: unknown
): ValidationResult {
  // Compile schema (AJV caches compiled schemas internally)
  const validateFn: ValidateFunction<T> = ajv.compile(schema);
  const valid = validateFn(data);

  if (!valid && validateFn.errors) {
    const errors = formatAjvErrors(validateFn.errors);
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Generic type guard validation function
 *
 * @param schema - JSONSchema to validate against
 * @param data - Data to validate
 * @returns Type guard boolean
 */
export function validateTypeGuard<T>(
  schema: JSONSchemaType<T>,
  data: unknown
): data is T {
  const validateFn: ValidateFunction<T> = ajv.compile(schema);
  return validateFn(data);
}

/**
 * Get validation errors as a formatted string
 *
 * @param errors - Array of error messages
 * @returns Formatted error string
 */
export function getValidationErrors(errors?: string[]): string {
  if (!errors || errors.length === 0) {
    return 'Validation failed';
  }
  return errors.join(', ');
}
