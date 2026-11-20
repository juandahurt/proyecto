import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server';
import { PolicyResponseSchema } from '@proyecto/shared-types';

const TEST_SECRET = 'a-test-secret-for-tests-only';
const TEST_POLICY =
  'Test policy content that is long enough to satisfy the fifty character minimum length requirement for content.';

function makeJwt(userId: string): string {
  return jwt.sign({ sub: userId }, TEST_SECRET, { algorithm: 'HS256', expiresIn: '7d' });
}

describe('Policy HTTP handler', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    process.env.JWT_SECRET = TEST_SECRET;
    process.env.INGESTION_URL = 'http://ingestion-service:3200';
    process.env.IDENTITY_URL = 'http://identity-service:3100';
  });

  beforeEach(() => {
    app = createApp({ policyContent: TEST_POLICY });
  });

  // ---------------------------------------------------------------------------
  // CA-3: 401 sin Authorization header
  // ---------------------------------------------------------------------------

  it('GET /api/policy: 401 unauthenticated — no auth header', async () => {
    const res = await request(app).get('/api/policy');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ data: null, error: 'unauthenticated', status: 401 });
  });

  // ---------------------------------------------------------------------------
  // CA-4: 200 con JWT válido, content ≥50 chars
  // ---------------------------------------------------------------------------

  it('GET /api/policy: 200 with valid JWT — returns policy content', async () => {
    const token = makeJwt('policy-user-001');
    const res = await request(app).get('/api/policy').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(typeof res.body.data.content).toBe('string');
    expect(res.body.data.content.length).toBeGreaterThanOrEqual(50);
  });

  // ---------------------------------------------------------------------------
  // CA-5: schema válido — PolicyResponseSchema.parse no arroja
  // ---------------------------------------------------------------------------

  it('GET /api/policy: response body satisfies PolicyResponseSchema', async () => {
    const token = makeJwt('policy-schema-001');
    const res = await request(app).get('/api/policy').set('Authorization', `Bearer ${token}`);

    expect(() => PolicyResponseSchema.parse(res.body)).not.toThrow();
  });

  it('GET /api/policy: PolicyResponseSchema.safeParse succeeds', async () => {
    const token = makeJwt('policy-schema-002');
    const res = await request(app).get('/api/policy').set('Authorization', `Bearer ${token}`);

    const parsed = PolicyResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // CA-2 / AC-12.2: content menciona no-training y mecanismo de borrado
  // ---------------------------------------------------------------------------

  it('GET /api/policy: default content mentions no-training (using default policy)', async () => {
    // Uses the real default policy content (not the test stub)
    const appDefault = createApp({});
    const token = makeJwt('policy-train-001');
    const res = await request(appDefault)
      .get('/api/policy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.content.toLowerCase()).toMatch(/train/);
  });

  it('GET /api/policy: default content mentions deletion via Settings', async () => {
    // Uses the real default policy content (not the test stub)
    const appDefault = createApp({});
    const token = makeJwt('policy-delete-001');
    const res = await request(appDefault)
      .get('/api/policy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const lower = res.body.data.content.toLowerCase();
    const mentionsDelete = lower.includes('delete') || lower.includes('settings');
    expect(mentionsDelete).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Extra: injected content is used when policyContent dep is provided
  // ---------------------------------------------------------------------------

  it('GET /api/policy: injected policyContent is returned as content', async () => {
    const token = makeJwt('policy-inject-001');
    const res = await request(app).get('/api/policy').set('Authorization', `Bearer ${token}`);

    expect(res.body.data.content).toBe(TEST_POLICY);
  });
});
