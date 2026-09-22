import { StoreProvider } from './types.mjs';

export class NotConfiguredStoreProvider extends StoreProvider {
  constructor(id,chains) { super({id,chains}); }
}

export class PyaterochkaProvider extends NotConfiguredStoreProvider { constructor() { super('pyaterochka',['pyaterochka']); } }
export class MagnitProvider extends NotConfiguredStoreProvider { constructor() { super('magnit',['magnit']); } }
export class PerekrestokProvider extends NotConfiguredStoreProvider { constructor() { super('perekrestok',['perekrestok']); } }

// This adapter is intentionally local-only. Its products are tagged isMock and are
// never enabled for a production application.
export class MockStoreProvider extends StoreProvider {
  constructor() { super({id:'mock',chains:['mock']}); }
  async getStores() { return {status:'ready',stores:[{id:'mock-moscow',chain:'mock',name:'Локальный учебный каталог',city:'Москва',isMock:true}]}; }
  async searchProducts({query=''}) {
    const products=[
      {id:'mock-oats-450',provider:'mock',chain:'mock',storeId:'mock-moscow',externalProductId:'oats-450',name:'Овсяные хлопья, 450 г',brand:'Учебный каталог',category:'крупы',packageAmount:450,packageUnit:'g',priceMinor:8990,currency:'RUB',kcalPer100:370,proteinPer100:13,fatPer100:7,carbsPer100:60,available:true,sourceUpdatedAt:'2026-09-22T00:00:00.000Z',isMock:true,canonicalFoodIds:['oats']},
      {id:'mock-buckwheat-900',provider:'mock',chain:'mock',storeId:'mock-moscow',externalProductId:'buckwheat-900',name:'Гречка, 900 г',brand:'Учебный каталог',category:'крупы',packageAmount:900,packageUnit:'g',priceMinor:13500,currency:'RUB',kcalPer100:330,proteinPer100:12.6,fatPer100:3.3,carbsPer100:62,available:true,sourceUpdatedAt:'2026-09-22T00:00:00.000Z',isMock:true,canonicalFoodIds:['buckwheat']},
      {id:'mock-chicken-500',provider:'mock',chain:'mock',storeId:'mock-moscow',externalProductId:'chicken-500',name:'Филе куриной грудки, 500 г',brand:'Учебный каталог',category:'мясо и птица',packageAmount:500,packageUnit:'g',priceMinor:27900,currency:'RUB',kcalPer100:113,proteinPer100:23.6,fatPer100:1.9,carbsPer100:0,available:true,sourceUpdatedAt:'2026-09-22T00:00:00.000Z',isMock:true,canonicalFoodIds:['chicken']},
      {id:'mock-milk-930',provider:'mock',chain:'mock',storeId:'mock-moscow',externalProductId:'milk-930',name:'Молоко, 930 мл',brand:'Учебный каталог',category:'молочные продукты',packageAmount:930,packageUnit:'ml',priceMinor:10900,currency:'RUB',kcalPer100:52,proteinPer100:3,fatPer100:2.5,carbsPer100:4.7,available:true,sourceUpdatedAt:'2026-09-22T00:00:00.000Z',isMock:true,canonicalFoodIds:['milk']}
    ];
    const needle=String(query).trim().toLocaleLowerCase('ru-RU');
    return {status:'ready',products:needle?products.filter(product=>product.name.toLocaleLowerCase('ru-RU').includes(needle)):products};
  }
  async getProduct({id}) { const {products}=await this.searchProducts({});return {status:'ready',product:products.find(product=>product.id===id)||null}; }
}

export function providerRegistry({enableMock=false}={}) {
  const providers=[
    new PyaterochkaProvider(),new MagnitProvider(),new PerekrestokProvider()
  ];
  if(enableMock)providers.push(new MockStoreProvider());
  return providers;
}
