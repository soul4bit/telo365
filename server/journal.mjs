import { randomUUID } from 'node:crypto';
import { transaction } from './database.mjs';
import { profile } from './accounts.mjs';
import { boolean, date, digest, fail, numeric, string, today } from './security.mjs';
import { getItem, mealSnapshot, readCatalog, saveItem } from './catalog.mjs';
import { analyzeMealPhoto } from './vision.mjs';
import { onboarding } from './onboarding.mjs';
import { stores } from './stores/index.mjs';
import { canUseGenericProgram, ensureTrainingPlan, progressRecommendation, readTrainingPlan, sessionFromTrainingDay } from './training-plan.mjs';

const parseMeal=r=>({...r,snapshot:JSON.parse(r.snapshot),eaten:!!r.eaten});
const parseWorkout=r=>({...r,data:JSON.parse(r.data),finished:!!r.finished});
function alternativeReason(source,candidate) {
  if(source.contraindications?.includes('knees')&&!candidate.contraindications?.includes('knees'))return 'reduce_knee_load';
  if(source.contraindications?.includes('shoulders')&&!candidate.contraindications?.includes('shoulders'))return 'reduce_shoulder_load';
  if(JSON.stringify(source.equipment||[])!==JSON.stringify(candidate.equipment||[]))return 'equipment';
  return 'same_pattern';
}
function movementPatternOf(exercise) {
  if(typeof exercise.movementPattern==='string')return exercise.movementPattern;
  const id=String(exercise.id||'');
  if(/squat|lunge|step/.test(id))return 'squat';
  if(/deadlift|rdl|bridge|calf/.test(id))return 'hinge';
  if(/press|push-up/.test(id))return 'push';
  if(/row|pull|curl/.test(id))return 'pull';
  if(/plank|bug|bird-dog|pallof/.test(id))return 'core';
  if(/mobility|walking/.test(id))return 'mobility';
  return Array.isArray(exercise.primaryMuscles)?exercise.primaryMuscles.join('_')||'general':String(exercise.primaryMuscles||'general');
}
function exerciseAlternatives(db,userId,source,variantIds=[],movementPattern='same_pattern') {
  return [...new Set(variantIds||[])].map(exerciseId=>{
    const candidate=getItem(db,exerciseId,userId,'exercise');
    return {exerciseId:candidate.id,reason:alternativeReason(source,candidate),movementPattern};
  });
}
function withPlannedSets(sets) {
  return sets.map(set=>({plannedReps:set.reps,plannedWeight:set.weight,reps:set.reps,weight:set.weight,done:false}));
}
function limitCount(db,table,user,max) { if(db.prepare(`SELECT count(*) AS n FROM ${table} WHERE user_id=?`).get(user).n>=max) fail(409,'Достигнут лимит записей. Удалите ненужные записи'); }
function owned(db,table,id,user) { const row=db.prepare(`SELECT * FROM ${table} WHERE id=? AND user_id=?`).get(id,user);if(!row) fail(404,'Запись не найдена');return row; }
function habitData(body) {
  const name=string(body.name,'Привычка',80),icon=string(body.icon??'✨','Иконка',8);
  const schedule=string(body.schedule??'daily','Расписание',20),weeklyTarget=numeric(body.weeklyTarget??7,'Цель на неделю',1,7);
  if(!['daily','weekdays','weekends'].includes(schedule)||!Number.isInteger(weeklyTarget)) fail(400,'Проверьте настройки привычки');
  const tracking=string(body.tracking??'check','Тип',20),target=numeric(body.target??0,'Цель',0,1000000),inputUnit=string(body.unit??'','Единица',20,0),unit=tracking==='hydration'?'мл':inputUnit;
  if(!['check','counter','hydration'].includes(tracking)||(tracking==='check'&&target!==0)||(tracking!=='check'&&target<=0)) fail(400,'Проверьте цель и тип привычки');
  return {name,icon,schedule,weeklyTarget,tracking,target,unit};
}
function habitScheduled(schedule,dateValue) { const day=new Date(dateValue+'T12:00:00Z').getUTCDay();return schedule==='weekdays'?day>0&&day<6:schedule==='weekends'?day===0||day===6:true; }
export function state(db,user,day) {
  const selected=date(day||today(user.timezone));
  const catalog=readCatalog(db,user.id);
  const nutritionProfile=db.prepare('SELECT data FROM nutrition_profiles WHERE user_id=?').get(user.id);
  const onboardingRow=db.prepare('SELECT completed,plan FROM onboarding WHERE user_id=?').get(user.id);
  const trainingPlan=ensureTrainingPlan(db,user,selected);
  return {
    user:{...profile(user),onboardingCompleted:!onboardingRow||!!onboardingRow.completed},today:today(user.timezone),date:selected,
    weights:db.prepare('SELECT date,value FROM weights WHERE user_id=? ORDER BY date').all(user.id),
    habits:db.prepare('SELECT id,name,icon,schedule,weekly_target AS weeklyTarget,tracking,target,unit,archived FROM habits WHERE user_id=? AND archived=0').all(user.id),
    marks:db.prepare('SELECT habit_id,date,done FROM marks WHERE user_id=? AND date>=date(?,\'-365 days\') AND date<=?').all(user.id,selected,selected),
    habitValues:db.prepare('SELECT habit_id,date,value,details FROM habit_values WHERE user_id=? AND date>=date(?,\'-365 days\') AND date<=?').all(user.id,selected,selected).map(row=>({...row,details:JSON.parse(row.details)})),
    meals:db.prepare('SELECT * FROM meals WHERE user_id=? AND date=? ORDER BY rowid').all(user.id,selected).map(parseMeal),
    workouts:db.prepare('SELECT * FROM workouts WHERE user_id=? ORDER BY date DESC,rowid DESC LIMIT 100').all(user.id).map(parseWorkout),
    shopping:db.prepare('SELECT id,name,amount,unit,checked,generated FROM shopping WHERE user_id=? ORDER BY generated DESC,name').all(user.id),
    catalog:catalog.map(i=>i.kind==='recipe'?{...i,nutrition:mealSnapshot(db,i.id,user.id)}:i),
    nutritionProfile:nutritionProfile?JSON.parse(nutritionProfile.data):null,onboardingPlan:onboardingRow?.plan?JSON.parse(onboardingRow.plan):null,trainingPlan,
  };
}

