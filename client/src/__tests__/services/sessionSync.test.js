import { vi, describe, it, expect } from 'vitest';
import { broadcastLogout, onLogoutBroadcast } from '../../services/sessionSync';

const nextTick = () => new Promise((r) => setTimeout(r, 20));

describe('sessionSync', () => {
  it('calls the listener when another tab broadcasts a logout', async () => {
    const listener = vi.fn();
    const unsubscribe = onLogoutBroadcast(listener);
    const otherTab = new BroadcastChannel('pd-auth');

    otherTab.postMessage({ type: 'logout' });
    await nextTick();

    expect(listener).toHaveBeenCalledTimes(1);
    otherTab.close();
    unsubscribe();
  });

  it('broadcastLogout reaches other tabs', async () => {
    const otherTab = new BroadcastChannel('pd-auth');
    const received = vi.fn();
    otherTab.onmessage = (e) => received(e.data);

    broadcastLogout();
    await nextTick();

    expect(received).toHaveBeenCalledWith({ type: 'logout' });
    otherTab.close();
  });

  it('ignores unrelated messages and stops after unsubscribe', async () => {
    const listener = vi.fn();
    const unsubscribe = onLogoutBroadcast(listener);
    const otherTab = new BroadcastChannel('pd-auth');

    otherTab.postMessage({ type: 'something-else' });
    await nextTick();
    unsubscribe();
    otherTab.postMessage({ type: 'logout' });
    await nextTick();

    expect(listener).not.toHaveBeenCalled();
    otherTab.close();
  });
});
