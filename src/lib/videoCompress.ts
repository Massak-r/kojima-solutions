/**
 * Browser-side video compression.
 *
 * Fast path (WebCodecs + mp4-muxer): plays video at max speed via
 * requestVideoFrameCallback, encodes frames with VideoEncoder at 1080p / 3 Mbps.
 * Outputs MP4 (H.264/AAC) for universal compatibility (iOS Safari, Android, desktop).
 *
 * Fallback (MediaRecorder): real-time encoding for older browsers.
 *
 * Files under 50 MB in web-friendly formats (MP4/WebM) skip compression
 * entirely — just upload directly.
 */

import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

const TARGET_HEIGHT = 1080;
const TARGET_FPS = 30;
const TARGET_VIDEO_BITRATE = 3_000_000;
const TARGET_AUDIO_BITRATE = 128_000;

/** Files below this size in a web-friendly format skip compression */
const SKIP_THRESHOLD = 50 * 1024 * 1024; // 50 MB

/** Minimum frames required for a valid output — avoids empty files from very short videos */
const MIN_FRAMES = 2;

const WEB_FRIENDLY_TYPES = [
  'video/mp4', 'video/webm', 'video/x-m4v',
];

export interface CompressProgress {
  phase: 'loading' | 'compressing' | 'done';
  percent: number;
}

export function needsCompression(file: File): boolean {
  // Web-friendly formats under 50 MB don't need compression
  if (file.size < SKIP_THRESHOLD && WEB_FRIENDLY_TYPES.includes(file.type)) {
    return false;
  }
  return true;
}

function calcDimensions(srcW: number, srcH: number) {
  let w = srcW, h = srcH;
  if (h > TARGET_HEIGHT) {
    const scale = TARGET_HEIGHT / h;
    w = Math.round(srcW * scale);
    h = TARGET_HEIGHT;
  }
  // Even dimensions required by codecs
  w = w % 2 === 0 ? w : w - 1;
  h = h % 2 === 0 ? h : h - 1;
  return { w, h };
}

function hasWebCodecs(): boolean {
  return typeof VideoEncoder !== 'undefined'
    && typeof VideoFrame !== 'undefined'
    && typeof AudioEncoder !== 'undefined'
    && typeof AudioData !== 'undefined';
}

// ── Fast path: WebCodecs + mp4-muxer ──────────────────────────────────────

