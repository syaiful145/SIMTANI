const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loc = (d = new Date()) => new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 19);
const STATUS = ['bibit', 'tumbuh', 'berbunga', 'siap_panen', 'dipanen'];
let ROLE = 'admin';
const HAK = { petani: { tambah: ['penyiraman', 'penanaman', 'panen', 'stok_mutasi'], edit: ['penyiraman', 'penanaman', 'panen'] } };
function can(a, t) { return ROLE === 'admin' || (HAK.petani[a] || []).includes(t); }

// Definisi modul: kolom tabel, field form [key, label, tipe, wajib, opsi]
const MOD = {
  tanaman: { judul: 'Data Tanaman', ikon: '🌱', tgl: 1,
    kolom: [['nama','Nama'],['jenis','Jenis'],['kategori','Kategori'],['tanggal_tanam','Tgl Tanam'],['jumlah','Jumlah'],['lokasi','Lokasi'],['status','Status']],
    form: [['nama','Nama Tanaman','text',1],['jenis','Jenis Tanaman','text'],
      ['kategori','Kategori','select',0,['Sayuran','Buah','Padi & Palawija','Rempah','Tanaman Hias','Lainnya']],
      ['tanggal_tanam','Tanggal Mulai Ditanam','date'],['jumlah','Jumlah Tanaman','number'],
      ['lokasi','Lokasi / Area','text'],['status','Status Pertumbuhan','select',0,STATUS]] },
  penyiraman: { judul: 'Jadwal Penyiraman', ikon: '💧', tgl: 1, quick: 1,
    kolom: [['nama_tanaman','Tanaman'],['jadwal','Jadwal'],['frekuensi_hari','Tiap (hari)'],['status','Status'],['disiram_at','Waktu Disiram']],
    form: [['tanaman_id','Tanaman','ref:tanaman',1],['jadwal','Tanggal & Waktu','datetime',1],
      ['frekuensi_hari','Frekuensi (hari, 0 = sekali)','number'],['status','Status','select',0,['belum','sudah']],['catatan','Catatan','text']] },
  stok: { judul: 'Manajemen Stok', ikon: '📦', warn: 1,
    kolom: [['nama','Nama'],['kategori','Kategori'],['jumlah','Stok'],['satuan','Satuan'],['minimal','Min.']],
    form: [['nama','Nama Barang','text',1],['kategori','Kategori','select',1,['bibit','pupuk','perlengkapan']],
      ['satuan','Satuan','text'],['jumlah','Jumlah Awal','number'],['minimal','Batas Minimal','number']] },
  stok_mutasi: { judul: 'Stok Masuk & Keluar', ikon: '🔄', tgl: 1, noEdit: 1,
    kolom: [['nama_stok','Barang'],['tipe','Tipe'],['jumlah','Jumlah'],['tanggal','Tanggal'],['keterangan','Keterangan']],
    form: [['stok_id','Barang','ref:stok',1],['tipe','Tipe','select',1,['masuk','keluar']],
      ['jumlah','Jumlah','number',1],['tanggal','Tanggal','date',1],['keterangan','Keterangan','text']] },
  penanaman: { judul: 'Data Penanaman', ikon: '🌾', tgl: 1,
    kolom: [['nama_tanaman','Tanaman'],['tanggal','Tanggal'],['jumlah_bibit','Jml Bibit'],['lokasi','Lokasi'],['kondisi','Kondisi'],['perkembangan','Perkembangan']],
    form: [['tanaman_id','Tanaman','ref:tanaman',1],['stok_id','Bibit dari Stok','ref:stok',0],['tanggal','Tanggal Tanam','date',1],['jumlah_bibit','Jumlah Bibit','number'],
      ['lokasi','Lokasi','text'],['kondisi','Kondisi','select',0,['Baik','Cukup','Kurang Baik']],['perkembangan','Catatan Perkembangan','text']] },
  panen: { judul: 'Data Panen', ikon: '🧺', tgl: 1,
    kolom: [['nama_tanaman','Tanaman'],['tanggal','Tanggal'],['jumlah_hasil','Hasil'],['satuan','Satuan'],['kondisi','Kondisi'],['catatan','Catatan']],
    form: [['tanaman_id','Tanaman','ref:tanaman',1],['tanggal','Tanggal Panen','date',1],['jumlah_hasil','Jumlah Hasil','number'],
      ['satuan','Satuan','text'],['kondisi','Kondisi Hasil','select',0,['baik','sedang','buruk']],['catatan','Catatan','text']] },
};
const MENU = [['dashboard','🏠','Dashboard'],['tanaman','🌱','Data Tanaman'],['penyiraman','💧','Jadwal Penyiraman'],
  ['stok','📦','Manajemen Stok'],['stok_mutasi','🔄','Stok Masuk/Keluar'],['penanaman','🌾','Data Penanaman'],
  ['panen','🧺','Data Panen'],['laporan','📊','Laporan'],['profil','👤','Profil Saya']];

