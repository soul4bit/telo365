import { randomUUID } from 'node:crypto';
import { transaction } from './database.mjs';
import { profile } from './accounts.mjs';
import { boolean, date, digest, fail, numeric, string, today } from './security.mjs';
import { getItem, mealSnapshot, readCatalog, saveItem } from './catalog.mjs';

const parseMeal=r=>({...r,snapshot:JSON.parse(r.snapshot),eaten:!!r.eaten});
const parseWorkout=r=>({...r,data:JSON.parse(r.data),finished:!!r.finished});
function limitCount(db,table,user,max) { if(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id=?`).get(user).n>=max) fail(409,'Достигнут лимит записей. Удалите ненужные записи'); }
function owned(db,table,id,user) { const row=db.prepare(`SELECT * FROM ${table} WHERE id=? AND user_id=?`).get(id,user);if(!row) fail(404,'Запись не найдена');return row; }
export function state(db,user,day) {
  const selected=date(day||today(user.timezone));
  const catalog=readCatalog(db,user.id);
  return {
    user:profile(user),today:today(user.timezone),date:selected,
    weights:db.prepare('SELECT date,value FROM weights WHERE user_id=? ORDER BY date').all(user.id),
    habits:db.prepare('SELECT id,name,archived FROM habits WHERE user_id=? AND archived=0').all(user.id),
    marks:db.prepare('SELECT habit_id,date,done FROM marks WHERE user_id=? AND date>=date(?,\'-90 days\') AND date<=?').all(user.id,selected,selected),
    meals:db.prepare('SELECT * FROM meals WHERE user_id=? AND date=? ORDER BY rowid').all(user.id,selected).map(parseMeal),
    workouts:db.prepare('SELECT * FROM workouts WHERE user_id=? ORDER BY date DESC,rowid DESC LIMIT 100').all(user.id).map(parseWorkout),
    shopping:db.prepare('SELECT id,name,amount,unit,checked,generated FROM shopping WHERE user_id=? ORDER BY generated DESC,name').all(user.id),
    catalog:catalog.map(i=>i.kind==='recipe'?{...i,nutrition:mealSnapshot(db,i.id,user.id)}:i),
  };
}

export function journal(ctx) {
  const {db,user:u,body:b,path,method,url}=ctx;
  if(!u) fail(401,'Войдите в аккаунт');
  if(method==='GET'&&path==='/api/state') return state(db,u,url.searchParams.get('date'));
  if(method==='GET'&&path==='/api/export') {
    return {profile:profile(u),weights:db.prepare('SELECT date,value FROM weights WHERE user_id=?').all(u.id),habits:db.prepare('SELECT * FROM habits WHERE user_id=?').all(u.id),marks:db.prepare('SELECT habit_id,date,done FROM marks WHERE user_id=?').all(u.id),meals:db.prepare('SELECT * FROM meals WHERE user_id=?').all(u.id).map(parseMeal),workouts:db.prepare('SELECT * FROM workouts WHERE user_id=?').all(u.id).map(parseWorkout),shopping:db.prepare('SELECT * FROM shopping WHERE user_id=?').all(u.id),catalog:readCatalog(db,u.id,true).filter(i=>i.owner===u.id)};
  }
  if(path==='/api/weights'&&method==='PUT') {
    const d=date(b.date),value=numeric(b.value,'Вес',30,350);
    if(d>today(u.timezone)) fail(400,'Вес нельзя записать на будущую дату');
    db.prepare('INSERT INTO weights VALUES(?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET value=excluded.value').run(u.id,d,value);return {ok:true};
  }
  if(path==='/api/weights'&&method==='DELETE') {db.prepare('DELETE FROM weights WHERE user_id=? AND date=?').run(u.id,date(b.date));return {ok:true};}
  if(path==='/api/habits'&&method==='POST') {limitCount(db,'habits',u.id,100);const id=randomUUID();db.prepare('INSERT INTO habits(id,user_id,name) VALUES(?,?,?)').run(id,u.id,string(b.name,'Привычка',80));return {id};}
  const habitId=path.match(/^\/api\/habits\/([^/]+)$/)?.[1];
  if(habitId&&method==='DELETE') {owned(db,'habits',habitId,u.id);db.prepare('UPDATE habits SET archived=1 WHERE id=? AND user_id=?').run(habitId,u.id);return {ok:true};}
  if(path==='/api/marks'&&method==='PUT') {
    const id=string(b.habitId,'Привычка'),d=date(b.date);const h=owned(db,'habits',id,u.id);
    if(h.archived||d>today(u.timezone)) fail(400,'Нельзя отметить эту привычку на выбранную дату');
    db.prepare('INSERT INTO marks VALUES(?,?,?,?) ON CONFLICT(user_id,habit_id,date) DO UPDATE SET done=excluded.done').run(u.id,id,d,boolean(b.done));return {ok:true};
  }
  if(path==='/api/catalog'&&method==='POST') {
    if(db.prepare('SELECT count(*) AS n FROM catalog WHERE owner=?').get(u.id).n>=1000) fail(409,'Достигнут лимит каталога');
    if(!['food','recipe'].includes(b.kind)) fail(403,'В личный каталог можно добавить продукт или рецепт');
    return {id:saveItem(db,b.kind,b,u)};
  }
  const personalItem=path.match(/^\/api\/catalog\/([^/]+)$/)?.[1];
  if(personalItem&&method==='PUT') {
    const item=db.prepare('SELECT * FROM catalog WHERE id=? AND owner=? AND archived=0').get(personalItem,u.id);
    if(!item) fail(404,'Запись не найдена');return {id:saveItem(db,item.kind,b,u,false,personalItem)};
  }
  if(path==='/api/meals'&&method==='PUT') {
    const id=string(b.id,'Идентификатор',80),d=date(b.date);
    const existing=db.prepare('SELECT * FROM meals WHERE id=?').get(id);
    if(existing&&existing.user_id!==u.id) fail(404,'Запись не найдена');
    if(!existing) limitCount(db,'meals',u.id,20000);
    const slot=string(b.slot,'Приём пищи',30);
    if(!['Завтрак','Обед','Ужин','Перекус'].includes(slot)) fail(400,'Выберите приём пищи');
    const snapshot=existing?JSON.parse(existing.snapshot):mealSnapshot(db,string(b.catalogId,'Блюдо'),u.id);
    const eaten=boolean(b.eaten);if(eaten&&d>today(u.timezone)) fail(400,'Будущий приём пищи можно только запланировать');
    db.prepare('INSERT INTO meals VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,slot=excluded.slot,servings=excluded.servings,eaten=excluded.eaten').run(id,u.id,d,slot,numeric(b.servings,'Количество порций',0.01,100),eaten,JSON.stringify(snapshot));return {id};
  }
  const mealId=path.match(/^\/api\/meals\/([^/]+)$/)?.[1];
  if(mealId&&method==='DELETE') {owned(db,'meals',mealId,u.id);db.prepare('DELETE FROM meals WHERE id=? AND user_id=?').run(mealId,u.id);return {ok:true};}
  if(path==='/api/workouts'&&method==='PUT') {
    const id=string(b.id,'Идентификатор',80),d=date(b.date);const old=db.prepare('SELECT * FROM workouts WHERE id=?').get(id);
    if(old&&old.user_id!==u.id) fail(404,'Тренировка не найдена');
    if(old&&b.programId&&b.programId===JSON.parse(old.data).programId&&!b.exercises) return {id};
    if(!old) limitCount(db,'workouts',u.id,10000);
    let data;
    if(!old) {
      const program=getItem(db,string(b.programId,'Программа'),u.id,'program');
      data={name:program.name,programId:program.id,exercises:program.exercises.map(e=>{const exercise=getItem(db,e.exerciseId,u.id,'exercise');return {name:exercise.name,unit:exercise.unit,sets:Array.from({length:Math.round(e.sets)},()=>({reps:e.reps,weight:e.weight,done:false}))};})};
    } else {
      data=JSON.parse(old.data);
      if(!Array.isArray(b.exercises)||b.exercises.length!==data.exercises.length) fail(400,'Проверьте упражнения');
      data.exercises=data.exercises.map((e,i)=>{
        const sets=b.exercises[i]?.sets;
        if(!Array.isArray(sets)||sets.length<1||sets.length>20) fail(400,'Проверьте подходы');
        return {...e,sets:sets.map(s=>{if(!s||typeof s!=='object')fail(400,'Проверьте подходы');return {reps:numeric(s.reps,'Повторения',1,3600),weight:numeric(s.weight,'Нагрузка',0,500),done:!!boolean(s.done)};})};
      });
    }
    const finished=boolean(b.finished??false);
    if(finished&&(d>today(u.timezone)||!data.exercises.every(e=>e.sets.every(s=>s.done)))) fail(400,'Сначала отметьте выполненные подходы');
    db.prepare('INSERT INTO workouts VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,finished=excluded.finished,data=excluded.data').run(id,u.id,d,finished,JSON.stringify(data));return {id};
  }
  const workoutId=path.match(/^\/api\/workouts\/([^/]+)$/)?.[1];
  if(workoutId&&method==='DELETE') {owned(db,'workouts',workoutId,u.id);db.prepare('DELETE FROM workouts WHERE id=? AND user_id=?').run(workoutId,u.id);return {ok:true};}
  if(path==='/api/shopping/generate'&&method==='POST') {
    const from=date(b.from),to=date(b.to);if(to<from||(Date.parse(to)-Date.parse(from))/86400000>30) fail(400,'Выберите период до 31 дня');
    const meals=db.prepare('SELECT snapshot,servings FROM meals WHERE user_id=? AND date BETWEEN ? AND ?').all(u.id,from,to);
    const totals=new Map();
    for(const m of meals) for(const i of JSON.parse(m.snapshot).ingredients) {
      const key=i.name.trim().toLocaleLowerCase('ru');const prev=totals.get(key)||{name:i.name,amount:0};prev.amount+=i.grams*m.servings;totals.set(key,prev);
    }
    transaction(db,()=>{
      const old=db.prepare('SELECT * FROM shopping WHERE user_id=? AND generated=1').all(u.id);
      db.prepare('DELETE FROM shopping WHERE user_id=? AND generated=1').run(u.id);
      for(const value of totals.values()) {
        const same=old.find(x=>x.name===value.name&&Math.abs(x.amount-value.amount)<0.01);
        db.prepare('INSERT INTO shopping VALUES(?,?,?,?,?,?,1)').run('g-'+digest(`${u.id}:${value.name.trim().toLocaleLowerCase('ru')}`),u.id,value.name,Math.round(value.amount*10)/10,'г',same?.checked||0);
      }
    });return {ok:true,count:totals.size};
  }
  if(path==='/api/shopping'&&method==='PUT') {
    const id=string(b.id,'Идентификатор',80),existing=db.prepare('SELECT * FROM shopping WHERE id=?').get(id);
    if(existing&&existing.user_id!==u.id) fail(404,'Покупка не найдена');
    if(!existing) limitCount(db,'shopping',u.id,1000);
    const name=string(b.name,'Продукт',120),unit=string(b.unit,'Единица',20),amount=numeric(b.amount,'Количество',0.01,1000000);
    db.prepare('INSERT INTO shopping VALUES(?,?,?,?,?,?,0) ON CONFLICT(id) DO UPDATE SET name=excluded.name,amount=excluded.amount,unit=excluded.unit,checked=excluded.checked').run(id,u.id,name,amount,unit,boolean(b.checked));return {id};
  }
  const shopId=path.match(/^\/api\/shopping\/([^/]+)$/)?.[1];
  if(shopId&&method==='DELETE') {owned(db,'shopping',shopId,u.id);db.prepare('DELETE FROM shopping WHERE id=? AND user_id=?').run(shopId,u.id);return {ok:true};}
  if(path.startsWith('/api/admin/')) {
    if(u.role!=='admin') fail(403,'Раздел доступен администратору');
    if(path==='/api/admin/status'&&method==='GET') return {users:db.prepare('SELECT count(*) AS n FROM users').get().n,catalog:readCatalog(db,u.id),intro:db.prepare('SELECT value FROM settings WHERE key=?').get('intro').value,healthy:db.prepare('PRAGMA quick_check').get().quick_check==='ok'};
    if(path==='/api/admin/intro'&&method==='PUT') {db.prepare('UPDATE settings SET value=? WHERE key=?').run(string(b.intro,'Описание',600),'intro');return {ok:true};}
    if(path==='/api/admin/catalog'&&method==='POST') return {id:saveItem(db,string(b.kind,'Тип'),b,u,true)};
    const itemId=path.match(/^\/api\/admin\/catalog\/([^/]+)$/)?.[1];
    if(itemId&&method==='PUT') {const item=db.prepare('SELECT * FROM catalog WHERE id=? AND owner IS NULL').get(itemId);if(!item)fail(404,'Запись не найдена');return {id:saveItem(db,item.kind,b,u,true,itemId)};}
  }
  fail(404,'Метод не найден');
}
