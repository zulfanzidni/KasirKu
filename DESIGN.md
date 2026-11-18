# Design

<!-- impeccable:design-schema 1 -->

The visual world for KasirKu: **Jendela kasir** — the window of the till's own
display. Chosen 2026-11-18, replacing the *Nota* paper world; the decision and
its reasons are in `docs/adr/0004-landscape-till-and-jendela-kasir.md`. Read
with PRODUCT.md; where they conflict on visual matters, this file wins.

## The world

A warung's till is not a notebook. It is a machine on the counter with one job:
take what is being bought, and say what it costs. It does that in two places at
once — the goods on one side, the running total on the other — and the answer to
"how much" arrives in a small dark window that reads back at the person
standing there.

KasirKu is that instrument. The world contributes four things and no more:

1. **One voice** — IBM Plex Sans, with real tabular figures, at every size.
   Nothing in the app is written by hand, including the printed receipt.
2. **Two grounds and one ink** — the counter (a cool light grey), the sheet
   laid on it (white), and near-black for everything read or pressed.
3. **Figures as the subject** — prices, quantities and totals carry the weight;
   labels stay small and quiet. A column of rupiah never shimmers.
4. **One signature move** — the total, set inside a dark block with the word
   `Total` at its left. That block is the loudest thing on any screen, and it
   appears only where money is being summed.

It never supplies decoration. No textures, no illustration, no second accent,
no glass, no gradient.

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

Seven values, expressed as Material colour roles so a future dark theme resolves
through the same names.

| Token | Hex | Role | Job |
|---|---|---|---|
| `counter` | `#F1F1EE` | surface | the ground every screen sits on |
| `sheet` | `#FFFFFF` | surface-container-lowest | panels, lists, tiles, the nota |
| `ink` | `#101418` | primary | headings, primary actions, the total block, focus |
| `wash` | `#E6E6E0` | primary-container | selection, pressed rows, Android ripple |
| `body` | `#101418` | on-surface | item names, prices, figures |
| `muted` | `#64645D` | on-surface-variant | kode, units, labels, timestamps |
| `rule` | `#E2E2DC` | outline | hairlines between rows, tile borders |
| `owed` | `#A8231F` | error | **only** money someone still owes, negative stock, destructive confirm |

**Red is a promise, not an accent.** It appears in exactly three places: a
hutang balance, a negative stock count, and a destructive confirmation. Never
for badges, decoration, informational alerts, or "important" numbers.

**Ink is the only action colour.** A filled button is ink on white. There is no
second accent, no brand gradient, no highlight hue. Selection is a wash, not a
colour.

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

| Role | Weight | Size / line | Used for |
|---|---|---|---|
| `displayLarge` | 600 | 34 / 38 | The total inside its block, and only that |
| `headlineSmall` | 600 | 19 / 24 | The shop name, screen titles |
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

**The window.** A near-black block, `shape.md` corners, the word `Total` in
`labelSmall` at its left (white at 62%), the amount in `displayLarge` at its
right, tabular, right-aligned.

It appears on Kasir, on the receipt, and at the close of Tutup Toko. It is how
the owner recognises that a number is *the* number.

## Spacing and density

A 4 dp base. List rows are **48 dp** tall with a 1 dp `rule` hairline beneath —
a thumb's height. Kasir's tiles are **78 dp** with a 1 dp border, because a tile
is a target, not a line of text.

| Token | dp | Use |
|---|---|---|
| `xs` | 4 | Within a label line |
| `sm` | 8 | Label to value, between tiles |
| `md` | 12 | Inside a row or tile |
| `lg` | 16 | Row inset, panel padding |
| `xl` | 20 | Screen edge gutter |
| `xxl` | 28 | Between the title and the first section |

Screen gutter is **20 dp** on both sides. Hairlines may run edge to edge past
the gutter so a list reads as one sheet.

The nota panel is a fixed **320 dp**; the grid takes whatever width remains.
A fixed panel keeps a column of numbers the same width on every phone, which is
what makes a column scannable.

## Shape and elevation

**Shape: 6 dp** on tiles, inputs, buttons and the total block. 8 dp on sheets.
Nothing is a pill except the navigation indicator, and nothing is fully square.

Surfaces are tonal: white panels on a light grey counter, separated by a 1 dp
`rule`, with a single soft shadow reserved for bottom sheets. **No hard offset
shadows, no glass, no borders above 1 dp, no left-edge accent bars.**

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

## Navigation

Material 3, width-driven. Four destinations, matched to the shop's mental model
rather than the technical screens:

| Destination | Contains |
|---|---|
| **Kasir** | Sell screen |
| **Stok** | Stock, low stock, repack, barang + kategori management |
| **Orang** | Supplier and Pelanggan |
| **Lainnya** | Riwayat, Laporan, Kas, Tutup Toko, Pengaturan |

Portrait: a `NavigationBar` along the bottom. Landscape (600 dp and up): a
72 dp `NavigationRail` down the left edge, icon and word. Same four
destinations, same active treatment — an ink pill with a white icon.

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
default. If a dark scheme is ever added, it is designed as its own thing — an
ink-black ground with warm off-white type — not this palette flipped.

## Accessibility floor

- Every touch target ≥ 48×48 dp, ≥ 8 dp apart. A 320 dp panel is no excuse: a
  control too small to hit is moved to a sheet, not shrunk.
- Body and placeholder text ≥ 4.5:1 against their surface; large text ≥ 3:1.
  Muted on a sheet measures 5.7:1, on the counter 5.0:1.
- All sizes in `sp`; every screen tested at Android font scale 1.3.
- Nothing is conveyed by colour alone: `Rendah` is a word, `−2` is a sign,
  `Hutang` is a label.
- Focus rings are `ink` at 2 dp with a 2 dp offset, never removed.

## Anti-patterns for this world

- A second typeface, or any hand-written or decorative face in the app.
- Red anywhere that is not owed money.
- Cards inside cards; a shadow on a list row.
- A coloured `border-left` on any row.
- Emoji or Unicode glyphs standing in for icons. Icons come from
  `@expo/vector-icons` MaterialIcons, one weight.
- Numbers that are not tabular in a column.
- Steppers or controls shrunk below 48 dp to make them fit a panel.
- Light/dark picked by category habit rather than the use scene.
