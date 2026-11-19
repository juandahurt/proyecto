import { LoginRequestSchema, RegisterRequestSchema } from '@proyecto/shared-types';
import { validateCredentials } from '../pages/credentials';

type Issue = { path: PropertyKey[]; code: string; minimum?: unknown };
const fakeSchema = (issues: Issue[]) => ({
  safeParse: () => ({ success: false as const, error: { issues } }),
});

describe('validateCredentials', () => {
  it.each([LoginRequestSchema, RegisterRequestSchema])('acepta credenciales válidas', (schema) => {
    expect(validateCredentials(schema, 'ana@example.test', 'not-a-real-password')).toBeNull();
  });

  it('email inválido da el mensaje de email', () => {
    expect(validateCredentials(LoginRequestSchema, 'nope', 'not-a-real-password')).toBe(
      'Enter a valid email address.'
    );
  });

  it('contraseña corta usa el mínimo del schema compartido', () => {
    const min = (
      LoginRequestSchema.safeParse({ email: 'ana@example.test', password: 'x' }).error!
        .issues[0] as {
        minimum: number;
      }
    ).minimum;
    expect(validateCredentials(LoginRequestSchema, 'ana@example.test', 'x')).toBe(
      `Password must be at least ${min} characters.`
    );
  });

  it('el mínimo del mensaje sale del issue, no de un literal', () => {
    const schema = fakeSchema([{ path: ['password'], code: 'too_small', minimum: 12 }]);
    expect(validateCredentials(schema, 'a', 'b')).toBe('Password must be at least 12 characters.');
  });

  it('un fallo de contraseña que no es de longitud no se traduce al mensaje de mínimo', () => {
    const schema = fakeSchema([{ path: ['password'], code: 'invalid_type' }]);
    const msg = validateCredentials(schema, 'a', 'b');
    expect(msg).toBe('Enter a valid email and password.');
    expect(msg).not.toMatch(/at least/);
  });
});
