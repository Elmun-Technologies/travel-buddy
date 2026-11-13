# Bazani zaxira nusxadan tiklash

> Holat: **hali sinalmagan**. Birinchi backup olingach, tiklash staging'da sinab ko'riladi va natija shu yerga yoziladi (sana, qancha vaqt ketdi, nima chiqdi).

## Reja (staging'da sinov)

1. Coolify → `tvb-staging-db` → **Backups** → oxirgi muvaffaqiyatli nusxa ko'rinib turibdi.
2. Sinov uchun alohida, vaqtinchalik Postgres resursi ochiladi: `tvb-restore-test`. U asosiy staging bazasiga tegmaydi.
3. Nusxa Coolify'ning **Import Backup / Restore** funksiyasi orqali `tvb-restore-test` ga yuklanadi.
4. Tekshiruv: `select count(*) from waitlist;` natijasi asl staging bazasidagi son bilan bir xil chiqishi kerak.
5. `tvb-restore-test` o'chiriladi (bu o'zimiz yaratgan staging resursi, unga ruxsat bor).

## Sinov natijalari

| Sana | Nusxa sanasi | Ketgan vaqt | Natija          |
| ---- | ------------ | ----------- | --------------- |
| —    | —            | —           | hali sinalmagan |
