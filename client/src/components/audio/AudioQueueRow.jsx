import useLookups from '../../hooks/useLookups';
import AudioPlayButton from './AudioPlayButton';
import { audioSlotLabel, speakerCredit } from '../../utils/audio';
import { APPROVE_BTN, REJECT_BTN, PUBLISH_BTN } from '../moderation/queueButtons';

function ClipPanel({ title, clip, tone }) {
  const { labelFor } = useLookups();
  return (
    <div className={`flex-1 min-w-[12rem] rounded-[12px] border px-3 py-2 space-y-1 ${tone}`}>
      <p className="text-[10px] font-ui font-semibold text-muted uppercase tracking-wider">{title}</p>
      {clip ? (
        <>
          <div className="flex items-center gap-2">
            <AudioPlayButton clip={clip} label={`Play ${title.toLowerCase()} recording`} />
            <span className="text-xs font-ui text-muted tabular-nums">{(clip.durationMs / 1000).toFixed(1)}s</span>
          </div>
          <p className="text-[11px] font-ui text-muted/70">by {speakerCredit(clip.submittedBy, labelFor) ?? 'unknown'}</p>
        </>
      ) : (
        <p className="text-xs font-ui text-muted/50 italic">No recording yet</p>
      )}
    </div>
  );
}

export default function AudioQueueRow({ clip, isAdmin, userId, onApprove, onReject, onPublish }) {
  const { labelFor } = useLookups();
  const { variant, slotInfo, status } = clip;
  const own = Boolean(userId) && String(clip.submittedBy?._id) === String(userId);
  const blockedOwn = own && !isAdmin;

  return (
    <li className="bg-white/[0.035] border border-white/[0.08] rounded-[20px] p-5 space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          {variant ? (
            <>
              <p className="text-warm font-display text-lg font-semibold">{variant.concept?.englishGloss}</p>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span dir="rtl" className="font-pashto text-warm text-2xl">{variant.pashto}</span>
                <span className="font-ui text-xs px-2 py-0.5 bg-white/[0.05] border border-white/[0.07] rounded-full text-muted/70">
                  {labelFor('region', variant.region)}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm font-ui text-muted italic">The word is no longer available</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          {status === 'pending' && (
            <>
              <button onClick={() => onApprove(clip._id)} disabled={blockedOwn} className={APPROVE_BTN}>Approve</button>
              <button onClick={() => onReject(clip._id)} disabled={blockedOwn} className={REJECT_BTN}>Reject</button>
            </>
          )}
          {status === 'approved' && isAdmin && (
            <>
              <button onClick={() => onPublish(clip._id)} className={PUBLISH_BTN}>Publish</button>
              <button onClick={() => onReject(clip._id)} className={REJECT_BTN}>Reject</button>
            </>
          )}
        </div>
      </div>

      <div className="px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-[10px]">
        <p className="text-[10px] font-ui font-semibold text-muted uppercase tracking-wider">{audioSlotLabel(clip.slot)} — should say</p>
        {slotInfo?.text ? (
          <p dir="rtl" className="font-pashto text-warm text-xl leading-[1.8]">{slotInfo.text}</p>
        ) : (
          <p className="text-xs font-ui text-muted">{slotInfo ? 'This form has no text yet' : 'This slot no longer exists on the word'}</p>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        {clip.current && <ClipPanel title="Current" clip={clip.current} tone="border-white/[0.08] bg-white/[0.02]" />}
        <ClipPanel title={clip.current ? 'Replacement' : 'New'} clip={clip} tone="border-mint/25 bg-mint/[0.04]" />
      </div>
      {blockedOwn && <p className="text-[11px] font-ui text-muted/60">You recorded this, so another moderator must review it.</p>}
    </li>
  );
}
