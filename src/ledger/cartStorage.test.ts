import { MemoryKeyValue, loadCart, saveCart, clearCart } from './cartStorage';
import { addToCart, emptyCart } from './register';

const terigu = {
  id: 'var-terigu-1kg',
  produkId: 'prd-terigu',
  nama: 'Tepung terigu 1 kg',
  kode: 'TLG-1',
  satuan: 'kg' as const,
  jualBy: 'weight' as const,
  harga: 13500,
  archived: false,
};

describe('a half-entered sale survives the phone locking', () => {
  it('finds the same cart after the app is reopened', async () => {
    const disk = new MemoryKeyValue();
    const cart = addToCart(addToCart(emptyCart(), terigu, 0.5), terigu, 2);

    await saveCart(disk, cart);
    const reopened = await loadCart(disk);

    expect(reopened).toEqual(cart);
  });

  it('starts with an empty cart on a phone that has never saved one', async () => {
    expect(await loadCart(new MemoryKeyValue())).toEqual([]);
  });

  it('forgets the cart once the sale is saved', async () => {
    const disk = new MemoryKeyValue();
    await saveCart(disk, addToCart(emptyCart(), terigu, 1));

    await clearCart(disk);

    expect(await loadCart(disk)).toEqual([]);
  });

  it('ignores a cart that cannot be read rather than crashing the till', async () => {
    const disk = new MemoryKeyValue();
    await disk.setItem('keranjang', '{not json');

    expect(await loadCart(disk)).toEqual([]);
  });

  it('saves three taps of a whole-unit item as three of that item', async () => {
    const disk = new MemoryKeyValue();
    const indomie = { ...terigu, id: 'var-indomie', nama: 'Indomie goreng', satuan: 'bungkus' as const, jualBy: 'unit' as const, harga: 3500 };

    let cart = emptyCart();
    for (let i = 0; i < 3; i += 1) cart = addToCart(cart, indomie, 1);
    await saveCart(disk, cart);

    const reopened = await loadCart(disk);
    expect(reopened).toHaveLength(1);
    expect(reopened[0]).toMatchObject({ qty: 3, jumlah: 10500 });
  });
});
