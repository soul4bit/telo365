import { randomUUID } from 'node:crypto';

/**
 * Personal training domain (persisted as JSON in training_plans):
 * TrainingPlan -> TrainingWeek -> TrainingDay -> WorkoutExercise.
 * Exercise and ExerciseVariant live in the shared catalog. WorkoutSession and
 * WorkoutSet live in the existing workouts table so historical sessions stay intact.
 * ExerciseMedia is deliberately data-only: URLs can be attached later without
 * changing the planner or a saved plan.
 */
const media={shortVideoUrl:null,posterUrl:null,duration:null,angle:null,trainerName:null};
const technique='\u0421\u043f\u043e\u043a\u043e\u0439\u043d\u044b\u0439 \u0442\u0435\u043c\u043f, \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c \u0434\u0432\u0438\u0436\u0435\u043d\u0438\u044f \u0438 \u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0430 \u043f\u0440\u0438 \u0434\u0438\u0441\u043a\u043e\u043c\u0444\u043e\u0440\u0442\u0435.';
const exercise=(id,name,group,equipment=[],avoid=[],unit='reps',variants=[])=>({id,name,primaryMuscles:group,secondaryMuscles:[],difficulty:'beginner',equipment,contraindications:avoid,techniqueTips:[technique],media:{...media},variants});

