# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Stack

Expo (React Native) + TypeScript, local SQLite event log, Supabase for sync.
Delegated by the owner to the design/spec work; recorded in
docs/superpowers/specs/2026-10-31-kasirku-pos-design.md.

## Users

The shop owner of a small Indonesian warung, and one other trusted person
(a parent). Two people, identical permissions, never using the app at the same
time. They are standing behind a counter, mid-conversation with a customer,
usually one-handed. Neither is a software person. The owner is also the person
building the app.

## Product Purpose

Rings up a sale in seconds without scanning, keeps stock honest per variant,
tracks what suppliers are owed and what customers owe, and lets the owner count
the cash drawer when they choose to. Exists because sales and stock otherwise
live in the owner's head and on scraps of paper. Success means the owner stops
keeping stock in their head and trusts the numbers enough to reorder from them.

## Positioning

Offline-first with loose sync, built on an append-only event log, so two phones
can sell independently and merge without ever disagreeing about what happened.
Most small-shop POS tools assume a connection or a single device; this one
assumes neither, and treats the shop's history as the durable asset.

## Operating Context

- In-store counter use, one-handed, interrupted constantly.
- Unreliable internet; selling must never wait on a network.
- Goods bought in bulk (a 25 kg sak of tepung) and repacked in-store into
  2 kg / 1 kg / 1/2 kg / 1/4 kg packets. Bulk and packet are separate variants
  of one product.
- Supplier settlement happens on the supplier's next visit, not at receipt.
- Cash-only in v1; the shop rounds cash totals.
- Items are tapped, not scanned. No barcode hardware.

## Capabilities and Constraints

**Terminology (binding — see GLOSSARY.md).** Barang is a collective, never one
item. Kategori -> Produk -> Varian are three levels; only a varian carries
satuan, price and stock. "Tepung" is a kategori; tepung terigu and tepung sagu
are separate produk. Titip (supplier consignment) and tempo (credit purchase)
are different things and never synonyms.

**Capabilities.** Tap-to-add and search-by-name-or-kode selling; running cart
that survives app kill; discount, rounding and kembalian; PDF receipts;
per-variant stock with manual correction; repacking; low stock by minimum or
selling speed; suppliers with tunai/tempo/titip; customer hutang with split
payment; cash drawer with expenses and Tutup Toko; filtered analytics; void and
re-ring; backup/restore; loose sync between two phones.

**Constraints.** Android only. Indonesian UI throughout. Integer rupiah.
Fractional quantities for weight items. No login. No roles. No barcode.
No thermal printer in v1. Analytics must refuse to claim what the data cannot
support.

**Explicitly out of scope.** iOS, multi-store, loyalty/promotions, non-cash
payments, per-item discounts, partial returns (handled by void and re-ring),
push notifications, a web dashboard.

## Brand Commitments

The app is called **KasirKu** and speaks Indonesian. No logo, no marketing
language, no mascot. It is a tool, not a brand the owner experiences.

## Evidence on Hand

No user research, no competitor analysis, no brand assets. The design document,
glossary and ADRs under docs/ are the only sources of product truth. Nothing
should be fabricated to fill a marketing-shaped gap.

## Product Principles

1. **Never lose a sale, and never block one.** A dead connection or a miscount
   is not a reason to refuse a customer.
2. **Calm and in control.** The owner is not chasing the interface; the screen
   should remove anxiety, not add urgency. No celebration, no gamification.
3. **Every number explains itself.** A warning without a reason is a warning
   that gets ignored. State which rule fired, which baseline was used, what is
   still unsynced.
4. **Honesty over confidence.** Say "not enough data yet" rather than inventing
   a best seller. The shop's trust is the product.
5. **Faster than memory, or it is abandoned.** At the counter, the tap path is
   the adoption condition, not a nice-to-have.

## Accessibility & Inclusion

Owner confirmed default text size is acceptable. Design for large touch targets
and legible numerals regardless: the app is used standing, in a shop, sometimes
in poor light, usually one-handed. All critical amounts must remain readable at
the Android system's default font scale without truncation.