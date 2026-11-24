import { addToCart, emptyCart } from './register';

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
  it('adds exactly one of a whole-unit item', () => {
    expect(addToCart(emptyCart(), indomie)).toEqual([
      { varianId: indomie.id, nama: 'Indomie goreng', satuan: 'bungkus', qty: 1, harga: 3500, jumlah: 3500 },
    ]);
  });

  it('adds three after three taps on the same item', () => {
    const cart = addToCart(addToCart(addToCart(emptyCart(), indomie), indomie), indomie);

    expect(cart).toHaveLength(1);
    expect(cart[0].qty).toBe(3);
    expect(cart[0].jumlah).toBe(10500);
  });

  it('reads 1/4 kg back as a price that was rounded once', () => {
    const cart = addToCart(emptyCart(), terigu1kg, 0.25);

    // 13.500 × 0,25 = 3.375
    expect(cart).toEqual([
      { varianId: terigu1kg.id, nama: 'Tepung terigu 1 kg', satuan: 'kg', qty: 0.25, harga: 13500, jumlah: 3375 },
    ]);
  });
});
