import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// The database is mocked: these tests cover authentication and role checks,
// which must reject requests before any ticket/article query runs.
vi.mock('../src/prisma.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    knowledgeArticle: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    ticket: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

const { prisma } = await import('../src/prisma.js');
const { createApp } = await import('../src/app.js');
const { signToken } = await import('../src/middleware/auth.js');

const app = createApp();
const USERS = {
  1: { id: 1, name: 'Admin', email: 'admin@x.test', role: 'ADMIN', isActive: true },
  2: { id: 2, name: 'Staff', email: 'staff@x.test', role: 'IT_STAFF', isActive: true },
  3: { id: 3, name: 'Employee', email: 'emp@x.test', role: 'EMPLOYEE', isActive: true },
  4: { id: 4, name: 'Gone', email: 'gone@x.test', role: 'IT_STAFF', isActive: false },
};
const tokenFor = (id) => `Bearer ${signToken(USERS[id])}`;

beforeEach(() => {
  vi.clearAllMocks();
  prisma.user.findUnique.mockImplementation(async ({ where }) => USERS[where.id] ?? null);
  prisma.knowledgeArticle.findMany.mockResolvedValue([]);
  prisma.knowledgeArticle.count.mockResolvedValue(0);
});

describe('authentication', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/api/tickets');
    expect(res.status).toBe(401);
  });

  it('rejects a forged token', async () => {
    const res = await request(app).get('/api/tickets').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('rejects deactivated users even with a valid token', async () => {
    const res = await request(app).get('/api/knowledge-articles').set('Authorization', tokenFor(4));
    expect(res.status).toBe(401);
  });
});

describe('knowledge base is staff-only (FR26)', () => {
  it.each([
    ['get', '/api/knowledge-articles'],
    ['get', '/api/knowledge-articles/1'],
    ['post', '/api/knowledge-articles'],
    ['patch', '/api/knowledge-articles/1'],
    ['delete', '/api/knowledge-articles/1'],
    ['post', '/api/tickets/1/knowledge-article'],
  ])('employee gets 403 on %s %s', async (method, url) => {
    const res = await request(app)[method](url).set('Authorization', tokenFor(3)).send({});
    expect(res.status).toBe(403);
    expect(prisma.knowledgeArticle.findMany).not.toHaveBeenCalled();
    expect(prisma.knowledgeArticle.create).not.toHaveBeenCalled();
  });

  it('IT staff can search articles', async () => {
    const res = await request(app).get('/api/knowledge-articles?q=printer').set('Authorization', tokenFor(2));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ items: [], total: 0 });
  });

  it('only admins can delete articles', async () => {
    const res = await request(app).delete('/api/knowledge-articles/1').set('Authorization', tokenFor(2));
    expect(res.status).toBe(403);
  });
});

describe('role-restricted endpoints', () => {
  it.each([
    ['get', '/api/users', 3],
    ['get', '/api/users', 2],
    ['patch', '/api/users/3/role', 2],
    ['get', '/api/reports/summary', 3],
    ['get', '/api/reports/summary', 2],
    ['get', '/api/reports/export.csv', 2],
    ['get', '/api/users/staff', 3],
    ['patch', '/api/tickets/1/assign', 3],
    ['patch', '/api/tickets/1/priority', 3],
  ])('%s %s is forbidden for user %i', async (method, url, userId) => {
    const res = await request(app)[method](url).set('Authorization', tokenFor(userId)).send({});
    expect(res.status).toBe(403);
  });

  it('admins cannot remove their own admin role', async () => {
    const res = await request(app).patch('/api/users/1/role').set('Authorization', tokenFor(1)).send({ role: 'EMPLOYEE' });
    expect(res.status).toBe(400);
  });
});

describe('validation', () => {
  it('rejects a bad registration payload', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'A', email: 'nope', password: '123' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d) => d.field)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('rejects unknown enum values in ticket filters', async () => {
    const res = await request(app).get('/api/tickets?status=DROP').set('Authorization', tokenFor(2));
    expect(res.status).toBe(400);
  });
});
