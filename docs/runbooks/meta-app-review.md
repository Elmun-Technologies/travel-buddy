# 1M Safar: Meta developer ilovasi va App Review — tayyorgarlik ro'yxati

Maqsad: Instagram Reels ko'rishlarini (`views`) avtomatik o'qish, reklama bilan ko'tarilganini aniqlash.
Kod 10-bosqichda yoziladi, lekin Meta tekshiruvi **haftalab** cho'zilishi va rad etilishi mumkin — shuning uchun hozirdan boshlanadi.

> Ruxsat nomlari va talablar Meta tomonidan tez-tez o'zgaradi. Ariza topshirishdan oldin developers.facebook.com'dagi joriy hujjat bilan solishtiraman.

## Kerakli ruxsatlar (taxminiy)

| Mahsulot                                | Ruxsat                                                            | Nima uchun                                       |
| --------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| Instagram API with Instagram Login      | `instagram_business_basic`                                        | Akkaunt va Reels ro'yxati                        |
| Instagram API with Instagram Login      | `instagram_business_manage_insights`                              | Reels `views` metrikasi                          |
| Facebook Login for Business (ixtiyoriy) | `pages_show_list`, `instagram_basic`, `instagram_manage_insights` | Boost tekshiruvi: `total_views` va `views` farqi |

Foydalanuvchida Instagram **professional** (Business yoki Creator) akkaunt bo'lishi shart.

## Egasi tayyorlaydi

1. **Meta developer akkaunt** (developers.facebook.com) — Facebook profil, 2 bosqichli himoya yoqilgan.
2. **Meta Business portfolio** (business.facebook.com) va **Business Verification**:
   - kompaniya guvohnomasi (yuridik nomi, manzil);
   - kompaniya telefoni va emaili;
   - kompaniya domenidagi email yoki domen tasdig'i.
     Bu "Advanced Access" uchun majburiy va o'zi 1–2 hafta olishi mumkin.
3. **Haqiqiy domen.** `sslip.io` manzili ilova, maxfiylik siyosati va callback uchun yaroqsiz bo'lishi ehtimoli katta. Domen olish va DNS — egasining qarori; App Review'dan oldin kerak.
4. Ilova ikonkasi 1024×1024 PNG, ilova nomi (brend tanlangach), aloqa emaili.
5. Test uchun Instagram **professional** akkaunt (kamida 1 ta Reels bilan) — ilovaga "Instagram Tester" qilib qo'shiladi.
6. 1M Safar shartlari va oferta matni — yurist tekshiruvidan o'tgan.

## Men tayyorlayman

1. **Maxfiylik siyosati** sahifasi (`/{locale}/privacy`) — Instagram'dan qanday ma'lumot olinishi, nima uchun, qancha saqlanishi, qanday o'chirilishi aniq yozilgan. Yurist ko'rib chiqadi.
2. **Foydalanish shartlari** sahifasi (`/{locale}/terms`).
3. **Ma'lumotni o'chirish**: ko'rsatma sahifasi + Meta "Data Deletion Callback" endpoint.
4. **Deauthorize callback** (foydalanuvchi ilovani Instagram'dan uzganda).
5. Staging'da ishlaydigan "Instagram'ni ulash → Mening videom" oqimi, test akkaunt bilan.
6. **Demo video (screencast)** — har bir ruxsat uchun:
   - kirish → Meta ruxsat oynasi → ruxsat berish;
   - olingan ma'lumot qayerda ko'rinishi ("Mening videom" ekranidagi ko'rishlar soni);
   - uzish va o'chirish.
     Ingliz tilida interfeys yoki inglizcha subtitr bilan, 1–3 daqiqa.
7. Har ruxsat uchun inglizcha izoh: nima uchun kerak, qanday ishlatiladi, foydalanuvchiga qanday foyda.
8. Tekshiruvchi uchun ko'rsatma: staging havolasi, test login, qadamlar.

## Tartib va muddat

| Qadam                                                                   | Kim                              | Taxminan                                            |
| ----------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------- |
| Developer akkaunt + Business portfolio + Business Verification boshlash | Ega                              | hozir; 1–2 hafta                                    |
| Domen tanlash                                                           | Ega                              | dekabr                                              |
| Privacy, terms, data deletion sahifalari                                | Men                              | 9-bosqich bilan (dekabr)                            |
| Instagram ulash oqimi + demo video                                      | Men                              | 10-bosqich boshida (yanvar)                         |
| App Review topshirish                                                   | Men tayyorlayman, ega topshiradi | yanvar; javob bir necha kundan bir necha haftagacha |

Muhim: tekshiruvdan o'tmaguncha ilova faqat "Tester" qilib qo'shilgan akkauntlar bilan ishlaydi — sinov uchun bu yetadi.
