import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import { RegisterRequestSchema, LoginRequestSchema } from '@proyecto/shared-types';
import { UserRepository } from '../service/user-repository';
import { hash, compare } from '../service/password';
import { sign } from '../service/jwt';

/** TTL del token en segundos: 7 días. Debe coincidir con jwt.ts. */
const TOKEN_TTL_SECONDS = 604800;

/**
 * Hash dummy para evitar timing side-channels cuando el email no existe.
 * Se genera una vez al arrancar el módulo.
 */
let dummyHash = '$2b$10$invalidhashpaddingthatnevermatchesAAAAAAAAAAAAAAAAAAAAAAAA';

export interface AuthRouterDeps {
  repo: UserRepository;
}

/**
 * Crea el router de autenticación.
 *
 * POST /api/auth/register — registra un usuario nuevo.
 * POST /api/auth/login    — autentica un usuario existente.
 */
export function createAuthRouter({ repo }: AuthRouterDeps): Router {
  const router = Router();

  /**
   * POST /api/auth/register
   * Body: { email: string, password: string }
   * Responde 201 { data: { token, expiresIn }, error: null, status: 201 }
   * Errores: 422 (Zod), 409 (email duplicado), 500 (inesperado)
   */
  router.post('/register', async (req: Request, res: Response) => {
    // 1. Validar con Zod
    const parsed = RegisterRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        data: null,
        error: formatZodError(parsed.error),
        status: 422,
      });
      return;
    }

    const { email, password } = parsed.data;

    try {
      // 2. Hash de la contraseña
      const passwordHash = await hash(password);

      // 3. Crear usuario (lanza si email duplicado)
      const user = repo.create({ email, passwordHash });

      // 4. Firmar JWT
      const token = sign({ sub: user.id });

      res.status(201).json({
        data: { token, expiresIn: TOKEN_TTL_SECONDS },
        error: null,
        status: 201,
      });
    } catch (err: unknown) {
      // Email duplicado — SQLite UNIQUE constraint
      if (isSqliteUniqueError(err)) {
        res.status(409).json({
          data: null,
          error: 'email already registered',
          status: 409,
        });
        return;
      }
      // Error inesperado
      res.status(500).json({
        data: null,
        error: 'internal server error',
        status: 500,
      });
    }
  });

  /**
   * POST /api/auth/login
   * Body: { email: string, password: string }
   * Responde 200 { data: { token, expiresIn }, error: null, status: 200 }
   * Errores: 422 (Zod), 401 (credenciales inválidas — mensaje genérico)
   *
   * AC-8.3: el 401 NO distingue entre email inexistente y password incorrecto.
   * Se ejecuta bcrypt.compare incluso cuando el usuario no existe (contra un
   * hash dummy) para evitar timing side-channels.
   */
  router.post('/login', async (req: Request, res: Response) => {
    // 1. Validar con Zod
    const parsed = LoginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(422).json({
        data: null,
        error: formatZodError(parsed.error),
        status: 422,
      });
      return;
    }

    const { email, password } = parsed.data;

    // 2. Buscar usuario (con hash para compare)
    const userWithHash = repo.findByEmailWithHash(email);
    const hashToCompare = userWithHash?.passwordHash ?? dummyHash;

    // 3. Comparar contraseña (siempre se ejecuta para evitar timing attacks)
    const passwordMatches = await compare(password, hashToCompare);

    // 4. Si el usuario no existe o la contraseña no coincide → 401 genérico
    if (!userWithHash || !passwordMatches) {
      res.status(401).json({
        data: null,
        error: 'invalid credentials',
        status: 401,
      });
      return;
    }

    // 5. Firmar JWT
    const token = sign({ sub: userWithHash.id });

    res.status(200).json({
      data: { token, expiresIn: TOKEN_TTL_SECONDS },
      error: null,
      status: 200,
    });
  });

  return router;
}

/** Formatea un ZodError en un string legible sin filtrar el stack. */
function formatZodError(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

/** Detecta errores de violación de UNIQUE en better-sqlite3. */
function isSqliteUniqueError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: string }).code === 'SQLITE_CONSTRAINT_UNIQUE';
  }
  return false;
}
