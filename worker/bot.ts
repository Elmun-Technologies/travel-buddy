// grammY bot (long polling: no webhook, no public URL for the worker). Texts: Bot-Start.png.
// No emoji (product-decisions §1): symbols only where the design has them (↗, ·).
import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { getTelegramLocale, setTelegramLocale, verifyPhoneFromTelegram } from "@/modules/auth/service";

type Lang = "uz" | "ru" | "en";
const LANGS: Lang[] = ["uz", "ru", "en"];

const T = {
  uz: {
    welcome:
      "<b>Salom! Men Travel Buddy — sayohatga sherik topishga yordam beraman.</b>\n" +
      "Qayerga borishni ayting — mos odamlar va guruhlarni topib beraman. Qolganini birga rejalaymiz.\n\n" +
      "Bepul · 18+ · 2 daqiqa vaqt oladi",
    open: "Sherik qidiramiz ↗",
    menu: "Ilova",
    how: "Qanday ishlaydi?",
    howText:
      "<b>01.</b> Qayerga va qachon borishingizni yozing — mos sheriklarni ko'rsatamiz.\n" +
      '<b>02.</b> Yoqqan guruhga "Men ham boraman" deysiz yoki o\'zingiz safar ochasiz.\n' +
      "<b>03.</b> Safar xonasida reja, xarajat va chat — keyin umumiy albom.",
    language: "Tilni tanlash",
    pickLanguage: "Tilni tanlang:",
    languageSet: "Til: o'zbekcha.",
    askPhone:
      "Telefon raqamingizni tasdiqlash uchun pastdagi tugmani bosing. Raqamingiz hech kimga ko'rsatilmaydi.",
    share: "Raqamni ulashish",
    ok: "Telefon tasdiqlandi. Endi safar ochishingiz mumkin.",
    notYours: "Iltimos, faqat o'zingizning raqamingizni ulashing.",
    noUser: "Avval ilovaga kiring, keyin raqamni tasdiqlang.",
    taken: "Bu raqam boshqa akkauntga bog'langan. Qo'llab-quvvatlash xizmatiga yozing.",
    invalid: "Raqamni tanib bo'lmadi. Qaytadan urinib ko'ring.",
  },
  ru: {
    welcome:
      "<b>Привет! Я Travel Buddy — помогаю найти попутчиков.</b>\n" +
      "Скажите, куда хотите поехать, — я подберу подходящих людей и группы. Остальное спланируем вместе.\n\n" +
      "Бесплатно · 18+ · займёт 2 минуты",
    open: "Найти попутчика ↗",
    menu: "Приложение",
    how: "Как это работает?",
    howText:
      "<b>01.</b> Напишите, куда и когда хотите поехать, — покажем подходящих попутчиков.\n" +
      "<b>02.</b> Нажмите «Я тоже еду» в понравившейся группе или создайте свою поездку.\n" +
      "<b>03.</b> В комнате поездки — план, расходы и чат, а потом общий альбом.",
    language: "Выбрать язык",
    pickLanguage: "Выберите язык:",
    languageSet: "Язык: русский.",
    askPhone: "Нажмите кнопку ниже, чтобы подтвердить номер. Его никто не увидит.",
    share: "Отправить номер",
    ok: "Телефон подтверждён. Теперь можно создавать поездки.",
    notYours: "Пожалуйста, отправьте только свой номер.",
    noUser: "Сначала откройте приложение, затем подтвердите номер.",
    taken: "Этот номер привязан к другому аккаунту. Напишите в поддержку.",
    invalid: "Не удалось распознать номер. Попробуйте ещё раз.",
  },
  en: {
    welcome:
      "<b>Hi! I'm Travel Buddy — I help you find travel buddies.</b>\n" +
      "Tell me where you want to go and I'll find the right people and groups. We'll plan the rest together.\n\n" +
      "Free · 18+ · takes 2 minutes",
    open: "Find a buddy ↗",
    menu: "App",
    how: "How does it work?",
    howText:
      "<b>01.</b> Tell us where and when you want to go — we'll show people who fit.\n" +
      '<b>02.</b> Tap "I\'m in" on a group you like, or start your own trip.\n' +
      "<b>03.</b> The trip room has the plan, costs and chat — and a shared album afterwards.",
    language: "Language",
    pickLanguage: "Choose a language:",
    languageSet: "Language: English.",
    askPhone: "Tap the button below to verify your number. No one will ever see it.",
    share: "Share my number",
    ok: "Phone verified. You can now start trips.",
    notYours: "Please share only your own number.",
    noUser: "Open the app first, then verify your number.",
    taken: "This number is linked to another account. Please contact support.",
    invalid: "Couldn't read the number. Please try again.",
  },
} satisfies Record<Lang, Record<string, string>>;

