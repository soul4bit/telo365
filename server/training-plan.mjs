import { randomUUID } from 'node:crypto';

/**
 * WorkoutPlanner v1
 *
 * The catalogue is deliberately normalized here and seeded into the shared
 * catalogue. A saved TrainingPlan contains generated prescriptions, while a
 * WorkoutSession keeps the factual result separately in the workouts table.
 */
const media={shortVideoUrl:null,posterUrl:null,duration:null,angle:null,trainerName:null};
const defaultInstruction='Двигайся в спокойном темпе, контролируй положение тела и остановись при дискомфорте.';
const allLocations=['home','gym'];

function exercise(spec){
  const value={
    difficulty:'beginner', locations:allLocations, equipment:[], primaryMuscles:[], secondaryMuscles:[],
    cautionTags:[], contraindicationTags:[], alternatives:[], animationKey:spec.id,
    instructions:[defaultInstruction], defaultRestSeconds:75, unit:'reps', ...spec
  };
  return {
    ...value,
    // Legacy aliases keep generic programs and the current UI compatible.
    contraindications:value.contraindicationTags,
    techniqueTips:value.instructions,
    media:{...media},
    variants:value.alternatives
  };
}

/** Normalized MVP catalogue. Media remains local-placeholder only until supplied. */
export const exerciseLibrary=[
  // Lower body
  // `squat` is the canonical bodyweight Air Squat. The supported/bench
  // variation is intentionally retained as the separate `box-squat` entry.
  exercise({id:'squat',name:'Приседания',movementPattern:'squat',primaryMuscles:['Ноги','Ягодицы'],cautionTags:['knees'],alternatives:['box-squat','glute-bridge'],animationKey:'squat',instructions:['Стопы примерно на ширине плеч.','Колени движутся по направлению носков.','Таз движется назад и вниз; корпус остаётся под контролем.','Опускайся и поднимайся плавно, сохраняя устойчивую опору стоп.']}),
  exercise({id:'box-squat',name:'Приседания до скамьи',movementPattern:'squat',primaryMuscles:['Ноги','Ягодицы'],equipment:['bench'],cautionTags:['knees'],alternatives:['squat','glute-bridge'],animationKey:'squat'}),
  exercise({id:'dumbbell-goblet-squat',name:'Присед с гантелью',movementPattern:'squat',primaryMuscles:['Ноги','Ягодицы'],equipment:['dumbbells'],difficulty:'some',cautionTags:['knees'],contraindicationTags:['knees','injury','surgery'],alternatives:['box-squat','glute-bridge'],animationKey:'goblet_squat'}),
  exercise({id:'split-squat',name:'Сплит-присед',movementPattern:'squat',primaryMuscles:['Ноги','Ягодицы'],difficulty:'some',cautionTags:['knees','balance'],contraindicationTags:['knees','injury','surgery'],alternatives:['box-squat','glute-bridge']}),
  exercise({id:'dumbbell-split-squat',name:'Сплит-присед с гантелями',movementPattern:'squat',primaryMuscles:['Ноги','Ягодицы'],equipment:['dumbbells'],difficulty:'regular',cautionTags:['knees','balance'],contraindicationTags:['knees','injury','surgery'],alternatives:['dumbbell-goblet-squat','box-squat']}),
  exercise({id:'glute-bridge',name:'Ягодичный мост',movementPattern:'hinge',primaryMuscles:['Ягодицы'],secondaryMuscles:['Кор'],alternatives:['hip-hinge','dumbbell-rdl'],animationKey:'glute_bridge'}),
  exercise({id:'hip-hinge',name:'Наклон с контролем таза',movementPattern:'hinge',primaryMuscles:['Ягодицы','Задняя поверхность бедра'],cautionTags:['back'],alternatives:['glute-bridge','dumbbell-rdl']}),
  exercise({id:'good-morning',name:'Наклон «доброе утро» без веса',movementPattern:'hinge',primaryMuscles:['Ягодицы','Задняя поверхность бедра'],cautionTags:['back'],alternatives:['glute-bridge','hip-hinge']}),
  exercise({id:'dumbbell-rdl',name:'Румынская тяга с гантелями',movementPattern:'hinge',primaryMuscles:['Ягодицы','Задняя поверхность бедра'],equipment:['dumbbells'],difficulty:'some',cautionTags:['back'],contraindicationTags:['back','injury'],alternatives:['glute-bridge','hip-hinge'],animationKey:'romanian_deadlift'}),
  exercise({id:'calf-raise',name:'Подъём на носки',movementPattern:'locomotion',primaryMuscles:['Голень'],cautionTags:['ankles'],alternatives:['walking']}),

  // Upper push
  exercise({id:'push-up-wall',name:'Отжимания от стены',movementPattern:'horizontal_push',primaryMuscles:['Грудь','Трицепс'],cautionTags:['shoulders','wrists'],alternatives:['incline-push-up','dumbbell-floor-press']}),
  exercise({id:'incline-push-up',name:'Отжимания от опоры',movementPattern:'horizontal_push',primaryMuscles:['Грудь','Трицепс'],equipment:['bench'],cautionTags:['shoulders','wrists'],alternatives:['push-up-wall','dumbbell-floor-press']}),
  exercise({id:'knee-push-up',name:'Отжимания с колен',movementPattern:'horizontal_push',primaryMuscles:['Грудь','Трицепс'],difficulty:'some',cautionTags:['shoulders','wrists','knees'],alternatives:['push-up-wall','push-up']}),
  exercise({id:'push-up',name:'Отжимания',movementPattern:'horizontal_push',primaryMuscles:['Грудь','Трицепс'],difficulty:'some',cautionTags:['shoulders','wrists'],contraindicationTags:['shoulders','wrists'],alternatives:['incline-push-up','push-up-wall'],animationKey:'pushup'}),
  exercise({id:'press',name:'Жим гантелей лёжа',movementPattern:'horizontal_push',primaryMuscles:['Грудь','Трицепс'],equipment:['dumbbells'],cautionTags:['shoulders','wrists'],contraindicationTags:['shoulders'],alternatives:['push-up-wall','incline-push-up'],animationKey:'dumbbell_press'}),
  exercise({id:'dumbbell-floor-press',name:'Жим гантелей лёжа',movementPattern:'horizontal_push',primaryMuscles:['Грудь','Трицепс'],equipment:['dumbbells'],cautionTags:['shoulders','wrists'],contraindicationTags:['shoulders'],alternatives:['push-up-wall','incline-push-up'],animationKey:'dumbbell_press'}),
  exercise({id:'dumbbell-bench-press',name:'Жим гантелей на скамье',movementPattern:'horizontal_push',primaryMuscles:['Грудь','Трицепс'],equipment:['dumbbells','bench'],difficulty:'some',cautionTags:['shoulders','wrists'],contraindicationTags:['shoulders'],alternatives:['dumbbell-floor-press','incline-push-up'],animationKey:'dumbbell_press'}),
  exercise({id:'dumbbell-overhead-press',name:'Жим гантелей стоя',movementPattern:'vertical_push',primaryMuscles:['Плечи','Трицепс'],equipment:['dumbbells'],difficulty:'some',cautionTags:['shoulders','neck','wrists'],contraindicationTags:['shoulders','neck','wrists'],alternatives:['dumbbell-floor-press','push-up-wall'],animationKey:'shoulder_press'}),

  // Upper pull
  exercise({id:'row',name:'Тяга гантели в наклоне',movementPattern:'horizontal_pull',primaryMuscles:['Спина'],secondaryMuscles:['Бицепс'],equipment:['dumbbells'],cautionTags:['back','shoulders'],contraindicationTags:['back'],alternatives:['supported-row','band-row'],animationKey:'dumbbell_row'}),
  exercise({id:'dumbbell-row',name:'Тяга гантели одной рукой',movementPattern:'horizontal_pull',primaryMuscles:['Спина'],secondaryMuscles:['Бицепс'],equipment:['dumbbells'],cautionTags:['back','shoulders'],contraindicationTags:['back'],alternatives:['supported-row','band-row'],animationKey:'dumbbell_row'}),
  exercise({id:'supported-row',name:'Тяга гантели с опорой',movementPattern:'horizontal_pull',primaryMuscles:['Спина'],secondaryMuscles:['Бицепс'],equipment:['dumbbells','bench'],cautionTags:['back','shoulders'],alternatives:['band-row','dumbbell-row'],animationKey:'dumbbell_row'}),
  exercise({id:'band-row',name:'Тяга резинки к поясу',movementPattern:'horizontal_pull',primaryMuscles:['Спина'],secondaryMuscles:['Бицепс'],equipment:['bands'],cautionTags:['shoulders'],alternatives:['dumbbell-row','prone-y-raise']}),
  exercise({id:'prone-y-raise',name:'Подъёмы рук лёжа Y–T',movementPattern:'horizontal_pull',primaryMuscles:['Верх спины'],cautionTags:['shoulders','neck'],alternatives:['band-row']}),
  exercise({id:'reverse-snow-angel',name:'Разведения рук лёжа',movementPattern:'horizontal_pull',primaryMuscles:['Верх спины'],cautionTags:['shoulders','neck'],alternatives:['prone-y-raise','floor-swimmer']}),
  exercise({id:'floor-swimmer',name:'Пловец лёжа',movementPattern:'horizontal_pull',primaryMuscles:['Верх спины'],cautionTags:['shoulders','neck'],alternatives:['prone-y-raise','reverse-snow-angel']}),
  exercise({id:'assisted-pull-up',name:'Подтягивания с резинкой',movementPattern:'vertical_pull',primaryMuscles:['Спина','Бицепс'],equipment:['pullup_bar','bands'],difficulty:'regular',cautionTags:['shoulders','elbows'],contraindicationTags:['shoulders','elbows'],alternatives:['band-row','dumbbell-row']}),
  exercise({id:'band-pull-apart',name:'Разведение резинки',movementPattern:'horizontal_pull',primaryMuscles:['Верх спины'],equipment:['bands'],cautionTags:['shoulders'],alternatives:['band-row','prone-y-raise']}),
  exercise({id:'biceps-curl',name:'Сгибание рук с гантелями',movementPattern:'horizontal_pull',primaryMuscles:['Бицепс'],equipment:['dumbbells'],cautionTags:['elbows','wrists'],alternatives:['band-row'],animationKey:'biceps_curl'}),

  // Core and recovery
  exercise({id:'dead-bug',name:'Мёртвый жук',movementPattern:'core',primaryMuscles:['Кор'],cautionTags:['back'],alternatives:['bird-dog','plank']}),
  exercise({id:'bird-dog',name:'Птица-собака',movementPattern:'core',primaryMuscles:['Кор','Спина'],cautionTags:['back','wrists'],alternatives:['dead-bug','pallof-press']}),
  exercise({id:'plank',name:'Планка',movementPattern:'core',primaryMuscles:['Кор'],unit:'seconds',cautionTags:['shoulders','wrists','back'],contraindicationTags:['shoulders','wrists','back'],alternatives:['dead-bug','bird-dog'],animationKey:'plank'}),
  exercise({id:'pallof-press',name:'Жим Паллафа',movementPattern:'core',primaryMuscles:['Кор'],equipment:['bands'],cautionTags:['back'],alternatives:['dead-bug','bird-dog']}),
  exercise({id:'mobility-flow',name:'Мягкая мобилизация',movementPattern:'mobility',primaryMuscles:['Мобильность'],unit:'seconds',alternatives:['walking','dead-bug']}),
  exercise({id:'walking',name:'Спокойная ходьба',movementPattern:'locomotion',primaryMuscles:['Лёгкая активность'],locations:['home','gym','outdoor'],unit:'seconds',alternatives:['mobility-flow']}),
  exercise({id:'farmer-carry',name:'Прогулка с гантелями',movementPattern:'carry',primaryMuscles:['Кор','Хват'],equipment:['dumbbells'],difficulty:'some',cautionTags:['back','shoulders'],alternatives:['walking']})
];

