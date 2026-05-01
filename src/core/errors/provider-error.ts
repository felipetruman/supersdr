/**
 * Erros tipados — facilita tratamento no HTTP layer e em testes.
 */

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class WebhookValidationError extends ProviderError {
  constructor(provider: string, cause?: unknown) {
    super('Invalid webhook payload', provider, 'WEBHOOK_VALIDATION', cause);
    this.name = 'WebhookValidationError';
  }
}

export class WebhookSignatureError extends ProviderError {
  constructor(provider: string) {
    super('Invalid webhook signature', provider, 'WEBHOOK_SIGNATURE');
    this.name = 'WebhookSignatureError';
  }
}

export class ProviderApiError extends ProviderError {
  constructor(
    provider: string,
    public readonly httpStatus: number,
    message: string,
    cause?: unknown,
  ) {
    super(message, provider, 'PROVIDER_API', cause);
    this.name = 'ProviderApiError';
  }
}

export class UnsupportedFeatureError extends ProviderError {
  constructor(provider: string, feature: string) {
    super(
      `Provider "${provider}" does not support "${feature}"`,
      provider,
      'UNSUPPORTED_FEATURE',
    );
    this.name = 'UnsupportedFeatureError';
  }
}
