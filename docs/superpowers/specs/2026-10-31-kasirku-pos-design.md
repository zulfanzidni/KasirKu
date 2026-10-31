# KasirKu — POS & Stock Management for a Small Warung

Design document. 2026-10-31.

---

## 1. Intent and the why

A store owner runs a small shop (warung/toko). Today, sales and stock live in
their head and on scraps of paper. They want a phone app that:

- rings up a sale in seconds, without a barcode scanner,
- knows what stock is left, what sold, and what is running out,
- tracks money owed to suppliers and money owed by customers,
- optionally reconciles the physical cash drawer,
- keeps working when the internet is down.

The app is for the owner and one other trusted person (a parent). They never
use it at the same time. It is a working tool for a store, not a business
platform, and it is used standing up, one-handed, mid-conversation with a
customer.

The measure of success is: the owner stops keeping stock in their head, and
trusts the app's numbers enough to reorder from them.

### The store in its own words

From the owner, describing a normal sale:

> "When a customer comes to the counter, I don't scan the items, I just add
> it. Every tap is adding 1 item."

> "I want to be able to search items too while adding customer items."

So: the item list is the primary interface. A tap adds one unit. Search is a
second way to reach the same action, needed once the catalog outgrows a screen.

---

## 2. Users and access

- **Two users**: the owner and the owner's parent.
- **Identical permissions.** No manager/cashier split, no approval flows, no
  roles, no audit of *who* did what.
- **Never simultaneous.** This is an explicit and load-bearing statement: it
  means the sync problem is *merging two sequential piles of work*, not
  concurrent editing.
- **No login.** One shared account. The app opens straight into selling.

### Devices

Both users are on **Android**. There is no iPhone in scope.

Each phone is a peer. Neither is the "server." Each must be able to sell with
no internet, all day, and reconcile later.

---

## 3. Goals

1. **Fast sale entry.** Tap-to-add (one tap = one unit for whole-unit items), a
   quantity control for weight-based items, plus search-to-add, on one screen,
   with a running cart and a total.
2. **A receipt for every sale.** A PDF the owner can share (WhatsApp) or save,
   produced after every transaction. Thermal paper printing is a later
   addition, not a launch requirement.
3. **Stock that maintains itself.** Selling decrements stock automatically,
   with no separate step.
4. **Manual stock correction.** The owner can set a real count when the app and
   the shelf disagree, and the app records that a correction happened.
5. **Supplier accounts.** Suppliers can be recorded, goods received from them,
   with three distinct settlement models (below).
6. **Customer accounts and debt (hutang).** A sale can be partly or wholly
   unpaid; the unpaid part attaches to a customer as debt, and can be paid down
   later.
7. **Optional cash drawer reconciliation.** Count the physical cash, compare to
   what the app says should be there, record the difference. Not daily, but
   available.
8. **Analytics / reports.** Sales over time, best-selling products, low stock
   and restock suggestions, filtered by date range, category, and single item,
   with period comparison.
9. **Offline-first with loose sync.** Works with no network. Syncs through a
   shared online store when a network is present.
10. **Indonesian language** throughout the UI.
11. **Full master data management.** Add, edit, and archive items, categories,
   customers, and suppliers, with categories for items, a fixed unit
   (`satuan`) per item, and product with size variants.
12. **In-store repacking.** Buy bulk (a 25 kg sak of flour), repack into
   packets, and sell the packets, with wastage recorded and a declared yield
   recipe.
13. **Know what is low and what to do about it.** Per-variant low stock, with a
   minimum rule or selling speed, and bulk stock shown alongside so the owner
   can tell "repack" from "reorder".
14. **Load the real shop quickly.** Initial stock counts for existing goods, and
   a bulk import so a few hundred items do not have to be typed by hand.
15. **Small-store pricing.** A cart-level discount, and cash rounding so the
   owner never has to hand out small coins.
16. **Close the day.** A daily closing view with sales, expected cash, and a
   count.
17. **Survive a dead phone.** A new phone can take over a lost phone's identity
   so unsynced sales are not stranded.

---

## 4. Non-goals

Explicitly **not** being built:

- **iPhone / iOS.** Android only.
- **Barcode scanning.** The owner does not scan. (A camera scanner could be
  added later; the data model does not need to change for it.)
- **Multi-store / multi-branch.** One store.
- **Roles, permissions, per-user attribution.** One shared account, no login.
- **Real-time or strict consistency.** Sync is deliberate and eventually
  consistent.
- **Online ordering, e-commerce, or a customer-facing app.** This is an
  internal tool.
- **Accounting-grade ledgers, tax reports, or invoicing.** The numbers are for
  the owner's decisions, not an accountant.
- **A web dashboard.** Phone only, for the two phones.
- **Loyalty points, promotions, discounts engine.** Not requested.
- **Bluetooth thermal printing at launch.** Designed for, not built at launch.

---

## 5. Anti-goals

These are outcomes that would make the project a failure even if the app
technically runs:

- **The app refuses to sell because the internet is down.** Losing a sale is
  worse than being briefly out of sync. This is the requirement that rules out
  a server-authoritative design.
- **A sale is ever lost, silently or otherwise.** No dropped cart, no
  "transaction failed, try again," no data that exists only in memory.
- **Stock silently diverges with no way to see or fix it.** Drift is expected;
  hiding it is not.
- **Analytics assert things the data cannot support.** "Best product" computed
  from three days of sales must not be presented as fact.
- **The owner abandons the app mid-sale because it is slower than memory.**
  Speed of entry is not a nice-to-have; it is the adoption condition.

---

## 6. Constraints

- **Platform:** Android phones, Expo (React Native), TypeScript.
- **Language:** Indonesian UI. No English strings exposed to the user.
- **Currency:** Indonesian Rupiah (IDR), **integer amounts only**. No decimals,
  no cents. Store money as integers everywhere.
- **Quantities are not always whole.** Some goods are sold by weight or volume
  (beras, gula, minyak) and **half and quarter amounts matter**. So quantity is
  distinct from money and cannot be assumed to be a whole number. See §10a.
- **Some stock is repacked in-store.** Bulk goods (a 25 kg sak of flour) are
  converted into smaller packets for sale. See §10b.
- **Connectivity:** assumed absent. Present sometimes. Never required.
- **Team:** one developer learning mobile for the first time, coming from web
  development.
- **Budget:** prefers free tiers. Supabase free tier is acceptable.
- **Offline storage:** must survive the OS killing the app. Rules out
  browser-storage approaches (see approaches).

---

## 7. Approaches considered

### Chosen: React Native (Expo) + SQLite + Supabase

- **React Native / Expo**, TypeScript. The developer already writes
  JavaScript; the learning is mobile UI, not a new language.
- **expo-sqlite** on-device database. All reads and writes are local, so
  selling never waits on a network.
- **Supabase** (hosted Postgres) as the shared exchange point and the backup.
  Free tier is sufficient for two devices and a warung's transaction volume.
- **Receipts** as PDF generated on-device (`expo-print`) and shared/saved
  (`expo-sharing`), with no printer required.
- **Trade-offs:** the developer hits native build tooling for the first time;
  Expo's managed workflow cannot drive a Bluetooth thermal printer, so that
  feature will require a custom development build and a native Bluetooth
  library. Both are accepted as later costs, not now.

### Rejected: Flutter + SQLite + Supabase

Smoother UI and the strongest offline story, and it would open the door to iOS
later. Rejected because Dart must be learned from zero *on top of* learning
mobile, which delays the first version that can actually be used in the store.
The trade-off is real and this is a close second.

