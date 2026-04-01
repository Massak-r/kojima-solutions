/**
 * Trim a video file in the browser using FFmpeg.wasm (single-threaded core).
 * Dynamically loads FFmpeg only when needed (~25 MB WASM from CDN).
 * Uses -c copy for fast keyframe-based cutting (no re-encoding).
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg(onProgress?: (p: number) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  ffmpeg.on('progress', ({ progress }) => {
    onProgress?.(Math.round(Math.min(progress, 1) * 100));
  });

  // Load single-threaded core from CDN (no SharedArrayBuffer needed)
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL:  await toBlobURL(`${baseURL}/ffmpeg-core.js`,  'text/javascript'),
    wasmURL:  await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
}

export interface TrimProgress {
  phase: 'loading' | 'trimming' | 'done';
  percent: number;
}

/**
 * Trims a video file between startTime and endTime (in seconds).
 * Returns a new File with only the trimmed segment.
 */
export async function trimVideoFile(
  file: File,
  startTime: number,
  endTime: number,
  onProgress?: (p: TrimProgress) => void,
): Promise<File> {
  onProgress?.({ phase: 'loading', percent: 0 });

  const ff = await getFFmpeg((pct) => {
    onProgress?.({ phase: 'trimming', percent: pct });
  });

  const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
  const inputName = `input.${ext}`;
  const outputName = `output.${ext}`;

  // Write input file to FFmpeg virtual filesystem
  await ff.writeFile(inputName, await fetchFile(file));

  // Trim with -c copy (fast, no re-encoding) — keyframe-aligned
  await ff.exec([
    '-ss', fmtTime(startTime),
    '-to', fmtTime(endTime),
    '-i', inputName,
    '-c', 'copy',
    '-avoid_negative_ts', 'make_zero',
    outputName,
  ]);

  // Read output
  const data = await ff.readFile(outputName);

  // Cleanup virtual filesystem
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);

  onProgress?.({ phase: 'done', percent: 100 });

  const blob = new Blob([data], { type: file.type || 'video/mp4' });
  return new File([blob], file.name, { type: file.type || 'video/mp4' });
}
