// Reads the container format and real duration of an uploaded clip from its bytes.
// No dependencies: Chrome's MediaRecorder WebM has no Duration element and Safari writes
// fragmented MP4, so both need the block/fragment timing read directly.

export type AudioFormat = 'webm' | 'mp4' | 'ogg' | 'mp3';
export type ProbeResult =
  | { format: AudioFormat; mimeType: string; ext: string; durationMs: number; error?: undefined }
  | { error: string };

const FORMAT_INFO: Record<AudioFormat, { mimeType: string; ext: string }> = {
  webm: { mimeType: 'audio/webm', ext: 'webm' },
  mp4:  { mimeType: 'audio/mp4', ext: 'm4a' },
  ogg:  { mimeType: 'audio/ogg', ext: 'ogg' },
  mp3:  { mimeType: 'audio/mpeg', ext: 'mp3' },
};

const UNREADABLE = 'Could not read this audio file';
const NOT_AUDIO = 'The file must contain audio only';

type Duration = { durationMs: number } | { error: string };

export function detectFormat(buf: Buffer): AudioFormat | undefined {
  if (buf.length < 12) return undefined;
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return 'webm';
  if (buf.toString('latin1', 4, 8) === 'ftyp') return 'mp4';
  if (buf.toString('latin1', 0, 4) === 'OggS') return 'ogg';
  if (buf.toString('latin1', 0, 3) === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'mp3';
  return undefined;
}

// ── WebM / Matroska ──────────────────────────────────────────────────────────

const EBML = {
  segment: 0x18538067, info: 0x1549a966, timecodeScale: 0x2ad7b1, duration: 0x4489,
  tracks: 0x1654ae6b, trackEntry: 0xae, trackType: 0x83, codecId: 0x86,
  cluster: 0x1f43b675, timecode: 0xe7, simpleBlock: 0xa3, blockGroup: 0xa0, block: 0xa1,
};
const EBML_MASTERS = new Set([EBML.segment, EBML.info, EBML.tracks, EBML.trackEntry, EBML.cluster, EBML.blockGroup]);

function vintLength(first: number): number {
  for (let i = 0; i < 8; i += 1) if (first & (0x80 >> i)) return i + 1;
  throw new RangeError('bad vint');
}

function readId(buf: Buffer, pos: number): { value: number; length: number } {
  const length = vintLength(buf[pos]);
  if (length > 4 || pos + length > buf.length) throw new RangeError('bad id');
  return { value: buf.readUIntBE(pos, length), length };
}

// size -1 means "unknown", which live recorders write for Segment and Cluster
function readSize(buf: Buffer, pos: number): { value: number; length: number } {
  const length = vintLength(buf[pos]);
  if (pos + length > buf.length) throw new RangeError('bad size');
  let value = buf[pos] & (0xff >> length);
  let allOnes = value === 0xff >> length;
  for (let i = 1; i < length; i += 1) {
    value = value * 256 + buf[pos + i];
    if (buf[pos + i] !== 0xff) allOnes = false;
  }
  return { value: allOnes ? -1 : value, length };
}

function webmDuration(buf: Buffer): Duration {
  let scale = 1_000_000;
  let headerDuration = 0;
  let clusterTime = 0;
  let maxBlockTime = -1;
  const trackTypes: number[] = [];
  const codecs: string[] = [];

  let pos = 0;
  while (pos < buf.length) {
    const id = readId(buf, pos);
    const size = readSize(buf, pos + id.length);
    const start = pos + id.length + size.length;
    if (EBML_MASTERS.has(id.value)) {
      pos = start;
      continue;
    }
    if (size.value < 0) return { error: UNREADABLE };
    if (start + size.value > buf.length) break;

    switch (id.value) {
      case EBML.timecodeScale: scale = buf.readUIntBE(start, size.value); break;
      case EBML.duration:
        headerDuration = size.value === 4 ? buf.readFloatBE(start) : buf.readDoubleBE(start);
        break;
      case EBML.trackType: trackTypes.push(buf.readUIntBE(start, size.value)); break;
      case EBML.codecId: codecs.push(buf.toString('latin1', start, start + size.value)); break;
      case EBML.timecode: clusterTime = buf.readUIntBE(start, size.value); break;
      case EBML.simpleBlock:
      case EBML.block: {
        const track = readSize(buf, start);
        const time = clusterTime + buf.readInt16BE(start + track.length);
        if (time > maxBlockTime) maxBlockTime = time;
        break;
      }
      default: break;
    }
    pos = start + size.value;
  }

  if (!trackTypes.length || trackTypes.some((t) => t !== 2) || codecs.some((c) => !c.startsWith('A_'))) {
    return { error: NOT_AUDIO };
  }
  const ticks = headerDuration > 0 ? headerDuration : maxBlockTime;
  if (ticks < 0) return { error: UNREADABLE };
  return { durationMs: Math.round((ticks * scale) / 1_000_000) };
}

// ── MP4 / M4A ────────────────────────────────────────────────────────────────

const MP4_CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'mvex', 'moof', 'traf']);

