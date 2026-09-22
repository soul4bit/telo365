import { productPriceMinor } from './types.mjs';

const parse=value=>value?JSON.parse(value):[];
const rowProduct=row=>row&&({...row,storeId:row.store_id,externalProductId:row.external_product_id,packageAmount:row.package_amount,packageUnit:row.package_unit,priceMinor:row.price_minor,regularPriceMinor:row.regular_price_minor,loyaltyPriceMinor:row.loyalty_price_minor,promoPriceMinor:row.promo_price_minor,kcalPer100:row.kcal_per_100,proteinPer100:row.protein_per_100,fatPer100:row.fat_per_100,carbsPer100:row.carbs_per_100,productUrl:row.product_url,imageUrl:row.image_url,sourceUpdatedAt:row.source_updated,available:row.available===null?null:!!row.available,ingredients:parse(row.ingredients),allergens:parse(row.allergens)});

export function searchStoredProducts(db,{query='',chains=[],storeId,limit=30}={}) {
  const clauses=['1=1'],values=[];
  if(query){clauses.push('lower(name) LIKE ?');values.push(`%${query.toLocaleLowerCase('ru-RU')}%`);}
  if(chains.length){clauses.push(`chain IN (${chains.map(()=>'?').join(',')})`);values.push(...chains);}
  if(storeId){clauses.push('store_id=?');values.push(storeId);}
  values.push(Math.max(1,Math.min(100,Number(limit)||30)));
  return db.prepare(`SELECT * FROM store_products WHERE ${clauses.join(' AND ')} ORDER BY source_updated DESC,name LIMIT ?`).all(...values).map(rowProduct);
}
export function storedProduct(db,id) { return rowProduct(db.prepare('SELECT * FROM store_products WHERE id=?').get(id)); }
export function storedProductsForFoods(db,foodIds) {
  if(!foodIds.length)return new Map();
  const marks=foodIds.map(()=>'?').join(',');
  const rows=db.prepare(`SELECT p.*,f.canonical_food_id FROM store_products p JOIN store_product_foods f ON f.store_product_id=p.id WHERE f.canonical_food_id IN (${marks}) AND (p.available IS NULL OR p.available=1)`).all(...foodIds);
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
  const now=product.updatedAt||new Date().toISOString();
  db.prepare(`INSERT INTO store_products(id,provider,chain,store_id,external_product_id,ean,name,brand,category,package_amount,package_unit,price_minor,regular_price_minor,loyalty_price_minor,promo_price_minor,currency,kcal_per_100,protein_per_100,fat_per_100,carbs_per_100,ingredients,allergens,available,product_url,image_url,source_updated,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET provider=excluded.provider,chain=excluded.chain,store_id=excluded.store_id,external_product_id=excluded.external_product_id,ean=excluded.ean,name=excluded.name,brand=excluded.brand,category=excluded.category,package_amount=excluded.package_amount,package_unit=excluded.package_unit,price_minor=excluded.price_minor,regular_price_minor=excluded.regular_price_minor,loyalty_price_minor=excluded.loyalty_price_minor,promo_price_minor=excluded.promo_price_minor,currency=excluded.currency,kcal_per_100=excluded.kcal_per_100,protein_per_100=excluded.protein_per_100,fat_per_100=excluded.fat_per_100,carbs_per_100=excluded.carbs_per_100,ingredients=excluded.ingredients,allergens=excluded.allergens,available=excluded.available,product_url=excluded.product_url,image_url=excluded.image_url,source_updated=excluded.source_updated,updated=excluded.updated`).run(product.id,product.provider,product.chain,product.storeId??null,product.externalProductId??null,product.ean??null,product.name,product.brand??null,product.category??null,product.packageAmount??null,product.packageUnit??null,product.priceMinor??null,product.regularPriceMinor??null,product.loyaltyPriceMinor??null,product.promoPriceMinor??null,product.currency||'RUB',product.kcalPer100??null,product.proteinPer100??null,product.fatPer100??null,product.carbsPer100??null,JSON.stringify(product.ingredients||[]),JSON.stringify(product.allergens||[]),product.available===undefined?null:Number(!!product.available),product.productUrl??null,product.imageUrl??null,product.sourceUpdatedAt??null,product.createdAt||now,now);
  db.prepare('DELETE FROM store_product_foods WHERE store_product_id=?').run(product.id);
  const match=db.prepare('INSERT INTO store_product_foods(store_product_id,canonical_food_id,confidence) VALUES(?,?,?)');
  for(const foodId of product.canonicalFoodIds||[])match.run(product.id,foodId,1);
  return storedProduct(db,product.id);
}
