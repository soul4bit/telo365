import { productPriceMinor } from './types.mjs';
import { canonicalFoods, finishStoreSync, latestStoreSyncs, searchStoredProducts, startStoreSync, storeLocations, storedProduct, storedProductsForFoods, upsertStoreLocation, upsertStoredProduct } from './repository.mjs';

const priceRank={lowest_price:0,balanced:1,familiar:2,no_preference:3};
export function consumedCostMinor(product,amount) {
  const price=productPriceMinor(product);
  if(price===null||!Number.isInteger(product.packageAmount)||product.packageAmount<=0||!Number.isFinite(amount)||amount<0)return null;
  return Math.round(price*amount/product.packageAmount);
}
export function purchaseCostMinor(product) { const price=productPriceMinor(product);return Number.isInteger(price)&&price>=0?price:null; }
export function chooseStoreProduct(products,{shoppingPriority='no_preference',preferredStores=[],usedProductIds=[]}={}) {
  const ready=products.filter(product=>purchaseCostMinor(product)!==null);
  if(!ready.length)return null;
  const preferred=new Set(preferredStores),used=new Set(usedProductIds);
  return [...ready].sort((a,b)=>{
    const price=purchaseCostMinor(a)-purchaseCostMinor(b);
    const familiar=(used.has(b.id)?1:0)-(used.has(a.id)?1:0);
    const chain=(preferred.has(b.chain)?1:0)-(preferred.has(a.chain)?1:0);
    if(shoppingPriority==='lowest_price')return price||chain||a.name.localeCompare(b.name,'ru');
    if(shoppingPriority==='familiar')return familiar||chain||price||a.name.localeCompare(b.name,'ru');
    if(shoppingPriority==='balanced')return chain||price||a.name.localeCompare(b.name,'ru');
    return chain||price||a.name.localeCompare(b.name,'ru');
  })[0];
}
export function optimizeShoppingList({requirements,productsByFood,preferences={}}) {
  const items=[];
  for(const requirement of requirements){
    const product=chooseStoreProduct(productsByFood.get(requirement.canonicalFoodId)||[],preferences);
    if(!product){items.push({...requirement,product:null,packagesRequired:null,totalPurchaseAmount:null,estimatedCostMinor:null,unusedAmount:null,consumedCostMinor:null});continue;}
    const packagesRequired=Math.ceil(requirement.requiredAmount/product.packageAmount);
    items.push({...requirement,product,packageAmount:product.packageAmount,packageUnit:product.packageUnit,packagesRequired,totalPurchaseAmount:packagesRequired*product.packageAmount,estimatedCostMinor:packagesRequired*purchaseCostMinor(product),unusedAmount:packagesRequired*product.packageAmount-requirement.requiredAmount,consumedCostMinor:consumedCostMinor(product,requirement.requiredAmount)});
  }
  return {items,estimatedCostMinor:items.reduce((sum,item)=>sum+(item.estimatedCostMinor||0),0),complete:items.every(item=>item.product)};
}
export function aggregateIngredients(meals=[]) {
  const totals=new Map();
  for(const meal of meals)for(const ingredient of meal.ingredients||[]){
    const amount=Number(ingredient.grams??ingredient.amount)*Number(meal.servings??1);
    if(!ingredient.foodId||!Number.isFinite(amount)||amount<=0)continue;
    const old=totals.get(ingredient.foodId)||{canonicalFoodId:ingredient.foodId,requiredAmount:0,unit:'g'};
    old.requiredAmount+=amount;totals.set(ingredient.foodId,old);
  }
  return [...totals.values()].map(item=>({...item,requiredAmount:Math.round(item.requiredAmount*10)/10}));
}
export class StoreCatalog {
  constructor({db,providers=[],enableMock=false,production=false}) {this.db=db;this.providers=providers;this.enableMock=enableMock;this.production=production;}
  async search({query='',chains=[],storeId}={}) {
    const stored=searchStoredProducts(this.db,{query,chains,storeId,excludeMock:this.production});
    const mock=this.enableMock?this.providers.find(provider=>provider.id==='mock'):null;
    if(!mock)return {products:stored,isMock:false,configured:stored.length>0};
    const result=await mock.searchProducts({query,chains,storeId});
    return {products:[...stored,...result.products],isMock:true,configured:stored.length>0};
  }
  async product(id) {
    const stored=storedProduct(this.db,id);if(stored&&(!this.production||stored.provider!=='mock'))return {product:stored,isMock:false};
    const mock=this.enableMock?this.providers.find(provider=>provider.id==='mock'):null;
    if(!mock)return {product:null,isMock:false};
    const result=await mock.getProduct({id});return {product:result.product,isMock:!!result.product};
  }
  estimate(requirements,preferences={}) {
    const productsByFood=storedProductsForFoods(this.db,requirements.map(item=>item.canonicalFoodId),{excludeMock:this.production});
    return optimizeShoppingList({requirements,productsByFood,preferences});
  }
  canonicalFoods(ids) { return canonicalFoods(this.db,ids); }
  locations(filters) { return storeLocations(this.db,filters).filter(store=>!this.production||store.provider!=='mock'); }
  syncHistory() { return latestStoreSyncs(this.db); }
  async sync(providerId,{chain,storeId}={}) {
    const provider=this.providers.find(item=>item.id===providerId);
    if(!provider)return {status:'unknown_provider',provider:providerId,productsSeen:0,productsUpdated:0};
    const run=startStoreSync(this.db,{provider:provider.id,chain,storeId});
    try {
      const result=await provider.sync({chain,storeId});
      if(result.status!=='ready') {
        finishStoreSync(this.db,run.id,{status:result.status||'unavailable',errorCode:result.errorCode});
        return {status:result.status||'unavailable',provider:provider.id,runId:run.id,productsSeen:0,productsUpdated:0};
      }
      let productsUpdated=0;
      for(const location of result.stores||[])upsertStoreLocation(this.db,{...location,provider:location.provider||provider.id,chain:location.chain||chain||provider.chains[0]});
      for(const incoming of result.products||[]) {
        if(!incoming.id||!incoming.name||!incoming.chain||!provider.chains.includes(incoming.chain))continue;
        upsertStoredProduct(this.db,{...incoming,provider:provider.id,syncRunId:run.id,priceFetchedAt:incoming.priceFetchedAt||new Date().toISOString(),priceSourceUrl:incoming.priceSourceUrl||result.sourceUrl||null});
        productsUpdated++;
      }
      finishStoreSync(this.db,run.id,{status:'ready',productsSeen:(result.products||[]).length,productsUpdated});
      return {status:'ready',provider:provider.id,runId:run.id,productsSeen:(result.products||[]).length,productsUpdated};
    } catch(error) {
      finishStoreSync(this.db,run.id,{status:'failed',errorCode:error?.code||'SYNC_FAILED'});
      return {status:'failed',provider:provider.id,runId:run.id,productsSeen:0,productsUpdated:0};
    }
  }
}
