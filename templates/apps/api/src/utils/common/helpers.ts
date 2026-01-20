/**
 * Common utility functions
 */

/**
 * Remove GSI (Global Secondary Index) fields from an entity
 * Useful for cleaning data before returning to clients
 */
export function removeGSIFields<T extends Record<string, any>>(entity: T): Omit<T, 'pk1' | 'sk1' | 'pk2' | 'sk2' | 'pk3' | 'sk3' | 'pk4' | 'sk4' | 'pk5' | 'sk5' | 'pk6' | 'sk6'> {
  const { pk1, sk1, pk2, sk2, pk3, sk3, pk4, sk4, pk5, sk5, pk6, sk6, ...rest } = entity;
  return rest as Omit<T, 'pk1' | 'sk1' | 'pk2' | 'sk2' | 'pk3' | 'sk3' | 'pk4' | 'sk4' | 'pk5' | 'sk5' | 'pk6' | 'sk6'>;
}

/**
 * Generate a unique ID
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
