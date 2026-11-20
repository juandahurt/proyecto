import { createDatabase } from '../service/database';
import { createUploadRepository } from '../service/upload-repository';
import { createApp } from '../server';

const SIGNING_KEY = 'test-only-signing-key-0123456789abcdef';

describe('createApp — IDENTITY_URL requerido (CA-9)', () => {
  const db = createDatabase(':memory:');
  const repo = createUploadRepository(db);
  const originalIdentityUrl = process.env.IDENTITY_URL;

  afterAll(() => {
    db.close();
    if (originalIdentityUrl === undefined) delete process.env.IDENTITY_URL;
    else process.env.IDENTITY_URL = originalIdentityUrl;
  });

  it('lanza "IDENTITY_URL is required" si falta IDENTITY_URL (ni deps ni env)', () => {
    delete process.env.IDENTITY_URL;
    expect(() => createApp({ db, repo, signingKey: SIGNING_KEY })).toThrow(
      'IDENTITY_URL is required'
    );
  });

  it('no lanza si se inyecta identityUrl explícitamente', () => {
    delete process.env.IDENTITY_URL;
    expect(() =>
      createApp({ db, repo, signingKey: SIGNING_KEY, identityUrl: 'http://identity-test.invalid' })
    ).not.toThrow();
  });

  it('toma IDENTITY_URL de process.env si no se inyecta', () => {
    process.env.IDENTITY_URL = 'http://identity-service:3100';
    expect(() => createApp({ db, repo, signingKey: SIGNING_KEY })).not.toThrow();
  });
});
