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

    // Archiving and restoring a varian are not edits to it: they flip a flag.
    // Nothing here can rewrite the satuan, the price's unit, or the jualBy.
    expect(Object.keys(catalog).filter((name) => /satuan|updateVarian/i.test(name))).toEqual([]);
    expect(Object.keys(catalog).filter((name) => /varian/i.test(name))).toEqual([
      'createVarian',
      'archiveVarian',
      'restoreVarian',
    ]);
  });
});

describe('editing master data', () => {
  it('renames a kategori as a stamped field, leaving its produk alone', async () => {
    const { drafts, append } = writer();

    await createCatalog(append).updateKategori('kat-1', { nama: '  Sembako ' });

    expect(drafts).toEqual([
      {
        type: 'kategori.updated',
        payload: { kategoriId: 'kat-1', nama: { value: 'Sembako', at: expect.any(String) } },
      },
    ]);
  });

  it('refuses to rename a kategori to nothing', async () => {
    const { drafts, append } = writer();

    await expect(createCatalog(append).updateKategori('kat-1', { nama: '  ' })).rejects.toBeInstanceOf(CatalogError);
    expect(drafts).toEqual([]);
  });

  it('archives a kategori as a fact in the log, never a deletion', async () => {
    const { drafts, append } = writer();

    await createCatalog(append).archiveKategori('kat-1');

    expect(drafts).toEqual([{ type: 'kategori.archived', payload: { kategoriId: 'kat-1', archived: true } }]);
  });

  it('moves a produk to another kategori as one stamped field', async () => {
    const { drafts, append } = writer();

    await createCatalog(append).updateProduk('prd-1', { kategoriId: 'kat-2' });

    expect(drafts).toEqual([
      {
        type: 'produk.updated',
        payload: { produkId: 'prd-1', kategoriId: { value: 'kat-2', at: expect.any(String) } },
      },
    ]);
  });

  it('renames a produk without moving it', async () => {
    const { drafts, append } = writer();

    await createCatalog(append).updateProduk('prd-1', { nama: ' Tepung sagu ' });

    expect(drafts).toEqual([
      {
        type: 'produk.updated',
        payload: { produkId: 'prd-1', nama: { value: 'Tepung sagu', at: expect.any(String) } },
      },
    ]);
  });

  it('archives a produk as a fact in the log, never a deletion', async () => {
    const { drafts, append } = writer();

    await createCatalog(append).archiveProduk('prd-1');

    expect(drafts).toEqual([{ type: 'produk.archived', payload: { produkId: 'prd-1', archived: true } }]);
  });

  it('archives a varian as its own fact, so the log keeps it', async () => {
    const { drafts, append } = writer();

    await createCatalog(append).archiveVarian('var-1');

    expect(drafts).toEqual([{ type: 'varian.archived', payload: { varianId: 'var-1', archived: true } }]);
  });
});

describe('restoring master data', () => {
  it('restores a kategori by writing the same fact with archived false', async () => {
    const { drafts, append } = writer();

    await createCatalog(append).restoreKategori('kat-1');

    expect(drafts).toEqual([{ type: 'kategori.archived', payload: { kategoriId: 'kat-1', archived: false } }]);
  });

  it('restores a produk by writing the same fact with archived false', async () => {
    const { drafts, append } = writer();

    await createCatalog(append).restoreProduk('prd-1');

    expect(drafts).toEqual([{ type: 'produk.archived', payload: { produkId: 'prd-1', archived: false } }]);
  });

  it('restores a varian by writing the same fact with archived false', async () => {
    const { drafts, append } = writer();

    await createCatalog(append).restoreVarian('var-1');

    expect(drafts).toEqual([{ type: 'varian.archived', payload: { varianId: 'var-1', archived: false } }]);
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
