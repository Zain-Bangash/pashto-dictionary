import { useState, useRef, useEffect, useCallback } from 'react';
import { pickRecordingType } from '../utils/audio';

// Recorders overshoot slightly; stopping this early keeps clips inside the server's limit
const STOP_EARLY_MS = 150;

function micError(err) {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return 'Microphone access was blocked. Allow it in your browser settings, or upload a recording instead.';
  }
  if (err?.name === 'NotFoundError') return 'No microphone was found. Upload a recording instead.';
  return 'Recording is not available in this browser. Upload a recording instead.';
}

export default function useRecorder(maxSeconds) {
  const [status, setStatus]   = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob]       = useState(null);
  const [error, setError]     = useState(null);
  const recorderRef = useRef(null);
  const timerRef    = useRef(null);
  const streamRef   = useRef(null);

  const release = useCallback(() => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    release();
  }, [release]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    setElapsed(0);
    setStatus('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const type = pickRecordingType();
      const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
      recorder.onstop = () => {
        release();
        setBlob(new Blob(chunks, { type: (recorder.mimeType || type || 'audio/webm').split(';')[0] }));
        setStatus('recorded');
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus('recording');
      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const ms = Date.now() - startedAt;
        setElapsed(ms);
        if (ms >= maxSeconds * 1000 - STOP_EARLY_MS) stop();
      }, 100);
    } catch (err) {
      release();
      setError(micError(err));
      setStatus('idle');
    }
  }, [maxSeconds, release, stop]);

  const reset = useCallback(() => {
    setBlob(null);
    setElapsed(0);
    setStatus('idle');
  }, []);

  return { status, elapsed, blob, error, start, stop, reset };
}
