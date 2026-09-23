import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './database.mjs';
import { canUseGenericProgram, exerciseLibrary, generateTrainingPlan, progressRecommendation, sessionFromTrainingDay } from './training-plan.mjs';

const referenceDate='2026-09-23';
const base={
  primaryGoal:'wellbeing',age:31,heightCm:176,weightKg:74,activityLevel:'light',
  trainingDaysPerWeek:3,trainingDurationMinutes:30,trainingLocations:['home'],
  equipment:['dumbbells','bands','bench'],trainingExperience:'beginner',limitations:['none'],
  medicationConsideration:'no'
};
const activeDays=plan=>plan.currentWeek.days.filter(day=>day.exercises.length>0);
const hardDayPairs=plan=>plan.currentWeek.days.filter(day=>day.intensity==='hard').map(day=>day.weekday).some((day,index,days)=>index>0&&day-days[index-1]===1);

test('migration creates a personal-plan store and seeds the shared exercise catalogue',()=>{
  const folder=mkdtempSync(join(tmpdir(),'telo365-training-plan-'));
  try {
    const db=openDatabase(join(folder,'test.sqlite'));
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='training_plans'").get().name,'training_plans');
    assert.ok(db.prepare("SELECT count(*) AS count FROM catalog WHERE kind='exercise' AND owner IS NULL").get().count>=exerciseLibrary.length);
    db.close();
  } finally { rmSync(folder,{recursive:true,force:true}); }
});

test('exercise seed catalogue contains basic home exercise coverage and empty media placeholders',()=>{
  assert.ok(exerciseLibrary.length>=20);
  for(const item of exerciseLibrary){
    assert.equal(item.media.shortVideoUrl,null);
    assert.equal(item.media.posterUrl,null);
    assert.ok(Array.isArray(item.techniqueTips));
  }
  assert.ok(exerciseLibrary.some(item=>item.equipment.includes('dumbbells')));
  assert.ok(exerciseLibrary.some(item=>item.equipment.includes('bands')));
  assert.ok(exerciseLibrary.some(item=>item.equipment.includes('bench')));
  assert.ok(exerciseLibrary.some(item=>item.equipment.includes('pullup_bar')));
});

test('generator schedules the requested 2, 3, 4 and 5 weekly training days with recovery spacing',()=>{
  for(const count of [2,3,4,5]){
    const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,trainingDaysPerWeek:count},referenceDate});
    assert.equal(plan.status,'active');
    assert.equal(plan.adjustment.requestedDaysPerWeek,count);
    assert.equal(plan.adjustment.plannedDaysPerWeek,count);
    assert.equal(activeDays(plan).length,count);
    assert.equal(hardDayPairs(plan),false);
    if(count===2||count===3) assert.ok(activeDays(plan).every(day=>day.type==='full_body'));
    if(count===4) assert.deepEqual(activeDays(plan).map(day=>day.type),['upper','lower','upper','lower']);
    if(count===5){const recovery=plan.currentWeek.days.find(day=>day.recoveryDay&&day.exercises.length>0);assert.ok(recovery);assert.ok(sessionFromTrainingDay(plan,recovery.id));}
  }
});

test('generator uses only bodyweight exercises when no equipment is available',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,equipment:['none'],trainingDaysPerWeek:2},referenceDate});
  const equipmentById=new Map(exerciseLibrary.map(item=>[item.id,item.equipment]));
  for(const day of activeDays(plan)) for(const item of day.exercises) assert.deepEqual(equipmentById.get(item.exerciseId),[]);
});

test('adjustable dumbbells meet dumbbell exercise requirements',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,equipment:['adjustable_dumbbells'],trainingDaysPerWeek:2},referenceDate});
  assert.ok(activeDays(plan).some(day=>day.exercises.some(item=>['dumbbell-floor-press','dumbbell-row'].includes(item.exerciseId))));
});

