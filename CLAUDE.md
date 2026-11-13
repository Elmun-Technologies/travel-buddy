# Claude Code uchun topshiriq: Travel Buddy platformasi (MVP)

> Bu faylni Claude Code'ga to'liq bering. Birinchi xabar sifatida: "Shu faylni o'qi va 0-bosqichdan boshla" deb yozing.

---

## 0. Sen kimsan va qanday ishlaysan

Sen bu loyihaning yagona dasturchisisan. Loyiha egasi texnik emas, marketing va biznes tomonini boshqaradi. Shuning uchun:

- Har bir bosqich oxirida **to'xta** va egaga oddiy o'zbek tilida hisobot ber: nima qilindi, qanday tekshirildi, nima ishlamayapti, keyingi bosqichda nima bo'ladi. Jargon ishlatma, ishlatsang, bir gap bilan tushuntir.
- Bosqich ichida mayda texnik qarorlarni o'zing qabul qil va `docs/decisions.md` ga bir qatordan yozib bor (sana, qaror, sabab).
- Qaytarib bo'lmaydigan yoki pul talab qiladigan har qanday ish oldidan egadan ruxsat so'ra (pastdagi "Qat'iy taqiqlar" bo'limiga qara).
- Kod, fayl nomlari, commit va izohlar — ingliz tilida. Egaga yoziladigan hisobotlar va `docs/` dagi biznes hujjatlari — o'zbek tilida.

Birinchi ishing: ushbu faylning **"CLAUDE.md uchun asosiy qoidalar"** bo'limini repo ildizidagi `CLAUDE.md` fayliga ko'chir, shunda keyingi sessiyalarda ham shu qoidalar bilan ishlaysan.

---

## 1. Loyiha nima

**Kategoriya:** Social travel marketplace — sayohatga sherik topish + guruhli safarlar.

**Muammo:** Odam chet elga (Gruziya, Turkiya, Qozog'iston, Tailand...) bormoqchi, lekin sherigi yo'q, do'stlari bilan sana mos kelmaydi yoki yolg'iz borishdan qo'rqadi. Turagentliklar esa guruhlarini to'ldira olmaydi.

**Yechim — uch qadam:**
1. **Find people** — o'zingga mos sayohatchilarni top (yo'nalish, sana, budjet, uslub, yosh bo'yicha).
2. **Join trips** — shakllanayotgan guruhga qo'shil (mustaqil sayohatchi yoki agentlik ochgan).
3. **Book** — agentlik turiga ariza qoldir, agentlik o'zi bog'lanadi va bronni tasdiqlaydi.

**Tasdiqlangan strategik qarorlar (o'zgartirma):**
| Qaror | Tanlov |
|---|---|
| Biznes modeli | Hybrid: mustaqil sayohatchilar + turagentliklar |
| Bozor | Global loyiha, birinchi bozor O'zbekiston (Toshkent) |
| Mahsulot | Web platforma + Telegram (bot va Mini App), keyin mobil ilova |
| Brend | Yangi xalqaro brend. Nomi hali tanlanmagan → hamma joyda `APP_NAME` env o'zgaruvchisidan olinsin, kodga qattiq yozilmasin |
| Auditoriya | 18+ hammaga ochiq, marketing segmenti 18–35 |
| Kim safar ochadi | Har qanday tasdiqlangan foydalanuvchi + tasdiqlangan agentliklar (ikki xil e'lon turi) |
| Bron | MVP'da faqat **ariza → agentlik tasdiqlaydi**. Platformada to'lov yo'q |
| Huquqiy model | Platforma — vositachi. Shartnoma va pul agentlik bilan sayohatchi o'rtasida. Platforma pul ushlab turmaydi |
| Tillar | O'zbek (lotin), rus, ingliz |

**Monetizatsiya (MVP'da faqat hisobini yuritamiz, to'lov olmaymiz):**
- Agentlikka yetkazilgan har bir ariza (lead) va tasdiqlangan bron bazada qayd etiladi — keyin shu asosda komissiya yoki lead uchun haq olinadi.
- Agentlik SaaS tariflari va traveler premium — MVP'dan keyin. Hozircha faqat ma'lumotlar modeli tayyor tursin (`subscriptions` jadvali).

**Asosiy KPI:** "Successful Travel Connections" — platforma orqali real safarga aylangan uchrashuvlar soni. Analitika shu funnelni o'lchashi kerak: ro'yxatdan o'tish → profil → match → chat → guruhga qo'shilish → ariza → bron → safar → sharh.

---

## 2. Infratuzilma — eng muhim cheklovlar

### 2.1 Server haqida haqiqat

- Bitta mavjud **Hetzner Cloud** serveri, Helsinki, nomi `ubuntu-8gb-hel1-1`, ~8 GB RAM, ~80 GB disk, oyiga ~$12.
- Serverda allaqachon **Coolify** o'rnatilgan va u **boshqa ~20+ ishlab turgan loyihani** boshqaradi: internet-magazinlar (govita va boshqalar), Telegram botlar (sofkino va boshqalar), sof-expo backend, SeaweedFS va hokazo.
- 80 va 443 portlarni **Coolify'ning Traefik proxy'si** egallagan.

**Bundan kelib chiqadigan qoidalar:**
1. **O'z Nginx/Caddy'ingni o'rnatma.** Hamma narsa Coolify resursi sifatida deploy qilinadi, domen va TLS'ni Traefik beradi. (Avval boshqa loyihada o'z Caddy'si bilan kelgan stack Traefik bilan to'qnashgan — buni takrorlama.)
2. **Supabase'ni self-host qilma.** U 10+ konteyner va bir necha GB RAM yeydi, bu serverga sig'maydi. Oddiy PostgreSQL ishlatamiz.
3. **Redis qo'shma** (MVP'da). Navbat va fon vazifalari uchun PostgreSQL asosidagi navbat (`pg-boss`) ishlatiladi.
4. **Docker image'ni serverda build qilma.** Build GitHub Actions'da bo'ladi, image GHCR'ga (GitHub Container Registry) push qilinadi, Coolify faqat tayyor image'ni tortib oladi. Sabab: serverda `next build` 1–2 GB RAM va butun CPU'ni oladi va qo'shni loyihalarni sekinlashtiradi.
5. Har bir konteynerga **RAM limiti** qo'yiladi: `web` ≤ 768 MB, `worker` ≤ 384 MB. Postgres uchun `shared_buffers` kichik (masalan 128–256 MB).
6. Boshqa loyihalarning hech bir resursiga, bazasiga, volume'iga, env'iga tegma. Faqat o'zing yaratgan resurslar bilan ishla.
7. Rasmlar yuklanganda `sharp` bilan WebP'ga siqiladi va o'lchami cheklanadi (profil rasmi ≤ 1080px, ≤ 300 KB). Disk umumiy, 80 GB.

### 2.2 Serverga sig'adimi — 0-bosqichda tekshirasan

Ega SSH ruxsatini bersa, faqat **o'qish uchun** quyidagilarni ishga tushir va natijani hisobotga yoz:
```bash
free -h; df -h /; nproc; uptime
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}"
```
Qaror qoidasi:
- Bo'sh RAM (swap'siz) **≥ 2 GB** bo'lsa → shu serverda davom etamiz.
- **< 2 GB** bo'lsa yoki swap doimiy ishlatilayotgan bo'lsa → egaga ikki variantni narxi bilan tushuntir (Hetzner konsolidagi joriy narxni ega o'zi ko'radi): (a) serverni bir pog'ona kattaroqqa o'tkazish (RAM 16 GB), (b) shu loyiha uchun alohida kichik server. O'zing hech narsani o'zgartirma, qaror egada.

SSH ruxsati berilmasa — bu tekshiruvni egaga buyruqlar ro'yxati sifatida ber, natijasini u o'zi yuboradi.

### 2.3 Deploy sxemasi

```
GitHub (repo) ──push──> GitHub Actions: lint + typecheck + test + docker build
                                   │
                                   └──> GHCR image (web, worker)
                                              │
                         Coolify deploy webhook ┘
                                              ▼
  Hetzner / Coolify:  [web: Next.js]  [worker: bot + jobs]  [postgres: alohida Coolify resursi]
                         ▲ Traefik (TLS, domen)
```
- **Ikki muhit:** `staging` (masalan `staging.<domen>`) va `production`. Avval hamma narsa staging'da tekshiriladi.
- Postgres — **alohida Coolify Database resursi** (ilova compose'ining ichida emas), o'z volume'i va o'z backup jadvali bilan.
- **Backup:** Coolify'ning Postgres scheduled backup funksiyasi, kuniga 1 marta, **server tashqarisidagi** S3-mos saqlash joyiga (Hetzner Object Storage yoki boshqa). Backup'dan tiklash bir marta staging'da sinab ko'rilishi va `docs/runbooks/restore.md` ga yozilishi shart.
- Migratsiyalar deploy vaqtida avtomatik emas, alohida qadam: `worker` ishga tushishidan oldin `migrate` buyrug'i. Har bir migratsiya orqaga qaytariladigan bo'lsin yoki qaytarish yo'li hujjatlansin.

---

## 3. Texnologiyalar steki (qat'iy)

| Qism | Tanlov | Izoh |
|---|---|---|
| Til | TypeScript (strict) | |
| Web | Next.js (App Router, eng so'nggi barqaror versiya), `output: 'standalone'` | Server Components, Route Handlers |
| UI | Tailwind CSS + shadcn/ui | Mobile-first, Telegram Mini App ichida ham chiroyli ko'rinsin |
| i18n | `next-intl`, URL prefiksi `/uz`, `/ru`, `/en` | Default: `uz` |
| Ma'lumotlar bazasi | PostgreSQL 16 | Coolify resursi |
| ORM | Drizzle ORM + drizzle-kit migratsiyalari | Prisma emas (binary yuklashda muammo bo'lgan) |
| Validatsiya | Zod | Har bir kirish nuqtasida |
| Auth | O'zimiz: DB'dagi `sessions` jadvali + httpOnly cookie. Google OAuth uchun `arctic` | Pastdagi Auth bo'limiga qara |
| Fon vazifalari | `pg-boss` | Redis'siz navbat |
| Real-time chat | Server-Sent Events + Postgres `LISTEN/NOTIFY` | WebSocket serveri shart emas |
| Telegram | `grammY` (bot) + Telegram Mini App | `worker` servisida |
| Fayllar | S3-mos API (`@aws-sdk/client-s3`) + `sharp` | Bucket egadan so'raladi. ID hujjatlari faqat private bucket'da |
| Email | Resend (yoki SMTP adapter) | Faqat tranzaksion xatlar |
| Analitika | PostHog Cloud (EU) | Self-host qilinmaydi, og'ir |
| Xatolar | Sentry Cloud (bepul tarif) | |
| Testlar | Vitest (unit) + Playwright (asosiy oqimlar uchun smoke) | |
| Paket menejer | pnpm | |

**Arxitektura:** modular monolith. Bitta repo, bitta Next.js ilova + bitta `worker` jarayon. Mikroservis yo'q.

```
/src
  /app/[locale]/...        # sahifalar
  /app/api/...             # route handlers
  /modules
    /auth  /users  /profiles  /trips  /matching
    /groups  /chat  /agencies  /leads  /reviews
    /moderation  /notifications  /admin
  /lib (db, s3, i18n, telegram, analytics)
/worker                    # grammY bot + pg-boss joblari
/drizzle                   # migratsiyalar
/docs                      # decisions.md, runbooks/, prd.md
```
Har bir modul o'z `service.ts`, `schema.ts` (Zod), `queries.ts` ga ega. Modullar bir-birining jadvallariga to'g'ridan-to'g'ri emas, service orqali murojaat qiladi.

---

## 4. Auth va ishonch (Trust & Safety) — mahsulotning yuragi

O'zbekistonda hamma Telegram'da, SMS esa pulli. Shuning uchun:

1. **Asosiy kirish — Telegram.** Web'da Telegram Login Widget, Mini App ichida `initData` (serverda HMAC bilan tekshiriladi, muddati 24 soatdan oshmasin).
2. **Telefonni tasdiqlash — bepul, bot orqali.** Botda "Raqamni ulashish" (`request_contact`) tugmasi. Kelgan kontaktning `user_id` si foydalanuvchining o'ziniki ekanini tekshir. Shu bilan `phone_verified = true`.
3. **Qo'shimcha:** Google OAuth (xalqaro foydalanuvchilar uchun). SMS OTP — keyinroq, adapter interfeysi tayyor tursin (O'zbekiston uchun Eskiz.uz kabi provayder).
4. **18+ cheklovi:** tug'ilgan sana majburiy, 18 dan kichik bo'lsa ro'yxatdan o'tolmaydi.
5. **Verifikatsiya darajalari** profilda ko'rinadi: Telegram ✓, telefon ✓, ID ✓ (ID tekshiruvi MVP'da qo'lda: foydalanuvchi hujjat rasmi + selfi yuklaydi, admin tasdiqlaydi; fayllar private bucket'da, tasdiqdan keyin 30 kunda avtomatik o'chiriladi, bazada faqat holat qoladi).
6. **Report & block** har bir profil, safar va xabarda bor. Bloklangan odamlar bir-birini hech qayerda ko'rmaydi (matching, feed, chat).
7. **Faqat ayollar guruhi** opsiyasi: safar ochuvchi "faqat ayollar" belgilasa, faqat profilida ayol deb ko'rsatgan va telefoni tasdiqlangan foydalanuvchilar qo'shila oladi. Jins ma'lumoti faqat shu maqsadda ishlatiladi, ochiq profilda ko'rsatilishi foydalanuvchi ixtiyorida.
8. **Kontakt maxfiyligi:** telefon raqami hech qachon ochiq ko'rsatilmaydi. Agentlik ariza egasining kontaktini faqat arizani qabul qilgandan keyin ko'radi (bu lead hisobini to'g'ri yuritish uchun ham kerak).
9. **Rate limiting:** ro'yxatdan o'tish, xabar yuborish, ariza, report — IP va user bo'yicha (Postgres asosida, Redis'siz).
10. **Admin harakatlari audit log**ga yoziladi.
11. **Akkauntni o'chirish:** foydalanuvchi o'zi o'chira oladi, shaxsiy ma'lumotlari 30 kun ichida butunlay o'chadi (GDPR'ga tayyor).
12. Sayohat paytida "Favqulodda holat" sahifasi: mahalliy favqulodda raqamlar va platforma support kontakti (statik kontent, davlatlar bo'yicha).

---

## 5. Ma'lumotlar modeli (boshlang'ich)

Quyidagi jadvallarni Drizzle'da yarat. Hamma jadvalda `id` (uuid), `created_at`, `updated_at`. Pul summalari — butun son (tiyin/sent) + `currency` (ISO kod).

- `users` — role (`traveler` | `agency_member` | `admin`), status, locale, deleted_at
- `auth_accounts` — provider (`telegram` | `google`), provider_user_id
- `sessions`
- `traveler_profiles` — display_name, birth_date, gender (ixtiyoriy), city, country, languages[], bio, avatar_key, travel_styles[], interests[], verification flags
- `trips` — `kind` (`independent` | `agency`), owner_user_id / agency_id, destination_country, destination_city, start_date, end_date, date_flex_days, budget_min, budget_max, currency, travel_styles[], group_size_max, age_min, age_max, women_only, accommodation_pref, description, status (`draft` | `open` | `full` | `closed` | `completed` | `hidden`), visibility
- `trip_members` — trip_id, user_id, role (`organizer` | `member`), status (`requested` | `approved` | `rejected` | `left`)
- `travel_intents` — "men X ga Y sanalarda bormoqchiman" (safar ochmasdan sherik izlash uchun), matching shu bilan ham ishlaydi
- `match_suggestions` — user_id, target (user yoki trip), score, reasons (jsonb), shown_at, action
- `agencies` — nomi, yuridik ma'lumotlar, telefon, sayt, status (`pending` | `verified` | `suspended`)
- `agency_members`, `agency_verifications` (hujjatlar, admin qarori)
- `tour_offers` — agency trip'ning qo'shimcha maydonlari: narx, nimalar kiradi/kirmaydi, itinerary (jsonb), qaytarish qoidalari, jami/bo'sh joylar
- `leads` — tour_offer_id, user_id, xabar, status (`new` | `accepted` | `rejected` | `booked` | `cancelled`), timestamps (komissiya hisobi uchun manba)
- `bookings` — lead_id, odamlar soni, summa, status, agentlik tasdiqlagan sana
- `conversations` (`direct` | `trip_group` | `lead`), `conversation_members`, `messages`
- `reviews` — safar tugagandan keyin, faqat shu safarda birga bo'lganlar bir-biriga
- `reports`, `blocks`
- `notifications`
- `subscriptions` — keyingi bosqich uchun, hozircha bo'sh
- `audit_logs`
- `waitlist` — landing sahifadagi ro'yxat (email yoki Telegram, qiziqqan yo'nalishlar)

Indekslar: `trips(destination_country, start_date, status)`, `match_suggestions(user_id, score desc)`, `messages(conversation_id, created_at)`.

---

## 6. Matching algoritmi (MVP)

PostgreSQL ichida yoki `worker` dagi job'da hisoblanadi, natija `match_suggestions` ga yoziladi.

**Qattiq filtrlar (bular bajarilmasa — tavsiya qilinmaydi):** bir xil yo'nalish (davlat), sanalar `date_flex_days` hisobga olingan holda kesishadi, faol status, bloklanmagan, yosh oralig'i ikki tomonlama mos, `women_only` sharti.

**Ball (0–100):**
| Omil | Og'irlik |
|---|---|
| Yo'nalish (shahar darajasida ham mos bo'lsa yuqori) | 25 |
| Sanalar kesishishi | 20 |
| Budjet kesishishi | 15 |
| Sayohat uslubi | 15 |
| Qiziqishlar (Jaccard) | 10 |
| Yosh yaqinligi | 10 |
| Umumiy til | 5 |

- Har bir tavsiyada **"nega mos"** izohi ko'rsatiladi (masalan: "Ikkalangiz ham 20–26-noyabr, trekking, budjet $500–650").
- Og'irliklar `config` da tursin, kodga qattiq yozilmasin.
- Bir xil tavsiya 7 kun ichida qayta ko'rsatilmaydi.
- Yangi safar yoki intent yaratilganda, mos odamlarga Telegram orqali xabar boradi (kuniga 3 tadan ko'p emas).
- Unit testlar: har bir omil va qattiq filtrlar uchun.

---

## 7. MVP funksiyalari

**Traveler:**
1. Telegram/Google orqali kirish, 3 daqiqadan kam vaqtda profil to'ldirish (onboarding qadamlari).
2. Safar ochish (2 daqiqada) yoki "sherik izlayapman" intent qoldirish.
3. Feed: ochiq safarlar va agentlik turlari, filtrlar (davlat, oy, budjet, uslub).
4. Tavsiya etilgan odamlar va guruhlar (matching), "nega mos" izohi bilan.
5. Guruhga qo'shilish so'rovi → organizator qabul/rad qiladi → qabul qilinganlar guruh chatiga kiradi.
6. 1:1 va guruh chati, report, block.
7. Agentlik turiga ariza.
8. Safardan keyin sharh va baho.
9. Telegram Mini App — xuddi shu web ilova, Telegram ichida ochiladi (alohida dizayn emas, moslashuvchan layout).

**Agentlik paneli:**
1. Ro'yxatdan o'tish, hujjatlar yuklash, admin tasdig'ini kutish.
2. Kompaniya profili.
3. Tur yaratish/tahrirlash: yo'nalish, sanalar, itinerary, narx, nimalar kiradi, joylar soni, qaytarish shartlari.
4. Lead inbox: arizalarni qabul/rad qilish, ariza egasi bilan chat.
5. Bron holatini belgilash.
6. Oddiy statistika: ko'rishlar, arizalar, bronlar, to'lish darajasi.

**Admin:**
1. Foydalanuvchilar, safarlar, agentliklar ro'yxati va qidiruv.
2. Agentlik va ID verifikatsiyasi.
3. Reportlar navbati, e'lonni yashirish, foydalanuvchini bloklash.
4. Lead va bronlar hisobi (komissiya uchun eksport, CSV).
5. Asosiy funnel ko'rsatkichlari.

**Ochiq sahifalar (SEO):**
- Landing (3 tilda) + waitlist. **Bu 1-bosqichda chiqadi**, chunki marketing reklama boshlashdan oldin talabni o'lchashi kerak.
- Har bir ochiq safar va agentlik turining SEO-sahifasi (OG rasm bilan — Telegram va Instagram'da ulashganda chiroyli ko'rinsin).
- Yo'nalish sahifalari: `/uz/trips/georgia` kabi.
- Foydalanish shartlari, maxfiylik siyosati, xavfsizlik qoidalari (matn shablonini yoz, yakuniy matnni yurist tekshiradi — buni hisobotda eslat).

**MVP'ga kirmaydi:** platformada to'lov, aviachipta/mehmonxona bron, AI sayohat rejalashtiruvchi, wallet, loyalty, native mobil ilova.

---

## 8. Bosqichlar (har birining oxirida to'xta va hisobot ber)

**0-bosqich — Tekshiruv va reja (kod yo'q)**
- Server holatini tekshir (2.2-bo'lim) yoki egaga buyruqlarni ber.
- Egadan quyidagilarni so'ra va ro'yxat qilib ber: GitHub repo (u yaratadimi yoki sen), domen (bor bo'lsa), Coolify'ga kirish usuli, S3 bucket, Telegram bot tokeni (BotFather'dan yangi bot), Google OAuth kalitlari (keyinroq bo'lsa ham bo'ladi), Sentry/PostHog akkauntlari.
- `docs/prd.md` (shu fayldagi talablar asosida, o'zbekcha), `docs/architecture.md`, `docs/decisions.md` yarat.
- Hisobot: server sig'adimi, nima kerak, taxminiy bosqichlar.

**1-bosqich — Poydevor + Landing**
- Repo skeleti, TypeScript strict, ESLint, Prettier, Vitest, Playwright.
- Drizzle sxemasi va birinchi migratsiya.
- i18n (uz/ru/en), dizayn tizimi (shadcn), asosiy layout.
- Landing + waitlist (ishlaydigan, 3 tilda).
- Dockerfile (multi-stage, standalone), GitHub Actions → GHCR → Coolify staging.
- Coolify'da: staging Postgres resursi, `web` va `worker` resurslari, RAM limitlari, healthcheck (`/api/health`).
- Backup sozlanadi va tiklash sinab ko'riladi.
- Hisobot: staging havolasi, landing ishlayapti, backup ishlayapti.

**2-bosqich — Auth, profil, safarlar**
- Telegram login (web + Mini App), bot orqali telefon tasdiqlash, sessions.
- Onboarding va profil.
- Safar va intent yaratish, feed, filtrlar, guruhga qo'shilish oqimi.

**3-bosqich — Matching va bildirishnomalar**
- Matching job'lari, tavsiyalar ekrani, "nega mos" izohlari.
- Telegram bildirishnomalari (yangi mos odam, so'rov qabul qilindi, yangi xabar).

**4-bosqich — Chat va xavfsizlik**
- 1:1 va guruh chati (SSE), report, block, rate limiting.
- Admin panelining moderatsiya qismi, audit log.

**5-bosqich — Agentliklar**
- Agentlik ro'yxatdan o'tishi va verifikatsiya, tur yaratish, lead inbox, bron holati, statistika.
- Admin: agentlik tasdiqlash, lead/bron eksporti.

**6-bosqich — Launch tayyorgarligi**
- Sharhlar, SEO sahifalar, OG rasmlar, PostHog funnel eventlari, Sentry.
- Yuklama sinovi (kamida 50 bir vaqtdagi foydalanuvchi), server RAM'ini kuzatish.
- `docs/runbooks/` : deploy, rollback, restore, yangi admin qo'shish.
- Production'ga chiqarish — faqat egaga hisobot berib, ruxsat olgandan keyin.

---

## 9. Qat'iy taqiqlar (egadan ruxsatsiz hech qachon)

- Serverni qayta yuklash, Coolify'ni yangilash, boshqa loyihalarning resurslariga tegish.
- Biror narsani o'chirish (fayl, volume, baza, resurs) — faqat o'zing yaratgan staging resurslari bundan mustasno.
- DNS yozuvlarini o'zgartirish.
- Pulli xizmat yoqish, tarifni oshirish, yangi server ochish.
- Production'ga deploy (staging'ga — mumkin).
- Sirlarni (token, parol, kalit) repo'ga yoki loglarga yozish. Hamma sirlar faqat Coolify env'da va GitHub Secrets'da.
- **Soxta foydalanuvchi, soxta safar yoki soxta sharh yaratish production'da.** Platforma "jonli ko'rinsin" deb bo'lsa ham — yo'q. Bu foydalanuvchilarni aldash bo'ladi. Seed ma'lumotlar faqat lokal va staging'da, aniq "TEST" belgisi bilan. Cold-start muammosi haqiqiy agentlik turlari va organik guruhlar bilan hal qilinadi.
- Raqobatchi saytlardan ma'lumot scraping qilish.

---

## 10. CLAUDE.md uchun asosiy qoidalar

> Shu bo'limni repo ildizidagi `CLAUDE.md` ga ko'chir va loyiha o'sgani sari yangilab bor.

```markdown
# Project: Travel Buddy (codename) — social travel marketplace

## What
Web + Telegram Mini App where travelers find companions and join group trips;
verified agencies list tours and receive leads. First market: Uzbekistan. Langs: uz, ru, en.
Brand name is not final: always read it from APP_NAME env.

## Stack
Next.js (App Router, standalone) · TypeScript strict · Tailwind + shadcn/ui · next-intl
PostgreSQL 16 + Drizzle · Zod · pg-boss · grammY · SSE + LISTEN/NOTIFY · S3-compatible storage + sharp
PostHog Cloud · Sentry · Vitest · Playwright · pnpm

## Architecture
Modular monolith: src/modules/<module>/{service,schema,queries}.ts.
Modules talk through services, never through each other's tables.
Two processes: `web` (Next.js) and `worker` (bot + jobs). No Redis, no microservices.

## Infra (shared server — be careful)
Hetzner Cloud, ~8 GB RAM, shared with 20+ other projects via Coolify (Traefik owns 80/443).
- Deploy only as Coolify resources. Never add own nginx/caddy.
- Never build images on the server: GitHub Actions -> GHCR -> Coolify webhook.
- Memory limits: web <= 768MB, worker <= 384MB.
- Postgres is a separate Coolify DB resource with off-server daily backups.
- Never touch resources you did not create.

## Commands
pnpm dev | pnpm build | pnpm lint | pnpm typecheck | pnpm test | pnpm test:e2e
pnpm db:generate | pnpm db:migrate

## Rules
- Run lint + typecheck + tests before every commit. Small commits, conventional messages, feature branches + PR.
- Every user input validated with Zod. Every query scoped by permissions (trip membership, agency membership).
- Blocked users never see each other anywhere. Phone numbers never public.
- 18+ only. Women-only trips enforced server-side.
- No real payments in MVP. Leads and bookings are recorded for later commission billing.
- No fake users/trips/reviews in production. Seed data only in dev/staging, marked TEST.
- All user-facing strings via next-intl (uz default). No hardcoded text.
- Log decisions in docs/decisions.md. Report to the owner in plain Uzbek at the end of each phase.
- Ask the owner before: production deploy, DNS, deleting anything, paid services, server changes.
```

---

## 11. Tayyor bo'ldi degani (MVP qabul mezonlari)

1. Yangi foydalanuvchi 3 daqiqadan kam vaqtda profil yaratadi.
2. Safar e'loni 2 daqiqada joylashtiriladi.
3. Mos safarlar va odamlar "nega mos" izohi bilan ko'rinadi.
4. Guruhga so'rov yuboriladi, organizator qabul/rad qiladi, qabul qilinganlar guruh chatiga kiradi.
5. Agentlik tur yaratadi, tahrirlaydi, arizani qabul qiladi, bron holatini belgilaydi.
6. Admin soxta e'lonni yashiradi, foydalanuvchini bloklaydi, agentlikni tasdiqlaydi.
7. Report va block ishlaydi, bloklanganlar bir-birini ko'rmaydi.
8. Hamma narsa 3 tilda, telefonda va Telegram Mini App ichida qulay.
9. Backup har kuni olinadi va tiklash sinab ko'rilgan.
10. Serverdagi boshqa loyihalar bu loyiha tufayli sekinlashmagan (RAM o'lchovlari hisobotda).