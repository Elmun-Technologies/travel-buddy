# PRD — Travel Buddy (ishchi nom) MVP

> Mahsulot talablari hujjati. Manba: repo ildizidagi `CLAUDE.md` (to'liq topshiriq).
> Brend nomi hali tanlanmagan — hamma joyda `APP_NAME` o'zgaruvchisidan olinadi.
> Sana: 2026-11-14 · Holat: qoralama (0-bosqich)

---

## 1. Mahsulot nima

**Kategoriya:** ijtimoiy sayohat marketpleysi — sayohatga sherik topish va guruhli safarlar.

**Muammo:**

- Odam chet elga (Gruziya, Turkiya, Qozog'iston, Tailand...) bormoqchi, lekin sherigi yo'q, do'stlari bilan sana mos kelmaydi yoki yolg'iz borishdan qo'rqadi.
- Turagentliklar guruhlarini to'ldira olmaydi.

**Yechim — uch qadam:**

1. **Odam topish** — yo'nalish, sana, budjet, uslub va yosh bo'yicha mos sayohatchilar.
2. **Guruhga qo'shilish** — mustaqil sayohatchi yoki agentlik ochgan shakllanayotgan guruh.
3. **Ariza (bron)** — agentlik turiga ariza qoldiriladi, agentlik o'zi bog'lanadi va bronni tasdiqlaydi.

## 2. O'zgarmas strategik qarorlar

| Qaror            | Tanlov                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------- |
| Biznes modeli    | Gibrid: mustaqil sayohatchilar + turagentliklar                                         |
| Bozor            | Global loyiha, birinchi bozor — O'zbekiston (Toshkent)                                  |
| Mahsulot         | Web platforma + Telegram (bot va Mini App), keyin mobil ilova                           |
| Brend            | Yangi xalqaro brend, nomi `APP_NAME` dan olinadi                                        |
| Auditoriya       | 18+ hammaga ochiq, marketing segmenti 18–35 yosh                                        |
| Kim safar ochadi | Har qanday tasdiqlangan foydalanuvchi va tasdiqlangan agentliklar (ikki xil e'lon turi) |
| Bron             | MVP'da faqat "ariza → agentlik tasdiqlaydi". Platformada to'lov yo'q                    |
| Huquqiy model    | Platforma — vositachi. Shartnoma va pul agentlik bilan sayohatchi o'rtasida             |
| Tillar           | O'zbek (lotin, asosiy), rus, ingliz                                                     |

## 3. Pul topish modeli

MVP'da pul olinmaydi, faqat hisob yuritiladi:

- Agentlikka yetkazilgan har bir ariza (lead) va tasdiqlangan bron bazada qayd etiladi. Keyinchalik shu asosda komissiya yoki ariza uchun haq olinadi.
- Agentliklar uchun obuna tariflari va sayohatchilar uchun premium — MVP'dan keyin. Hozircha faqat ma'lumot tuzilmasi tayyor turadi.

## 4. Asosiy ko'rsatkich (KPI)

**"Muvaffaqiyatli sayohat uchrashuvlari"** — platforma orqali real safarga aylangan tanishuvlar soni.

O'lchanadigan voronka:
ro'yxatdan o'tish → profil → moslik → chat → guruhga qo'shilish → ariza → bron → safar → sharh.

## 5. Foydalanuvchilar va ularning imkoniyatlari

### 5.1 Sayohatchi

1. Telegram yoki Google orqali kirish. Profilni 3 daqiqadan kam vaqtda to'ldirish.
2. Safar ochish (2 daqiqada) yoki safar ochmasdan "sherik izlayapman" niyatini qoldirish.
3. Lenta: ochiq safarlar va agentlik turlari. Davlat, oy, budjet va uslub bo'yicha filtrlar.
4. Tavsiya etilgan odamlar va guruhlar, "nega mos" izohi bilan.
5. Guruhga qo'shilish so'rovi: organizator qabul yoki rad qiladi, qabul qilinganlar guruh chatiga kiradi.
6. Yakkama-yakka va guruh chati. Shikoyat (report) va bloklash.
7. Agentlik turiga ariza qoldirish.
8. Safardan keyin sharh va baho.
9. Telegram Mini App — xuddi shu web ilova, Telegram ichida ochiladi.

### 5.2 Agentlik

1. Ro'yxatdan o'tish, hujjatlarni yuklash va admin tasdig'ini kutish.
2. Kompaniya profili.
3. Tur yaratish va tahrirlash: yo'nalish, sanalar, kunma-kun dastur, narx, narxga nimalar kiradi, joylar soni, pulni qaytarish shartlari.
4. Arizalar qutisi: arizani qabul yoki rad qilish, ariza egasi bilan chat.
5. Bron holatini belgilash.
6. Oddiy statistika: ko'rishlar, arizalar, bronlar, guruhning to'lish darajasi.

### 5.3 Admin

1. Foydalanuvchilar, safarlar va agentliklar ro'yxati, qidiruv.
2. Agentliklar va shaxsni tasdiqlovchi hujjatlarni (ID) tekshirish.
3. Shikoyatlar navbati: e'lonni yashirish, foydalanuvchini bloklash.
4. Arizalar va bronlar hisobi, komissiya uchun CSV eksport.
5. Asosiy voronka ko'rsatkichlari.

### 5.4 Ochiq sahifalar (qidiruv tizimlari uchun)

- Landing sahifa (3 tilda) va kutish ro'yxati (waitlist). **1-bosqichda chiqadi**, chunki reklama boshlanishidan oldin talabni o'lchash kerak.
- Har bir ochiq safar va tur uchun alohida sahifa. Telegram va Instagram'da ulashilganda chiroyli ko'rinadigan rasm (OG rasm) bilan.
- Yo'nalish sahifalari, masalan `/uz/trips/georgia`.
- Foydalanish shartlari, maxfiylik siyosati va xavfsizlik qoidalari. Matnning shablonini dasturchi yozadi, **yakuniy matnni yurist tekshirishi shart**.

## 6. Ishonch va xavfsizlik

1. **Asosiy kirish — Telegram.** Web'da Telegram Login vidjeti, Mini App ichida Telegram imzolagan ma'lumot. Imzo serverda tekshiriladi va 24 soatdan eski bo'lmasligi kerak.
2. **Telefonni tasdiqlash bepul, bot orqali** amalga oshadi: foydalanuvchi "Raqamni ulashish" tugmasini bosadi va raqam haqiqatan uning o'ziniki ekani tekshiriladi.
3. Qo'shimcha kirish usuli — Google. SMS orqali tasdiqlash keyinroq qo'shiladi (masalan, Eskiz.uz orqali), kodda unga joy tayyor turadi.
4. **Faqat 18+.** Tug'ilgan sana majburiy, 18 yoshdan kichiklar ro'yxatdan o'ta olmaydi.
5. **Tasdiq belgilari** profilda ko'rinadi: Telegram ✓, telefon ✓, ID ✓. MVP'da ID qo'lda tekshiriladi: foydalanuvchi hujjat rasmi va selfi yuklaydi, admin tasdiqlaydi. Fayllar yopiq omborda saqlanadi va tasdiqdan 30 kun o'tib avtomatik o'chiriladi. Bazada faqat tekshiruv holati qoladi.
6. **Shikoyat va bloklash** har bir profil, safar va xabarda bor. Bir-birini bloklagan odamlar bir-birini hech qayerda ko'rmaydi.
7. **"Faqat ayollar" guruhi:** bunday safarga faqat profilida ayol deb ko'rsatgan va telefoni tasdiqlangan foydalanuvchilar qo'shila oladi. Jins ma'lumoti faqat shu maqsadda ishlatiladi. Uni ochiq profilda ko'rsatish-ko'rsatmaslikni foydalanuvchi o'zi hal qiladi.
8. **Telefon raqami hech qachon ochiq ko'rsatilmaydi.** Agentlik ariza egasining kontaktini faqat arizani qabul qilgandan keyin ko'radi.
9. **Suiiste'molga qarshi cheklovlar:** ro'yxatdan o'tish, xabar yuborish, ariza va shikoyatlar soni cheklanadi.
10. Adminning har bir harakati jurnalga yoziladi.
11. **Akkauntni o'chirish:** foydalanuvchi akkauntini o'zi o'chira oladi va shaxsiy ma'lumotlari 30 kun ichida butunlay o'chadi (Yevropa GDPR qoidalariga tayyor).
12. **"Favqulodda holat" sahifasi:** har bir davlat bo'yicha mahalliy favqulodda raqamlar va platforma qo'llab-quvvatlash xizmatining kontakti.

## 7. Moslik (matching) qoidalari

**Majburiy shartlar** — bulardan biri bajarilmasa, tavsiya berilmaydi:

- bir xil davlat;
- sanalar kesishadi (moslashuvchanlik kunlari hisobga olinadi);
- ikkala tomon ham faol;
- bir-birini bloklamagan;
- yosh ikki tomonlama mos;
- "faqat ayollar" sharti bajariladi.

**Moslik balli (0–100):**

| Omil                                              | Og'irlik |
| ------------------------------------------------- | -------- |
| Yo'nalish (shahar ham mos bo'lsa, ball yuqoriroq) | 25       |
| Sanalar kesishishi                                | 20       |
| Budjet kesishishi                                 | 15       |
| Sayohat uslubi                                    | 15       |
| Qiziqishlar                                       | 10       |
| Yosh yaqinligi                                    | 10       |
| Umumiy til                                        | 5        |

- Har bir tavsiyada "nega mos" izohi bo'ladi, masalan: "Ikkalangiz ham 20–26-noyabr, trekking, budjet $500–650".
- Og'irliklar sozlamalarda turadi, ularni kodni o'zgartirmasdan tuzatish mumkin.
- Bitta tavsiya 7 kun ichida qayta ko'rsatilmaydi.
- Yangi mos safar yoki odam paydo bo'lganda Telegram orqali xabar yuboriladi, kuniga ko'pi bilan 3 ta.

## 8. MVP'ga kirmaydi

Platformada to'lov, aviachipta va mehmonxona broni, sun'iy intellektli sayohat rejalashtiruvchi, hamyon (wallet), sodiqlik dasturi, telefon uchun alohida ilova.

## 9. Qabul mezonlari ("tayyor bo'ldi" degani)

1. Yangi foydalanuvchi profilni 3 daqiqadan kam vaqtda yaratadi.
2. Safar e'loni 2 daqiqada joylashtiriladi.
3. Mos safarlar va odamlar "nega mos" izohi bilan ko'rinadi.
4. Guruhga so'rov yuboriladi, organizator uni qabul yoki rad qiladi, qabul qilinganlar guruh chatiga kiradi.
5. Agentlik tur yaratadi va tahrirlaydi, arizani qabul qiladi, bron holatini belgilaydi.
6. Admin soxta e'lonni yashiradi, foydalanuvchini bloklaydi, agentlikni tasdiqlaydi.
7. Shikoyat va bloklash ishlaydi, bloklanganlar bir-birini ko'rmaydi.
8. Hamma narsa 3 tilda bor va telefonda hamda Telegram Mini App ichida qulay ishlaydi.
9. Ma'lumotlar bazasining zaxira nusxasi har kuni olinadi va undan tiklash sinab ko'rilgan.
10. Serverdagi boshqa loyihalar bu loyiha tufayli sekinlashmagan. RAM o'lchovlari hisobotda keltiriladi.

## 10. Bosqichlar

| Bosqich | Mazmuni                                                                                    |
| ------- | ------------------------------------------------------------------------------------------ |
| 0       | Tekshiruv va reja (kod yo'q)                                                               |
| 1       | Poydevor va landing + kutish ro'yxati, avtomatik deploy, staging, zaxira nusxa             |
| 2       | Kirish (auth), profil, safarlar, lenta, guruhga qo'shilish                                 |
| 3       | Moslik (matching) va Telegram bildirishnomalari                                            |
| 4       | Chat, shikoyat va bloklash, cheklovlar, admin moderatsiyasi                                |
| 5       | Agentliklar: tasdiqlash, turlar, arizalar, bronlar, statistika                             |
| 6       | Launch'ga tayyorgarlik: sharhlar, SEO, analitika, yuklama sinovi, qo'llanmalar, production |

## 11. Qat'iy taqiqlar (egadan ruxsatsiz hech qachon)

- Serverni qayta yuklash, Coolify'ni yangilash, boshqa loyihalarga tegish.
- Biror narsani o'chirish (shu loyiha uchun yaratilgan staging resurslari bundan mustasno).
- DNS yozuvlarini o'zgartirish.
- Pulli xizmatni yoqish yoki yangi server ochish.
- Production'ga deploy qilish.
- Maxfiy kalitlarni kodga yoki loglarga yozish.
- Production'da soxta foydalanuvchi, safar yoki sharh yaratish. Test ma'lumotlari faqat lokal va staging'da bo'ladi va "TEST" deb belgilanadi.
- Raqobatchilarning saytlaridan ma'lumot yig'ish (scraping).