test('body-area and intensity restrictions filter exercises and reduce an overly ambitious start',()=>{
  const plan=generateTrainingPlan({
    userId:'user-1',
    onboarding:{...base,trainingDaysPerWeek:5,limitations:['knees','cardio'],areaStatusByArea:{knees:['pain']},medicationConsideration:'yes'},
    referenceDate
  });
  assert.equal(plan.adjustment.requestedDaysPerWeek,5);
  assert.equal(plan.adjustment.plannedDaysPerWeek,2);
  assert.equal(plan.adjustment.reduced,true);
  assert.ok(plan.adjustment.reasons.includes('physical_constraints'));
  assert.ok(activeDays(plan).every(day=>day.intensity==='light'));
  const exercisesById=new Map(exerciseLibrary.map(item=>[item.id,item]));
  for(const day of activeDays(plan)) for(const item of day.exercises){
    const exercise=exercisesById.get(item.exerciseId);
    assert.equal(exercise?.contraindications.includes('knees'),false);
  }
});

test('a protection-only knee note keeps non-impact exercise options available',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,limitations:['knees'],areaStatusByArea:{knees:['protect']}},referenceDate});
  assert.equal(plan.status,'active');
  assert.ok(activeDays(plan).some(day=>day.exercises.some(item=>item.exerciseId==='squat')));
});

test("generic programs respect an active plan restrictions",()=>{
  const cautious=generateTrainingPlan({userId:'user-1',onboarding:{...base,limitations:['knees'],areaStatusByArea:{knees:['pain']}},referenceDate});
  assert.equal(canUseGenericProgram(cautious,{exercises:[{exerciseId:'squat'}]}),false);
  assert.equal(canUseGenericProgram(cautious,{exercises:[{exerciseId:'push-up-wall'}]}),true);
  const cardio=generateTrainingPlan({userId:'user-1',onboarding:{...base,limitations:['cardio']},referenceDate});
  assert.equal(canUseGenericProgram(cardio,{intensity:'hard',exercises:[{exerciseId:'push-up-wall'}]}),false);
  assert.equal(canUseGenericProgram(cardio,{intensity:'light',exercises:[{exerciseId:'push-up-wall'}]}),true);
});

test('a recommendation to avoid unspecified exercises waits for clarification',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,medicationConsideration:'yes',medicationGuidance:['avoid_exercises']},referenceDate});
  assert.equal(plan.status,'needs_review');
  assert.equal(plan.adjustment.plannedDaysPerWeek,0);
  assert.ok(plan.adjustment.reasons.includes('specialist_restrictions'));
});

test('a missing clearance after injury does not create an automatic training session',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,limitations:['injury'],returnToExerciseClearance:'no'},referenceDate});
  assert.equal(plan.status,'needs_review');
  assert.equal(plan.adjustment.plannedDaysPerWeek,0);
});

test('direct restriction does not create an automatic training session',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,doctorExerciseRestriction:true,trainingDaysPerWeek:3},referenceDate});
  assert.equal(plan.status,'needs_review');
  assert.equal(plan.adjustment.plannedDaysPerWeek,0);
  assert.equal(activeDays(plan).length,0);
  assert.equal(sessionFromTrainingDay(plan,'day-1-full_body'),null);
});

test('post-workout rule based progression remains conservative after pain or high effort',()=>{
  assert.equal(progressRecommendation({rpe:4,allSetsCompleted:true,painOrDiscomfort:false}).action,'increase_reps');
  assert.equal(progressRecommendation({rpe:6,allSetsCompleted:true,painOrDiscomfort:false}).action,'keep_load');
  assert.equal(progressRecommendation({rpe:9,allSetsCompleted:true,painOrDiscomfort:false}).action,'reduce_load');
  assert.equal(progressRecommendation({rpe:5,allSetsCompleted:false,painOrDiscomfort:false}).action,'reduce_load');
  assert.equal(progressRecommendation({rpe:3,allSetsCompleted:true,painOrDiscomfort:true}).action,'reduce_load');
});
