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
  if (version > 4) throw new Error('Database is newer than this application');
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

export function createHabits(db, userId) {
  const statement = db.prepare('INSERT INTO habits(id,user_id,name) VALUES(?,?,?)');
  for (const name of ['Вода','Сон','Прогулка','Питание','Движение']) statement.run(randomUUID(), userId, name);
}

export async function backupDatabase(db, destination) {
  mkdirSync(dirname(resolve(destination)), {recursive:true, mode:0o700});
  await backup(db, destination);
  chmodSync(destination, 0o600);
}
