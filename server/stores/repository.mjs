import { productPriceMinor, productPriceType } from './types.mjs';
import { randomUUID } from 'node:crypto';

const parse=value=>value?JSON.parse(value):[];
const rowProduct=row=>{if(!row)return null;const product={...row,storeId:row.store_id,externalProductId:row.external_product_id,packageAmount:row.package_amount,packageUnit:row.package_unit,priceMinor:row.price_minor,regularPriceMinor:row.regular_price_minor,loyaltyPriceMinor:row.loyalty_price_minor,promoPriceMinor:row.promo_price_minor,kcalPer100:row.kcal_per_100,proteinPer100:row.protein_per_100,fatPer100:row.fat_per_100,carbsPer100:row.carbs_per_100,productUrl:row.product_url,imageUrl:row.image_url,sourceUpdatedAt:row.source_updated,available:row.available===null?null:!!row.available,ingredients:parse(row.ingredients),allergens:parse(row.allergens)};const priceMinor=productPriceMinor(product),priceType=row.price_type||productPriceType(product);return {...product,priceProvenance:priceMinor===null?null:{priceMinor,priceType,currency:row.currency,storeId:product.storeId,sourceUrl:row.price_source_url||product.productUrl||null,sourceUpdatedAt:row.price_observed_at||row.source_updated||null,fetchedAt:row.price_fetched_at||null}};};

export function searchStoredProducts(db,{query='',chains=[],storeId,limit=30,excludeMock=false}={}) {
  const clauses=['1=1'],values=[];
  if(query){clauses.push('lower(name) LIKE ?');values.push(`%${query.toLocaleLowerCase('ru-RU')}%`);}
  if(chains.length){clauses.push(`chain IN (${chains.map(()=>'?').join(',')})`);values.push(...chains);}
  if(storeId){clauses.push('store_id=?');values.push(storeId);}
  if(excludeMock)clauses.push("provider<>'mock'");
  values.push(Math.max(1,Math.min(100,Number(limit)||30)));
  return db.prepare(`SELECT * FROM store_products WHERE ${clauses.join(' AND ')} ORDER BY source_updated DESC,name LIMIT ?`).all(...values).map(rowProduct);
}
export function storedProduct(db,id) { return rowProduct(db.prepare('SELECT * FROM store_products WHERE id=?').get(id)); }
export function storedProductsForFoods(db,foodIds,{excludeMock=false}={}) {
  if(!foodIds.length)return new Map();
  const marks=foodIds.map(()=>'?').join(',');
  const rows=db.prepare(`SELECT p.*,f.canonical_food_id FROM store_products p JOIN store_product_foods f ON f.store_product_id=p.id WHERE f.canonical_food_id IN (${marks}) AND (p.available IS NULL OR p.available=1)${excludeMock?" AND p.provider<>'mock'":''}`).all(...foodIds);
  const result=new Map(foodIds.map(id=>[id,[]]));
  for(const row of rows){const product=rowProduct(row);if(productPriceMinor(product)!==null)result.get(row.canonical_food_id).push(product);}
  return result;
}
export function canonicalFoods(db,ids) {
  if(!ids.length)return [];
  const marks=ids.map(()=>'?').join(',');
  return db.prepare(`SELECT id,name,category FROM canonical_foods WHERE id IN (${marks})`).all(...ids);
}
export function upsertStoredProduct(db,product) {
  const now=product.updatedAt||new Date().toISOString(),priceType=product.priceType||productPriceType(product),priceMinor=productPriceMinor(product),priceFetchedAt=product.priceFetchedAt||now;
  db.prepare(`INSERT INTO store_products(id,provider,chain,store_id,external_product_id,ean,name,brand,category,package_amount,package_unit,price_minor,regular_price_minor,loyalty_price_minor,promo_price_minor,currency,kcal_per_100,protein_per_100,fat_per_100,carbs_per_100,ingredients,allergens,available,product_url,image_url,source_updated,price_type,price_source_url,price_observed_at,price_fetched_at,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,chain=excluded.chain,store_id=excluded.store_id,external_product_id=excluded.external_product_id,ean=excluded.ean,name=excluded.name,brand=excluded.brand,category=excluded.category,package_amount=excluded.package_amount,package_unit=excluded.package_unit,price_minor=excluded.price_minor,regular_price_minor=excluded.regular_price_minor,loyalty_price_minor=excluded.loyalty_price_minor,promo_price_minor=excluded.promo_price_minor,currency=excluded.currency,kcal_per_100=excluded.kcal_per_100,protein_per_100=excluded.protein_per_100,fat_per_100=excluded.fat_per_100,carbs_per_100=excluded.carbs_per_100,ingredients=excluded.ingredients,allergens=excluded.allergens,available=excluded.available,product_url=excluded.product_url,image_url=excluded.image_url,source_updated=excluded.source_updated,price_type=excluded.price_type,price_source_url=excluded.price_source_url,price_observed_at=excluded.price_observed_at,price_fetched_at=excluded.price_fetched_at,updated=excluded.updated`).run(product.id,product.provider,product.chain,product.storeId??null,product.externalProductId??null,product.ean??null,product.name,product.brand??null,product.category??null,product.packageAmount??null,product.packageUnit??null,product.priceMinor??null,product.regularPriceMinor??null,product.loyaltyPriceMinor??null,product.promoPriceMinor??null,product.currency||'RUB',product.kcalPer100??null,product.proteinPer100??null,product.fatPer100??null,product.carbsPer100??null,JSON.stringify(product.ingredients||[]),JSON.stringify(product.allergens||[]),product.available===undefined?null:Number(!!product.available),product.productUrl??null,product.imageUrl??null,product.sourceUpdatedAt??null,priceType,product.priceSourceUrl??product.productUrl??null,product.priceObservedAt??product.sourceUpdatedAt??null,priceFetchedAt,product.createdAt||now,now);
  db.prepare('DELETE FROM store_product_foods WHERE store_product_id=?').run(product.id);
  const match=db.prepare('INSERT INTO store_product_foods(store_product_id,canonical_food_id,confidence) VALUES(?,?,?)');
  for(const foodId of product.canonicalFoodIds||[])match.run(product.id,foodId,1);
  if(priceMinor!==null&&priceType)db.prepare('INSERT INTO store_price_observations(store_product_id,sync_run_id,price_type,price_minor,currency,source_url,source_updated,observed_at,fetched_at) VALUES(?,?,?,?,?,?,?,?,?)').run(product.id,product.syncRunId??null,priceType,priceMinor,product.currency||'RUB',product.priceSourceUrl??product.productUrl??null,product.sourceUpdatedAt??null,product.priceObservedAt??product.sourceUpdatedAt??null,priceFetchedAt);
  return storedProduct(db,product.id);
}

