// grammY bot (long polling: no webhook, no public URL for the worker). Texts: Bot-Start.png.
// No emoji (product-decisions §1): symbols only where the design has them (↗, ·).
import { Bot, InlineKeyboard, Keyboard } from "grammy";
import {
  getTelegramLocale,
  setTelegramLocale,
  userIdByTelegram,
  verifyPhoneFromTelegram,
} from "@/modules/auth/service";
import { createHash } from "node:crypto";
import { personId, sendEvent } from "@/lib/analytics";
import { acceptContact } from "@/modules/safety/service";
import { completeLink } from "@/modules/telegram-group/service";

const APP = process.env.APP_NAME || "Travel Buddy"; // the brand is never hardcoded in texts

type Lang = "uz" | "ru" | "en";
const LANGS: Lang[] = ["uz", "ru", "en"];

const T = {
  uz: {
    welcome:
      "<b>Salom! Men {app} — sayohatga sherik topishga yordam beraman.</b>\n" +
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
    trusted:
      'Siz <b>{n}</b>ning ishonchli odamisiz. Safar paytida favqulodda holat bo\'lsa yoki "Hammasi joyida" deb belgilasa, shu yerga xabar keladi.',
    trustedBad: "Havola eskirgan yoki o'chirilgan. Yangi havolani so'rang.",
    groupHello:
      'Salom! Bu guruhni safarga ulash uchun ilovada safarning "Telegram guruh" bo\'limidan kodni oling va shu yerga yozing: /link KOD',
    linkOk: `Tayyor! Bu guruh «{trip}» safariga ulandi. Muhim e'lonlar, so'rovnomalar va sana o'zgarishlari shu yerga yoziladi.`,
    linkBad: "Kod noto'g'ri yoki eskirgan (30 daqiqa amal qiladi). Ilovadan yangisini oling.",
    linkNotOrg: "Guruhni faqat safar tashkilotchisi ulay oladi (ilovaga kirgan Telegram akkaunt bilan).",
    linkTaken: "Bu guruh boshqa safarga ulangan.",
    linkGroupOnly: "Bu buyruq guruhda ishlaydi: botni safar guruhingizga qo'shing.",
    taken: "Bu raqam boshqa akkauntga bog'langan. Qo'llab-quvvatlash xizmatiga yozing.",
    invalid: "Raqamni tanib bo'lmadi. Qaytadan urinib ko'ring.",
  },
  ru: {
    welcome:
      "<b>Привет! Я {app} — помогаю найти попутчиков.</b>\n" +
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
    trusted:
      "Вы — доверенный контакт <b>{n}</b>. Если в поездке что-то случится или придёт отметка «Всё в порядке», сообщение придёт сюда.",
    trustedBad: "Ссылка устарела или отключена. Попросите новую.",
    groupHello:
      "Привет! Чтобы привязать эту группу к поездке, возьмите код в разделе «Telegram-группа» поездки в приложении и напишите сюда: /link КОД",
    linkOk: `Готово! Группа привязана к поездке «{trip}». Важные объявления, опросы и изменения дат будут появляться здесь.`,
    linkBad: "Код неверный или устарел (действует 30 минут). Возьмите новый в приложении.",
    linkNotOrg:
      "Группу может привязать только организатор поездки (с того Telegram-аккаунта, которым он вошёл в приложение).",
    linkTaken: "Эта группа уже привязана к другой поездке.",
    linkGroupOnly: "Эта команда работает в группе: добавьте бота в группу поездки.",
    taken: "Этот номер привязан к другому аккаунту. Напишите в поддержку.",
    invalid: "Не удалось распознать номер. Попробуйте ещё раз.",
  },
  en: {
    welcome:
      "<b>Hi! I'm {app} — I help you find travel buddies.</b>\n" +
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
    trusted:
      "You're <b>{n}</b>'s trusted contact. If something happens on the trip, or they mark \"All good\", you'll get a message here.",
    trustedBad: "This link has expired or was switched off. Ask for a new one.",
    groupHello:
      'Hi! To link this group to a trip, get the code in the trip\'s "Telegram group" section in the app and send it here: /link CODE',
    linkOk: `Done! This group is linked to “{trip}”. Important notices, polls and date changes will appear here.`,
    linkBad: "The code is wrong or expired (it lasts 30 minutes). Get a new one in the app.",
    linkNotOrg:
      "Only the trip organizer can link a group (from the Telegram account used to sign in to the app).",
    linkTaken: "This group is already linked to another trip.",
    linkGroupOnly: "This command works in a group: add the bot to your trip's group.",
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
    if (ctx.match.startsWith("trust_")) {
      const name = await acceptContact(ctx.match.slice(6), String(ctx.chat.id));
      const esc = (x: string) => x.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      await ctx.reply(name === null ? T[l].trustedBad : T[l].trusted.replace("{n}", esc(name)), {
        parse_mode: "HTML",
      });
      return;
    }
    if (ctx.match === "phone") {
      await ctx.reply(T[l].askPhone, {
        reply_markup: new Keyboard().requestContact(T[l].share).resized().oneTime(),
      });
      return;
    }
    // Ad campaigns link t.me/<bot>?start=src_<name>: count bot starts per source.
    const src = /^src_([a-z0-9_]{1,30})$/.exec(ctx.match)?.[1];
    if (src && ctx.from)
      void sendEvent(
        "bot_start",
        `tg_${createHash("sha256").update(String(ctx.from.id)).digest("hex").slice(0, 20)}`,
        {
          source: src,
        },
      );
    await setMenu(ctx.chat.id, l);
    await ctx.reply(T[l].welcome.replaceAll("{app}", APP), {
      parse_mode: "HTML",
      reply_markup: startKeyboard(l),
    });
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
    await ctx.reply(T[l].welcome.replaceAll("{app}", APP), {
      parse_mode: "HTML",
      reply_markup: startKeyboard(l),
    });
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
    if (res === "ok") {
      const uid = await userIdByTelegram(ctx.from.id);
      if (uid) void sendEvent("phone_verified", personId(uid));
    }
    const text = { ok: T[l].ok, no_user: T[l].noUser, phone_taken: T[l].taken, invalid: T[l].invalid }[res];
    await ctx.reply(text, { reply_markup: { remove_keyboard: true } });
    if ((res === "ok" || res === "no_user") && https)
      await ctx.reply(T[l].open, {
        reply_markup: new InlineKeyboard().webApp(T[l].open, `${appUrl}/${l}/tg`),
      });
  });

  // "/link CODE" in the trip's own Telegram group
  bot.command("link", async (ctx) => {
    const l = await langOf(ctx.from);
    if (ctx.chat.type !== "group" && ctx.chat.type !== "supergroup") {
      await ctx.reply(T[l].linkGroupOnly);
      return;
    }
    const code = ctx.match.trim().toUpperCase();
    const res =
      /^[2-9A-HJKMNP-Z]{8}$/.test(code) && ctx.from
        ? await completeLink(code, String(ctx.chat.id), ctx.chat.title ?? "", ctx.from.id)
        : ({ ok: false, error: "bad_code" } as const);
    await ctx.reply(
      res.ok
        ? T[l].linkOk.replace("{trip}", res.tripTitle.replace(/[<>&]/g, ""))
        : res.error === "not_organizer"
          ? T[l].linkNotOrg
          : res.error === "chat_taken"
            ? T[l].linkTaken
            : T[l].linkBad,
    );
  });
  // The bot was added to a group: say how to link it (once per addition).
  bot.on("my_chat_member", async (ctx) => {
    const c = ctx.myChatMember;
    const joined =
      ["member", "administrator"].includes(c.new_chat_member.status) &&
      ["left", "kicked"].includes(c.old_chat_member.status);
    if ((c.chat.type === "group" || c.chat.type === "supergroup") && joined)
      await ctx.reply(T[await langOf(c.from)].groupHello).catch(() => {});
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
      return bot.start({
        allowed_updates: ["message", "callback_query", "my_chat_member"],
        drop_pending_updates: false,
      });
    },
  };
}
