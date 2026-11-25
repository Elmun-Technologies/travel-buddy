# Topshirish hujjati (handoff): keyingi dasturchi uchun

> Sana: 2026-11-25. Maqsad: keyingi dasturchi (yoki Claude Code) hech narsani qayta so'ramasdan shu yerdan davom etishi.
> Avval o'qing: `CLAUDE.md` (qoidalar), `docs/plan-v2.md` (reja), `docs/owner-checklist.md` (ega nima qilishi kerak), `docs/decisions.md` (qarorlar).

## 1. Loyiha bir gapda

Travel Buddy: sayohatga sherik topish va guruhli safarlar platformasi. Web + Telegram bot + Telegram Mini App. Birinchi bozor: O'zbekiston. Tillar: uz (asosiy), ru, en. Ega texnik emas: u bilan o'zbek tilida, oddiy so'zlar bilan gaplashing; kod, commit va izohlar inglizcha.

- Repo: `Elmun-Technologies/travel-buddy`. Asosiy branch: `main`.
- Stek: Next.js 16 (App Router, standalone), TypeScript strict, Tailwind, next-intl, PostgreSQL 16 + Drizzle, grammY bot (`worker/`), pnpm.
- Ikki jarayon: `web` (Next.js) va `worker` (bot + fon vazifalari). Redis yo'q. Arxitektura: `src/modules/<modul>/{service,schema}.ts`, modullar bir-birining jadvaliga to'g'ridan-to'g'ri tegmaydi.

## 2. Hozirgi holat (2026-11-25)

**Kodda tayyor va `main`ga qo'shilgan** ([PR 28](https://github.com/Elmun-Technologies/travel-buddy/pull/28), merge commit `199a555`):
rasm/avatar, chat rasmi, foto-albom va hikoyalar, qo'lda (pulsiz) ID tekshiruvi, Google bilan kirish, 1:1 chat, klublar (reyting 3 ta bahodan keyin), agentliklar/lidlar/bronlar, moslashtirish (matching), Telegram guruhni safarga bog'lash (`/link KOD`), SMS zaxira yo'li (Eskiz, faqat SOS va yaratuvchi taklifi), ochiq hikoya sahifasi `/s/<kod>` (hamma a'zo rozi bo'lsagina), hisob o'chirish, bildirishnoma qayta urinishlari.