const CUR = { key: null, rows: [], lap: false };
const cache = {};

async function req(act, params = {}, body = null) {
  const qs = new URLSearchParams({ act, ...params });
  const AKUN = ['daftar','lupa','profil','ganti','foto','pegawai','permintaan','reset','aktif'];
  const URLS = { login: '/api/login', logout: '/api/logout', me: '/api/me', dashboard: '/api/dashboard' };
  const url = URLS[act] || ((AKUN.includes(act) ? '/api/akun?' : '/api/data?') + qs);
  const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : null });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && act !== 'login') { loginView(); throw new Error('Silakan login terlebih dahulu'); }
  if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan');
  return d;
}
function toast(m, err) {
  const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : '');
  clearTimeout(t._t); t._t = setTimeout(() => t.className = 'toast', 2600);
}
function loginView() { $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); }
function appView() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#menu').innerHTML = (ROLE === 'admin' ? [...MENU, ['pegawai','👥','Pegawai'], ['permintaan','🔑','Permintaan Sandi']] : MENU).map(([k, i, l]) => `<a href="#${k}" data-k="${k}">${i} ${l}</a>`).join('');
  route();
}
function route() {
  const k = (location.hash || '#dashboard').slice(1) || 'dashboard';
  document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('aktif', a.dataset.k === k));
  CUR.key = k;
  const run = k === 'dashboard' ? dashboard : k === 'laporan' ? laporan : k === 'profil' ? () => halamanProfil() : k === 'pegawai' ? halamanPegawai : k === 'permintaan' ? halamanPermintaan : () => modul(k, $('#main'), false);
  run().catch(e => toast(e.message, true));
}

async function dashboard() {
  const d = await req('dashboard');
  const kartu = (ik, l, v) => `<div class="card"><div class="ikon">${ik}</div><div><small>${l}</small><b>${v}</b></div></div>`;
  $('#main').innerHTML = `<h2>🏠 Dashboard</h2>
  <div class="cards">${kartu('🌿','Total Jenis Tanaman',d.total_jenis)}${kartu('🌱','Sedang Ditanam',d.sedang_ditanam)}${kartu('📦','Stok Bibit',d.stok_bibit)}${kartu('🧺','Sudah Dipanen',d.total_panen)}</div>
  <div class="grid2">
    <section class="panel"><h3>💧 Jadwal Penyiraman Hari Ini</h3><ul class="list">
      ${d.jadwal_hari_ini.map(j => `<li><b>${esc(j.nama_tanaman)}</b> pukul ${esc(j.jadwal.slice(11,16))} <span class="badge">${j.status === 'sudah' ? 'Sudah disiram' : 'Belum disiram'}</span></li>`).join('') || '<li class="kosong">Tidak ada jadwal hari ini</li>'}
    </ul></section>
    <section class="panel"><h3>⚠️ Stok Hampir Habis</h3><ul class="list">
      ${d.stok_menipis.map(s => `<li>${esc(s.nama)}: sisa <b>${s.jumlah} ${esc(s.satuan || '')}</b></li>`).join('') || '<li class="kosong">Semua stok aman</li>'}
    </ul></section>
  </div>
  <section class="panel"><h3>🕒 Aktivitas Terbaru</h3><ul class="list">
    ${d.aktivitas.map(a => `<li>${esc(a.deskripsi)}<small>${esc(a.waktu)}</small></li>`).join('') || '<li class="kosong">Belum ada aktivitas</li>'}
  </ul></section>`;
  // Pengingat: notifikasi browser saat halaman dibuka
  const belum = d.jadwal_hari_ini.filter(j => j.status === 'belum').length;
  if ('Notification' in window) {
    if (Notification.permission === 'granted' && belum) new Notification('SIMTANI', { body: `${belum} tanaman perlu disiram hari ini` });
    else if (Notification.permission === 'default') Notification.requestPermission();
  }
}

