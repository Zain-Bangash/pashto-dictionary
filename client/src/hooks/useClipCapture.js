import { useState, useMemo, useEffect, useCallback } from 'react';
import useRecorder from './useRecorder';
import { MAX_UPLOAD_BYTES } from '../utils/audio';

// A recorded or uploaded clip held in the browser, with its preview URL
export default function useClipCapture(maxSeconds) {
  const recorder = useRecorder(maxSeconds);
  const { reset } = recorder;
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);

  const clip = file ?? recorder.blob;
  const previewUrl = useMemo(() => (clip && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(clip) : null), [clip]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const discard = useCallback(() => { setFile(null); setError(null); reset(); }, [reset]);

  const chooseFile = useCallback((e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    reset();
    if (picked.size > MAX_UPLOAD_BYTES) {
      setError('The file must be 1 MB or smaller.');
      return;
    }
    setError(null);
    setFile(picked);
  }, [reset]);

  return { recorder, clip, previewUrl, error: error || recorder.error, setError, discard, chooseFile };
}