// Seed catalogue: bodyweight, dumbbells, bands, bench and pull-up bar.
export const exerciseLibrary=[
  exercise('squat','\u041f\u0440\u0438\u0441\u0435\u0434\u0430\u043d\u0438\u044f','\u041d\u043e\u0433\u0438 \u0438 \u044f\u0433\u043e\u0434\u0438\u0446\u044b',[],['knees','injury','surgery'],'reps',['box-squat','glute-bridge']),
  exercise('box-squat','\u041f\u0440\u0438\u0441\u0435\u0434\u0430\u043d\u0438\u044f \u0434\u043e \u0441\u043a\u0430\u043c\u044c\u0438','\u041d\u043e\u0433\u0438 \u0438 \u044f\u0433\u043e\u0434\u0438\u0446\u044b',['bench'],['knees','injury','surgery']),
  exercise('glute-bridge','\u042f\u0433\u043e\u0434\u0438\u0447\u043d\u044b\u0439 \u043c\u043e\u0441\u0442','\u042f\u0433\u043e\u0434\u0438\u0446\u044b \u0438 \u043a\u043e\u0440',[],['back']),
  exercise('calf-raise','\u041f\u043e\u0434\u044a\u0451\u043c \u043d\u0430 \u043d\u043e\u0441\u043a\u0438','\u0413\u043e\u043b\u0435\u043d\u044c',[],['ankles','injury']),
  exercise('reverse-lunge','\u041e\u0431\u0440\u0430\u0442\u043d\u044b\u0435 \u0432\u044b\u043f\u0430\u0434\u044b','\u041d\u043e\u0433\u0438 \u0438 \u044f\u0433\u043e\u0434\u0438\u0446\u044b',[],['knees','injury','surgery']),
  exercise('step-up','\u0428\u0430\u0433\u0438 \u043d\u0430 \u0432\u043e\u0437\u0432\u044b\u0448\u0435\u043d\u0438\u0435','\u041d\u043e\u0433\u0438 \u0438 \u044f\u0433\u043e\u0434\u0438\u0446\u044b',['bench'],['knees','injury','surgery']),
  exercise('push-up-wall','\u041e\u0442\u0436\u0438\u043c\u0430\u043d\u0438\u044f \u043e\u0442 \u0441\u0442\u0435\u043d\u044b','\u0413\u0440\u0443\u0434\u044c \u0438 \u0442\u0440\u0438\u0446\u0435\u043f\u0441',[],['shoulders','wrists']),
  exercise('incline-push-up','\u041e\u0442\u0436\u0438\u043c\u0430\u043d\u0438\u044f \u043e\u0442 \u043e\u043f\u043e\u0440\u044b','\u0413\u0440\u0443\u0434\u044c \u0438 \u0442\u0440\u0438\u0446\u0435\u043f\u0441',['bench'],['shoulders','wrists']),
  exercise('push-up','\u041e\u0442\u0436\u0438\u043c\u0430\u043d\u0438\u044f','\u0413\u0440\u0443\u0434\u044c \u0438 \u0442\u0440\u0438\u0446\u0435\u043f\u0441',[],['shoulders','wrists']),
  exercise('press','\u0416\u0438\u043c \u0433\u0430\u043d\u0442\u0435\u043b\u0435\u0439 \u043b\u0451\u0436\u0430','\u0413\u0440\u0443\u0434\u044c \u0438 \u0440\u0443\u043a\u0438',['dumbbells'],['shoulders','wrists'],'reps',['push-up-wall','incline-push-up']),
  exercise('dumbbell-floor-press','\u0416\u0438\u043c \u0433\u0430\u043d\u0442\u0435\u043b\u0435\u0439 \u043b\u0451\u0436\u0430','\u0413\u0440\u0443\u0434\u044c \u0438 \u0442\u0440\u0438\u0446\u0435\u043f\u0441',['dumbbells'],['shoulders','wrists']),
  exercise('dumbbell-bench-press','\u0416\u0438\u043c \u0433\u0430\u043d\u0442\u0435\u043b\u0435\u0439 \u043d\u0430 \u0441\u043a\u0430\u043c\u044c\u0435','\u0413\u0440\u0443\u0434\u044c \u0438 \u0442\u0440\u0438\u0446\u0435\u043f\u0441',['dumbbells','bench'],['shoulders','wrists']),
  exercise('band-chest-press','\u0416\u0438\u043c \u0441 \u0440\u0435\u0437\u0438\u043d\u043a\u043e\u0439','\u0413\u0440\u0443\u0434\u044c \u0438 \u0442\u0440\u0438\u0446\u0435\u043f\u0441',['bands'],['shoulders','wrists']),
  exercise('row','\u0422\u044f\u0433\u0430 \u0433\u0430\u043d\u0442\u0435\u043b\u0438 \u0432 \u043d\u0430\u043a\u043b\u043e\u043d\u0435','\u0421\u043f\u0438\u043d\u0430',['dumbbells'],['back','shoulders'],'reps',['band-row','supported-row']),
  exercise('dumbbell-row','\u0422\u044f\u0433\u0430 \u0433\u0430\u043d\u0442\u0435\u043b\u0438 \u0432 \u043d\u0430\u043a\u043b\u043e\u043d\u0435','\u0421\u043f\u0438\u043d\u0430 \u0438 \u0431\u0438\u0446\u0435\u043f\u0441',['dumbbells'],['back','shoulders']),
  exercise('supported-row','\u0422\u044f\u0433\u0430 \u0433\u0430\u043d\u0442\u0435\u043b\u0438 \u0441 \u043e\u043f\u043e\u0440\u043e\u0439','\u0421\u043f\u0438\u043d\u0430 \u0438 \u0431\u0438\u0446\u0435\u043f\u0441',['dumbbells','bench'],['back','shoulders']),
  exercise('band-row','\u0422\u044f\u0433\u0430 \u0440\u0435\u0437\u0438\u043d\u043a\u0438 \u043a \u043f\u043e\u044f\u0441\u0443','\u0421\u043f\u0438\u043d\u0430 \u0438 \u0431\u0438\u0446\u0435\u043f\u0441',['bands'],['back','shoulders']),
  exercise('assisted-pull-up','\u041f\u043e\u0434\u0442\u044f\u0433\u0438\u0432\u0430\u043d\u0438\u044f \u0441 \u0440\u0435\u0437\u0438\u043d\u043a\u043e\u0439','\u0421\u043f\u0438\u043d\u0430 \u0438 \u0431\u0438\u0446\u0435\u043f\u0441',['pullup_bar','bands'],['shoulders','elbows']),
  exercise('band-pull-apart','\u0420\u0430\u0437\u0432\u0435\u0434\u0435\u043d\u0438\u0435 \u0440\u0435\u0437\u0438\u043d\u043a\u0438','\u0412\u0435\u0440\u0445 \u0441\u043f\u0438\u043d\u044b',['bands'],['shoulders']),
  exercise('dumbbell-rdl','\u0420\u0443\u043c\u044b\u043d\u0441\u043a\u0430\u044f \u0442\u044f\u0433\u0430 \u0441 \u0433\u0430\u043d\u0442\u0435\u043b\u044f\u043c\u0438','\u042f\u0433\u043e\u0434\u0438\u0446\u044b \u0438 \u0437\u0430\u0434\u043d\u044f\u044f \u043f\u043e\u0432\u0435\u0440\u0445\u043d\u043e\u0441\u0442\u044c \u0431\u0435\u0434\u0440\u0430',['dumbbells'],['back','injury']),
  exercise('dumbbell-goblet-squat','\u041f\u0440\u0438\u0441\u0435\u0434 \u0441 \u0433\u0430\u043d\u0442\u0435\u043b\u044c\u044e','\u041d\u043e\u0433\u0438 \u0438 \u044f\u0433\u043e\u0434\u0438\u0446\u044b',['dumbbells'],['knees','injury','surgery']),
  exercise('dumbbell-split-squat','\u0412\u044b\u043f\u0430\u0434 \u0441 \u0433\u0430\u043d\u0442\u0435\u043b\u044f\u043c\u0438','\u041d\u043e\u0433\u0438 \u0438 \u044f\u0433\u043e\u0434\u0438\u0446\u044b',['dumbbells'],['knees','injury','surgery']),
  exercise('dumbbell-overhead-press','\u0416\u0438\u043c \u0433\u0430\u043d\u0442\u0435\u043b\u0435\u0439 \u0441\u0442\u043e\u044f','\u041f\u043b\u0435\u0447\u0438 \u0438 \u0442\u0440\u0438\u0446\u0435\u043f\u0441',['dumbbells'],['shoulders','neck','wrists']),
  exercise('band-lateral-walk','\u0411\u043e\u043a\u043e\u0432\u044b\u0435 \u0448\u0430\u0433\u0438 \u0441 \u0440\u0435\u0437\u0438\u043d\u043a\u043e\u0439','\u042f\u0433\u043e\u0434\u0438\u0446\u044b',['bands'],['knees','ankles']),
  exercise('band-pallof-press','\u041f\u0440\u0435\u0441\u0441 \u041f\u0430\u043b\u043b\u043e\u0444\u0430','\u041a\u043e\u0440',['bands'],['back']),
  exercise('dead-bug','\u041c\u0451\u0440\u0442\u0432\u044b\u0439 \u0436\u0443\u043a','\u041a\u043e\u0440',[],['back']),
  exercise('bird-dog','\u041f\u0442\u0438\u0446\u0430-\u0441\u043e\u0431\u0430\u043a\u0430','\u041a\u043e\u0440 \u0438 \u0441\u043f\u0438\u043d\u0430',[],['back','wrists']),
  exercise('plank','\u041f\u043b\u0430\u043d\u043a\u0430','\u041a\u043e\u0440',[],['shoulders','wrists','back'],'seconds'),
  exercise('side-plank','\u0411\u043e\u043a\u043e\u0432\u0430\u044f \u043f\u043b\u0430\u043d\u043a\u0430','\u041a\u043e\u0440',[],['shoulders','wrists','back'],'seconds'),
  exercise('mobility-flow','\u041c\u044f\u0433\u043a\u0430\u044f \u043c\u043e\u0431\u0438\u043b\u0438\u0437\u0430\u0446\u0438\u044f','\u041c\u043e\u0431\u0438\u043b\u044c\u043d\u043e\u0441\u0442\u044c',[],[],'seconds'),
  exercise('walking','\u0421\u043f\u043e\u043a\u043e\u0439\u043d\u0430\u044f \u0445\u043e\u0434\u044c\u0431\u0430','\u041b\u0451\u0433\u043a\u0430\u044f \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u044c',[],[],'seconds')
];