async function laporan() {
  $('#main').innerHTML = `<h2>📊 Laporan</h2>
  <div class="toolbar"><select id="lapPilih">${Object.keys(MOD).map(k => `<option value="${k}">${MOD[k].judul}</option>`).join('')}</select></div>
  <div id="isi"></div>`;
  $('#lapPilih').onchange = e => modul(e.target.value, $('#isi'), true);
  await modul('tanaman', $('#isi'), true);
}

async function modul(key, box, lap) {
  const m = MOD[key];
  CUR.key = key; CUR.lap = lap;
  box.innerHTML = `<div class="page-head"><h2>${m.ikon} ${m.judul}</h2><div class="actions">${lap || !can('tambah', key) ? '' : '<button class="btn" id="bTambah">+ Tambah</button>'}</div></div>
  <div class="toolbar"><input id="cari" placeholder="🔎 Cari data...">
    ${m.tgl ? '<input type="date" id="dari" title="Dari tanggal"><input type="date" id="sampai" title="Sampai tanggal"><button class="btn-sec" id="bFilter">Filter</button>' : ''}
    <button class="btn-sec" id="bCetak">🖨️ Cetak</button><button class="btn-sec" id="bCsv">⬇️ Ekspor CSV</button></div>
  <div class="tbl-wrap"><table id="tbl"></table></div>`;
  $('#cari').oninput = tampil;
  $('#bCetak').onclick = () => window.print();
  $('#bCsv').onclick = ekspor;
  if (m.tgl) $('#bFilter').onclick = muat;
  const bt = $('#bTambah'); if (bt) bt.onclick = () => formModal(key, null);
  $('#tbl').onclick = aksiTabel;
  await muat();
}

async function muat() {
  const p = { t: CUR.key };
  const d = $('#dari')?.value, s = $('#sampai')?.value;
  if (d) p.from = d; if (s) p.to = s;
  try { CUR.rows = await req('list', p); tampil(); } catch (e) { toast(e.message, true); }
}

function sel(k, v) {
  if (v === null || v === undefined || v === '') return '-';
  if (k === 'status' || k === 'tipe') return `<span class="badge">${esc(v)}</span>`;
  return esc(v);
}
function tampil() {
  const m = MOD[CUR.key], q = ($('#cari')?.value || '').toLowerCase();
  const rows = CUR.rows.filter(r => Object.values(r).join(' ').toLowerCase().includes(q));
  $('#tbl').innerHTML = `<thead><tr>${m.kolom.map(k => `<th>${k[1]}</th>`).join('')}${CUR.lap ? '' : '<th>Aksi</th>'}</tr></thead>
  <tbody>${rows.map(r => `<tr class="${m.warn && +r.jumlah <= +r.minimal ? 'warn' : ''}">
    ${m.kolom.map(k => `<td>${sel(k[0], r[k[0]])}</td>`).join('')}
    ${CUR.lap ? '' : `<td class="aksi">${m.quick && r.status === 'belum' ? `<button class="btn-ok" data-q="${r.id}">✓ Sudah</button>` : ''}${m.noEdit || !can('edit', CUR.key) ? '' : `<button class="btn-sec" data-e="${r.id}">Edit</button>`}${m.noEdit || !can('hapus', CUR.key) ? '' : `<button class="btn-del" data-d="${r.id}">Hapus</button>`}</td>`}
  </tr>`).join('') || `<tr><td class="kosong" colspan="9">Belum ada data</td></tr>`}</tbody>`;
}

