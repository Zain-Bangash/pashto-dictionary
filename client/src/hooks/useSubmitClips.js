import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadAudio } from '../services/api';
import useClipCapture from './useClipCapture';
import { slotMaxSeconds } from '../utils/audio';

const SLOTS = ['headword', 'example'];
const messageOf = (err, fallback) => err?.response?.data?.error?.message ?? fallback;

// The optional recordings of the word and its example, sent once the word is saved. Failed ones stay here to retry or skip.
export default function useSubmitClips(values) {
  const navigate = useNavigate();
  const headword = useClipCapture(slotMaxSeconds('headword', values.pashto));
  const example = useClipCapture(slotMaxSeconds('example', values.example));
  const captures = { headword, example };
  const [savedVariantId, setSavedVariantId] = useState(null);
  const [failedSlots, setFailedSlots] = useState([]);
  const [audioError, setAudioError] = useState('');

  async function send(variantId, slots) {
    const failed = [];
    let message = '';
    for (const slot of slots) {
      try {
        await uploadAudio(variantId, slot, captures[slot].clip);
      } catch (err) {
        failed.push(slot);
        message ||= messageOf(err, 'Upload failed. Please try again.');
      }
    }
    if (!failed.length) {
      navigate('/my-submissions');
      return;
    }
    setSavedVariantId(variantId);
    setFailedSlots(failed);
    setAudioError(message);
  }

  return {
    captures,
    savedVariantId,
    failedSlots,
    audioError,
    sendAfterSave: (variantId) => send(variantId, SLOTS.filter((s) => captures[s].clip)),
    retry: () => {
      setAudioError('');
      return send(savedVariantId, failedSlots.filter((s) => captures[s].clip));
    },
    skip: () => navigate('/my-submissions'),
  };
}
