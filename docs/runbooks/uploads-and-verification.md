# Rasm yuklash, ID tekshiruvi va agentliklar — qanday ishlaydi

## Fayllar (rasm) ombori

- Hamma rasm (profil, chat, albom, ID hujjatlari, agentlik hujjatlari) **yopiq** S3 ombor (`tb-files`)da turadi. Hech biri to'g'ridan-to'g'ri havola bilan ochilmaydi: har bir rasm bizning `/api/media/...` manzilimiz orqali, ruxsat tekshirilgandan keyingina beriladi (profil rasmi — faqat kirgan odamlarga va bloklanmaganlarga; chat rasmi — chat a'zolariga; albom — guruhdagilarga; ID va agentlik hujjatlari — faqat adminlarga).
- Yuklanganda rasm serverda **WebP**'ga o'tkaziladi: profil ≤ 1080 px va ≤ 300 KB, boshqalari ≤ 1600 px va ≤ 500 KB, hujjatlar ≤ 2000 px; GPS va kamera ma'lumotlari o'chiriladi. Faqat JPG/PNG/WebP, 8 MB gacha.
- **Sozlash (web va worker'ga, ikkalasiga ham):** `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_BUCKET_FILES` (standart `tb-files`), `S3_REGION` (standart `us-east-1`). Staging'da bular oldindan qo'yilgan (SeaweedFS). Production'da o'zingizning bucket va kalitlaringiz.
- Production'da S3 sozlanmagan bo'lsa, rasm yuklash tugmalari yashirinadi (xato bermaydi); ilovaning qolgan qismi ishlayveradi.
- Akkaunt o'chirilganda (30 kundan keyin) uning barcha rasmlari ombordan ham o'chiriladi.

## ID tasdiqlash — pulsiz, qo'lda

Qaror: **pullik xizmat yoki MyID/MyGov integratsiyasi ishlatilmaydi.** Sababi: MyID uchun ochiq narx va ochiq API yo'q (UZINFOCOM bilan shartnoma kerak), uchinchi tomon xizmatlari har tekshiruv uchun pul oladi, MVP uchun esa qo'lda tekshiruv yetarli (CLAUDE.md §4.5).

Oqim: foydalanuvchi Profil → "ID tasdiqlash" → hujjat rasmi + selfi → admin panel → **ID tekshiruv** → rasmlarni ko'rib "Tasdiqlash" yoki "Rad etish". Tasdiqlansa profilda "ID ✓" chiqadi. Rasmlar qaror qilingach **30 kunda** avtomatik o'chadi (worker, har kuni); bazada faqat holat qoladi.

Tekshiruvchi uchun qoida: hujjatdagi ism/yosh profilga mos; selfidagi odam hujjatdagi odam; rasm aniq. Shubha bo'lsa — rad eting (odam qayta yuborishi mumkin). Hujjat rasmlarini yuklab olmang, boshqalarga yubormang.

Keyinroq xohlasangiz: MyID yoki boshqa eKYC provayderi alohida adapter sifatida qo'shiladi (pulli — alohida ruxsat bilan).

## Google bilan kirish (ixtiyoriy)

1. console.cloud.google.com → loyiha → **APIs & Services → OAuth consent screen** (External; nom, support pochta, logotip; domen) → **Credentials → Create credentials → OAuth client ID → Web application**.
2. **Authorized redirect URIs:** `https://<domen>/api/auth/google/callback` (staging uchun alohida, production uchun alohida).
3. Web'ga env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Redeploy. Kirish sahifasida "Google bilan kirish" tugmasi paydo bo'ladi (kalit bo'lmasa — chiqmaydi).
4. Google orqali kirgan odam telefonni tasdiqlashi uchun Profil sahifasidagi "Telegramni ulash" tugmasi bilan Telegram'ni ulaydi.
5. Consent screen "Testing" holatida faqat test foydalanuvchilar kira oladi; hammaga ochish uchun "Publish app" bosing (Google tekshiruvi `openid email profile` uchun odatda talab qilinmaydi).

## Agentliklar

- Agentlik Profil → "Agentlik kabineti" orqali ro'yxatdan o'tadi (telefon tasdiqlangan bo'lishi kerak), litsenziya/ro'yxatdan o'tish rasmlarini yuklaydi (6 tagacha).
- Admin → **Agentliklar**: ma'lumot va hujjatlarni ko'radi → "Tasdiqlash" yoki "To'xtatish" (to'xtatilsa, turlari lentadan yo'qoladi).
- Tasdiqlangan agentlik tur qo'shadi (narx, joylar, nima kiradi, dastur). Tur lentada "agentlik turi" sifatida chiqadi; odam "Ariza qoldirish"ni bosadi.
- Agentlik arizani qabul qilsa: ariza egasi bilan **shaxsiy chat** ochiladi va faqat shundan keyin telefon raqami agentlikka ko'rinadi. Bron qilingach "Bron qilindi" belgisi summa bilan qo'yiladi — joylar avtomatik kamayadi.
- **Komissiya hisobi:** Admin → Agentliklar → "Arizalar va bronlar (CSV)": davr tanlab yuklab oling (agentlik, tur, ariza, qabul, bron sanasi, summa). Platforma pul olmaydi; bu faqat hisob-kitob uchun asos.

## Klublar

Telefoni tasdiqlangan har kim 3 tagacha klub ochadi (ochiq yoki so'rov bilan). Klub tashkilotchisi klub nomidan safar ochadi. Qoidabuzar klubni Admin → Klublar'da yashirish mumkin.

## Telegram guruhni safarga bog'lash

1. Tashkilotchi safar sahifasida "Telegram guruh" bo'limini ochadi va **kod** oladi (30 daqiqa amal qiladi).
2. Safarchilar uchun Telegram'da guruh ochiladi, **bot** guruhga qo'shiladi va **administrator** qilinadi (taklif havolasi yaratish va e'lon qadash uchun shart).
3. Guruhda tashkilotchi `/link KOD` yozadi. Kodni faqat safar tashkilotchisining Telegram akkaunti qabul qiladi; bitta safarga bitta guruh, bitta guruhga bitta safar.
4. Shundan keyin chatdagi qadalgan e'lon, so'rovnoma va sana o'zgarishi guruhga ham yuboriladi. Qabul qilingan a'zo "Guruhga taklif" tugmasi bilan **bir martalik** havola oladi (1 kun, 1 kishi).
5. Bot guruhdan chiqarilsa, bog'lanish eskirib qoladi: "uzish" tugmasi bilan qayta bog'lash mumkin.

Ishlashi uchun botda `my_chat_member` yangilanishlari yoqilgan (kodda `allowed_updates` ichida).

## SMS (ixtiyoriy, pulli)

- Faqat zaxira yo'l: bot xabarni yetkaza olmasa (foydalanuvchi botni bloklagan), **faqat SOS va yaratuvchi taklifi** SMS bo'lib ketadi.
- Shartlar: foydalanuvchi profilida "SMS orqali ham xabar" ni yoqqan, telefoni tasdiqlangan, kuniga 3 tadan oshmagan. Rozilik bermagan odamga SMS ketmaydi.
- Provayder: Eskiz.uz (faqat O'zbekiston raqamlari). Worker env: `SMS_PROVIDER=eskiz`, `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, ixtiyoriy `ESKIZ_FROM` (default `4546`). Env bo'sh bo'lsa SMS butunlay o'chiq va profilda tugma ko'rinmaydi.
- Eskiz akkaunti va balansni to'ldirish — eganing ruxsati va puli bilan.

## Ochiq hikoya sahifasi

- Safar tugagach (holati "tugagan") albom sahifasida har bir a'zo o'zi "roziman" belgisini qo'yadi.
- **Hamma** tasdiqlangan a'zo (kamida ikki kishi) rozi bo'lsagina `/uz/s/<kod>` ochiladi. Bitta odam rozilikni qaytarsa, sahifa va rasmlar darrov yopiladi.
- Sahifada faqat ism, rasmlar va hikoyalar bor; telefon yoki aloqa ma'lumoti yo'q. Qidiruv tizimlariga yopiq (`noindex`), faqat havola orqali ulashiladi.
- Agentlik turlari uchun ochiq hikoya yo'q.

## Klub reytingi

Klub baholari — klub safarlarida qatnashganlar bir-biriga bergan ko'rinadigan baholarning o'rtachasi. **3 tadan kam** baho bo'lsa raqam ko'rsatilmaydi (faqat "o'tgan safarlar soni"); yashirilgan sharhlar hisobga olinmaydi.
