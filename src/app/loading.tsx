export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Cargando ValleOS">
      <div className="h-8 w-8 animate-pulse rounded-full border border-white/20 bg-white/5" />
    </div>
  );
}
