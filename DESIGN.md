# Design

<!-- impeccable:design-schema 1 -->

The visual world for KasirKu: **Boose** — the interface language of a modern
point-of-sale admin, brought down to a phone. Chosen 2026-11-24, replacing the
*Jendela kasir* world; the decision and its reasons are in
`docs/adr/0005-boose-interface-language.md`. Read with PRODUCT.md; where they
conflict on visual matters, this file wins.

The reference is the Boose design system (Sado Brew admin), held in
`UI.figcraft` on the pages `Boose - UI`, `Boose - Style Guide` and
`Boose - Icons`, and applied to every screen on the page `Hi-Fi UI`.

## The world

A till is an instrument on a counter, but it is also software the owner uses
every day for years. Boose's world is the answer to that: **cards floating on a
cool ground**, one blue that means "do this", and money that reads as money.
It is calm, modern and legible rather than austere.

The world contributes four things and no more:

1. **One voice** — IBM Plex Sans, with real tabular figures, at every size.
   Nothing in the app is written by hand, including the printed receipt.
2. **A cool ground and white cards** — `#F1F5F9` behind, `#FFFFFF` cards at
   radius 16 with one soft shadow. Separation is elevation, not rules.
3. **Figures as the subject** — prices, quantities and totals carry the weight;
   labels stay small and quiet. A column of rupiah never shimmers.
4. **One signature move** — the total, set inside a blue block with the word
   `Total` at its left. That block is the loudest thing on any screen, and it
   appears only where money is being summed.

It never supplies decoration. No textures, no illustration, no second accent,
no glass, no gradient.

### Why Plex and not Boose's Nunito

Boose sets everything in Nunito. Nunito has no tabular figures, and this app is
mostly numbers in columns — a column of rupiah that shimmers is a till that
cannot be trusted at a glance. **The typeface stays IBM Plex Sans**; everything
else in this document follows Boose. This is the one deliberate departure, and
it is why `DESIGN.md` is not a copy of Boose's style guide.

## Orientation and frame

The app runs in **both orientations**; nothing is locked. Material's window
sizes decide the frame:

| Width | Frame |
|---|---|
| under 600 dp (portrait phone) | one column, bottom navigation bar |
| 600 dp and above (landscape phone) | two panes where they help, navigation rail |

A till is landscape by nature — the counter is wider than it is tall — so
**Kasir is the screen the landscape frame was designed for**:

```
┌─────────────────────────────────────────────────────┐
│ KasirKu   [ cari barang ]      Jualan · Tunai       │
├──────┬───────────────────────────┬──────────────────┤
│ rail │  tile   tile              │ Nota  4 barang   │
│      │  tile   tile              │ ── line ──       │
│      │  tile   tile              │ ── line ──       │
│      │                           │ ── line ──       │
│      │                           │ ██ TOTAL 65.000 █│
│      │                           │ [Batalkan][Bayar]│
└──────┴───────────────────────────┴──────────────────┘
```

Portrait is the same state in one column: the grid, then the nota folded along
the bottom, opening into its lines. Both are one component tree; only the frame
changes.

## Palette

Eight values, expressed as Material colour roles so a future dark theme resolves
through the same names.

| Token | Hex | Role | Job |
|---|---|---|---|
| `counter` | `#F1F5F9` | surface | the ground every screen sits on |
| `sheet` | `#FFFFFF` | surface-container-lowest | panels, lists, tiles, the nota |
| `ink` | `#0B1220` | on-surface | headings, item names, prices, figures |
| `action` | `#007AFF` | primary | every primary action, the total block, active tab, selection |
| `actionContainer` | `#E6F0FF` | primary-container | active-tab pill, quiet selected rows, icon tint |
| `muted` | `#64748B` | on-surface-variant | kode, units, labels, timestamps |
| `rule` | `#E2E8F0` | outline | card borders where a shadow is not enough |
| `owed` | `#FF5555` | error | **only** money someone still owes, negative stock, destructive confirm, and expenses |

**Blue is the only action colour.** A filled button is blue on white; the active
tab is a blue pill. There is no second accent, no brand gradient, no highlight
hue beyond it.

**Red is a promise, not an accent.** It appears in exactly three places: a
hutang or utang balance, a negative stock count, and a destructive confirmation
or an outgoing expense. Never for badges, decoration, informational alerts, or
"important" numbers.

