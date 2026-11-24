# ADR 0005: The world is Boose, and the typeface is not

## Status
Accepted 2026-11-24. Supersedes the visual direction of ADR 0004 (*Jendela
kasir*). Keeps ADR 0004's orientation and two-pane decisions unchanged.

## Context
ADR 0004 gave the app *Jendela kasir*: a cool paper-grey ground, white sheets,
near-black ink, hairlines instead of elevation, and a dark total block. It fixed
the structural problem — the cart and the grid no longer competed for one
column — but the owner found the result austere. Used daily, an instrument that
never lifts anything off its surface reads as flat rather than calm.

The owner had a second design in the same FigCraft file: **Boose** (the Sado
Brew admin), a modern point-of-sale admin with white cards on `#F1F5F9`, a
single blue action colour, and generous 16 dp rounding. It is the language they
wanted the shop's own app to speak.

Boose is a desktop admin, 240 dp rail and two wide panes. KasirKu is a 390 dp
phone. So the work was not a reskin: it was extracting what makes Boose feel
like Boose and re-applying it to a phone's structure.

## Decision
1. **The surface language is Boose.** White cards at 16 dp on a `#F1F5F9`
   ground, separated by `elevation.raised` (`rgba(15,23,42,0.08)`, blur 16,
   y-offset 4) rather than by rules. Rules survive only where a shadow cannot
   do the job: inside a card, between rows.
2. **Blue `#007AFF` is the only action colour** — buttons, the total block, the
   active tab, the cart. `#E6F0FF` is its wash. There is no second accent.
3. **Red `#FF5555` widens to every alert**, per Boose: money owed, negative
   stock, expenses leaving the drawer, and destructive confirms. It is still
   never decoration.
4. **Teal `#00C9B1` is money arriving** — kembalian, uang masuk, a lunas row.
   Never an action colour.
5. **The typeface stays IBM Plex Sans.** This is the one place Boose is not
   followed. Nunito has no tabular figures, and this app is columns of rupiah;
   figures that shift width as they change cannot be read at a glance across a
   counter. Boose's *scale* is kept (28 dp screen titles, 34 dp display), its
   face is not.
6. **Icons are Vuesax linear**, 24 dp, 1.5–2 dp stroke, round joins, one weight,
   from `Icon.figcraft`. Never emoji, never a second family.

## Considered Options
- **Nunito for everything, as Boose does**: rejected. It is the more faithful
  choice and the wrong one; tabular figures are a functional requirement of a
  till, not a stylistic preference.
- **Nunito for prose, Plex for figures**: rejected. Two faces in a 15 dp UI
  produces visible mismatches in x-height on every mixed line ("Jualan
  428.500").
- **Keeping Jendela kasir and borrowing only Boose's palette**: rejected. The
  flatness the owner objected to is the missing elevation, not the hue; a new
  palette on hairline surfaces would have changed nothing they noticed.
- **Boose purple** (as its screenshots show) instead of its documented
  `#007AFF`: rejected. The style guide page is the authority, and blue is the
  safer contrast partner for red and teal.

## Consequences
- `DESIGN.md` and `src/design/tokens.ts` are rewritten. Every screen reads
  roles, so all fifteen moved at once; no screen needed layout work to adopt the
  new world, though `headlineSmall` grew from 19 to 28 dp and card padding grew,
  which some screens will want to re-cut.
- `shape.md` moved from 6 to 12 dp and `shape.lg` from 8 to 16 dp. Anything that
  hard-coded a radius was already a defect; nothing did.
- `elevation.raised` now points *down* rather than up. The old value was tuned
  for a nota pinned to the bottom edge; a card in a stack wants its shadow
  below it.
- Blue on white measures 4.0:1, which is below AA for body copy. Blue is
  therefore restricted to large text, icons, and filled controls whose label is
  white on blue. This is recorded in `DESIGN.md` §Accessibility floor, and it is
  the constraint to re-check whenever a new blue-on-white pairing is proposed.
- The FigCraft file `UI.figcraft` holds the wireframes, the hi-fi screens and
  the Boose reference pages. It is committed as a design artefact, not built
  into the app.
