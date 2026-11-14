# Claude Code uchun topshiriq: Travel Buddy v2 — xato tuzatish, dizayn tizimi va yangi mahsulot rejasi

> Bu faylni loyiha papkasiga `docs/plan-v2-task.md` nomi bilan saqlang va Claude Code'ga yozing:
> "docs/plan-v2-task.md ni to'liq o'qi va 3-bosqichdan boshla."

---

## 0. Nima o'zgardi va qanday ishlaysan

Egasi staging'ni sinab ko'rdi va xulosa qildi: hozirgi mahsulot "onboarding'dan o'tkazib, ma'lumot yig'ish" darajasida. Buni hamma qila oladi. Bizga ustunligi ko'zga tashlanib turadigan, dizayni toza va har bir ekranda "bu nima, men nima qilaman" degan savol tug'dirmaydigan mahsulot kerak.

Shu sababli:
1. Avval onboarding'dagi xato tuzatiladi (3-bosqich).
2. Keyin butun interfeys egasi bergan dizayn uslubida qayta quriladi (4-bosqich).
3. So'ng mahsulotning asosiy ustunliklari quriladi: **Safar xonasi**, **Klublar**, **Taassurotlar** (5–8-bosqichlar).

Qoidalar o'zgarmaydi: `CLAUDE.md` dagi hamma qoidalar (server, xavfsizlik, sirlar, faqat travel-buddy resurslari, production'ga ruxsatsiz chiqmaslik) o'z kuchida. Har bosqich oxirida to'xta va egaga oddiy o'zbek tilida hisobot ber. Hisobotga telefon o'lchamidagi (390×844) asosiy ekranlarning skrinshotlarini qo'sh (`docs/screens/<bosqich>/`).

