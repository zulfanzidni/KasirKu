import { cartTotal, emptyCart, qtyMark, removeLine, setLineQty, addToCart } from './register';

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

const gula = { ...terigu, id: 'var-gula-1kg', nama: 'Gula pasir 1 kg', harga: 16000 };

describe('fixing a cart before paying', () => {
  it('recomputes a line and the total when a quantity is edited', () => {
    let cart = addToCart(addToCart(emptyCart(), terigu, 0.25), gula, 1);

    cart = setLineQty(cart, { varianId: terigu.id }, 3);

    expect(cart.find((line) => line.varianId === terigu.id)).toMatchObject({ qty: 3, jumlah: 40500 });
    expect(qtyMark(cart, terigu.id)).toBe('×3');
    expect(cartTotal(cart)).toBe(56500);
  });

  it('adds a second tap of a different item without disturbing the first', () => {
    const cart = addToCart(addToCart(emptyCart(), terigu, 1), gula, 2);

    expect(cart.map((line) => [line.varianId, line.qty])).toEqual([
      [terigu.id, 1],
      [gula.id, 2],
    ]);
  });

  it('shows a quarter as the shop writes it', () => {
    const cart = addToCart(emptyCart(), terigu, 0.25);

    expect(qtyMark(cart, terigu.id)).toBe('×0,25');
  });

  it('drops a removed line and its money from the total', () => {
    let cart = addToCart(emptyCart(), terigu, 2);
    cart = addToCart(cart, gula, 1);

    cart = removeLine(cart, terigu.id);

    expect(cart.map((line) => line.varianId)).toEqual([gula.id]);
    expect(cartTotal(cart)).toBe(16000);
  });

  it('has no quantity mark for a varian that is not in the cart', () => {
    expect(qtyMark(emptyCart(), gula.id)).toBeUndefined();
  });
});
