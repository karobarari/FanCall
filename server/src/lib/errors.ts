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
