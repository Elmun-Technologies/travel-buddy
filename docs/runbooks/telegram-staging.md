# Staging: HTTPS domen va Telegram bot (ega uchun qadam-baqadam)

> Domen: `tb-staging.sof-expo.com` (A-yozuv → 2.29.137.243). Bot: `@sayohatdoshbot`.
> Token faqat Coolify'ga kiritiladi: chatga, repo'ga va loglarga yozilmaydi.

## 1. Web'ga HTTPS domen

Coolify → travel-buddy → staging → **travel-buddy-web-staging** → **Configuration → General**:

1. **Domains** maydonidagi sslip.io manzilni o'chirib, o'rniga quyidagini yozing:
   `https://tb-staging.sof-expo.com`
   (`https://` bilan boshlanishi shart: shunda Traefik Let's Encrypt sertifikatini o'zi oladi.)
2. **Save**.

## 2. Environment Variables

| Kalit                   | web                        | worker                     | Qiymat                                         |
| ----------------------- | -------------------------- | -------------------------- | ---------------------------------------------- |
| `APP_URL`               | ✅ (eskisini almashtiring) | ✅ (eskisini almashtiring) | `https://tb-staging.sof-expo.com`              |
| `TELEGRAM_BOT_TOKEN`    | ✅                         | ✅                         | 🔒 BotFather bergan token (o'zingiz joylaysiz) |
| `TELEGRAM_BOT_USERNAME` | ✅                         | —                          | `sayohatdoshbot` (`@` belgisisiz)              |

Token web'da kirishni tekshirish uchun, worker'da botning o'zi uchun kerak.

## 3. Deploy tartibi

GitHub Actions yashil bo'lgach:

1. Avval **worker → Redeploy**. Logda quyidagi qatorlar chiqishi kerak:
   - `migrations applied` — telefon raqami uchun yangi qoida bazaga qo'shildi;
   - `worker started`;
   - `bot @sayohatdoshbot polling`.
2. Keyin **web → Redeploy**.
3. `https://tb-staging.sof-expo.com/uz` ni oching: brauzerda qulf belgisi chiqishi kerak.

## 4. BotFather sozlamalari

Telegram'da @BotFather bilan:

1. **Kirish vidjeti uchun domen** (majburiy):
   `/setdomain` → `@sayohatdoshbot` ni tanlang → `tb-staging.sof-expo.com` yuboring.
   Bu qilinmasa, saytdagi "Log in with Telegram" tugmasi "Bot domain invalid" deydi.
2. **Mini App tugmasi:** hech narsa qilish shart emas. Worker ishga tushganda botning menyu tugmasini ("Ilovani ochish") o'zi sozlaydi va u `https://tb-staging.sof-expo.com/uz/tg` ni ochadi.
3. **Webhook:** kerak emas. Bot "long polling" usulida ishlaydi: worker o'zi Telegram'dan yangi xabarlarni so'raydi, shuning uchun worker'ga ochiq manzil kerak emas. Worker ishga tushganda eski webhook bo'lsa, o'zi o'chiradi.
4. Ixtiyoriy: `/setdescription` va `/setabouttext` orqali bot tavsifini yozish, `/setuserpic` orqali rasm qo'yish.

⚠️ Bitta token bilan bir vaqtda faqat **bitta** worker ishlashi mumkin. Production uchun **alohida bot** ochamiz.

## 5. Tekshirish (5 daqiqa)

1. Botga `/start` yozing. Javob va "Ilovani ochish" tugmasi chiqishi kerak.
2. Tugmani bosing. Mini App ochilib, profil to'ldirish sahifasiga o'tishi kerak.
3. Profilni saqlang → **Profil** → **Botda tasdiqlash** → botda "📱 Raqamni ulashish" → "✅ Telefon tasdiqlandi".
4. **+** (Safar ochish) → safar e'lon qiling.
5. Kompyuterda `https://tb-staging.sof-expo.com/uz/login` → "Log in with Telegram" orqali kiring.
6. Ikkinchi Telegram akkaunt bilan shu safarga qo'shilish so'rovi yuboring, birinchisi bilan qabul qiling.

Staging'da yaratilgan safarlar bazada `is_test = true` deb belgilanadi.
