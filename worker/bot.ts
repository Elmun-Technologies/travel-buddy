// grammY bot (long polling: no webhook, no public URL for the worker).
import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { verifyPhoneFromTelegram } from "@/modules/auth/service";

type Lang = "uz" | "ru" | "en";
const T = {
  uz: {
    welcome:
      "Salom! Bu yerda sayohatga sherik va guruh topasiz. Ilovani ochish uchun pastdagi tugmani bosing.",
    open: "Ilovani ochish",
    askPhone:
      "Telefon raqamingizni tasdiqlash uchun pastdagi tugmani bosing. Raqamingiz hech kimga ko'rsatilmaydi.",
    share: "📱 Raqamni ulashish",
    ok: "✅ Telefon tasdiqlandi! Endi safar ochishingiz mumkin.",
    notYours: "Iltimos, faqat o'zingizning raqamingizni ulashing.",
    noUser: "Avval ilovaga kiring (pastdagi tugma), keyin raqamni tasdiqlang.",
    taken: "Bu raqam boshqa akkauntga bog'langan. Qo'llab-quvvatlash xizmatiga yozing.",
    invalid: "Raqamni tanib bo'lmadi. Qaytadan urinib ko'ring.",
  },
  ru: {
    welcome:
      "Привет! Здесь вы найдёте попутчиков и группы для путешествий. Нажмите кнопку ниже, чтобы открыть приложение.",
    open: "Открыть приложение",
    askPhone: "Нажмите кнопку ниже, чтобы подтвердить номер телефона. Номер никому не показывается.",
    share: "📱 Поделиться номером",
    ok: "✅ Телефон подтверждён! Теперь вы можете создавать поездки.",
    notYours: "Пожалуйста, отправьте только свой номер.",
    noUser: "Сначала войдите в приложение (кнопка ниже), затем подтвердите номер.",
    taken: "Этот номер привязан к другому аккаунту. Напишите в поддержку.",
    invalid: "Не удалось распознать номер. Попробуйте ещё раз.",
  },
  en: {
    welcome: "Hi! Find travel buddies and groups here. Tap the button below to open the app.",
    open: "Open the app",
    askPhone: "Tap the button below to verify your phone number. It's never shown to anyone.",
    share: "📱 Share my number",
    ok: "✅ Phone verified! You can now start trips.",
    notYours: "Please share only your own number.",
    noUser: "Log in to the app first (button below), then verify your number.",
    taken: "This number is linked to another account. Please contact support.",
    invalid: "Couldn't read the number. Please try again.",
  },
} satisfies Record<Lang, Record<string, string>>;

const lang = (code?: string): Lang => (code === "ru" || code === "en" ? code : "uz");

export function createBot(token: string, appUrl: string) {
  const bot = new Bot(token);
  const https = appUrl.startsWith("https://");
  const openButton = (l: Lang) =>
    https ? new InlineKeyboard().webApp(T[l].open, `${appUrl}/${l}/tg`) : undefined;

  bot.command("start", async (ctx) => {
    const l = lang(ctx.from?.language_code);
    if (ctx.match === "phone") {
      await ctx.reply(T[l].askPhone, {
        reply_markup: new Keyboard().requestContact(T[l].share).resized().oneTime(),
      });
      return;
    }
    await ctx.reply(T[l].welcome, { reply_markup: openButton(l) });
  });

  bot.on("message:contact", async (ctx) => {
    const l = lang(ctx.from.language_code);
    const c = ctx.message.contact;
    // Telegram fills user_id only for the sender's own contact card.
    if (c.user_id !== ctx.from.id) {
      await ctx.reply(T[l].notYours, { reply_markup: { remove_keyboard: true } });
      return;
    }
    const res = await verifyPhoneFromTelegram(ctx.from.id, c.phone_number);
    const text = { ok: T[l].ok, no_user: T[l].noUser, phone_taken: T[l].taken, invalid: T[l].invalid }[res];
    await ctx.reply(text, { reply_markup: { remove_keyboard: true } });
    if (res === "ok" || res === "no_user") {
      const kb = openButton(l);
      if (kb) await ctx.reply("👇", { reply_markup: kb });
    }
  });

  bot.catch((err) => console.error("bot error", err.error));

  return {
    bot,
    async start() {
      if (https) {
        // Menu button opens the Mini App in every chat with the bot.
        await bot.api.setChatMenuButton({
          menu_button: { type: "web_app", text: T.uz.open, web_app: { url: `${appUrl}/uz/tg` } },
        });
      }
      const me = await bot.api.getMe();
      console.log(`bot @${me.username} polling`);
      // start() deletes any webhook and long-polls; one instance per token.
      return bot.start({ allowed_updates: ["message"], drop_pending_updates: false });
    },
  };
}
