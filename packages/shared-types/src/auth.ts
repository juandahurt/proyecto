import { z } from 'zod';

/**
 * Schema Zod para el body del request POST /api/auth/register.
 * Fuente autoritativa del contrato de registro de usuario.
 */
export const RegisterRequestSchema = z.object({
  /** Email válido del usuario. */
  email: z.string().email(),
  /** Contraseña mínima de 8 caracteres. */
  password: z.string().min(8),
});

/** Tipo TypeScript derivado del schema Zod. Nunca definir manualmente. */
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/**
 * Schema Zod para el body del request POST /api/auth/login.
 * Mismos campos que registro — se mantiene un schema separado para
 * poder evolucionar cada contrato de forma independiente.
 */
export const LoginRequestSchema = z.object({
  /** Email del usuario. */
  email: z.string().email(),
  /** Contraseña mínima de 8 caracteres. */
  password: z.string().min(8),
});

/** Tipo TypeScript derivado del schema Zod. Nunca definir manualmente. */
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

/**
 * Schema Zod para la respuesta de autenticación exitosa.
 * Shape uniforme: { data, error, status }.
 */
export const AuthResponseSchema = z.object({
  data: z.object({
    /** JWT firmado con HS256, TTL 7 días. */
    token: z.string(),
    /** Tiempo de vida del token en segundos. Siempre 604800 (7 días). */
    expiresIn: z.literal(604800),
  }),
  error: z.null(),
  status: z.number().int().positive(),
});

/** Tipo TypeScript derivado del schema Zod. Nunca definir manualmente. */
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

/**
 * Schema Zod para el payload del JWT de identidad.
 * Sub es el UUID del usuario; iat y exp son timestamps Unix.
 */
export const JwtPayloadSchema = z.object({
  /** UUID del usuario — sujeto del token. */
  sub: z.string(),
  /** Timestamp Unix de emisión (seconds). */
  iat: z.number().int().optional(),
  /** Timestamp Unix de expiración (seconds). */
  exp: z.number().int().optional(),
});

/** Tipo TypeScript derivado del schema Zod. Nunca definir manualmente. */
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;
