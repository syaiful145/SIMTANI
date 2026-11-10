-- SIMTANI untuk Supabase. Jalankan seluruh isi file ini di SQL Editor Supabase.
create extension if not exists pgcrypto;

create table if not exists users (
  id bigint generated always as identity primary key,
  username text unique not null,
  password_hash text not null,
  nama text not null,
  role text not null default 'petani' check (role in ('admin','petani')),
  aktif boolean not null default true,
  foto text
);
create table if not exists tanaman (
  id bigint generated always as identity primary key,
  nama text not null, jenis text, kategori text, tanggal_tanam date,
  jumlah int default 0, lokasi text,
  status text default 'bibit' check (status in ('bibit','tumbuh','berbunga','siap_panen','dipanen')),
  dicatat_oleh text
);
create table if not exists penyiraman (
  id bigint generated always as identity primary key,
  tanaman_id bigint not null references tanaman(id) on delete cascade,
  jadwal timestamptz not null, frekuensi_hari int default 0,
  status text default 'belum' check (status in ('belum','sudah')),
  disiram_at timestamptz, catatan text
);
create table if not exists stok (
  id bigint generated always as identity primary key,
  nama text not null, kategori text not null check (kategori in ('bibit','pupuk','perlengkapan')),
  satuan text, jumlah int default 0, minimal int default 5
);
create table if not exists stok_mutasi (
  id bigint generated always as identity primary key,
  stok_id bigint not null references stok(id) on delete cascade,
  tipe text not null check (tipe in ('masuk','keluar')), jumlah int not null,
  tanggal date not null, keterangan text, dicatat_oleh text
);
create table if not exists penanaman (
  id bigint generated always as identity primary key,
  tanaman_id bigint not null references tanaman(id) on delete cascade,
  tanggal date not null, jumlah_bibit int default 0, lokasi text, kondisi text,
  perkembangan text, dicatat_oleh text
);
create table if not exists panen (
  id bigint generated always as identity primary key,
  tanaman_id bigint not null references tanaman(id) on delete cascade,
  tanggal date not null, jumlah_hasil numeric(10,2) default 0, satuan text,
  kondisi text check (kondisi in ('baik','sedang','buruk')), catatan text, dicatat_oleh text
);
create table if not exists aktivitas (
  id bigint generated always as identity primary key,
  pengguna text, jenis text, deskripsi text, waktu timestamptz default now()
);
create table if not exists reset_requests (
  id bigint generated always as identity primary key,
  username text not null, nama text, status text default 'Menunggu',
  tgl timestamptz default now()
);

-- Akses hanya lewat server (service key). Kunci anon tidak bisa membaca data.
alter table users enable row level security;
alter table tanaman enable row level security;
alter table penyiraman enable row level security;
alter table stok enable row level security;
alter table stok_mutasi enable row level security;
alter table penanaman enable row level security;
alter table panen enable row level security;
alter table aktivitas enable row level security;
alter table reset_requests enable row level security;

-- Akun awal (ganti sandi setelah login pertama)
insert into users (username, password_hash, nama, role) values
  ('admin',  crypt('admin123',  gen_salt('bf')), 'Administrator',    'admin'),
  ('petani', crypt('petani123', gen_salt('bf')), 'Petani Lapangan', 'petani')
on conflict (username) do nothing;