### Rejected: Native Android (Kotlin + Room + Supabase)

The best fit for Android-only and the shortest path to Bluetooth printing and
a future camera scanner. Rejected because it is the heaviest learning curve of
the three and locks out iOS permanently.

### Rejected: PWA

Attractive because the developer already knows web, and it needs no app store.
Rejected because Android may evict browser storage under memory pressure, and
business records must not be evictable. Also weak on background sync and
sharing files.

### Rejected: phone-to-phone sync with no server

Would avoid a third party entirely. Rejected because there is no backup: if
both phones are lost or broken, the store's entire sales and debt history goes
with them. A shared online store is also what makes later features (a second
phone, reports off-device) possible.

---

## 8. The data model (the load-bearing decision)

The single most important design decision. Everything else follows from it.

**All business activity is recorded as immutable events that are appended,
never edited and never deleted.**

A sale is an event. Receiving stock is an event. Correcting a stock count is an
event. Paying a supplier is an event. The current state of the world — stock on
hand, what a customer owes, today's takings — is **derived** by replaying and
summing events.

**Why:** merging two offline phones becomes addition, not conflict resolution.
Phone A's events and Phone B's events are two disjoint lists; combining them is
a union. Two devices cannot disagree about what stock is left, because neither
stores "stock is 12" — both store the movements, and the sums are equal.

### Event envelope

Every event carries:

| Field | Purpose |
|---|---|
| `id` | UUID, generated on the device. Makes re-sending idempotent. |
| `device_id` | Which phone produced it. |
| `seq` | Monotonic per-device counter. Detects gaps, resumes pulls. |
| `created_at` | **Device local time** of the event. Sync must not overwrite this. |
| `type` | Event type (table below). |
| `payload` | Type-specific JSON. |

Device-local time matters: the two phones will have clocks that disagree
slightly, and an event must keep the moment it happened, not the moment it
arrived.

### Event types

**Sales and money**

- `sale.completed` — line items (item id, **item name and unit snapshotted**,
  qty, unit price, line total), cart total, optional `customer_id`, and a list
  of payments taken at the counter. If payments total less than the cart total,
  the remainder becomes customer debt (see §10). **Prices and names are
  snapshotted on the line** so a later price or name change cannot rewrite the
  history of a sale already made.
- `sale.voided` — reverses a sale that should not exist (wrong item, wrong
  quantity, customer walked away). References the original `sale.completed` by
  id, carries a reason, and reverses stock, any debt created, and the drawer
  effect. It does **not** delete the original event: events are immutable, so a
  void is itself an event and the two cancel out in every derived value. A void
  must be possible because "immutable" was chosen to make sync safe, not to
  make mistakes permanent.
- `receivable.paid` — a customer pays down what they owe.
- `payable.paid` — the owner pays a supplier.
- `cash.counted` — a physical drawer count: the counted amount, the app's
  expected amount at that moment, and the recorded difference.
- `cash.opening_float` — the amount declared to be in the drawer at the start
  of a period, when the owner chooses to declare one (see §8).
- `cash.expense` — money paid out of the drawer that is not a supplier payment
  (electricity, transport, a personal purchase).
- `cash.withdrawn` — money taken out of the drawer, including banking the
  takings.
- `cash.deposited` — money put into the drawer from outside.
- `day.closed` — a closing checkpoint (§10e): the day's figures as computed at
  that moment. It locks nothing and is a record, not a state change.
- `receivable.written_off` — a customer debt the owner gives up on. **Never
  recorded as `receivable.paid`**, because that would count as cash received and
  silently corrupt both the collections figure and the drawer. A write-off
  clears the debt without any money moving.

**Stock**

- `stock.received` — one **delivery note** from a supplier: a supplier
  reference, an optional note, and **one or more lines**. Each line carries the
  **settlement model** (§9) for that line, so a single delivery may mix tunai,
  tempo, and titip goods. A titip line carries the **per-unit consignment
  price** owed when that unit sells; a tempo line carries the per-unit cost.
  Keeping the model per line is required, because a real supplier visit
  frequently combines, say, cash goods and titip goods on one note.
- `stock.adjusted` — a manual correction. Stores a **delta**
  (`counted_qty - system_qty_at_the_moment_of_counting`), not an absolute
  quantity, plus a free-text reason. Delta is required so corrections still
  merge by addition across two phones; an absolute quantity would be a
  conflict.
- `stock.repacked` — converts bulk stock into packed stock. Carries the source
  item and quantity, and the resulting lines (destination item, quantity),
  plus the expected yield and any wastage. See §10b.
- `stock.opening` — the first count of an item when the shop is set up (§10e).
  Recorded as an event, not a silent initial value.
- `stock.consignment_returned` — unsold titip goods handed back to the supplier.

**Master data**

- `item.created`, `item.updated`, `item.archived` — name, **kode**, unit, category, price,
  cost, quantity step, default supplier, minimum-stock rule, product and
  size, whether the item is normally consignment, and whether it is a bulk item
  that gets repacked (with its yield recipe, §10d).
- `customer.created`, `customer.updated`, `customer.archived` — name, phone,
  note.
- `supplier.created`, `supplier.updated`, `supplier.archived` — name, phone,
  note.
- `category.created`, `category.updated`, `category.archived` — name, optional
  parent, so categories form a tree.
- `settings.updated` — store name, address, receipt footer, etc.

Master data is the *only* place last-write-wins is needed, because it is the
only data that is edited in place. Resolution rule: **highest `created_at`
(device local time) wins, with `device_id` as a deterministic tiebreaker.**
Price changes are the realistic case: a stale price from the other phone must
not win because it happened to sync later.

**Resolved per field, not per record** (decided by the builder).
`item.updated` carries only the fields that changed, each with its own
timestamp. Resolving the whole record at once would silently discard one of two
non-overlapping edits — the owner changes a price on one phone while the parent
renames the item on the other, and one change vanishes with no trace. Per-field
resolution costs a slightly larger payload and is worth it, because a silently
lost price change is exactly the kind of quiet wrongness the anti-goals forbid.

### Derived values (never stored as authoritative)

- **Stock on hand (owned)** = received-as-owned − sold − adjustments-down + adjustments-up.
- **Stock held on consignment** tracked **separately** from owned stock, because
  titip goods are not the owner's property and unsold ones go back.
- **Customer debt** = (unpaid portions of their sales) − (their `receivable.paid`)
  − (their `receivable.written_off`). A customer who has overpaid shows a
  **negative** balance, i.e. a credit, rather than having it hidden.
- **Supplier payable** = (tempo purchases) + (titip goods sold) − (their `payable.paid`).
- **Cash in drawer** = `opening_float` + cash sales + `receivable.paid` +
  `cash.deposited` − `payable.paid` − `cash.expense` − `cash.withdrawn`, adjusted
  by void effects.
- **Sales analytics** = queries over `sale.completed`, with `sale.voided`
  cancelling the sales they reverse.

Because these are derived, a rebuilt database produces identical numbers. That
is the point: the events are the record, the numbers are a view.

### Which bucket a sale drew from (owned vs titip)

An item can have **both** owned and consignment quantity at the same time. This
is normal, not an edge case: a supplier tops up a titip item while the owner
still has a few purchased units on the shelf.

