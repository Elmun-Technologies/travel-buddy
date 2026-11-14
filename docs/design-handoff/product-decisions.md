# Mahsulot qarorlari — dizayn bilan birga keladi

Bu fayl dizayndagi "nega shunday?" degan savollarga javob beradi. `plan-v2-task.md` bilan zid joy bo'lsa, **shu fayl ustun**.

---

## 1. Ovoz va matn (copywriting)

Sayt va ilova odam bilan do'stona gaplashadi: "biz" va "siz", jonli fe'llar, qisqa jumlalar.

| Qilmaymiz | Qilamiz |
|---|---|
| "Sherik toping", "Guruhga qo'shiling" | "Sherik topamiz", "Guruh yig'amiz", "Yo'lga chiqamiz!" |
| "Telegram'da boshlash", "Ilovani ochish" | "Menga sherik toping", "Sherik qidiramiz ↗", "Boshlaymiz" |
| "Qo'shilish so'rovini yuborish" | "Men ham boraman!" |
| "Safarni e'lon qilish" | "Safarni ochamiz" |
| "Platforma faqat hisob yuritadi" | "Biz faqat hisoblab beramiz — pul o'zingizda qoladi" |
| "Moderatsiyadan so'ng ko'rinadi" | "Bir necha daqiqada ko'rinadi" |

Qoidalar:
- **Mexanika ko'rinmasin.** Foydalanuvchi "so'rov", "tasdiqlash", "moderatsiya", "algoritm" so'zlarini deyarli ko'rmasin. Faqat natijani ko'radi: "Akmal javob berishi bilan xabar beramiz".
- Tugma — harakat va natija: "Men ham boraman", "Shu reysni qidiraman", "Guruhga narx so'raymiz".
- Bitta ekranda bitta asosiy fikr. Uzun izoh o'rniga foto va raqam.
- Emoji ishlatilmaydi, belgilar — SVG ikonka.
- Barcha matnlar `next-intl` orqali uz/ru/en'da. Ruscha va inglizcha tarjima ham shu ohangda bo'lsin, so'zma-so'z emas.

## 2. Safar ochish — 3 qadam

Ilgari bitta uzun forma edi, endi 3 ta ekran:

1. **Qayerga va qachon?** Foto-kartali yo'nalishlar va qidiruv. Sana: "Shu oy / Keyingi oy / Aniq sana" va "±2 kun bo'lsa ham mayli".
2. **Kim bilan, qanday?** Necha kishi (stepper), budjet chip'lari, uslub (profildan oldindan to'ldiriladi), "Faqat ayollar" tumbleri, ixtiyoriy bir-ikki so'z.
3. **Tayyor — endi odam yig'amiz.** Safar kartasining "do'stlaringiz shunday ko'radi" ko'rinishi va ulashish tugmalari.

Yosh oralig'i, batafsil reja va qoidalar keyin, guruh bilan birga Safar xonasida qo'shiladi. Maqsad: safar 60 soniyada ochilsin.

## 3. Ulashish — loyiha o'zini o'zi reklama qiladi

**Bonus, referal ball va pul mukofoti yo'q.** Ulashish faqat qulaylik uchun: "o'rtog'im ham borsin".

Ulashish nuqtalari:

| Joy | Tugma |
|---|---|
| Safar ochilgandan keyin (3/3) | Telegram'da yuborish · Havolani nusxalash · Story uchun rasm |
| Safar sahifasi | Sarlavhadagi ulashish ikonkasi va "Do'stingiz ham borsinmi? → Yuborish" kartasi |
| Safar xonasi (chat) | "7/10 · 3 joy bo'sh. Kimnidir chaqiramizmi? → Chaqirish" |
| Klub sahifasi | "Ulashish" |
| Taassurotlar | "Do'stlarga ko'rsatamiz" — hamma rozi bo'lsa ochiq hikoya sahifasi |
| Ochiq hikoya sahifasi (web) | "Men ham boraman" va shunga o'xshash keyingi safarlar |

