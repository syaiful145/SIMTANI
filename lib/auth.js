import crypto from 'crypto';
const SECRET = process.env.SESSION_SECRET;
if (!SECRET) throw new Error('SESSION_SECRET belum diisi di Environment Variables Vercel');
const sig = p => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
export function sign(data) {
  const p = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + 7 * 864e5 })).toString('base64url');
  return p + '.' + sig(p);
}
export function verify(tok) {
  if (!tok || !tok.includes('.')) return null;
  const [p, s] = tok.split('.');
  const e = sig(p);
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
  const d = JSON.parse(Buffer.from(p, 'base64url').toString());
  return d.exp > Date.now() ? d : null;
}
export function requireUser(req, res) {
  const m = (req.headers.cookie || '').match(/(?:^|;\s*)sid=([^;]+)/);
  const u = verify(m && m[1]);
  if (!u) res.status(401).json({ error: 'Belum login' });
  return u;
}
export function setCookie(res, tok) {
  res.setHeader('Set-Cookie', `sid=${tok}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=604800`);
}
export function clearCookie(res) {
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=0');
}
