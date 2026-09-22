import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { request } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createApplication } from './app.mjs';
import { backupDatabase, openDatabase } from './database.mjs';
import { today } from './security.mjs';

test('account and journal integration', async t=>{
  const directory=mkdtempSync(join(tmpdir(),'telo365-test-'));
  const dbPath=join(directory,'app.sqlite');
  let app=createApplication({dbPath,origins:'http://localhost:5173',trustProxy:true});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  let base=`http://127.0.0.1:${app.server.address().port}`;
  const cookies=new Map();let requestIp=1;
  const pw='test phrase with twelve characters!';
  async function req(path,method='GET',body,client='a',headers={}) {
    const response=await new Promise((resolve,reject)=>{
      const r=request(base+path,{method,headers:{Host:'localhost:5173',Origin:'http://localhost:5173','X-Telo365':'1','Content-Type':'application/json',...(body===undefined?{}:{'Content-Length':Buffer.byteLength(JSON.stringify(body))}),'X-Real-IP':`test-${requestIp++}`,...(cookies.get(client)?{Cookie:cookies.get(client)}:{}),...headers}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,value:JSON.parse(text),cookie:res.headers['set-cookie']?.[0]}));});
      r.on('error',reject);r.end(body===undefined?undefined:JSON.stringify(body));
    });
    if(response.cookie)cookies.set(client,response.cookie.split(';')[0]);
    return response;
  }
  let recovery,uid;
  const day='2026-09-20';
  await t.test('signup, hashed passwords, protected cookie and empty personal data',async()=>{
    const r=await req('/api/auth/register','POST',{email:'anna@example.test',password:pw,name:'Анна',accepted:true,timezone:'Europe/Moscow'});
    assert.equal(r.status,200);recovery=r.value.recoveryCode;uid=r.value.user.id;
    assert.ok(recovery.length>=40);assert.match(r.cookie,/HttpOnly/);assert.match(r.cookie,/SameSite=Lax/);
    assert.notEqual(app.db.prepare('SELECT password FROM users WHERE id=?').get(uid).password,pw);
    assert.equal((await req('/api/state')).value.weights.length,0);
    assert.equal((await req('/api/state')).value.meals.length,0);
    assert.equal((await req('/api/state')).value.habits.length,5);
    assert.equal((await req('/api/auth/register','POST',{email:'anna@example.test',password:pw,name:'Другой',accepted:true})).status,409);
  });
  await t.test('reject invalid auth, cross-origin, absent header, unknown host and oversized input',async()=>{
    assert.equal((await req('/api/auth/login','POST',{email:'anna@example.test',password:'wrong password phrase'})).status,401);
    assert.equal((await req('/api/weights','PUT',{date:day,value:65},'a',{Origin:'https://evil.test'})).status,403);
    assert.equal((await req('/api/weights','PUT',{date:day,value:65},'a',{'X-Telo365':''})).status,403);
    assert.equal((await req('/api/state','GET',undefined,'a',{Host:'evil.test'})).status,403);
    assert.equal((await req('/api/profile','PUT',{name:'x'.repeat(70000)})).status,413);
    assert.equal((await req('/api/nutrition/analyze-photo','POST',{image:'data:image/jpeg;base64,'+'?'.repeat(70000)})).status,400);
    assert.equal((await req('/api/state','GET',undefined,'anonymous')).status,401);
  });
  await t.test('profile, dates, marks and weights remain isolated across accounts and shared across devices',async()=>{
    assert.equal((await req('/api/auth/register','POST',{email:'boris@example.test',password:pw,name:'Борис',accepted:true},'b')).status,200);
    const state=(await req('/api/state')).value;
    assert.equal(state.habits[0].schedule,'daily');assert.equal(state.habits[0].weeklyTarget,7);assert.ok(state.habits[0].icon);
    const water=state.habits.find(habit=>habit.name==='Вода');assert.equal(water.tracking,'hydration');assert.equal(water.target,2000);
    assert.equal((await req('/api/habits/value','PUT',{habitId:water.id,date:day,delta:400,kind:'water'})).status,200);
    assert.equal((await req('/api/habits/value','PUT',{habitId:water.id,date:day,delta:500,kind:'tea'})).status,200);
    assert.equal((await req('/api/habits/value','PUT',{habitId:water.id,date:day,delta:300,kind:'lemonade'})).status,200);
    assert.equal((await req('/api/habits/value','PUT',{habitId:water.id,date:day,delta:-700,kind:'tea'})).status,200);
    const hydration=(await req('/api/state?date='+day)).value.habitValues.find(value=>value.habit_id===water.id);
    assert.equal(hydration.value,700);assert.equal(hydration.details.water,400);assert.equal(hydration.details.tea,0);assert.equal(hydration.details.lemonade,300);
    const weekendHabit=await req('/api/habits','POST',{name:'Weekend reset',icon:'🌿',schedule:'weekends',weeklyTarget:2});
    assert.equal(weekendHabit.status,200);
    assert.equal((await req('/api/marks','PUT',{habitId:weekendHabit.value.id,date:day,done:true})).status,200);
    assert.equal((await req('/api/habits/'+weekendHabit.value.id,'PUT',{name:'Weekend reset',icon:'🌿',schedule:'weekdays',weeklyTarget:3})).status,200);
    assert.equal((await req('/api/marks','PUT',{habitId:weekendHabit.value.id,date:day,done:true})).status,400);
    assert.equal((await req('/api/profile','PUT',{name:'Аня',goal:'maintain',target:null,targetLow:60,targetHigh:70,calories:2000,timezone:'Asia/Vladivostok',hydration:{ageBand:'adult',sex:'male',stage:'standard',doctorLimit:null}})).status,200);
    const personalized=(await req('/api/state?date='+day)).value;
    assert.equal(personalized.user.targetLow,60);assert.equal(personalized.user.targetHigh,70);assert.equal(personalized.user.hydration.sex,'male');assert.equal(personalized.habits.find(habit=>habit.name==='Вода').target,3000);
    assert.equal((await req('/api/weights','PUT',{date:day,value:66})).status,200);
    assert.equal((await req('/api/weights','PUT',{date:day,value:65.5})).status,200);
    assert.equal((await req('/api/weights','PUT',{date:'2026-02-30',value:65})).status,400);
    assert.equal((await req('/api/weights','PUT',{date:day,value:-1})).status,400);
    assert.equal((await req('/api/weights','PUT',{date:'2099-01-01',value:65})).status,400);
    assert.equal((await req('/api/marks','PUT',{habitId:state.habits[0].id,date:day,done:true})).status,200);
    assert.equal((await req('/api/marks','PUT',{habitId:state.habits[0].id,date:day,done:true},'b')).status,404);
    assert.equal((await req('/api/state?date='+day)).value.marks[0].done,1);
    assert.equal((await req('/api/state?date=2026-09-21')).value.marks[0].date,day);
    assert.equal((await req('/api/state','GET',undefined,'b')).value.weights.length,0);
    assert.equal((await req('/api/auth/login','POST',{email:'anna@example.test',password:pw},'phone')).status,200);
    const phone=(await req('/api/state','GET',undefined,'phone')).value;
    assert.equal(phone.weights.length,1);assert.equal(phone.weights[0].value,65.5);assert.equal(phone.user.timezone,'Asia/Vladivostok');
    assert.equal(phone.today,today('Asia/Vladivostok'));
  });
  let foodId,recipeId,mealId;
  await t.test('food, recipe and diary snapshot calculate portions without changing history',async()=>{
    const food=await req('/api/catalog','POST',{kind:'food',name:'Мой продукт',kcal:200,p:10,f:5,c:25,source:'Этикетка'});
    assert.equal(food.status,200);foodId=food.value.id;
    const recipe=await req('/api/catalog','POST',{kind:'recipe',name:'Мой рецепт',instructions:'Смешать',ingredients:[{foodId,grams:50}]});
    recipeId=recipe.value.id;assert.equal(recipe.status,200);
    mealId=randomUUID();const meal={id:mealId,date:day,catalogId:recipeId,slot:'Завтрак',servings:2,eaten:true};
    assert.equal((await req('/api/meals','PUT',meal)).status,200);
    assert.equal((await req('/api/meals','PUT',meal)).status,200);
    let state=(await req('/api/state?date='+day)).value;
    assert.equal(state.meals.length,1);assert.equal(state.meals[0].snapshot.kcal*state.meals[0].servings,200);
    assert.equal((await req('/api/catalog/'+foodId,'PUT',{name:'Мой продукт',kcal:300,p:10,f:5,c:25,source:'Новая этикетка'})).status,200);
    state=(await req('/api/state?date='+day)).value;assert.equal(state.meals[0].snapshot.kcal,100);assert.equal(state.catalog.find(i=>i.id===recipeId).nutrition.kcal,150);
    assert.equal((await req('/api/meals','PUT',meal,'b')).status,404);
    assert.equal((await req('/api/meals/'+mealId,'DELETE',{},'b')).status,404);
    assert.equal((await req('/api/meals','PUT',{...meal,id:randomUUID()},'b')).status,404);
    assert.equal((await req('/api/catalog/'+foodId,'PUT',{name:'steal'},'b')).status,404);
  });
  await t.test('shopping aggregation is repeatable and preserves manual items and unchanged checks',async()=>{
    const manual=randomUUID();await req('/api/shopping','PUT',{id:manual,name:'Салфетки',amount:1,unit:'уп.',checked:false});
    assert.equal((await req('/api/shopping/generate','POST',{from:day,to:day})).status,200);
    let list=(await req('/api/state')).value.shopping;assert.equal(list.length,2);
    const generated=list.find(i=>i.generated);assert.equal(generated.amount,100);
    await req('/api/shopping','PUT',{...generated,checked:true});
    await req('/api/shopping/generate','POST',{from:day,to:day});
    list=(await req('/api/state')).value.shopping;assert.equal(list.length,2);assert.equal(list.find(i=>i.generated).checked,1);
    assert.equal((await req('/api/shopping','PUT',{...generated,checked:true},'b')).status,404);
    const current=list.find(i=>i.generated);
    assert.equal((await req('/api/shopping/'+current.id,'DELETE',{},'b')).status,404);
  });
  await t.test('workout restart, per-set data, completion and ownership',async()=>{
    const id=randomUUID();const create={id,programId:'full-body',date:day,finished:false};
    assert.equal((await req('/api/workouts','PUT',create)).status,200);
    assert.equal((await req('/api/workouts','PUT',create)).status,200);
    let workout=(await req('/api/state')).value.workouts[0];assert.equal(workout.id,id);assert.match(workout.data.startedAt,/^\d{4}-\d{2}-\d{2}T/);
    assert.equal((await req('/api/workouts','PUT',{id,date:day,exercises:workout.data.exercises,finished:true})).status,400);
    for(const e of workout.data.exercises)for(const s of e.sets){s.done=true;s.weight=5;}
    assert.equal((await req('/api/workouts','PUT',{id,date:day,exercises:workout.data.exercises,finished:true})).status,200);
    assert.equal((await req('/api/state')).value.workouts[0].finished,true);
    assert.equal((await req('/api/workouts/'+id,'DELETE',{},'b')).status,404);
  });
  await t.test('weekly meal plan replaces earlier planned meals and preserves eaten meals',async()=>{
    const nextDay='2026-09-21';
    await req('/api/meals','PUT',{id:randomUUID(),date:day,catalogId:recipeId,slot:'Обед',servings:1,eaten:false});
    await req('/api/meals','PUT',{id:randomUUID(),date:nextDay,catalogId:recipeId,slot:'Ужин',servings:1,eaten:false});
    const applied=await req('/api/nutrition/plan','POST',{meals:[
      {date:day,slot:'Перекус',catalogId:recipeId,servings:1.5},
      {date:nextDay,slot:'Завтрак',catalogId:recipeId,servings:2},
    ]});
    assert.equal(applied.status,200);assert.equal(applied.value.count,2);
    const current=(await req('/api/state?date='+day)).value;
    assert.equal(current.meals.length,2);assert.ok(current.meals.some(meal=>meal.id===mealId&&meal.eaten));assert.ok(current.meals.some(meal=>!meal.eaten&&meal.slot==='Перекус'));
    const next=(await req('/api/state?date='+nextDay)).value;
    assert.equal(next.meals.length,1);assert.equal(next.meals[0].slot,'Завтрак');
  });
  await t.test('admin role cannot be self-assigned and catalog is protected',async()=>{
    assert.equal((await req('/api/admin/status')).status,403);
    assert.equal((await req('/api/admin/intro','PUT',{intro:'changed'})).status,403);
    app.db.prepare('UPDATE users SET role=? WHERE id=?').run('admin',uid);
    assert.equal((await req('/api/admin/status')).status,200);
    assert.equal((await req('/api/admin/intro','PUT',{intro:'Новое описание'})).status,200);
    assert.equal((await req('/api/public')).value.intro,'Новое описание');
    assert.equal((await req('/api/admin/catalog','POST',{kind:'recipe',name:'bad',instructions:'test',ingredients:[{foodId,grams:100}]})).status,400);
  });
  await t.test('backup is consistent, restores records, and server restarts preserve sessions',async()=>{
    const copy=join(directory,'backup.sqlite');await backupDatabase(app.db,copy);const restored=openDatabase(copy);
    assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.equal(restored.prepare('SELECT value FROM weights WHERE user_id=?').get(uid).value,65.5);restored.close();
    await new Promise(r=>app.server.close(r));
    app=createApplication({dbPath,origins:'http://localhost:5173',trustProxy:true});app.server.listen(0,'127.0.0.1');await once(app.server,'listening');base=`http://127.0.0.1:${app.server.address().port}`;
    assert.equal((await req('/api/state')).value.weights[0].value,65.5);
  });
  await t.test('recovery is single use, revokes other sessions, and logout revokes cookie',async()=>{
    const recovered=await req('/api/auth/recover','POST',{email:'anna@example.test',password:pw+'new',code:recovery},'recover');
    assert.equal(recovered.status,200);assert.ok(recovered.value.recoveryCode!==recovery);
    assert.equal((await req('/api/state','GET',undefined,'phone')).status,401);
    assert.equal((await req('/api/auth/recover','POST',{email:'anna@example.test',password:pw,code:recovery},'a')).status,401);
    const stale=cookies.get('recover');await req('/api/auth/logout','POST',{},'recover');cookies.set('recover',stale);
    assert.equal((await req('/api/state','GET',undefined,'recover')).status,401);
    await req('/api/auth/login','POST',{email:'anna@example.test',password:pw+'new'},'a');
    assert.equal((await req('/api/export')).value.weights.length,1);
    assert.equal((await req('/api/auth/delete','POST',{password:pw+'new'})).status,200);
    assert.equal(app.db.prepare('SELECT count(*) AS n FROM weights WHERE user_id=?').get(uid).n,0);
  });
  await t.test('rate limiting persists across requests',async()=>{
    let status;for(let i=0;i<16;i++)status=(await req('/api/auth/login','POST',{email:'rate@example.test',password:pw},'rate',{'X-Real-IP':'rate-test'})).status;assert.equal(status,429);
  });
  await new Promise(r=>app.server.close(r));rmSync(directory,{recursive:true,force:true});
});

test('production refuses insecure origin configuration',()=>{
  assert.throws(()=>createApplication({dbPath:':memory:',production:true,origins:'http://localhost'}),/HTTPS/);
});
