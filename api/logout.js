import { clearCookie } from '../lib/auth.js';
export default function handler(req, res) { clearCookie(res); res.json({ ok: true }); }
