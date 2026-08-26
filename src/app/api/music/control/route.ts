import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import { z } from 'zod';
import { rejectNonLocalRequest } from '@/lib/local-request';

const execPromise = util.promisify(exec);

export async function POST(req: Request) {
  const rejection = rejectNonLocalRequest(req);
  if (rejection) return rejection;

  try {
    const { action } = z.object({ action: z.enum(['playpause', 'next', 'previous']) }).parse(await req.json());

    if (action === 'playpause') {
      await execPromise(`osascript -e 'tell application "Music" to playpause'`);
    } else if (action === 'next') {
      await execPromise(`osascript -e 'tell application "Music" to next track'`);
    } else if (action === 'previous') {
      await execPromise(`osascript -e 'tell application "Music" to previous track'`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Music Control Error:", error);
    return NextResponse.json({ success: false, error: 'Command failed' }, { status: 500 });
  }
}
