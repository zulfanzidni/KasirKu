# Design

<!-- impeccable:design-schema 1 -->

The visual world for KasirKu: **Nota** — the shop's own handwritten notebook, made
legible. Chosen from a direction round on 2026-10-31 (seed reference:
`seed:0f68c7fe369b0a5a`). Read with PRODUCT.md; where they conflict on visual
matters, this file wins.

## The world

A warung keeps its sales in a **buku nota**: cheap ruled paper, a blue ballpoint,
red ballpoint only for what someone still owes. That book is where this shop's
numbers already live, and the owner already knows how to read it. KasirKu is that
book, made trustworthy: same paper, same ink, same red, but with totals that
always add up and stock that maintains itself.

The world is a **tool, not a theme**. It contributes four things and no more:

1. **Type** — a pen voice for totals and headings, a plain voice for everything
   you must read quickly.
2. **Palette** — paper ground, ink blue, clerk's red. Nothing else earns a hue.
3. **Density** — ruled, evenly-spaced rows. Information is stacked, not tiled.
4. **One signature move** — the total, set in pen at a size you can read from
   across the counter, sitting directly above a double rule.

It never supplies the navigation, the controls, or the information architecture.
Those are Material 3 and Android's own, as PRODUCT.md's platform requires.

## Palette

Six tokens. Every value is a Material color role, so dark theme and dynamic
color resolve through the same names.

| Token | Hex | Role | Job |
|---|---|---|---|
| `paper` | `#F7F3EA` | surface | ground for every screen |
| `sheet` | `#FDFBF6` | surface-container-lowest | the card / cart / modal surface that sits on paper |
| `ink` | `#1F3A6E` | primary | headings, the total, primary actions, focus |
| `inkWash` | `#E7EAE3` | primary-container | selected rows, quiet emphasis |
| `owed` | `#A8231F` | error | **only** money someone still owes, negative stock, destructive confirm |
| `graphite` | `#2F2A24` | on-surface | body text, item names, prices |
| `graphiteMuted` | `#8A7F6D` | on-surface-variant | kode, secondary labels, timestamps |
| `rule` | `#DED5C4` | outline-variant | hairlines between ruled rows |

**Red is a promise, not an accent.** `owed` appears in exactly three places: a
hutang balance, a negative stock count, and a destructive confirmation. It is
never used for badges, decoration, alerts that are merely informational, or
"important" numbers. If red shows up somewhere else, either the colour is wrong
or the thing is genuinely owed and should be labelled as such.

**Ink blue is the only action colour.** Filled buttons are ink on sheet. There is
no second accent, no brand gradient, no highlight hue.

### State colours beyond the palette

Material's semantic roles still apply where they carry real meaning, as tints of
this palette rather than new hues:

- **Low stock** — `graphite` with a `rule` underline and the words `Rendah`. Not
  amber, not a badge. It is a reading, not an alarm.
- **Negative stock** — `owed`, at the top of the list. This is the one place red
  escalates from a number to a position on the screen.
- **Synced / unsynced** — `graphiteMuted` text, never a coloured dot. "Terakhir
  sinkron 14:20 · 3 belum terkirim".

## Typography

Two voices, both from Google Fonts, both proving offline via `expo-font` at
bundle time (no runtime fetch — the shop has no reliable internet).

| Voice | Face | Where | Why |
|---|---|---|---|
| **Pen** | Kalam (400 / 700) | The app name, section headings, the cart total, the receipt shop name | A ballpoint's hand. Used *only* where the shop's own handwriting would appear. Never for body text, labels, prices, or anything read under pressure. |
| **Print** | IBM Plex Sans (400 / 500 / 600) | Everything else: item names, prices, kode, labels, buttons, errors | Legible digits, real tabular support, reads at a glance. |

**Numerals are always tabular** (`fontVariant: ['tabular-nums']`) in any column
of money or quantity. A column of prices that shimmers as it changes is a column
the owner stops reading.

### Type scale

Material 3 roles, mapped. Sizes in `sp` so they follow the system font scale.

| Role | Face | Size / line | Used for |
|---|---|---|---|
| `displayLarge` | Kalam 700 | 44 / 44 | The cart total, and only that |
| `headlineSmall` | Kalam 700 | 24 / 30 | Screen titles, the shop name on a receipt |
| `titleMedium` | Plex 600 | 16 / 22 | Section headers (`Sembako`), cart header |
| `bodyLarge` | Plex 400 | 16 / 24 | Item names, line items — the default reading size |
| `bodyMedium` | Plex 400 | 14 / 20 | Form fields, notes, secondary copy |
| `labelLarge` | Plex 600 | 14 / 20 | Button labels |
| `labelSmall` | Plex 600 | 11 / 16, tracking 0.12em, uppercase | Column headers, the `Total` word, kode tags, `×2` quantity marks |
| `numericLarge` | Plex 600 | 20 / 24 tabular | A row's price in a tight list |
| `numericHero` | Kalam 700 | 44 / 44 tabular | Reserved; same slot as displayLarge |