async function aksiTabel(e) {
  const b = e.target.closest('button'); if (!b) return;
  try {
    if (b.dataset.e) return formModal(CUR.key, CUR.rows.find(x => x.id == b.dataset.e));
    if (b.dataset.q) { await req('save', { t: CUR.key }, { id: b.dataset.q, status: 'sudah' }); toast('Penyiraman dicatat'); }
    if (b.dataset.d) {
      if (!confirm('Hapus data ini?')) return;
      await req('delete', { t: CUR.key }, { id: b.dataset.d }); toast('Data dihapus');
    }
    muat();
  } catch (err) { toast(err.message, true); }
}

function ekspor() {
  const m = MOD[CUR.key];
  const baris = CUR.rows.map(r => m.kolom.map(k => `"${String(r[k[0]] ?? '').replace(/"/g, '""')}"`).join(','));
  const txt = '\uFEFF' + [m.kolom.map(k => k[1]).join(','), ...baris].join('\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([txt], { type: 'text/csv' })), download: `${CUR.key}.csv` });
  a.click();
}

function campo([k, l, t, req, opt], row) {
  let v = row ? row[k] : (t === 'date' ? loc().slice(0, 10) : t === 'datetime' ? loc().slice(0, 16) : '');
  if (row && v != null) { if (t === 'date') v = String(v).slice(0, 10); if (t === 'datetime') v = String(v).replace(' ', 'T').slice(0, 16); }
  v = v ?? '';
  if (t === 'select') return `<select name="${k}">${opt.map(o => `<option ${o == v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  if (t.startsWith('ref:')) return `<select name="${k}">${(cache[t.slice(4)] || []).map(x => `<option value="${x.id}" ${x.id == v ? 'selected' : ''}>${esc(x.nama)}</option>`).join('')}</select>`;
  return `<input name="${k}" type="${t === 'datetime' ? 'datetime-local' : t}" value="${esc(v)}" ${req ? 'required' : ''}>`;
}

async function formModal(key, row) {
  const m = MOD[key];
  for (const f of m.form) if (f[2].startsWith('ref:')) { const r = f[2].slice(4); cache[r] = await req('list', { t: r }); }
  $('#mTitle').textContent = (row ? 'Edit ' : 'Tambah ') + m.judul;
  $('#mForm').innerHTML = m.form.map(f => `<label>${f[1]}${f[3] ? ' *' : ''}${campo(f, row)}</label>`).join('')
    + `<div class="mbtn"><button type="button" class="btn-sec" id="bBatal">Batal</button><button class="btn">Simpan</button></div>`;
  $('#bBatal').onclick = () => $('#modal').classList.add('hidden');
  $('#mForm').onsubmit = async e => {
    e.preventDefault();
    const body = {};
    new FormData(e.target).forEach((v, k) => body[k] = v === '' ? null : v);
    if (body.jadwal) body.jadwal = body.jadwal.replace('T', ' ') + (body.jadwal.length === 16 ? ':00' : '');
    if (row) body.id = row.id;
    try {
      await req('save', { t: key }, body);
      $('#modal').classList.add('hidden'); toast('Data berhasil disimpan'); muat();
    } catch (err) { toast(err.message, true); }
  };
  $('#modal').classList.remove('hidden');
}

// ===== Pengingat: suara & notifikasi =====
const notified = new Set();
function bunyi(nada) {
  try {
    const c = new (window.AudioContext || window.webkitAudioContext)();
    nada.forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = f; o.connect(g); g.connect(c.destination);
      const t = c.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.start(t); o.stop(t + 0.17);
    });
  } catch (e) {}
}
function kirim(judul, isi) {
  toast(isi);
  if ('Notification' in window && Notification.permission === 'granted') new Notification(judul, { body: isi });
}
async function cekPengingat() {
  if ($('#app').classList.contains('hidden')) return;
  try {
    const d = await req('dashboard');
    const now = loc().replace('T', ' ');
    d.jadwal_hari_ini.forEach(j => {
      const key = 's' + j.id + j.jadwal;
      if (j.status === 'belum' && j.jadwal <= now && !notified.has(key)) {
        notified.add(key); bunyi([880]);
        kirim('Waktunya menyiram', j.nama_tanaman + ' perlu disiram sekarang');
      }
    });
    d.siap_panen.forEach(t => {
      const key = 'p' + t.id;
      if (!notified.has(key)) { notified.add(key); bunyi([523, 659, 784]); kirim('Mulai panen', t.nama + ' siap dipanen'); }
    });
  } catch (e) {}
}
setInterval(cekPengingat, 30000);
setTimeout(cekPengingat, 1500);

