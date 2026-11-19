import { LoginRequestSchema, RegisterRequestSchema } from '@proyecto/shared-types';

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

type Schema = typeof LoginRequestSchema | typeof RegisterRequestSchema;

/** Valida en el cliente con el schema compartido. Devuelve un mensaje o null si es válido. */
export function validateCredentials(
  schema: Schema,
  email: string,
  password: string
): string | null {
  const result = schema.safeParse({ email, password });
  if (result.success) return null;
  const fields = new Set(result.error.issues.map((i) => i.path[0]));
  if (fields.has('email')) return 'Enter a valid email address.';
  return 'Password must be at least 8 characters.';
}