const byId=new Map(exerciseLibrary.map(item=>[item.id,item]));
const difficultyRank={beginner:0,some:1,regular:2,advanced:3};
const patternSubstitutions={
  squat:['squat','hinge'], hinge:['hinge','squat'], horizontal_push:['horizontal_push','vertical_push'],
  vertical_push:['vertical_push','horizontal_push'], horizontal_pull:['horizontal_pull','vertical_pull'],
  vertical_pull:['vertical_pull','horizontal_pull'], core:['core'], carry:['carry','locomotion'], locomotion:['locomotion','mobility'], mobility:['mobility','locomotion']
};
const displayIntensity={light:'лёгкая',moderate:'умеренная',hard:'высокая'};

export function seedTrainingExercises(db){
  const save=db.prepare('INSERT INTO catalog(id,kind,owner,data,archived) VALUES(?,?,NULL,?,0) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,data=excluded.data,archived=0 WHERE catalog.owner IS NULL');
  for(const item of exerciseLibrary) save.run(item.id,'exercise',JSON.stringify({...item,muscle:item.primaryMuscles.join(' · '),description:item.techniqueTips[0],unit:item.unit}));
}

function isoMonday(day){const value=new Date(`${day}T12:00:00Z`),weekday=value.getUTCDay()||7;value.setUTCDate(value.getUTCDate()-(weekday-1));return value.toISOString().slice(0,10);}
function addDays(day,offset){const value=new Date(`${day}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+offset);return value.toISOString().slice(0,10);}
function weekOffset(a,b){return Math.round((Date.parse(a)-Date.parse(b))/(7*86400000));}
function list(value){return Array.isArray(value)?value:[];}
function hasEquipment(item,equipment,hasGym){return hasGym||item.equipment.every(required=>equipment.has(required)||(required==='dumbbells'&&equipment.has('adjustable_dumbbells')));}
function hasLocation(item,locations){return !locations.size||item.locations.some(location=>locations.has(location));}
function hasHardConstraint(item,safety){return item.contraindicationTags.some(tag=>safety.strictAreas.has(tag))||item.cautionTags.some(tag=>safety.strictAreas.has(tag));}
function cautionScore(item,safety){
  let score=0;
  for(const tag of item.cautionTags){if(safety.limitationSet.has(tag))score+=8;}
  for(const tag of item.contraindicationTags){if(safety.limitationSet.has(tag))score+=14;}
  return score;
}
function isAllowed(item,context){
  return !!item&&hasEquipment(item,context.equipment,context.hasGym)&&hasLocation(item,context.locations)&&!hasHardConstraint(item,context.safety);
}
function ageFrom(input){return Number.isFinite(Number(input.age))?Number(input.age):null;}
function safetyFrom(input,starter={}){
  const limitationSet=new Set(list(input.limitations).filter(value=>value&&value!=='none'));
  const areas=input.areaStatusByArea||{};
  const strictAreas=new Set();
  for(const [area,statuses] of Object.entries(areas))if(list(statuses).some(status=>['pain','limited_mobility','recovery'].includes(status)))strictAreas.add(area);
  const guidance=new Set(list(input.medicationGuidance));
  const acute=!!input.doctorExerciseRestriction||!!input.acutePainNow||!!input.acutePainOrExerciseRestriction;
  const notCleared=(limitationSet.has('injury')||limitationSet.has('surgery'))&&input.returnToExerciseClearance==='no';
  const specialistHold=guidance.has('avoid_exercises');
  const cautious=[...limitationSet].some(value=>['knees','back','shoulders','neck','elbows','wrists','hips','ankles','injury','surgery'].includes(value));
  const intensityLimited=[...limitationSet].some(value=>['asthma','cardio','diabetes','pregnancy'].includes(value))||input.medicationConsideration==='yes'||input.medicationConsideration==='unknown';
  return {
    limitationSet, strictAreas, restricted:acute||notCleared, specialistHold,
    cautious, intensityLimited, avoidHiit:intensityLimited||!!starter?.safety?.avoidHiit,
    kneeProtection:limitationSet.has('knees'), hasSpecialistGuidance:!!String(input.doctorRestrictions||'').trim()||Object.values(areas).some(status=>list(status).includes('specialist_guidance'))
  };
}
function recentFeedbackSummary(recentFeedback=[]){
  const values=list(recentFeedback).filter(item=>item&&typeof item==='object');
  const discomfort=values.filter(item=>item.painOrDiscomfort).length;
  const hard=values.filter(item=>Number(item.rpe)>=8).length;
  return {sessions:values.length,discomfort,hard,needsConservativeFollowUp:values.length>=2&&(discomfort>=2||hard>=2)};
}
function planAdjustment(input,safety,recentFeedback){
  const requested=Math.max(1,Math.min(5,Number(input.trainingDaysPerWeek)||3));
  const experience=input.trainingExperience||'beginner';
  const age=ageFrom(input);
  if(safety.restricted)return {requested,planned:0,reduced:true,reasons:['direct_restriction']};
  if(safety.specialistHold)return {requested,planned:0,reduced:true,reasons:['specialist_restrictions']};
  if(recentFeedback.needsConservativeFollowUp)return {requested,planned:Math.min(requested,2),reduced:requested>2,reasons:['recent_feedback']};
  if(safety.cautious)return {requested,planned:Math.min(requested,2),reduced:requested>2,reasons:requested>2?['physical_constraints']:[]};
  // A beginner's requested frequency is availability, so it remains a ceiling
  // even when the only additional caution is intensity-related.
  if(experience==='beginner')return {requested,planned:Math.min(requested,2),reduced:requested>2,reasons:requested>2?[safety.intensityLimited?'intensity_constraints':'beginner_conservative_start']:[]};
  if(safety.intensityLimited)return {requested,planned:Math.min(requested,3),reduced:requested>3,reasons:requested>3?['intensity_constraints']:[]};
  if(age&&age>=65)return {requested,planned:Math.min(requested,2),reduced:requested>2,reasons:requested>2?['age_conservative_start']:[]};
  if(experience==='some')return {requested,planned:Math.min(requested,3),reduced:requested>3,reasons:requested>3?['recovery_spacing']:[]};
  // Four strength days are the top of the automatic starting range. The other
  // available days stay explicitly available for walking and mobility.
  return {requested,planned:Math.min(requested,4),reduced:requested>4,reasons:requested>4?['recovery_spacing']:[]};
}
function selectWeekdays(count,preferred=[]){
  if(count<=0)return [];
  const defaults={0:[],1:[3],2:[2,5],3:[1,3,5],4:[1,3,5,7]}[count]||[];
  const choices=[...new Set(list(preferred).map(Number).filter(day=>Number.isInteger(day)&&day>=1&&day<=7))].sort((a,b)=>a-b);
  if(choices.length<count)return defaults;
  if(choices.length===count)return choices;
  const chosen=[];
  for(const day of choices){
    if(!chosen.length){chosen.push(day);continue;}
    if(chosen.length<count&&day-chosen[chosen.length-1]>=2)chosen.push(day);
  }
  for(const day of choices)if(chosen.length<count&&!chosen.includes(day))chosen.push(day);
  return chosen.sort((a,b)=>a-b);
}
function workoutKeys(count,experience){
  if(count===1)return ['A'];
  if(count===2)return ['A','B'];
  if(count===3)return ['A','B','A'];
  if(count===4&&['regular','advanced'].includes(experience))return ['upper-a','lower-a','upper-b','lower-b'];
  return ['A','B','A'].slice(0,count);
}
function templateDefinition(key){
  const templates={
    A:{name:'Тренировка A',type:'strength_a',focus:'Всё тело',patterns:['squat','horizontal_push','horizontal_pull','hinge','core'],preferences:{squat:['squat','box-squat','dumbbell-goblet-squat'],horizontal_push:['dumbbell-floor-press','push-up-wall','incline-push-up'],horizontal_pull:['dumbbell-row','band-row','prone-y-raise'],hinge:['glute-bridge','dumbbell-rdl','hip-hinge'],core:['dead-bug','pallof-press','bird-dog']}},
    B:{name:'Тренировка B',type:'strength_b',focus:'Всё тело',patterns:['hinge','horizontal_pull','horizontal_push','squat','core'],preferences:{hinge:['dumbbell-rdl','hip-hinge','glute-bridge'],horizontal_pull:['band-row','supported-row','dumbbell-row','prone-y-raise'],horizontal_push:['incline-push-up','push-up-wall','dumbbell-floor-press'],squat:['box-squat','squat','glute-bridge'],core:['pallof-press','bird-dog','dead-bug']}},
    'upper-a':{name:'Верх тела A',type:'upper',focus:'Верх тела',patterns:['horizontal_push','horizontal_pull','vertical_push','horizontal_pull','core'],preferences:{horizontal_push:['dumbbell-floor-press','incline-push-up'],horizontal_pull:['dumbbell-row','band-row','prone-y-raise'],vertical_push:['dumbbell-overhead-press','push-up-wall'],core:['dead-bug','pallof-press']}},
    'lower-a':{name:'Низ тела A',type:'lower',focus:'Низ тела',patterns:['squat','hinge','squat','core','locomotion'],preferences:{squat:['dumbbell-goblet-squat','box-squat','squat'],hinge:['dumbbell-rdl','glute-bridge','hip-hinge'],core:['dead-bug','bird-dog'],locomotion:['calf-raise','walking']}},
    'upper-b':{name:'Верх тела B',type:'upper',focus:'Верх тела',patterns:['horizontal_pull','horizontal_push','vertical_pull','vertical_push','core'],preferences:{horizontal_pull:['band-row','supported-row','dumbbell-row','prone-y-raise'],horizontal_push:['dumbbell-bench-press','push-up-wall','dumbbell-floor-press'],vertical_pull:['assisted-pull-up','band-row'],vertical_push:['dumbbell-overhead-press','push-up-wall'],core:['pallof-press','dead-bug']}},
    'lower-b':{name:'Низ тела B',type:'lower',focus:'Низ тела',patterns:['hinge','squat','hinge','core','locomotion'],preferences:{hinge:['glute-bridge','dumbbell-rdl','hip-hinge'],squat:['box-squat','squat','glute-bridge'],core:['bird-dog','dead-bug'],locomotion:['walking','calf-raise']}}
  };
  return templates[key]||templates.A;
}
function chooseExercise(pattern,preferences,context,used=[]){
  const candidates=exerciseLibrary.filter(item=>item.movementPattern===pattern&&isAllowed(item,context));
  const ordered=[...candidates].sort((a,b)=>{
    const preferenceDelta=(preferences.indexOf(a.id)+1||99)-(preferences.indexOf(b.id)+1||99);
    if(preferenceDelta)return preferenceDelta;
    const cautionDelta=cautionScore(a,context.safety)-cautionScore(b,context.safety);
    if(cautionDelta)return cautionDelta;
    const difficultyDelta=(difficultyRank[a.difficulty]??0)-(difficultyRank[b.difficulty]??0);
    return difficultyDelta||a.id.localeCompare(b.id);
  });
  return ordered.find(item=>!used.includes(item.id))||ordered[0]||null;
}
function compatibleAlternatives(source,context){
  const candidates=[];
  const sourceAlternatives=list(source.alternatives).map(id=>byId.get(id)).filter(Boolean);
  const sameAndRelated=exerciseLibrary.filter(item=>patternSubstitutions[source.movementPattern]?.includes(item.movementPattern));
  for(const candidate of [...sourceAlternatives,...sameAndRelated]){
    if(candidate.id===source.id||candidates.some(item=>item.id===candidate.id)||!isAllowed(candidate,context))continue;
    candidates.push(candidate);
    if(candidates.length===4)break;
  }
  return candidates.map(candidate=>({
    exerciseId:candidate.id,
    movementPattern:candidate.movementPattern,
    reason:source.cautionTags.includes('knees')&&!candidate.cautionTags.includes('knees')?'reduce_knee_load':source.cautionTags.includes('shoulders')&&!candidate.cautionTags.includes('shoulders')?'reduce_shoulder_load':source.equipment.join('|')!==candidate.equipment.join('|')?'equipment':'same_pattern'
  }));
}
function prescription(item,index,profile,intensity,context){
  const beginner=profile.experience==='beginner';
  const short=profile.minutes<=20;
  const light=intensity==='light';
  const lowerVolume=beginner||profile.activityLevel==='sedentary'||(profile.age&&profile.age>=65)||light;
  const sets=short?2:lowerVolume?2:profile.goal==='gain_muscle'?3:3;
  const targetRpe=light?4:lowerVolume?5:profile.experience==='advanced'?7:6;
  const restSeconds=light?60:short?45:item.defaultRestSeconds||75;
  const repsMin=short?8:profile.goal==='gain_muscle'?8:10;
  const repsMax=short?10:profile.goal==='gain_muscle'?12:12;
  const durationSeconds=short?25:light?30:40;
  const alternatives=compatibleAlternatives(item,context);
  return {
    exerciseId:item.id,sets,reps:item.unit==='seconds'?null:repsMax,repsMin:item.unit==='seconds'?null:repsMin,repsMax:item.unit==='seconds'?null:repsMax,
    durationSeconds:item.unit==='seconds'?durationSeconds:null,restSeconds,weight:null,targetRpe,targetEffort:light?'лёгко':'умеренно',
    order:index+1,notes:'',substitutionGroup:item.movementPattern,variants:alternatives.map(item=>item.exerciseId),alternatives
  };
}
function buildWorkoutTemplate(key,profile,context){
  const definition=templateDefinition(key);
  const maximum=profile.minutes<=20?3:5;
  const used=[];
  const selected=[];
  for(const pattern of definition.patterns){
    if(selected.length>=maximum)break;
    const item=chooseExercise(pattern,definition.preferences[pattern]||[],context,used);
    if(item){selected.push(item);used.push(item.id);}
  }
  const intensity=context.safety.intensityLimited||profile.experience==='beginner'||profile.activityLevel==='sedentary'||(profile.age&&profile.age>=65)?'light':'moderate';
  return {templateKey:key,type:definition.type,name:definition.name,focus:definition.focus,durationMinutes:profile.minutes,intensity,recoveryDay:false,status:'planned',exercises:selected.map((item,index)=>prescription(item,index,profile,intensity,context))};
}
function buildDays(schedule,templates){
  return schedule.map(({weekday,key})=>({id:`day-${weekday}-${key}`,weekday,templateKey:key,...structuredClone(templates[key])}));
}
function recoveryDay(weekday,date){return {id:`recovery-${weekday}`,weekday,date,type:'recovery',name:'Восстановление',durationMinutes:0,intensity:'light',recoveryDay:true,status:'recovery',exercises:[]};}
function cycleSchedule(weekStart,anchor,schedule){
  if(schedule.length!==3||!schedule.every(item=>item.key==='A'||item.key==='B')||Math.abs(weekOffset(weekStart,anchor))%2===0)return schedule;
  return schedule.map(item=>({...item,key:item.key==='A'?'B':'A'}));
}
function safeMessage(safety,unavailable){
  if(safety.restricted)return 'В анкете отмечена острая боль или прямое ограничение специалиста. Обычную тренировку автоматически не запускаем.';
  if(safety.specialistHold)return 'Есть рекомендация уточнить допустимые упражнения. Сначала ориентируйся на рекомендации специалиста.';
  if(unavailable)return 'Не нашли достаточно подходящих упражнений для автоматического старта. Сначала уточни допустимую нагрузку со специалистом.';
  return safety.cautious||safety.intensityLimited?'Ограничения учтены как сигнал для более осторожного стартового подбора.':'Стартовый план подбирает нагрузку постепенно и оставляет дни восстановления.';
}

export function generateTrainingPlan({userId,onboarding,starterPlan={},referenceDate,recentFeedback=[]}){
  const safety=safetyFrom(onboarding,starterPlan);
  const feedback=recentFeedbackSummary(recentFeedback);
  const adjustment=planAdjustment(onboarding,safety,feedback);
  const locations=new Set(list(onboarding.trainingLocations));
  const equipment=new Set(list(onboarding.equipment).filter(value=>value!=='none'));
  const hasGym=locations.has('gym')&&(equipment.has('standard_gym')||equipment.has('machines')||equipment.has('barbell'));
  const profile={goal:onboarding.primaryGoal||'wellbeing',activityLevel:onboarding.activityLevel||'light',experience:onboarding.trainingExperience||'beginner',minutes:Math.max(15,Math.min(90,Number(onboarding.trainingDurationMinutes)||30)),age:ageFrom(onboarding)};
  const context={locations,equipment,hasGym,safety,profile};
  const keys=workoutKeys(adjustment.planned,profile.experience);
  const templates=Object.fromEntries([...new Set(keys)].map(key=>[key,buildWorkoutTemplate(key,profile,context)]));
  const weekdays=selectWeekdays(adjustment.planned,onboarding.preferredTrainingDays);
  const schedule=weekdays.map((weekday,index)=>({weekday,key:keys[index]}));
  const days=buildDays(schedule,templates).filter(day=>day.exercises.length>0);
  const finalAdjustment=days.length<adjustment.planned?{...adjustment,planned:days.length,reduced:true,reasons:[...adjustment.reasons,'no_safe_exercises']}:adjustment;
  const unavailable=finalAdjustment.planned===0;
  const status=safety.restricted||safety.specialistHold||unavailable?'needs_review':'active';
  const weekStart=isoMonday(referenceDate);
  const now=new Date().toISOString();
  const source={
    goal:profile.goal,age:profile.age,sex:onboarding.sex||null,heightCm:onboarding.heightCm||null,weightKg:onboarding.weightKg||null,
    activityLevel:profile.activityLevel,experience:profile.experience,locations:[...locations],equipment:[...equipment],
    preferences:{preferredTrainingDays:list(onboarding.preferredTrainingDays),preferredTrainingTime:onboarding.preferredTrainingTime||'any',trainingPreferences:list(onboarding.trainingPreferences)},
    feedback:feedback.sessions?feedback:null
  };
  const plan={
    id:randomUUID(),userId,version:2,status,createdAt:now,updatedAt:now,source,
    safety:{restricted:safety.restricted,cautious:safety.cautious,intensityLimited:safety.intensityLimited,limitations:[...safety.limitationSet],blockedExerciseAreas:[...safety.strictAreas],message:safeMessage(safety,unavailable)},
    adjustment:{requestedDaysPerWeek:finalAdjustment.requested,plannedDaysPerWeek:finalAdjustment.planned,reduced:finalAdjustment.reduced,reasons:finalAdjustment.reasons},
    cycle:{anchorWeekStart:weekStart,schedule,alternatesAB:schedule.length===3&&schedule.every(item=>item.key==='A'||item.key==='B')},
    workoutTemplates:templates,weeks:[{id:randomUUID(),weekStart,days}],
    progression:{mode:'rule_based',nextReviewAfterSessions:3,feedbackStored:true}
  };
  return materializeTrainingPlan(plan,referenceDate);
}

export function materializeTrainingPlan(plan,referenceDate){
  const weekStart=isoMonday(referenceDate);
  const base=plan.weeks?.[0]||{days:[]};
  let activeDays=base.days||[];
  if(plan.version>=2&&plan.cycle?.schedule&&plan.workoutTemplates){
    const schedule=plan.cycle.alternatesAB?cycleSchedule(weekStart,plan.cycle.anchorWeekStart,plan.cycle.schedule):plan.cycle.schedule;
    activeDays=buildDays(schedule,plan.workoutTemplates);
  }
  const byWeekday=new Map(activeDays.map(day=>[day.weekday,day]));
  const days=Array.from({length:7},(_,index)=>{const weekday=index+1,date=addDays(weekStart,index),day=byWeekday.get(weekday);return day?{...day,date}:recoveryDay(weekday,date);});
  return {...plan,currentWeek:{id:base.id||'week',weekStart,days}};
}

export function saveTrainingPlan(db,userId,plan){
  const stored={...plan};delete stored.currentWeek;
  db.prepare('INSERT INTO training_plans(id,user_id,status,data,created,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,status=excluded.status,data=excluded.data,updated=excluded.updated').run(stored.id,userId,stored.status,JSON.stringify(stored),stored.createdAt,stored.updatedAt);
  return stored;
}
export function readTrainingPlan(db,user,referenceDate){const row=db.prepare('SELECT data FROM training_plans WHERE user_id=?').get(user.id);return row?materializeTrainingPlan(JSON.parse(row.data),referenceDate):null;}
function readRecentFeedback(db,userId){
  return db.prepare('SELECT data FROM workouts WHERE user_id=? AND finished=1 ORDER BY date DESC,rowid DESC LIMIT 3').all(userId).map(row=>{try{return JSON.parse(row.data).feedback;}catch{return null;}}).filter(Boolean);
}
export function ensureTrainingPlan(db,user,referenceDate){
  const current=readTrainingPlan(db,user,referenceDate);
  if(current?.version>=2)return current;
  const onboarding=db.prepare('SELECT completed,data,plan FROM onboarding WHERE user_id=?').get(user.id);
  if(!onboarding?.completed)return null;
  const generated=generateTrainingPlan({userId:user.id,onboarding:JSON.parse(onboarding.data),starterPlan:onboarding.plan?JSON.parse(onboarding.plan):{},referenceDate,recentFeedback:readRecentFeedback(db,user.id)});
  saveTrainingPlan(db,user.id,generated);return generated;
}
export function sessionFromTrainingDay(plan,trainingDay,overrides={}){
  const day=plan.currentWeek?.days?.find(item=>item.id===trainingDay)||plan.currentWeek?.days?.find(item=>item.date===trainingDay);
  if(!day||!day.exercises.length||plan.status!=='active')return null;
  const exercises=day.exercises.map(item=>{
    const selected=overrides[item.exerciseId];
    const exerciseId=selected&&item.variants.includes(selected)?selected:item.exerciseId;
    const exercise=byId.get(exerciseId)||byId.get(item.exerciseId);
    return {exerciseId,name:exercise?.name||item.exerciseId,unit:exercise?.unit||'reps',equipment:exercise?.equipment||[],restSeconds:item.restSeconds,targetRpe:item.targetRpe,notes:item.notes,alternatives:item.alternatives||[],variants:item.variants||[],sets:Array.from({length:item.sets},()=>({reps:item.reps||item.durationSeconds||0,weight:item.weight||0,done:false}))};
  });
  return {name:day.name,programId:`personal:${plan.id}:${day.id}`,planId:plan.id,trainingDayId:day.id,intensity:day.intensity,minutes:day.durationMinutes,startedAt:new Date().toISOString(),exercises,feedback:null,progressRecommendation:null};
}
export function canUseGenericProgram(plan,program){
  if(!plan)return true;
  if(plan.status!=='active'||(plan.safety?.intensityLimited&&program.intensity==='hard'))return false;
  const safety={limitationSet:new Set(plan.safety?.limitations||[]),strictAreas:new Set(plan.safety?.blockedExerciseAreas||[])};
  const equipment=new Set(plan.source?.equipment||[]),locations=new Set(plan.source?.locations||[]);
  const hasGym=locations.has('gym')&&(equipment.has('standard_gym')||equipment.has('machines')||equipment.has('barbell'));
  return list(program.exercises).every(entry=>isAllowed(byId.get(entry.exerciseId),{equipment,locations,hasGym,safety}));
}
export function progressRecommendation(feedback={}){
  if(feedback.painOrDiscomfort)return {action:'reduce_load',label:'Снизить нагрузку',reason:'Ты отметил дискомфорт: на следующей тренировке оставь более лёгкий вариант.'};
  if(!feedback.allSetsCompleted||Number(feedback.rpe)>=9)return {action:'reduce_load',label:'Снизить нагрузку',reason:'Нагрузка была высокой.'};
  if(Number(feedback.rpe)<=5)return {action:'increase_reps',label:'Добавить повторения',reason:'Тренировка прошла легко: в следующем цикле можно добавить 1–2 повтора.'};
  if(Number(feedback.rpe)>=8)return {action:'keep_load',label:'Оставить нагрузку',reason:'Оставь текущий объём до следующей оценки.'};
  return {action:'keep_load',label:'Оставить нагрузку',reason:'Всё идёт ровно: сохраняем текущий ритм.'};
}

export const plannerLabels={displayIntensity};
