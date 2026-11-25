# Orqaga qaytarish (rollback)

## Kod (web yoki worker)

Har bir build ikki nom bilan saqlanadi: `:production` va `:prod-<git-sha>` (oldingi versiyalar GHCR'da turadi).

1. GitHub → Packages → `travel-buddy-web` (yoki `-worker`) → oldingi ishlagan versiyaning `prod-<sha>` nomini toping (yoki Actions → o'sha `release` ishidan).
2. Coolify → resurs → **Image tag** maydonini `prod-<sha>` ga o'zgartiring → **Redeploy**.
3. Tuzatilgach — tegni yana `production` ga qaytaring va yangi `release` ishga tushiring.

## Migratsiya

Migratsiyalar faqat jadval/ustun **qo'shadi** yoki bog'lanish qoidasini o'zgartiradi; eski kod yangi sxema bilan odatda ishlayveradi, shuning uchun avval kodni qaytaring. Sxemani qaytarish kerak bo'lsa:

| Migratsiya                         | Qaytarish                                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0002` onboarding_drafts           | `DROP TABLE onboarding_drafts;`                                                                                                                                                  |
| `0013` account_erasure_and_retries | yangi ustunlar zararsiz — qoldiring. FK qoidalarini qaytarish shart emas (eski qoida o'chirishni to'sib qo'yardi). `DROP INDEX reviews_once;` faqat sharhlar bilan muammo bo'lsa |

Boshqa migratsiyalar uchun avval `docs/decisions.md`ga qarang; shubha bo'lsa — baza nusxasidan tiklash.

## Baza

`docs/runbooks/restore.md` → "Haqiqiy avariyada". **Faqat ega ruxsati bilan.** Avval web va worker to'xtatiladi.
