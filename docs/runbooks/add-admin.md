# Yangi admin qo'shish

Admin — Telegram ID'si `ADMIN_TELEGRAM_IDS` ro'yxatida bo'lgan odam. "Admin bo'lib ro'yxatdan o'tish" yo'q.

1. Yangi adminning **Telegram ID**'sini oling: u botga (masalan `@userinfobot`) yozsa, raqam chiqadi (`123456789`).
2. Coolify → **web** → Environment Variables → `ADMIN_TELEGRAM_IDS` → mavjud qiymatga vergul bilan qo'shing: `111,222,123456789`.
3. **web → Redeploy** (o'zgaruvchi yangi konteynerda o'qiladi).
4. Admin ilovadan chiqib, qayta kirsin (rol kirishda yangilanadi). Profil sahifasida "Admin panel" havolasi chiqadi: `/uz/admin`.

Adminlikni olib tashlash: ID'ni ro'yxatdan o'chiring → Redeploy → odam keyingi kirishda oddiy foydalanuvchi bo'ladi. Shoshilinch bo'lsa, uning sessiyasini ham tugating: admin panel → Foydalanuvchilar → bloklash yoki Coolify terminalida `delete from sessions where user_id = '<id>'`.

Har bir admin harakati `audit_logs` ga yoziladi: admin panel → Audit.
