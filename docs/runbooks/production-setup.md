# Production'ni birinchi marta sozlash (ega uchun, qadam-baqadam)

> Staging allaqachon ishlayapti; production uning nusxasi, lekin **alohida** baza, **alohida** bot va **alohida** kalitlar bilan. Boshqa loyihalarning resurslariga tegilmaydi.
> Har bir qadamdan keyin kichik tekshiruv bor. Bir joyda tiqilib qolsangiz — skrinshot yuboring.

## 0. Nima kerak (tayyorlab qo'ying)

| Narsa                                                    | Qayerdan                           | Eslatma                                                       |
| -------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| Domen (masalan `sayohatdosh.uz`)                         | domen sotuvchi                     | A-yozuv serverning IP'siga. DNS'ni faqat ega o'zgartiradi     |
| Yangi Telegram bot (production uchun)                    | @BotFather → `/newbot`             | Token = maxfiy. Staging boti bilan **bir xil bo'lmasin**      |
| Sentry DSN                                               | sentry.io                          | `docs/runbooks/env.md`                                        |
| PostHog kaliti (ixtiyoriy, lekin reklamadan oldin kerak) | posthog.com (EU)                   | `docs/runbooks/analytics.md`                                  |
| Backup uchun **server tashqarisidagi** S3                | Hetzner Object Storage yoki boshqa | Hozirgi backup shu serverda — production uchun yetmaydi       |
| Yuridik nom / manzil / support pochta va Telegram        | siz                                | Hujjat sahifalarida chiqadi (pastdagi `LEGAL_*`, `SUPPORT_*`) |

## 1. GitHub

Repo → Settings → Secrets and variables → Actions → **Variables**:

