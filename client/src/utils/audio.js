import { slotLabel } from './forms';

// Preferred recording containers, best first: Opus in WebM (Chrome, Firefox, Android), then MP4 (Safari, iPhone)
const RECORDING_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

// Matches what the server accepts from a file upload
export const UPLOAD_ACCEPT = '.webm,.m4a,.mp4,.mp3,.ogg,.opus,audio/webm,audio/mp4,audio/x-m4a,audio/mpeg,audio/ogg';
export const MAX_UPLOAD_BYTES = 1024 * 1024;

export function pickRecordingType() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return null;
  if (typeof window.MediaRecorder.isTypeSupported !== 'function') return '';
  return RECORDING_TYPES.find((t) => window.MediaRecorder.isTypeSupported(t)) ?? '';
}

export function canRecord() {
  return Boolean(typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && pickRecordingType() !== null);
}

export function audioSlotLabel(slot) {
  if (slot === 'headword') return 'Word';
  if (slot === 'example') return 'Example sentence';
  return `Form (${slotLabel(slot.replace(/^form:/, ''))})`;
}

export function speakerCredit(user, labelFor) {
  if (!user?.username) return null;
  const place = [user.village, user.region && labelFor('region', user.region)].filter(Boolean).join(', ');
  return place ? `${user.username} (${place})` : user.username;
}
