import { describe, it, expect, afterAll } from '@jest/globals';
import request from 'supertest';
import { app, pool } from '../../testUtils';

describe('GET /api/teams (live integration)', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('returns the seeded team list without requiring auth', async () => {
    const res = await request(app).get('/api/teams');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.teams)).toBe(true);
    expect(res.body.teams.length).toBeGreaterThan(0);
    expect(res.body.teams[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), name: expect.any(String) }),
    );
  });

  it('returns teams sorted alphabetically by name', async () => {
    const res = await request(app).get('/api/teams');
    const names: string[] = res.body.teams.map((t: { name: string }) => t.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});
