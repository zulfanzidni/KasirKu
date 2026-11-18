# ADR 0004: The till is landscape-first, and its world is Jendela kasir

## Status
Accepted 2026-11-18. Supersedes the visual direction recorded in the first
`DESIGN.md` (the *Nota* paper world, 2026-10-31).

## Context
The app was designed portrait-only: `app.json` pinned `"orientation":
"portrait"`, and Kasir stacked a header, a search field, a "Hari ini" block, a
list of items, and a collapsible nota along one vertical axis.

The owner used it on a real phone with three weeks of data and reported that it
"doesn't feel like a real app". The cause was structural, not cosmetic. A till
is a comparison — what you are buying, and what it costs — and a phone in
portrait can show only one of those at a time. The running total lived in a
sheet that had to be opened, the cart took its height from the grid, and the
header and the day's summary took the top third of the screen before the first
item appeared. The paper metaphor (*Nota*: cream ground, ballpoint hand, ruled
lines) added a second problem: it made the app read as a notebook rather than
an instrument.

The owner chose landscape support, then chose to drop the paper world entirely:
neither the ground nor the handwriting survived review on the phone.

## Decision
1. **The app supports both orientations**, with `"orientation": "default"`.
   Navigation is width-driven, per Material: a bottom bar below 600 dp of
   width, a rail at 600 dp and above. Same four destinations, same words.
2. **Kasir is two-pane wherever there is width for it**: the grid on the left,
   the nota as a **fixed 320 dp panel** on the right, always open. Portrait
   keeps the single column and the collapsible nota, because a tall screen has
   room to fold and a wide one has room to stand side by side.
3. **The visual world is *Jendela kasir*** — the till's own display window. A
   cool light ground, white panels, near-black ink, one typeface (IBM Plex
   Sans, tabular figures), and the total set as a **dark block** at the foot of
   the nota. No second decorative face, no handwriting anywhere in the app,
   including the printed receipt.
4. **Red stays reserved** for money still owed, negative stock, and a
   destructive confirmation. That rule survives the change of world.

## Considered Options
- **Portrait only, restyled**: rejected. It leaves the central problem — the
  cart and the grid competing for one column — untouched.
- **Landscape only**: rejected by the owner, who wants the phone usable in
  hand.
- **A Kasir-scoped theme** (new world on Kasir, paper everywhere else):
  rejected. Two worlds in one app means every future screen has to pick one,
  and the two drift. The tokens are global; every screen took the new world at
  once.
- **Keeping the ballpoint on the printed receipt**, since the receipt is the
  shop's paper rather than an instrument: rejected by the owner. Dropping it
  also removed a font and its loading gate.

## Consequences
- Every screen reads colour and type roles from `src/design/tokens.ts`, so the
  world changed in one file plus three components; the fourteen screens outside
  Kasir inherited it with no layout work.
- Their layouts are still portrait stacks. In landscape they work but look
  under-filled; each gets its own re-cut later. That is scheduled work, not a
  defect.
- Kasir in landscape loses the inline quantity steppers (there is no width for
  them beside a 320 dp panel). A nota line is a reading; tapping one opens an
  editor sheet with the stepper, its own rupiah, and Hapus. In portrait the
  steppers remain inline, because the screen is tall.
- The "Hari ini" explainer sentence is gone from Kasir. It was doing the work
  of two numbers that are now side by side in the header on a wide screen and
  one line apart in portrait.
- Tests render at 411×891 by default (`jest.setup.ts`), so an ordinary screen
  test exercises the portrait cut; a landscape test sets the window itself.
