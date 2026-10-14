import { Suspense } from "react";
import VaultApp from "@/components/vault/VaultApp";

export const dynamic = "force-dynamic";

export default function ObsidianPage() {
  return (
    <div className="h-[calc(100dvh-11rem)] min-h-[520px] md:h-[calc(100dvh-7.25rem)]">
      <Suspense fallback={<div className="os-surface h-full rounded-[22px]" />}>
        <VaultApp />
      </Suspense>
    </div>
  );
}
