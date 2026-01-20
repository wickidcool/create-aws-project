/**
 * Utility functions for DynamoDB operations
 */

/**
 * GSI field names that are commonly used in DynamoDB models
 */
export type GSIFieldNames =
  | 'pk1' | 'sk1'
  | 'pk2' | 'sk2'
  | 'pk3' | 'sk3'
  | 'pk4' | 'sk4'
  | 'pk5' | 'sk5'
  | 'pk6' | 'sk6';

/**
 * Remove GSI (Global Secondary Index) fields from an entity
 * Useful for cleaning data before returning to clients
 */
export function removeGSIFields<T extends Record<string, unknown>>(
  entity: T
): Omit<T, GSIFieldNames> {
  const { pk1: _pk1, sk1: _sk1, pk2: _pk2, sk2: _sk2, pk3: _pk3, sk3: _sk3, pk4: _pk4, sk4: _sk4, pk5: _pk5, sk5: _sk5, pk6: _pk6, sk6: _sk6, ...rest } = entity as Record<string, unknown>;
  return rest as Omit<T, GSIFieldNames>;
}

/**
 * Generate a unique ID using crypto.randomUUID
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Get current ISO timestamp
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}
