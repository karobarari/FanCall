import { describe, it, expect, beforeEach, afterAll } from '@jest/globals';
import { pool, resetDb } from '../../testUtils';
import { HttpError } from '../../lib/errors';
import { signup } from './auth.service';
import { PILOT_TEAM_NAME } from '../../config/pilotTeam';
import { completeOAuthSignup, resolveOAuthLogin } from './oauth.service';

describe('oauth.service (live integration, no HTTP/provider)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await pool.end();
  });

  describe('resolveOAuthLogin', () => {
    it('reports needs_profile for an identity with no matching account', async () => {
      const result = await resolveOAuthLogin({
        provider: 'google',
        providerId: 'google-sub-1',
        email: 'newperson@test.dev',
        emailVerified: true,
      });
      expect(result).toEqual({ status: 'needs_profile' });
    });

    it('logs in on a repeat visit from the same provider identity', async () => {
      const created = await completeOAuthSignup({
        provider: 'google',
        providerId: 'google-sub-1',
        email: 'newperson@test.dev',
        emailVerified: true,
        displayName: 'newperson',
      });

      const result = await resolveOAuthLogin({
        provider: 'google',
        providerId: 'google-sub-1',
        email: 'newperson@test.dev',
        emailVerified: true,
      });
      expect(result).toEqual({ status: 'logged_in', user: expect.objectContaining({ id: created.id }) });
    });

    it('auto-links to an existing password account when the provider vouches the email', async () => {
      const existing = await signup('shared@test.dev', 'correct-horse', 'sharedfan');

      const result = await resolveOAuthLogin({
        provider: 'google',
        providerId: 'google-sub-2',
        email: 'shared@test.dev',
        emailVerified: true,
      });
      expect(result).toEqual({ status: 'logged_in', user: expect.objectContaining({ id: existing.id }) });

      // The link should have been persisted — a second visit resolves via
      // the provider-id match, not the email match, and lands on the same
      // account either way.
      const second = await resolveOAuthLogin({
        provider: 'google',
        providerId: 'google-sub-2',
        email: 'shared@test.dev',
        emailVerified: true,
      });
      expect(second).toEqual({ status: 'logged_in', user: expect.objectContaining({ id: existing.id }) });
    });

    it('refuses to link when the provider does not vouch the email as verified', async () => {
      await signup('shared@test.dev', 'correct-horse', 'sharedfan');

      await expect(
        resolveOAuthLogin({
          provider: 'google',
          providerId: 'google-sub-3',
          email: 'shared@test.dev',
          emailVerified: false,
        }),
      ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
    });
  });

  describe('completeOAuthSignup', () => {
    it('creates a new account, auto-assigned to the pilot team', async () => {
      const user = await completeOAuthSignup({
        provider: 'apple',
        providerId: 'apple-sub-1',
        email: 'applefan@test.dev',
        emailVerified: true,
        displayName: 'applefan',
      });
      expect(user).toMatchObject({
        email: 'applefan@test.dev',
        display_name: 'applefan',
        team_name: PILOT_TEAM_NAME,
      });
    });

    it('rejects a username that is already taken', async () => {
      await signup('first@test.dev', 'correct-horse', 'sharedname');

      await expect(
        completeOAuthSignup({
          provider: 'apple',
          providerId: 'apple-sub-3',
          email: 'second@test.dev',
          emailVerified: true,
          displayName: 'sharedname',
        }),
      ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
    });
  });
});
