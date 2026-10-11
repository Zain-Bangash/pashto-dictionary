# Pashto Dictionary — Design System Reference

A living reference for applying the homepage visual language to all other pages.
Copy classes and patterns directly — do not invent new tokens.

---

## Colour Tokens (`index.css @theme`)

| Token | Hex | Use |
|---|---|---|
| `charcoal` / `bg-charcoal` | `#13130e` | Page background (all pages) |
| `warm` / `text-warm` | `#fffef8` | Primary text, headings |
| `gold` / `text-gold` | `#e8c547` | Phonetics, highlights, accents |
| `terracotta` / `text-terracotta` | `#c4775a` | Primary CTA buttons, left-border accents |
| `mint` / `text-mint` | `#00f5b4` | **System/status only** — LIVE badge, approved state, active filters |
| `muted` / `text-muted` | `#6a6a6a` | Secondary labels, metadata |
| `violet` | `#a78bfa` | Tertiary stat accents (contributors count) |

> **Rule**: mint is never used for decoration or CTAs. It signals approved/live/active state only.

> **No inline styles**: every example below is a Tailwind class. Use arbitrary values (`bg-white/[0.035]`, `shadow-[0_4px_20px_rgba(196,119,90,0.35)]`) rather than `style={{}}`.

### Status colours

One mapping everywhere a status appears (badges, chips, counts, the Overview):

| Status | Colour | Classes (`StatusBadge`) |
|---|---|---|
| pending (waiting) | gold | `text-gold border-gold/30 bg-gold/[0.08]` |
| approved | mint | `text-mint border-mint/30 bg-mint/[0.08]` |
| published (live) | mint | `text-mint border-mint/30 bg-mint/[0.08]` |
| rejected | red | `text-red-400 border-red-400/30 bg-red-400/[0.08]` |

Use `components/submissions/StatusBadge.jsx` for any status label. Warnings and hints ("Publish the concept first", similar-concept notices) use gold, not amber. Roles are not statuses: admin is violet, moderator gold, user muted.

---

## Typography

| Font | Token | Use |
|---|---|---|
| Cormorant Garamond | `font-display` | Definitions, examples, phonetics — italic always preferred |
| DM Sans | `font-ui` | All UI labels, buttons, metadata, form inputs |
| Noto Naskh Arabic | `font-pashto` | Pashto script only — always `dir="rtl"`; line-height 1.6 is enforced by `.font-pashto` in `index.css` |

**Pashto text rule**: always wrap in `<div dir="rtl" className="font-pashto">`. Never apply `font-pashto` to English text.

**Line-height**: `.font-pashto { line-height: 1.6 !important; }` overrides any inline `lineHeight`. Naskh ink descends ~0.52em below the baseline, so anything under ~1.5 clips descenders (ښ ږ ې ۍ) inside `overflow-hidden` parents.

**English in mixed blocks**: use `dir="ltr"` explicitly on any English paragraph inside an RTL parent.

---

## Glass Card — The Core Pattern

Every surface in the app is a glass panel. Base class: `bento-card`.

```jsx
// Standard card
<div className="bento-card bg-white/[0.035] backdrop-blur-[32px] border border-white/[0.08] rounded-3xl p-5">

// Hero / focal card (larger radius, more blur)
<div className="bento-card gold-glow bg-white/[0.04] backdrop-blur-[40px] border border-white/[0.08] rounded-[48px] p-8">

// Word card / grid item (crisper radius)
<div className="bento-card bg-white/[0.03] backdrop-blur-[24px] border border-white/[0.07] rounded-[16px]"
     style={{ borderLeft: '2px solid rgba(196,119,90,0.5)' }}>
```

**Radius hierarchy**:
- Focal hero panel: `rounded-[48px]`
- Secondary panels (search, stats, CTA): `rounded-3xl` (24px)
- Grid items / inner cards: `rounded-[16px]`
- Badges / pills: `rounded-full` or `rounded-md`

**`bento-card` CSS** applies:
- Spring hover lift: `translateY(-5px) scale(1.012)` via `cubic-bezier(0.34,1.56,0.64,1)`
- Inset top-edge highlight: `inset 0 1px 0 rgba(255,255,255,0.06)`

