# SIMTANI (Vercel + Supabase)

## 1. Supabase
1. Buat project baru di supabase.com.
2. Buka **SQL Editor**, tempel isi `supabase.sql`, lalu jalankan.
3. Buka **Project Settings > API**. Salin **Project URL** dan **service_role** key.

## 2. GitHub
1. Buat repository baru, misalnya `simtani`.
2. Upload semua isi folder ini ke repository (jangan upload `.env`).

## 3. Vercel
1. Klik **Add New > Project**, lalu pilih repository `simtani`. Framework: **Other**.
2. Di **Environment Variables**, isi:
   - `SUPABASE_URL` = Project URL dari Supabase
   - `SUPABASE_SERVICE_KEY` = service_role key dari Supabase
   - `SESSION_SECRET` = string acak panjang, misalnya 40 karakter huruf dan angka
3. Klik **Deploy**.

## 4. Login awal
- Admin: `admin` / `admin123`, pilih peran Admin
- Pegawai: `petani` / `petani123`, pilih peran Petani

Ganti sandi setelah login pertama lewat menu **Profil Saya**.

## Catatan
- `service_role` key hanya boleh ada di Environment Variables, jangan di kode.
- Kalau mengubah nama tabel atau kolom di Supabase, sesuaikan juga file di folder `api/`.
