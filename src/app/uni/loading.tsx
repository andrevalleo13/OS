function Block({ className, lines = 3 }: { className?: string; lines?: number }) {
  return (
    <div className={`os-surface flex flex-col gap-3 rounded-[20px] p-5 ${className ?? ""}`}>
      <div className="h-2 w-24 animate-pulse rounded-full bg-white/[0.07]" />
      {Array.from({ length: lines }, (_, index) => (
        <div key={index} className="h-2.5 animate-pulse rounded-full bg-white/[0.04]" style={{ width: `${88 - index * 14}%`, animationDelay: `${index * 120}ms` }} />
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div className="os-page mx-auto grid w-full max-w-[1400px] grid-cols-12 gap-3 pb-10 md:gap-4" role="status" aria-label="Cargando Universidad">
      <div className="col-span-12 h-7 w-72 animate-pulse rounded-full bg-white/[0.03]" />
      <div className="os-surface col-span-12 flex h-[440px] flex-col justify-between rounded-[20px] p-6 lg:col-span-6">
        <div className="h-2 w-40 animate-pulse rounded-full bg-white/[0.07]" />
        <div className="flex flex-col gap-3">
          <div className="h-7 w-2/3 animate-pulse rounded-lg bg-white/[0.06]" />
          <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-white/[0.04]" />
        </div>
        <div className="h-14 w-3/4 animate-pulse rounded-xl bg-white/[0.05]" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-white/[0.03]" />
      </div>
      <Block className="col-span-12 h-[440px] md:col-span-6 lg:col-span-3" lines={5} />
      <Block className="col-span-12 h-[440px] md:col-span-6 lg:col-span-3" lines={7} />
      <Block className="col-span-12 h-[200px]" lines={2} />
      <Block className="col-span-12 h-[520px] xl:col-span-8" lines={8} />
      <Block className="col-span-12 h-[520px] xl:col-span-4" lines={6} />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