| Nomi                     | Qiymat                                                                            |
| ------------------------ | --------------------------------------------------------------------------------- |
| `APP_NAME`               | brend nomi (hozirgi yoki yangi)                                                   |
| `APP_URL`                | staging manzili (`https://tb-staging.sof-expo.com`)                               |
| `APP_URL_PRODUCTION`     | production manzili (`https://<domen>`)                                            |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (production uchun alohida bo'lsa, `NEXT_PUBLIC_SENTRY_DSN_PRODUCTION`) |

Secrets: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` allaqachon bor (o'zgartirmang).

## 2. Production image

GitHub → **Actions** → **release** → **Run workflow**. 5–8 daqiqada `ghcr.io/elmun-technologies/travel-buddy-web:production` va `...-worker:production` tayyor bo'ladi. (Oldingi qadamlardagi `docker login ghcr.io` serverda qilingan bo'lishi kerak: `docs/runbooks/coolify-staging.md`, 1-qadam. Token egasi — organization `Elmun-Technologies`; `read:packages` huquqi bilan.)

## 3. Coolify: yangi muhit va baza

1. Coolify → `travel-buddy` loyihasi → **production** muhiti.
2. **+ New Resource → Databases → PostgreSQL 16** → nomi `tvb-production-db`. _Publicly available_ — **o'chiq**. Custom config: `shared_buffers = 128MB`, `max_connections = 50`. Memory limit `512m`. Start.
3. Internal URL'ni nusxalang (chatga yozmang).
4. **Backups** → kuniga 1 marta (`0 3 * * *`) → **server tashqarisidagi** S3'ga. **Backup Now** bosib sinang va `docs/runbooks/restore.md` bo'yicha tiklashni production nusxasida ham bir marta sinang.

## 4. Coolify: worker (birinchi)

**+ New Resource → Docker Image** → `ghcr.io/elmun-technologies/travel-buddy-worker:production`. Domen yo'q. Memory `384m`.

Environment Variables:

| Kalit                | Qiymat                                                           |
| -------------------- | ---------------------------------------------------------------- |
| `DATABASE_URL`       | 3-qadamdagi internal URL                                         |
| `APP_ENV`            | `production` (**aniq shunday**; bo'lmasa worker ishga tushmaydi) |
| `APP_URL`            | `https://<domen>`                                                |
| `RUN_MIGRATIONS`     | `false` (production'da migratsiya qo'lda: `deploy.md`)           |
| `TELEGRAM_BOT_TOKEN` | production bot tokeni                                            |
| `SENTRY_DSN`         | Sentry DSN                                                       |
| `POSTHOG_KEY`        | PostHog kaliti (bo'lsa)                                          |
| `CREATOR_ENABLED`    | **qo'ymang** (1M Safar yopiq qoladi)                             |

**Birinchi ishga tushirishdan oldin** migratsiya: Coolify → worker → **Terminal** → `node dist/migrate.mjs` → `migrations applied`. Keyin **Deploy**; logda `worker started` va `bot @<nom> polling` chiqadi.

## 5. Coolify: web

**+ New Resource → Docker Image** → `ghcr.io/elmun-technologies/travel-buddy-web:production`. Port `3000`. Domain: `https://<domen>`. Health check: `/api/health` (port 3000). Memory `768m`.

| Kalit                                                                | Qiymat                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------- |
| `DATABASE_URL`                                                       | internal URL                                                    |
| `APP_ENV`                                                            | `production`                                                    |
| `APP_URL`                                                            | `https://<domen>`                                               |
| `TELEGRAM_BOT_TOKEN`                                                 | production bot tokeni                                           |
| `TELEGRAM_BOT_USERNAME`                                              | botning nomi, `@`siz                                            |
| `ADMIN_TELEGRAM_IDS`                                                 | adminlarning Telegram ID'lari, vergul bilan (`add-admin.md`)    |
| `SENTRY_DSN`                                                         | Sentry DSN                                                      |
| `POSTHOG_KEY`                                                        | PostHog kaliti (bo'lsa)                                         |
| `TRAVELPAYOUTS_MARKER`                                               | Aviasales hamkor belgisi (bo'lsa)                               |
| `LEGAL_ENTITY`, `LEGAL_ADDRESS`, `SUPPORT_EMAIL`, `SUPPORT_TELEGRAM` | hujjat va yordam sahifalari uchun (bo'lmaganini tashlab keting) |

Deploy. Tekshiruv: `https://<domen>/api/health` → `{"status":"ok","env":"production"}`. Agar `env` boshqa so'z chiqsa — `APP_ENV` xato, to'xtating va tuzating.

## 6. BotFather (production boti)

1. `/setdomain` → botni tanlang → `<domen>` (Telegram bilan kirish tugmasi uchun).
2. **Main Mini App**: `/mybots` → bot → **Bot Settings → Configure Mini App** (yoki **Menu Button**) → URL `https://<domen>/uz/tg`. Bu `t.me/<bot>?startapp=...` havolalari (safar ulashish, reklama) ilovani ochishi uchun **shart**.
3. `/setdescription`, `/setabouttext`, `/setuserpic` — ixtiyoriy.

## 7. Boshlashdan oldin tekshiruv (10 daqiqa)

1. Botga `/start` → xabar va tugma keladi.
2. Mini App ochiladi → profil → telefon tasdig'i → safar ochish → ulashish havolasi Telegram'da chiroyli ko'rinadi.
3. Ikkinchi akkaunt bilan qo'shilish so'rovi → qabul → guruh xonasi.
4. `https://<domen>/uz/terms`, `/privacy`, `/safety`, `/support` ochiladi.
5. `https://<domen>/robots.txt` — `Allow: /` va sitemap; `https://<domen>/sitemap.xml` ochiladi.
6. Sentry'da yangi xato yo'q; PostHog'da `pageview` kelyapti.
7. Server RAM: `docker stats --no-stream` — boshqa loyihalar `Up`, web ≤ 768 MB, worker ≤ 384 MB.

## 8. Production'da TEST ma'lumot yo'q

Production'da seed ishlamaydi (`APP_ENV=production`), `/uz/dev/ui` yopiq. Soxta foydalanuvchi, safar va sharh yaratilmaydi.
