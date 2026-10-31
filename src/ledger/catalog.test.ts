import { CatalogError, createCatalog, type EventDraft } from './catalog';

describe('creating master data', () => {
  it('records a kategori with its name trimmed', async () => {
    const { drafts, append } = writer();
    const catalog = createCatalog(append);

    await catalog.createKategori({ nama: '  Tepung ' });

    expect(drafts).toEqual([{ type: 'kategori.created', payload: { nama: 'Tepung', parentId: null } }]);
  });

  it('refuses a kategori with no name', async () => {
    const { drafts, append } = writer();

    await expect(createCatalog(append).createKategori({ nama: '   ' })).rejects.toBeInstanceOf(CatalogError);
    expect(drafts).toEqual([]);
  });

  it('records a produk inside its kategori', async () => {
    const { drafts, append } = writer();
    const catalog = createCatalog(append);

    await catalog.createProduk({ kategoriId: 'kat-1', nama: 'Tepung terigu' });

    expect(drafts).toEqual([
      { type: 'produk.created', payload: { kategoriId: 'kat-1', nama: 'Tepung terigu' } },
    ]);
  });

  it('records a varian with the satuan chosen at creation', async () => {
    const { drafts, append } = writer();
    const catalog = createCatalog(append);

    await catalog.createVarian({
      produkId: 'prd-1',
      nama: 'Tepung terigu 1 kg',
      kode: ' TLG-1 ',
      satuan: 'kg',
      jualBy: 'weight',
      harga: 13500,
    });

    expect(drafts).toEqual([
      {
        type: 'varian.created',
        payload: {
          produkId: 'prd-1',
          nama: 'Tepung terigu 1 kg',
          kode: 'TLG-1',
          satuan: 'kg',
          jualBy: 'weight',
          harga: 13500,
        },
      },
    ]);
  });

  it('offers no way to change a satuan after creation', () => {
    const catalog = createCatalog(async () => 'evt');

    expect(Object.keys(catalog).filter((name) => /varian/i.test(name))).toEqual(['createVarian']);
  });
});

function writer() {
  const drafts: EventDraft[] = [];
  return {
    drafts,
    append: async (type: string, payload: unknown) => {
      drafts.push({ type, payload });
      return `evt-${drafts.length}`;
    },
  };
}
