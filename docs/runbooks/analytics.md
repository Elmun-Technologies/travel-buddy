# Analitika (PostHog) — nima o'lchanadi va qanday ulanadi

Brauzerga hech qanday uchinchi tomon skripti qo'yilmaydi. Hodisalarni ilovaning o'zi (server) va worker PostHog Cloud (EU)'ga yuboradi. Odam bir tomonlama xesh bilan belgilanadi; ism, telefon va xabar matni yuborilmaydi. Kalit bo'lmasa, hech narsa yuborilmaydi va ilova odatdagidek ishlaydi.

## Ulash (ega)

1. posthog.com → **EU Cloud** akkaunt → loyiha → **Project API key** (`phc_...`) ni nusxalang.
2. Coolify: **web** va **worker** ga `POSTHOG_KEY=phc_...` qo'shing (production va staging uchun alohida loyiha/kalit yaxshi). `POSTHOG_HOST` kerak emas (standart `https://eu.i.posthog.com`).
3. Redeploy. 1–2 daqiqada PostHog → Activity → Live events'da `pageview` ko'rinadi.

## Hodisalar (funnel tartibida)

| Hodisa             | Qachon                                              | Xossalar                                           |
| ------------------ | --------------------------------------------------- | -------------------------------------------------- |
| `pageview`         | har bir sahifa ochilishi                            | `path`, `referrer`, `utm_*`, `signed_in`           |
| `bot_start`        | botga `/start src_<nom>`                            | `source`                                           |
| `signup`           | yangi akkaunt                                       | `locale`, `source` (Mini App `startapp=src_<nom>`) |
| `phone_verified`   | telefon botda tasdiqlandi                           |                                                    |
| `profile_saved`    | profil saqlandi                                     |                                                    |
| `trip_created`     | safar ochildi                                       | `country`, `size`, `women_only`                    |
| `trip_edited`      | safar tahrirlandi                                   |                                                    |
| `join_requested`   | "Men ham boraman"                                   |                                                    |
| `join_approved`    | tashkilotchi qabul qildi (so'rovchi uchun yoziladi) |                                                    |
| `message_sent`     | guruh chatiga xabar                                 |                                                    |
| `review_submitted` | safardan keyin baho                                 | `rating`                                           |
| `share_clicked`    | ulashish tugmasi                                    | `channel`, `object`                                |
| `account_deleted`  | akkaunt o'chirildi                                  |                                                    |

KPI "Successful Travel Connections": PostHog → **Funnels**: `signup` → `profile_saved` → `join_requested` (yoki `trip_created`) → `join_approved` → `message_sent` → `review_submitted`.

## Reklama havolalari (manba aniqlash)

- Mini App'ga to'g'ridan-to'g'ri: `https://t.me/<bot>?startapp=src_instagram` (BotFather'da **Main Mini App** o'rnatilgan bo'lishi kerak).
- Botga: `https://t.me/<bot>?start=src_instagram` → `bot_start` hodisasi `source=instagram` bilan.
- Sayt: `https://<domen>/uz?utm_source=instagram&utm_medium=cpc&utm_campaign=noyabr` → `pageview` xossalarida.
- `src_` dan keyin faqat kichik lotin harflari, raqamlar va `_` (30 belgigacha).
