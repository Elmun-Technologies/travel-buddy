# Yangi versiyani chiqarish (deploy)

Qoida: avval **staging**, keyin **production**. Production'ga faqat eganing ruxsati bilan.

## Staging

1. Kod `main`ga tushadi (PR yashil bo'lgach). GitHub Actions `ci` ishlaydi: lint, typecheck, test, build, e2e, image'lar (`:staging`).
2. Coolify: avval **worker → Redeploy**, keyin **web → Redeploy** (staging'da migratsiya worker ishga tushganda o'zi bajariladi).
3. `https://<staging>/api/health` → `ok`. Telefonda asosiy oqimni 5 daqiqa tekshiring.

## Production

1. **Backup**: Coolify → `tvb-production-db` → Backups → **Backup Now**. Tugaganini kuting.
2. GitHub → Actions → **release** → Run workflow (yoki `git tag v1.0.1 && git push --tags`). `:production` image'lar yangilanadi.
3. Yangi migratsiya bormi? `git log -- drizzle/` yoki PR'da ko'ring. Bo'lsa: Coolify → **worker → Terminal** → `node dist/migrate.mjs` (eski worker ichida emas, yangi image tortilgandan keyin — shuning uchun avval worker'ni **Redeploy** qiling, keyin terminalda migratsiya, keyin web'ni).
4. **worker → Redeploy**, logda `worker started`.
5. **web → Redeploy**. `https://<domen>/api/health` → `{"status":"ok","env":"production"}`.
6. 10 daqiqa Sentry va Coolify loglarini kuzating. Ochiq turgan eski Mini App sahifalarida "Yangilash" banneri chiqadi — bu normal.

## Muhim

- Worker bitta nusxada ishlaydi. Redeploy paytida bir necha soniya bildirishnomalar kechikadi, yo'qolmaydi (qayta uriniladi).
- Migratsiya hech qachon avtomatik production'da ishlamaydi (`RUN_MIGRATIONS=false`).
- Bir tokenli botni bir vaqtda ikkita worker ishlata olmaydi: staging va production **boshqa-boshqa bot** bo'lsin.
