import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './database.mjs';
import { canUseGenericProgram, exerciseLibrary, generateTrainingPlan, materializeTrainingPlan, progressRecommendation, sessionFromTrainingDay } from './training-plan.mjs';

const referenceDate='2026-09-23';
const base={
  primaryGoal:'wellbeing',age:31,heightCm:176,weightKg:74,activityLevel:'light',
  trainingDaysPerWeek:2,trainingDurationMinutes:30,trainingLocations:['home'],
  equipment:['dumbbells','bands','bench'],trainingExperience:'beginner',limitations:['none'],
  medicationConsideration:'no',preferredTrainingDays:[1,3,5]
};
const strengthDays=plan=>plan.currentWeek.days.filter(day=>day.exercises.length>0);
const catalogueById=new Map(exerciseLibrary.map(item=>[item.id,item]));

function assertEquipmentMatches(plan){
  const equipment=new Set((plan.source.equipment||[]).filter(item=>item!=='none'));
  for(const day of strengthDays(plan))for(const entry of day.exercises){
    const exercise=catalogueById.get(entry.exerciseId);
    assert.ok(exercise,`unknown exercise ${entry.exerciseId}`);
    assert.ok(exercise.equipment.every(item=>equipment.has(item)||(item==='dumbbells'&&equipment.has('adjustable_dumbbells'))),`${entry.exerciseId} needs unavailable equipment`);
  }
}

test('migration creates a personal-plan store and seeds the normalized exercise catalogue',()=>{
  const folder=mkdtempSync(join(tmpdir(),'telo365-training-plan-'));
  try {
    const db=openDatabase(join(folder,'test.sqlite'));
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='training_plans'").get().name,'training_plans');
    assert.ok(db.prepare("SELECT count(*) AS count FROM catalog WHERE kind='exercise' AND owner IS NULL").get().count>=exerciseLibrary.length);
    assert.equal(db.prepare('PRAGMA user_version').get().user_version,17);
    db.close();
  } finally { rmSync(folder,{recursive:true,force:true}); }
});

test('exercise catalogue is normalized and keeps local media placeholders',()=>{
  assert.ok(exerciseLibrary.length>=25);
  for(const item of exerciseLibrary){
    for(const key of ['id','name','movementPattern','primaryMuscles','secondaryMuscles','equipment','difficulty','locations','cautionTags','contraindicationTags','alternatives','animationKey','instructions','defaultRestSeconds'])assert.ok(key in item,`${item.id} lacks ${key}`);
    assert.ok(Array.isArray(item.primaryMuscles));
    assert.ok(Array.isArray(item.secondaryMuscles));
    assert.equal(item.media.shortVideoUrl,null);
    assert.equal(item.media.posterUrl,null);
  }
  for(const pattern of ['squat','hinge','horizontal_push','horizontal_pull','vertical_push','vertical_pull','carry','core','locomotion','mobility'])assert.ok(exerciseLibrary.some(item=>item.movementPattern===pattern),`missing ${pattern}`);
});

test('novice at home with dumbbells gets conservative Strength A and Strength B',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:base,referenceDate});
  const days=strengthDays(plan);
  assert.equal(plan.status,'active');
  assert.equal(plan.adjustment.plannedDaysPerWeek,2);
  assert.deepEqual(days.map(day=>day.name),['Тренировка A','Тренировка B']);
  assert.notDeepEqual(days[0].exercises.map(item=>item.exerciseId),days[1].exercises.map(item=>item.exerciseId));
  assert.ok(days.every(day=>day.intensity==='light'));
  assert.ok(days.every(day=>day.exercises.every(item=>item.sets===2&&item.targetRpe<=5)));
  assertEquipmentMatches(plan);
});

test('novice treats five available days as an upper bound and leaves recovery days',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,trainingDaysPerWeek:5},referenceDate});
  assert.equal(plan.adjustment.requestedDaysPerWeek,5);
  assert.equal(plan.adjustment.plannedDaysPerWeek,2);
  assert.equal(plan.adjustment.reduced,true);
  assert.ok(plan.adjustment.reasons.includes('beginner_conservative_start'));
  assert.equal(strengthDays(plan).length,2);
  assert.equal(plan.currentWeek.days.filter(day=>day.recoveryDay).length,5);
});

test('three-day A/B cycle changes to B/A/B in the following week',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,trainingExperience:'some',trainingDaysPerWeek:3},referenceDate});
  assert.deepEqual(strengthDays(plan).map(day=>day.name),['Тренировка A','Тренировка B','Тренировка A']);
  const next=materializeTrainingPlan(plan,'2026-09-28');
  assert.deepEqual(strengthDays(next).map(day=>day.name),['Тренировка B','Тренировка A','Тренировка B']);
});

test('no equipment only selects bodyweight exercises',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,equipment:['none']},referenceDate});
  for(const day of strengthDays(plan))for(const item of day.exercises)assert.deepEqual(catalogueById.get(item.exerciseId).equipment,[]);
});

test('20-minute training keeps a compact prescription',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,trainingDurationMinutes:20},referenceDate});
  for(const day of strengthDays(plan)){
    assert.ok(day.exercises.length<=3);
    assert.ok(day.exercises.every(item=>item.sets===2&&item.restSeconds<=60));
  }
});

