import { emptyShop } from './events';
import { gridVarian, produkWithVarian, searchVarian, type Shop } from './queries';
import type { Varian } from './types';

const tepung1 = varian('v1', 'Tepung terigu 1 kg');
const tepung2 = varian('v2', 'Tepung terigu 2 kg');
const gula = varian('v3', 'Gula pasir 1 kg');
const minyak = varian('v4', 'Minyak goreng 1 L');

describe('finding an item at the counter', () => {
  it('starts from nothing to tap', () => {
    expect(gridVarian(emptyShop())).toEqual([]);
  });

  it('keeps only the variants whose name matches, ignoring case and surrounding spaces', () => {
    expect(searchVarian([tepung1, tepung2, gula, minyak], '  GULA ').map((v) => v.nama)).toEqual([
      'Gula pasir 1 kg',
    ]);
  });

  it('shows everything when the search box is empty', () => {
    expect(searchVarian([gula, minyak], '')).toHaveLength(2);
  });

  it('leaves out archived variants', () => {
    const shop: Shop = { ...emptyShop(), varian: [{ ...gula, archived: true }, minyak] };

    expect(gridVarian(shop).map((v) => v.id)).toEqual(['v4']);
  });

  it('lists a product only once it has something to sell', () => {
    const shop: Shop = {
      ...emptyShop(),
      produk: [
        { id: 'prd-1', kategoriId: 'kat-1', nama: 'Tepung terigu', archived: false },
        { id: 'prd-2', kategoriId: 'kat-1', nama: 'Tepung sagu', archived: false },
      ],
      varian: [{ ...tepung1, produkId: 'prd-1' }],
    };

    expect(produkWithVarian(shop).map((p) => p.nama)).toEqual(['Tepung terigu']);
  });
});

function varian(id: string, nama: string): Varian {
  return {
    id,
    produkId: 'prd',
    nama,
    kode: null,
    satuan: 'kg',
    jualBy: 'weight',
    harga: 10000,
    archived: false,
  };
}