---

## Interactive States

### Pashto word (`.pashto-bloom`)
Add class `pashto-bloom` to any Pashto word inside a `.bento-card`. On card hover it scales 1.05× and switches to a metallic gold/cream/terracotta shimmer gradient via `background-clip: text`.

```jsx
<div dir="rtl" className="pashto-bloom font-pashto text-warm font-bold">
  {entry.pashto}
</div>
```

### Listen / audio button (`.listen-btn`)
Terracotta pulse-ring animation fires on hover. Always pair with a `<Waveform>` component.

```jsx
<button className="listen-btn flex items-center gap-1.5 border border-terracotta/35 rounded-full text-terracotta hover:bg-terracotta/10 px-3 py-1.5">
  <Waveform color="#c4775a" animated={playing} />
  <span className="font-ui text-xs">{playing ? 'Playing…' : 'Listen'}</span>
</button>
```

### 3D Tilt (word grid cards)
Mouse-driven `perspective(700px) rotateX/Y ±12°` with directional gold shadow. Apply the `onMouseMove` / `onMouseLeave` pattern from `WordCard` in `Home.jsx` to any grid card that should feel tactile.

### Focus spotlight (search / form inputs)
`.search-card:focus-within` adds a terracotta border-glow. For full spotlight effect (frosted dimmer), add a `searchFocused` state + fixed overlay (see `Home.jsx`).

---

## Entrance Animations

```jsx
// Staggered entrance — put on the outermost wrapper of each section/card
<div className="bento-enter" style={{ animationDelay: '0.1s' }}>

// For grid items, stagger individually
{items.map((item, i) => (
  <Link key={item._id} className="block bento-enter" style={{ animationDelay: `${0.28 + i * 0.08}s` }}>
))}
```

`bento-enter` = `slideUpFadeIn 0.55s cubic-bezier(0.22,1,0.36,1) both`.

For internal stagger within a card (e.g., definition appears after phonetic):
```jsx
<div style={{ animation: 'fadeSlideIn 0.4s ease both', animationDelay: '0.2s' }}>
```

`fadeSlideIn` includes a `blur(4px) → blur(0)` for a cinematic reveal.

---

## Buttons

```jsx
// Primary CTA — terracotta
<button className="font-ui font-semibold text-warm bg-terracotta rounded-xl text-sm px-5 py-2.5 hover:opacity-90 transition-opacity"
  style={{ boxShadow: '0 4px 20px rgba(196,119,90,0.35)' }}>

// Secondary / ghost
<button className="font-ui text-warm/70 border border-white/[0.1] rounded-xl text-sm px-5 py-2.5 hover:border-white/20 hover:text-warm transition-all">

// Filter chip (StatusChips / DomainFilter / RegionPills); active = mint, the system "active" state
// inactive:
className="font-ui text-xs px-3 py-1.5 rounded-full border bg-white/[0.04] border-white/[0.08] text-muted hover:text-warm"
// active:
className="font-ui text-xs px-3 py-1.5 rounded-full border bg-mint/15 border-mint/40 text-mint"
```

Status filters are always chips with counts, never a `<select>`. Text inputs focus to `focus:border-terracotta/60`.

### Moderation action buttons (`components/moderation/queueButtons.js`)

| Button | Class | Use |
|---|---|---|
| `PRIMARY_BTN` (= `APPROVE_BTN`, `PUBLISH_BTN`) | terracotta fill | The item's next step: Approve, Publish, Save, Confirm |
| `REJECT_BTN` | red outline, no fill | Reject, destructive actions |
| `EDIT_BTN` | white/12 outline | Edit, Manage, Merge, Clear, Cancel |

All `rounded-xl`, `text-xs font-semibold`. Only one primary button per row is visible at a time.

---

## Status / Badge Patterns

