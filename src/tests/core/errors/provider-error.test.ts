import { describe, it, expect } from 'vitest';
import {
  ProviderError,
  ProviderApiError,
  WebhookSignatureError,
  WebhookValidationError,
  UnsupportedFeatureError,
} from '../../../core/errors/provider-error.js';

describe('ProviderError hierarchy', () => {
  it('ProviderError base preserva message, provider, code e cause', () => {
    const cause = new Error('boom');
    const err = new ProviderError('msg', 'meta', 'CODE_X', cause);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('msg');
    expect(err.provider).toBe('meta');
    expect(err.code).toBe('CODE_X');
    expect(err.cause).toBe(cause);
    expect(err.name).toBe('ProviderError');
  });

  it('ProviderApiError carrega httpStatus, provider e cause', () => {
    const err = new ProviderApiError('meta', 400, 'Bad request', {
      reason: 'x',
    });
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.provider).toBe('meta');
    expect(err.httpStatus).toBe(400);
    expect(err.code).toBe('PROVIDER_API');
    expect(err.message).toBe('Bad request');
    expect(err.cause).toEqual({ reason: 'x' });
    expect(err.name).toBe('ProviderApiError');
  });

  it('ProviderApiError funciona sem cause', () => {
    const err = new ProviderApiError('meta', 500, 'boom');
    expect(err.cause).toBeUndefined();
  });

  it('WebhookSignatureError carrega provider e code', () => {
    const err = new WebhookSignatureError('evolution-baileys');
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.provider).toBe('evolution-baileys');
    expect(err.code).toBe('WEBHOOK_SIGNATURE');
    expect(err.name).toBe('WebhookSignatureError');
    expect(err.message).toMatch(/signature/i);
  });

  it('WebhookValidationError carrega provider, code e cause', () => {
    const cause = { fieldErrors: { foo: ['required'] } };
    const err = new WebhookValidationError('wppconnect', cause);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.provider).toBe('wppconnect');
    expect(err.code).toBe('WEBHOOK_VALIDATION');
    expect(err.cause).toBe(cause);
    expect(err.name).toBe('WebhookValidationError');
  });

  it('UnsupportedFeatureError monta mensagem e código corretamente', () => {
    const err = new UnsupportedFeatureError('meta', 'reactions');
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.provider).toBe('meta');
    expect(err.code).toBe('UNSUPPORTED_FEATURE');
    expect(err.name).toBe('UnsupportedFeatureError');
    expect(err.message).toBe('Provider "meta" does not support "reactions"');
  });

  it('erros mantêm name e mensagem ao serem stringificados', () => {
    const err = new ProviderApiError('meta', 500, 'boom');
    expect(err.toString()).toContain('ProviderApiError');
    expect(err.toString()).toContain('boom');
  });
});
