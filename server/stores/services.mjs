import { productPriceMinor } from './types.mjs';
import { canonicalFoods, searchStoredProducts, storedProduct, storedProductsForFoods } from './repository.mjs';

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
  constructor({db,providers=[],enableMock=false}) {this.db=db;this.providers=providers;this.enableMock=enableMock;}
  async search({query='',chains=[],storeId}={}) {
    const stored=searchStoredProducts(this.db,{query,chains,storeId});
    const mock=this.enableMock?this.providers.find(provider=>provider.id==='mock'):null;
    if(!mock)return {products:stored,isMock:false,configured:stored.length>0};
    const result=await mock.searchProducts({query,chains,storeId});
    return {products:[...stored,...result.products],isMock:true,configured:stored.length>0};
  }
  async product(id) {
    const stored=storedProduct(this.db,id);if(stored)return {product:stored,isMock:false};
    const mock=this.enableMock?this.providers.find(provider=>provider.id==='mock'):null;
    if(!mock)return {product:null,isMock:false};
    const result=await mock.getProduct({id});return {product:result.product,isMock:!!result.product};
  }
  estimate(requirements,preferences={}) {
    const productsByFood=storedProductsForFoods(this.db,requirements.map(item=>item.canonicalFoodId));
    return optimizeShoppingList({requirements,productsByFood,preferences});
  }
  canonicalFoods(ids) { return canonicalFoods(this.db,ids); }
}
