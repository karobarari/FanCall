import { describe, it, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import { pool, resetDb, getTeamId } from '../../testUtils';
import { HttpError } from '../../lib/errors';
import { signup } from './auth.service';
import { completeOAuthSignup, resolveOAuthLogin } from './oauth.service';

describe('oauth.service (live integration, no HTTP/provider)', () => {
  let teamId: string;
  let teamName: string;

  beforeAll(async () => {
    teamId = await getTeamId();
    teamName = 'Manchester City';
  });

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
        teamId,
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
      const existing = await signup('shared@test.dev', 'correct-horse', 'sharedfan', teamId);

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
      await signup('shared@test.dev', 'correct-horse', 'sharedfan', teamId);

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
    it('creates a new account for the chosen team', async () => {
      const user = await completeOAuthSignup({
        provider: 'apple',
        providerId: 'apple-sub-1',
        email: 'applefan@test.dev',
        emailVerified: true,
        displayName: 'applefan',
        teamId,
      });
      expect(user).toMatchObject({
        email: 'applefan@test.dev',
        display_name: 'applefan',
        team_name: teamName,
        is_admin: false,
      });
    });

    it('marks the admin account as admin via OAuth too', async () => {
      const user = await completeOAuthSignup({
        provider: 'apple',
        providerId: 'apple-sub-admin',
        email: 'admin@test.dev',
        emailVerified: true,
        displayName: 'oauthadmin',
        teamId,
      });
      expect(user.is_admin).toBe(true);
      expect(user.paid).toBe(true);
    });

    it('rejects an unknown team id', async () => {
      await expect(
        completeOAuthSignup({
          provider: 'apple',
          providerId: 'apple-sub-unknown-team',
          email: 'noteam@test.dev',
          emailVerified: true,
          displayName: 'noteamfan',
          teamId: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toMatchObject({ status: 400 } satisfies Partial<HttpError>);
    });

    it('rejects a username that is already taken', async () => {
      await signup('first@test.dev', 'correct-horse', 'sharedname', teamId);

      await expect(
        completeOAuthSignup({
          provider: 'apple',
          providerId: 'apple-sub-3',
          email: 'second@test.dev',
          emailVerified: true,
          displayName: 'sharedname',
          teamId,
        }),
      ).rejects.toMatchObject({ status: 409 } satisfies Partial<HttpError>);
    });
  });
});
