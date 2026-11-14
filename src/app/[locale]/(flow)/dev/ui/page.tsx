import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ArrowBadge, CheckIcon, Chip, Display, Panel, StepHeader, Tag } from "@/components/clay";

// Component gallery for the Clay design system (docs/design-system.md). Never in production.
export default function UiKitPage() {
  return (
    <Suspense>
      <Kit />
    </Suspense>
  );
}

const swatches = [
  ["bg-background", "#EDEDED"],
  ["bg-card", "#FFFFFF"],
  ["bg-ink", "#0B0B0B"],
  ["bg-blue", "#0A5CFF"],
  ["bg-signal", "#F3EE1C"],
  ["bg-ink-2", "#2A2A2A"],
  ["bg-line", "#DADADA"],
  ["bg-success", "#16A34A"],
  ["bg-danger", "#E5484D"],
  ["bg-blue-soft", "#E8F0FF"],
] as const;

async function Kit() {
  await connection();
  if (process.env.APP_ENV === "production") notFound();
  return (
    <>
      <Display className="px-1 text-[40px]">UI Kit · Clay</Display>
      <Panel className="grid grid-cols-5 gap-2">
        {swatches.map(([cls, hex]) => (
          <div key={hex} className="text-[11px] text-muted-foreground">
            <div className={`${cls} mb-1 h-12 rounded-lg border border-line`} />
            {hex}
          </div>
        ))}
      </Panel>
      <Panel className="flex flex-col gap-2">
        <Display className="text-[40px]">Sarlavha 40</Display>
        <Display as="h2" className="text-[28px]">
          Bo&apos;lim 28
        </Display>
        <Display as="h3" className="text-xl">
          Kichik sarlavha 20
        </Display>
        <p>Matn 15 · Inter</p>
        <p className="text-xs text-muted-foreground">Izoh 12</p>
      </Panel>
      <Panel className="flex flex-wrap items-center gap-2">
        <Chip on>Tanlangan</Chip>
        <Chip on={false}>Oddiy</Chip>
        <Tag>Teg</Tag>
        <Tag tone="soft">
          <CheckIcon /> Tasdiqlangan
        </Tag>
        <Tag tone="signal">7/10</Tag>
        <ArrowBadge />
      </Panel>
      <Panel>
        <StepHeader step={2} total={4} status="Saqlandi ✓" />
      </Panel>
      <div className="grid grid-cols-2 gap-2">
        <Panel tone="dark">
          <div className="text-xs text-[#9a9a9a] uppercase">Ilgari</div>
          <div className="mt-2">Begona chatlarda sherik qidirish</div>
        </Panel>
        <Panel tone="blue">
          <div className="text-xs uppercase opacity-80">Endi</div>
          <div className="mt-2">Tayyor guruh va safar xonasi</div>
        </Panel>
        <Panel tone="signal" className="col-span-2">
          <Display as="div" className="text-[40px]">
            7/10
          </Display>
          <div className="text-xs">Statistika kartasi</div>
        </Panel>
      </div>
    </>
  );
}
