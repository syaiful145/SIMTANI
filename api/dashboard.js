import { db } from '../lib/supa.js';
import { requireUser } from '../lib/auth.js';
const WIB = s => s ? new Date(new Date(s).getTime() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ') : s;
export default async function handler(req, res) {
  if (!requireUser(req, res)) return;
  const day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  const [tn, pn, st, pa, jd, ak] = await Promise.all([
    db.from('tanaman').select('jenis,status'),
    db.from('panen').select('id', { count: 'exact', head: true }),
    db.from('stok').select('nama,kategori,jumlah,minimal,satuan'),
    db.from('tanaman').select('id,nama').eq('status', 'siap_panen'),
    db.from('penyiraman').select('id,status,jadwal,tanaman(nama)').gte('jadwal', day + 'T00:00:00+07:00').lte('jadwal', day + 'T23:59:59+07:00').order('jadwal'),
    db.from('aktivitas').select('deskripsi,waktu').order('id', { ascending: false }).limit(8),
  ]);
  const T = tn.data || [], S = st.data || [];
  res.json({
    total_jenis: new Set(T.map(x => x.jenis).filter(Boolean)).size,
    sedang_ditanam: T.filter(x => x.status !== 'dipanen').length,
    stok_bibit: S.filter(x => x.kategori === 'bibit').reduce((a, x) => a + Number(x.jumlah || 0), 0),
    total_panen: pn.count || 0,
    jadwal_hari_ini: (jd.data || []).map(j => ({ id: j.id, status: j.status, jadwal: WIB(j.jadwal), nama_tanaman: j.tanaman?.nama || '' })),
    stok_menipis: S.filter(x => Number(x.jumlah) <= Number(x.minimal)),
    siap_panen: pa.data || [],
    aktivitas: (ak.data || []).map(a => ({ deskripsi: a.deskripsi, waktu: WIB(a.waktu) })),
  });
}