**Lokal tekshiruv (merge'dan oldin):** `pnpm lint`, `pnpm typecheck`, `pnpm test` (108 test, Postgres bilan), `pnpm build`, Playwright e2e (40 test): hammasi yashil.

**TekshirilMAGAN:**

- Haqiqiy Telegram ichida hech narsa sinalmagan (bot, Mini App, guruhga `/link`, e'lon yuborish, taklif havolasi).
- Yangi kod staging serverda hali ishlamagan (qarang 3-bo'lim).
- Production umuman sozlanmagan.
- Yozilish paytida merge commit (`199a555`) uchun GitHub Actions `ci` ishi ro'yxatda ko'rinmadi. **Birinchi ish: Actions'da `ci` ishga tushganini va `images` bosqichi (web va worker) yashil tugaganini tekshiring.** Agar umuman ishga tushmagan bo'lsa, sababini toping (workflow `push: [main]`da ishlaydi).

## 3. Staging (Coolify) haqiqiy holati

Coolify'da loyiha `travel-buddy`, ikki muhit. **Production muhiti bo'sh (0 resurs).** Staging'da 4 resurs, hammasi running:

- `travel-buddy-db-staging` (Postgres 16)
- `travel-buddy-web-staging`
- `travel-buddy-worker-staging` (holati "Running (no healthcheck)")
- `travel-buddy-s3-staging` (SeaweedFS; web va worker `S3_*` env'lari unga qaragan. Bizniki ekani ega tomonidan hali tasdiqlanmagan; unga tegmang)

Aniqlangan farqlar (2026-11-25 o'qib chiqilgan, hech narsa o'zgartirilmagan):

1. **Image nomi eski:** web va worker `ghcr.io/elmuntech/travel-buddy-{web,worker}:staging` ishlatadi. Repo `Elmun-Technologies` tashkilotiga ko'chgan, to'g'ri nom: `ghcr.io/elmun-technologies/travel-buddy-web:staging` va `...-worker:staging` (kichik harf). O'zgartirish faqat yangi rasm yig'ilgach. Server `docker login ghcr.io` (token: `read:packages`) kerak bo'lishi mumkin (paket private bo'lsa).
2. **Oxirgi deploy:** 2026-11-15 (eski kod). Migratsiyalar 0013, 0014, 0015 hali qo'llanmagan.
3. **Manzil:** staging hozir `https://wkbm8nvcpkxihom7al7tl4vf.2.29.137.243.sslip.io` (web va worker `APP_URL` shu; `/api/health` → `{"status":"ok"}`). Hujjatlardagi `tb-staging.sof-expo.com` (A-yozuv serverning IP'siga, `2.29.137.243`) Coolify'da web'ga ulanmagan. Domen ulanganda web/worker `APP_URL` ni va GitHub Variable `APP_URL` ni almashtiring, keyin `docs/runbooks/telegram-staging.md` bo'yicha BotFather `/setdomain` (bot: `@sayohatdoshbot`).
4. **Env farqlari:** web'da `TELEGRAM_BOT_TOKEN` **yo'q**. Kodda Telegram kirish imzosi web'da tekshiriladi (`src/modules/auth/login.ts`), busiz hech kim kira olmaydi. Qiymatni worker'dagi bilan bir xil qilib ega o'zi kiritadi. Worker'da `TELEGRAM_BOT_TOKEN` ikki marta ro'yxatda (qiymatlari bir xilmi tekshiring). `SESSION_SECRET` va `APP_NAME` kerak emas. `ADMIN_TELEGRAM_IDS` admin panel kerak bo'lganda. `RUN_MIGRATIONS=true` worker'da bor. Xotira limitlari to'g'ri: web 768m, worker 384m.
5. **GitHub Variable `APP_URL`** (Settings → Secrets and variables → Actions → Variables) staging manziliga mos bo'lishi kerak: u build vaqtida sahifalarga yoziladi. Merge'dan oldin qo'yilganmi, tekshiring.

## 4. Keyingi qadamlar (tartib bilan)

1. Actions: `ci` va `images` yashil. Rasmlar `ghcr.io/elmun-technologies/travel-buddy-{web,worker}:staging` (arm64) paydo bo'lganini tasdiqlang.
2. Ega bilan: web'ga `TELEGRAM_BOT_TOKEN` kiritilganini tasdiqlang (qiymatni ko'rmang va yozmang).
3. Coolify (faqat staging resurslari): image nomini `elmun-technologies`ga almashtiring → **avval worker** Redeploy → worker loglarida migratsiyalar (0013–0015) xatosiz o'tganini tekshiring → **keyin web** Redeploy → `/api/health`. Worker xato bersa web'ni deploy qilmang.
4. Staging'da qo'lda tekshiruv ikki haqiqiy Telegram akkaunt bilan: kirish → profil → rasm → safar ochish → so'rov → qabul → guruh chati → shaxsiy chat → ulashish havolasi → guruhni `/link` bilan ulash (bot guruhda **administrator** bo'lishi kerak) → safar tugagach albom va ochiq hikoya (ikkala a'zo rozi bo'lishi bilan).
5. Domen `tb-staging.sof-expo.com`ni web resursiga ulash (3-bo'limdagi 3-band).
6. Topilgan xatolarni tuzating. Har o'zgarishdan oldin: `pnpm lint`, `pnpm typecheck`, `pnpm test`, e2e.
7. Production: faqat ega ruxsati bilan (`docs/runbooks/production-setup.md`). Zaxira nusxa server tashqarisiga va tiklashni sinash hali qilinmagan (ega ruxsati va puli kerak).

## 5. Qat'iy qoidalar (CLAUDE.md'dan)

- Server umumiy: 20 dan ortiq boshqa loyiha. Faqat `travel-buddy` resurslariga tegilsin. Hech narsani o'chirmang, serverni qayta yuklamang, DNS'ga tegmang, pulli narsa yoqmang, production'ga deploy qilmang: bularning hammasi eganing ruxsatisiz mumkin emas.
- Sirlar (token, parol, kalit) repo, log va chatga yozilmaydi; faqat Coolify env va GitHub Secrets.
- Production'da soxta foydalanuvchi, safar, sharh yo'q. Seed faqat dev/staging va "TEST" belgisi bilan.
- Docker image serverda yig'ilmaydi: GitHub Actions → GHCR → Coolify.
- Barcha foydalanuvchi matni `next-intl` orqali (uz/ru/en), qattiq yozilgan matn yo'q. Zod bilan tekshiruv. 18+ va faqat-ayollar qoidalari serverda majburiy. Bloklanganlar bir-birini ko'rmaydi. Telefon raqami hech qachon ochiq emas.
- Qarorlar `docs/decisions.md`ga (o'zbekcha, sana bilan). Har bosqich oxirida egaga o'zbekcha hisobot.
- PR faqat ega so'raganda.

## 6. Lokal ishlash va test

```bash
pnpm install
pnpm dev
pnpm lint && pnpm typecheck && pnpm test      # DB testlari DATABASE_URL bo'lsagina ishlaydi
pnpm db:generate && pnpm db:migrate           # drizzle-kit, migratsiyalar `drizzle/`
pnpm test:e2e                                 # Playwright (NEXT_DEPLOYMENT_ID va DATABASE_URL kerak)
```

- DB testlari uchun: `DATABASE_URL=postgres://postgres:ci@localhost:5432/tvb` (CI ham shunday).
- e2e: ko'p kirish urinishi `login?error=failed` bersa, `rate_limits` jadvalini tozalang (kirish limiti IP bo'yicha 10 daqiqada 30).
- Testlar umumiy bazada ishlaydi: test ma'lumotlari `TEST` nomli, har test o'zini tozalaydi.

## 7. Muhim texnik joylar

- Bildirishnomalar: `notifications` jadvali, `worker/notify.ts` (kamida bir marta yetkazish, `attempts`/`next_attempt_at`, 400/401/403/404 qaytsa to'xtaydi; SOS birinchi). SMS faqat bot yetmaganda (`src/lib/sms.ts`).
- Rasmlar: `src/lib/storage.ts` (S3 yoki lokal `.local/uploads`; production'da S3 bo'lmasa yuklash o'chiq), `src/lib/images.ts` (sharp → WebP). Hammasi `/api/media/...` marshrutlari orqali, ruxsat tekshiruvi bilan.
- Telegram guruh: `src/modules/telegram-group/service.ts`, bot buyrug'i `worker/bot.ts`, guruhga yuborish `worker/notify.ts` (`group_post`).
- Ochiq hikoya: `src/modules/memories/service.ts` (`publicStory`, `setConsent`), sahifa `src/app/[locale]/s/[code]/`. Eslatma: yopiq hikoya 404 emas, bo'sh sahifa bilan 200 qaytaradi (Next.js streaming cheklovi), lekin ma'lumot chiqmaydi (e2e shuni tekshiradi).
- Moslashtirish: `src/modules/matching/jobs.ts`, worker'da 15 daqiqada bir marta, botda kuniga ≤3 xabar.
- `pg-boss` o'rnatilgan, lekin ishlatilmaydi (fon vazifalari worker'dagi oddiy interval bilan).
- Env ro'yxati: `docs/runbooks/env.md`. Boshqa runbook'lar: `docs/runbooks/`.

## 8. Eganing tomonidagi ishlar

To'liq ro'yxat: `docs/owner-checklist.md`. Qisqacha: domen va production boti, production resurslari va `APP_ENV=production`, S3 ombori, zaxira nusxa server tashqarisiga, yurist (shartlar va maxfiylik), admin Telegram ID'lari, viza va narx ma'lumotlari, Sentry/PostHog kalitlari, Google OAuth kalitlari (ixtiyoriy), SMS (Eskiz akkaunti va balans: pulli, ruxsat bilan), boshlang'ich haqiqiy safarlar va klublar.
