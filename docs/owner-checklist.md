# Ega uchun ro'yxat: reklamadan oldin nima qilish kerak

> Kod tomonidan hammasi tayyor (2026-11-25). Quyidagilar faqat sizning akkauntlaringiz, pulingiz yoki qaroringiz bilan bog'liq, shuning uchun men qila olmayman. Tartib bilan, har birining oldida "qancha vaqt" va "qayerda" bor.
> Batafsil qadamlar: `docs/runbooks/production-setup.md`.

## A. Birinchi navbatda (bularsiz hech narsa ishlamaydi)

| #   | Nima qilasiz                                                                                                                                                                                                                                                                                                                                                     | Qayerda          | Vaqt   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| 1   | **Staging'ni yangi rasm nomiga o'tkazing.** Repo `Elmun-Technologies` tashkilotiga ko'chgan, shuning uchun rasmlar endi `ghcr.io/elmun-technologies/travel-buddy-web:staging` va `...-worker:staging`. Coolify'da staging web va worker'ning **Image** maydonini shunga o'zgartiring; serverda `docker login ghcr.io -u <github-login>` (token: `read:packages`) | Coolify + server | 10 daq |
| 2   | **GitHub o'zgaruvchilari**: Settings → Secrets and variables → Actions → Variables: `APP_URL` = `https://tb-staging.sof-expo.com`, `APP_URL_PRODUCTION` = production manzili                                                                                                                                                                                     | GitHub           | 3 daq  |
| 3   | Ushbu branchni `main`ga qo'shing (PR oching va `ci` yashil bo'lgach merge qiling), staging'da worker → web **Redeploy**, `/api/health` → `ok`                                                                                                                                                                                                                    | GitHub + Coolify | 15 daq |
| 4   | **Domen** (reklamada ko'rinadigan manzil) va DNS A-yozuvi serverning IP'siga. Brend nomi yakuniymi? Bo'lmasa, `APP_NAME` ni hozir tanlang: nom rasmlar va botga yoziladi                                                                                                                                                                                         | domen sotuvchi   | 30 daq |
| 5   | **Production boti**: @BotFather → `/newbot`; keyin `/setdomain` va **Main Mini App** (URL `https://<domen>/uz/tg`). Main Mini App bo'lmasa, ulashilgan havolalar va reklama havolalari ilovani ochmaydi                                                                                                                                                          | Telegram         | 10 daq |
| 6   | **Production resurslari** (baza, worker, web) — `production-setup.md` 3–5-bo'limlar. `APP_ENV=production` aniq shunday yozilsin                                                                                                                                                                                                                                  | Coolify          | 40 daq |
| 7   | **Baza zaxirasi server tashqarisiga** (Hetzner Object Storage yoki boshqa S3) + bir marta tiklashni sinash. Hozirgi zaxira shu serverning o'zida — server buzilsa, ma'lumot yo'qoladi. Bu pulli xizmat bo'lishi mumkin (taxminan oyiga bir necha dollar)                                                                                                         | Hetzner          | 30 daq |
| 8   | Production'ni `release` workflow bilan yig'ing (Actions → release → Run), Coolify'da Deploy, `production-setup.md` 7-bo'lim bo'yicha 10 daqiqalik tekshiruv                                                                                                                                                                                                      | GitHub + Coolify | 30 daq |

## B. Reklama boshlanishidan oldin (sifat va xavfsizlik)

| #   | Nima qilasiz                                                                                                                                                                                                                                                                                                                      | Nega                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 9   | **Yurist** `/uz/terms` va `/uz/privacy` matnlarini ko'rib chiqsin (ular shablon). Yuridik nom, manzil, support pochta va Telegram'ni env'ga yozing: `LEGAL_ENTITY`, `LEGAL_ADDRESS`, `SUPPORT_EMAIL`, `SUPPORT_TELEGRAM` (web'da). Bo'sh qolsa — sahifada chiqmaydi, lekin odam yozadigan joy bo'lishi kerak                      | Telefon, tug'ilgan sana, joylashuv yig'iladi |
| 10  | **Admin ID'lar**: o'zingiz va jamoa Telegram ID'si → `ADMIN_TELEGRAM_IDS` (`add-admin.md`)                                                                                                                                                                                                                                        | Moderatsiya                                  |
| 11  | **Viza va narx ma'lumotlari**: admin panel → Viza: kamida Gruziya, Turkiya, Qozog'iston, BAA, Tailand uchun O'zbekiston pasporti qoidasi, manba va tekshirilgan sana bilan. Kiritilmaguncha production'da "tayyorlanmoqda" turadi (noto'g'ri viza ma'lumoti odamni chegarada qoldirishi mumkin, shuning uchun men o'zim yozmadim) | Haqiqiy foyda                                |
| 12  | **Elchixona telefonlari** va favqulodda raqamlar (`src/lib/emergency.ts`, 2026-11-14 da tekshirilgan) — reklamadan oldin bir marta qayta tekshiring                                                                                                                                                                               | Xavfsizlik                                   |
| 13  | **Sentry** (xatolar) va **PostHog EU** (funnel) kalitlari: `env.md`, `analytics.md`. PostHog'siz reklama natijasini o'lchab bo'lmaydi                                                                                                                                                                                             | O'lchash                                     |
| 14  | Test: ikkita haqiqiy Telegram akkaunt bilan to'liq oqim (profil → safar → so'rov → qabul → chat → ulashish havolasi Telegram'da ko'rinishi)                                                                                                                                                                                       | Oxirgi tekshiruv                             |
| 15  | Boshlang'ich **haqiqiy** safarlar: o'zingiz yoki tanishlar 3–5 ta haqiqiy safar ochsin. Production'da soxta safar/odam/sharh qo'yilmaydi (CLAUDE.md qoidasi)                                                                                                                                                                      | Bo'sh lentani oldini olish                   |

## C. Ixtiyoriy / keyinroq

- `TRAVELPAYOUTS_MARKER` — Aviasales hamkor daromadi uchun.
- `CREATOR_ENABLED` — 1M Safar'ni **hozir yoqmang** (Meta tekshiruvi, soliq va oferta yurist ko'rigidan keyin).
- GitHub `COOLIFY_TOKEN` + webhook'lar — staging avtomatik deploy uchun (majburiy emas).
- Google OAuth, avatar yuklash, ID tasdiqlash (hujjat+selfi), 1:1 chat, agentliklar, klublar, foto-albom — kodda yo'q; `docs/plan-v2.md` bo'yicha keyingi bosqichlar.

## D. Reklama havolalari

- Mini App: `https://t.me/<bot>?startapp=src_instagram`
- Bot: `https://t.me/<bot>?start=src_instagram`
- Sayt: `https://<domen>/uz?utm_source=instagram&utm_medium=cpc&utm_campaign=noyabr`

`src_` dan keyin kichik lotin harflari/raqamlar/`_`. Natijalar PostHog'da (`docs/runbooks/analytics.md`).
