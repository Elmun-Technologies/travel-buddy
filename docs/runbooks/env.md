# Env o'zgaruvchilari — qayerga va qachon

Qiymatlarni faqat egasi kiritadi. Repo'ga, chatga, logga yozilmaydi.

- **Coolify env** — ishlayotgan konteyner o'qiydi (travel-buddy → staging → web yoki worker → Environment Variables).
- **GitHub Secret** — maxfiy, build vaqtida kerak (repo → Settings → Secrets and variables → Actions → Secrets).
- **GitHub Variable** — maxfiy emas, build vaqtida kerak (o'sha joy → Variables).

| Bosqich | Nomi                                                                                 | Qayerga                           | Nima uchun                                                                                      |
| ------- | ------------------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| 3       | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`                                                 | GitHub **Secret**                 | Deploy'dan keyin ham ochiq turgan sahifalardagi formalar ishlashi uchun                         |
| 3       | `SENTRY_DSN`                                                                         | Coolify: **web** va **worker**    | Server xatolari Sentry'ga                                                                       |
| 3       | `NEXT_PUBLIC_SENTRY_DSN`                                                             | GitHub **Variable** (o'sha DSN)   | Brauzer/Mini App xatolari Sentry'ga                                                             |
| 3       | `APP_ENV` = `staging`                                                                | Coolify: web va worker (bo'lmasa) | Sentry'da muhitni ajratish                                                                      |
| 4b      | `NEXT_PUBLIC_POSTHOG_KEY`                                                            | GitHub Variable                   | Ulashish tugmalari statistikasi                                                                 |
| 5       | `TRAVELPAYOUTS_MARKER`                                                               | Coolify: web                      | Aviasales havolalari                                                                            |
| 9a      | `ADMIN_TELEGRAM_IDS`                                                                 | Coolify: web                      | Admin panel egalari: Telegram ID'lar vergul bilan (masalan `123,456`). Kirishda rol yangilanadi |
| 1M      | `CREATOR_ENABLED`                                                                    | Coolify: web va worker            | `1` bo'lsa 1M Safar ochiladi (taklif sahifalari, safarning 2-kunidagi bot xabari). Bo'sh — hammasi yopiq |
| 1M      | `INSTAGRAM_HANDLE`                                                                   | Coolify: web                      | Belgilanadigan akkaunt, masalan `@travelbuddy`. Bo'sh bo'lsa APP_NAME'dan yasaladi |
| 10      | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Coolify: web va worker            | 1M Safar                                                                                        |
| 10      | `SMS_PROVIDER`, provayder kalitlari                                                  | Coolify: worker                   | Pulli — alohida ruxsat bilan                                                                    |

## `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` ni yaratish

Bu kalit faqat bir marta yaratiladi va **o'zgartirilmaydi**. O'zgarsa, ochiq turgan sahifalar bir marta "Yangilash"ni so'raydi, boshqa zarar yo'q.

1. Mac'da Terminal'ni oching va yozing:
   ```
   openssl rand -base64 32
   ```
   44 belgili qator chiqadi (oxiri `=` bilan). Uni hech kimga yubormang.
2. GitHub → `travel-buddy` repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
3. Name: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, Secret: o'sha qator → **Add secret**.
4. Terminal oynasini yoping. Kalit faqat GitHub'da qoladi; Coolify'ga kerak emas (build ichiga kiradi).

## Sentry DSN olish

1. sentry.io → bepul akkaunt (Developer plan) → **Create project** → platforma **Next.js**, nomi `travel-buddy`.
2. Project Settings → **Client Keys (DSN)** → DSN'ni nusxalang (`https://...@...ingest.sentry.io/...`).
3. Shu qiymatni: Coolify web va worker'ga `SENTRY_DSN`, GitHub Variables'ga `NEXT_PUBLIC_SENTRY_DSN` qilib qo'ying.
4. Yangi build kerak (main'ga merge → GitHub Actions), keyin Coolify'da web va worker **Redeploy**.
