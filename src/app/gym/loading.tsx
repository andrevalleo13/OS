function Block({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.045] ${className}`} />;
}

function Surface({ className, children }: { className: string; children?: React.ReactNode }) {
  return <div className={`os-surface rounded-[20px] p-5 sm:p-6 ${className}`}>{children}</div>;
}

function Rule() {
  return (
    <div className="mb-3 mt-9 flex items-center gap-3">
      <Block className="h-2.5 w-16" />
      <span className="h-px flex-1 bg-white/[0.06]" />
    </div>
  );
}

/** Esqueleto con la misma retícula que /gym para que la carga no salte. */
export default function GymLoading() {
  return (
    <div className="os-page mx-auto w-full max-w-[1400px] pb-12 pt-1 md:pt-3" role="status" aria-label="Cargando gimnasio">
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
        <Surface className="lg:col-span-7">
          <Block className="h-2.5 w-36" />
          <Block className="mt-5 h-9 w-56" />
          <Block className="mt-3 h-3 w-40" />
          <div className="mt-6 grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, index) => <Block key={index} className="h-[74px]" />)}
          </div>
          <div className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {Array.from({ length: 8 }, (_, index) => <Block key={index} className="h-4" />)}
          </div>
          <Block className="mt-7 h-11 w-44 rounded-xl" />
        </Surface>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:col-span-5">
          {Array.from({ length: 4 }, (_, index) => (
            <Surface key={index} className="min-h-[168px]">
              <Block className="h-2.5 w-16" />
              <Block className="mt-5 h-8 w-20" />
              <Block className="mt-6 h-3 w-full" />
            </Surface>
          ))}
        </div>
      </div>

      <Rule />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
        <Surface className="lg:col-span-8">
          <Block className="h-2.5 w-32" />
          <Block className="mt-4 h-7 w-24" />
          <Block className="mt-6 h-[150px] w-full" />
        </Surface>
        <Surface className="lg:col-span-4">
          <Block className="h-2.5 w-28" />
          <div className="mt-6 flex flex-col gap-3">
            {Array.from({ length: 7 }, (_, index) => <Block key={index} className="h-3" />)}
          </div>
        </Surface>
      </div>

      <Rule />
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
        <Surface className="min-h-[380px] lg:col-span-5" />
        <Surface className="lg:col-span-7">
          <Block className="h-2.5 w-28" />
          <Block className="mt-4 h-10 w-32" />
          <Block className="mt-6 h-[190px] w-full" />
        </Surface>
      </div>
    </div>
  );
}
