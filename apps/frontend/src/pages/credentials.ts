export const GENERIC_ERROR = 'Something went wrong. Please try again.';

interface Issue {
  path: PropertyKey[];
  code: string;
  minimum?: unknown;
}

/** Forma mínima que usamos de un schema Zod (login, registro o un doble en tests). */
export interface CredentialsSchema {
  safeParse(value: unknown): { success: true } | { success: false; error: { issues: Issue[] } };
}

/**
 * Valida en el cliente con el schema compartido. Devuelve un mensaje o null si es válido.
 * El mínimo de la contraseña sale del issue de Zod, no de un literal.
 */
export function validateCredentials(
  schema: CredentialsSchema,
  email: string,
  password: string
): string | null {
  const result = schema.safeParse({ email, password });
  if (result.success) return null;
  const issues = result.error.issues;
  if (issues.some((i) => i.path[0] === 'email')) return 'Enter a valid email address.';
  const tooSmall = issues.find(
    (i) => i.path[0] === 'password' && i.code === 'too_small' && typeof i.minimum === 'number'
  );
  if (tooSmall) return `Password must be at least ${tooSmall.minimum} characters.`;
  return 'Enter a valid email and password.';
}
