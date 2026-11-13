# Arxitektura — Travel Buddy (ishchi nom)

> Sana: 2026-11-14 · Holat: qoralama (0-bosqich). Manba: `CLAUDE.md`, 2–6-bo'limlar.

## 1. Umumiy ko'rinish

**Modulli monolit**: bitta repo, ichida ikkita jarayon (process) ishlaydi.

| Jarayon    | Vazifasi                                                                                             | RAM limiti                  |
| ---------- | ---------------------------------------------------------------------------------------------------- | --------------------------- |
| `web`      | Next.js: sahifalar, API, SSE orqali chat                                                             | ≤ 768 MB                    |
| `worker`   | Telegram bot (grammY), fon vazifalari (pg-boss): moslik hisobi, bildirishnomalar, fayllarni tozalash | ≤ 384 MB                    |
| `postgres` | PostgreSQL 16, Coolify'dagi alohida resurs                                                           | `shared_buffers` 128–256 MB |

Redis yo'q, mikroservislar yo'q. Navbat ham, real-time xabarlar ham PostgreSQL orqali ishlaydi:

- navbat — `pg-boss`;
- real-time — `LISTEN/NOTIFY` → SSE.

## 2. Deploy

```
GitHub repo ──push──> GitHub Actions: lint + typecheck + test + docker build
                                   │
                                   └──> GHCR image (web, worker)
                                              │
                         Coolify deploy webhook ┘
                                              ▼
  Hetzner / Coolify:  [web: Next.js]  [worker: bot + jobs]  [postgres: alohida resurs]
                         ▲ Traefik (TLS, domen)
```

- Image serverda emas, **GitHub Actions'da yig'iladi**, shunda qo'shni loyihalar sekinlashmaydi.
- Ikki muhit: `staging` va `production`. Har bir o'zgarish avval staging'da tekshiriladi.
- Domen va TLS'ni Coolify'ning Traefik'i beradi. O'z Nginx yoki Caddy'imiz bo'lmaydi.
- Migratsiyalar alohida qadam: `worker` ishga tushishidan oldin `migrate` bajariladi.
- Zaxira nusxa: Coolify Postgres'ning rejalashtirilgan backup'i kuniga 1 marta olinadi va server tashqarisidagi S3-mos omborga yoziladi. Tiklash staging'da sinab ko'riladi → `docs/runbooks/restore.md`.

## 3. Texnologiyalar

| Qism                      | Tanlov                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Til                       | TypeScript (strict)                                                                                                   |
| Web                       | Next.js App Router, `output: 'standalone'`                                                                            |
| UI                        | Tailwind CSS + shadcn/ui, mobil ekran birinchi o'rinda                                                                |
| Tillar                    | `next-intl`, `/uz` (asosiy), `/ru`, `/en`                                                                             |
| Ma'lumotlar bazasi va ORM | PostgreSQL 16 + Drizzle ORM / drizzle-kit                                                                             |
| Validatsiya               | Zod, har bir kirish nuqtasida                                                                                         |
| Auth                      | DB'dagi `sessions` + httpOnly cookie; Telegram (Login Widget, Mini App `initData` HMAC); Google uchun `arctic`        |
| Fon vazifalari            | pg-boss                                                                                                               |
| Telegram                  | grammY + Mini App                                                                                                     |
| Fayllar                   | `@aws-sdk/client-s3` + `sharp` (WebP; profil rasmi ≤ 1080px, ≤ 300 KB). ID hujjatlari faqat yopiq (private) bucket'da |
| Email                     | Resend (SMTP adapter bilan almashtirsa bo'ladi)                                                                       |
| Analitika / xatolar       | PostHog Cloud (EU) / Sentry Cloud                                                                                     |
| Testlar                   | Vitest + Playwright (asosiy oqimlar uchun smoke testlar)                                                              |
| Paket menejer             | pnpm                                                                                                                  |

## 4. Kod tuzilmasi

```
/src
  /app/[locale]/...        # sahifalar
  /app/api/...             # route handlers (+ /api/health)
  /modules
    /auth  /users  /profiles  /trips  /matching
    /groups  /chat  /agencies  /leads  /reviews
    /moderation  /notifications  /admin
  /lib (db, s3, i18n, telegram, analytics)
/worker                    # grammY bot + pg-boss joblari
/drizzle                   # migratsiyalar
/docs                      # prd.md, architecture.md, decisions.md, runbooks/
```

Har bir modulda `service.ts`, `schema.ts` (Zod) va `queries.ts` bo'ladi. Modullar bir-birining jadvallariga to'g'ridan-to'g'ri emas, faqat service orqali murojaat qiladi.

## 5. Ma'lumotlar modeli (qisqacha)

Hamma jadvalda `id` (uuid), `created_at` va `updated_at` bor. Pul butun sonda (tiyin yoki sent) va alohida `currency` maydoni bilan saqlanadi.

Jadvallar: `users`, `auth_accounts`, `sessions`, `traveler_profiles`, `trips`, `trip_members`, `travel_intents`, `match_suggestions`, `agencies`, `agency_members`, `agency_verifications`, `tour_offers`, `leads`, `bookings`, `conversations`, `conversation_members`, `messages`, `reviews`, `reports`, `blocks`, `notifications`, `subscriptions` (hozircha bo'sh), `audit_logs`, `waitlist`.

Indekslar: `trips(destination_country, start_date, status)`, `match_suggestions(user_id, score desc)`, `messages(conversation_id, created_at)`.

Har bir maydonning to'liq ro'yxati `CLAUDE.md` ning 5-bo'limida. Sxema 1-bosqichda Drizzle'da yoziladi.

## 6. Server cheklovlari

Server umumiy: Hetzner, **ARM (aarch64)**, 4 CPU, ~8 GB RAM, ~80 GB disk, Coolify orqali 20 dan ortiq boshqa loyiha bilan birga ishlaydi.

- Shu loyiha jami ~1.2–1.5 GB RAM band qiladi: `web` 768 MB + `worker` 384 MB + Postgres.
- Tekshiruv (2026-11-13): 5.2 GB "available" RAM, 54 GB bo'sh disk → shu serverda davom etamiz.
- Image'lar `linux/arm64` uchun yig'iladi.
- Boshqa loyihalarning resurslari, bazalari, volume'lari va env'lariga tegilmaydi.