const byId=new Map(exerciseLibrary.map(value=>[value.id,value]));
const groups={
  push:['push-up-wall','incline-push-up','push-up','dumbbell-floor-press','dumbbell-bench-press','band-chest-press'],
  pull:['band-row','dumbbell-row','supported-row','assisted-pull-up','band-pull-apart'],
  squat:['squat','box-squat','dumbbell-goblet-squat','reverse-lunge','step-up','dumbbell-split-squat'],
  hinge:['glute-bridge','dumbbell-rdl','band-lateral-walk','calf-raise'],
  core:['dead-bug','bird-dog','plank','side-plank','band-pallof-press'],
  mobility:['mobility-flow','walking','dead-bug','bird-dog']
};
const dayNames={full_body:'\u0412\u0441\u0451 \u0442\u0435\u043b\u043e',upper:'\u0412\u0435\u0440\u0445 \u0442\u0435\u043b\u0430',lower:'\u041d\u0438\u0437 \u0442\u0435\u043b\u0430',recovery:'\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 \u0438 \u043c\u043e\u0431\u0438\u043b\u044c\u043d\u043e\u0441\u0442\u044c'};

export function canUseGenericProgram(plan,program){
  if(!plan)return true;
  if(plan.status!=='active'||(plan.safety?.intensityLimited&&program.intensity==='hard'))return false;
  const blocked=new Set(plan.safety?.blockedExerciseAreas||[]),equipment=new Set(plan.source?.equipment||[]);
  const hasGym=Array.isArray(plan.source?.locations)&&plan.source.locations.includes('gym')&&(equipment.has('standard_gym')||equipment.has('machines')||equipment.has('barbell'));
  return (program.exercises||[]).every(item=>{
    const exercise=byId.get(item.exerciseId);
    return !!exercise&&hasEquipment(exercise,equipment,hasGym)&&!exercise.contraindications.some(area=>blocked.has(area));
  });
}