**The signature move is a size.** `displayLarge` appears exactly once per screen,
on the cart total, and nothing else in the app is ever that large. Its scarcity
is what makes it read from across the counter.

## Spacing and density

A 4 dp base. Ruled rows are **46 dp tall** with a 1 dp `rule` hairline beneath —
tall enough for a thumb, tight enough that eight items fit above the cart.

| Token | dp | Use |
|---|---|---|
| `xs` | 4 | Within a label line |
| `sm` | 8 | Label to value |
| `md` | 12 | Inside a row |
| `lg` | 16 | Row inset, cart padding |
| `xl` | 20 | Screen edge gutter |
| `xxl` | 28 | Between the title and the first section |

Screen gutter is **20 dp** on both sides. Ruled hairlines run edge to edge past
the gutter, so the ruling reads as paper, not as card borders.

## Shape and elevation

Paper is nearly flat. **Shape: 4 dp** on inputs, sheets and buttons — a notebook
corner, not a pill. **Cards do not exist** as a visual device; a surface is a
`sheet` panel that bleeds to the screen edge.

Elevation uses Material's tonal surface levels plus a single soft shadow for the
floating cart and bottom sheets. **No hard offset shadows, no glass, no borders
above 1 dp, no left-edge accent bars.**

## Signature move

**The double rule and the pen total.** Above the cart total sits a 3 dp double
hairline in `ink` — the accountant's line under a written sum. Beneath it, the
word `Total` in `labelSmall` caps, and to its right the amount in Kalam 700 at
`displayLarge`, tabular, right-aligned to the screen gutter.

That single construction appears on Kasir, on the receipt, and at the close of
Tutup Toko. It is how the owner recognizes that a number is *the* number.

## Motion

Quiet and quick. The direction round carried forward one discipline from the
acetate-manual world: **state changes are steps, not eases.** A row being added
to the cart appears in one 90 ms frame-step; a screen transition is Material's
standard fade-through at 200 ms; a bottom sheet is a standard slide.

No springs, no bounce, no celebratory animation, no stagger on list items.
`prefers-reduced-motion` / Android "Remove animations" collapses every transition
to an instant cut.

The one authored moment: **saving a sale.** The cart panel settles 2 dp upward
and the total fades from `ink` to `graphite` as the button disables — the page of
the notebook turning. 180 ms, once, never repeated.

## Navigation

Material 3 `NavigationBar`, four destinations, matched to the shop's mental
model rather than the technical screens:

| Destination | Contains |
|---|---|
| **Kasir** | Sell screen |
| **Stok** | Stock, low stock, repack, barang + kategori management |
| **Orang** | Supplier and Pelanggan |
| **Lainnya** | Riwayat, Laporan, Kas, Tutup Toko, Pengaturan |

System Back always works and is predictive. Nothing is trapped behind a bar the
Back gesture cannot escape.

## Dark theme

**Not shipped in v1, and not an inversion of this one.** The shop is brightly lit
and the app is used standing under a shop light; the light paper scheme is chosen
from that scene, not from a default. PRODUCT.md records `paper` as the committed
ground. If a dark scheme is ever added, it is designed as its own thing — an
ink-black ground with warm off-white type — not this palette flipped.

## Accessibility floor

- Every touch target ≥ 48×48 dp, ≥ 8 dp apart.
- Body and placeholder text ≥ 4.5:1 against their surface; large text ≥ 3:1.
  Muted graphite on paper measures 4.6:1 — it is for labels, never for prices.
- All sizes in `sp`; every screen tested at Android font scale 1.3.
- Nothing is conveyed by colour alone: `Rendah` is a word, `−2` is a sign,
  `Hutang` is a label.
- Focus rings are `ink` at 2 dp with a 2 dp offset, never removed.

## Anti-patterns for this world

Carried from the craft floor, plus what this world in particular would slip into:

- Ruled lines as texture. Every rule must sit at a real row boundary.
- Kalam for anything the user reads under pressure. It is a heading and total
  voice only.
- Red anywhere that is not owed money.
- Cards inside cards.
- A colored `border-left` on any row — the ruling is horizontal or it is nothing.
- Emoji or Unicode glyphs standing in for icons. Icons come from
  `@expo/vector-icons` MaterialIcons, one weight.
- Light/dark picked by category habit rather than the use scene.