// Inisialisasi
$('#formLogin').onsubmit = async e => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    const d = await req('login', {}, { username: f.get('username'), password: f.get('password') }); ROLE = d.role;
    $('#loginErr').textContent = ''; appView();
  } catch (err) { $('#loginErr').textContent = err.message; }
};
$('#btnLogout').onclick = async () => { await req('logout', {}, {}).catch(() => {}); location.hash = ''; loginView(); };
window.addEventListener('hashchange', () => { if (!$('#app').classList.contains('hidden')) route(); });
req('me').then(d => { ROLE = d.role; appView(); }).catch(() => {});


// ===== Profil, pegawai, lupa sandi, daftar =====
const BATAL = `<button type="button" class="btn-sec" onclick="$('#modal').classList.add('hidden')">Batal</button>`;
function formPopup(judul, html, onsubmit) {
  $('#mTitle').textContent = judul; $('#mForm').innerHTML = html;
  $('#mForm').onsubmit = async e => { e.preventDefault(); try { await onsubmit(new FormData(e.target)); } catch (err) { toast(err.message, true); } };
  $('#modal').classList.remove('hidden');
}
function openDaftar() {
  formPopup('Daftar Akun Pegawai', `<label>Nama Lengkap<input name="nama" required></label><label>Username<input name="username" required></label><label>Sandi (min. 6 karakter)<input name="password" type="password" minlength="6" required></label><div class="mbtn">${BATAL}<button class="btn">Daftar</button></div><p class="kecil">Akun aktif setelah disetujui admin.</p>`,
    async f => { const d = await req('daftar', {}, Object.fromEntries(f)); $('#modal').classList.add('hidden'); toast(d.pesan); });
}
function openLupa() {
  formPopup('Lupa Sandi', `<label>Username<input name="username" required></label><div class="mbtn">${BATAL}<button class="btn">Kirim Permintaan</button></div><p class="kecil">Admin akan mereset sandi Anda.</p>`,
    async f => { await req('lupa', {}, Object.fromEntries(f)); $('#modal').classList.add('hidden'); toast('Permintaan terkirim ke admin'); });
}
const fileToFoto = file => new Promise((res, rej) => {
  const rd = new FileReader();
  rd.onload = () => { const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'); const s = 160 / Math.max(img.width, img.height);
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.7));
  }; img.onerror = rej; img.src = rd.result; };
  rd.onerror = rej; rd.readAsDataURL(file);
});
async function halamanProfil(id = null) {
  const p = await req('profil', id ? { id } : {});
  const ini = p.nama.split(' ').map(s => s[0] || '').slice(0, 2).join('').toUpperCase();
  $('#main').onclick = null;
  $('#main').innerHTML = `<div class="page-head"><h2>👤 Profil ${id ? esc(p.nama) : 'Saya'}</h2>${id ? '<div class="actions"><button class="btn-sec" id="bKembali">← Kembali</button></div>' : ''}</div>
  <div class="grid2">
    <section class="panel profil-kartu">
      <div class="avatar">${p.foto ? `<img src="${p.foto}" alt="">` : esc(ini)}</div>
      <h3>${esc(p.nama)}</h3>
      <p class="kecil">@${esc(p.username)} · ${p.role === 'admin' ? 'Admin' : 'Pegawai'}</p>
      <p><span class="badge">${p.aktif == 0 ? 'Belum aktif' : 'Aktif'}</span></p>
      <label class="btn-sec upload">Ganti Foto<input type="file" accept="image/*" id="fFoto" hidden></label>
    </section>
    <section class="panel">
      <h3>📊 Ringkasan</h3>
      <p>Penanaman dicatat: <b>${p.jml_penanaman}</b></p>
      <p>Panen dicatat: <b>${p.jml_panen}</b></p>
      <h3 style="margin-top:14px">🕒 Aktivitas Terakhir</h3>
      <ul class="list">${p.aktivitas.map(a => `<li>${esc(a.deskripsi)}<small>${esc(a.waktu)}</small></li>`).join('') || '<li class="kosong">Belum ada aktivitas</li>'}</ul>
    </section>
  </div>
  ${id ? '' : `<section class="panel" style="max-width:420px"><h3>🔒 Ganti Sandi</h3><form id="fSandi"><label>Sandi lama<input name="old" type="password" required></label><label>Sandi baru (min. 6 karakter)<input name="baru" type="password" minlength="6" required></label><button class="btn">Simpan Sandi</button></form></section>`}`;
  if (id) $('#bKembali').onclick = () => { location.hash = '#pegawai'; };
  $('#fFoto').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const foto = await fileToFoto(f); await req('foto', {}, id ? { foto, id } : { foto }); toast('Foto diperbarui'); halamanProfil(id); }
    catch (err) { toast(err.message, true); }
  };
  if (!id) $('#fSandi').onsubmit = async e => {
    e.preventDefault();
    try { await req('ganti', {}, Object.fromEntries(new FormData(e.target))); e.target.reset(); toast('Sandi berhasil diganti'); }
    catch (err) { toast(err.message, true); }
  };
}
async function halamanPegawai() {
  const list = await req('pegawai');
  $('#main').innerHTML = `<div class="page-head"><h2>👥 Pegawai</h2></div><div class="tbl-wrap"><table><thead><tr><th>Nama</th><th>Username</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${list.map(p => `<tr><td>${esc(p.nama)}</td><td>${esc(p.username)}</td><td><span class="badge">${p.aktif == 1 ? 'Aktif' : 'Belum aktif'}</span></td><td class="aksi"><button class="btn-sec" data-profil="${p.id}">Profil</button> <button class="${p.aktif == 1 ? 'btn-sec' : 'btn'}" data-aktif="${p.id}">${p.aktif == 1 ? 'Nonaktifkan' : 'Setujui'}</button></td></tr>`).join('') || '<tr><td colspan="4" class="kosong">Belum ada pegawai</td></tr>'}</tbody></table></div>`;
  $('#main').onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    try {
      if (b.dataset.profil) return halamanProfil(b.dataset.profil);
      if (b.dataset.aktif) { await req('aktif', {}, { id: b.dataset.aktif }); toast('Status akun diperbarui'); halamanPegawai(); }
    } catch (err) { toast(err.message, true); }
  };
}
async function halamanPermintaan() {
  const list = await req('permintaan');
  $('#main').innerHTML = `<div class="page-head"><h2>🔑 Permintaan Reset Sandi</h2></div><div class="tbl-wrap"><table><thead><tr><th>Waktu</th><th>Username</th><th>Nama</th><th>Status</th><th>Reset</th></tr></thead><tbody>${list.map(r => `<tr><td>${esc(r.tgl)}</td><td>${esc(r.username)}</td><td>${esc(r.nama)}</td><td><span class="badge">${esc(r.status)}</span></td><td class="aksi">${r.status === 'Menunggu' ? `<input type="password" minlength="6" placeholder="Sandi baru" id="sb${r.id}"> <button class="btn" data-reset="${r.id}">Reset</button>` : '-'}</td></tr>`).join('') || '<tr><td colspan="5" class="kosong">Belum ada permintaan</td></tr>'}</tbody></table></div>`;
  $('#main').onclick = async e => {
    const b = e.target.closest('button'); if (!b || !b.dataset.reset) return;
    try { await req('reset', {}, { id: b.dataset.reset, password: $('#sb' + b.dataset.reset).value }); toast('Sandi direset'); halamanPermintaan(); }
    catch (err) { toast(err.message, true); }
  };
}
