import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.AUTH_SECRET || process.env.DATABASE_URL;
const EXPIRACAO_MS = 24 * 60 * 60 * 1000;

function assinar(payloadB64) {
  return createHmac('sha256', SECRET).update(payloadB64).digest('base64url');
}

function assinaturasIguais(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function criarToken({ usuario, nome, tipo }) {
  const payload = { usuario, nome, tipo, exp: Date.now() + EXPIRACAO_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${payloadB64}.${assinar(payloadB64)}`;
}

export function verificarToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, assinatura] = token.split('.');
  if (!payloadB64 || !assinatura || !assinaturasIguais(assinar(payloadB64), assinatura)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

export function autenticar(req) {
  const auth = req.headers?.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return verificarToken(token);
}