**Teal is money arriving.** `#00C9B1` marks a positive figure the shop should
feel good about — kembalian, uang masuk, a lunas row. It is never an action
colour and never decoration.

### State colours beyond the palette

Material's semantic roles still apply where they carry real meaning, as tints of
this palette rather than new hues:

- **Low stock** — `muted` text with the words `Rendah`. Not amber, not a badge.
  It is a reading, not an alarm.
- **Negative stock** — `owed`, at the top of the list. The one place red
  escalates from a number to a position on the screen.
- **Synced / unsynced** — `muted` text, never a coloured dot.
  "Terakhir sinkron 14:20 · 3 belum terkirim".

## Typography

One face: **IBM Plex Sans** (400 / 500 / 600), bundled through
`@expo-google-fonts/ibm-plex-sans` and loaded before anything renders. The shop
has no reliable internet, so nothing is fetched at runtime.

Plex was chosen for its figures: it carries real tabular numerals, and a till is
mostly numbers in columns. There is no display face and no script face.

**Numerals are always tabular** (`fontVariant: ['tabular-nums']`) in any column
of money or quantity.

### Type scale

Material 3 roles, mapped. Sizes in `sp` so they follow the system font scale.
Sizes follow Boose's generous scale rather than Material's defaults.

| Role | Weight | Size / line | Used for |
|---|---|---|---|
| `displayLarge` | 600 | 34 / 38 | The total inside its block, and only that |
| `headlineSmall` | 600 | 28 / 34 | Screen titles (`Kasir`, `Stok`, `Bayar`) |
| `headlineMedium` | 600 | 22 / 28 | A stat's figure, a large card number |
| `headlineLarge` | 600 | 26 / 32 | A figure that leads a screen |
| `titleMedium` | 600 | 15 / 20 | Section headers, sheet titles |
| `bodyLarge` | 400 | 15 / 22 | Item names, tile names — the default reading size |
| `bodyMedium` | 400 | 13 / 18 | Form fields, notes, secondary copy |
| `labelLarge` | 600 | 14 / 18 | Button labels |
| `labelSmall` | 600 | 11 / 16, tracking 0.11em, uppercase | Column headers, `Total`, kode tags, unit marks |
| `numericLarge` | 600 | 17 / 22 tabular | A tile's price, a nota line's amount |
| `numericMedium` | 500 | 13 / 18 tabular | Quantity marks, dense columns |

`displayLarge` appears exactly once per screen, inside the total block, and
nothing else in the app is ever that size. Its scarcity is what makes it read
from across the counter.

## Signature move

**The window.** A blue block (`action`), `shape.md` corners, the word `Total` in
`labelSmall` at its left (white at 70%), the amount in `displayLarge` at its
right, tabular, right-aligned.

It appears on Kasir, on the receipt, and at the close of Tutup Toko. It is how
the owner recognises that a number is *the* number.

## Spacing and density

A 4 dp base. List rows sit inside **cards** with `shape.md` corners and a soft
shadow; a row is 48 dp tall within its card. Kasir's tiles are **124 dp** with a
66 dp image well, because a tile is a target, not a line of text.

| Token | dp | Use |
|---|---|---|
| `xs` | 4 | Within a label line |
| `sm` | 8 | Label to value, between cards |
| `md` | 12 | Inside a row or tile |
| `lg` | 16 | Row inset, panel padding |
| `xl` | 20 | Screen edge gutter, card padding |
| `xxl` | 28 | Between the title and the first section |

Screen gutter is **20 dp** on both sides. Cards never run edge to edge; they
keep the gutter, which is what makes the ground visible as a frame.

The nota panel is a fixed **320 dp**; the grid takes whatever width remains.
A fixed panel keeps a column of numbers the same width on every phone, which is
what makes a column scannable.

## Shape and elevation

**Shape: 16 dp** on cards and tiles, **12 dp** on buttons and inputs, **10 dp**
on chips and small pills, 20 dp on the receipt sheet. Nothing is fully square
and nothing is a pill except the navigation indicator and the filter chips.

Surfaces are **tonal plus shadow**: white cards on `#F1F5F9`, separated by
`elevation.raised` (`rgba(15, 23, 42, 0.08)`, blur 16, offset y 4). A 1 dp
`rule` is used only where a shadow cannot do the job — inside a card, between
rows. **No hard offset shadows, no glass, no borders above 1 dp, no left-edge
accent bars.**

## Motion

