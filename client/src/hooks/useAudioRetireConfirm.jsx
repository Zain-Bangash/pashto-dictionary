import { useState } from 'react';
import RetireAudioDialog from '../components/audio/RetireAudioDialog';

// send(request): request(extraBody) is retried with confirmAudioRetire once the user confirms
// the server's warning. Resolves to the response, or null if the user cancels.
export default function useAudioRetireConfirm() {
  const [pending, setPending] = useState(null);

  const send = async (request) => {
    try {
      return await request({});
    } catch (err) {
      const error = err?.response?.data?.error;
      if (err?.response?.status !== 409 || error?.field !== 'confirmAudioRetire') throw err;
      const confirmed = await new Promise((resolve) => setPending({ retiring: error.retiring ?? [], resolve }));
      setPending(null);
      return confirmed ? request({ confirmAudioRetire: true }) : null;
    }
  };

  const dialog = pending && (
    <RetireAudioDialog
      retiring={pending.retiring}
      onConfirm={() => pending.resolve(true)}
      onCancel={() => pending.resolve(false)}
    />
  );

  return { send, dialog };
}
