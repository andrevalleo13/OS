export default function FoodLoading() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-5 md:px-8 md:py-8" role="status" aria-label="Cargando nutrición">
      <div className="h-24 animate-pulse rounded-[28px] border border-white/[0.06] bg-white/[0.025]" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.55fr)]">
        <div className="h-72 animate-pulse rounded-[26px] border border-white/[0.06] bg-white/[0.02]" />
        <div className="h-72 animate-pulse rounded-[26px] border border-white/[0.06] bg-white/[0.02]" />
      </div>
      <div className="h-96 animate-pulse rounded-[26px] border border-white/[0.06] bg-white/[0.02]" />
    </div>
  );
}