Texnik talablar:
- Har bir safar, klub va hikoyaning havolasi: `t.me/<bot>?startapp=trip_<id>` (Mini App ichida ochiladi) va web nusxasi `/{locale}/t/<id>`.
- **OG rasm** avtomatik yaratiladi: foto, sarlavha, sana, "7/10 joy" va "Men ham boraman". Telegram'da ham, Instagram'da ham chiroyli ko'rinsin.
- **Story rasmi** 1080×1920 PNG, xuddi shu karta.
- Havola orqali kirgan yangi odam avval safarni ko'radi, ro'yxatdan o'tish keyin keladi.
- Telegram `switchInlineQuery` va `shareURL` bilan bir bosishda yuborish.
- Analitika (PostHog): `share_clicked {channel, object}` va `share_link_opened`. Bu odamlarni kuzatish uchun emas, qaysi tugma ishlayotganini bilish uchun.
- Spam bo'lmasin: kontaktlarni import qilish, ommaviy taklif va avtomatik xabarlar yo'q.

## 4. Chipta va tur — "Yig'amiz" bo'limi

**Muammo:** guruh yig'ildi, sana aniq. Endi chipta, joy va tur qayerdan olinadi?

**Qaror:** platforma bitta yo'lni majburlamaydi. Safar xonasida yangi **"Yig'amiz"** tab bor, unda guruh ikki yo'ldan birini tanlaydi.

### A. "O'zimiz yig'amiz" — standart yo'l, MVP'da shu
- **Chipta.** Guruh reys variantlariga ovoz beradi. Har kim chiptani **o'zi** oladi, Aviasales havolasi orqali. Havolada yo'nalish va sana oldindan qo'yilgan bo'ladi: Travelpayouts shunday deep link yaratishga imkon beradi.
  - Kim olgani avatarlarda ko'rinadi: "4/7 chipta oldi".
  - Havola Travelpayouts affiliate markeri bilan beriladi. Komissiya chipta narxining taxminan 1–1,3 foizi; aniq shartlarni Travelpayouts kabinetidan tekshirish kerak.
- **Joy.** Variantlarga ovoz beriladi. G'olibni bitta odam band qiladi, summa avtomatik "Xarajat"ga tushib, teng bo'linadi. Hotellook/Booking havolalari ham affiliate bo'lishi mumkin.
- **Pul platformadan o'tmaydi.** Biz hisob yuritamiz, xolos.

### B. "Tayyor tur so'raymiz" — hamkorlar orqali
- Guruh "Guruhga narx so'raymiz" tugmasini bosadi. So'rovda yo'nalish, sana, kishilar soni, budjet va uslub bo'ladi; shaxsiy ma'lumot yo'q.
- So'rov **tekshirilgan** (litsenziyasi va sharhlari ko'rilgan) agentliklarga ketadi. Ular aynan shu guruh uchun narx yuboradi: nima kiritilgan, narx, amal qilish muddati.
- Guruh takliflarni solishtiradi, ovoz beradi va tanlaydi. Agentlik bilan aloqa tanlangandan keyingina ochiladi.
- **Tartib faqat narx va baho bo'yicha.** Pulli "yuqoriga chiqarish" yo'q, takliflar "Hamkor taklifi" deb belgilanadi.
- Safardan keyin agentlikka ham baho qo'yiladi.
- **Daromad:** agentlik qabul qilingan guruh uchun to'laydi (lid yoki komissiya). Sayohatchidan pul olinmaydi.

### Nega aynan shunday
- Odamlar bizga **sherik** uchun keladi, tur uchun emas. Faqat agentlik turlarini ko'rsatsak, ishonch yo'qoladi va biz yana bir "tur vitrinasi"ga aylanib qolamiz.
- Faqat Aviasales bilan ishlasak, 7–10 kishini bitta reys va bitta uyga yig'ish og'ir bo'ladi. Ovoz berish va "kim oldi" ro'yxati shu muammoni yechadi.
- Dengiz va kurort yo'nalishlarida tayyor paket qulayroq bo'lishi mumkin. Shuning uchun B yo'l ham bor, lekin tanlov guruhda.