```jsx
// LIVE badge (approved/published status)
<div className="inline-flex items-center gap-1.5 bg-black/40 border border-mint/25 rounded-full px-2.5 py-1">
  <div className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse-soft" />
  <span className="font-ui font-semibold text-mint text-[9px] tracking-widest">LIVE</span>
</div>

// POS badge
<span className="font-ui text-warm/50 border border-white/[0.1] rounded-md text-[9px] px-1.5 py-0.5 uppercase tracking-wider">
  N.
</span>

// Meta label (section headers, timestamps)
<span className="meta-label">Word of the Day</span>
```

`.meta-label` = 9px, `letter-spacing: 0.16em`, uppercase, `rgba(255,254,248,0.7)`.

---

## Layout

All pages use the same outer shell:

```jsx
<div className="min-h-screen bg-charcoal">
  <AmbientBackground />   {/* components/AmbientBackground.jsx */}
  <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8 flex flex-col gap-4 sm:gap-5">
    {/* page content */}
  </div>
</div>
```

Grid for multi-column card layouts:
```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
```

---

## Ambient Background

`AmbientBackground` lives in `client/src/components/AmbientBackground.jsx` and is used by Home and Submit. It renders:
- A faint diamond lattice (`.ambient-lattice` in `index.css`)
- Two radial gradient blobs (terracotta top-left, gold bottom-right)
- Grain overlay (`grain-overlay`)

All three are `fixed inset-0 pointer-events-none -z-10`.

---

## Dashboard (calm tool look)

The dashboard is a work tool for scanning many items, so it keeps the tokens, glass cards, fonts and chip styles but **skips** the ambient background, `bento-card` hover lift, 3D tilt and entrance animations.

- **Layout**: `DashboardLayout` shows a sidebar from `md` up and a horizontally scrolling tab row on phones. The Queue item carries a gold count badge of what waits for the viewer (moderators: pending; admins: pending + approved).
- **Queues**: toolbar = status chips (admins) → search, region, submitter → "Select all on this page". Filters live in the URL. Rows stack their action buttons under the content below `sm`.
- **Bulk bar**: sticky at the bottom (`sticky bottom-4`), `bg-charcoal/95` glass, lists failures in red under the buttons.
- **Feedback**: success → toast (`useToast()`, bottom-right, fades after 4 s); a failed single action → dismissible red banner (`ActionError`) above the list; a failed bulk run → error toast plus the failure list.
- **Loading**: the first load shows "Loading…"; later loads keep the list on screen at `opacity-60` so inputs never lose focus.

## Forms (Submit)

A single-column form inside the standard shell: `max-w-xl mx-auto` within the `max-w-6xl` container. The form card uses the glass classes and `rounded-3xl` but **not** `bento-card`, so the form does not lift under the cursor while typing. Shared classes live in `components/submit/submitStyles.js`:

- Inputs: `bg-black/40 border-white/[0.08] rounded-[12px]`, focus `border-terracotta/60`
- Labels: `text-xs uppercase tracking-wider text-muted`
- Inner sections (concept summary, pronunciation): `rounded-[16px] bg-white/[0.03] border-white/[0.07]`
- Hints and similar-word notices: gold; field errors: `text-red-400 text-xs`
- Record button: the `.listen-btn` terracotta pill (`components/audio/RecordingControls.jsx`), shared with the concept-page recorder

## Applying to a New Page — Checklist

- [ ] Wrap in `<div className="min-h-screen bg-charcoal">` with `<AmbientBackground />`
- [ ] Content in `relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8`
- [ ] Cards use the glass pattern (`bento-card bg-white/[0.03-0.04] backdrop-blur-[24-40px] border border-white/[0.07-0.08]`)
- [ ] Correct radius for the card's visual weight (48px hero, 24px secondary, 16px grid)
- [ ] Pashto words have `dir="rtl" className="pashto-bloom font-pashto"`
- [ ] English text inside RTL parents has `dir="ltr"` explicitly
- [ ] CTAs use `bg-terracotta text-warm`, not mint
- [ ] Mint reserved for system status only (approved, published, active filter)
- [ ] Section entrance wrapped in `bento-enter` with `animationDelay` (public pages; the dashboard skips it)
- [ ] Statuses use `StatusBadge` and the status colour table; no `style={{}}`
