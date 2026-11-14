# Dizayn tizimi "Clay"

Manba: `docs/design-handoff/design/screens/UI-Kit.png` va `design/source/*.dc.html`. Jonli namuna: `/uz/dev/ui` (production'da ochilmaydi).

## Tokenlar (`src/app/globals.css`)

| Token (Tailwind)                 | Qiymat            | Qayerda                                           |
| -------------------------------- | ----------------- | ------------------------------------------------- |
| `bg-background`                  | #EDEDED           | sahifa foni                                       |
| `bg-card`                        | #FFFFFF           | panel va kartalar                                 |
| `bg-ink` / `text-ink`            | #0B0B0B           | matn, asosiy tugma, urg'u paneli                  |
| `bg-ink-2`                       | #2A2A2A           | "Ilgari / Muammo" paneli                          |
| `text-muted-foreground`          | #5F5F5F           | izoh (AA kontrast)                                |
| `border-line`                    | #DADADA           | ajratgich                                         |
| `border-input`                   | #CFCFCF           | input va chip chegarasi                           |
| `bg-blue`                        | #0A5CFF           | "Endi" paneli, havola, faol holat                 |
| `bg-blue-soft` / `text-blue-ink` | #E8F0FF / #0A3FB0 | eslatma bloklari                                  |
| `bg-signal`                      | #F3EE1C           | **faqat** bosh harakat (↗) yoki bitta muhim raqam |
| `success` / `danger`             | #16A34A / #E5484D | holatlar                                          |

Burchaklar: `rounded-panel` 22px (md'dan 28px), `rounded-card` 18px, `rounded-button` 14px, chip/teg `rounded-full`.
Shrift: `font-display` — Inter Tight 400, −0.03em, qator 1.02 (sarlavhalar); matn — Inter 15px.
Harakat: `press` (bosilganda 0.98, 180ms, `prefers-reduced-motion` hurmat qilinadi). Soya deyarli yo'q.
Ikonkalar: ingichka chiziqli SVG (1.5–1.8), emoji yo'q.

## Komponentlar

- `src/components/clay.tsx`: `Panel` (light/dark/blue/signal/soft), `Display`, `Tag`, `Chip`, `Segmented`, `StepHeader`, `ArrowBadge`, `FieldBlock`, `BigButton`, `clayInput`.
- `src/components/telegram-actions.tsx`: `MainAction` (Telegram MainButton yoki web'da pastki tugma; `href` bilan — oddiy havola), `BackAction`, `TelegramInit` (sarlavha rangi, expand).
- `src/lib/telegram-webapp.ts`: Mini App API, `haptic.select/success/error`.

## Qoidalar

- Birinchi Mini App, keyin web. 390px'da gorizontal skroll yo'q, bosiladigan joylar ≥ 44px.
- Har ekranda bitta asosiy harakat — `MainAction`.
- Sariq faqat bitta joyda. Kartaning asosiy rasmi — joy fotosi, odam portreti emas.
- Matnlar faqat `messages/*.json` orqali; ohang — `product-decisions.md` §1.
