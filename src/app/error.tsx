"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("ValleOS route error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-8 text-[#ededed]">
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
        <p className="text-xl font-medium">Este módulo tuvo un problema</p>
        <p className="mt-2 text-sm text-white/50">Tus datos no fueron modificados. Puedes intentar cargarlo de nuevo.</p>
        <button type="button" onClick={reset} className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black">
          Reintentar
        </button>
      </div>
    </main>
  );
}