### Bosqichlar
| Bosqich | Nima |
|---|---|
| MVP | A yo'l to'liq. B yo'l **qo'lda**: so'rov admin panelga va 3–5 hamkor agentlikning Telegram'iga boradi, admin javoblarni kiritadi |
| V2 | Agentlik kabineti, takliflar oqimi, komissiya hisobi, agentlik bahosi |

## 5. Tanishuv ilovasi emas (o'zgarmaydi)
- Odamlarni swipe yoki like qilish yo'q, faqat safar va guruhlar tanlanadi.
- Kartaning asosiy rasmi joy fotosi bo'ladi. A'zolar kichik avatarlar to'plami sifatida ko'rinadi.
- "Kimni qidiryapsiz?" maydoni va jins bo'yicha filtr yo'q. "Faqat ayollar" — safar turi.
- 1:1 xabar faqat bitta tasdiqlangan safar a'zolari orasida.
- Ochiq safar 3+ kishidan boshlanadi.
- "Tanishuv maqsadida yozmoqda" shikoyati tezkor blokka va 24 soatda moderatsiyaga olib keladi.

## 6. Fotolar
- `assets/photos/` dagi fotolar Unsplash'dan olingan, Unsplash License bo'yicha bepul. Manbalar `assets/photos/CREDITS.md` da.
- Prod'da tartib shunday: avval tashkilotchi yuklagan haqiqiy foto. Bo'lmasa, yo'nalish fotosi `destinations` jadvalidan (admin yuklaydi, S3'da turadi).
- Bitta odamning portreti hech qachon kartaning asosiy rasmi bo'lmaydi.
- Fotoni `next/image` orqali, `object-fit: cover` bilan bering. Asosiy obyekt kesilib qolmasligi uchun `focal_point` maydoni bo'lsin.

## 7. Namunaviy ma'lumot
Dizayndagi ismlar, sharhlar, narxlar, reys vaqtlari va agentlik nomlari ("Silk Way Tours", "Caucasus Trip") **namuna**. Prod bazaga soxta foydalanuvchi, safar yoki sharh qo'shilmaydi. Seed ma'lumot faqat `APP_ENV=development` da.

## 8. "1M Safar" — sayohatchilar bizning reklamamiz bo'ladi

**Taklif:** sayohatga borgan odam Reels oladi. Video **1 mln organik ko'rish** yig'sa, aviachipta, mehmonxona va transfer xarajatini **$1 000 gacha** qoplaymiz. Ovqat, xarid va shaxsiy xarajatlar qoplanmaydi.

**Nega bu foydali (raqamlar):**
- 1 mln ko'rishga $1 000 — bu har 1 000 ko'rishga **$1** degani.
- Instagram'da bloger bilan reklama odatda har 1 000 ko'rishga $6–18 turadi.
- Reels reklamasi o'rtacha $4–6.
- Ya'ni biz faqat natijaga to'laymiz va bu bozordan ancha arzon.

**Qanday ko'rsatiladi — yashirin taklif (egasi qarori).** Dastur oldindan e'lon qilinmaydi: landing'da, bosh sahifada, reklamada va ijtimoiy tarmoqlarda yo'q. U faqat safar paytida keladigan motivatsiya bo'ladi.

Kanallar:
- **Safarning 2-kuni, mahalliy vaqt bilan ertalab** — Telegram bot shaxsiy xabar yuboradi: "Gruziyada 2-kun · siz uchun". Shartlar sahifasiga havola bo'ladi (`Bot-Start` dagi oxirgi xabar). Faqat ilovada ochilgan va boshlangan safar a'zolariga yuboriladi.
- **Bot bloklangan bo'lsa** — SMS. Matn qisqa, ichida bitta havola: "Travel Buddy: Gruziya safaringiz uchun shaxsiy taklif — <havola>". SMS faqat telefoni tasdiqlangan va xabar olishga rozilik bergan foydalanuvchiga ketadi.
- **Safardan keyin** — Taassurotlar ekranida "1M Safar · N kun qoldi" eslatmasi (`App-Memories`). Kartani faqat taklif olganlar ko'radi.
- Shartlar sahifasi (`Web-Creator`) faqat shaxsiy havola orqali ochiladi: `noindex`, menyuda ham, sitemap'da ham yo'q.