export function upsertStoreLocation(db,location) {
  const now=location.updatedAt||new Date().toISOString();
  db.prepare(`INSERT INTO store_locations(id,provider,chain,external_store_id,name,city,region,address,timezone,source_url,source_updated,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,chain=excluded.chain,external_store_id=excluded.external_store_id,name=excluded.name,city=excluded.city,region=excluded.region,address=excluded.address,timezone=excluded.timezone,source_url=excluded.source_url,source_updated=excluded.source_updated,updated=excluded.updated`).run(location.id,location.provider,location.chain,location.externalStoreId??null,location.name,location.city??null,location.region??null,location.address??null,location.timezone??null,location.sourceUrl??null,location.sourceUpdatedAt??null,now);
  return db.prepare('SELECT * FROM store_locations WHERE id=?').get(location.id);
}

export function startStoreSync(db,{provider,chain,storeId,sourceUrl}={}) {
  const id=randomUUID(),started=new Date().toISOString();
  db.prepare('INSERT INTO store_sync_runs(id,provider,chain,store_id,status,source_url,started) VALUES(?,?,?,?,?,?,?)').run(id,provider,chain??null,storeId??null,'running',sourceUrl??null,started);
  return {id,started};
}

export function finishStoreSync(db,id,{status,productsSeen=0,productsUpdated=0,errorCode}={}) {
  const finished=new Date().toISOString();
  db.prepare('UPDATE store_sync_runs SET status=?,finished=?,products_seen=?,products_updated=?,error_code=? WHERE id=?').run(status,finished,productsSeen,productsUpdated,errorCode??null,id);
  return db.prepare('SELECT * FROM store_sync_runs WHERE id=?').get(id);
}

export function latestStoreSyncs(db) { return db.prepare('SELECT * FROM store_sync_runs ORDER BY started DESC LIMIT 50').all(); }
export function storeLocations(db,{chains=[]}={}) { const values=[];let where='';if(chains.length){where=`WHERE chain IN (${chains.map(()=>'?').join(',')})`;values.push(...chains);}return db.prepare(`SELECT * FROM store_locations ${where} ORDER BY chain,city,name`).all(...values); }