**Birinchi ishing:**
- Ushbu faylni `docs/plan-v2-task.md` ga saqla (agar hali saqlanmagan bo'lsa).
- `docs/design-system.md` va `docs/plan-v2.md` ni shu fayl asosida yarat.
- `CLAUDE.md` ga tegma, faqat eng oxiriga bitta qisqa bo'lim qo'sh:
  `## Reja yangilandi (v2): docs/plan-v2.md va docs/design-system.md ustun turadi. Eski 3–6-bosqichlar bekor.`

Domen: hozircha tekin `https://wkbm8nvcpkxihom7al7tl4vf.2.29.137.243.sslip.io`. Kodda domen faqat `APP_URL` dan olinadi. Haqiqiy domen oxirida olinadi.

---

## 3-bosqich — Onboarding xatosini tuzatish va barqarorlik

### Egasi ko'rgan xato
Egasi botda `/start` bosdi, Mini App ochildi, onboarding'ni oxirigacha to'ldirdi, lekin oxirgi qadamda ma'lumot yuborilmadi.

### Serverdagi dalil (web konteyner logi, deploy'dan keyin)
```
Error: The Server Reference ID did not match the expected format. Received "x".
Read more: https://nextjs.org/docs/messages/failed-to-find-server-action
    at Object.get (.next/server/chunks/[root-of-the-server]__...js)
...
Error: aborted  { code: 'ECONNRESET' }
```
Bu xato bir necha marta takrorlangan. Ehtimoliy sabablar (o'zing tekshirib, haqiqiysini top):
- Telegram WebView eski build'ning JS'ini keshlab qolgan, server action ID'lari yangi build bilan mos kelmayapti;
- server action ID'lari build'dan build'ga o'zgaradi (`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` yoki `deploymentId` sozlanmagan);
- Mini App ichida forma yuborish usuli (masalan, `initData` bilan) server action formatini buzyapti.

### Talablar
1. Xatoni **Mini App sharoitida** takrorla (Playwright'da Telegram WebView'ni taqlid qilib: `initData`, mobil user-agent, eski build'dan qolgan sahifa).
2. Ildiz sababini tuzat. Muhim formalarni (onboarding, safar yaratish, qo'shilish so'rovi) server action'dan **oddiy API route**'larga (`/api/...`, Zod validatsiya bilan) o'tkazishni ko'rib chiq. Bu Telegram WebView keshidan mustaqil bo'ladi. Qaroringni `decisions.md` ga yoz.
3. Deploy'lar orasida mos kelmaslik bo'lmasin: HTML sahifalar uchun `Cache-Control: no-store`, build'ga barqaror `deploymentId`, eski client bo'lsa yangisini yuklashni so'raydigan "Yangilash" banneri.
4. **Foydalanuvchi kiritgan ma'lumot hech qachon yo'qolmasin.** Onboarding qoralamasi har qadamda saqlansin (avval lokalda, keyin serverda). Xato bo'lsa, tushunarli o'zbekcha xabar va "Qayta urinish" tugmasi chiqsin.
5. **Sentry'ni hozir ulab qo'y** (bepul tarif). DSN'ni ega Coolify'ga qo'yadi, sen faqat env nomini va qadamlarni ayt. Xatolar endi jim o'tib ketmasin.
6. **Test:** onboarding'ni Mini App rejimida boshidan oxirigacha yuboradigan e2e test. Testga "deploy'dan oldin ochilgan eski sahifadan yuborish" holati ham kirsin.

Bosqich oxirida egaga yoz: "Botda /start → onboarding → yuborish endi ishlaydi. Telefonda qayta sinab ko'ring."

---

## 4-bosqich — Dizayn tizimi ("Clay" uslubi) va interfeysni qayta qurish

Egasi o'z loyihalarida ishlatadigan va natija bergan uslubni berdi. U QClay agentligining taqdimotiga asoslangan: toza, aniq, ortiqcha narsa yo'q, hamma narsa konkret. Bu uslubni **nusxalamaymiz**: QClay logotipi, matnlari va rasmlari ishlatilmaydi. Uning **dizayn tilini** o'zimizning brendimizga moslab qo'llaymiz.

### 4.1 Uslubning asosiy tamoyillari
- **Bento grid.** Sahifa katta, yumaloq burchakli panellardan yig'iladi. Har bir panelda bitta fikr bo'ladi.
- **Katta, yengil sarlavhalar.** Yirik, ingichka grotesk shrift, qatorlar zich. Sarlavhaning o'zi gapiradi.
- **Kulrang fon va oq kartochkalar** asosiy holat. Urg'u uchun bitta qora panel yoki bitta ko'k panel.
- **Kam rang, kuchli urg'u.** Ikki aksent rang bor: elektr ko'k va signal sariq. Sariq faqat eng muhim harakatda ishlatiladi: dumaloq "↗" tugma yoki bitta raqam.
- **Pill (kapsula) elementlar.** Konturli kapsula tugmalar, kichik teglar (masalan, "Gruziya · 6 kun"), raqamli belgilar ("01.", "7/10").
- **"Muammo → Yechim" juftligi.** Qora-kulrang kartochka yonida ko'k kartochka. Biz bundan "Ilgari / Endi" tushuntirishlari uchun foydalanamiz.
- **Statistika kartochkasi.** Tepada katta raqam, pastda kichik izoh.
- **Rasm ustidagi sarlavha.** Yumshoq gradient yoki haqiqiy manzara rasmi, ustida oq sarlavha va burchakda dumaloq "↗" tugma.

### 4.2 Tokenlar (`docs/design-system.md` va Tailwind config'ga kirit)
| Token | Qiymat | Qayerda ishlatiladi |
|---|---|---|
| `bg` | `#EDEDED` | Sahifa foni |
| `surface` | `#FFFFFF` | Kartochkalar |
| `surface-dark` | `#0B0B0B` | Urg'u paneli, qorong'i bo'limlar |
| `surface-muted` | `#2A2A2A` | "Ilgari / Muammo" kartochkasi |
| `text` | `#0B0B0B` | Asosiy matn |
| `text-muted` | `#8C8C8C` | Izoh, ikkinchi darajali matn |
| `line` | `#DADADA` | Ingichka chegaralar, jadval panjarasi |
| `accent` | `#0A5CFF` | Asosiy aksent: "Endi / Yechim" paneli, havolalar, faol holat |
| `signal` | `#F3EE1C` | Faqat bosh harakat tugmasi va bitta muhim raqam |
| `success` / `danger` | `#16A34A` / `#E5484D` | Holatlar |

- **Burchaklar:** katta panel 28px (mobilda 22px), ichki kartochka 18px, tugma va teg 999px (kapsula).
- **Bo'shliqlar:** 8 ga karrali. Panellar orasida 8–12px, panel ichida 20–24px.
- **Shrift:** `Inter Tight` (sarlavhalar, og'irligi 400–500, harf oralig'i −0.03em, qator balandligi 1.02) va `Inter` (matn, 15–16px). Ikkalasi ham lotin va kirill harflarini qo'llaydi. `next/font` orqali ulanadi.
- **O'lchamlar (mobil):** H1 40px, H2 28px, H3 20px, matn 15px, teg 12px.
- **Soya:** deyarli yo'q. Ajratish fon rangi va bo'shliq bilan qilinadi.
- **Harakat (animatsiya):** 180–220ms. Bosilganda 0.98 ga kichrayadi, panellar yumshoq paydo bo'ladi. `prefers-reduced-motion` hurmat qilinadi.
- **Ikonkalar:** `lucide`, ingichka chiziq (1.5). Hamma joyda bir xil uslub.

### 4.3 Komponentlar (shadcn ustiga, `src/components/clay/`)
`BentoGrid`, `Panel` (light/dark/accent), `PillButton` (filled/outline), `ArrowButton` (dumaloq ↗, signal/white), `Tag`, `StatCard`, `ImageCard` (rasm + sarlavha + ↗), `CompareCards` (Ilgari/Endi), `ProgressPill` (masalan, "7/10 joy band"), `AvatarStack`, `StepHeader` ("01. / 04."), `EmptyState` (bitta jumla + bitta harakat).

Har bir komponent uchun `/uz/dev/ui` sahifasida namuna bo'lsin. Bu sahifa faqat staging'da ochiladi.

### 4.4 Telegram Mini App qoidalari
- Asosiy ssenariy telefon. Avval Mini App uchun loyihalanadi, keyin web uchun kengaytiriladi.
- Safe area va Telegram'ning `BackButton` / `MainButton` ishlatiladi: har ekranning bosh harakati `MainButton`'da turadi (masalan, "Davom etish", "Safarga qo'shilish").
- Haptik javob: tanlovda `selectionChanged`, muvaffaqiyatda `notificationOccurred('success')`.
- Hozircha faqat yorug' tema. Telegram'ning qorong'i temasi keyingi bosqichga qoldiriladi, lekin tokenlar unga tayyor tursin.

### 4.5 "Bu nima?" degan savol tug'ilmasin — birinchi tanishuv
1. **Bot `/start`.** 3 qatorli xabar: nima ekanini, nima beradi va bitta tugma. Qo'shimcha: "Qanday ishlaydi?" tugmasi, u 3 ta qisqa kartochka bilan javob beradi.
2. **Mini App'ning birinchi ekrani (Welcome).** Bento ko'rinishida:
   - katta sarlavha: "Sayohatga sherik toping.";
   - 3 ta panel: **01. Sherik top** · **02. Guruhga qo'shil** · **03. Birga bor va taassurot qoldir**;
   - "Ilgari / Endi" juftligi: "Telegram guruhlarda tarqoq qidirish" → "Bir joyda: tekshirilgan odamlar, guruh, reja, xarajat";
   - `MainButton`: "Boshlash".
3. **Onboarding:** ko'pi bilan 4 qadam, yuqorida `StepHeader` ("02 / 04") turadi. Har bir savol ostida kichik izoh: "Bu nima uchun kerak". Yosh, jins va telefon nega so'ralishi ham tushuntiriladi.
4. **Bosh sahifa (onboarding'dan keyin):**
   - "Senga mos safarlar" (moslik foizi va "nega mos" izohi bilan);
   - "Shakllanayotgan guruhlar" (`ProgressPill` 7/10);
   - "Klublar";
   - "Taassurotlar" lentasi;
   - har doim ko'rinadigan "+ Safar ochish" tugmasi.
5. **Bo'sh holatlar:** hech qayerda bo'sh oq ekran bo'lmasin. Har bo'sh holatda bitta jumla va bitta harakat turadi.
6. **Soxta kontent yo'q.** Ma'lumot bo'lmasa, aniq "Namuna" belgisi bilan bitta tushuntiruvchi kartochka ko'rsatiladi.

### 4.6 Qayta quriladigan ekranlar
Landing, kirish, Welcome, onboarding, bosh sahifa, safarlar lentasi va filtrlari, safar sahifasi, safar ochish, profil (o'ziniki va boshqaning), so'rovlar (tashkilotchi uchun).

Bosqich oxirida hisobotga har bir ekranning **oldin / keyin** skrinshotlarini qo'sh.

---

## 5-bosqich — Safar xonasi (asosiy ustunligimiz)

Safar tasdiqlangan zahoti uning ishtirokchilari uchun **Safar xonasi** ochiladi. Bu Telegram guruh, Excel jadval va qog'ozdagi ro'yxatning o'rnini bosadigan bitta joy. Bo'limlari:

1. **Chat** (guruh). SSE va Postgres `LISTEN/NOTIFY` orqali ishlaydi. Rasm yuborish, shikoyat qilish va bloklash bor.
2. **E'lonlar.** Tashkilotchi muhim xabarni tepaga qadaydi (masalan, "Uchrashuv: 06:00, aeroport, 2-terminal").
3. **Reja.** Kunma-kun reja: kun, vaqt, joy, izoh. Tashkilotchi tahrirlaydi, a'zolar taklif beradi.
4. **Tayyorgarlik ro'yxati.** Pasport, viza, chipta, sug'urta. Har a'zo o'zinikini belgilaydi, tashkilotchi umumiy holatni ko'radi.
5. **So'rovnomalar.** Sana, mehmonxona, marshrut bo'yicha ovoz berish.
6. **Xarajatlar.** Kim nima uchun qancha to'lagani yoziladi va kim kimga qancha qarzdor ekani hisoblanadi. **Faqat hisob yuritiladi, platforma pul o'tkazmaydi va ushlab turmaydi.**
7. **A'zolar.** Rollar (tashkilotchi, yordamchi, a'zo), tasdiq belgilari, telefon raqamlari yashirin.
8. **Telegram bilan bog'lash (ixtiyoriy).** Tashkilotchi o'zi Telegram guruh ochadi va unga botni qo'shadi. Bot guruhni safarga bog'laydi, muhim yangilanishlarni u yerga ham yozadi. Guruhga kirish havolasini faqat tasdiqlangan a'zolar oladi.
9. **Bildirishnomalar.** Bot orqali keladi (yangi xabar, e'lon, so'rovnoma, safarga 3 kun va 1 kun qoldi). Har bir turini o'chirib qo'yish mumkin.

**Xavfsizlik shu bosqichda yoqiladi:** shikoyat, bloklash, admin'ning moderatsiya navbati, rate limit. Chat yoqilgan kundan boshlab shikoyat tugmasi ham ishlashi shart.

---

## 6-bosqich — Klublar

- Telefoni tasdiqlangan har qanday foydalanuvchi **klub** ochishi mumkin. Masalan: "Tog' sayohatchilari", "Qizlar sayohat klubi", "Samarqand velosayohat".
- Klub sahifasida bo'ladi: muqova, tavsif, qoidalar, a'zolar, tashkilotchilar, klubning safarlari, klub postlari va taassurotlari.
- Klub ochiq yoki yopiq bo'ladi (yopiq klubga qo'shilish so'rov orqali).
- Klub o'z nomidan safar ochadi. Safar klub sahifasida va umumiy lentada chiqadi.
- Klub reytingi: o'tkazilgan safarlar soni, a'zolar soni, o'rtacha baho.
- Ma'lumotlar modeli kelajakda pullik a'zolikka tayyor bo'lsin, lekin hozir to'lov yo'q.

---

## 7-bosqich — Moslik (matching) va bildirishnomalar

`CLAUDE.md` ning 6-bo'limidagi algoritm amalga oshiriladi (ballar, "nega mos" izohi, takrorlanmaslik). Qo'shimchalari:
- moslik **klublar** bilan ham ishlaydi (qiziqishlari mos klublar tavsiya qilinadi);
- yangi mos safar haqida botda kuniga ko'pi bilan 3 ta xabar keladi.

---

## 8-bosqich — Taassurotlar va sharhlar (o'sishning dvigateli)

- Safar tugagach, Safar xonasi **Taassurot sahifasi**ga aylanadi:
  - umumiy foto albom (har a'zo yuklaydi, rasmlar WebP'ga siqiladi va `tb-files` bucket'ida saqlanadi);
  - har a'zoning qisqa hikoyasi;
  - xarita va marshrut (oddiy ro'yxat ko'rinishida bo'lsa ham bo'ladi).
- **Sharhlar:** birga borganlar bir-biriga va tashkilotchiga baho beradi. Baho profilda va klub reytingida chiqadi.
- **Ulashiladigan sahifa:** hamma a'zolar roziligi bilan safar hikoyasi ochiq sahifaga aylanadi. Unda chiroyli OG rasm bo'ladi (Telegram va Instagram'da ulashish uchun) va "Men ham bormoqchiman" tugmasi turadi. Bu bizning bepul reklamamiz.
- **Maxfiylik:** roziligi bo'lmagan odamning yuzi va ismi ochiq sahifada ko'rinmaydi. Har a'zo o'zini sahifadan olib tashlay oladi.
- **Profil yutuqlari:** borilgan davlatlar, safarlar soni, "Ishonchli hamroh" belgisi (ma'lum sondagi ijobiy sharhdan keyin beriladi).

---

## 9-bosqich — Admin, moderatsiya va ishga tushirishga tayyorgarlik

`CLAUDE.md` 7 va 8-bo'limlaridagi admin va launch talablari bajariladi. Bunga klublar, taassurotlar va xarajatlar ham qo'shiladi.

**Agentliklar marketpleysi va lead'lar (eski 5-bosqich) launch'dan keyingi V2 ga ko'chiriladi.** Ma'lumotlar modeli unga tayyor turadi.

---

## Raqobatda bizning ustunligimiz (hamma qarorlarda shuni yodda tut)

| Ular (Telegram guruhlar, GAFFL, JoinMyTrip, oddiy botlar) | Biz |
|---|---|
| Tarqoq e'lonlar, kimligi noma'lum odamlar | Tasdiqlangan profil, sharhlar, "nega mos" izohi |
| Sherik topildi, keyin hammasi WhatsApp yoki Telegram'da tarqalib ketadi | Safar xonasi: chat, reja, ro'yxat, xarajat, so'rovnoma bir joyda |
| Bir martalik e'lon | Klublar: doimiy hamjamiyat va takroriy safarlar |
| Safardan keyin iz qolmaydi | Taassurotlar va sharhlar: ishonch va bepul reklama |
| Inglizcha, xorijiy ilovalar | O'zbek, rus, ingliz tillarida, Telegram ichida, o'rnatish shart emas |

---

## Har bir bosqich uchun "tayyor" mezonlari

- Barcha yangi ekranlar `docs/design-system.md` ga mos keladi: 390px kenglikda gorizontal skroll yo'q, matn kesilmaydi.
- Har bir ekranning birinchi ko'rinishida "bu nima" va "nima qilaman" savoliga javob bor.
- Asosiy oqimlar uchun e2e testlar bor va Mini App rejimida ham o'tadi.
- Sentry'da yangi xato qolmagan.
- RAM chegaralari buzilmagan, boshqa loyihalar `Up` holatida.
- Egaga hisobot va skrinshotlar berilgan, keyingi bosqich egasining ruxsati bilan boshlanadi.
