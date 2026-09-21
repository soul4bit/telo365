import { fail, numeric, rateLimit, string } from './security.mjs';

const MAX_IMAGE_BYTES=2500000;
const schema={
  type:'object',additionalProperties:false,
  required:['name','confidence','kcal','p','f','c','components'],
  properties:{
    name:{type:'string'},confidence:{type:'string',enum:['low','medium','high']},
    kcal:{type:'number'},p:{type:'number'},f:{type:'number'},c:{type:'number'},
    components:{type:'array',items:{type:'object',additionalProperties:false,required:['name','grams'],properties:{name:{type:'string'},grams:{type:'number'}}}}
  }
};

function photo(value) {
  if(typeof value!=='string') fail(400,'Выберите фотографию блюда');
  const match=value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if(!match) fail(400,'Подойдут фотографии JPG, PNG или WebP');
  const encoded=match[2];
  if(Buffer.byteLength(encoded,'ascii')>Math.ceil(MAX_IMAGE_BYTES*4/3)) fail(413,'Фотография слишком большая. Выберите снимок до 2,5 МБ');
  const bytes=Buffer.from(encoded,'base64');
  if(!bytes.length||bytes.length>MAX_IMAGE_BYTES) fail(413,'Фотография слишком большая. Выберите снимок до 2,5 МБ');
  return `data:${match[1]};base64,${encoded}`;
}

function jsonOutput(value) {
  const text=typeof value?.output_text==='string'?value.output_text:'';
  const clean=text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
  try { return JSON.parse(clean); } catch { fail(502,'Не удалось распознать ответ. Попробуйте другое фото'); }
}

function estimate(value) {
  if(!value||typeof value!=='object'||Array.isArray(value)) fail(502,'Не удалось распознать ответ. Попробуйте другое фото');
  const confidence=['low','medium','high'].includes(value.confidence)?value.confidence:'low';
  if(!Array.isArray(value.components)||value.components.length>12) fail(502,'Не удалось распознать состав блюда');
  return {
    name:string(value.name,'Название блюда',120),confidence,
    kcal:Math.round(numeric(value.kcal,'Калории',0,4000)),
    p:Math.round(numeric(value.p,'Белки',0,500)*10)/10,
    f:Math.round(numeric(value.f,'Жиры',0,500)*10)/10,
    c:Math.round(numeric(value.c,'Углеводы',0,1000)*10)/10,
    components:value.components.map(item=>({name:string(item?.name,'Компонент',80),grams:Math.round(numeric(item?.grams,'Вес компонента',1,3000))}))
  };
}

export async function analyzeMealPhoto(ctx) {
  const image=photo(ctx.body.image);
  if(!process.env.OPENAI_API_KEY) fail(503,'Распознавание пока не настроено на сервере');
  rateLimit(ctx.db,`vision:${ctx.user.id}`,12,60*60*1000);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);
  try {
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',signal:controller.signal,
      headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'gpt-5-mini',store:false,reasoning:{effort:'low'},
        text:{format:{type:'json_schema',name:'meal_estimate',strict:true,schema},verbosity:'low'},
        input:[{role:'user',content:[
          {type:'input_text',text:'Оцени одно блюдо на фото. Верни название блюда, ориентировочные КБЖУ для всей видимой порции и состав с примерным весом компонентов в граммах. Не выдумывай точность: если порцию или ингредиенты не видно, выбери low. Ответь строго по схеме. Это справочная оценка, не медицинская рекомендация.'},
          {type:'input_image',image_url:image,detail:'low'}
        ]}]
      })
    });
    if(!response.ok) { const detail=await response.json().catch(()=>null);console.error(JSON.stringify({event:'vision_error',status:response.status,code:detail?.error?.code||null,param:detail?.error?.param||null}));fail(503,'Распознавание временно недоступно. Попробуйте позже'); }
    return estimate(jsonOutput(await response.json()));
  } catch(error) {
    if(error?.status) throw error;
    console.error(JSON.stringify({event:'vision_error',code:error?.name||'REQUEST_FAILED'}));
    fail(503,'Распознавание временно недоступно. Попробуйте позже');
  } finally { clearTimeout(timeout); }
}