export async function journal(ctx) {
  const {db,user:u,body:b,path,method,url}=ctx;
  if(!u) fail(401,'Войдите в аккаунт');
  const onboardingResult=onboarding(ctx);if(onboardingResult)return onboardingResult;
  const storesResult=await stores(ctx);if(storesResult)return storesResult;
  if(method==='GET'&&path==='/api/state') return state(db,u,url.searchParams.get('date'));
  if(path==='/api/nutrition/analyze-photo'&&method==='POST') return analyzeMealPhoto(ctx);
  if(path==='/api/nutrition/profile'&&method==='PUT') {
    const style=string(b.style,'Формат питания',20),cooking=string(b.cooking,'Время готовки',20),budget=string(b.budget,'Бюджет',20),exclusions=typeof b.exclusions==='string'?b.exclusions.trim().slice(0,300):fail(400,'Проверьте ограничения');
    if(!['home','mixed','ready'].includes(style)||!['quick','normal','free'].includes(cooking)||!['economy','balanced','free'].includes(budget)) fail(400,'Выберите вариант из списка');
    db.prepare('INSERT INTO nutrition_profiles(user_id,data,updated) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated=excluded.updated').run(u.id,JSON.stringify({style,cooking,budget,exclusions}),new Date().toISOString());
    return {ok:true};
  }
  if(method==='GET'&&path==='/api/export') {
    return {profile:profile(u),weights:db.prepare('SELECT date,value FROM weights WHERE user_id=?').all(u.id),habits:db.prepare('SELECT * FROM habits WHERE user_id=?').all(u.id),marks:db.prepare('SELECT habit_id,date,done FROM marks WHERE user_id=?').all(u.id),meals:db.prepare('SELECT * FROM meals WHERE user_id=?').all(u.id).map(parseMeal),workouts:db.prepare('SELECT * FROM workouts WHERE user_id=?').all(u.id).map(parseWorkout),shopping:db.prepare('SELECT * FROM shopping WHERE user_id=?').all(u.id),catalog:readCatalog(db,u.id,true).filter(i=>i.owner===u.id)};
  }
  if(path==='/api/weights'&&method==='PUT') {
    const d=date(b.date),value=numeric(b.value,'Вес',30,350);
    if(d>today(u.timezone)) fail(400,'Вес нельзя записать на будущую дату');
    db.prepare('INSERT INTO weights VALUES(?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET value=excluded.value').run(u.id,d,value);return {ok:true};
  }
  if(path==='/api/weights'&&method==='DELETE') {db.prepare('DELETE FROM weights WHERE user_id=? AND date=?').run(u.id,date(b.date));return {ok:true};}
  if(path==='/api/habits'&&method==='POST') {limitCount(db,'habits',u.id,100);const id=randomUUID(),habit=habitData(b);db.prepare('INSERT INTO habits(id,user_id,name,icon,schedule,weekly_target,tracking,target,unit) VALUES(?,?,?,?,?,?,?,?,?)').run(id,u.id,habit.name,habit.icon,habit.schedule,habit.weeklyTarget,habit.tracking,habit.target,habit.unit);return {id};}
  if(path==='/api/habits/value'&&method==='PUT') {
    const id=string(b.habitId,'Привычка'),d=date(b.date),delta=numeric(b.delta,'Количество',-100000,100000),kind=string(b.kind??'manual','Тип напитка',20);
    const h=owned(db,'habits',id,u.id);if(h.archived||d>today(u.timezone)||!habitScheduled(h.schedule,d)||!['counter','hydration'].includes(h.tracking)||delta===0) fail(400,'Нельзя изменить значение этой привычки');
    const old=db.prepare('SELECT value,details FROM habit_values WHERE user_id=? AND habit_id=? AND date=?').get(u.id,id,d),details=old?JSON.parse(old.details):{};
    let appliedDelta=delta;
    if(h.tracking==='hydration') {
      if(!['water','coffee','tea','lemonade','juice','milk','other'].includes(kind)) fail(400,'Выберите напиток');
      const current=Math.max(0,Number(details[kind]||0)); appliedDelta=Math.max(-current,delta); details[kind]=Math.round((current+appliedDelta)*10)/10;
    }
    const value=Math.max(0,Math.round(((old?.value||0)+appliedDelta)*10)/10);db.prepare('INSERT INTO habit_values(user_id,habit_id,date,value,details) VALUES(?,?,?,?,?) ON CONFLICT(user_id,habit_id,date) DO UPDATE SET value=excluded.value,details=excluded.details').run(u.id,id,d,value,JSON.stringify(details));
    db.prepare('INSERT INTO marks VALUES(?,?,?,?) ON CONFLICT(user_id,habit_id,date) DO UPDATE SET done=excluded.done').run(u.id,id,d,value>=h.target?1:0);return {value};
  }  const habitId=path.match(/^\/api\/habits\/([^/]+)$/)?.[1];
  if(habitId&&method==='PUT') {owned(db,'habits',habitId,u.id);const habit=habitData(b);db.prepare('UPDATE habits SET name=?,icon=?,schedule=?,weekly_target=?,tracking=?,target=?,unit=? WHERE id=? AND user_id=?').run(habit.name,habit.icon,habit.schedule,habit.weeklyTarget,habit.tracking,habit.target,habit.unit,habitId,u.id);return {id:habitId};}
  if(habitId&&method==='DELETE') {owned(db,'habits',habitId,u.id);db.prepare('UPDATE habits SET archived=1 WHERE id=? AND user_id=?').run(habitId,u.id);return {ok:true};}
  if(path==='/api/marks'&&method==='PUT') {
    const id=string(b.habitId,'Привычка'),d=date(b.date);const h=owned(db,'habits',id,u.id);
    if(h.archived||d>today(u.timezone)||!habitScheduled(h.schedule,d)) fail(400,'Нельзя отметить эту привычку на выбранную дату');
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
  if(path==='/api/nutrition/plan'&&method==='POST') {
    if(!Array.isArray(b.meals)||b.meals.length<1||b.meals.length>35) fail(400,'Проверьте план питания');
    const slots=['Завтрак','Обед','Ужин','Перекус','Поздний перекус'];
    const meals=b.meals.map(value=>{
      if(!value||typeof value!=='object') fail(400,'Проверьте план питания');
      const d=date(value.date),slot=string(value.slot,'Приём пищи',30);
      if(!slots.includes(slot)) fail(400,'Выберите приём пищи');
      return {date:d,slot,servings:numeric(value.servings,'Количество порций',0.01,100),snapshot:mealSnapshot(db,string(value.catalogId,'Блюдо'),u.id)};
    });
    const dates=meals.map(meal=>meal.date),from=dates.reduce((a,b)=>a<b?a:b),to=dates.reduce((a,b)=>a>b?a:b);
    if((Date.parse(to)-Date.parse(from))/86400000>6) fail(400,'План можно собрать только на неделю');
    transaction(db,()=>{
      db.prepare('DELETE FROM meals WHERE user_id=? AND date BETWEEN ? AND ? AND eaten=0').run(u.id,from,to);
      const insert=db.prepare('INSERT INTO meals VALUES(?,?,?,?,?,?,?)');
      for(const meal of meals) insert.run(randomUUID(),u.id,meal.date,meal.slot,meal.servings,0,JSON.stringify(meal.snapshot));
    });
    return {ok:true,count:meals.length};
  }
  if(path==='/api/meals'&&method==='PUT') {
    const id=string(b.id,'Идентификатор',80),d=date(b.date);
    const existing=db.prepare('SELECT * FROM meals WHERE id=?').get(id);
    if(existing&&existing.user_id!==u.id) fail(404,'Запись не найдена');
    if(!existing) limitCount(db,'meals',u.id,20000);
    const slot=string(b.slot,'Приём пищи',30);
    if(!['Завтрак','Обед','Ужин','Перекус','Поздний перекус'].includes(slot)) fail(400,'Выберите приём пищи');
    const snapshot=existing?JSON.parse(existing.snapshot):mealSnapshot(db,string(b.catalogId,'Блюдо'),u.id);
    const eaten=boolean(b.eaten);if(eaten&&d>today(u.timezone)) fail(400,'Будущий приём пищи можно только запланировать');
    db.prepare('INSERT INTO meals VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET date=excluded.date,slot=excluded.slot,servings=excluded.servings,eaten=excluded.eaten').run(id,u.id,d,slot,numeric(b.servings,'Количество порций',0.01,100),eaten,JSON.stringify(snapshot));return {id};
  }
  const mealId=path.match(/^\/api\/meals\/([^/]+)$/)?.[1];
  if(mealId&&method==='DELETE') {owned(db,'meals',mealId,u.id);db.prepare('DELETE FROM meals WHERE id=? AND user_id=?').run(mealId,u.id);return {ok:true};}
  if(method==='GET'&&path==='/api/training-plan') return ensureTrainingPlan(db,u,date(url.searchParams.get('date')||today(u.timezone)));
  if(path==='/api/workouts'&&method==='PUT') {
    const id=string(b.id,'\u0418\u0434\u0435\u043d\u0442\u0438\u0444\u0438\u043a\u0430\u0442\u043e\u0440',80),d=date(b.date),old=db.prepare('SELECT * FROM workouts WHERE id=?').get(id);
    if(old&&old.user_id!==u.id) fail(404,'\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430');
    if(old&&b.programId&&b.programId===JSON.parse(old.data).programId&&!b.exercises) return {id};
    if(!old) limitCount(db,'workouts',u.id,10000);
    let data;
    if(!old&&b.planId&&b.trainingDayId) {
      const plan=ensureTrainingPlan(db,u,d);
      if(!plan||plan.id!==b.planId) fail(400,'\u041f\u043b\u0430\u043d \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043e\u043a \u043d\u0435 \u0430\u043a\u0442\u0443\u0430\u043b\u0435\u043d');
      const sourceDay=plan.currentWeek?.days?.find(day=>day.id===String(b.trainingDayId));
      data=sessionFromTrainingDay(plan,String(b.trainingDayId),b.exerciseOverrides&&typeof b.exerciseOverrides==='object'?b.exerciseOverrides:{});
      if(!data) fail(400,'\u0414\u043b\u044f \u044d\u0442\u043e\u0433\u043e \u0434\u043d\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0443\u044e \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0443 \u043f\u043e\u043a\u0430 \u043d\u0435 \u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0435\u043c');
      data.exercises=data.exercises.map((exercise,index)=>{
        const source=sourceDay?.exercises?.[index],catalogExercise=getItem(db,exercise.exerciseId,u.id,'exercise');
        return {...exercise,alternatives:exerciseAlternatives(db,u.id,catalogExercise,source?.variants||[],movementPatternOf(catalogExercise)),sets:withPlannedSets(exercise.sets)};
      });
    } else if(!old) {
      const program=getItem(db,string(b.programId,'\u041f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430'),u.id,'program');
      const personalPlan=readTrainingPlan(db,u,d);
      if(!canUseGenericProgram(personalPlan,program)) fail(400,'\u042d\u0442\u0430 \u043f\u0440\u043e\u0433\u0440\u0430\u043c\u043c\u0430 \u043f\u043e\u043a\u0430 \u043d\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u0438\u0442 \u043a \u0443\u0447\u0442\u0451\u043d\u043d\u044b\u043c \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f\u043c.');
      data={name:program.name,programId:program.id,intensity:'moderate',minutes:program.minutes||null,startedAt:new Date().toISOString(),exercises:program.exercises.map(e=>{const exercise=getItem(db,e.exerciseId,u.id,'exercise');return {exerciseId:exercise.id,name:exercise.name,unit:exercise.unit,equipment:exercise.equipment||[],alternatives:exerciseAlternatives(db,u.id,exercise,exercise.variants||[],movementPatternOf(exercise)),restSeconds:75,targetRpe:6,notes:'',sets:withPlannedSets(Array.from({length:Math.round(e.sets)},()=>({reps:e.reps,weight:e.weight})))};}),feedback:null,progressRecommendation:null};
    } else {
      data=JSON.parse(old.data);
      if(!Array.isArray(b.exercises)||b.exercises.length!==data.exercises.length) fail(400,'\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0443\u043f\u0440\u0430\u0436\u043d\u0435\u043d\u0438\u044f');
      data.exercises=data.exercises.map((e,i)=>{
        const incoming=b.exercises[i]||{},sets=incoming.sets;
        if(!Array.isArray(sets)||sets.length<1||sets.length>20) fail(400,'\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u044b');
        let next={...e};
        const replacementId=typeof incoming.exerciseId==='string'?incoming.exerciseId:e.exerciseId;
        if(replacementId!==e.exerciseId){
          const current=getItem(db,e.exerciseId,u.id,'exercise');
          let allowed=Array.isArray(e.alternatives)?e.alternatives.map(item=>item.exerciseId):Array.isArray(e.variants)?e.variants:[];
          if(!allowed.length&&data.planId&&data.trainingDayId){
            const activePlan=readTrainingPlan(db,u,d),plannedDay=activePlan?.currentWeek?.days?.find(day=>day.id===data.trainingDayId);
            allowed=plannedDay?.exercises?.find(item=>item.exerciseId===e.exerciseId)?.variants||[];
          }
          if(!allowed.length) allowed=current.variants||[];
          if(!allowed.includes(replacementId)) fail(400,'Для этого упражнения нельзя выбрать такую замену');
          const replacement=getItem(db,replacementId,u.id,'exercise'),personalPlan=readTrainingPlan(db,u,d);
          if(personalPlan&&!canUseGenericProgram(personalPlan,{intensity:data.intensity||'moderate',exercises:[{exerciseId:replacement.id}]})) fail(400,'Эта замена пока не подходит к учтённым ограничениям.');
          next={...next,exerciseId:replacement.id,name:replacement.name,unit:replacement.unit,equipment:replacement.equipment||[],alternatives:exerciseAlternatives(db,u.id,replacement,replacement.variants||[],movementPatternOf(replacement))};
        }
        return {...next,sets:sets.map((s,setIndex)=>{if(!s||typeof s!=='object')fail(400,'\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u044b');const planned=e.sets[setIndex]||{};return {plannedReps:numeric(planned.plannedReps??planned.reps,'\u041f\u043b\u0430\u043d\u043e\u0432\u044b\u0435 \u043f\u043e\u0432\u0442\u043e\u0440\u0435\u043d\u0438\u044f',1,3600),plannedWeight:numeric(planned.plannedWeight??planned.weight??0,'\u041f\u043b\u0430\u043d\u043e\u0432\u0430\u044f \u043d\u0430\u0433\u0440\u0443\u0437\u043a\u0430',0,500),reps:numeric(s.reps,'\u041f\u043e\u0432\u0442\u043e\u0440\u0435\u043d\u0438\u044f',1,3600),weight:numeric(s.weight,'\u041d\u0430\u0433\u0440\u0443\u0437\u043a\u0430',0,500),done:!!boolean(s.done)};})};
      });
    }
    const finished=boolean(b.finished??false);
    if(finished&&(d>today(u.timezone)||!data.exercises.every(e=>e.sets.every(s=>s.done)))) fail(400,'\u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u043e\u0442\u043c\u0435\u0442\u044c\u0442\u0435 \u0432\u044b\u043f\u043e\u043b\u043d\u0435\u043d\u043d\u044b\u0435 \u043f\u043e\u0434\u0445\u043e\u0434\u044b');
    const feedback=b.feedback&&typeof b.feedback==='object'?(()=>{
      const rpe=numeric(b.feedback.rpe,'RPE',1,10),perceivedDifficulty=['easy','normal','hard'].includes(b.feedback.perceivedDifficulty)?b.feedback.perceivedDifficulty:(rpe<=5?'easy':rpe>=8?'hard':'normal'),painOrDiscomfort=!!boolean(b.feedback.painOrDiscomfort),discomfortArea=typeof b.feedback.discomfortArea==='string'?b.feedback.discomfortArea.trim().slice(0,80)||null:null;
      return {rpe,perceivedDifficulty,allSetsCompleted:!!boolean(b.feedback.allSetsCompleted),painOrDiscomfort,discomfortArea:painOrDiscomfort?discomfortArea:null};
    })():null;
    if(finished&&data.planId&&!feedback) fail(400,'\u041e\u0446\u0435\u043d\u0438 \u0441\u043b\u043e\u0436\u043d\u043e\u0441\u0442\u044c \u0438 \u0441\u0430\u043c\u043e\u0447\u0443\u0432\u0441\u0442\u0432\u0438\u0435 \u043f\u043e\u0441\u043b\u0435 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0438');
    if(finished&&feedback) {
      data.feedback=feedback;
      if(data.planId)data.progressRecommendation=progressRecommendation(feedback);
    }
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