async function compressFast(
  file: File,
  onProgress?: (p: CompressProgress) => void,
): Promise<File> {
  onProgress?.({ phase: 'loading', percent: 0 });

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  const url = URL.createObjectURL(file);
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Impossible de lire la video'));
    setTimeout(() => reject(new Error('Timeout chargement video')), 30000);
  });

  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) {
    URL.revokeObjectURL(url);
    return file;
  }

  const { w, h } = calcDimensions(video.videoWidth, video.videoHeight);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  onProgress?.({ phase: 'loading', percent: 30 });

  // Decode audio
  let audioBuffer: AudioBuffer | null = null;
  try {
    const ab = await file.arrayBuffer();
    const audioCtx = new AudioContext();
    audioBuffer = await audioCtx.decodeAudioData(ab);
    await audioCtx.close();
  } catch {
    // No audio or decode failed, continue without audio
  }

  onProgress?.({ phase: 'loading', percent: 60 });

  // Set up MP4 muxer (H.264 + AAC — universal compatibility incl. iOS Safari)
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: w, height: h },
    audio: audioBuffer ? {
      codec: 'aac',
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: Math.min(audioBuffer.numberOfChannels, 2),
    } : undefined,
    fastStart: 'in-memory',
  });

  // Set up video encoder (H.264 Baseline for broadest device support)
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta ?? undefined),
    error: (e) => console.error('VideoEncoder error:', e),
  });

  videoEncoder.configure({
    codec: 'avc1.42001f',
    width: w,
    height: h,
    bitrate: TARGET_VIDEO_BITRATE,
    framerate: TARGET_FPS,
  });

  onProgress?.({ phase: 'compressing', percent: 0 });

  // Encode audio in chunks
  if (audioBuffer) {
    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta ?? undefined),
      error: (e) => console.error('AudioEncoder error:', e),
    });

    audioEncoder.configure({
      codec: 'mp4a.40.2',
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: Math.min(audioBuffer.numberOfChannels, 2),
      bitrate: TARGET_AUDIO_BITRATE,
    });

    // Feed audio in ~0.5s chunks
    const chunkSize = Math.floor(audioBuffer.sampleRate * 0.5);
    const numChannels = Math.min(audioBuffer.numberOfChannels, 2);

    for (let offset = 0; offset < audioBuffer.length; offset += chunkSize) {
      const frames = Math.min(chunkSize, audioBuffer.length - offset);
      const interleaved = new Float32Array(frames * numChannels);

      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let i = 0; i < frames; i++) {
          interleaved[i * numChannels + ch] = channelData[offset + i];
        }
      }

      const audioData = new AudioData({
        format: 'f32' as AudioSampleFormat,
        sampleRate: audioBuffer.sampleRate,
        numberOfFrames: frames,
        numberOfChannels: numChannels,
        timestamp: Math.round((offset / audioBuffer.sampleRate) * 1_000_000),
        data: interleaved,
      });

      audioEncoder.encode(audioData);
      audioData.close();
    }

    await audioEncoder.flush();
    audioEncoder.close();
  }

  // Encode video frames — use requestVideoFrameCallback (fast, no seeking)
  // with fallback to frame-by-frame seeking for older browsers.
  const frameInterval = 1 / TARGET_FPS;
  const totalFrames = Math.ceil(duration * TARGET_FPS);
  let frameIndex = 0;

  const hasRVFC = 'requestVideoFrameCallback' in video;

  if (hasRVFC) {
    // ── Fast path: play at max speed, capture decoded frames ──
    await new Promise<void>((resolve) => {
      let lastCapturedTime = -1;
      let resolved = false;
      const finish = () => { if (!resolved) { resolved = true; resolve(); } };

      const onFrame = () => {
        if (resolved) return;
        const t = video.currentTime;
        // Only capture at ~TARGET_FPS intervals to avoid duplicates
        if (t - lastCapturedTime >= frameInterval * 0.5) {
          lastCapturedTime = t;
          ctx.drawImage(video, 0, 0, w, h);

          const frame = new VideoFrame(canvas, {
            timestamp: Math.round(t * 1_000_000),
            duration: Math.round(frameInterval * 1_000_000),
          });

          const isKeyFrame = frameIndex % 60 === 0;
          videoEncoder.encode(frame, { keyFrame: isKeyFrame });
          frame.close();
          frameIndex++;

          if (frameIndex % 15 === 0) {
            const pct = Math.min(99, Math.round((t / duration) * 100));
            onProgress?.({ phase: 'compressing', percent: pct });
          }
        }

        if (!video.ended) {
          (video as any).requestVideoFrameCallback(onFrame);
        }
      };

      video.onended = () => {
        // For very short videos, ensure at least MIN_FRAMES are captured
        if (frameIndex < MIN_FRAMES) {
          ctx.drawImage(video, 0, 0, w, h);
          const frame = new VideoFrame(canvas, {
            timestamp: Math.round(video.duration * 1_000_000),
            duration: Math.round(frameInterval * 1_000_000),
          });
          videoEncoder.encode(frame, { keyFrame: true });
          frame.close();
          frameIndex++;
        }
        finish();
      };
      video.onerror = () => finish();
      // Safety timeout scaled to actual playback time at 16x speed
      const safetyMs = Math.max(5000, (duration / 16) * 1000 + 5000);
      setTimeout(finish, safetyMs);

      video.playbackRate = 16; // 16x speed — browser will decode as fast as possible
      video.muted = true;
      (video as any).requestVideoFrameCallback(onFrame);
      video.play().catch(() => finish());
    });
  } else {
    // ── Fallback: seek frame-by-frame (slower) ──
    for (let t = 0; t < duration; t += frameInterval) {
      video.currentTime = t;

      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
        setTimeout(() => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        }, 50);
      });

      ctx.drawImage(video, 0, 0, w, h);

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(t * 1_000_000),
        duration: Math.round(frameInterval * 1_000_000),
      });

      const isKeyFrame = frameIndex % 60 === 0;
      videoEncoder.encode(frame, { keyFrame: isKeyFrame });
      frame.close();
      frameIndex++;

      if (frameIndex % 30 === 0) {
        await new Promise(r => setTimeout(r, 0));
        const pct = Math.min(99, Math.round((frameIndex / totalFrames) * 100));
        onProgress?.({ phase: 'compressing', percent: pct });
      }
    }
  }

  // If no frames were captured at all, return original file
  if (frameIndex === 0) {
    videoEncoder.close();
    URL.revokeObjectURL(url);
    return file;
  }

  await videoEncoder.flush();
  videoEncoder.close();

  muxer.finalize();
  URL.revokeObjectURL(url);

  const { buffer } = muxer.target as ArrayBufferTarget;
  if (!buffer) throw new Error('Muxer produced no output');

  const blob = new Blob([buffer], { type: 'video/mp4' });

  const baseName = file.name.replace(/\.[^.]+$/, '');
  const result = new File([blob], `${baseName}.mp4`, { type: 'video/mp4' });
  onProgress?.({ phase: 'done', percent: 100 });
  return result;
}

