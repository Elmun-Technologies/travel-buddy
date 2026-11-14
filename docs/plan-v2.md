# Reja v2 (ustun hujjat)

Manba: `docs/design-handoff/` (`CLAUDE-CODE-PROMPT.md`, `product-decisions.md`, `plan-v2-task.md`, 28 ta ekran).
Zid joyda tartib: egasi qarorlari (pastda) → `product-decisions.md` → `plan-v2-task.md`.
`CLAUDE.md` o'zgarmaydi; undagi eski 3–6-bosqichlar o'rniga shu reja amal qiladi. Qolgan qoidalar (server, xavfsizlik, sirlar) o'z kuchida.

## Egasi qarorlari (2026-11-14)

1. CLAUDE.md'ga tegilmaydi, v2 reja shu faylda.
2. Onboarding'da guruh varianti: "Aralash" va "Faqat ayollar". "Faqat erkaklar" yo'q.
3. Yaqinlar sahifasi: guruh soni doim ko'rinadi. Ayol/erkak nisbati faqat guruhdagilarning **hammasi** jinsini ko'rsatishga rozi bo'lsa chiqadi, aks holda "N kishi". Ayollar safarida "Faqat ayollar guruhi" yozuvi chiqadi.
4. Yo'nalishlar (davlatlar, fotolar, viza ma'lumoti) prod'ga ham qo'yiladi. Soxta odam, safar va sharh faqat development'da.
5. Dekabrda kichik sinov: 3, 4, 4b, 5, 5b va admin panelning minimal qismi kerak. 6, 7, 8 sinovgacha sodda ko'rinishda. 10-bosqich sinovdan keyin, lekin Meta App Review hozirdan tayyorlanadi.

## Bosqichlar va taxminiy muddatlar

Muddatlar — ish kunlari, egasi har bosqichni 1 kun ichida ko'rib chiqadi deb hisoblangan. Kechiksa, keyingilari suriladi.

| #                 | Nima                                                                                                                           | Ekranlar                                                                       | Jadvallar                                                                                                                 | Taxminiy muddat                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 3                 | Onboarding xatosi, barqarorlik, Sentry                                                                                         | —                                                                              | `onboarding_drafts`                                                                                                       | 14–15 noyabr                                                                  |
| 4                 | Dizayn tizimi "Clay", ekranlarni qayta qurish, 4 qadamli onboarding, bot `/start`                                              | UI-Kit, Welcome, Onboarding, Home, Trips, TripDetail, Profile, Main, Bot-Start | `destinations`, profilga guruh varianti                                                                                   | 16–22 noyabr                                                                  |
| 4b                | Safar ochish 3 qadamda, ulashish, OG va story rasm, ochiq `/t/<kod>`                                                           | CreateTrip, -2, -Share                                                         | `trips`: `public_code`, `destination_id`, `cover_key`                                                                     | 23–27 noyabr                                                                  |
| 5                 | Safar xonasi (2 PR): chat, e'lon, so'rovnoma, shikoyat/blok, rate limit · Reja, ro'yxat, Yig'amiz, Xarajat                     | Room-Chat, -Plan, -Book, -Costs                                                | so'rovnoma, reja, ro'yxat, reys/joy variantlari, xarajat, `agency_requests`                                               | 28 noyabr – 6 dekabr                                                          |
| 5b                | Viza, haqiqiy narx, yaqinlar sahifasi, SOS, "so'zida turish"                                                                   | Visa, Price, Family, SOS                                                       | `visa_rules`, `visa_agencies`, `price_stats`, `family_links`, `checkins`, `sos_events`, `trusted_contacts`, `reliability` | 7–11 dekabr                                                                   |
| 9a                | Admin minimal: moderatsiya, shikoyatlar, viza va narx kiritish, agentlik so'rovlari                                            | admin                                                                          | —                                                                                                                         | 12–14 dekabr                                                                  |
| 6·7·8 (sodda)     | Klub sahifasi va qo'shilish; moslik foizi va "nega mos"; safardan keyin albom va baho                                          | Club, Home'dagi moslik, Memories (soddalashtirilgan)                           | `clubs`, `club_members`, albom/baho                                                                                       | 15–19 dekabr                                                                  |
| —                 | **Kichik sinov (soft launch)**                                                                                                 |                                                                                |                                                                                                                           | ~20–22 dekabrdan                                                              |
| 6·7·8 (to'liq), 9 | Klub postlari va reytingi, bot bildirishnomalari, ochiq hikoya sahifasi (Web-Story), to'liq admin, yuklama sinovi, runbook'lar |                                                                                |                                                                                                                           | yanvar                                                                        |
| 10                | 1M Safar                                                                                                                       | Creator, Creator-Track, Web-Creator, Web-Inbound                               | `creator_*`                                                                                                               | sinovdan keyin; Meta tekshiruvi hozirdan (`docs/runbooks/meta-app-review.md`) |

Xavf: 5-bosqich eng katta. Agar u cho'zilsa, sinovgacha "Tayyor tur so'raymiz" qo'lda (admin kiritadi) qoladi, qolgan qismi o'zgarmaydi.

## Har bosqich uchun "tayyor"

- 390px (mobil) va 1440px (desktop) skrinshotlar PR'da; 390px'da gorizontal skroll yo'q.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, e2e — yashil; asosiy oqimlar Mini App rejimida ham.
- uz/ru/en; bosiladigan joylar ≥ 44px; WCAG AA kontrast; rasmlarda `alt`.
- Sentry'da yangi xato yo'q; RAM chegaralari buzilmagan.
- Egasiga o'zbekcha hisobot; keyingi bosqich faqat ruxsat bilan.

## Env nomlari

Har bosqich boshida eslatiladi. Ro'yxat va qiymat yaratish: `docs/runbooks/env.md`.
