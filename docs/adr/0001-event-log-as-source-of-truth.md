# ADR 0001: Business data is an append-only event log

## Status
Accepted.

## Context
Two Android phones must sell independently with no internet and reconcile later.
The shop owner explicitly chose **loose sync** over strict consistency, because
losing a sale when the network is down is worse than being briefly out of sync.

Any design where each phone stores "stock is 12" invites conflict: both phones
sell, both write 11, and one sale vanishes. The owner also needs to correct
stock by hand when the shelf and the app disagree.

## Decision
All business activity - sales, voids, stock received, repacks, stock
corrections, cash movements, debt payments, write-offs - is recorded as
**immutable events that are appended and never edited or deleted**. Every figure
the owner sees (stock on hand, customer debt, supplier payable, cash expected,
sales totals) is **derived** by replaying and summing those events.

Corrections are themselves events: a stock correction stores a **delta**, not an
absolute quantity, and a mistaken sale is cancelled by a `sale.voided` event
rather than removed.

## Considered Options
- **Server-authoritative state** (phone asks a server before each sale): rejected
  because it refuses to sell offline, which the owner ruled out.
- **Mutable rows with last-write-wins per field**: rejected for money and stock
  because it silently loses one of two offline sales. Retained only for master
  data (names, prices), where a lost concurrent edit is recoverable by hand.

## Consequences
- Merging two phones is a **union of event lists**, which cannot conflict.
- A database can be rebuilt from events and produce identical numbers, so a
  derived-value cache is always disposable.
- Everything is more verbose: "stock" is never a column, it is a query. Reporting
  and low-stock logic must compute rather than read.
- Deleting anything for real is impossible by construction; "erase" is archive,
  and true deletion is only offered for records never used.
- Corrections are auditable, which is a side benefit the owner did not ask for
  but will rely on when a count is questioned.
