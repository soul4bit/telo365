import { fail, numeric, string } from '../security.mjs';
import { normalizeShoppingPriority, STORE_CHAINS, STORE_CHAIN_SLUGS, SHOPPING_PRIORITIES } from './types.mjs';
import { aggregateIngredients } from './services.mjs';

const preferenceFor=(db,userId)=>{const row=db.prepare('SELECT * FROM food_preferences WHERE user_id=?').get(userId);return row?{preferredStores:JSON.parse(row.preferred_store_chains),shoppingPriority:normalizeShoppingPriority(row.shopping_priority),budgetMinor:row.food_budget_unlimited?null:row.weekly_food_budget_minor}:{};};
const chainValues=value=>{if(value===undefined)return [];if(typeof value==='string')value=value.split(',').filter(Boolean);if(!Array.isArray(value)||value.some(item=>typeof item!=='string'||![...STORE_CHAIN_SLUGS,'custom'].includes(item)))fail(400,'Проверьте магазины');return [...new Set(value)];};
const requirements=value=>{if(!Array.isArray(value)||value.length<1||value.length>100)fail(400,'Проверьте продукты');return value.map(item=>({canonicalFoodId:string(item?.canonicalFoodId,'Продукт',80),requiredAmount:numeric(item?.requiredAmount,'Количество',0.01,1000000),unit:item?.unit==='ml'?'ml':'g'}));};
export async function stores(ctx) {
  const {path,method,url,body,storeCatalog,db,user}=ctx;
  if(!path.startsWith('/api/stores')&&!path.startsWith('/api/store-products')&&path!=='/api/nutrition/estimate-cost'&&path!=='/api/nutrition/shopping-list')return null;
  if(method==='GET'&&path==='/api/stores/chains'){const stores=storeCatalog.locations();const configured=new Set(stores.map(store=>store.chain));return {chains:STORE_CHAINS.map(chain=>({...chain,configured:configured.has(chain.slug)}))};}
  if(method==='GET'&&path==='/api/stores'){const chains=chainValues(url.searchParams.get('chains')||undefined),stores=storeCatalog.locations({chains});return {stores,configured:stores.length>0};}
  if(method==='GET'&&path==='/api/store-products/search'){
    const query=(url.searchParams.get('q')||'').trim().slice(0,120),chains=chainValues(url.searchParams.get('chains')||undefined),result=await storeCatalog.search({query,chains,storeId:url.searchParams.get('storeId')||undefined});
    return {products:result.products,isMock:result.isMock,configured:result.configured};
  }
  const id=path.match(/^\/api\/store-products\/([^/]+)$/)?.[1];
  if(id&&method==='GET'){const result=await storeCatalog.product(decodeURIComponent(id));if(!result.product)fail(404,'Товар не найден');return result;}
  if((path==='/api/nutrition/estimate-cost'||path==='/api/nutrition/shopping-list')&&method==='POST'){
    const list=requirements(body.requirements),preferences=preferenceFor(db,user.id),priority=normalizeShoppingPriority(body.shoppingPriority===undefined?preferences.shoppingPriority:body.shoppingPriority);
    if(!SHOPPING_PRIORITIES.includes(priority))fail(400,'Проверьте приоритет');
    const result=storeCatalog.estimate(list,{...preferences,shoppingPriority:priority,preferredStores:chainValues(body.preferredStores??preferences.preferredStores)});
    return {available:result.complete,reason:result.complete?null:'not_configured',...result,budgetMinor:preferences.budgetMinor};
  }
  fail(404,'Метод не найден');
}

export { aggregateIngredients };
