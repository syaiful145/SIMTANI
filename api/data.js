import { db, logAkt } from '../lib/supa.js';
import { requireUser } from '../lib/auth.js';
const T = {
  tanaman: { cols: ['nama','jenis','kategori','tanggal_tanam','jumlah','lokasi','status'], tgl: 'tanggal_tanam', ord: 'id', label: 'data tanaman' },
  penyiraman: { cols: ['tanaman_id','jadwal','frekuensi_hari','status','disiram_at','catatan'], tgl: 'jadwal', ts: 1, ord: 'jadwal', label: 'jadwal penyiraman', join: 'tanaman', jn: 'nama_tanaman' },
  stok: { cols: ['nama','kategori','satuan','jumlah','minimal'], tgl: null, ord: 'id', label: 'stok' },
  stok_mutasi: { cols: ['stok_id','tipe','jumlah','tanggal','keterangan'], tgl: 'tanggal', ord: 'id', label: 'mutasi stok', join: 'stok', jn: 'nama_stok' },
  penanaman: { cols: ['tanaman_id','tanggal','jumlah_bibit','lokasi','kondisi','perkembangan'], tgl: 'tanggal', ord: 'id', label: 'penanaman', join: 'tanaman', jn: 'nama_tanaman' },
  panen: { cols: ['tanaman_id','tanggal','jumlah_hasil','satuan','kondisi','catatan'], tgl: 'tanggal', ord: 'id', label: 'panen', join: 'tanaman', jn: 'nama_tanaman' },
};
const HAK = { tambah: ['penyiraman','penanaman','panen','stok_mutasi'], edit: ['penyiraman','penanaman','panen'] };
const can = (role, a, t) => role === 'admin' || (HAK[a] || []).includes(t);
const bad = (res, e, c = 400) => res.status(c).json({ error: e?.message || e });
const fixJ = j => (j && !/([zZ]|[+-]\d\d:?\d\d)$/.test(j)) ? j.replace(' ', 'T') + '+07:00' : j;
const WIB = s => s ? new Date(new Date(s).getTime() + 7 * 3600e3).toISOString().slice(0, 19).replace('T', ' ') : s;

async function selesaiSiram(id, row) {
  await db.from('penyiraman').update({ disiram_at: new Date().toISOString() }).eq('id', id).is('disiram_at', null);
  const f = Number(row.frekuensi_hari || 0);
  if (f > 0) {
    const next = new Date(new Date(row.jadwal).getTime() + f * 864e5).toISOString();
    await db.from('penyiraman').insert({ tanaman_id: row.tanaman_id, jadwal: next, frekuensi_hari: f, status: 'belum' });
  }
}

export default async function handler(req, res) {
  const me = requireUser(req, res); if (!me) return;
  const act = req.query.act, t = req.query.t, cfg = T[t];
  if (!cfg) return bad(res, 'Tabel tidak valid');
  const body = req.body || {};

  if (act === 'list') {
    const sel = cfg.join ? `*, ${cfg.join}(nama)` : '*';
    let q = db.from(t).select(sel).order(cfg.ord, { ascending: false });
    if (cfg.tgl) {
      if (req.query.from) q = q.gte(cfg.tgl, cfg.ts ? req.query.from + 'T00:00:00+07:00' : req.query.from);
      if (req.query.to) q = q.lte(cfg.tgl, cfg.ts ? req.query.to + 'T23:59:59+07:00' : req.query.to);
    }
    const { data, error } = await q;
    if (error) return bad(res, error);
    return res.json(data.map(r => {
      const o = { ...r };
      if (cfg.join) { o[cfg.jn] = r[cfg.join]?.nama || ''; delete o[cfg.join]; }
      if (t === 'penyiraman') { o.jadwal = WIB(r.jadwal); o.disiram_at = WIB(r.disiram_at); }
      return o;
    }));
  }

  if (act === 'delete') {
    if (me.role !== 'admin') return bad(res, 'Hanya admin yang dapat menghapus data', 403);
    if (t === 'stok_mutasi') return bad(res, 'Mutasi stok tidak dapat dihapus');
    const id = Number(body.id);
    const { error } = await db.from(t).delete().eq('id', id);
    if (error) return bad(res, error);
    await logAkt(me.nama, t, `Menghapus ${cfg.label} #${id}`);
    return res.json({ ok: true });
  }

  if (act === 'save') {
    if (!can(me.role, body.id ? 'edit' : 'tambah', t)) return bad(res, 'Peran Anda tidak punya akses untuk ini', 403);
    if (t === 'stok_mutasi' && body.id) return bad(res, 'Mutasi stok tidak dapat diubah');
    const d = {};
    for (const c of cfg.cols) if (c in body) d[c] = body[c] === '' ? null : body[c];
    if (d.jadwal) d.jadwal = fixJ(d.jadwal);
    if (d.disiram_at) d.disiram_at = fixJ(d.disiram_at);
    if (!Object.keys(d).length) return bad(res, 'Data kosong');

    if (body.id) {
      const id = Number(body.id);
      let old = null;
      if (t === 'penyiraman') old = (await db.from(t).select('status,frekuensi_hari,jadwal,tanaman_id').eq('id', id).single()).data;
      const { error } = await db.from(t).update(d).eq('id', id);
      if (error) return bad(res, error);
      if (t === 'penyiraman' && d.status === 'sudah' && old?.status !== 'sudah') await selesaiSiram(id, old);
      await logAkt(me.nama, t, `Memperbarui ${cfg.label} #${id}`);
      return res.json({ ok: true, id });
    }

    if (t === 'penanaman' || t === 'panen' || t === 'stok_mutasi') d.dicatat_oleh = me.nama;
    let cur = null, delta = 0;
    if (t === 'stok_mutasi') {
      cur = (await db.from('stok').select('jumlah').eq('id', d.stok_id).single()).data;
      if (!cur) return bad(res, 'Barang tidak ditemukan');
      delta = d.tipe === 'masuk' ? Number(d.jumlah) : -Number(d.jumlah);
      if (Number(cur.jumlah) + delta < 0) return bad(res, `Stok tidak mencukupi (sisa ${cur.jumlah})`);
    }
    let pakai = null;
    if (t === 'penanaman' && Number(d.jumlah_bibit) > 0 && body.stok_id) {
      const s = (await db.from('stok').select('jumlah').eq('id', body.stok_id).single()).data;
      if (!s) return bad(res, 'Bibit tidak ditemukan');
      if (Number(s.jumlah) < Number(d.jumlah_bibit)) return bad(res, `Stok bibit tidak mencukupi (sisa ${s.jumlah})`);
      pakai = { id: body.stok_id, jumlah: Number(s.jumlah) };
    }
    const { data: ins, error } = await db.from(t).insert(d).select('id').single();
    if (error) return bad(res, error);
    if (cur) await db.from('stok').update({ jumlah: Number(cur.jumlah) + delta }).eq('id', d.stok_id);
    if (pakai) {
      await db.from('stok').update({ jumlah: pakai.jumlah - Number(d.jumlah_bibit) }).eq('id', pakai.id);
      await db.from('stok_mutasi').insert({ stok_id: pakai.id, tipe: 'keluar', jumlah: Number(d.jumlah_bibit), tanggal: d.tanggal, keterangan: 'Ditanam di ' + (d.lokasi || '-'), dicatat_oleh: me.nama });
    }
    await logAkt(me.nama, t, `Menambahkan ${cfg.label} #${ins.id}`);
    return res.json({ ok: true, id: ins.id });
  }

  return bad(res, 'Aksi tidak dikenal', 404);
}