type Mp4State = {
  movieScale: number; movieDuration: number; mediaScale: number; handlers: string[];
  trexDuration: number; fragmentEnd: number;
  traf?: { defaultDuration: number; base?: number; total: number };
};

function readVersioned(buf: Buffer, p: number, at32: number, at64: number): { scale: number; duration: number } {
  if (buf[p] === 1) return { scale: buf.readUInt32BE(p + at64), duration: Number(buf.readBigUInt64BE(p + at64 + 4)) };
  return { scale: buf.readUInt32BE(p + at32), duration: buf.readUInt32BE(p + at32 + 4) };
}

function readTrun(buf: Buffer, p: number, defaultDuration: number): number {
  const flags = buf.readUIntBE(p + 1, 3);
  const count = buf.readUInt32BE(p + 4);
  let o = p + 8 + (flags & 0x01 ? 4 : 0) + (flags & 0x04 ? 4 : 0);
  const stride = [0x100, 0x200, 0x400, 0x800].filter((f) => flags & f).length * 4;
  if (!(flags & 0x100)) return count * defaultDuration;
  let total = 0;
  for (let i = 0; i < count; i += 1, o += stride) total += buf.readUInt32BE(o);
  return total;
}

function walkMp4(buf: Buffer, from: number, to: number, s: Mp4State): void {
  let pos = from;
  while (pos + 8 <= to) {
    let size = buf.readUInt32BE(pos);
    const type = buf.toString('latin1', pos + 4, pos + 8);
    let header = 8;
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(pos + 8));
      header = 16;
    } else if (size === 0) {
      size = to - pos;
    }
    if (size < header) throw new RangeError('bad box');
    const end = Math.min(pos + size, to);
    const p = pos + header;

    if (type === 'traf') {
      s.traf = { defaultDuration: s.trexDuration, total: 0 };
      walkMp4(buf, p, end, s);
      const t = s.traf;
      s.fragmentEnd = Math.max(s.fragmentEnd, (t.base ?? s.fragmentEnd) + t.total);
      s.traf = undefined;
    } else if (MP4_CONTAINERS.has(type)) {
      walkMp4(buf, p, end, s);
    } else if (type === 'mvhd') {
      const v = readVersioned(buf, p, 12, 20);
      s.movieScale = v.scale;
      s.movieDuration = v.duration;
    } else if (type === 'mdhd') {
      s.mediaScale = readVersioned(buf, p, 12, 20).scale;
    } else if (type === 'hdlr') {
      s.handlers.push(buf.toString('latin1', p + 8, p + 12));
    } else if (type === 'trex') {
      s.trexDuration = buf.readUInt32BE(p + 12);
    } else if (type === 'tfhd' && s.traf) {
      const flags = buf.readUIntBE(p + 1, 3);
      const o = p + 8 + (flags & 0x01 ? 8 : 0) + (flags & 0x02 ? 4 : 0);
      if (flags & 0x08) s.traf.defaultDuration = buf.readUInt32BE(o);
    } else if (type === 'tfdt' && s.traf) {
      s.traf.base = buf[p] === 1 ? Number(buf.readBigUInt64BE(p + 4)) : buf.readUInt32BE(p + 4);
    } else if (type === 'trun' && s.traf) {
      s.traf.total += readTrun(buf, p, s.traf.defaultDuration);
    }
    pos = pos + size;
  }
}

function mp4Duration(buf: Buffer): Duration {
  const s: Mp4State = { movieScale: 0, movieDuration: 0, mediaScale: 0, handlers: [], trexDuration: 0, fragmentEnd: 0 };
  walkMp4(buf, 0, buf.length, s);
  const media = s.handlers.filter((h) => h === 'soun' || h === 'vide');
  if (media.length !== 1 || media[0] !== 'soun') return { error: NOT_AUDIO };
  if (s.movieDuration > 0 && s.movieScale > 0) return { durationMs: Math.round((s.movieDuration / s.movieScale) * 1000) };
  if (s.fragmentEnd > 0 && s.mediaScale > 0) return { durationMs: Math.round((s.fragmentEnd / s.mediaScale) * 1000) };
  return { error: UNREADABLE };
}

