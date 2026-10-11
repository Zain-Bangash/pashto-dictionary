const BTN = 'px-3 py-1.5 text-xs font-ui font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed';

// An item's next step (approve, then publish) is the terracotta CTA; status colours stay on badges
export const PRIMARY_BTN = `${BTN} bg-terracotta text-warm hover:opacity-90 shadow-[0_4px_16px_rgba(196,119,90,0.3)]`;
export const APPROVE_BTN = PRIMARY_BTN;
export const PUBLISH_BTN = PRIMARY_BTN;
export const REJECT_BTN  = `${BTN} border border-red-400/35 text-red-400 hover:bg-red-400/10`;
export const EDIT_BTN    = `${BTN} border border-white/[0.12] text-warm/70 hover:border-white/25 hover:text-warm`;