**Rule decided by the builder:** a sale draws from **owned stock first**, then
from consignment stock. The order is fixed so that both phones compute the same
answer from the same events, which is what makes the merge safe. The sale line
records the item, quantity, and price; the split between owned and consignment
quantities is **derived**, not stored as a second source of truth.

Consequence: consuming consignment quantity is what creates the supplier
payable (§9). Because the split is derived, a phone that has not yet synced can
compute a different split than the other phone until they merge — which is the
loose-sync consequence accepted in §13, and it resolves the moment they sync.

### Payment methods

Payments are **cash only** in the first version. This is a deliberate
simplification and it has a consequence the owner must know: with cash-only,
**every rupiah that moves through the drawer is a cash event**, so a cash count
can be checked exactly against the recorded movements. "Money in the drawer" is
still not the same as sales, because debt repayments, supplier payments, and
expenses also move cash — the exact formula is below.

If non-cash payment (transfer, QRIS) is added later, the payment payload gains a
method field, expected drawer cash stops being derivable from sales alone, and
`cash.counted` needs to subtract non-cash takings. The payment payload is
shaped to accept a method field later, but only `cash` is used at launch.

### The drawer formula (exact)

"Money in the drawer" is not the same as sales, and the two must never be
conflated. Expected drawer cash at any moment is:

```
expected = opening_float
         + cash taken on sales
         + receivable.paid      (a customer paying a debt, in cash)
         + cash.deposited       (owner puts money in)
         - payable.paid         (paying a supplier, in cash)
         - cash.expense         (anything else paid out of the drawer)
         - cash.withdrawn       (owner takes money out)
         ± void effects
```

Every term is an event, so the figure is derived and always recomputable.

**`cash.expense` and `cash.withdrawn` exist because the drawer is not only
suppliers.** The owner pays for electricity, buys a snack for themselves, lends
a neighbour Rp 20.000, or banks the takings. If the app cannot record money
leaving the drawer, every count would show a permanent unexplained shortfall
and the owner would stop trusting the feature — a direct hit on §5's
anti-goals. Whether the owner uses them is their choice; the app must be able
to represent the money.

**Baseline when no float is declared.** A recorded count becomes the **next
baseline**, so the following count compares against it. An explicit
`cash.opening_float` supersedes the previous count as the baseline. The Kas
screen must always state which baseline it is comparing against, in words, so
the owner is never shown a difference whose origin they cannot see.

### Opening float

`cash.counted` records a count at a point in time. Expected drawer cash for a
day requires knowing what was in the drawer at the start, so a
**`cash.opening_float`** event records the starting amount whenever the owner
declares one. The owner does **not** have to declare one: if no float is
recorded, the drawer comparison is still meaningful **relative to the previous
count** rather than to zero, and the Kas screen must say which comparison it is
showing rather than silently assuming a starting balance of zero.

### Caching

Derived values may be cached in a local table for speed, but the cache is
always rebuildable from events and is never the source of truth. If the cache
is suspected wrong, it can be thrown away and recomputed.

---

## 9. Supplier settlement models (three distinct things)

The owner described three ways goods arrive, and conflating them produces wrong
numbers. They are modeled separately.

1. **Cash purchase (beli tunai)** — the owner pays when the goods arrive. The
   goods are the owner's immediately; there is no payable.
2. **Tempo (credit purchase)** — the owner takes the goods and owes the money.
   The goods **are the owner's** immediately (they can be sold, and they count
   as owned stock). A payable is created for the full amount.
3. **Titip (consignment)** — the supplier leaves goods on the shelf. The goods
   **are not the owner's.** They are counted as consignment stock, separate
   from owned stock. The owner owes nothing yet. **When an item sells, a payable
   is created for that unit's agreed amount** — debt is created by selling, not
   by receiving. Unsold titip goods can be returned to the supplier
   (`stock.consignment_returned`), which cancels their consignment stock with
   no money changing hands.

