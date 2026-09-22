import { providerRegistry } from './adapters.mjs';
import { StoreCatalog } from './services.mjs';

export function createStoreCatalog({db,production=false,enableMock}={}) {
  const useMock=!production&&(enableMock??process.env.TELO_STORE_CATALOG==='mock');
  return new StoreCatalog({db,providers:providerRegistry({enableMock:useMock}),enableMock:useMock});
}
