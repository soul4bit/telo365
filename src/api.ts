export type User = {id:string;email:string;emailVerified:boolean;name:string;goal:string;target:number|null;timezone:string;calories:number|null;role:string}
export type Macros = {kcal:number;p:number;f:number;c:number}
export type Ingredient = {foodId:string;name:string;grams:number;source:string}
export type Snapshot = Macros & {name:string;image:string;instructions:string;ingredients:Ingredient[];sample:boolean}
export type CatalogItem = {id:string;kind:string;name:string;owner:string|null;kcal?:number;p?:number;f?:number;c?:number;source?:string;sample?:boolean;instructions?:string;image?:string;nutrition?:Snapshot;ingredients?:{foodId:string;grams:number}[];description?:string;minutes?:number;muscle?:string;unit?:string;exercises?:{exerciseId:string;sets:number;reps:number;weight:number}[]}
export type Meal = {id:string;date:string;slot:string;servings:number;eaten:boolean;snapshot:Snapshot}
export type ExerciseLog = {name:string;unit:string;sets:{reps:number;weight:number;done:boolean}[]}
export type Workout = {id:string;date:string;finished:boolean;data:{name:string;programId:string;exercises:ExerciseLog[]}}
export type Shop = {id:string;name:string;amount:number;unit:string;checked:number;generated:number}
export type State = {user:User;date:string;today:string;weights:{date:string;value:number}[];habits:{id:string;name:string;archived:number}[];marks:{habit_id:string;date:string;done:number}[];meals:Meal[];workouts:Workout[];shopping:Shop[];catalog:CatalogItem[]}
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