export function seedTrainingExercises(db){
  const save=db.prepare('INSERT INTO catalog(id,kind,owner,data,archived) VALUES(?,?,NULL,?,0) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,data=excluded.data,archived=0 WHERE catalog.owner IS NULL');
  for(const item of exerciseLibrary) save.run(item.id,'exercise',JSON.stringify({...item,muscle:item.primaryMuscles,description:item.techniqueTips[0],unit:item.unit}));
}

function isoMonday(day){const date=new Date(`${day}T12:00:00Z`),weekday=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()-(weekday-1));return date.toISOString().slice(0,10);}
function addDays(day,offset){const date=new Date(`${day}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10);}
function hasEquipment(exercise,equipment,hasGym){return hasGym||exercise.equipment.every(item=>equipment.has(item)||(item==='dumbbells'&&equipment.has('adjustable_dumbbells'))); }
function safetyFrom(input,starter={}){
  const limitationSet=new Set((input.limitations||[]).filter(value=>value!=='none'));
  const area=input.areaStatusByArea||{};
  const kneeStatus=area.knees||[];
  const strictKnee=Array.isArray(kneeStatus)&&kneeStatus.some(value=>['pain','limited_mobility','recovery'].includes(value));
  const medicalGuidance=new Set(input.medicationGuidance||[]);
  const hasSpecialistGuidance=Object.values(area).some(value=>Array.isArray(value)&&value.includes('specialist_guidance'))||!!String(input.doctorRestrictions||'').trim();
  const needsClarification=medicalGuidance.has('avoid_exercises')||hasSpecialistGuidance;
  const restricted=!!input.doctorExerciseRestriction||!!input.acutePainNow||!!input.acutePainOrExerciseRestriction||((limitationSet.has('injury')||limitationSet.has('surgery'))&&input.returnToExerciseClearance==='no');
  const cautious=['knees','back','shoulders','neck','elbows','wrists','hips','ankles','injury','surgery'].some(item=>limitationSet.has(item));
  const intensityLimited=['asthma','cardio','diabetes','pregnancy'].some(item=>limitationSet.has(item))||input.medicationConsideration==='yes'||input.medicationConsideration==='unknown';
  return {limitationSet,area,strictKnee,restricted,needsClarification,cautious,intensityLimited,avoidHiit:!!starter?.safety?.avoidHiit||intensityLimited};
}
function isAllowed(exercise,equipment,hasGym,safety){
  if(!hasEquipment(exercise,equipment,hasGym))return false;
  if(exercise.contraindications.some(item=>safety.limitationSet.has(item)&&!(item==='knees'&&!safety.strictKnee)))return false;
  return true;
}
function scheduleFor(count,preferred=[]){
  const defaults={0:[],1:[[3,'full_body']],2:[[2,'full_body'],[5,'full_body']],3:[[1,'full_body'],[3,'full_body'],[5,'full_body']],4:[[1,'upper'],[2,'lower'],[4,'upper'],[5,'lower']],5:[[1,'upper'],[2,'lower'],[3,'recovery'],[5,'upper'],[6,'full_body']]}[count]||[];
  const requested=[...new Set(preferred.map(Number).filter(value=>Number.isInteger(value)&&value>=1&&value<=7))].sort((a,b)=>a-b);
  return requested.length===count?defaults.map(([_,kind],index)=>[requested[index],kind]):defaults;
}
function choose(group,equipment,hasGym,safety,used=[]){const options=(groups[group]||[]).map(id=>byId.get(id)).filter(Boolean).filter(item=>isAllowed(item,equipment,hasGym,safety));return options.find(item=>!used.includes(item.id))||options[0]||null;}
function buildExercise(exercise,index,experience,minutes,intensity,equipment,hasGym,safety,used,profile={}){
  if(!exercise)return null;
  const beginner=experience==='beginner',short=minutes<=20,sedentary=profile.activityLevel==='sedentary',muscleGoal=profile.goal==='gain_muscle';
  const sets=short?2:(beginner||sedentary)?2:muscleGoal?3:3;
  const seconds=exercise.unit==='seconds'?(short?25:(beginner||sedentary)?30:40):null;
  const reps=exercise.unit==='seconds'?null:(short?10:(beginner||sedentary)?10:muscleGoal?12:12);
  const variants=(groups[exercise.primaryMuscles.includes('\u0413\u0440\u0443\u0434')?'push':exercise.primaryMuscles.includes('\u0421\u043f\u0438\u043d')?'pull':exercise.primaryMuscles.includes('\u041d\u043e\u0433')?'squat':exercise.primaryMuscles.includes('\u042f\u0433')?'hinge':exercise.primaryMuscles.includes('\u041c\u043e\u0431')?'mobility':'core']||[]).map(id=>byId.get(id)).filter(item=>item&&item.id!==exercise.id&&isAllowed(item,equipment,hasGym,safety)).slice(0,3).map(item=>item.id);
  return {exerciseId:exercise.id,sets,reps,durationSeconds:seconds,restSeconds:intensity==='light'?45:beginner?75:90,weight:null,targetRpe:intensity==='light'?4:(beginner||sedentary)?5:6,targetEffort:intensity==='light'?'\u043b\u0451\u0433\u043a\u043e':'\u0443\u043c\u0435\u0440\u0435\u043d\u043d\u043e',order:index+1,notes:'',substitutionGroup:exercise.primaryMuscles,variants};
}
function buildDay(kind,weekday,minutes,experience,equipment,hasGym,safety,profile){
  const intensity=safety.intensityLimited?'light':kind==='recovery'?'light':'moderate';
  const required=kind==='upper'?['push','pull','core']:kind==='lower'?['squat','hinge','core']:kind==='recovery'?['mobility','core','mobility']:['squat','push','pull','hinge','core'];
  const used=[];
  const exerciseList=required.map(group=>{const item=choose(group,equipment,hasGym,safety,used);if(item)used.push(item.id);return item;}).filter(Boolean);
  const limited=minutes<=20?exerciseList.slice(0,3):exerciseList;
  return {id:`day-${weekday}-${kind}`,weekday,type:kind,name:dayNames[kind],durationMinutes:minutes,intensity,recoveryDay:kind==='recovery',status:'planned',exercises:limited.map((item,index)=>buildExercise(item,index,experience,minutes,intensity,equipment,hasGym,safety,used,profile)).filter(Boolean)};
}
function clampDays(input,starter,safety){
  const requested=Math.max(1,Math.min(5,Number(input.trainingDaysPerWeek)||3));
  const existing=starter?.training?.adjustment;
  if(safety.restricted)return {requested,planned:0,reduced:true,reasons:['direct_restriction']};
  if(safety.needsClarification)return {requested,planned:0,reduced:true,reasons:['specialist_restrictions']};
  if(existing?.reduced)return {requested,planned:Math.min(requested,Number(existing.plannedDaysPerWeek)||requested),reduced:true,reasons:existing.reasons||['physical_constraints']};
  if(safety.cautious)return {requested,planned:Math.min(requested,2),reduced:requested>2,reasons:requested>2?['physical_constraints']:[]};
  if(safety.intensityLimited)return {requested,planned:Math.min(requested,3),reduced:requested>3,reasons:requested>3?['intensity_constraints']:[]};
  return {requested,planned:requested,reduced:false,reasons:[]};
}

export function generateTrainingPlan({userId,onboarding,starterPlan={},referenceDate}){
  const safety=safetyFrom(onboarding,starterPlan),adjustment=clampDays(onboarding,starterPlan,safety);
  const locations=new Set(onboarding.trainingLocations||[]),equipment=new Set(onboarding.equipment||[]);
  const hasGym=locations.has('gym')&&(equipment.has('standard_gym')||equipment.has('machines')||equipment.has('barbell'));
  const minutes=Math.max(15,Math.min(90,Number(onboarding.trainingDurationMinutes)||30));
  const experience=onboarding.trainingExperience||'beginner';
  const profile={goal:onboarding.primaryGoal||'wellbeing',activityLevel:onboarding.activityLevel||'light',age:onboarding.age||null,sex:onboarding.sex||null};
  const days=scheduleFor(adjustment.planned,onboarding.preferredTrainingDays||[]).map(([weekday,type])=>buildDay(type,weekday,minutes,experience,equipment,hasGym,safety,profile));
  const safeDayCount=days.filter(day=>day.exercises.length>0).length;
  const finalAdjustment=safeDayCount<adjustment.planned?{...adjustment,planned:safeDayCount,reduced:true,reasons:[...adjustment.reasons,'no_safe_exercises']}:adjustment;
  const unavailable=finalAdjustment.planned===0;
  const status=safety.restricted||unavailable?'needs_review':'active';
  const safetyMessage=safety.restricted?'\u0412 \u0430\u043d\u043a\u0435\u0442\u0435 \u043e\u0442\u043c\u0435\u0447\u0435\u043d\u0430 \u043e\u0441\u0442\u0440\u0430\u044f \u0431\u043e\u043b\u044c \u0438\u043b\u0438 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u0435 \u0441\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442\u0430. \u0410\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0443\u044e \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0443 \u043d\u0435 \u0437\u0430\u043f\u0443\u0441\u043a\u0430\u0435\u043c.':unavailable?'\u041d\u0435 \u043d\u0430\u0448\u043b\u0438 \u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0445 \u0443\u043f\u0440\u0430\u0436\u043d\u0435\u043d\u0438\u0439 \u0434\u043b\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u043e\u0433\u043e \u0441\u0442\u0430\u0440\u0442\u0430. \u0421\u043d\u0430\u0447\u0430\u043b\u0430 \u0443\u0442\u043e\u0447\u043d\u0438 \u043d\u0430\u0433\u0440\u0443\u0437\u043a\u0443 \u0441\u043e \u0441\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442\u043e\u043c.':'\u041e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f \u0443\u0447\u0442\u0435\u043d\u044b \u043a\u0430\u043a \u0441\u0438\u0433\u043d\u0430\u043b \u0434\u043b\u044f \u0431\u043e\u043b\u0435\u0435 \u043e\u0441\u0442\u043e\u0440\u043e\u0436\u043d\u043e\u0433\u043e \u0441\u0442\u0430\u0440\u0442\u043e\u0432\u043e\u0433\u043e \u043f\u043e\u0434\u0431\u043e\u0440\u0430.';
  const template={id:randomUUID(),userId,version:1,status,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),source:{goal:onboarding.primaryGoal||'wellbeing',age:onboarding.age||null,sex:onboarding.sex||null,heightCm:onboarding.heightCm||null,weightKg:onboarding.weightKg||null,activityLevel:onboarding.activityLevel||'light',experience,locations:[...locations],equipment:[...equipment],preferences:{preferredTrainingDays:onboarding.preferredTrainingDays||[],preferredTrainingTime:onboarding.preferredTrainingTime||'any',trainingPreferences:onboarding.trainingPreferences||[]}},safety:{restricted:safety.restricted,cautious:safety.cautious,intensityLimited:safety.intensityLimited,limitations:[...safety.limitationSet],blockedExerciseAreas:[...safety.limitationSet].filter(area=>area!=='knees'||safety.strictKnee),message:safetyMessage},adjustment:{requestedDaysPerWeek:finalAdjustment.requested,plannedDaysPerWeek:finalAdjustment.planned,reduced:finalAdjustment.reduced,reasons:finalAdjustment.reasons},weeks:[{id:randomUUID(),weekStart:isoMonday(referenceDate),days}],progression:{mode:'rule_based',nextReviewAfterSessions:3}};
  return materializeTrainingPlan(template,referenceDate);
}
export function materializeTrainingPlan(plan,referenceDate){
  const weekStart=isoMonday(referenceDate),base=plan.weeks?.[0]||{days:[]};
  const activeDays=new Map((base.days||[]).map(day=>[day.weekday,day]));
  const days=Array.from({length:7},(_,index)=>{const weekday=index+1,day=activeDays.get(weekday),date=addDays(weekStart,index);return day?{...day,date}: {id:`recovery-${weekday}`,weekday,date,type:'recovery',name:'\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435',durationMinutes:0,intensity:'light',recoveryDay:true,status:'recovery',exercises:[]};});
  return {...plan,currentWeek:{id:base.id||'week',weekStart,days}};
}
export function saveTrainingPlan(db,userId,plan){
  const stored={...plan};delete stored.currentWeek;
  db.prepare('INSERT INTO training_plans(id,user_id,status,data,created,updated) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,status=excluded.status,data=excluded.data,updated=excluded.updated').run(stored.id,userId,stored.status,JSON.stringify(stored),stored.createdAt,stored.updatedAt);
  return stored;
}
export function readTrainingPlan(db,user,referenceDate){
  const row=db.prepare('SELECT data FROM training_plans WHERE user_id=?').get(user.id);
  return row?materializeTrainingPlan(JSON.parse(row.data),referenceDate):null;
}
export function ensureTrainingPlan(db,user,referenceDate){
  const current=readTrainingPlan(db,user,referenceDate);if(current)return current;
  const onboarding=db.prepare('SELECT completed,data,plan FROM onboarding WHERE user_id=?').get(user.id);
  if(!onboarding?.completed)return null;
  const generated=generateTrainingPlan({userId:user.id,onboarding:JSON.parse(onboarding.data),starterPlan:onboarding.plan?JSON.parse(onboarding.plan):{},referenceDate});
  saveTrainingPlan(db,user.id,generated);return generated;
}
export function sessionFromTrainingDay(plan,trainingDay,overrides={}){
  const day=plan.currentWeek?.days?.find(item=>item.id===trainingDay)||plan.currentWeek?.days?.find(item=>item.date===trainingDay);
  if(!day||!day.exercises.length||plan.status!=='active')return null;
  const exercises=day.exercises.map(item=>{const selected=overrides[item.exerciseId];const exerciseId=selected&&item.variants.includes(selected)?selected:item.exerciseId;const exercise=byId.get(exerciseId)||byId.get(item.exerciseId);return {exerciseId,name:exercise?.name||item.exerciseId,unit:exercise?.unit||'reps',equipment:exercise?.equipment||[],restSeconds:item.restSeconds,targetRpe:item.targetRpe,notes:item.notes,sets:Array.from({length:item.sets},()=>({reps:item.reps||item.durationSeconds||0,weight:item.weight||0,done:false}))};});
  return {name:day.name,programId:`personal:${plan.id}:${day.id}`,planId:plan.id,trainingDayId:day.id,intensity:day.intensity,minutes:day.durationMinutes,startedAt:new Date().toISOString(),exercises,feedback:null,progressRecommendation:null};
}
export function progressRecommendation(feedback={}){
  if(feedback.painOrDiscomfort)return {action:'reduce_load',label:'\u0421\u043d\u0438\u0437\u0438\u0442\u044c \u043d\u0430\u0433\u0440\u0443\u0437\u043a\u0443',reason:'\u0422\u044b \u043e\u0442\u043c\u0435\u0442\u0438\u043b \u0434\u0438\u0441\u043a\u043e\u043c\u0444\u043e\u0440\u0442: \u043d\u0430 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0439 \u0442\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0435 \u043e\u0441\u0442\u0430\u0432\u044c \u0431\u043e\u043b\u0435\u0435 \u043b\u0451\u0433\u043a\u0438\u0439 \u0432\u0430\u0440\u0438\u0430\u043d\u0442.'};
  if(!feedback.allSetsCompleted||Number(feedback.rpe)>=9)return {action:'reduce_load',label:'\u0421\u043d\u0438\u0437\u0438\u0442\u044c \u043d\u0430\u0433\u0440\u0443\u0437\u043a\u0443',reason:'\u041d\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0431\u044b\u043b\u0430 \u0432\u044b\u0441\u043e\u043a\u043e\u0439.'};
  if(Number(feedback.rpe)<=5)return {action:'increase_reps',label:'\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u043e\u0432\u0442\u043e\u0440\u0435\u043d\u0438\u044f',reason:'\u0422\u0440\u0435\u043d\u0438\u0440\u043e\u0432\u043a\u0430 \u043f\u0440\u043e\u0448\u043b\u0430 \u043b\u0435\u0433\u043a\u043e: \u0432 \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u043c \u0446\u0438\u043a\u043b\u0435 \u043c\u043e\u0436\u043d\u043e \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c 1\u20132 \u043f\u043e\u0432\u0442\u043e\u0440\u0430.'};
  if(Number(feedback.rpe)>=8)return {action:'keep_load',label:'\u041e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043d\u0430\u0433\u0440\u0443\u0437\u043a\u0443',reason:'\u041e\u0441\u0442\u0430\u0432\u044c \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u043e\u0431\u044a\u0451\u043c \u0434\u043e \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0439 \u043e\u0446\u0435\u043d\u043a\u0438.'};
  return {action:'keep_load',label:'\u041e\u0441\u0442\u0430\u0432\u0438\u0442\u044c \u043d\u0430\u0433\u0440\u0443\u0437\u043a\u0443',reason:'\u0412\u0441\u0451 \u0438\u0434\u0451\u0442 \u0440\u043e\u0432\u043d\u043e: \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u043c \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u0440\u0438\u0442\u043c.'};
}
