# Claude Code uchun topshiriq: Travel Buddy — dizaynni hayotga tatbiq etish

> Bu papka (`docs/design-handoff/`) Travel Buddy'ning to'liq dizaynini, mahsulot qarorlarini va fotolarni o'z ichiga oladi. Uni manba sifatida ishlat va loyihani shu dizayn darajasiga olib chiq.

## 0. Avval o'qi (shu tartibda)

1. `CLAUDE.md` (repo ildizida) — umumiy qoidalar. **Uni o'zgartirma va ustidan yozma.**
2. `docs/design-handoff/product-decisions.md` — mahsulot qarorlari. Zid joy bo'lsa, **shu fayl ustun**.
3. `docs/design-handoff/plan-v2-task.md` — 3–9-bosqichlar rejasi.
4. `docs/design-handoff/design/screens/*.png` — har bir ekranning rasmi. **Vizual haqiqat manbai shu.**
5. `docs/design-handoff/design/source/*.dc.html` — o'sha ekranlarning HTML manbasi: aniq ranglar, o'lchamlar va matnlar. Bu prototip, prod kod emas. Undan qiymatlarni ol, lekin komponentlarni o'zimizning stack'da (Next.js + Tailwind + shadcn) qayta yoz.
6. `docs/design-handoff/assets/photos/` — fotolar va `CREDITS.md`.

Ekranlar ro'yxati (`screens/`):

| Fayl | Nima |
|---|---|
| Bot-Start | Bot /start va bildirishnomalar matni |
| App-Welcome, App-Onboarding | Birinchi tanishuv (onboarding 02/04 namunasi) |
| App-Home | Bosh sahifa |
| App-Trips, App-TripDetail | Safarlar lentasi, safar sahifasi |
| App-Profile | Profil |
| App-CreateTrip, App-CreateTrip-2, App-CreateTrip-Share | Safar ochish: 3 qadam va ulashish |
| App-Room-Chat, -Plan, -Book, -Costs | Safar xonasi: Chat · Reja · Yig'amiz · Xarajat |
| App-Destination | Davlat sahifasi (Gruziya) |
| App-Club, App-Memories | Klub, taassurotlar |
| Main | Landing (web) |
| Web-Story | Ochiq safar hikoyasi (web, ulashiladi) |
| UI-Kit | Tokenlar, komponentlar va "tanishuv ilovasi emas" qoidalari |

## 1. Ish tartibi

- Har bir bosqich alohida branch va PR bo'ladi: `feat/<bosqich>-<qisqa-nom>`. PR tavsifida ekran rasmlari bo'lsin (Playwright screenshot: mobil 390px va desktop 1440px).
- Avval **3-bosqich** (onboarding yuborilmaydigan xato) — u tuzalmaguncha boshqa ishni boshlama.
- Har bosqich oxirida: `pnpm lint`, `pnpm typecheck`, `pnpm test`, Playwright e2e. Hammasi yashil bo'lishi shart.
- Staging'ga deploy faqat `staging` tegi orqali, mavjud GitHub Actions oqimi bilan. Prod deploy, DNS va Coolify global sozlamalari — faqat egasining ruxsati bilan.
- Sirlarni (token, parol) kodga, logga yoki PR'ga yozma. Faqat env orqali.
- Bosqich tugaganda qisqa hisobot yoz: nima qilindi, nima qoldi, qanday tekshirish mumkin.

## 2. Bosqichlar (plan-v2 ustiga qo'shimchalar bilan)

### 3-bosqich — Onboarding xatosi va barqarorlik
`plan-v2-task.md` dagidek. Qo'shimcha: onboarding qadamlari serverga darhol saqlansin, kirish uzilib qolsa ham davom etilsin.

### 4-bosqich — Dizayn tizimi va ekranlarni qayta qurish
- Tokenlarni `UI-Kit.png` va `plan-v2-task.md` §4.2 dan ol va Tailwind config'ga, `src/components/clay/` ga kirit.
- **Matnlar.** `product-decisions.md` §1 dagi ovoz bilan. Ekranlardagi matnlarni ol, `messages/uz.json` ga yoz, ru/en'ga shu ohangda tarjima qil.
- **Fotolar.** `destinations` jadvali: slug, nomi (3 tilda), cover, focal_point, vizasi, parvoz vaqti. Seed'ga `assets/photos` dan Gruziya, Turkiya, Qozog'iston, BAA, O'zbekiston va Kapadokyani S3'ga (tb-files) yukla.
- Ekranlarni rasmga 1:1 yaqin qilib qur: avval Mini App, keyin web.

### 4b-bosqich — Safar ochish 3 qadamda va ulashish (yangi)
- `product-decisions.md` §2 va §3. Ekranlar: `App-CreateTrip*`.
- Har bir safar, klub va hikoya uchun OG rasm (`next/og`) va story PNG (1080×1920) yaratilsin.
- Deep link: `startapp=trip_<id>` va `club_<id>`, web'da `/{locale}/t/<id>`. Ro'yxatdan o'tmagan odam ham safarni ko'radi, "Men ham boraman" bosganda kiradi.
- Ulashish nuqtalari: §3 jadvalidagi hamma joy. Bonus va referal yo'q.