Quiet and quick. **State changes are steps, not eases.** A tile joining the nota
appears in one 90 ms frame-step; a screen transition is Material's standard
fade-through at 200 ms; a bottom sheet is a standard slide.

No springs, no bounce, no celebratory animation, no stagger on list items.
`prefers-reduced-motion` / Android "Remove animations" collapses every
transition to an instant cut.

The one authored moment: **saving a sale.** The total block settles 2 dp and the
button disables — the till's window settling on an answer. 180 ms, once, never
repeated.

## Icons

**Vuesax**, from the kit in `Icon.figcraft` (`C:\Users\vidy\Downloads\Design
Kit\Icon.figcraft`), in the **linear** style: 24 dp box, 1.5–2 dp stroke, round
joins and caps, no fills. One weight across the whole app.

Icons are drawn at 24 dp and tinted by role: `action` on an active tab and in
the cart, `muted` elsewhere, `sheet` when sitting inside a filled blue control.

Every icon the app needs and where it comes from:

| Icon | Use | Kit name |
|---|---|---|
| `shopping-cart` | Kasir tab, the cart bar | `shopping-cart` |
| `box-2` | Stok tab | `box-2` |
| `people` | Orang tab | `people` |
| `more-square` | Lainnya tab | `more-square` |
| `search-normal` | The search field | `search-normal` |
| `add` | A tile's add button, a quantity step up | `add` |
| `minus` | A quantity step down | `minus` |
| `close` | Dismiss a sheet | `close` |
| `trash` | Remove a nota line | `trash` |
| `notification` | The header's alert | `notification` |

Never an emoji, never a Unicode glyph standing in for an icon, never a second
icon family.

## Navigation

Material 3, width-driven. Four destinations, matched to the shop's mental model
rather than the technical screens:

| Destination | Contains |
|---|---|
| **Kasir** | Sell screen |
| **Stok** | Stock, low stock, repack, barang + kategori management |
| **Orang** | Supplier and Pelanggan |
| **Lainnya** | Riwayat, Laporan, Kas, Tutup Toko, Pengaturan |

Portrait: a `NavigationBar` along the bottom, white, with the active
destination in a blue `actionContainer` pill holding an `action` icon. Landscape
(600 dp and up): a 72 dp `NavigationRail` down the left edge, icon and word.
Same four destinations, same active treatment.

System Back always works and is predictive. Nothing is trapped behind a bar the
Back gesture cannot escape.

## Two panes

Kasir is two-pane at 600 dp and above. The rule for future screens: **a second
pane is for a thing you must see while doing something else** — the nota beside
the grid, a product's detail beside its stock history. Never for two unrelated
lists.

In a panel, a cart line is a **reading**, not a form: name, quantity, amount.
Editing happens in a sheet opened by tapping the line. A pane is narrow on
purpose, and steppers that fit in portrait do not fit there.

## Dark theme

**Not shipped in v1.** The shop is brightly lit and the app is used standing
under a shop light; the light scheme is chosen from that scene, not from a
default. If a dark scheme is ever added, it is designed as its own thing — a
slate-black ground (`#0F172A`) with cards a step lighter and the same blue — not
this palette flipped.

## Accessibility floor

- Every touch target ≥ 48×48 dp, ≥ 8 dp apart. A 320 dp panel is no excuse: a
  control too small to hit is moved to a sheet, not shrunk.
- Body and placeholder text ≥ 4.5:1 against their surface; large text ≥ 3:1.
  `muted` on `sheet` measures 4.8:1, on `counter` 4.6:1.
- **Blue on white is 4.0:1** — large text and icons only, never body copy at
  `labelLarge` size and below. A blue button's label is white on blue, 4.0:1,
  which is why button labels are `labelLarge` 600 and never smaller.
- All sizes in `sp`; every screen tested at Android font scale 1.3.
- Nothing is conveyed by colour alone: `Rendah` is a word, `−2` is a sign,
  `Hutang` is a label.

## Anti-patterns for this world

- A second typeface, or any hand-written or decorative face in the app.
- Nunito, or any face without tabular figures, in a column of money.
- Red anywhere that is not owed money, an expense, or a destructive confirm.
- Teal used as an action colour.
- Cards inside cards; a shadow on a row inside a card.
- A coloured `border-left` on any row.
- Emoji or Unicode glyphs standing in for icons; two icon weights in one screen.
- Numbers that are not tabular in a column.
- Steppers or controls shrunk below 48 dp to make them fit a panel.
- Light/dark picked by category habit rather than the use scene.
