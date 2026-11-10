import { requireUser } from '../lib/auth.js';
export default function handler(req, res) {
  const me = requireUser(req, res); if (!me) return;
  res.json({ id: me.id, nama: me.nama, role: me.role });
}
