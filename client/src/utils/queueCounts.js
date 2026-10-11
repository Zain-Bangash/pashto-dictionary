export const QUEUE_VIEWS = ['entries', 'suggestions', 'audio'];

// What waits for this person: moderators review pending items, admins also publish approved ones
export function waitingIn(stats, view, isAdmin) {
  const q = stats?.queue?.[view];
  if (!q) return 0;
  return q.pending + (isAdmin ? q.approved : 0);
}

export function waitingTotal(stats, isAdmin) {
  return QUEUE_VIEWS.reduce((sum, view) => sum + waitingIn(stats, view, isAdmin), 0);
}