// ── Ogg (Opus or Vorbis) ─────────────────────────────────────────────────────

function oggDuration(buf: Buffer): Duration {
  let pos = 0;
  let serial: number | undefined;
  let rate = 0;
  let preSkip = 0;
  let granule = -1;

  while (pos + 27 <= buf.length && buf.toString('latin1', pos, pos + 4) === 'OggS') {
    const segments = buf[pos + 26];
    if (pos + 27 + segments > buf.length) break;
    let bodySize = 0;
    for (let i = 0; i < segments; i += 1) bodySize += buf[pos + 27 + i];
    const body = pos + 27 + segments;
    if (body + bodySize > buf.length) break;

    const pageSerial = buf.readUInt32LE(pos + 14);
    if (serial === undefined) {
      serial = pageSerial;
      if (buf.toString('latin1', body, body + 8) === 'OpusHead') {
        rate = 48000;
        preSkip = buf.readUInt16LE(body + 10);
      } else if (buf.toString('latin1', body, body + 7) === '\x01vorbis') {
        rate = buf.readUInt32LE(body + 12);
      } else {
        return { error: NOT_AUDIO };
      }
    } else if (pageSerial !== serial) {
      return { error: NOT_AUDIO };
    }
    const g = Number(buf.readBigInt64LE(pos + 6));
    if (g > granule) granule = g;
    pos = body + bodySize;
  }

  if (!rate || granule < 0) return { error: UNREADABLE };
  return { durationMs: Math.round((Math.max(0, granule - preSkip) / rate) * 1000) };
}

// ── MP3 (MPEG layer III) ─────────────────────────────────────────────────────

const MP3_BITRATES = {
  v1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  v2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const MP3_RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function mp3Frame(buf: Buffer, i: number): { length: number; seconds: number } | undefined {
  if (i + 4 > buf.length || buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) return undefined;
  const version = (buf[i + 1] >> 3) & 3;
  const layer = (buf[i + 1] >> 1) & 3;
  const bitrateIdx = buf[i + 2] >> 4;
  const rateIdx = (buf[i + 2] >> 2) & 3;
  if (version === 1 || layer !== 1 || bitrateIdx === 0 || bitrateIdx === 15 || rateIdx === 3) return undefined;
  const v1 = version === 3;
  const bitrate = (v1 ? MP3_BITRATES.v1 : MP3_BITRATES.v2)[bitrateIdx] * 1000;
  const rate = MP3_RATES[version][rateIdx];
  const length = Math.floor(((v1 ? 144 : 72) * bitrate) / rate) + ((buf[i + 2] >> 1) & 1);
  return { length, seconds: (v1 ? 1152 : 576) / rate };
}

function mp3Duration(buf: Buffer): Duration {
  let pos = 0;
  if (buf.toString('latin1', 0, 3) === 'ID3') {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    pos = 10 + size + (buf[5] & 0x10 ? 10 : 0);
  }
  const searchEnd = Math.min(buf.length, pos + 4096);
  while (pos < searchEnd && !mp3Frame(buf, pos)) pos += 1;

  let frames = 0;
  let seconds = 0;
  for (let frame = mp3Frame(buf, pos); frame; frame = mp3Frame(buf, pos)) {
    frames += 1;
    seconds += frame.seconds;
    pos += frame.length;
  }
  if (frames < 3) return { error: UNREADABLE };
  return { durationMs: Math.round(seconds * 1000) };
}

const READERS: Record<AudioFormat, (buf: Buffer) => Duration> = {
  webm: webmDuration, mp4: mp4Duration, ogg: oggDuration, mp3: mp3Duration,
};

export function probeAudio(buf: Buffer): ProbeResult {
  const format = detectFormat(buf);
  if (!format) return { error: 'Unsupported audio format. Use WebM, M4A, MP3 or Ogg.' };
  try {
    const result = READERS[format](buf);
    if ('error' in result) return { error: result.error as string };
    return { format, ...FORMAT_INFO[format], durationMs: result.durationMs };
  } catch {
    return { error: UNREADABLE };
  }
}
