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

---

## Typography

| Font | Token | Use |
|---|---|---|
| Cormorant Garamond | `font-display` | Definitions, examples, phonetics — italic always preferred |
| DM Sans | `font-ui` | All UI labels, buttons, metadata, form inputs |
| Noto Nastaliq Urdu | `font-pashto` | Pashto script only — always `dir="rtl"` + `style={{ lineHeight: 1.7 }}` |

**Pashto text rule**: always wrap in `<div dir="rtl" className="font-pashto" style={{ lineHeight: 1.7 }}>`. Never apply `font-pashto` to English text.

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
<div dir="rtl" className="pashto-bloom font-pashto text-warm font-bold" style={{ lineHeight: 1.7 }}>
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

// Filter pill (inactive / active)
// inactive:
style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#666' }}
// active (mint = system active state):
style={{ background: 'rgba(0,245,180,0.15)', border: '1px solid rgba(0,245,180,0.4)', color: '#00f5b4' }}
```

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
  <AmbientBackground />   {/* import from Home.jsx or a shared components file */}
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

`AmbientBackground` (currently in `Home.jsx`) should be extracted to `client/src/components/AmbientBackground.jsx` and imported on every page. It renders:
- 72 floating bezier paths (CSS animated, `floatingPathPulse`)
- Two radial gradient blobs (terracotta top-left, gold bottom-right)
- Grain overlay (`grain-overlay`)

All three are `fixed inset-0 pointer-events-none -z-10`.

---

## Applying to a New Page — Checklist

- [ ] Wrap in `<div className="min-h-screen bg-charcoal">` with `<AmbientBackground />`
- [ ] Content in `relative w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8`
- [ ] Cards use the glass pattern (`bento-card bg-white/[0.03-0.04] backdrop-blur-[24-40px] border border-white/[0.07-0.08]`)
- [ ] Correct radius for the card's visual weight (48px hero, 24px secondary, 16px grid)
- [ ] Pashto words have `dir="rtl" className="pashto-bloom font-pashto"` + `lineHeight: 1.7`
- [ ] English text inside RTL parents has `dir="ltr"` explicitly
- [ ] CTAs use `bg-terracotta text-warm`, not mint
- [ ] Mint reserved for system status only (approved, published, active filter)
- [ ] Section entrance wrapped in `bento-enter` with `animationDelay`
