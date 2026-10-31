# ADR 0002: Three master-data levels - kategori, produk, varian

## Status
Accepted.

## Context
An early draft used a two-level model: a "product family" ("Tepung") containing
sizes. The owner corrected this while reviewing it. In their shop, **tepung is a
category**, not a product: they sell tepung terigu, tepung sagu, and tepung
singkong, and each of *those* is a product with sizes 2 kg, 1 kg, 1/2 kg, and
1/4 kg.

The distinction is not cosmetic. Tepung terigu and tepung sagu are different
substances at different prices from different suppliers. Treating their shared
category as the product would pool their stock and their best-seller rankings.

The owner also required the `satuan` (unit) to be fixed when a thing is created,
chosen at creation rather than at the counter.

## Decision
Three levels, each with one job:

- **Kategori** - grouping only (Sembako -> Tepung). No stock, no price.
- **Produk** - identity (Tepung terigu). A name and a category. No stock, no
  price.
- **Varian** - the saleable thing (Tepung terigu 1 kg). Owns the `satuan`, price,
  cost, stock, and quantity step. Every sale line references a varian.

Stock, price, and unit live on the varian and are never pooled, summed, or
inherited from a parent.

## Considered Options
- **Two levels, category as product**: rejected - collides with the shop's own
  vocabulary and would merge distinct substances.
- **Flat items with the unit chosen at the counter**: rejected by the owner;
  it makes stock, receipts, and rankings ambiguous.

## Consequences
- **The term "family" is retired.** It appeared ~20 times in the design draft and
  was replaced throughout; `GLOSSARY.md` lists it under _Avoid_ for kategori.
- Every item-creation flow now needs a product (and so a place to put it), which
  is more setup than a flat list. Mitigated by allowing a product with one
  variant to behave exactly like a plain item.
- Reports must support three filter levels; a category total and a product total
  are different numbers.
- Because the unit is fixed at creation, the same goods sold two ways are two
  variants. That is correct for stock, but means the owner may need to create
  more variants than they expect.