const asLang = (code?: string | null): Lang => (code === "ru" || code === "en" ? code : "uz");

// apiRoot: only for tests (fake Bot API server); production uses api.telegram.org.
export function createBot(token: string, appUrl: string, apiRoot?: string) {
  const bot = new Bot(token, apiRoot ? { client: { apiRoot } } : undefined);
  const https = appUrl.startsWith("https://");
  // Language chosen in the bot by people who haven't opened the app yet (no account to store it on).
  const chosen = new Map<number, Lang>();
  const langOf = async (from?: { id: number; language_code?: string }) =>
    from ? (chosen.get(from.id) ?? asLang((await getTelegramLocale(from.id)) ?? from.language_code)) : "uz";

  const startKeyboard = (l: Lang) => {
    const kb = new InlineKeyboard();
    if (https) kb.webApp(T[l].open, `${appUrl}/${l}/tg`).row();
    return kb.text(T[l].how, "how").text(T[l].language, "lang");
  };
  // Menu button of this chat opens the app in the user's language.
  const setMenu = (chatId: number, l: Lang) =>
    https
      ? bot.api
          .setChatMenuButton({
            chat_id: chatId,
            menu_button: { type: "web_app", text: T[l].menu, web_app: { url: `${appUrl}/${l}/tg` } },
          })
          .catch(() => {})
      : Promise.resolve();

  bot.command("start", async (ctx) => {
    const l = await langOf(ctx.from);
    if (ctx.match === "phone") {
      await ctx.reply(T[l].askPhone, {
        reply_markup: new Keyboard().requestContact(T[l].share).resized().oneTime(),
      });
      return;
    }
    await setMenu(ctx.chat.id, l);
    await ctx.reply(T[l].welcome, { parse_mode: "HTML", reply_markup: startKeyboard(l) });
  });

  bot.callbackQuery("how", async (ctx) => {
    const l = await langOf(ctx.from);
    await ctx.answerCallbackQuery();
    await ctx.reply(T[l].howText, {
      parse_mode: "HTML",
      reply_markup: https ? new InlineKeyboard().webApp(T[l].open, `${appUrl}/${l}/tg`) : undefined,
    });
  });

  bot.callbackQuery("lang", async (ctx) => {
    const l = await langOf(ctx.from);
    await ctx.answerCallbackQuery();
    const kb = new InlineKeyboard();
    for (const x of LANGS)
      kb.text(x === "uz" ? "O'zbekcha" : x === "ru" ? "Русский" : "English", `lang:${x}`);
    await ctx.reply(T[l].pickLanguage, { reply_markup: kb });
  });

  bot.callbackQuery(/^lang:(uz|ru|en)$/, async (ctx) => {
    const l = ctx.match[1] as Lang;
    chosen.set(ctx.from.id, l);
    await setTelegramLocale(ctx.from.id, l);
    await ctx.answerCallbackQuery({ text: T[l].languageSet });
    if (ctx.chat) await setMenu(ctx.chat.id, l);
    await ctx.reply(T[l].welcome, { parse_mode: "HTML", reply_markup: startKeyboard(l) });
  });

  bot.on("message:contact", async (ctx) => {
    const l = await langOf(ctx.from);
    const c = ctx.message.contact;
    // Telegram fills user_id only for the sender's own contact card.
    if (c.user_id !== ctx.from.id) {
      await ctx.reply(T[l].notYours, { reply_markup: { remove_keyboard: true } });
      return;
    }
    const res = await verifyPhoneFromTelegram(ctx.from.id, c.phone_number);
    const text = { ok: T[l].ok, no_user: T[l].noUser, phone_taken: T[l].taken, invalid: T[l].invalid }[res];
    await ctx.reply(text, { reply_markup: { remove_keyboard: true } });
    if ((res === "ok" || res === "no_user") && https)
      await ctx.reply(T[l].open, {
        reply_markup: new InlineKeyboard().webApp(T[l].open, `${appUrl}/${l}/tg`),
      });
  });

  bot.catch((err) => console.error("bot error", err.error));

  return {
    bot,
    async start() {
      if (https) {
        // Default menu button (chats get their own language on /start).
        await bot.api.setChatMenuButton({
          menu_button: { type: "web_app", text: T.uz.menu, web_app: { url: `${appUrl}/uz/tg` } },
        });
      }
      const me = await bot.api.getMe();
      console.log(`bot @${me.username} polling`);
      // start() deletes any webhook and long-polls; one instance per token.
      return bot.start({ allowed_updates: ["message", "callback_query"], drop_pending_updates: false });
    },
  };
}