**Settlement timing (owner's words): "I pay it the next supplier visit."** So
payables for a supplier accumulate into a running total, and the owner
settles some or all of it when the supplier next appears. The supplier screen
must therefore show **the current total owed and, ideally, what it is made of**,
without the owner doing arithmetic.

---

## 10. Customer debt (hutang) — one transaction, split payment
The owner chose **one transaction, split payment**. This is a deliberate
decision with a real consequence, and it is recorded here so it is not
"simplified" away later.

- A sale for Rp 85.000 where the customer pays Rp 50.000 is **one** sale event
  of Rp 85.000, with a payment of Rp 50.000 recorded against it. The remaining
  Rp 35.000 becomes that customer's debt.
- **"Today's sales" therefore reports Rp 85.000** — the true value sold —
  while the drawer only gained Rp 50.000. Sales and cash **intentionally
  differ**, and the reporting must surface both without implying they should be
  equal.
- The alternative (a cash sale plus a separate manual debt entry) was rejected
  because it makes "today's sales" and "money in the drawer" drift from truth
  and relies on the owner remembering to create two records.

**Receipts must show the split**: amount due, amount paid, and the outstanding
amount that was added to the customer's debt.

**A customer is required whenever a sale produces debt** (owner's decision).
The picker on Kasir may stay optional for a fully paid sale, but the moment
payments fall short of the total, the app blocks saving until a customer is
chosen. The alternative — debt with no owner — was rejected because an
unattached debt can never be collected, and it would quietly corrupt the
"money owed to me" figure the owner is trying to trust. The Kasir screen must
therefore make the customer choice obvious *before* the owner reaches the
payment step, not spring it as an error after.

**Writing off a debt.** Real debts sometimes never get paid — a customer
moves away, or the amount is not worth chasing. `receivable.written_off` clears
it explicitly, and it is deliberately **not** the same as being paid. The
Pelanggan screen shows what was written off separately from what was collected,
so the owner's collections figure stays honest.

**Overpayment and void interaction.** If a customer pays more than they owe,
the excess becomes a **credit against that customer** (negative debt), shown as
such rather than hidden. If a sale that created debt is **voided after the
customer already repaid part of it**, the repayment stays where it is: the
customer simply holds a credit. The app must never silently reverse money that
actually changed hands.

### Returns: void and re-ring (owner's decision)

There is **no partial return** in the app. When a customer brings back one item
from a larger sale, the owner **voids the whole sale and rings it up again**
without the returned item.

This is a deliberate choice and it is acceptable because it matches how the sale
was made: the whole cart is quick to re-enter by tapping, and the alternative —
a partial-return feature with its own stock, refund, debt, and receipt rules —
is a large amount of machinery for an uncommon case.

**The consequence the app must handle.** Voiding and re-ringing produces **two**
events: a void of the original sale and a new sale. So:

- **Sales counts and receipt numbers must not double.** The void cancels the
  original in every derived figure, and Laporan must not show the re-rung sale
  as extra revenue on top of a sale that no longer counts.
- **The re-rung sale gets a new receipt number**, because it genuinely is a new
  transaction. Riwayat must show the original as **voided** rather than hiding
  it, so a receipt number the customer holds can always be traced.
- **The voided sale's receipt must never be re-shared as if it still stands**;
  re-sharing a voided sale must print or share it marked as voided.

---

## 10a. Weight-based items (quantity is not always a whole number)

The owner sells some goods by weight or volume, and half and quarter amounts
matter. So one tap is not universally "one unit."

**Quantity type per item.** Each item carries its own unit and its own
quantity step, so the app never has to guess:

- A packet of instant noodles: unit `bungkus`, step 1, always whole.
- Rice: unit `kg`, step `0,25`, sold as `0,25 / 0,5 / 1 / 1,5 kg`.

**Kasir behaviour:**

- Tapping a whole-unit item adds 1, exactly as the owner described. The fast
  path is unchanged for the majority of goods.
- Tapping a step-based item (rice) opens a small quantity control with the
  common fractions as one-tap buttons, plus free entry, rather than adding a
  blind 1. Adding `1 kg` of rice when the customer wanted `0,5` and correcting
  afterwards is slower than asking once.
- Search-to-add works identically for both kinds.

**Rounding rule (builder's decision).** Quantity may be fractional; money stays
integer rupiah. A line total is `round(unit_price × qty)` and the cart total is
the sum of the rounded line totals, so the receipt always adds up exactly to the
total printed. Rounding must be applied **once, at the line**, and the same way
on every device, or two phones will disagree by a rupiah.

**Stock and weight.** Stock for weight-based items is held in the same fractional
unit (`12,5 kg` on hand), and corrections, receiving, and the payable math all
accept fractional quantities. This is why the stock correction stores a delta
(§8): a delta of `-0,25 kg` merges by addition across phones just as cleanly as
`-1`.

**Why this could not wait:** it touches the tap-to-add grid and cart editor on
Kasir, which §11 calls the adoption condition, plus the receipt renderer, the
stock math, and the payable math. Discovering it after those were built would
have meant reworking the one screen that must never be slow.

### Receipt identity and report basis (builder's decisions)

**Every sale needs a human-facing number**, because the owner will want to
find a sale in Riwayat and re-share its receipt. Two phones numbering
independently offline means naive sequential numbers collide, so:

- Each phone gets a short device code (e.g. `A`, `B`).
- A sale's display number is `YYYYMMDD-<device>-<seq>`, e.g. `20261031-A-014`.
  It is unique without coordination, sortable by day, and human-readable
  enough to find on a receipt.
- The sale's true identity remains its **UUID**; the display number is a
  convenience and never a key. This avoids a global counter, which is exactly
  the thing that cannot exist across two offline phones.

**Which clock and which day.** Events carry device local time (§8) and the two
phones' clocks may disagree by a minute or two. Reports therefore:

- Use **device local time** for the day/week/month boundary, and both phones
  are expected to be set to WIB. The store is in one timezone; introducing a
  canonical server timezone would be complexity without benefit.
- **State their basis.** Because each phone only computes over the events it
  has pulled, a report may be missing the other phone's unsynced sales. Laporan
  must therefore show the last sync time **and** how many local events are not
  yet sent, so "today's sales is Rp 0" is never read as truth when it is
  actually "phone B's sales have not arrived yet." Period comparison is bounded
  the same way, and the filter bar shows the boundary dates it used.

---

## 10b. Repacking bulk into packets (tepung)

The owner buys flour by the **sak (25 kg)** and repacks it into packets of
2 kg, 1 kg, ½ kg, and ¼ kg. **The sack is the stock; repacking converts it into
packets; the packets are what is sold.**

**Model: a repack is an event, not a sale and not an adjustment.**

`stock.repacked` carries:

- the **source** (the bulk item and the quantity consumed, e.g. 25 kg flour),
- one or more **destinations** (item and quantity produced, e.g. 10 × 2 kg),
- an optional **wastage / yield difference** field.

**Why an event and not two adjustments.** A repack changes stock in two places
at once, and the two must be recorded together or the numbers are wrong for as
long as they are apart. Recorded as one event, the merge is still a plain union
across phones — no conflict — and the operation either happened or it did not.

**The bulk item and the packet items are separate variants of one product
product** (§10d), each with its own unit, its own stock, and its own selling
price. Flour-sak is not sold by the tap grid in normal use; packets are.
Repacking is the only thing that consumes the sack. Stock is never pooled
across variants.

**Yield and wastage are the owner's business, not the app's to hide.** 25 kg
into ¼ kg packets is nominally 100 packets, and reality is usually a few less.
The repack screen shows the expected yield, lets the owner record the actual
number made, and records the difference rather than silently balancing. If the
difference is not recorded, bulk stock and packet stock drift with no visible
cause — an anti-goal (§5).

**Cost and margin.** Bulk cost is known from `stock.received`. Packet cost can
be derived (bulk cost ÷ packets made, including wastage) so Laporan can show
whether repacking is actually profitable. This is a derived figure, not a stored
one.

**Reusable, not flour-specific.** Rice, sugar, and cooking oil sold from bulk
follow the same path in the same way. The feature is "repack bulk into packets,"
and flour is simply the first user of it.

---

## 10c. Master data: items, categories, customers, suppliers

The owner wants full add, edit, and erase on all master data, and items to have
categories.

**Add, edit.** Every master record (item, category, customer, supplier) can be
created and edited, and every edit is an event (§8), so two phones can edit
different things and merge cleanly.

**Erase is archive.** "Erasing" a record **hides it from pickers and lists but
keeps its history**. This is the owner's chosen behaviour and it is also the
only safe one: an item that has been sold appears on receipts, in analytics, and
in stock movements, and truly deleting it would leave those pointing at nothing
and silently move old numbers. So:

- `item.archived` (and the equivalent for customers, suppliers, categories)
  removes it from the sell grid and from new records.
- **True deletion is offered only for a record that has never been used** —
  never sold, never received, never referenced. That is the honest case where
  deleting is harmless, and it avoids a warung filling up with typo-test items.
- A customer with outstanding debt cannot be archived until the debt is settled
  or explicitly written off, or the debt becomes invisible while still owed.

**Categories.** Items carry a category, and categories can nest (e.g. Sembako →
Tepung). Categories are assignable at item creation and editable later, and they
are one of the report filters (§14). Deleting a category does not delete its
items; the items become uncategorised.

**Satuan (unit) is chosen when the item is created, and fixed for that item.**
This is the owner's decision and it keeps the sell screen fast: the app never
has to ask which unit is meant mid-sale. It also means the same physical
product sold two ways is **two variants** — "Tepung terigu 1 kg" and "Tepung
terigu ¼ kg" are separate variants with separate prices and separate stock,
which is exactly what makes stock math and analytics correct. The alternate
choice (one item whose unit is picked at the counter) was rejected because it
makes stock, receipts, and best-seller ranking all ambiguous. Variants are
grouped under a **product**, which in turn sits under a **category** (§10d).

**Item fields implied by the decisions above:** name, **kode** (optional,
searchable, §10f), category, unit (`satuan`, fixed at creation), quantity step
(whole, or ¼ for weight), selling price, cost, default supplier,
minimum-stock rule (optional), product and size label (§10d), whether it is a
bulk item that is repacked (plus its yield recipe), whether it is normally
consignment, and an optional photo/colour marker for the tap grid.

---

## 10d. Categories, products, variants, and knowing when to repack or restock

The owner does not repack every day, so the app must answer three different
questions, and they are not the same question:

1. **Is a size running out?** (Tepung terigu 1 kg is down to 2 packets)
2. **Do I need to buy from the supplier?** (no sacks left, or a packet item that
   is not repacked)
3. **Do I need to repack?** (packets are low, *but a sack is sitting there*)

Question 3 is the one that saves the owner work, and it is only answerable if
the app understands the relationship between the sack and the packets.

### Three levels, and what each one is (owner's correction)

The owner corrected an earlier draft: **"Tepung" is a category, not a product.**
There are tepung terigu, tepung sagu, and tepung singkong, and each of those is a
**product** with its own **variants** of 2 kg, 1 kg, ½ kg, and ¼ kg. So the model
has three levels, and they must not be conflated:

| Level | Example | Holds | Seen in the UI as |
|---|---|---|---|
| **Kategori** | Sembako → Tepung | Nothing but grouping | Report filter; browsable heading |
| **Produk** | Tepung terigu | Name, default category | A tile / a row in **Barang** |
| **Varian** | Tepung terigu 1 kg | Unit, price, stock, step | The thing you actually tap and sell |

- **Every variant is a full item**: its own id, unit, price, its own stock, and it
  is what appears on sale lines, receipts, and stock movements. Selling
  Tepung terigu 1 kg must not touch Tepung terigu 2 kg.
- **Products and categories hold no stock and no price** and are never
  referenced by a sale.
- **Stock is tracked per variant**, not per product and not per category.
- A product with a single variant needs no extra ceremony: it is just an item
  with one size, so a shop that never repacks sees no extra concept.

**The distinction that matters most: category is for grouping, product is for
identity.** "Tepung terigu" and "Tepung sagu" are both *tepung*, so they share
a category, but they are different substances at different prices with
different suppliers. Treating the category as the product would merge their
stock and their best-seller rankings.

**Reports and filters work at all three levels:** category total (all tepung),
product total (Tepung terigu, all sizes), and variant alone (Tepung terigu 1 kg).

### Sell screen with products

The grid shows one tile per **product**, labelled with its name and its
most-sold variant. Tapping a product tile reveals its variants for the next tap.

This must not slow the common case: whole-unit single-variant items stay a
**single-tap-to-add tile** with no reveal step. Products with several variants
get the reveal because a size genuinely must be chosen. If the owner finds the
reveal annoying, the grid may be kept **flat** (every variant as its own tile)
as a setting — the data model is identical either way, so this is a UI
preference and not a design lock-in.

**Why the levels exist at all, rather than "separate items, unrelated":** the
previous draft had the sack and the packets as separate items linked only by
repack events. That is still true for *stock* — they must be separate, or the
math is wrong — but the owner's mental model is one product with sizes under a
category, and the app should match the mental model it is replacing. Keeping
them unconnected meant the app could only learn yields by watching, and could
never answer "should I repack?".

### Declared yield (builder's decision, needed for repack advice)

Because the app should not have to observe a repack before understanding it, a
**yield recipe is declared on the bulk item**: "1 sak (25 kg) → 10 × 2 kg,
25 × 1 kg, 50 × ½ kg, 100 × ¼ kg."

- Declared once, editable later.
- The recipe states expected quantities; **actual** made is still recorded at
  repack time (§10b), so wastage stays visible rather than being assumed away.
- Without a declared recipe the app can still record repacks and track stock,
  but it cannot suggest *how much* a sack would produce. So the recipe is what
  makes question 3 answerable.

### The low-stock rule (owner's choice: both)

An item is **low** when either test fires:

- **An explicit minimum is set** on that variant (e.g. "tell me when Tepung
  terigu 1 kg drops below 5") — the owner's own rule, and it always wins when
  present.
- **No minimum is set** — fall back to **selling speed**: warn when the stock on
  hand is less than roughly what the item sells in a short window (a few days'
  cover). The window is a builder-tunable number, not a fixed law.

  **"Low" is per bucket, because stock is split two ways.** An item can hold both
  owned stock and consignment (titip) stock (§8), and titip stock is not the
  owner's to reorder. So the low test runs against **owned stock only**, and a
  titip-only item is not "low" in the reorder sense. Where titip stock exists, the
  Stok screen shows it separately and labels it, but it must never be added to
  owned stock to decide whether to reorder.

  The screen must say **which rule flagged it** ("minimum 5" vs "sells ~3/day"),
  because a warning with an invisible reason is one the owner learns to ignore.

**Honesty applies here too (§14).** Selling-speed estimates need history. For a
new item, or after only a few sales, the app must **say it does not know yet**
rather than invent a confident number. Until then, a minimum is the only
reliable rule, and the app should nudge the owner to set one.

### The repack decision (owner's choice)

When a **packet variant** is low, the app **flags it low and shows the sack
stock alongside it**, and leaves the judgement to the owner.

So the Stok screen shows, in one place:

- the packet variant, its stock, and why it is flagged;
- the bulk item's stock, right next to it.

The owner then reads it at a glance: *"1 kg packets are low and there are 3
sacks — I'll repack"* versus *"1 kg packets are low and there are no sacks — I
need to order."* The app **does not** generate a repack plan or a suggested
quantity in this version. That was the owner's explicit choice: flag it and show
the facts, do not decide for them. The declared recipe still exists, so a
suggested quantity can be added later without a model change.

### Alerts (owner's choice: a screen, no notification)

Low stock and "time to look at repacking" are surfaced on **Stok** and
**Laporan**. There is **no push notification** in this version, and no low-stock
indicator on Kasir. The owner checks the screen.

Consequence to be honest about: nothing will *interrupt* the owner, so the
warning is only useful if the screen is one they actually open. Stok should
therefore lead with the low items rather than burying them under a full stock
list, or the feature quietly does nothing.

### Known limitation: the sell screen can over-promise (frozen stock)

The owner chose **no low-stock indicator on Kasir**, so Kasir will happily ring
up an item that the Stok screen says is out of stock. This is a deliberate
trade-off — a warning tapped past mid-sale trains the owner to ignore it — but
it is recorded here so nobody "fixes" it accidentally, and so the behaviour is
known rather than surprising.

Because of this, Kasir must **not enforce** stock limits: selling into negative
stock has to be allowed, or the owner cannot sell what the app has miscounted.
Negative stock is therefore a **valid, visible state**, not an error.
`stock.adjusted` (§8) is the way back to truth.

---

## 10e. Opening stock, bulk import, discount, rounding, closing, and device loss

These six were missing from the first draft and were added after a coverage
review. They are grouped because each is small on its own but each one, if
absent, is a documented reason small shops abandon a POS.

### Opening stock (owner's choice: initial counts, with the zero path allowed)

The app must not start with every item at zero and let low-stock warnings fire
on everything. On first setup there is a guided **"Stok awal"** pass:

- For each item created, the owner can enter the current count immediately, or
  skip it.
- Skipped items start at zero and the owner may fix them later by the normal
  manual correction (§8) — that path is explicitly allowed.
- An opening count is recorded as a **`stock.opening`** event, not a silent
  value, so stock on hand is still fully derived from events and the first
  count can be audited like any other movement.
- The Stok screen must therefore distinguish **"never counted"** from **"counted
  and it is zero."** A brand-new item that was never counted must not be
  reported as out of stock; it must be reported as **unknown**, or the owner
  learns to ignore the warnings on day one.

### Bulk import (owner's choice: yes)

A few hundred items typed one at a time is the most likely reason the app never
gets used. So:

- A **paste-rows / CSV import** screen loads items from a spreadsheet: name,
  product, variant size, category, unit, price, cost, opening stock, minimum.
- The import is previewed before it is committed, with row-level errors shown
  (`harga bukan angka`, `satuan kosong`), because a half-imported catalog is
  worse than none.
- Imported items are created as normal `item.created` events, giving the same
  merge behaviour as items typed by hand.
- **A shop with a dozen items does not need this**, and the screen must not be
  in the way of the simple path.

### Discount (owner's choice: cart-level only)

A **discount on the whole cart**, not per item:

- Entered at the payment step as either a rupiah amount or a percentage, and it
  is recorded **on the sale event** so the receipt and the reports agree.
- The receipt shows the gross total, the discount, and the net total, so a
  discounted sale is never mistaken for a mispriced one.
- **Per-item discounts and wholesale/reseller price tiers are not built.** That
  is a pricing engine, and nothing in the owner's description of their store
  calls for it. If resellers become common, it returns as a real feature.

### Cash rounding (owner's choice: yes, configurable, default nearest 500)

- The net total is rounded for **cash payment** to the nearest configured step
  — Rp 100, Rp 500 (default), or Rp 1.000.
- The rounding is shown on the receipt as its own line, **pembulatan**, with
  sign (+/−). A receipt whose lines do not add up to its total is a receipt the
  owner stops trusting.
- Rounding is applied to the **cash amount tendered/total**, and it must be
  computed **once, deterministically**, so both phones agree. It does not
  rewrite the sale's recorded revenue: sales stay at the true price and the
  rounding is its own small line, or the drawer and the revenue figures diverge
  unexplained.
- Because v1 is cash-only (§8), rounding applies to every sale.

### Closing the day (owner's choice: yes)

A **Tutup Toko** screen, mostly read-only over data that already exists:

- Today's sales, transaction count, discount total, cash expected in the drawer,
  and a prompt to enter the counted cash (`cash.counted`).
- It does **not** lock the day or prevent further sales; it is a checkpoint, not
  a shift system. There are no shifts in this app (§2).
- The closing record is what makes the cash history in Laporan readable: a list
  of days with expected vs counted vs difference.

### Device loss and replacement (owner's choice: (b) as a setting, (c) as the real answer)

If a phone breaks, its unsynced events are stranded, and with `device_id` +
`seq` (§8) there is no way for another phone to take over its stream. So:

- **(c) The real answer:** the database file can be exported from the old phone
  and imported into the new one, carrying device identity, unsent events, and
  all history. This is the recovery path to document and test.
- **(b) The setting:** a new phone can be told to **adopt an existing device
  identity and continue its `seq`**. This is correct **only if the old phone
  will never sync again** — if both phones use the same `device_id` and both
  push, `seq` collides and events can be lost or overwritten. The setting must
  therefore present it as exactly that trade-off, and must refuse to adopt an
  identity whose events are still arriving.
- Both paths require a **backup/restore** action in Pengaturan, which is also
  the answer to "what if both phones are lost."

### Where these live

| Concern | Screen |
|---|---|
| Stok awal | During setup; also `Barang` → item → stock |
| Bulk import | `Barang` → Impor |
| Discount, rounding, kembalian | `Kasir` payment step |
| Closing | `Tutup Toko` |
| Backup / restore / adopt device | `Pengaturan` |

---

## 10f. Kasir behaviour under real counter pressure

Kasir is the screen the shop is judged on. The following are decided
behaviours, not incidental implementation details, because each one is a bug
users experience as "this app lost my work."

### Saving is final for the tap (owner's decision)

**Saving disables the button and moves to the receipt.** A double-tap must
never produce two sales.

- On save, the button disables **before** any async work, so a fast second tap
  finds it already inert.
- The sale is written once, as one `sale.completed` event. Events are immutable
  (§8), so there is no "unsave" — a mistake after saving is corrected with
  `sale.voided` (§8), not by tapping again.

### Kembalian (change) is displayed and printed (owner's decision)

- The payment step shows **kembalian** (change owed to the customer) live as the
  cash tendered is typed, and it is **printed on the receipt**.
- Order of operations is fixed: gross total → discount → rounding (§10e) →
  net total → tendered → **kembalian = tendered − net total**.
- Kembalian may never be negative. If tendered is less than the net total, that
  is not change, it is **hutang**, and §10 takes over (a customer is required).

### The cart outlives interruption (owner's decision)

**The cart is written to disk on every change.** Phone locks, a call, the app
being killed in the background, or a battery running flat must not lose a
half-entered sale.

- The cart is a draft, not an event: it does not touch stock or money until
  saved. It is restored on reopen, with a visible indication that it was
  restored.
- Only one cart exists at a time (two users, never simultaneous, §2). There is
  no "hold this order and start another" in v1.

### Cancelling the cart (owner's decision)

An obvious **Batalkan** action empties the cart, behind a confirmation. Removing
eight items one by one is how a wrong-looking sale gets saved.

### Kode barang (owner's decision: yes)

Each **varian** carries an optional **kode** — a short identifier separate from
its name (e.g. `TLG-1`), used by the owner, on labels, or later by a barcode.

- Searchable in Kasir alongside the name, so typing `TLG` finds Tepung terigu.
- **Not required**, and duplicates are **warned about rather than forbidden** —
  a real catalog may reuse codes, and blocking entry on a business rule the
  owner did not ask for would be worse than a warning.
- This is the seam a future camera scanner plugs into; no scanner is built now.

### Negative stock shouts (owner's decision)

Selling into negative stock is allowed (§10d), but a negative count is a
**disagreement between the app and the shelf**, and the Stok screen must treat
it that way: **red, and at the top of the list**, above merely-low items.

A quiet `-2` among the numbers is a count that stays wrong for weeks.

---

## 11. Screens (Indonesian UI)

Named in Indonesian, since that is what the user sees.

| Screen | Purpose |
|---|---|
| **Kasir** | The sell screen. Item grid (tap = +1 for whole-unit items; a quantity control for weight-based items), search **by name or kode**, running cart with qty editing and **Batalkan**, **customer picker before payment**, total, **discount, cash rounding, tendered and live kembalian**, then save (button disables) & receipt. **The cart survives app kill.** |
| **Riwayat** | Past transactions, openable to re-share a receipt, and to **void** a sale that should not exist. |
| **Barang** | Product and variant master: add/edit/archive name, category, product, variant size, unit (`satuan`, fixed at creation), price, cost, default supplier, quantity step, minimum-stock rule. Includes **Impor** (bulk paste/CSV) and a **Repack** action for bulk → packets. |
| **Kategori** | Category list and tree: add/edit/archive, used by products and by report filters. |
| **Tutup Toko** | Daily closing: sales, discount total, expected cash, prompt for a count, and a record of the day. Locks nothing. |
| **Stok** | Leads with **negative counts first, in red**, then **what is low and why it was flagged**, per variant. Stock on hand (owned vs titip vs bulk shown separately), manual correction with reason, and for a low packet variant **the bulk stock shown right next to it** so the owner can decide repack vs reorder. |
| **Repack** | Convert bulk stock into packets: choose source, quantity, and what it becomes; record actual yield and wastage; see derived packet cost. |
| **Supplier** | Supplier list; per-supplier detail showing current payable, its composition, receive-goods form (choosing tunai / tempo / titip), and pay-supplier form. |
| **Pelanggan** | Customer list; per-customer detail showing debt, its composition, and a record-payment form. |
| **Laporan** | Analytics: sales over time, best-selling products, low-stock and restock, cash reconciliation history, **with filters** (date range, category, single item, period comparison). |
| **Kas** | Cash drawer count: enter counted cash, see expected (opening float + cash in − cash out − expenses), record the difference. Also records **cash expenses, withdrawals, and deposits** — listrik, transport, personal, banking the takings. |
| **Pengaturan** | Store details, receipt header/footer, sync status and manual sync, **cash rounding step**, **backup / restore**, and **device identity adoption**. |
| **Impor** | Paste rows or choose a CSV to bulk-create items: preview, row errors, then commit. |

**Kasir is the screen that decides whether the app is adopted.** It is the one
screen that must never be slow and must never lose a cart.

---

## 12. Receipts

- Generated **on the device** as a **PDF** after every transaction.
- Shareable (WhatsApp) and saveable to the phone. No printer required.
- Contains: store name/address, date and time, line items with qty and price,
  total, **amount paid, change, and any amount added to the customer's debt**,
  and the customer's name when one was selected.
- Receipt text is configurable in Pengaturan (header/footer, e.g. thanks or
  phone number).
- **Thermal printing is deliberately deferred.** It requires leaving Expo's
  managed workflow for a custom development build plus a Bluetooth library. The
  PDF design must not be a dead end: the receipt should be produced from a
  single, reusable receipt-data structure so a thermal printer renderer can be
  added later without reworking the sale flow.

---

## 13. Sync (loose)

Each phone sells independently. When a network is available, the app exchanges
events with the shared Supabase database.

- **Push**: send this device's events (identified by `device_id` + `seq`) that
  the server has not acknowledged.
- **Pull**: fetch events from other devices since the last pull, and apply them.
- **Idempotent**: events carry UUIDs, so re-sending is harmless. A partial
  failure re-sends rather than duplicating.
- **Additive**: incoming events are appended to the local store; derived values
  recompute. No field is overwritten except master data (last-write-wins per
  §8).
- **Trigger**: automatically when online (app foreground, and opportunistically
  after a sale if a network is present), plus a manual "Sinkron sekarang"
  action in Pengaturan.
- **Visible state**: the app shows when it last synced and whether there are
  unsent events, so a silent backlog is impossible.
- **Accepted consequence**: between syncs the two phones can disagree about
  stock and debts. This was chosen knowingly: the alternative is refusing sales
  offline. The reconciliation path when numbers look wrong is the manual
  correction (§8), and the design must make that path easy to find and trust.

---

## 14. Analytics, and honesty about them

Requested: best-selling product, whether to restock, when to restock.

- All analytics are **queries over `sale.completed` events** (plus stock events
  for restock math). Nothing is stored as a fact.
- **Sales over time** — by day/week, totals and transaction counts.
- **Best products** — ranked by units and by revenue, over a selectable window.
  **Units are not comparable across different units**: 3 kg of rice and 3
  packets of noodles are not the same "3". So the unit ranking is shown
  **per unit type** (`bungkus`, `kg`, `pcs`, …) or as a single-unit list, and
  revenue ranking works across everything because rupiah is always comparable.
  Presenting a mixed-unit "units sold" league table would be exactly the kind
  of confident-but-meaningless number §14 forbids.
- **Low stock / restock** — per **variant**, using the owner's minimum when set
  and selling speed otherwise, **stating which rule fired**, and showing bulk
  stock next to a low packet variant so "repack" and "reorder" can be told
  apart (§10d).
- **Cash reconciliation history** — recorded counts and differences.

### Filters (owner-chosen)

Reports are filtered by:

- **Date range** — today / this week / this month / custom.
- **Category.**
- **Single item / product.**
- **Period comparison** — this period against the previous equivalent period,
  so "this week vs last week" is answerable without exporting anything.

Not filtered by who sold something, because there is one shared account and the
app deliberately does not know who sold what (§2). Filters are combinable, and
the selected filters must be visible on the report itself so a number is never
read out of context.

**The honesty rule (an anti-goal, restated as a design rule):** analytics must
not present conclusions the data cannot support. With a few days of data, "best
product" is noise. The reports must state the window they are computed over and
indicate when there is too little history to be meaningful, rather than
displaying a confident number. Restock suggestions likewise depend on recorded
sales history and must say so.

---

## 15. Suggested build order

Analytics is deliberately **last**: it is a view over data the earlier stages
collect, and it cannot be validated until that data exists.

1. **Foundation** — Expo project, TypeScript, Indonesian strings, IDR integer
   money handling, local SQLite with the event store and the derived-value
   computation.
2. **Kasir** — sell screen, cart, master data (Barang: kategori / produk /
   varian, units, archive), **Impor** and **Stok awal**, **discount and cash
   rounding**, `sale.completed`, receipts as PDF. *At this point the app is
   already usable in the store.*
3. **Stok** — derived stock per variant, **low stock** with
   the minimum-or-selling-speed rule and its stated reason, bulk stock shown
   beside a low packet variant, manual correction with delta + reason, and
   **Repack** with a declared yield recipe (tepung and friends).
4. **Sync** — Supabase schema, push/pull, sync status, manual sync.
5. **Supplier** — tunai/tempo/titip receiving, payables, settlement on visit.
6. **Pelanggan** — customer debt, split payment, receiving repayments.
7. **Kas** — cash drawer count, plus recording expenses, withdrawals, and
   deposits, and reconciliation history. **Tutup Toko** (daily closing).
8. **Laporan** — analytics with filters, with the honesty rule applied.
9. **Safety net** — backup/restore and device identity adoption (§10e). Worth
   landing before the shop depends on the app, even though it ships last.
10. **Later, separate** — Bluetooth thermal printer (custom dev build), optional
   camera barcode scanning.

Each of stages 2–9 stands alone and is useful on its own. The order is a
proposal, not a constraint.

### What "done" means (owner's decision)

**v1 is done when all nine stages work.** The owner is explicit: this is not
shipped at stage 2 and then grown. Stage 2 being usable in the store is a
*milestone*, not a release.

This is a deliberate choice with one consequence worth stating: the owner will
be running the app in the shop from stage 2 onward, **before** sync and backup
exist. So stages 1–2 carry a real risk — if the phone dies before stage 9, there
is no recovery. The build plan must therefore keep the **backup/restore action
usable as early as the data model allows**, even if the full stage-9 work lands
last, because the shop's data starts existing at stage 2.

### Who builds it (owner's decision)

**The owner builds it themselves**, learning React Native as they go, coming
from web development. Consequences for the plan:

- Stages must be sized for someone learning the platform, not for an experienced
  mobile developer.
- **Foundation (stage 1) deserves disproportionate care.** Expo project layout,
  TypeScript configuration, SQLite access patterns, and the derived-value layer
  are learned once and inherited by every later stage; getting them half-right
  costs more than spending an extra pass.
- The plan should include small, checkable milestones within each stage rather
  than "finish the stage" — a learner needs to see progress within a day or two.
- Indonesian copy, error messages, and docs in the plan should be written so they
  can be read while learning, not as expert shorthand.

---

## 16. Decisions made, and by whom

**Decided by the owner:**

- Tap-to-add (one tap = one unit), no scanning, plus search-to-add on the same
  screen.
- Two users on Android, identical permissions, never simultaneous, **one shared
  account and no login**.
- Must work offline; **loose sync** explicitly chosen over strict consistency.
- Option to synchronize data.
- Money matters: sales analytics, stock analytics, restock guidance.
- Suppliers and customers as records; suppliers payable via tunai, tempo, or
  titip; **settlement on the next supplier visit**.
- Customers may owe (hutang).
- **Titip is supplier-to-owner only.** When asked directly, the owner confirmed
  the supplier titips goods to them. There is no owner-to-customer consignment
  in scope, and no feature is built for it.
- **Cash drawer counting matters but need not be daily** — the option must
  exist.
- **One transaction with split payment** for partly-paid sales.
- **Some goods are sold by weight**, and half and quarter amounts matter
  (beras, gula, minyak).
- **Debt requires a chosen customer** — the app must not save an unattached
  debt.
- **Cash only** — no transfer or QRIS.
- **A completed sale can be voided**, with a reason.
- **No partial returns** — a returned item is handled by voiding the whole sale
  and ringing it up again.
- **Money leaves the drawer for non-supplier things** (listrik, transport,
  personal, banking the takings), so those must be recordable.
- **Bulk is repacked in-store** (flour by the 25 kg sak into 2 kg / 1 kg / ½ kg /
  ¼ kg packets): the sack is stock, repacking converts it, the packets are sold.
- **`satuan` is chosen when the item is created** and fixed for that item.
- **"Erase" means hide from lists, keep the history**; true deletion only for a
  record never used.
- **Items have categories**; add/edit/erase applies to items, categories,
  customers, and suppliers.
- **Analytics filters:** date range (today / week / month / custom), category,
  single item, and period comparison.
- **Opening stock can be entered during setup**, and an item may also be left at
  zero and corrected later.
- **Bulk import of items** is wanted.
- **Discount is cart-level only**; no per-item or wholesale pricing.
- **Cash rounding is wanted**, configurable, default nearest **Rp 500**.
- **A new phone can adopt a dead phone's identity (as a setting), and
  export/import of the database is the real recovery path.**
- **A daily closing screen (Tutup Toko) is wanted.**
- **Saving a sale disables the button and moves to the receipt** (no double sale).
- **Kembalian is displayed live and printed on the receipt**, after rounding.
- **The cart persists to disk on every change** and survives the app being killed.
- **A clear "Batalkan" action empties the cart**, behind a confirmation.
- **Variants have an optional `kode`** separate from the name, searchable.
- **The owner builds the app themselves**, learning React Native.
- **v1 is done when all nine stages work** — stage 2 is a milestone, not a
  release.
- **Negative stock is shown in red at the top of Stok**. Negative stock itself
  is allowed.
- **Categories, products, and variants are three distinct levels.** "Tepung" is
  a **category**; tepung terigu / tepung sagu / tepung singkong are **products**;
  their 2 kg / 1 kg / ½ kg / ¼ kg are **variants**.
- **Low stock is per variant**, not per product: the owner needs to know
  *which size* is running out, and it is measured against owned stock only.
- **Low stock uses the owner's minimum when set, otherwise selling speed.**
- **A low packet variant shows the bulk stock next to it**, and the app leaves
  the repack decision to the owner rather than suggesting an amount.
- **Group related sizes into one product**, with stock still tracked per
  variant.
- **Alerts live on a screen** (Stok / Laporan) — no push notification, and no
  indicator on Kasir.
- Receipt for every transaction, printable/shareable.
- No thermal printer yet, undecided purchase date; **PDF/Share is an acceptable
  fallback**.
- Indonesian UI.
- Chose the approach: **Expo + SQLite + Supabase**.

**Decided by the builder (the author), to be checked:**

- Event-sourced data model with derived state, as the mechanism for conflict-free
  offline merging.
- Local device time on events; server time never rewrites it.
- Stock corrections stored as deltas, not absolute quantities.
- Master data resolved last-write-wins with a device-id tiebreaker.
- Consignment stock tracked separately from owned stock.
- IDR stored as integers everywhere.
- Separate event types for every money movement (sale, receivable, payable,
  cash count) rather than a single generic ledger entry.
- Build order, with analytics last.
- Ensuring sales and cash are reported separately and are not forced to agree.
- The specific screens and their Indonesian names.

**Settled by the builder after a review pass (recorded so they are visible):**

- A sale consumes **owned stock before consignment** stock; the split is
  derived, not stored.
- Per-**field** last-write-wins for master data, not per record.
- Payments are **cash only** in v1, with the payload shaped to accept a method
  later.
- `cash.opening_float` and `sale.voided` event types, added because the cash
  count and the correction of mistakes could not otherwise be expressed.
- Line totals are `round(unit_price × qty)`, rounded once at the line, on every
  device.
- A repack is a single event changing bulk and packet stock together, with
  wastage recorded rather than silently balanced.
- Bulk items and packet items are separate items linked only by the repack
  event.
- Packet cost is derived from bulk cost ÷ packets made (including wastage), not
  stored.
- Categories nest, and a category's removal does not remove its items.
- A **product** groups variants for display and reporting, while stock,
  price, and unit stay per variant.
- **Kategori → Produk → Varian** are three levels; only a variant carries
  stock, price, and unit, and only a variant appears on a sale line.
- Opening stock is a `stock.opening` event, and **"never counted" is distinct
  from "zero."**
- Cash rounding is recorded as its own receipt line and does not rewrite sale
  revenue.
- Adopting a device identity is only safe when the old phone will never sync
  again; backup/restore is the primary recovery path.
- A **declared yield recipe** on the bulk item lets the app reason about
  repacking without having observed one.
- Low stock uses the owner's minimum when set, else selling speed, and always
  names the rule it used.
- Selling-speed estimates are refused (rather than faked) when history is too
  thin.
- A **product is a display grouping**; each variant is a full item with its own
  id, unit, price, and stock, and sale lines reference the variant.
- Kasir **does not enforce stock**, and negative stock is a valid visible state
  that manual correction repairs.
- Returns are handled by void-and-re-ring, which creates two events; derived
  figures cancel the original so revenue is not double-counted.
- Sales get a human-readable display number (`YYYYMMDD-<device>-<seq>`) while
  the UUID stays the true key.
- Reports use device local time (WIB) and must disclose sync-pending state.
- Unit rankings are per unit type; revenue ranking works across all items.
- Cash can leave the drawer outside supplier payments, via `cash.expense` and
  `cash.withdrawn`.

---

## 17. Left to the builder

- Exact SQLite schema and indices; whether derived values are cached and how
  invalidation works.
- Supabase table shape (single `events` table vs. per-type), row-level security,
  and how the two devices are identified without login.
- Sync transport: decide whether to hand-roll push/pull over the Supabase
  client or adopt an existing sync library. Prefer the simplest thing that is
  idempotent and resumable.
- Whether stock is computed on demand, cached, or maintained incrementally; the
  build must be able to recompute from scratch.
- UI layout and visual design of every screen, including the item grid on
  Kasir, which is the performance-critical surface.
- PDF receipt template and layout.
- Indonesian copy for every label, message, and error.
- Navigation structure and app shell.
- The selling-speed window used when an item has no explicit minimum, and the
  threshold below which the app refuses to estimate from too little history.
- How the restock suggestion is phrased in Indonesian, and whether it is
  expressed in days of cover or in units.
- Handling of items sold at an edited price, and whether price is snapshotted
  per line (recommended: yes, snapshot the unit price on the sale line so
  later price changes cannot rewrite history).
- What "too little data for analytics" means numerically.
- Error handling for sync failures, so a failure is visible and never loses
  events.

---

## 18. Open questions (deliberately unresolved)

- Whether unsold titip goods are tracked per supplier with a due-back
  expectation, or simply as stock that may be returned.
- Whether the owner wants a low-stock alert (notification) or only a screen to
  check.
- Whether voiding a sale should update or supersede the receipt the customer
  already holds (the app cannot reach paper already handed out, but it must not
  re-share a stale receipt as if the sale still stands).

**Resolved during review** (previously open, now answered in §10 and §17):
weight-based quantities, debt requiring a customer, payment method, and whether
a completed sale can be voided.
