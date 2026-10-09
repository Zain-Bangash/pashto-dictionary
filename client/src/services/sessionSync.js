const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('pd-auth');

export function broadcastLogout() {
  channel?.postMessage({ type: 'logout' });
}

export function onLogoutBroadcast(fn) {
  if (!channel) return () => {};
  const listener = (event) => {
    if (event.data?.type === 'logout') fn();
  };
  channel.addEventListener('message', listener);
  return () => channel.removeEventListener('message', listener);
}
