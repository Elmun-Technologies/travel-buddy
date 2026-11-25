import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageLoading } from "@/components/page-loading";
import { asLocale, requireProfile } from "@/lib/guard";
import { getChat, listMessages } from "@/modules/chat/service";
import { getDisplayNames } from "@/modules/profiles/service";
import { storageEnabled } from "@/lib/storage";
import { ChatView } from "./chat";

export default function ChatPage(props: PageProps<"/[locale]/chats/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Chat {...props} />
    </Suspense>
  );
}

// A private conversation (1:1 between two people from one group, or an agency lead).
async function Chat({ params }: PageProps<"/[locale]/chats/[id]">) {
  const { locale: l, id } = await params;
  const { user } = await requireProfile(asLocale(l));
  const convId = z.uuid().safeParse(id);
  const chat = convId.success ? await getChat(user.id, convId.data) : null;
  if (!convId.success || !chat) notFound();
  const [names, initial, t] = await Promise.all([
    chat.otherId ? getDisplayNames([chat.otherId]) : new Map<string, string>(),
    listMessages(convId.data, user.id),
    getTranslations("chats"),
  ]);
  return (
    <ChatView
      id={convId.data}
      me={user.id}
      other={{ id: chat.otherId, name: (chat.otherId && names.get(chat.otherId)) || t("someone") }}
      initial={initial}
      canWrite={chat.canWrite}
      photos={storageEnabled()}
      backHref={chat.kind === "lead" ? "/rooms" : "/rooms"}
    />
  );
}
