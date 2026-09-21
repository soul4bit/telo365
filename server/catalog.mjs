import { randomUUID } from 'node:crypto';
import { fail, string, numeric } from './security.mjs';

export function readCatalog(db, userId, includeArchived=false) {
  return db.prepare(`SELECT * FROM catalog WHERE (owner IS NULL OR owner=?) ${includeArchived?'':'AND archived=0'}`).all(userId).map(r=>({...JSON.parse(r.data),id:r.id,kind:r.kind,owner:r.owner,archived:!!r.archived}));
}
export function getItem(db,id,userId,kind) {
  const row=db.prepare('SELECT * FROM catalog WHERE id=? AND (owner IS NULL OR owner=?) AND archived=0').get(id,userId);
  if (!row || (kind && row.kind!==kind)) fail(404,'Запись каталога не найдена');
  return {...JSON.parse(row.data),id:row.id,kind:row.kind};
}
export function mealSnapshot(db,id,userId) {
  const item=getItem(db,id,userId);
  if (!['food','recipe'].includes(item.kind)) fail(400,'Выберите продукт или рецепт');
  const ingredients=item.kind==='food'?[{foodId:item.id,grams:100}]:item.ingredients;
  const resolved=ingredients.map(i=>({...getItem(db,i.foodId,userId,'food'),grams:i.grams}));
  const totals={kcal:0,p:0,f:0,c:0};
  for(const i of resolved) for(const key of Object.keys(totals)) totals[key]+=i[key]*i.grams/100;
  return {catalogId:item.id,name:item.name,image:item.image||'lunch',instructions:item.instructions||'',...totals,ingredients:resolved.map(i=>({foodId:i.id,name:i.name,grams:i.grams,source:i.source})),sample:resolved.some(i=>i.sample)};
}
export function validateItem(db,kind,body,userId) {
  const name=string(body.name,'Название',120);
  if(kind==='food') return {name,...Object.fromEntries(['kcal','p','f','c'].map(k=>[k,numeric(body[k],k,0,k==='kcal'?1000:100)])),source:string(body.source,'Источник пищевой ценности',500),sample:false};
  if(kind==='recipe') {
    if(!Array.isArray(body.ingredients)||!body.ingredients.length||body.ingredients.length>30) fail(400,'Укажите от 1 до 30 ингредиентов');
    const ingredients=body.ingredients.map(i=>{ if(!i||typeof i!=='object')fail(400,'Проверьте ингредиенты');const food=getItem(db,string(i.foodId,'Продукт'),userId,'food');return {foodId:food.id,grams:numeric(i.grams,'Граммы',1,10000)}; });
    return {name,instructions:string(body.instructions,'Приготовление',4000),image:['breakfast','lunch','dinner','snack'].includes(body.image)?body.image:'lunch',ingredients};
  }
  if(kind==='exercise') return {name,muscle:string(body.muscle,'Группа мышц',100),description:string(body.description,'Описание',4000),unit:body.unit==='seconds'?'seconds':'reps'};
  if(kind==='program') {
    if(!Array.isArray(body.exercises)||!body.exercises.length||body.exercises.length>20) fail(400,'Укажите от 1 до 20 упражнений');
    return {name,description:string(body.description,'Описание',4000),minutes:numeric(body.minutes,'Минуты',1,600),exercises:body.exercises.map(e=>{if(!e||typeof e!=='object')fail(400,'Проверьте упражнения');const sets=numeric(e.sets,'Подходы',1,20);if(!Number.isInteger(sets))fail(400,'Число подходов должно быть целым');return {exerciseId:getItem(db,string(e.exerciseId,'Упражнение'),userId,'exercise').id,sets,reps:numeric(e.reps,'Повторения',1,600),weight:numeric(e.weight??0,'Нагрузка',0,500)};})};
  }
  fail(400,'Неизвестный тип каталога');
}
export function saveItem(db,kind,body,user,shared=false,id=randomUUID()) {
  const data=validateItem(db,kind,body,user.id);
  if(shared) {
    const refs=kind==='recipe'?data.ingredients.map(i=>i.foodId):kind==='program'?data.exercises.map(i=>i.exerciseId):[];
    for(const ref of refs) if(db.prepare('SELECT owner FROM catalog WHERE id=?').get(ref)?.owner) fail(400,'Общий каталог может ссылаться только на общие записи');
  }
  db.prepare('INSERT INTO catalog(id,kind,owner,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(id,kind,shared?null:user.id,JSON.stringify(data));
  return id;
}
