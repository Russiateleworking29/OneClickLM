export class OneClickLMError extends Error {
  public readonly suggestion: string;

  constructor(message: string, suggestion: string) {
    super(message);
    this.name = "OneClickLMError";
    this.suggestion = suggestion;
  }

  toUserMessage(): string {
    return `${this.message}\n\nSuggestion: ${this.suggestion}`;
  }
}

export class AuthError extends OneClickLMError {
  constructor(message: string, suggestion?: string) {
    super(
      message,
      suggestion ?? 'Run "npx oneclicklm login" to re-authenticate.'
    );
    this.name = "AuthError";
  }
}

export class TokenError extends OneClickLMError {
  constructor(message: string, suggestion?: string) {
    super(
      message,
      suggestion ?? "Tokens will auto-refresh on next request. If the problem persists, run \"npx oneclicklm login\"."
    );
    this.name = "TokenError";
  }
}

export class APIError extends OneClickLMError {
  public readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    const suggestion = statusCode === 400
      ? "This usually means tokens are stale. OneClickLM will auto-refresh. If it persists, run \"npx oneclicklm login\"."
      : statusCode === 401 || statusCode === 403
        ? "Your session has expired. Run \"npx oneclicklm login\" to re-authenticate."
        : statusCode === 429
          ? "Rate limited by Google. Wait a moment and try again."
          : `Unexpected error (HTTP ${statusCode}). Check your network connection.`;
    super(message, suggestion);
    this.name = "APIError";
    this.statusCode = statusCode;
  }
}

export function formatError(error: unknown): string {
  if (error instanceof OneClickLMError) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
