# GLOSSARY

The domain language for KasirKu. One word, one meaning. If a word here is
used two ways, the model is wrong.

Indonesian is the language the shop speaks; the terms below are the shop's own
words, with an English gloss for anyone reading the code.

---

## Barang (goods / the item list)

**Definition:** the shop's stock items as a whole, and the name of the screen
that lists them. It is a **collective**, like "inventory" — never one item.

**Not** a single product and **not** a single size.

_Avoid_: using "barang" for one row in the list; the row is a **varian**.

---

## Kategori (category)

**Definition:** a grouping of **produk** for browsing and for report filters.
Holds no stock, no price, and is never referenced by a sale. May nest.

**Example:** `Sembako → Tepung`. Both tepung terigu and tepung sagu sit under
`Tepung`; they are different products that share a category.

_Avoid_: "family" or "group" as a synonym for kategori in the model.

---

## Produk (product)

**Definition:** one distinct thing the shop sells, identified by what it *is*
(Tepung terigu, Tepung sagu, Indomie Goreng). Holds a name and a default
category. Holds no stock and no price of its own. Grouped by exactly one
kategori.

**Example:** "Tepung terigu" and "Tepung sagu" are two produk that share the
kategori "Tepung". They are not the same product at different sizes; they are
different substances.

_Avoid_: "Tepung" as a produk. Tepung is the kategori.

---

## Varian (variant)

**Definition:** the thing actually sold. A specific size of a produk, with its
own **satuan**, its own price, its own cost, and its own stock. A sale line
references a varian, never a produk or a kategori.

**Example:** Tepung terigu 1 kg; Tepung terigu ¼ kg; the 25 kg sak of Tepung
terigu. Each is a separate varian with separate stock.

_Avoid_: "item" when a variant is meant; "size" alone when the varian's unit
matters; and treating variants as one product whose stock is pooled.

---

## Arsip (archived)

**Definition:** a **kategori**, **produk** or **varian** the owner has taken
out of the working list without deleting it. An archived **produk** hides its
varian from the till; an archived **kategori** leaves its produk visible but
uncategorised. Nothing is erased: history still reads the record, its stock
does not move, and every archived record can be restored on its own.

_Avoid_: "hapus" for archiving. A delete would break every sale that named the
record; the log keeps them.

---

## Satuan (unit)

**Definition:** the unit a varian is counted in: `bungkus`, `kg`, `pcs`, `sak`,
`liter`. Chosen when the **varian** is created and fixed for that varian.
Never chosen mid-sale.

_Avoid_: "unit" when the physical unit of measure is meant; and any design
where the satuan is picked at the counter instead of at creation.

---

## Stok (stock)

**Definition:** the derived quantity of a **varian** on hand. There is no
single "stock" that pools variants, produk, or kategori.

Three separate buckets, never added together:

- **dimiliki** (owned): the shop's own goods.
- **titip** (consignment): goods a supplier left that are not yet the shop's.
- **belum dihitung** (never counted): a varian that has never been counted,
  which is not the same as zero.

_Avoid_: "stok" meaning revenue, or meaning the count of a produk.

---

## Titip (consignment in)

**Definition:** a supplier leaves goods on the shop's shelf. The goods are
**not** the shop's until they sell. The shop owes the supplier only for units
that actually sell, and unsold units can be returned.

_Avoid_: "titip" for a customer taking goods away (not modeled at all); and
"titip" as a synonym for **tempo**.

---

## Tempo (credit purchase)

**Definition:** the shop buys goods and owes the money, but **owns the goods
immediately**. The payable exists from the moment the goods arrive.

_Avoid_: "tempo" for customer debt (that is **hutang**).

---

## Hutang (customer debt)

**Definition:** a customer's unpaid balance. Created when a sale is paid only
in part, cleared by payment or by an explicit write-off, and it is **not** cash
until it is paid.

_Avoid_: "hutang" for what the shop owes a supplier (that is a payable to the
**supplier**).

---

## Utang (supplier payable)

**Definition:** what the shop owes a **pemasok** — goods taken `tempo`, minus
payments and write-offs. It is the mirror of **hutang**, which is money a
**pelanggan** owes the shop, and the two must never be called by the same word
in the interface: on Pemasok the screen says **Utang**, on Pelanggan it says
**Hutang**.

_Avoid_: "hutang" on a supplier screen, and "utang" on a customer screen. The
distinction is the whole reason both words exist here.

---

## Sak (bulk sack)

**Definition:** a bulk unit of purchase, e.g. 25 kg of flour, that the shop
**repacks** into smaller variants for sale.

_Avoid_: "sak" as a selling unit for customers in normal trade; customers buy
the packets.

---

## Repack (repacking)

**Definition:** converting a bulk **varian** into packet **varian**s as a single
recorded event, with the actual yield and any wastage recorded.

---

## Resep hasil (yield recipe)

**Definition:** what the shop declares a sak produces: "1 sak → 10 × 2 kg,
25 × 1 kg, 50 × ½ kg, 100 × ¼ kg". Declared in advance; actual yield is
always recorded separately.

_Avoid_: treating observed past repacks as the recipe; the recipe is declared,
not inferred.

---

## Rendah (low stock)

**Definition:** a **varian** whose **dimiliki** (owned) stock is below the
owner's minimum, or, with no minimum set, below a short window of selling speed.
Titip stock does not count towards this.

---

## Tutup Toko (closing)

**Definition:** a checkpoint at the end of the day recording the day's figures
and a cash count. It locks nothing and does not create shifts.
---

## Kode (item code)

**Definition:** a short identifier on a **varian**, separate from its name,
used by the owner on labels or later by a barcode. Optional, searchable, and
may duplicate across variants (a warning, not an error).

_Avoid_: "kode" as a synonym for the UUID or the receipt number; it is a
human label, and nothing references a varian by it.

---

## Keranjang (cart)

**Definition:** the in-progress sale on the Kasir screen. A **draft**, not an
event: it touches no stock and no money until saved, and it persists to disk so
interrupting it loses nothing.

_Avoid_: "keranjang" for a completed sale. Once saved it is a **transaksi**.

---

## Kembalian (change)

**Definition:** cash handed back to the customer: `tendered − net total` after
discount and rounding. Never negative; a shortfall is **hutang**, not change.

_Avoid_: "kembalian" for the rounding difference, which is **pembulatan** and
appears on the receipt as its own line.

---

## Pembulatan (rounding)

**Definition:** adjusting the net total to the nearest configured cash step
(Rp 100 / **Rp 500 default** / Rp 1.000). A recorded line on the receipt; it
does not rewrite sale revenue.

_Avoid_: "pembulatan" for a discount; a discount is chosen by the owner, the
rounding falls out of the cash step.