test('knee limitation lowers exercise priority and strict knee context filters irritating alternatives',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,limitations:['knees'],areaStatusByArea:{knees:['pain']}},referenceDate});
  assert.equal(plan.adjustment.plannedDaysPerWeek,2);
  for(const day of strengthDays(plan))for(const item of day.exercises){
    const selected=catalogueById.get(item.exerciseId);
    assert.equal(selected.cautionTags.includes('knees'),false,`${selected.id} should not be selected under knee pain`);
    for(const alternative of item.alternatives)assert.equal(catalogueById.get(alternative.exerciseId).cautionTags.includes('knees'),false,`${alternative.exerciseId} should respect knee limitation`);
  }
});

test('cardiovascular caution keeps the automatic plan light and excludes hard generic programs',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,trainingDaysPerWeek:5,limitations:['cardio'],medicationConsideration:'yes'},referenceDate});
  assert.equal(plan.adjustment.plannedDaysPerWeek,2);
  assert.ok(strengthDays(plan).every(day=>day.intensity==='light'));
  assert.equal(canUseGenericProgram(plan,{intensity:'hard',exercises:[{exerciseId:'push-up-wall'}]}),false);
});

test('experienced user can receive four balanced split sessions with recovery spacing',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,trainingExperience:'advanced',trainingDaysPerWeek:4,trainingDurationMinutes:60},referenceDate});
  const days=strengthDays(plan);
  assert.equal(days.length,4);
  assert.deepEqual(days.map(day=>day.name),['Верх тела A','Низ тела A','Верх тела B','Низ тела B']);
  assert.ok(days.every(day=>day.intensity==='moderate'));
  assert.ok(days.every(day=>day.exercises.some(item=>item.targetRpe===7)));
  assertEquipmentMatches(plan);
});

test('direct doctor restriction produces a safe review state with no standard session',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,doctorExerciseRestriction:true},referenceDate});
  assert.equal(plan.status,'needs_review');
  assert.equal(plan.adjustment.plannedDaysPerWeek,0);
  assert.equal(strengthDays(plan).length,0);
  assert.equal(sessionFromTrainingDay(plan,'day-1-A'),null);
});

test('selected alternatives are compatible with equipment and strict limitations',()=>{
  const plan=generateTrainingPlan({userId:'user-1',onboarding:{...base,limitations:['knees'],areaStatusByArea:{knees:['pain']}},referenceDate});
  const equipment=new Set(base.equipment);
  for(const day of strengthDays(plan))for(const item of day.exercises)for(const alternative of item.alternatives){
    const candidate=catalogueById.get(alternative.exerciseId);
    assert.ok(candidate.equipment.every(value=>equipment.has(value)));
    assert.equal(candidate.cautionTags.includes('knees'),false);
    assert.ok(['same_pattern','equipment','reduce_knee_load','reduce_shoulder_load'].includes(alternative.reason));
  }
});

test('every generated strength exercise carries two to four usable alternatives',()=>{
  const scenarios=[base,{...base,equipment:['none']},{...base,limitations:['knees'],areaStatusByArea:{knees:['pain']}}];
  for(const onboarding of scenarios){
    const plan=generateTrainingPlan({userId:'user-1',onboarding,referenceDate});
    for(const day of strengthDays(plan))for(const item of day.exercises){
      assert.ok(item.alternatives.length>=2&&item.alternatives.length<=4,`${item.exerciseId} needs 2–4 alternatives`);
    }
  }
});

test('one feedback entry is stored as context without changing the plan, repeated hard feedback is conservative',()=>{
  const unchanged=generateTrainingPlan({userId:'user-1',onboarding:{...base,trainingDaysPerWeek:3,trainingExperience:'some'},recentFeedback:[{rpe:9,painOrDiscomfort:true}],referenceDate});
  assert.equal(unchanged.adjustment.plannedDaysPerWeek,3);
  const cautious=generateTrainingPlan({userId:'user-1',onboarding:{...base,trainingDaysPerWeek:5,trainingExperience:'regular'},recentFeedback:[{rpe:9,painOrDiscomfort:true},{rpe:8,painOrDiscomfort:true}],referenceDate});
  assert.equal(cautious.adjustment.plannedDaysPerWeek,2);
  assert.ok(cautious.adjustment.reasons.includes('recent_feedback'));
});

test('post-workout rule based progression remains conservative after pain or high effort',()=>{
  assert.equal(progressRecommendation({rpe:4,allSetsCompleted:true,painOrDiscomfort:false}).action,'increase_reps');
  assert.equal(progressRecommendation({rpe:6,allSetsCompleted:true,painOrDiscomfort:false}).action,'keep_load');
  assert.equal(progressRecommendation({rpe:9,allSetsCompleted:true,painOrDiscomfort:false}).action,'reduce_load');
  assert.equal(progressRecommendation({rpe:5,allSetsCompleted:false,painOrDiscomfort:false}).action,'reduce_load');
  assert.equal(progressRecommendation({rpe:3,allSetsCompleted:true,painOrDiscomfort:true}).action,'reduce_load');
});
