import bcrypt from 'bcryptjs';
import { db, logAkt } from '../lib/supa.js';
import { requireUser } from '../lib/auth.js';
const bad = (res, m, c = 400) => res.status(c).json({ error: m });

export default async function handler(req, res) {
  const act = req.query.act, b = req.body || {};
  const POST = req.method === 'POST';

  if (act === 'daftar') {
    if (!POST) return res.status(405).end();
    const { nama, username, password } = b;
    if (!nama || !username || !password || password.length < 6) return bad(res, 'Lengkapi data, sandi minimal 6 karakter');
    const { data: ada } = await db.from('users').select('id').eq('username', username).maybeSingle();
    if (ada) return bad(res, 'Username sudah dipakai');
    const { error } = await db.from('users').insert({ nama, username, password_hash: await bcrypt.hash(password, 10), role: 'petani', aktif: false });
    if (error) return bad(res, error.message);
    return res.json({ ok: true, pesan: 'Pendaftaran terkirim, tunggu persetujuan admin' });
  }
  if (act === 'lupa') {
    if (!POST) return res.status(405).end();
    const { data: u } = await db.from('users').select('nama').eq('username', b.username || '').maybeSingle();
    if (!u) return bad(res, 'Username tidak ditemukan', 404);
    const { data: p } = await db.from('reset_requests').select('id').eq('username', b.username).eq('status', 'Menunggu').maybeSingle();
    if (p) return bad(res, 'Permintaan sudah dikirim, tunggu admin');
    await db.from('reset_requests').insert({ username: b.username, nama: u.nama, status: 'Menunggu' });
    return res.json({ ok: true });
  }

  const me = requireUser(req, res); if (!me) return;

  if (act === 'profil') {
    const id = me.role === 'admin' && req.query.id ? Number(req.query.id) : me.id;
    const { data: p } = await db.from('users').select('id,nama,username,role,aktif,foto').eq('id', id).single();
    if (!p) return bad(res, 'Profil tidak ditemukan', 404);
    const [tn, pn, ak] = await Promise.all([
      db.from('penanaman').select('id', { count: 'exact', head: true }).eq('dicatat_oleh', p.nama),
      db.from('panen').select('id', { count: 'exact', head: true }).eq('dicatat_oleh', p.nama),
      db.from('aktivitas').select('deskripsi,waktu').eq('pengguna', p.nama).order('id', { ascending: false }).limit(10),
    ]);
    return res.json({ ...p, jml_penanaman: tn.count || 0, jml_panen: pn.count || 0, aktivitas: ak.data || [] });
  }
  if (act === 'ganti') {
    if (!POST) return res.status(405).end();
    const { data: u } = await db.from('users').select('password_hash').eq('id', me.id).single();
    if (!(await bcrypt.compare(b.old || '', u.password_hash))) return bad(res, 'Sandi lama salah');
    if (!b.baru || b.baru.length < 6) return bad(res, 'Sandi baru minimal 6 karakter');
    await db.from('users').update({ password_hash: await bcrypt.hash(b.baru, 10) }).eq('id', me.id);
    await logAkt(me.nama, 'akun', 'Mengganti sandi');
    return res.json({ ok: true });
  }
  if (act === 'foto') {
    if (!POST) return res.status(405).end();
    const id = me.role === 'admin' && b.id ? Number(b.id) : me.id;
    if (!b.foto || b.foto.length > 200000) return bad(res, 'Foto kosong atau terlalu besar');
    await db.from('users').update({ foto: b.foto }).eq('id', id);
    return res.json({ ok: true });
  }

  if (me.role !== 'admin') return bad(res, 'Hanya admin', 403);
  if (act === 'pegawai') {
    const { data } = await db.from('users').select('id,nama,username,aktif,foto,role').eq('role', 'petani').order('id');
    return res.json(data || []);
  }
  if (act === 'permintaan') {
    const { data } = await db.from('reset_requests').select('*').order('id', { ascending: false });
    return res.json(data || []);
  }
  if (act === 'reset') {
    if (!POST) return res.status(405).end();
    if (!b.password || b.password.length < 6) return bad(res, 'Sandi minimal 6 karakter');
    const { data: r } = await db.from('reset_requests').select('*').eq('id', b.id).single();
    if (!r) return bad(res, 'Permintaan tidak ditemukan', 404);
    await db.from('users').update({ password_hash: await bcrypt.hash(b.password, 10) }).eq('username', r.username);
    await db.from('reset_requests').update({ status: 'Selesai' }).eq('id', b.id);
    await logAkt(me.nama, 'akun', 'Mereset sandi ' + r.username);
    return res.json({ ok: true });
  }
  if (act === 'aktif') {
    if (!POST) return res.status(405).end();
    const { data: u } = await db.from('users').select('aktif,nama').eq('id', b.id).single();
    if (!u) return bad(res, 'Akun tidak ditemukan', 404);
    await db.from('users').update({ aktif: !u.aktif }).eq('id', b.id);
    await logAkt(me.nama, 'akun', (u.aktif ? 'Menonaktifkan ' : 'Mengaktifkan ') + u.nama);
    return res.json({ ok: true });
  }
  return bad(res, 'Aksi tidak dikenal', 404);
}
