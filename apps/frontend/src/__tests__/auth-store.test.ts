import { TOKEN_KEY, clearToken, isExpired, readToken, saveToken } from '../auth/token-store';
import { fakeJwt } from './helpers';

describe('auth-store', () => {
  beforeEach(() => window.localStorage.clear());

  it('guarda, lee y borra el token bajo la clave estudio.token', () => {
    const t = fakeJwt();
    saveToken(t);
    expect(window.localStorage.getItem('estudio.token')).toBe(t);
    expect(TOKEN_KEY).toBe('estudio.token');
    expect(readToken()).toBe(t);
    clearToken();
    expect(window.localStorage.getItem('estudio.token')).toBeNull();
    expect(readToken()).toBeNull();
  });

  it('sin token guardado devuelve null', () => {
    expect(readToken()).toBeNull();
  });

  it('un token expirado (exp en el pasado) se trata como ausente y se borra al arrancar', () => {
    window.localStorage.setItem(TOKEN_KEY, fakeJwt(-60));
    expect(readToken()).toBeNull();
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('un token vigente no se considera expirado', () => {
    expect(isExpired(fakeJwt(3600))).toBe(false);
  });

  it('isExpired usa la hora inyectada', () => {
    const t = fakeJwt(3600);
    expect(isExpired(t, Date.now() + 2 * 3600 * 1000)).toBe(true);
  });

  it('un token sin claim exp o ilegible no se considera expirado (decide el servidor)', () => {
    const enc = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, '');
    const noExp = `${enc({ alg: 'none' })}.${enc({ sub: 'u' })}.x`;
    expect(isExpired(noExp)).toBe(false);
    expect(isExpired('basura')).toBe(false);
    expect(isExpired('a.%%%.c')).toBe(false);
  });

  it('un localStorage que lanza no rompe: se comporta como sin sesión', () => {
    const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const rmSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readToken()).toBeNull();
    expect(() => saveToken('x')).not.toThrow();
    expect(() => clearToken()).not.toThrow();
    getSpy.mockRestore();
    setSpy.mockRestore();
    rmSpy.mockRestore();
  });

  it('un token expirado con removeItem que lanza sigue devolviendo null', () => {
    window.localStorage.setItem(TOKEN_KEY, fakeJwt(-60));
    const rmSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readToken()).toBeNull();
    rmSpy.mockRestore();
  });
});
