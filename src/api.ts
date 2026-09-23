export type HydrationProfile={ageBand:'teen'|'adult'|'older';sex:'female'|'male'|'unspecified';stage:'standard'|'pregnancy'|'lactation';doctorLimit:number|null}
export type User = {id:string;email:string;emailVerified:boolean;name:string;goal:string;target:number|null;targetLow:number|null;targetHigh:number|null;timezone:string;calories:number|null;hydration:HydrationProfile;role:string;onboardingCompleted?:boolean}
export type Macros = {kcal:number;p:number;f:number;c:number}
export type Ingredient = {foodId:string;name:string;grams:number;source:string}
export type Snapshot = Macros & {name:string;image:string;instructions:string;ingredients:Ingredient[];sample:boolean}
export type ExerciseMedia={shortVideoUrl:string|null;posterUrl:string|null;duration:number|null;angle:string|null;trainerName?:string|null}
export type ExerciseVariant={id:string;name?:string;when?:string}
export type Exercise={id:string;name:string;primaryMuscles:string;secondaryMuscles:string[];difficulty:string;equipment:string[];contraindications:string[];techniqueTips:string[];media:ExerciseMedia;variants:string[];unit:'reps'|'seconds'}
export type WorkoutSet={reps:number;weight:number;done:boolean;plannedReps?:number;plannedWeight?:number}
export type ExerciseAlternative={exerciseId:string;reason:'easier'|'harder'|'reduce_knee_load'|'reduce_shoulder_load'|'equipment'|'same_pattern';movementPattern:string}
export type WorkoutExercise={exerciseId:string;name?:string;unit:'reps'|'seconds';equipment?:string[];sets:WorkoutSet[];restSeconds?:number;targetRpe?:number;notes?:string;substitutionGroup?:string;alternatives?:ExerciseAlternative[];variants?:string[]}
export type TrainingDay={id:string;weekday:number;date:string;type:string;name:string;durationMinutes:number;intensity:'light'|'moderate'|'hard';recoveryDay:boolean;status:string;exercises:{exerciseId:string;sets:number;reps:number|null;durationSeconds:number|null;restSeconds:number;weight:number|null;targetRpe:number;targetEffort:string;order:number;notes:string;substitutionGroup:string;variants:string[]}[]}
export type TrainingWeek={id:string;weekStart:string;days:TrainingDay[]}
export type TrainingPlan={id:string;status:'active'|'needs_review';source:Record<string,unknown>;safety:{restricted:boolean;cautious:boolean;intensityLimited:boolean;limitations:string[];blockedExerciseAreas?:string[];message:string};adjustment:{requestedDaysPerWeek:number;plannedDaysPerWeek:number;reduced:boolean;reasons:string[]};currentWeek:TrainingWeek;progression:{mode:'rule_based';nextReviewAfterSessions:number}}
export type CatalogItem = {id:string;kind:string;name:string;owner:string|null;kcal?:number;p?:number;f?:number;c?:number;source?:string;sample?:boolean;instructions?:string;image?:string;nutrition?:Snapshot;ingredients?:{foodId:string;grams:number}[];description?:string;minutes?:number;intensity?:'light'|'moderate'|'hard';muscle?:string;unit?:'reps'|'seconds';exercises?:{exerciseId:string;sets:number;reps:number;weight:number}[];primaryMuscles?:string;secondaryMuscles?:string[];difficulty?:string;equipment?:string[];contraindications?:string[];techniqueTips?:string[];media?:ExerciseMedia;variants?:string[]}
export type Meal = {id:string;date:string;slot:string;servings:number;eaten:boolean;snapshot:Snapshot}
export type ExerciseLog=WorkoutExercise
export type Workout={id:string;date:string;finished:boolean;data:{name:string;programId:string;planId?:string;trainingDayId?:string;intensity?:string;minutes?:number;startedAt?:string;exercises:WorkoutExercise[];feedback?:{rpe:number;allSetsCompleted:boolean;painOrDiscomfort:boolean}|null;progressRecommendation?:{action:string;label:string;reason:string}|null}}
export type Shop = {id:string;name:string;amount:number;unit:string;checked:number;generated:number}
export type NutritionProfile = {style:'home'|'mixed'|'ready';cooking:'quick'|'normal'|'free';budget:'economy'|'balanced'|'free';exclusions:string}
export type Habit = {id:string;name:string;icon:string;schedule:'daily'|'weekdays'|'weekends';weeklyTarget:number;tracking:'check'|'counter'|'hydration';target:number;unit:string;archived:number}
export type HabitValue = {habit_id:string;date:string;value:number;details:Record<string,number>}
export type State = {user:User;date:string;today:string;weights:{date:string;value:number}[];habits:Habit[];marks:{habit_id:string;date:string;done:number}[];habitValues:HabitValue[];meals:Meal[];workouts:Workout[];shopping:Shop[];catalog:CatalogItem[];nutritionProfile:NutritionProfile|null;onboardingPlan?:{calories:number;trainingDaysPerWeek:number;trainingDurationMinutes:number;healthSafetyLevel:string;[key:string]:unknown}|null;trainingPlan?:TrainingPlan|null}
export class ApiError extends Error { status:number; constructor(status:number,message:string){super(message);this.status=status} }
export async function api<T=Record<string,unknown>>(path:string,method='GET',data?:unknown):Promise<T> {
  let response:Response;
  try {response=await fetch(path,{method,credentials:'same-origin',headers:method==='GET'?{}:{'Content-Type':'application/json','X-Telo365':'1'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(20000)});} catch {throw new ApiError(0,'Нет связи с сервером. Проверьте подключение и повторите.')}
  const result=await response.json().catch(()=>({error:'Сервер временно недоступен'}));
  if(!response.ok)throw new ApiError(response.status,result.error||'Не удалось сохранить');
  return result as T;
}
export const fmt=(n:number)=>n.toLocaleString('ru-RU',{maximumFractionDigits:1});
export function download(name:string,value:string,type='text/plain') {const url=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
export type Mutate = (path:string,method:string,body?:unknown)=>Promise<void>
