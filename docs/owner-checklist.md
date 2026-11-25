# Ega uchun ro'yxat: reklamadan oldin nima qilish kerak

> Kod tomonidan hammasi tayyor (2026-11-25). Quyidagilar faqat sizning akkauntlaringiz, pulingiz yoki qaroringiz bilan bog'liq, shuning uchun men qila olmayman. Tartib bilan.
> Batafsil qadamlar: `docs/runbooks/production-setup.md` va `docs/runbooks/uploads-and-verification.md`.

## A. Birinchi navbatda (bularsiz hech narsa ishlamaydi)

| #   | Nima qilasiz                                                                                                                                                                                                                                                                                                                     | Qayerda          | Vaqt   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| 1   | **Staging'ni yangi rasm nomiga o'tkazing.** Repo `Elmun-Technologies` tashkilotiga ko'chgan: rasmlar endi `ghcr.io/elmun-technologies/travel-buddy-web:staging` va `...-worker:staging`. Coolify'da staging web va worker'ning **Image** maydonini shunga o'zgartiring; serverda `docker login ghcr.io` (token: `read:packages`) | Coolify + server | 10 daq |
| 2   | **GitHub o'zgaruvchilari**: Settings → Secrets and variables → Actions → Variables: `APP_URL` = `https://tb-staging.sof-expo.com`, `APP_URL_PRODUCTION` = production manzili                                                                                                                                                     | GitHub           | 3 daq  |
| 3   | Ushbu branchni `main`ga qo'shing (PR oching, `ci` yashil bo'lgach merge). Staging'da **worker → Redeploy** (migratsiya 0013 va 0014 o'zi bajariladi), keyin **web → Redeploy**; `/api/health` → `ok`                                                                                                                             | GitHub + Coolify | 15 daq |
| 4   | **Domen** va DNS A-yozuvi serverning IP'siga. Brend nomi yakuniymi? Bo'lmasa `APP_NAME` ni hozir tanlang                                                                                                                                                                                                                         | domen sotuvchi   | 30 daq |
| 5   | **Production boti**: @BotFather → `/newbot`; `/setdomain`; **Main Mini App** (URL `https://<domen>/uz/tg`). Main Mini App bo'lmasa, ulashish va reklama havolalari ilovani ochmaydi                                                                                                                                              | Telegram         | 10 daq |
| 6   | **Production resurslari** (baza, worker, web) — `production-setup.md` 3–5-bo'limlar. `APP_ENV=production` aniq shunday yozilsin                                                                                                                                                                                                  | Coolify          | 40 daq |
| 6a  | **Rasmlar ombori (S3)**: production uchun alohida bucket va kalit; web **va worker**'ga `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_FILES`. Busiz profil rasmi, chat rasmi, albom va ID tasdiqlash ishlamaydi (tugmalar yashirinadi, xato chiqmaydi)                                                             | Coolify + ombor  | 20 daq |
| 7   | **Baza zaxirasi server tashqarisiga** (Hetzner Object Storage yoki boshqa S3) + bir marta tiklashni sinash. Hozirgi zaxira shu serverning o'zida — server buzilsa, ma'lumot yo'qoladi. Pulli bo'lishi mumkin (oyiga bir necha dollar) — **sizning ruxsatingiz kerak**                                                            | Hetzner          | 30 daq |
| 8   | Production'ni `release` workflow bilan yig'ing (Actions → release → Run), Coolify'da Deploy, `production-setup.md` 7-bo'lim bo'yicha 10 daqiqalik tekshiruv                                                                                                                                                                      | GitHub + Coolify | 30 daq |

## B. Reklama boshlanishidan oldin (sifat va xavfsizlik)

