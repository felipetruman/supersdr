import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Valida assinatura HMAC-SHA256 do webhook da Meta.
 * Header: X-Hub-Signature-256: sha256=<hex>
 *
 * IMPORTANTE: usar o RAW body (string original), não o JSON parseado/re-serializado.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const received = signatureHeader.slice('sha256='.length);
  const expected = createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex');

  // Comparação tempo-constante pra evitar timing attacks
  const a = Buffer.from(received, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
