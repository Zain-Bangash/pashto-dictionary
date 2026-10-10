// Container detection and real-duration parsing for uploaded pronunciation clips.
// WebM/MP4 fixtures are real Chrome MediaRecorder output; MP3 and Ogg are built here.

const fs = require('fs');
const path = require('path');
const { probeAudio } = require('../utils/audioProbe');

const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', 'audio', name));

function mp3(frames, { id3 = false } = {}) {
  // MPEG-1 layer III, 128 kbps, 44.1 kHz: 417-byte frames of 1152 samples
  const frame = Buffer.alloc(417);
  frame.set([0xff, 0xfb, 0x90, 0x00]);
  const parts = [];
  if (id3) parts.push(Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 10]), Buffer.alloc(10));
  for (let i = 0; i < frames; i += 1) parts.push(frame);
  parts.push(Buffer.from('TAG'), Buffer.alloc(125));
  return Buffer.concat(parts);
}

function oggPage(granule, body, serial = 1) {
  const header = Buffer.alloc(28);
  header.write('OggS', 0, 'latin1');
  header.writeBigInt64LE(BigInt(granule), 6);
  header.writeUInt32LE(serial, 14);
  header[26] = 1;
  header[27] = body.length;
  return Buffer.concat([header, body]);
}

function opusHead(preSkip) {
  const head = Buffer.alloc(19);
  head.write('OpusHead', 0, 'latin1');
  head[8] = 1;
  head[9] = 1;
  head.writeUInt16LE(preSkip, 10);
  head.writeUInt32LE(48000, 12);
  return head;
}

const near = (actual, expected, tolerance = 150) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);

describe('probeAudio', () => {
  test('Chrome WebM/Opus without a Duration element: reads the block timing', () => {
    const result = probeAudio(fixture('chrome-2s.webm'));
    expect(result).toEqual(expect.objectContaining({ format: 'webm', mimeType: 'audio/webm', ext: 'webm' }));
    near(result.durationMs, 2000, 300);
    near(probeAudio(fixture('chrome-6s.webm')).durationMs, 6000, 300);
  });

  test('fragmented MP4 from MediaRecorder: sums the fragment durations', () => {
    const result = probeAudio(fixture('chrome-2s.mp4'));
    expect(result).toEqual(expect.objectContaining({ format: 'mp4', mimeType: 'audio/mp4', ext: 'm4a' }));
    near(result.durationMs, 2000, 300);
  });

  test('MP3: counts frames, skipping ID3 tags at either end', () => {
    near(probeAudio(mp3(100)).durationMs, 2612, 5);
    const tagged = probeAudio(mp3(100, { id3: true }));
    expect(tagged).toEqual(expect.objectContaining({ format: 'mp3', mimeType: 'audio/mpeg', ext: 'mp3' }));
    near(tagged.durationMs, 2612, 5);
  });

  test('Ogg Opus (e.g. a WhatsApp voice note): last granule minus pre-skip', () => {
    const buf = Buffer.concat([oggPage(0, opusHead(312)), oggPage(96000 + 312, Buffer.from('abc'))]);
    const result = probeAudio(buf);
    expect(result).toEqual(expect.objectContaining({ format: 'ogg', mimeType: 'audio/ogg' }));
    near(result.durationMs, 2000, 5);
  });

  test('a WebM with a video track is refused', () => {
    const buf = Buffer.from(fixture('chrome-2s.webm'));
    const at = buf.indexOf(Buffer.from([0x83, 0x81, 0x02]));
    buf[at + 2] = 0x01;
    expect(probeAudio(buf).error).toMatch(/audio only/);
  });

  test('an Ogg stream that is not audio, or multiplexes two streams, is refused', () => {
    expect(probeAudio(Buffer.concat([oggPage(0, Buffer.from('\x80theora-header-bytes', 'latin1')), oggPage(10, Buffer.from('x'))])).error)
      .toMatch(/audio only/);
    expect(probeAudio(Buffer.concat([oggPage(0, opusHead(0)), oggPage(48000, Buffer.from('x'), 2)])).error).toMatch(/audio only/);
  });

  test('unknown bytes, a renamed file, and truncated headers are refused', () => {
    expect(probeAudio(Buffer.from('RIFF....WAVEfmt this is not supported')).error).toMatch(/Unsupported/);
    expect(probeAudio(Buffer.from('<html><script>alert(1)</script></html>')).error).toMatch(/Unsupported/);
    expect(probeAudio(fixture('chrome-2s.webm').subarray(0, 40)).error).toMatch(/Could not read/);
    expect(probeAudio(mp3(2)).error).toMatch(/Could not read/);
  });
});