| #   | Nima qilasiz                                                                                                                                                                                                                    | Nega                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 9   | **Yurist** `/uz/terms` va `/uz/privacy` matnlarini ko'rib chiqsin (shablon). `LEGAL_ENTITY`, `LEGAL_ADDRESS`, `SUPPORT_EMAIL`, `SUPPORT_TELEGRAM` ni web'ga yozing. Agentlik komissiyasi sharti bo'yicha shartnoma shabloni ham | Telefon, tug'ilgan sana, ID rasmlari      |
| 10  | **Admin ID'lar**: o'zingiz va jamoa Telegram ID'si → `ADMIN_TELEGRAM_IDS` (`add-admin.md`)                                                                                                                                      | Moderatsiya                               |
| 11  | **Viza va narx ma'lumotlari**: admin panel → Viza: kamida Gruziya, Turkiya, Qozog'iston, BAA, Tailand uchun O'zbekiston pasporti qoidasi, manba va sana bilan. Kiritilmaguncha production'da "tayyorlanmoqda" turadi            | Noto'g'ri viza odamni chegarada qoldiradi |
| 12  | **Elchixona telefonlari** va favqulodda raqamlar (`src/lib/emergency.ts`, 2026-11-14) — reklamadan oldin bir marta qayta tekshiring                                                                                             | Xavfsizlik                                |
| 13  | **Sentry** va **PostHog EU** kalitlari (`env.md`, `analytics.md`). PostHog'siz reklama natijasini o'lchab bo'lmaydi                                                                                                             | O'lchash                                  |
| 14  | Test: ikkita haqiqiy Telegram akkaunt bilan to'liq oqim (profil → rasm → safar → so'rov → qabul → chat → shaxsiy chat → ulashish havolasi Telegram'da ko'rinishi). **Men Telegram ichida sinay olmadim**                        | Oxirgi tekshiruv                          |
| 14a | **ID tekshiruvchi**: kim ID so'rovlarini ko'radi (admin panel → "ID tekshiruv")? Kuniga bir marta kiring. Pullik xizmat qo'yilmagan (sabab: `uploads-and-verification.md`)                                                      | Jamoa                                     |
| 14b | **Agentliklar**: birinchi haqiqiy agentliklarni o'zingiz taklif qiling; Profil → "Agentlik kabineti" orqali ariza qoldiradi, siz admin panel → "Agentliklar"da hujjatni ko'rib tasdiqlaysiz                                     | Jamoa                                     |
| 15  | Boshlang'ich **haqiqiy** safarlar: o'zingiz yoki tanishlar 3–5 ta haqiqiy safar ochsin, 1–2 ta klub. Production'da soxta safar/odam/sharh qo'yilmaydi (CLAUDE.md qoidasi)                                                       | Bo'sh lentani oldini olish                |

## C. Ixtiyoriy / keyinroq

- **Google bilan kirish**: `GOOGLE_CLIENT_ID` va `GOOGLE_CLIENT_SECRET` (qadamlar: `uploads-and-verification.md`). Kalit bo'lmasa tugma ko'rinmaydi.
- `TRAVELPAYOUTS_MARKER` — Aviasales hamkor daromadi uchun.
- `CREATOR_ENABLED` — 1M Safar'ni **hozir yoqmang** (Meta tekshiruvi, soliq va oferta yurist ko'rigidan keyin).
- GitHub `COOLIFY_TOKEN` + webhook'lar — staging avtomatik deploy uchun (majburiy emas).
- **SMS (Eskiz.uz)**: akkaunt oching, balans to'ldiring (pulli — qaror sizniki), keyin worker'ga `SMS_PROVIDER=eskiz`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD` yozing. Yozmasangiz SMS o'chiq turadi, boshqa hamma narsa ishlayveradi. SMS faqat SOS va yaratuvchi taklifi uchun, rozilik bergan odamga.
- **Telegram guruh bog'lash**: pul yoki akkaunt kerak emas. Faqat tashkilotchilarga aytib qo'ying: botni guruhga **administrator** qilib qo'shish va `/link KOD` yozish (`uploads-and-verification.md`). Ikkita haqiqiy guruhda bir marta sinab ko'ring.
- Ochiq hikoya sahifasi va klub reytingi tayyor, hech narsa qilish shart emas: hikoya hamma a'zo rozi bo'lgandagina ochiladi, reyting 3 ta bahodan keyin chiqadi.
- Kodda yo'q: pullik ID xizmati (MyID/eKYC — shartnoma va pul talab qiladi); hozir ID qo'lda tekshiriladi.

## D. Reklama havolalari

- Mini App: `https://t.me/<bot>?startapp=src_instagram`
- Bot: `https://t.me/<bot>?start=src_instagram`
- Sayt: `https://<domen>/uz?utm_source=instagram&utm_medium=cpc&utm_campaign=noyabr`

`src_` dan keyin kichik lotin harflari/raqamlar/`_`. Natijalar PostHog'da (`docs/runbooks/analytics.md`).
