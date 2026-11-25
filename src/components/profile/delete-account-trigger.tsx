"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DeleteAccountDialog } from "./delete-account";

/** Profil sahifasida "Akkauntni o'chirish" havolasi va tasdiqlash oynasi. */
export function DeleteAccountTrigger() {
  const t = useTranslations("profile");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 text-[15px] font-medium text-danger"
      >
        {t("deleteAccount.button")}
      </button>
      <DeleteAccountDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
