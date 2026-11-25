# Coolify'da staging'ni sozlash (ega uchun qadam-baqadam)

> Bu yerdagi qadamlarni Coolify panelida o'zingiz bajarasiz. Boshqa loyihalarning birorta resursiga tegilmaydi: hamma narsa yangi **travel-buddy** loyihasi ichida yaratiladi.
> Coolify interfeysidagi nomlar versiyaga qarab biroz farq qilishi mumkin. Biror tugmani topa olmasangiz, skrinshot yuboring.

Image'lar har safar `main` ga push qilinganda GitHub Actions'da avtomatik yig'iladi:

- `ghcr.io/elmun-technologies/travel-buddy-web:staging`
- `ghcr.io/elmun-technologies/travel-buddy-worker:staging`

---

## 1-qadam. Serverga GHCR'dan image tortish ruxsati (bir marta)

Image'lar shaxsiy (private). Server ularni yuklab olishi uchun **faqat o'qish huquqi** bor token kerak.

1. GitHub → Settings → Developer settings → Personal access tokens → **Tokens (classic)** → Generate new token.
   - Nomi: `coolify-ghcr-read`. Muddati: 1 yil.
   - Faqat bitta belgi qo'ying: **`read:packages`**. Boshqa hech narsa belgilanmasin.
2. Serverga SSH orqali kiring va quyidagini yozing (token so'ralganda uni joylang, ekranda ko'rinmaydi):
   ```bash
   docker login ghcr.io -u <github-login>
   ```
   Bu buyruq serverdagi Docker sozlamalariga faqat yangi kirish ma'lumotini qo'shadi, boshqa loyihalarga ta'sir qilmaydi.
3. Tokenni hech kimga yubormang, chatga ham yozmang.

## 2-qadam. Loyiha va muhit

Coolify → **Projects** → **+ Add** → nomi `travel-buddy`. Ichida `staging` muhitini oching (odatda `production` muhiti avtomatik yaratiladi; **+ New Environment** → `staging`).

## 3-qadam. PostgreSQL (alohida resurs)

`travel-buddy / staging` → **+ New Resource** → **Databases** → **PostgreSQL** → versiya **16** (image `postgres:16-alpine`).

- Name: `tvb-staging-db`
- **Make it publicly available** — **o'chiq** qolsin (baza internetga ochilmaydi).
- **Custom PostgreSQL Configuration** maydoniga:
  ```
  shared_buffers = 128MB
  max_connections = 50
  ```
- **Resource Limits** → Memory: `512m`.
- **Start** tugmasini bosing. Keyin **Postgres URL (internal)** qiymatini nusxa qiling: u keyingi qadamlarda `DATABASE_URL` sifatida kerak bo'ladi. Uni chatga yozmang.

## 4-qadam. Worker (birinchi bo'lib ishga tushadi)

**+ New Resource** → **Docker Image** → `ghcr.io/elmun-technologies/travel-buddy-worker:staging`

- Name: `tvb-staging-worker`. Domen **qo'yilmaydi**, port kerak emas.
- **Environment Variables**:
  | Kalit            | Qiymat                   |
  | ---------------- | ------------------------ |
  | `DATABASE_URL`   | 3-qadamdagi internal URL |
  | `RUN_MIGRATIONS` | `true`                   |
  | `APP_ENV`        | `staging`                |
- **Resource Limits** → Memory: `384m`.
- **Deploy**. Logs bo'limida `migrations applied` va `worker started` yozuvlari chiqishi kerak.

## 5-qadam. Web

**+ New Resource** → **Docker Image** → `ghcr.io/elmun-technologies/travel-buddy-web:staging`

- Name: `tvb-staging-web`. **Ports Exposes**: `3000`.
- **Domains**: Coolify bergan vaqtinchalik `sslip.io` manzilini qoldiring (**Generate Domain** tugmasi).
- **Environment Variables**:
  | Kalit          | Qiymat                   |
  | -------------- | ------------------------ |
  | `DATABASE_URL` | 3-qadamdagi internal URL |
  | `APP_ENV`      | `staging`                |
- **Health Check**: yoqing → Path `/api/health`, Port `3000`.
- **Resource Limits** → Memory: `768m`.
- **Deploy**. Keyin sslip.io manzilini oching: `/uz` landing sahifasi ochilishi kerak.

Yangi versiya chiqqanda: GitHub Actions yashil bo'lgach, avval worker'da, keyin web'da **Redeploy** tugmasini bosing. Keyinroq buni avtomatlashtirish mumkin: Coolify'da faqat deploy huquqi bor token yaratib, uni GitHub Secrets'ga `COOLIFY_TOKEN` nomi bilan o'zingiz qo'shasiz. Bu majburiy emas.

## 6-qadam. Bazaning kunlik zaxira nusxasi

Fayllar omborining (S3 bucket) tayyor bo'lishini kutadi: [seaweedfs-bucket.md](seaweedfs-bucket.md) ga qarang.

1. Coolify → **Storages** (yoki **S3 Storages**) → **+ Add**: endpoint, bucket, access key va secret key. Ular SeaweedFS bo'yicha qadamdan keyin ma'lum bo'ladi. **Validate** tugmasini bosing.
2. `tvb-staging-db` → **Backups** → **+ Add**:
   - Frequency: `0 3 * * *` (har kuni Toshkent vaqti bilan 08:00 da; server UTC vaqtida ishlaydi).
   - **Save to S3**: yoqing va 1-punktda qo'shilgan storage'ni tanlang.
   - Saqlash muddati: 7 nusxa.
3. **Backup Now** tugmasini bosib bir marta sinang. Natijani menga ayting.

## 7-qadam. Menga yuboradigan narsalar

- sslip.io manzili;
- worker logining birinchi 5 qatori;
- serverda RAM holati, deploy'dan keyin:
  ```bash
  free -h; docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}" | grep -E "NAME|tvb|travel"
  ```