### 5-bosqich — Safar xonasi, "Yig'amiz" tab bilan
- Tablar: Chat · Reja · Yig'amiz · Xarajat. So'rovnoma chat ichida.
- **Yig'amiz** (`App-Room-Book.png`, `product-decisions.md` §4):
  - Reysga ovoz berish. Variantlarni a'zolar qo'shadi: vaqt, reys turi, taxminiy narx.
  - "Shu reysni qidiraman" — Aviasales deep link (Travelpayouts marker env'da: `TRAVELPAYOUTS_MARKER`).
  - "Oldim ✓" belgisi va "4/7 chipta oldi".
  - Joyga ovoz berish. Band qilgan kishi summani kiritganda u avtomatik Xarajat'ga tushadi.
  - "Tayyor tur so'raymiz" — MVP'da qo'lda: `agency_requests` jadvali, admin panelda ro'yxat, admin hamkor takliflarini kiritadi, guruh ovoz beradi.
- Pul platformadan o'tmaydi.

### 5b-bosqich — Ishonch va qiymat (ishga tushishdan oldin)
`product-decisions.md` §9, 1–5-bandlar. Ekranlar: `App-Visa`, `App-Price`, `App-Family`, `App-SOS`. Kirish nuqtalari:
- davlat sahifasidagi viza va narx bloklari;
- lentadagi "Vizasiz" filtri;
- profil va tashkilotchi qatoridagi "N/N safarga bordi";
- "Yig'amiz"dagi chipta olish muddati;
- Reja tabidagi "Yaqinlarim ham ko'rib tursin";
- safar xonasi sarlavhasidagi SOS.

Jadvallar:
- `visa_rules` (passport_country, destination, status, max_stay_days, notes, checked_at, source_url);
- `visa_agencies`;
- `price_stats` (destination, days, room_type, p25, median, p75, sample_size);
- `family_links` (token, trip_id, user_id, revoked_at);
- `checkins`;
- `sos_events`;
- `trusted_contacts`;
- `reliability` (har bir foydalanuvchi uchun bordi / kelmadi).

`App-Family` — login'siz ochiladigan sahifa: `/{locale}/f/<token>`.

### 6–9-bosqichlar
`plan-v2-task.md` dagidek: klublar, moslik, taassurotlar, admin. Taassurotlarda ulashish (§3) va ochiq hikoya sahifasi `Web-Story.png` bo'yicha bo'ladi.

### 10-bosqich — 1M Safar dasturi (`product-decisions.md` §8)
- **Ekranlar:** `App-Creator`, `App-Creator-Track`, `Web-Creator`, `Web-Inbound`. Oxirgisi faqat konsept sahifa: `/en/film-uzbekistan`.
- **Yashirin taklif:** dastur hech qayerda oldindan ko'rsatilmaydi. pg-boss job har bir boshlangan safar a'zosiga 2-kuni mahalliy vaqt bilan 10:00 da bot xabarini yuboradi. Bot bloklangan bo'lsa — SMS (`SMS_PROVIDER` env; faqat rozilik bergan va telefoni tasdiqlanganlarga).
- `creator_invites` jadvali: user_id, trip_id, token, sent_via, sent_at, opened_at. Shartlar sahifasi faqat token bilan ochiladi va `noindex` bo'ladi.
- Taklif olmagan foydalanuvchi `/creator` sahifasini ham, Taassurotlardagi kartani ham ko'rmaydi.
- **Instagram ulash:** Instagram API with Instagram Login, professional akkaunt. Har kuni pg-boss job Reels'ning `views` metrikasini o'qiydi va tarixini saqlaydi.
- **Boost tekshiruvi:** Facebook Login ulangan bo'lsa, `total_views` va `views` solishtiriladi. Admin panelda "shubhali" belgisi chiqadi.
- **Jadvallar:**
  - `creator_entries`: trip_id, user_id, ig_media_id, posted_at, window_ends_at, status;
  - `creator_view_snapshots`;
  - `creator_expenses` (chek fayli S3'da);
  - `creator_payouts`;
  - `creator_fund_months`.
- **Hisob-kitob:** `views >= 1_000_000` bo'lsa, hujjatlangan xarajat $1 000 gacha qoplanadi (`min(1000, sum(approved_expenses))`), aks holda 0. Qisman to'lov yo'q. Chegara, limit va oylik fond config'da turadi.
- **To'lov qo'lda:** admin tasdiqlaydi, moliya o'tkazadi, tizim faqat holatni yuritadi.
- **Meta App Review** talab qilinadi — oldindan rejalashtir.

## 3. Hech qachon
- Odamlarni swipe yoki like qilish, jins bo'yicha filtr, "kimni qidiryapsiz" maydoni.
- Safar a'zosi bo'lmagan odamga 1:1 xabar.
- Prod'da soxta foydalanuvchi, safar yoki sharh.
- Pulni platforma orqali o'tkazish (bu alohida qaror, keyin).
- Pulli "yuqoriga chiqarish" orqali agentlik takliflari tartibini o'zgartirish.
- `CLAUDE.md` ni qayta yozish; boshqa Coolify loyihalariga, Traefik'ka yoki server paketlariga tegish.

## 4. "Tayyor" mezoni (har bir ekran uchun)
- Mobil 390px'da ekran rasmiga mos: ranglar, burchaklar, foto, matn.
- Bosiladigan joylar ≥ 44px. Kontrast WCAG AA. Rasmlarda `alt` bor.
- uz/ru/en ishlaydi.
- Telegram MainButton va BackButton to'g'ri ishlaydi.
- E2E test: safar ochish → ulashish havolasi → boshqa foydalanuvchi havoladan kirib "Men ham boraman" → tashkilotchi qabul qiladi → Yig'amiz'da ovoz → Xarajat bo'linadi.
