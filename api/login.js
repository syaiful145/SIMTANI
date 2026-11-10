import bcrypt from 'bcryptjs';
import { db } from '../lib/supa.js';
import { sign, setCookie } from '../lib/auth.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { username = '', password = '' } = req.body || {};
  const { data: u } = await db.from('users').select('*').eq('username', username).maybeSingle();
  if (!u || !(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ error: 'Username, password, atau peran tidak cocok' });
  if (u.aktif === false) return res.status(403).json({ error: 'Akun belum disetujui admin atau dinonaktifkan' });
  setCookie(res, sign({ id: u.id, role: u.role, nama: u.nama }));
  res.json({ ok: true, id: u.id, nama: u.nama, role: u.role });
}
