import { fail, numeric, string } from './security.mjs';

const ageBands=['teen','adult','older'];
const sexes=['female','male','unspecified'];
const stages=['standard','pregnancy','lactation'];

export function hydrationProfile(value={}) {
  if(!value||Array.isArray(value)||typeof value!=='object') fail(400,'Проверьте настройки жидкости');
  const ageBand=string(value.ageBand??'adult','Возрастная группа',20),sex=string(value.sex??'unspecified','Пол',20),stage=string(value.stage??'standard','Состояние',20);
  if(!ageBands.includes(ageBand)||!sexes.includes(sex)||!stages.includes(stage)) fail(400,'Проверьте настройки жидкости');
  const doctorLimit=value.doctorLimit==null||value.doctorLimit===''?null:numeric(value.doctorLimit,'Лимит жидкости',500,10000);
  return {ageBand,sex,stage,doctorLimit};
}

export function hydrationGoal(profile) {
  if(profile.doctorLimit!==null) return profile.doctorLimit;
  if(profile.stage==='lactation') return 3000;
  if(profile.stage==='pregnancy') return 2400;
  const total=profile.sex==='male'?(profile.ageBand==='teen'?3300:3700):profile.sex==='female'?(profile.ageBand==='teen'?2300:2700):(profile.ageBand==='teen'?2800:3200);
  return Math.round(total*.8/100)*100;
}