Nega shunday:
- kontent samimiy bo'ladi;
- odamlar "pul uchun" safarga chiqmaydi;
- fond oldindan aytib bo'ladigan miqdorda sarflanadi;
- taklif yoqimli kutilmagan sovg'a kabi qabul qilinadi va ilovani eslab qolishadi.

**Qaror (egasi):** faqat bitta chegara bor. 1 000 000 organik ko'rish yig'ilsa, hujjatlangan xarajat $1 000 gacha qoplanadi. 999 999 ko'rish bo'lsa — qoplanmaydi. Qisman to'lov yo'q.

**Qoidalar:**
- Safar ilovada **ketishdan oldin** belgilangan bo'ladi (guruh bilan yoki yolg'iz). Shu tufayli dastur ilova ishlatilishini oshiradi.
- Reels qaytgandan keyin 30 kun ichida joylanadi, @akkaunt va #1MSafar belgilanadi.
- Ko'rishlar joylangandan keyin 30 kun ichida hisoblanadi.
- Instagram **professional** akkaunt ulanadi va ko'rishlar Instagram API orqali avtomatik o'qiladi: Reels uchun `views` metrikasi.
- Reklama bilan ko'tarilgan (boost) Reels hisoblanmaydi. API'da `total_views` reklama ko'rishlarini ham qo'shadi; `views` bilan farqi katta bo'lsa — rad etiladi.
- Sotib olingan ko'rish aniqlansa, dasturdan butunlay chiqariladi.
- Bir kishiga yiliga bir marta, 18+.
- Qoplash cheklar va bronlar bo'yicha, yakuniy hisobdan keyin 5 ish kunida.
- Video muallifniki. Biz muallifni ko'rsatib qayta joylash huquqini so'raymiz — shu bilan kontent kutubxonasi yig'iladi.
- **Oylik fond** cheklangan va sahifada ochiq ko'rsatiladi. Fond tugasa, navbat keyingi oyga o'tadi.
- Kontent hurmatli va rost bo'lishi kerak. Davlat yoki odamlar haqida haqoratli yoki yolg'on video qoplanmaydi.

**Huquqiy:** to'lov sovrin emas, xarajatni qoplash shaklida. Soliq (qabul qiluvchining daromadi bo'ladimi), shartnoma va oferta matni ishga tushirishdan oldin yurist bilan tekshirilsin.

