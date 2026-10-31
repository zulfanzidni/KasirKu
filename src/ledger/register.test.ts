import { addToCart, emptyCart, tapGridItem } from './register';

const terigu1kg = {
  id: 'var-terigu-1kg',
  produkId: 'prd-terigu',
  nama: 'Tepung terigu 1 kg',
  kode: 'TLG-1',
  satuan: 'kg' as const,
  jualBy: 'weight' as const,
  harga: 13500,
  archived: false,
};

const terigu2kg = { ...terigu1kg, id: 'var-terigu-2kg', nama: 'Tepung terigu 2 kg' };

const indomie = {
  id: 'var-indomie',
  produkId: 'prd-indomie',
  nama: 'Indomie goreng',
  kode: 'IDM-G',
  satuan: 'bungkus' as const,
  jualBy: 'unit' as const,
  harga: 3500,
  archived: false,
};

describe('ringing up a customer', () => {
  it('adds exactly one of a single-variant whole-unit item on a tap', () => {
    const tap = tapGridItem(indomie, [indomie], emptyCart());

    expect(tap.kind).toBe('add');
    expect(tap.kind === 'add' && tap.cart).toEqual([
      { varianId: indomie.id, nama: 'Indomie goreng', satuan: 'bungkus', qty: 1, harga: 3500, jumlah: 3500 },
    ]);
  });

  it('adds three after three taps on the same item', () => {
    let cart = emptyCart();
    for (let i = 0; i < 3; i += 1) {
      const tap = tapGridItem(indomie, [indomie], cart);
      if (tap.kind === 'add') cart = tap.cart;
    }

    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(3);
    expect(cart[0].jumlah).toBe(10500);
  });

  it('opens the sizes of a multi-variant product before adding anything', () => {
    const tap = tapGridItem(terigu1kg, [terigu1kg, terigu2kg], emptyCart());

    expect(tap).toEqual({
      kind: 'chooseVariant',
      produkId: 'prd-terigu',
      varian: [terigu1kg, terigu2kg],
    });
  });

  it('offers 1/4, 1/2, 1 and 1.5 for a weight item', () => {
    const tap = tapGridItem(terigu1kg, [terigu1kg], emptyCart());

    expect(tap).toEqual({
      kind: 'chooseWeight',
      varian: terigu1kg,
      pilihan: [0.25, 0.5, 1, 1.5],
    });
  });

  it('reads 1/4 kg back as a price that was rounded once', () => {
    const cart = addToCart(emptyCart(), terigu1kg, 0.25);

    // 13.500 × 0,25 = 3.375
    expect(cart).toEqual([
      { varianId: terigu1kg.id, nama: 'Tepung terigu 1 kg', satuan: 'kg', qty: 0.25, harga: 13500, jumlah: 3375 },
    ]);
  });
});
