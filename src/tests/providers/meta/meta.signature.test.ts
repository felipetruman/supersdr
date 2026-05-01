import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMetaSignature } from '../../../adapters/meta/meta.signature.js';

const SECRET = 'super-secret';

function sign(body: string, secret = SECRET): string {
  const hex = createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  return `sha256=${hex}`;
}

describe('verifyMetaSignature', () => {
  it('aceita assinatura válida', () => {
    const body = '{"hello":"world"}';
    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true);
  });

  it('rejeita assinatura inválida', () => {
    const body = '{"hello":"world"}';
    expect(verifyMetaSignature(body, sign(body, 'outro'), SECRET)).toBe(false);
  });

  it('rejeita header ausente', () => {
    expect(verifyMetaSignature('{}', undefined, SECRET)).toBe(false);
  });

  it('rejeita header sem prefixo sha256=', () => {
    expect(verifyMetaSignature('{}', 'abc123', SECRET)).toBe(false);
  });

  it('rejeita body adulterado', () => {
    const original = '{"a":1}';
    const sig = sign(original);
    expect(verifyMetaSignature('{"a":2}', sig, SECRET)).toBe(false);
  });
});
