import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  if (path !== ':memory:') chmodSync(path, 0o600);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 10) throw new Error('Database is newer than this application');
  if (version === 0) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE users(id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password TEXT NOT NULL, recovery TEXT NOT NULL,
        name TEXT NOT NULL, goal TEXT NOT NULL DEFAULT 'wellbeing', target REAL, timezone TEXT NOT NULL DEFAULT 'Europe/Moscow',
        calories INTEGER, role TEXT NOT NULL DEFAULT 'user', created TEXT NOT NULL);
      CREATE TABLE sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL);
      CREATE TABLE weights(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, value REAL NOT NULL, PRIMARY KEY(user_id,date));
      CREATE TABLE habits(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE marks(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE, date TEXT NOT NULL, done INTEGER NOT NULL, PRIMARY KEY(user_id,habit_id,date));
      CREATE TABLE catalog(id TEXT PRIMARY KEY, kind TEXT NOT NULL, owner TEXT REFERENCES users(id) ON DELETE CASCADE, data TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE meals(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, slot TEXT NOT NULL, servings REAL NOT NULL, eaten INTEGER NOT NULL DEFAULT 0, snapshot TEXT NOT NULL);
      CREATE INDEX meals_user_date ON meals(user_id,date);
      CREATE TABLE workouts(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, date TEXT NOT NULL, finished INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL);
      CREATE INDEX workouts_user_date ON workouts(user_id,date);
      CREATE TABLE shopping(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, amount REAL NOT NULL, unit TEXT NOT NULL, checked INTEGER NOT NULL DEFAULT 0, generated INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE limits(key TEXT PRIMARY KEY, hits INTEGER NOT NULL, until INTEGER NOT NULL);
      CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
      PRAGMA user_version=1;
      COMMIT;`);
    seed(db);
  }
  if (version < 2) db.exec(`BEGIN IMMEDIATE;
    ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE email_tokens(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,purpose TEXT NOT NULL,email TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE INDEX email_tokens_user ON email_tokens(user_id,purpose);
    PRAGMA user_version=2; COMMIT;`);
  if (version < 3) db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE feedback(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL,message TEXT NOT NULL,created TEXT NOT NULL);
    CREATE TABLE analytics_daily(day TEXT NOT NULL,event TEXT NOT NULL,hits INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,event));
    PRAGMA user_version=3; COMMIT;`);
  if (version < 4) db.exec(`BEGIN IMMEDIATE;
    CREATE TABLE nutrition_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data TEXT NOT NULL,updated TEXT NOT NULL);
    PRAGMA user_version=4; COMMIT;`);
  if (version < 5) { expandCatalog(db); db.exec('PRAGMA user_version=5'); }
  if (version < 6) db.exec(`BEGIN IMMEDIATE;
    ALTER TABLE habits ADD COLUMN icon TEXT NOT NULL DEFAULT '✨';
    ALTER TABLE habits ADD COLUMN schedule TEXT NOT NULL DEFAULT 'daily';
    ALTER TABLE habits ADD COLUMN weekly_target INTEGER NOT NULL DEFAULT 7;
    UPDATE habits SET icon=CASE name WHEN 'Вода' THEN '💧' WHEN 'Сон' THEN '🌙' WHEN 'Прогулка' THEN '🚶' WHEN 'Питание' THEN '🥗' WHEN 'Движение' THEN '🏋️' ELSE '✨' END;
    PRAGMA user_version=6; COMMIT;`);
  if (version < 7) db.exec(`BEGIN IMMEDIATE;
    ALTER TABLE habits ADD COLUMN tracking TEXT NOT NULL DEFAULT 'check';
    ALTER TABLE habits ADD COLUMN target REAL NOT NULL DEFAULT 0;
    ALTER TABLE habits ADD COLUMN unit TEXT NOT NULL DEFAULT '';
    CREATE TABLE habit_values(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,habit_id TEXT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,date TEXT NOT NULL,value REAL NOT NULL,details TEXT NOT NULL DEFAULT '{}',PRIMARY KEY(user_id,habit_id,date));
    UPDATE habits SET tracking='hydration',target=2000,unit='мл' WHERE name='Вода';
    PRAGMA user_version=7; COMMIT;`);
  if (version < 8) db.exec(`BEGIN IMMEDIATE;
    ALTER TABLE users ADD COLUMN hydration TEXT NOT NULL DEFAULT '{}';
    PRAGMA user_version=8; COMMIT;`);
  if (version < 9) {
    db.exec('BEGIN IMMEDIATE');
    const add=db.prepare('INSERT OR IGNORE INTO catalog(id,kind,owner,data) VALUES(?,?,NULL,?)');
    for(const [id,name,kcal,p,f,c] of [['drink-lemonade','Лимонад',40,0,0,10],['drink-juice','Сок',45,0.5,0.1,10.5],['drink-milk','Молоко',52,3,2.5,4.7]]) add.run(id,'food',JSON.stringify({name,kcal,p,f,c,source:'Справочный ориентир на 100 мл. Проверьте этикетку своего напитка.',sample:true}));
    db.exec('PRAGMA user_version=9; COMMIT;');
  }
  if (version < 10) db.exec(`BEGIN IMMEDIATE;
    ALTER TABLE users ADD COLUMN target_low REAL;
    ALTER TABLE users ADD COLUMN target_high REAL;
    PRAGMA user_version=10; COMMIT;`);
  return db;
}

export function transaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const result = fn(); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

function seed(db) {
  const source = 'Учебный пример. Замените значениями с упаковки вашего продукта.';
  const foods = [
    ['oats', 'Овсяные хлопья', 370, 13, 7, 60], ['milk', 'Молоко', 52, 3, 2.5, 4.7],
    ['berries', 'Ягоды', 45, 1, 0.5, 8], ['chicken', 'Куриная грудка', 113, 23.6, 1.9, 0],
    ['buckwheat', 'Гречка сухая', 330, 12.6, 3.3, 62], ['broccoli', 'Брокколи', 34, 2.8, 0.4, 6.6],
    ['yogurt', 'Йогурт без добавок', 73, 9, 2, 4]
  ];
  const add = db.prepare('INSERT INTO catalog(id,kind,owner,data) VALUES(?,?,NULL,?)');
  for (const [id, name, kcal, p, f, c] of foods) add.run(id, 'food', JSON.stringify({name, kcal, p, f, c, source, sample:true}));
  add.run('oatmeal','recipe',JSON.stringify({name:'Овсяная каша с ягодами',image:'breakfast',instructions:'Сварите хлопья на молоке, добавьте ягоды. Количество ингредиентов указано на одну порцию.',ingredients:[{foodId:'oats',grams:60},{foodId:'milk',grams:150},{foodId:'berries',grams:80}],sample:true}));
  add.run('chicken-bowl','recipe',JSON.stringify({name:'Курица с гречкой и брокколи',image:'lunch',instructions:'Отварите гречку. Приготовьте курицу до полной готовности, брокколи — на пару. Подайте вместе.',ingredients:[{foodId:'chicken',grams:150},{foodId:'buckwheat',grams:60},{foodId:'broccoli',grams:150}],sample:true}));
  const exercises = [ ['squat','Приседания с гантелями','Ноги и ягодицы'], ['press','Жим гантелей лёжа','Грудь и руки'], ['row','Тяга гантели в наклоне','Спина'], ['plank','Планка','Мышцы кора'] ];
  for (const [id,name,muscle] of exercises) add.run(id,'exercise',JSON.stringify({name,muscle,description:'Пример упражнения для самостоятельного дневника. Рабочую нагрузку и технику выбирайте с учётом подготовки.',unit:id==='plank'?'seconds':'reps'}));
  add.run('full-body','program',JSON.stringify({name:'Всё тело',description:'Пример плана для дневника тренировок',minutes:45,exercises:exercises.map(([exerciseId])=>({exerciseId,sets:3,reps:exerciseId==='plank'?45:12,weight:0}))}));
  db.prepare('INSERT INTO settings VALUES(?,?)').run('intro','Питание, движение и привычки в твоём ритме.');
}

function expandCatalog(db) {
  const add=db.prepare('INSERT OR IGNORE INTO catalog(id,kind,owner,data) VALUES(?,?,NULL,?)');
  const foods=[['eggs','Яйца',143,13,10,1],['rice','Рис сухой',340,7,1,78],['tomato','Томаты',18,1,0.2,3.9],['cucumber','Огурцы',15,0.8,0.1,2.8],['salmon','Лосось',208,20,13,0],['bread','Цельнозерновой хлеб',245,9,3.5,43],['cottage','Творог 5%',121,17,5,3],['banana','Банан',89,1.1,0.3,23],['pasta','Паста цельнозерновая сухая',348,13,2.5,65],['beans','Фасоль консервированная',90,6,0.5,14]];
  for(const [id,name,kcal,p,f,c] of foods)add.run(id,'food',JSON.stringify({name,kcal,p,f,c,source:'Справочный каталог: проверьте этикетку',sample:true}));
  const recipes=[
    ['omelette','Омлет с овощами','breakfast','Взбейте яйца, приготовьте на сковороде, подайте с овощами и хлебом',[['eggs',150],['tomato',120],['cucumber',100],['bread',40]]],
    ['curd-bowl','Творог с бананом и ягодами','snack','Смешайте творог с нарезанным бананом и ягодами.',[['cottage',200],['banana',120],['berries',60]]],
    ['rice-chicken','Курица с рисом и брокколи','lunch','Отварите рис, приготовьте курицу и брокколи, соедините в тарелке.',[['chicken',150],['rice',70],['broccoli',150]]],
    ['salmon-pasta','Паста с лососем и томатами','dinner','Отварите пасту, добавьте запечённый лосось и томаты.',[['salmon',130],['pasta',80],['tomato',150]]],
    ['beans-bowl','Боул с фасолью и овощами','lunch','Соедините фасоль, готовый рис и свежие овощи.',[['beans',160],['rice',60],['tomato',120],['cucumber',120]]]
  ];
  for(const [id,name,image,instructions,ingredients] of recipes)add.run(id,'recipe',JSON.stringify({name,image,instructions,ingredients:ingredients.map(([foodId,grams])=>({foodId,grams})),sample:true}));
}

export function createHabits(db, userId) {
  const statement = db.prepare('INSERT INTO habits(id,user_id,name,icon,schedule,weekly_target,tracking,target,unit) VALUES(?,?,?,?,?,?,?,?,?)');
  for (const [name,icon,schedule,weeklyTarget,tracking,target,unit] of [['Вода','💧','daily',7,'hydration',2000,'мл'],['Сон','🌙','daily',7,'check',0,''],['Прогулка','🚶','daily',5,'check',0,''],['Питание','🥗','daily',5,'check',0,''],['Движение','🏋️','daily',4,'check',0,'']]) statement.run(randomUUID(), userId, name,icon,schedule,weeklyTarget,tracking,target,unit);
}

export async function backupDatabase(db, destination) {
  mkdirSync(dirname(resolve(destination)), {recursive:true, mode:0o700});
  await backup(db, destination);
  chmodSync(destination, 0o600);
}
