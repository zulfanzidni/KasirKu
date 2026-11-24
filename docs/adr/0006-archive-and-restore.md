# ADR 0006: Archiving is a flag, and every level can come back

## Status
Accepted 2026-11-24.

## Context
Kategori, produk and varian each carry an `archived` boolean folded from
`*.archived` events. Until now the app only ever wrote `archived: true`, so
archiving was one-way: a record left every list with no way to find it again.
The owner asked for archived products to be reopenable, and for variants to be
archivable in their own right rather than only through their produk.

The fold also used to rewrite a produk's `kategoriId` to `null` whenever its
kategori was archived. That kept the produk visible under "Tanpa kategori",
but it destroyed the membership, so restoring the kategori could not put its
produk back.

## Decision
1. **Restoring writes the same event with `archived: false`.** No new event
   type, no delete: `kategori.archived`, `produk.archived` and
   `varian.archived` already carry the boolean, so a restore is a fact the log
   can replay on either phone.
2. **The fold keeps a produk's `kategoriId`.** An archived kategori is read as
   "no kategori" by the screens, which is what makes its produk appear under
   "Tanpa kategori" while it is away; restoring the kategori reattaches them
   without a second event.
3. **Restoring is per record.** Restoring a produk brings back the varian that
   were hidden with it (they were never archived themselves). A varian archived
   on its own stays archived until it is restored itself, and a varian under an
   archived produk is not sellable until the produk is restored.
4. **Archiving keeps every derived number.** Stock, titip and past sales are
   folded from the log and do not read the flag, so a restore changes only what
   the lists and the till offer.

## Consequences
- The Arsip card at the end of Barang is the one place archived records are
  found, grouped by level, each with its own `Pulihkan`.
- A varian is archived from its long-press menu. Because a varian with stock
  left (or one never counted) is worth a second look, that menu asks first and
  names the stock it is leaving behind.
- `foldEvents` no longer normalises `produk.kategoriId`; any code that wants
  the working kategori must resolve it against `kategori.archived`, as
  `Stok`'s `groupOf` already does.
- Ticket 13's wording changed from "leaves its products uncategorised" to
  "reads as uncategorised while archived, and returns on restore".
