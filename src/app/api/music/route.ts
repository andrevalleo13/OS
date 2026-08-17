import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import { getAverageColor } from 'fast-average-color-node';

const execPromise = util.promisify(exec);

// In-memory cache for artwork and colors to prevent redundant network calls
const metadataCache = new Map<string, { albumArt: string | null, dominantColor: string }>();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Check if Apple Music is running
    const { stdout: isRunning } = await execPromise(`osascript -e 'tell application "System Events" to (name of processes) contains "Music"'`);
    
    if (isRunning.trim() === 'false') {
      return NextResponse.json({ playing: false, message: 'Apple Music is closed' });
    }

    // 2. Get Player State
    const { stdout: playerState } = await execPromise(`osascript -e 'tell application "Music" to get player state'`);
    const stateStr = playerState.trim();
    
    if (stateStr === 'stopped') {
      return NextResponse.json({ playing: false, track: null, state: 'stopped' });
    }

    const isPlaying = stateStr === 'playing';

    // 3. Get Track Metadata
    const { stdout: track } = await execPromise(`osascript -e 'tell application "Music" to get name of current track'`);
    const { stdout: artist } = await execPromise(`osascript -e 'tell application "Music" to get artist of current track'`);
    const { stdout: albumOut } = await execPromise(`osascript -e 'tell application "Music" to get album of current track'`);
    const { stdout: durationOut } = await execPromise(`osascript -e 'tell application "Music" to get duration of current track'`);
    const { stdout: positionOut } = await execPromise(`osascript -e 'tell application "Music" to get player position'`);

    const trackName = track.trim();
    const artistName = artist.trim();
    const albumName = albumOut.trim();
    const duration = parseFloat(durationOut.trim()) || 0;
    const position = parseFloat(positionOut.trim()) || 0;

    // 4. Fetch High-Res Album Art from iTunes API (Public)
    const cacheKey = `${trackName}-${artistName}-${albumName}`;
    let albumArt = null;
    let dominantColor = '#fa243c'; // fallback apple music red
    
    if (metadataCache.has(cacheKey)) {
      const cached = metadataCache.get(cacheKey)!;
      albumArt = cached.albumArt;
      dominantColor = cached.dominantColor;
    } else {
      try {
        // Try ALBUM search first (most accurate for artwork)
        let query = encodeURIComponent(`${albumName} ${artistName}`);
        let res = await fetch(`https://itunes.apple.com/search?term=${query}&limit=1&entity=album`);
        let data = await res.json();
        
        // If no results, fallback to Track + Artist
        if (!data.results || data.results.length === 0) {
           query = encodeURIComponent(`${trackName} ${artistName}`);
           res = await fetch(`https://itunes.apple.com/search?term=${query}&limit=1&entity=song`);
           data = await res.json();
        }

        if (data.results && data.results.length > 0) {
          // Replace 100x100 resolution with 600x600 for crisp quality
          albumArt = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
          
          try {
            const color = await getAverageColor(albumArt);
            dominantColor = color.hex;
          } catch (colorError) {
            console.log('Failed to parse dominant color');
          }
        }
        metadataCache.set(cacheKey, { albumArt, dominantColor });
      } catch (e) {
        console.log('Failed to fetch album art from iTunes', e);
      }
    }

    return NextResponse.json({
      playing: isPlaying,
      track: trackName,
      artist: artistName,
      albumArt,
      dominantColor,
      duration,
      position
    });

  } catch (error) {
    console.error("Apple Music Fetch Error:", error);
    return NextResponse.json({ playing: false, error: 'Failed to fetch music stats' }, { status: 500 });
  }
}
