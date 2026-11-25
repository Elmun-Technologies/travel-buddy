# Bazani zaxira nusxadan tiklash

> Holat: **sinalgan** (2026-11-13, staging). Tiklash ~1 soniya, natija to'g'ri.

## Zaxira qayerda

- Jadval: Coolify → `travel-buddy-db-staging` → **Backups**, har kuni `0 3 * * *` UTC (Toshkent 08:00).
- Nusxalar: 7 ta lokal + 7 ta S3 (`tb-backups-staging` → travel-buddy SeaweedFS, bucket `tb-backups`).
- Lokal fayllar serverda:
  `/data/coolify/backups/databases/root-team-0/travel-buddy-db-staging-5rzekijiyerpgchhodhcwb9i/pg-dump-travel_buddy-<vaqt>-<id>.dmp`
  (format: `pg_dump -Fc`, shuning uchun `pg_restore` bilan tiklanadi).
- Butun server qo'shimcha ravishda Hetzner Backups bilan har kuni nusxalanadi.

## Tiklashni sinash (asosiy bazaga tegmasdan)

Serverda (`ssh root@<server-ip>`), ega ruxsati bilan. `C` — Postgres konteyneri, `F` — nusxa fayli:

```bash
C=5rzekijiyerpgchhodhcwb9i
F=/data/coolify/backups/databases/root-team-0/travel-buddy-db-staging-$C/<fayl>.dmp
docker exec $C createdb -U travelbuddy restore_test
docker exec -i $C pg_restore -U travelbuddy -d restore_test --no-owner < $F
# solishtirish: jadvallar soni va asosiy jadvallardagi yozuvlar
docker exec $C psql -U travelbuddy -d restore_test -tAc "select table_schema, count(*) from information_schema.tables where table_schema in ('public','pgboss','drizzle') group by 1"
docker exec $C psql -U travelbuddy -d restore_test -tAc "select count(*) from waitlist"
docker exec $C dropdb -U travelbuddy restore_test
```

## Haqiqiy avariyada (asosiy bazani tiklash)

Bu holat **faqat ega ruxsati bilan** bajariladi:

1. Coolify'da web va worker'ni to'xtatish (bazaga yozish to'xtaydi).
2. Kerakli nusxani tanlash (lokal yoki S3'dan yuklab olingan).
3. `travel_buddy` bazasiga tiklash: `pg_restore --clean --if-exists --no-owner -d travel_buddy`.
4. Avval worker'ni, keyin web'ni yoqish, `/api/health` → `ok` ekanini tekshirish.

## Sinov natijalari

| Sana       | Nusxa sanasi                  | Ketgan vaqt | Natija                                                                                                                                                                                                      |
| ---------- | ----------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-13 | 2026-11-13 22:16 UTC (108 KB) | ~1 s        | ✅ Jadvallar mos: public 26, pgboss 13, drizzle 1; migratsiyalar 1 = 1. `waitlist`: nusxada 2, hozirgi bazada 1 — farq kutilgan (TEST yozuvi nusxa olingandan keyin o'chirilgan). `restore_test` o'chirildi |
