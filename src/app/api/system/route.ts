import { NextResponse } from 'next/server';
import si from 'systeminformation';
import { rejectNonLocalRequest } from '@/lib/local-request';

// Evitar que Next.js cachee esta ruta (queremos datos en tiempo real)
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const rejection = rejectNonLocalRequest(request);
  if (rejection) return rejection;
  try {
    const mem = await si.mem();
    const currentLoad = await si.currentLoad();

    // Convert active memory to GB
    const usedGB = (mem.active / (1024 * 1024 * 1024)).toFixed(1);
    const totalGB = (mem.total / (1024 * 1024 * 1024)).toFixed(0);

    return NextResponse.json({
      cpu: Math.round(currentLoad.currentLoad),
      ram: `${usedGB}G`,
      totalRam: `${totalGB}G`,
    });
  } catch (error) {
    console.error("System Fetch Error:", error);
    return NextResponse.json({ cpu: 0, ram: "0G" }, { status: 500 });
  }
}