**Kengayish:**
1. **Kirish turizmi (O'zbekistonga):** "Film Uzbekistan" — chet ellik sayyoh 1 mln ko'rishli video olsa, safari qoplanadi.
   - Turizm qo'mitasiga taklif: oldindan to'lov emas, faqat natijaga to'lov va jonli dashboard.
   - Bunga mos yo'nalish allaqachon bor: 2026-yildan har yili "Ochiq turizm mavsumi" o'tkaziladi va unda 5 mln+ obunachili 50 ta chet ellik blogerga bepul safar beriladi.
   - Bizning model oddiy sayyohlarni ham shu ishga jalb qiladi. Hamkorlik shartnoma imzolanmaguncha sahifada "konsept" deb yoziladi.
2. **Boshqa davlatlar:** Qozog'iston, Gruziya, Turkiya va boshqalarning turizm idoralari bilan xuddi shu model. Bu kelajakdagi B2G daromad: dasturni yuritish uchun haq va dashboard.

Ekranlar: `App-Creator`, `App-Creator-Track`, `Web-Creator`, `Web-Inbound`; bosh sahifa va landing'da banner.

## 9. Loyihani qimmatli qiladigan yechimlar (real muammolar)

**Qaror:** 1–5-bandlar qabul qilindi va ekranlari chizildi.

"Yana bitta ilova" bo'lmasligimiz uchun har bir funksiya aniq og'riqni yechadi.

| # | Muammo | Yechim | Qachon |
|---|---|---|---|
| 1 | "Pasportim bilan qayerga vizasiz boraman, qanday hujjat kerak?" | **Viza va hujjatlar** (`App-Visa`): har bir davlat uchun O'zbekiston pasporti bo'yicha "Vizasiz / Viza kerak", muddat, hujjatlar ro'yxati. **Viza kerak bo'lsa — hamkor viza agentliklari** (narx, baho; tartib faqat baho bo'yicha). Lentada "Vizasiz" filtri, davlat sahifasida viza bloki. Ma'lumot sanasi ko'rsatiladi va "elchixona saytida tekshiring" eslatmasi bo'ladi. Ma'lumot admin panelda yuritiladi | Ishga tushishdan oldin |
| 2 | "Aslida qancha pul ketadi?" | **Haqiqiy narx** (`App-Price`): guruhlarning Xarajat ma'lumotidan **xona turi bo'yicha** (4 kishilik / 2 kishilik / yakka) "odatda $X, ko'pchilikda $A–$B" va moddalar bo'yicha taqsimot. **Agentlik takliflari aynan shu tarkibda so'raladi** (kishilar soni, xona turi, kunlar), shuning uchun taklif bozor narxi bilan yonma-yon ko'rinadi. Kamida 5 ta safar ma'lumoti bo'lmaguncha muharrir bahosi "taxminiy" belgisi bilan | Ishga tushishdan oldin (muharrir), keyin avtomatik |
| 3 | Ota-ona va yaqinlar xavotiri, ayniqsa qizlar uchun | **"Yaqinlarimga ko'rsataman"** (`App-Family`): sayohatchining o'zi yuboradigan havola. Unda tashkilotchi tekshiruvi, guruh soni va ayol/erkak nisbati (profillar emas), reja va joylar, "Hammasi joyida" belgisi, davlatning favqulodda raqami va elchixona ko'rinadi. Havolani istalgan payt o'chirib qo'yish mumkin | Ishga tushishdan oldin |
| 4 | Odamlar va'da berib, keyin kelmaydi | **So'zida turish**: "Yig'amiz"da chipta olish muddati; muddatda belgilamagan kishining joyi navbatdagiga beriladi. Profilda va tashkilotchi qatorida "N/N safarga bordi" yozuvi. Kelmaganlar ro'yxatda pastga tushadi | Ishga tushishdan oldin |
| 5 | Safar paytida biror narsa bo'lsa-chi? | **SOS** (`App-SOS`, safar xonasining sarlavhasida qizil tugma): 3 soniya bosib turilganda joylashuv guruhga va ishonchli kontaktga ketadi. Bundan tashqari "Hammasi joyida" belgisi, joylashuvni 1 soat ulashish, davlatning favqulodda raqami (masalan, Gruziyada 112) va elchixona | Ishga tushishdan oldin |
| 6 | Halol ovqat, namoz joyi | Filtr va davlat sahifasida qisqa qo'llanma | Keyin |
| 7 | "Uzcard/Humo u yerda ishlaydimi?" | Davlat sahifasida "Pul va kartalar" bloki | Keyin |
| 8 | Til bilmaslik | Moslikda "guruhda kim qaysi tilni biladi" | Keyin |

**Bizning himoyamiz (raqobatchi oson ko'chira olmaydi):**
- haqiqiy safarlardan yig'ilgan ishonch va sharhlar;
- haqiqiy narxlar bazasi;
- 1M Safar'dan yig'ilgan kontent kutubxonasi;
- agentliklar uchun tayyor guruh talabi.

## 10. Katta marketingdan oldin (2027 yanvar)

Katta byudjet tikishdan oldin dekabrda kichik byudjet bilan yumshoq ishga tushirish va o'lchash kerak:
- ochilgan safarlarning necha foizi 3+ kishiga yetadi;
- guruh necha kunda to'ladi;
- nechta safar haqiqatda amalga oshdi;
- nechta odam ikkinchi marta qaytdi.

Maqsadli raqamlarni jamoa belgilaydi. Raqamlar yaxshi bo'lsa, byudjet oshiriladi. Yomon bo'lsa, avval mahsulot tuzatiladi. Aks holda reklama puli bo'sh ilovaga ketadi.
