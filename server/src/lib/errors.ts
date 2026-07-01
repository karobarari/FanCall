// Services throw this to signal an HTTP status without touching req/res.
// The error middleware turns it into a JSON response.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

// True for Postgres' unique_violation (23505) — the code every service uses
// to turn a duplicate-key insert into a 409 instead of a 500.
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}
