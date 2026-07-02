// arctic ships ESM-only, which Jest can't load transitively (app.ts ->
// oauth.routes.ts -> arctic) without a full ESM transform pipeline. None of
// the integration tests exercise the real Google/Apple network calls — they
// only need module resolution to succeed so createApp() can mount
// oauth.routes.ts. Real OAuth behavior is covered separately in
// oauth.service.test.ts, which never imports this package.
export function generateState(): string {
  return 'mock-state';
}

export function generateCodeVerifier(): string {
  return 'mock-code-verifier';
}

export function decodeIdToken(): object {
  return {};
}

export class Google {
  constructor(..._args: unknown[]) {}
  createAuthorizationURL(): URL {
    return new URL('https://example.com/mock-google-auth');
  }
  validateAuthorizationCode(): Promise<never> {
    return Promise.reject(new Error('arctic is mocked in tests'));
  }
}

export class Apple {
  constructor(..._args: unknown[]) {}
  createAuthorizationURL(): URL {
    return new URL('https://example.com/mock-apple-auth');
  }
  validateAuthorizationCode(): Promise<never> {
    return Promise.reject(new Error('arctic is mocked in tests'));
  }
}
