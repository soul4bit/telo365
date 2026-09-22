import assert from 'node:assert/strict';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { upsertStoredProduct, storedProductsForFoods } from './stores/repository.mjs';
import { aggregateIngredients, chooseStoreProduct, consumedCostMinor, optimizeShoppingList, purchaseCostMinor } from './stores/services.mjs';
import { createStoreCatalog } from './stores/catalog.mjs';

test('store catalog keeps canonical food, package and money semantics separate',()=>{
  const db=openDatabase(':memory:'),now='2026-09-22T10:20:00.000Z';
  const buckwheat=upsertStoredProduct(db,{id:'test-buckwheat-900',provider:'fixture',chain:'pyaterochka',storeId:'msk-1',externalProductId:'buckwheat-900',name:'Гречка 900 г',packageAmount:900,packageUnit:'g',priceMinor:13500,currency:'RUB',available:true,sourceUpdatedAt:now,canonicalFoodIds:['buckwheat']});
  const cheaper=upsertStoredProduct(db,{id:'test-buckwheat-800',provider:'fixture',chain:'magnit',storeId:'msk-2',externalProductId:'buckwheat-800',name:'Гречка 800 г',packageAmount:800,packageUnit:'g',priceMinor:11900,currency:'RUB',available:true,sourceUpdatedAt:now,canonicalFoodIds:['buckwheat']});
  assert.equal(consumedCostMinor(buckwheat,100),1500);
  assert.equal(purchaseCostMinor(buckwheat),13500);
  const candidates=storedProductsForFoods(db,['buckwheat']).get('buckwheat');
  assert.equal(chooseStoreProduct(candidates,{shoppingPriority:'cheapest'}).id,cheaper.id);
  const optimized=optimizeShoppingList({requirements:[{canonicalFoodId:'buckwheat',requiredAmount:1700,unit:'g'}],productsByFood:new Map([['buckwheat',[buckwheat]]]),preferences:{shoppingPriority:'cheapest'}});
  assert.equal(optimized.items[0].packagesRequired,2);assert.equal(optimized.items[0].totalPurchaseAmount,1800);assert.equal(optimized.items[0].unusedAmount,100);assert.equal(optimized.items[0].estimatedCostMinor,27000);assert.equal(optimized.items[0].consumedCostMinor,25500);
  assert.deepEqual(aggregateIngredients([{servings:1,ingredients:[{foodId:'buckwheat',grams:80}]},{servings:1.5,ingredients:[{foodId:'buckwheat',grams:100}]}]),[{canonicalFoodId:'buckwheat',requiredAmount:230,unit:'g'}]);
  db.close();
});

test('mock products are absent from a production store catalog',async()=>{
  const db=openDatabase(':memory:'),development=createStoreCatalog({db,production:false,enableMock:true}),production=createStoreCatalog({db,production:true});
  assert.equal((await development.search({query:'гречка'})).products[0].isMock,true);
  assert.deepEqual((await production.search({query:'гречка'})).products,[]);
  db.close();
});

test('store sync records price provenance, location and a non-configured provider safely',async()=>{
  const db=openDatabase(':memory:'),catalog=createStoreCatalog({db,production:false,enableMock:true});
  const synced=await catalog.sync('mock');
  assert.equal(synced.status,'ready');assert.equal(synced.productsSeen,4);assert.equal(synced.productsUpdated,4);
  const product=(await catalog.product('mock-oats-450')).product;
  assert.deepEqual(product.priceProvenance,{priceMinor:8990,priceType:'current',currency:'RUB',storeId:'mock-moscow',sourceUrl:'local://mock-store-catalog',sourceUpdatedAt:'2026-09-22T00:00:00.000Z',fetchedAt:product.priceProvenance.fetchedAt});
  assert.equal(catalog.locations()[0].city,'Москва');assert.equal(catalog.syncHistory()[0].status,'ready');
  const production=createStoreCatalog({db,production:true}),unavailable=await production.sync('pyaterochka');
  assert.equal(unavailable.status,'not_configured');assert.equal(unavailable.productsUpdated,0);
  assert.equal((await production.product('mock-oats-450')).product,null);assert.equal(production.estimate([{canonicalFoodId:'oats',requiredAmount:100,unit:'g'}]).complete,false);
  db.close();
});
