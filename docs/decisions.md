# Qarorlar jurnali

| Sana       | Qaror                                                                                               | Sabab                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 2026-11-14 | Ildizdagi `CLAUDE.md` o'zgartirilmadi, 10-bo'lim unga ko'chirilmadi                                 | Ega fayl shu holicha qolishini aniq so'radi                              |
| 2026-11-14 | Server tekshiruvi buyruqlar ro'yxati sifatida egaga berildi                                         | SSH ruxsati berilmagan                                                   |
| 2026-11-14 | `docs/prd.md` va `docs/architecture.md` o'zbek tilida yozildi                                       | Topshiriq: `docs/` dagi hujjatlar o'zbekcha bo'ladi                      |
| 2026-11-14 | (0-bosqich) Git repo ochilmadi — ega javobini kutildi                                               | 1-bosqichda ochildi, pastga qarang                                       |
| 2026-11-14 | Server tekshirildi: 5.2 GB "available" RAM, 54 GB bo'sh disk, 4 CPU → shu serverda davom etamiz     | 2 GB lik chegaradan ancha yuqori; swap 359 MB (8%), yuklama 0.5          |
| 2026-11-14 | Docker image'lar `linux/arm64` uchun, GitHub'ning arm64 runner'ida yig'iladi                        | Server ARM (aarch64) protsessorli                                        |
| 2026-11-14 | Repo: `elmuntech/travel-buddy` (private, shaxsiy akkaunt)                                           | Ega ko'rsatmasi                                                          |
| 2026-11-14 | `APP_NAME` build vaqtida o'qiladi (GitHub repo variable)                                            | Sahifalar statik va tez qoladi; nom o'zgarsa — o'zgaruvchi + qayta build |
| 2026-11-14 | `/` doim `/uz` ga ochiladi, brauzer tilini avtomatik aniqlash o'chirilgan                           | Topshiriq: default `uz`; til tepadagi tugma bilan almashtiriladi         |
| 2026-11-14 | To'liq ma'lumotlar sxemasi (26 jadval) birinchi migratsiyada                                        | 1-bosqich talabi; qo'shimcha: `id_verifications`, `rate_limits`          |
| 2026-11-14 | Waitlist himoyasi: honeypot + IP bo'yicha soatiga 5 ta urinish (Postgres)                           | Redis'siz rate limiting; spam bot'lardan himoya                          |
| 2026-11-14 | `utm_source` server action'da Referer sarlavhasidan olinadi                                         | Marketing manbasini o'lchash, sahifani statik saqlagan holda             |
| 2026-11-14 | Worker esbuild bilan bitta faylga yig'iladi, image ~62 MB                                           | Kichik image, node_modules kerak emas                                    |
| 2026-11-14 | Migratsiya: staging'da worker ishga tushishidan oldin (`RUN_MIGRATIONS=true`), production'da qo'lda | Staging'da qulaylik, production'da nazorat                               |
| 2026-11-14 | Coolify deploy hozircha qo'lda (Redeploy); webhook ixtiyoriy GitHub secret orqali                   | Ega API token bermadi                                                    |
| 2026-11-14 | Lokal o'lchov: 200 parallel so'rovdan keyin web ~57 MB, worker ~20 MB RAM                           | Limitlar (768/384 MB) bilan katta zaxira bor                             |