// ── Fallback: MediaRecorder (real-time) ────────────────────────────────────

async function compressFallback(
  file: File,
  onProgress?: (p: CompressProgress) => void,
): Promise<File> {
  onProgress?.({ phase: 'loading', percent: 0 });

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';

  const url = URL.createObjectURL(file);
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Impossible de lire la video'));
    setTimeout(() => reject(new Error('Timeout chargement video')), 30000);
  });

  const duration = video.duration;
  if (!isFinite(duration) || duration <= 0) {
    URL.revokeObjectURL(url);
    return file;
  }

  const { w, h } = calcDimensions(video.videoWidth, video.videoHeight);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  onProgress?.({ phase: 'loading', percent: 50 });

  const canvasStream = canvas.captureStream(TARGET_FPS);

  // Capture audio from the video element — keep video muted to satisfy autoplay
  // policy, but use AudioContext to route audio into the MediaRecorder stream.
  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  let audioSource: MediaElementAudioSourceNode | null = null;
  let audioCtx: AudioContext | null = null;
  try {
    audioCtx = new AudioContext();
    audioSource = audioCtx.createMediaElementSource(video);
    audioDestination = audioCtx.createMediaStreamDestination();
    audioSource.connect(audioDestination);
    // Don't connect to audioCtx.destination — keeps video silent for autoplay
  } catch {
    // No audio routing available, continue without audio
  }

  const combinedStream = new MediaStream();
  canvasStream.getVideoTracks().forEach((t: MediaStreamTrack) => combinedStream.addTrack(t));
  if (audioDestination) {
    audioDestination.stream.getAudioTracks().forEach((t: MediaStreamTrack) => combinedStream.addTrack(t));
  }

  // Prefer MP4 for iOS/Safari compatibility, fall back to WebM
  const mimeOptions = [
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  const mimeType = mimeOptions.find(m => MediaRecorder.isTypeSupported(m)) || 'video/mp4';

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: TARGET_VIDEO_BITRATE,
    audioBitsPerSecond: TARGET_AUDIO_BITRATE,
  });

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  onProgress?.({ phase: 'compressing', percent: 0 });

  return new Promise<File>((resolve, reject) => {
    let stopped = false;

    const cleanup = () => {
      try { audioSource?.disconnect(); } catch {}
      try { audioCtx?.close(); } catch {}
      URL.revokeObjectURL(url);
    };

    recorder.onstop = () => {
      stopped = true;
      cleanup();
      const blob = new Blob(chunks, { type: mimeType });
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const result = new File([blob], `${baseName}.${ext}`, { type: mimeType });
      onProgress?.({ phase: 'done', percent: 100 });
      resolve(result);
    };

    recorder.onerror = () => {
      cleanup();
      reject(new Error('Erreur de compression'));
    };

    const drawFrame = () => {
      if (stopped) return;
      if (video.ended || video.paused) { recorder.stop(); return; }
      ctx.drawImage(video, 0, 0, w, h);
      const pct = Math.min(99, Math.round((video.currentTime / duration) * 100));
      onProgress?.({ phase: 'compressing', percent: pct });
      requestAnimationFrame(drawFrame);
    };

    video.onended = () => {
      if (!stopped) {
        ctx.drawImage(video, 0, 0, w, h);
        recorder.stop();
      }
    };

    recorder.start(1000);
    // Keep video muted — autoplay policy requires it. Audio is routed via AudioContext.
    video.play().then(drawFrame).catch((err) => {
      cleanup();
      reject(err);
    });
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

export async function compressVideo(
  file: File,
  onProgress?: (p: CompressProgress) => void,
): Promise<File> {
  if (!needsCompression(file)) return file;

  if (hasWebCodecs()) {
    try {
      return await compressFast(file, onProgress);
    } catch (e) {
      console.warn('WebCodecs compression failed, falling back to MediaRecorder:', e);
    }
  }

  if (typeof MediaRecorder !== 'undefined') {
    try {
      return await compressFallback(file, onProgress);
    } catch (e) {
      console.warn('MediaRecorder compression failed, uploading original:', e);
    }
  }

  console.warn('No compression API available');
  return file;
}
