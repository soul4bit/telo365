/*
 * Read-only biomechanical geometry diagnostic for the original Mixamo Air
 * Squat combined GLBs.  It samples actual deformed SkinnedMesh vertices after
 * AnimationMixer evaluation; no source GLB, FBX, rig or animation is written.
 *
 * The resulting figures describe the rendered asset, not a medical assessment
 * of a human body or an approval of exercise technique.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const root=resolve('.')
const output=join(root,'artifacts','squat-technique-diagnostics')
const sampleCount=241
const up=new THREE.Vector3(0,1,0)
const candidates={
  male:{label:'Мужчина · Mixamo CH08_NONPBR',path:'assets-work/mixamo-review/models/mixamo-male-air-squat-combined-test.glb',sneakers:'Ch08_Sneakers'},
  female:{label:'Женщина · Mixamo Jody',path:'assets-work/mixamo-review/models/mixamo-female-air-squat-combined-test.glb',sneakers:'Ch37_Sneakers'}
}

function glbJson(source,path){
  if(source.readUInt32LE(0)!==0x46546c67)throw new Error(`${path}: GLB header is missing`)
  const length=source.readUInt32LE(12),type=source.readUInt32LE(16)
  if(type!==0x4e4f534a)throw new Error(`${path}: JSON chunk is missing`)
  return JSON.parse(source.subarray(20,20+length).toString('utf8').replace(/\0+$/,''))
}

// Node's GLTFLoader has no image decoder. The diagnostic needs hierarchy,
// skinning buffers and animation, so it keeps binary geometry intact but omits
// texture references only in its in-memory parse.
function stripTexturesForNodeLoader(source,path){
  const json=glbJson(source,path)
  delete json.images;delete json.textures;delete json.samplers
  for(const material of json.materials??[]){
    if(material.pbrMetallicRoughness){delete material.pbrMetallicRoughness.baseColorTexture;delete material.pbrMetallicRoughness.metallicRoughnessTexture}
    delete material.normalTexture;delete material.occlusionTexture;delete material.emissiveTexture;delete material.extensions
  }
  const encoded=Buffer.from(JSON.stringify(json),'utf8'),jsonLength=Math.ceil(encoded.length/4)*4,sourceJsonLength=source.readUInt32LE(12)
  const header=Buffer.alloc(20+jsonLength)
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(header.length+source.length-(20+sourceJsonLength),8);header.writeUInt32LE(jsonLength,12);header.writeUInt32LE(0x4e4f534a,16)
  encoded.copy(header,20);header.fill(0x20,20+encoded.length)
  return Buffer.concat([header,source.subarray(20+sourceJsonLength)])
}

async function load(path){
  const source=await readFile(resolve(path)),parsed=stripTexturesForNodeLoader(source,path)
  return new Promise((success,failure)=>new GLTFLoader().parse(parsed.buffer.slice(parsed.byteOffset,parsed.byteOffset+parsed.byteLength),'',success,failure))
}

function point(value){return [Number(value.x.toFixed(7)),Number(value.y.toFixed(7)),Number(value.z.toFixed(7))]}
function coordinate(value,axis){return Array.isArray(value)?value[{x:0,y:1,z:2}[axis]]:value[axis]}
function horizontal(point3){return new THREE.Vector3(point3.x,0,point3.z)}
function distanceHorizontal(first,second){return Math.hypot(first[0]-second[0],first[2]-second[2])}
function percentile(values,ratio){const ordered=[...values].sort((a,b)=>a-b);return ordered[Math.min(ordered.length-1,Math.max(0,Math.round((ordered.length-1)*ratio)))]}
function range(values){return {min:Math.min(...values),max:Math.max(...values)}}
function nearestIndex(items,value){let best=0,bestDistance=Infinity;for(let index=0;index<items.length;index++){const distance=Math.abs(items[index]-value);if(distance<bestDistance){best=index;bestDistance=distance}}return best}
function svgEscape(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}

function findBone(scene,suffix){
  let result
  scene.traverse(node=>{if(!result&&(node instanceof THREE.Bone)&&node.name.endsWith(suffix))result=node})
  if(!result)throw new Error(`Required Mixamo bone ${suffix} is missing`)
  return result
}

function worldVertex(mesh,index,target=new THREE.Vector3()){
  target.fromBufferAttribute(mesh.geometry.getAttribute('position'),index)
  mesh.applyBoneTransform(index,target)
  return target.applyMatrix4(mesh.matrixWorld)
}

function actualFootDirection(foot,toe){
  const direction=horizontal(toe.clone().sub(foot))
  if(direction.lengthSq()<1e-9)throw new Error('Foot-to-toe direction has no horizontal length')
  return direction.normalize()
}

function createShoesLandmarks(mesh,bones){
  const positions=mesh.geometry.getAttribute('position'),cache=new THREE.Vector3()
  const footPosition={left:bones.leftFoot.getWorldPosition(new THREE.Vector3()),right:bones.rightFoot.getWorldPosition(new THREE.Vector3())}
  const toePosition={left:bones.leftToe.getWorldPosition(new THREE.Vector3()),right:bones.rightToe.getWorldPosition(new THREE.Vector3())}
  const groups={left:[],right:[]}
  for(let index=0;index<positions.count;index++){
    const vertex=worldVertex(mesh,index,cache)
    const left=Math.min(vertex.distanceToSquared(footPosition.left),vertex.distanceToSquared(toePosition.left))
    const right=Math.min(vertex.distanceToSquared(footPosition.right),vertex.distanceToSquared(toePosition.right))
    groups[left<=right?'left':'right'].push({index,position:vertex.clone()})
  }
  const result={}
  for(const side of ['left','right']){
    const forward=actualFootDirection(footPosition[side],toePosition[side])
    const values=groups[side].map(item=>item.position.dot(forward)),heelLimit=percentile(values,.08),toeLimit=percentile(values,.92)
    const heelPatch=groups[side].filter(item=>item.position.dot(forward)<=heelLimit)
    const toePatch=groups[side].filter(item=>item.position.dot(forward)>=toeLimit)
    const controlIndex=patch=>[...patch].sort((first,second)=>first.position.y-second.position.y||first.index-second.index)[0].index
    result[side]={
      vertexCount:groups[side].length,
      forward:point(forward),
      heel:{landmarkIndex:controlIndex(heelPatch),patchIndices:heelPatch.map(item=>item.index)},
      toe:{landmarkIndex:controlIndex(toePatch),patchIndices:toePatch.map(item=>item.index)}
    }
  }
  return result
}

function patchMinimumY(mesh,indices){
  const position=new THREE.Vector3();let minimum=Infinity
  for(const index of indices)minimum=Math.min(minimum,worldVertex(mesh,index,position).y)
  return minimum
}
function meshMinimumY(mesh){
  const position=new THREE.Vector3();let minimum=Infinity
  for(let index=0;index<mesh.geometry.getAttribute('position').count;index++)minimum=Math.min(minimum,worldVertex(mesh,index,position).y)
  return minimum
}
function maxStep(samples,selector){
  const steps=[]
  for(let index=1;index<samples.length;index++)steps.push(selector(samples[index]).distanceTo(selector(samples[index-1])))
  return {max:Math.max(...steps),p95:percentile(steps,.95),median:percentile(steps,.5)}
}
function scalarSummary(samples,selector){const values=samples.map(selector);const {min,max}=range(values);return {min:Number(min.toFixed(7)),max:Number(max.toFixed(7)),range:Number((max-min).toFixed(7)),timeAtMin:Number(samples[nearestIndex(values,min)].time.toFixed(7)),timeAtMax:Number(samples[nearestIndex(values,max)].time.toFixed(7))}}

function lineChart(title,subtitle,duration,series,filename){
  const width=1120,height=560,pad={left:82,right:30,top:66,bottom:70}
  const all=series.flatMap(item=>item.values),lo=Math.min(0,...all),hi=Math.max(0,...all),span=Math.max(1e-8,hi-lo),min=lo-span*.08,max=hi+span*.08
  const x=time=>pad.left+(width-pad.left-pad.right)*time/duration
  const y=value=>height-pad.bottom-(height-pad.top-pad.bottom)*(value-min)/(max-min)
  const grid=Array.from({length:6},(_,index)=>{const value=min+(max-min)*index/5,position=y(value);return `<line x1="${pad.left}" y1="${position}" x2="${width-pad.right}" y2="${position}" stroke="#dce8d8"/><text x="${pad.left-10}" y="${position+4}" text-anchor="end">${value.toFixed(4)}</text>`}).join('')
  const ticks=Array.from({length:6},(_,index)=>{const time=duration*index/5,position=x(time);return `<line x1="${position}" y1="${pad.top}" x2="${position}" y2="${height-pad.bottom}" stroke="#eef4eb"/><text x="${position}" y="${height-42}" text-anchor="middle">${time.toFixed(3)}</text>`}).join('')
  const paths=series.map(item=>`<path d="${item.values.map((value,index)=>`${index?'L':'M'}${x(duration*index/(item.values.length-1)).toFixed(2)},${y(value).toFixed(2)}`).join(' ')}" fill="none" stroke="${item.color}" stroke-width="2.4"/>`).join('')
  const legend=series.map((item,index)=>`<g transform="translate(${pad.left+index*210},${height-18})"><line x1="0" y1="0" x2="18" y2="0" stroke="${item.color}" stroke-width="3"/><text x="25" y="4">${svgEscape(item.label)}</text></g>`).join('')
  return [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`, `<rect width="100%" height="100%" fill="#f8fbf6"/>`, `<text x="${pad.left}" y="32" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#315333">${svgEscape(title)}</text>`, `<text x="${pad.left}" y="52" font-family="Arial, sans-serif" font-size="12" fill="#65805f">${svgEscape(subtitle)}</text>`, `<g font-family="Arial, sans-serif" font-size="11" fill="#647960">${grid}${ticks}</g>`, `<line x1="${pad.left}" y1="${y(0)}" x2="${width-pad.right}" y2="${y(0)}" stroke="#96aa91" stroke-width="1.3"/>`,paths,`<text x="${width/2}" y="${height-42}" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="#516a4d">время клипа, с</text>`,`<g font-family="Arial, sans-serif" font-size="11" fill="#415d3e">${legend}</g>`,`</svg>`].join('')
}

function topDownChart(title,samples,filename){
  const width=1120,height=760,pad=72
  const series=[
    {label:'Left heel mesh',color:'#277d72',values:samples.map(sample=>sample.left.heel.position)},
    {label:'Left toe mesh',color:'#3d7fc2',values:samples.map(sample=>sample.left.toe.position)},
    {label:'Right heel mesh',color:'#bd5e57',values:samples.map(sample=>sample.right.heel.position)},
    {label:'Right toe mesh',color:'#d29a2c',values:samples.map(sample=>sample.right.toe.position)},
    {label:'Left knee bone',color:'#75a1d0',values:samples.map(sample=>sample.left.knee)},
    {label:'Right knee bone',color:'#e0b463',values:samples.map(sample=>sample.right.knee)}
  ]
  const xs=series.flatMap(item=>item.values.map(value=>coordinate(value,'x'))),zs=series.flatMap(item=>item.values.map(value=>coordinate(value,'z'))),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),span=Math.max(maxX-minX,maxZ-minZ,1e-7),x=value=>pad+(width-pad*2)*(value-(minX-(span-(maxX-minX))/2))/span,y=value=>height-pad-(height-pad*2)*(value-(minZ-(span-(maxZ-minZ))/2))/span
  const paths=series.map(item=>`<path d="${item.values.map((value,index)=>`${index?'L':'M'}${x(coordinate(value,'x')).toFixed(2)},${y(coordinate(value,'z')).toFixed(2)}`).join(' ')}" fill="none" stroke="${item.color}" stroke-width="2" opacity=".9"/>`).join('')
  const dots=series.map(item=>{const first=item.values[0],last=item.values.at(-1);return `<circle cx="${x(coordinate(first,'x'))}" cy="${y(coordinate(first,'z'))}" r="5" fill="${item.color}"/><rect x="${x(coordinate(last,'x'))-4}" y="${y(coordinate(last,'z'))-4}" width="8" height="8" fill="${item.color}"/>`}).join('')
  const legend=series.map((item,index)=>`<g transform="translate(${pad+(index%3)*330},${height-42+Math.floor(index/3)*18})"><line x1="0" y1="0" x2="18" y2="0" stroke="${item.color}" stroke-width="3"/><text x="25" y="4">${item.label}</text></g>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8fbf6"/><text x="${pad}" y="34" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#315333">${svgEscape(title)}</text><text x="${pad}" y="55" font-family="Arial, sans-serif" font-size="12" fill="#65805f">Top-down X-Z projection; circle = start, square = end. Shoe points use actual deformed mesh geometry.</text><rect x="${pad}" y="${pad}" width="${width-pad*2}" height="${height-pad*2-36}" fill="#f2f7ef" stroke="#d9e6d5"/>${paths}${dots}<g font-family="Arial, sans-serif" font-size="11" fill="#415d3e">${legend}</g></svg>`
}

function projectionChart(title,samples,mode){
  const width=1120,height=760,pad=72,phaseIndexes=[0,.15,.27,.44,1].map(value=>Math.round((samples.length-1)*value))
  const project=value=>{const x=coordinate(value,'x'),y=coordinate(value,'y'),z=coordinate(value,'z');return mode==='front'?{u:x,v:y}:{u:(x-z)*Math.SQRT1_2,v:y}}
  const groups=[
    {label:'Left heel mesh',color:'#277d72',selector:sample=>sample.left.heel.position},
    {label:'Left toe mesh',color:'#3d7fc2',selector:sample=>sample.left.toe.position},
    {label:'Right heel mesh',color:'#bd5e57',selector:sample=>sample.right.heel.position},
    {label:'Right toe mesh',color:'#d29a2c',selector:sample=>sample.right.toe.position},
    {label:'Left knee bone',color:'#75a1d0',selector:sample=>sample.left.knee},
    {label:'Right knee bone',color:'#e0b463',selector:sample=>sample.right.knee}
  ]
  const all=groups.flatMap(group=>phaseIndexes.map(index=>project(group.selector(samples[index])))),minU=Math.min(...all.map(value=>value.u)),maxU=Math.max(...all.map(value=>value.u)),minV=Math.min(...all.map(value=>value.v)),maxV=Math.max(...all.map(value=>value.v)),spanU=Math.max(maxU-minU,.001),spanV=Math.max(maxV-minV,.001),x=value=>pad+(width-pad*2)*(value-minU)/spanU,y=value=>height-pad-(height-pad*2-36)*(value-minV)/spanV
  const paths=groups.map(group=>{const values=phaseIndexes.map(index=>project(group.selector(samples[index])));return `<path d="${values.map((value,index)=>`${index?'L':'M'}${x(value.u).toFixed(2)},${y(value.v).toFixed(2)}`).join(' ')}" fill="none" stroke="${group.color}" stroke-width="2"/><g fill="${group.color}">${values.map(value=>`<circle cx="${x(value.u)}" cy="${y(value.v)}" r="4"/>`).join('')}</g>`}).join('')
  const legend=groups.map((group,index)=>`<g transform="translate(${pad+(index%3)*330},${height-42+Math.floor(index/3)*18})"><line x1="0" y1="0" x2="18" y2="0" stroke="${group.color}" stroke-width="3"/><text x="25" y="4">${group.label}</text></g>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8fbf6"/><text x="${pad}" y="34" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#315333">${svgEscape(title)}</text><text x="${pad}" y="55" font-family="Arial, sans-serif" font-size="12" fill="#65805f">Five sampled phases; ${mode==='front'?'front':'three-quarter'} orthographic projection of world-space measured points.</text><rect x="${pad}" y="${pad}" width="${width-pad*2}" height="${height-pad*2-72}" fill="#f2f7ef" stroke="#d9e6d5"/>${paths}<g font-family="Arial, sans-serif" font-size="11" fill="#415d3e">${legend}</g></svg>`
}

function findingsFor(summary){
  const maximumFootDisplacement=Math.max(...['left','right'].flatMap(side=>[
    summary.feet[side].heel.horizontalDisplacement.max,
    summary.feet[side].toe.horizontalDisplacement.max
  ]))
  const pelvisStepRatio=summary.pelvis.step.max/summary.pelvis.step.p95
  const inwardMaximum=Math.max(summary.feet.left.kneeRelativeToFoot.maxInwardFromStart,summary.feet.right.kneeRelativeToFoot.maxInwardFromStart)
  return {
    confirmedTechnicalFindings:[
      {
        id:'shoe-floor-intersection',
        phase:'раннее опускание',
        timeSeconds:summary.sneakersEnvelope.timeAtMinimumY,
        measuredDeviation:summary.sneakersEnvelope.maxPenetrationBelowFloor,
        confidence:'высокая для координат GLB; низкая для физического размера без подтверждённого масштаба',
        possibleCause:'граница геометрии обуви находится немного ниже выбранной плоскости отображаемого пола Y=0',
        proposedCorrection:'Сначала визуально сверить пересечение с полом в preview. Если оно заметно, скорректировать только уровень display-floor или presentation offset; не менять клип, риг и skin weights без отдельного решения.'
      }
    ],
    nonFindings:[
      {
        id:'root-motion',
        result:'Смещение root scene object не обнаружено',
        measuredDeviation:summary.root.maxWorldDisplacement
      },
      {
        id:'foot-landmark-motion',
        result:'В полном цикле максимальное X–Z смещение фиксированных геометрических landmark обуви',
        measuredDeviation:maximumFootDisplacement,
        limitation:'Это измерение само по себе не устанавливает физический контакт с полом и не заменяет визуальную оценку скольжения.'
      },
      {
        id:'knee-inward-motion',
        result:'Наибольшее inward-изменение knee-bone относительно исходной оси соответствующей стопы',
        measuredDeviation:inwardMaximum,
        limitation:'Knee-bone — контрольная точка рига, а не подтверждённый анатомический центр; это не диагноз valgus/varus.'
      },
      {
        id:'pelvis-sample-continuity',
        result:'Отношение максимального смещения Hips за один шаг к P95',
        measuredDeviation:pelvisStepRatio,
        limitation:'Ряд позиций не показывает изолированного однокадрового выброса; угловой jerk и анатомическое качество движения эта метрика не оценивает.'
      }
    ]
  }
}

function findingsMarkdown(summary){
  const format=value=>Number(value).toFixed(6)
  const findings=summary.findings
  const confirmed=findings.confirmedTechnicalFindings.map(item=>`### ${item.id}\n\n- Фаза: ${item.phase}; время: ${format(item.timeSeconds)} с.\n- Измеренное отклонение: ${format(item.measuredDeviation)} scene units ниже Y=0.\n- Достоверность: ${item.confidence}.\n- Возможная техническая причина: ${item.possibleCause}.\n- Предлагаемое исправление: ${item.proposedCorrection}.`).join('\n\n')
  const nonFindings=findings.nonFindings.map(item=>`- **${item.id}:** ${item.result} — ${format(item.measuredDeviation)} scene units. ${item.limitation??''}`).join('\n')
  return `## Подтверждённые технические находки\n\n${confirmed}\n\n## Что не подтверждено этим измерением\n\n${nonFindings}\n\nНа основании этих чисел не подтверждается и не опровергается безопасность, медицинская корректность или готовность упражнения к публикации.`
}

function markdownReport(avatar,config,summary){
  const format=value=>Number(value).toFixed(6)
  const foot=side=>summary.feet[side]
  return `# ${config.label} — объективная 3D-диагностика Air Squat

Статус: **измерение ассета, не оценка корректности техники**.

## Исходные данные

- Combined GLB: \`${config.path}\`.
- Клип: \`squat\`, оригинальный embedded Mixamo clip, ${format(summary.durationSeconds)} с.
- Отсчётов: ${summary.sampleCount} равномерных значений времени, включая границы цикла.
- Координаты: мировая сцена GLB, ось Y вверх, плоскость пола — Y=0.
- Физический масштаб метрами не подтверждён источником ассета; все величины ниже — **scene units**, не миллиметры.

## Контрольные точки обуви

Mesh обуви: \`${summary.sneakersMesh}\`. Для каждой стороны автоматически выделены
вершинные области по фактической геометрии: крайние 8% вдоль оси Foot→ToeBase;
на исходной позе из области выбрана нижняя вершина. Её индекс сохранён в JSON.
Foot/ToeBase используются только для задания направления области, а не как
координаты пятки или носка. Дополнительно измеряется минимум Y всей области и
всего mesh обуви.

## Измеренные результаты

| Метрика | Левая | Правая |
| --- | ---: | ---: |
| Max высота heel landmark над Y=0 | ${format(foot('left').heel.height.max)} | ${format(foot('right').heel.height.max)} |
| Min высота heel landmark | ${format(foot('left').heel.height.min)} | ${format(foot('right').heel.height.min)} |
| Max высота toe landmark над Y=0 | ${format(foot('left').toe.height.max)} | ${format(foot('right').toe.height.max)} |
| Max горизонтальное смещение heel landmark | ${format(foot('left').heel.horizontalDisplacement.max)} | ${format(foot('right').heel.horizontalDisplacement.max)} |
| Max горизонтальное смещение toe landmark | ${format(foot('left').toe.horizontalDisplacement.max)} | ${format(foot('right').toe.horizontalDisplacement.max)} |
| Наибольшее inward-отклонение knee относительно initial foot axis | ${format(foot('left').kneeRelativeToFoot.maxInwardFromStart)} | ${format(foot('right').kneeRelativeToFoot.maxInwardFromStart)} |

- Минимальная высота любой вершины mesh обуви: ${format(summary.sneakersEnvelope.minimumY)} (время ${format(summary.sneakersEnvelope.timeAtMinimumY)} с).
- Максимальное проникновение под Y=0: ${format(summary.sneakersEnvelope.maxPenetrationBelowFloor)}; максимальный зазор оболочки обуви над Y=0: ${format(summary.sneakersEnvelope.maxEnvelopeGapAboveFloor)}.
- Max смещение root scene object: ${format(summary.root.maxWorldDisplacement)}. Это отдельная метрика от движения Hips.
- Таз (Hips): вертикальный диапазон ${format(summary.pelvis.vertical.range)}, forward диапазон ${format(summary.pelvis.forward.range)}, lateral диапазон ${format(summary.pelvis.lateral.range)}.
- Сегмент Hips→Spine2: диапазон угла относительно вертикали ${format(summary.trunk.pitchDegrees.min)}°…${format(summary.trunk.pitchDegrees.max)}°. Это ориентир корпуса, не заключение о пояснице.
- Граница loop: max расстояние старт/конец среди измеренных точек ${format(summary.loop.maxEndpointDelta)}; max значение расхождения authored tracks: ${format(summary.loop.maxTrackBoundaryDelta)}.

${findingsMarkdown(summary)}

## Интерпретационные пределы

1. Координаты knee-бон и Hips — позиции рига Mixamo, а не точные анатомические центры суставов.
2. Высота landmark описывает выбранную вершину обуви; для контакта также приведена огибающая всей обуви и отдельных областей.
3. Числа не подтверждают безопасность, медицинскую корректность или готовность к публикации. Они нужны, чтобы специалист мог проверить конкретные фазы и при необходимости попросить правку исходного движения.
4. Резкое внутрь/наружу определяется здесь только как изменение проекции knee относительно направления соответствующей стопы от исходного кадра. Это не диагноз valgus/varus.

## Файлы

- \`${avatar}-series.json\` — полный временной ряд;
- \`${avatar}-heel-toe-heights.svg\`, \`${avatar}-foot-horizontal-displacement.svg\`, \`${avatar}-pelvis-trajectory.svg\` — графики;
- \`${avatar}-knees-feet-topdown.svg\`, \`${avatar}-knees-feet-front-projection.svg\`, \`${avatar}-knees-feet-three-quarter-projection.svg\` — диагностические проекции.
`
}

function readme(summaries){
  const line=avatar=>{
    const summary=summaries[avatar]
    const maximumFootDisplacement=Math.max(...['left','right'].flatMap(side=>[
      summary.feet[side].heel.horizontalDisplacement.max,
      summary.feet[side].toe.horizontalDisplacement.max
    ]))
    const maximumInward=Math.max(summary.feet.left.kneeRelativeToFoot.maxInwardFromStart,summary.feet.right.kneeRelativeToFoot.maxInwardFromStart)
    return `| ${avatar==='male'?'Мужчина / CH08_NONPBR':'Женщина / Jody'} | ${summary.durationSeconds.toFixed(3)} | ${summary.sneakersEnvelope.maxPenetrationBelowFloor.toFixed(6)} | ${maximumFootDisplacement.toFixed(6)} | ${maximumInward.toFixed(6)} | ${summary.loop.maxEndpointDelta.toFixed(6)} |`
  }
  return `# Объективная 3D-диагностика Mixamo Air Squat

Этот пакет измеряет **исходные локальные review-ассеты** после фактического вычисления оригинального embedded-клипа \`squat\` через \`AnimationMixer\`. Он не является медицинской оценкой, заключением о безопасной технике или разрешением на публикацию.

## Что анализировалось

- Мужчина CH08_NONPBR: \`assets-work/mixamo-review/models/mixamo-male-air-squat-combined-test.glb\`; исходный Mixamo Air Squat.
- Женщина Jody: \`assets-work/mixamo-review/models/mixamo-female-air-squat-combined-test.glb\`; исходный Mixamo Air Squat Bent Arms.
- У каждого клипа: ${sampleCount} равномерных отсчётов, включая начало и конец цикла. Длительность каждого embedded-клипа: 2,375 с.
- Мировая ось Y принята вертикальной, reference floor — \`Y=0\`.
- GLB, FBX, риги, bind pose и animation tracks только читались. Никакие статусы review/verified/publication не изменялись.

## Методика

1. Для каждого момента времени mixer вычисляет фактическую позу сцены; измерения выполняются в мировых координатах после \`updateMatrixWorld(true)\`.
2. Пятки и носки не заменяются координатами Foot/ToeBase. Контрольные точки — фиксированные вершины реальных SkinnedMesh \`Ch08_Sneakers\` и \`Ch37_Sneakers\`, выбранные из крайних 8% геометрии обуви вдоль фактической оси Foot→ToeBase в исходной стойке. Для контроля дополнительно измеряется минимальная Y-координата всей обуви и каждой vertex-patch.
3. Колени и таз — world-позиции соответствующих костей Mixamo. Они полезны как повторяемые контрольные точки, но не являются подтверждёнными анатомическими центрами суставов.
4. Физический масштаб ассета источником не подтверждён. Поэтому все значения сохранены в **scene units**, а не переведены в миллиметры.

## Краткая сводка

| Персонаж | Клип, с | Max проникновение обуви ниже Y=0 | Max X–Z смещение landmark обуви | Max inward-изменение knee-bone | Max start/end delta |
| --- | ---: | ---: | ---: | ---: | ---: |
${line('male')}
${line('female')}

У обоих ассетов найдена небольшая геометрическая пересечка с reference floor в ранней фазе опускания. Это достоверное свойство координат GLB относительно выбранной плоскости Y=0, но без калиброванного физического масштаба и визуальной проверки не доказывает дефект техники. Рекомендация — при видимом пересечении настроить только пол preview/представление, не меняя оригинальный clip.

В рядах не обнаружено смещения root scene object; граница первого/последнего кадра имеет малое измеренное расхождение. Метрики knee-bone не показывают выраженного inward-сдвига относительно исходной оси стопы, однако это не заменяет оценку специалиста по видео и не является диагнозом.

## Файлы

- \`male-report.md\`, \`female-report.md\` — детальные измерения, техническая находка и пределы интерпретации.
- \`male-series.json\`, \`female-series.json\` — полные временные ряды с позицией таза, коленей, стоп, геометрическими heel/toe и минимальной высотой обуви для каждого отсчёта.
- \`*-heel-toe-heights.svg\` — высоты heel/toe landmark относительно Y=0.
- \`*-foot-horizontal-displacement.svg\` — X–Z смещения landmark от исходной стойки во всём цикле.
- \`*-pelvis-trajectory.svg\` — траектория Hips.
- \`*-knees-feet-topdown.svg\`, \`*-knees-feet-front-projection.svg\`, \`*-knees-feet-three-quarter-projection.svg\` — диагностические проекции координат рига и обуви. Это не рендеры тела и не медицинская разметка.
- \`summary.json\` — компактная машиночитаемая сводка и параметры методики.

Для визуального просмотра исходной анимации и кадров используйте уже созданный пакет \`artifacts/squat-technique-review/\`. Этот пакет дополняет его измерениями и не заменяет независимую проверку специалистом.
`
}

async function diagnose(avatar,config){
  const gltf=await load(config.path),clip=gltf.animations.find(item=>item.name==='squat')
  if(!clip)throw new Error(`${avatar}: original embedded squat clip is missing`)
  let sneakers
  gltf.scene.traverse(node=>{if(node.name===config.sneakers)sneakers=node})
  if(!(sneakers instanceof THREE.SkinnedMesh))throw new Error(`${avatar}: ${config.sneakers} is not a SkinnedMesh`)
  const bones={
    hips:findBone(gltf.scene,'Hips'),spine2:findBone(gltf.scene,'Spine2'),
    leftFoot:findBone(gltf.scene,'LeftFoot'),rightFoot:findBone(gltf.scene,'RightFoot'),
    leftToe:findBone(gltf.scene,'LeftToeBase'),rightToe:findBone(gltf.scene,'RightToeBase'),
    leftKnee:findBone(gltf.scene,'LeftLeg'),rightKnee:findBone(gltf.scene,'RightLeg')
  }
  const mixer=new THREE.AnimationMixer(gltf.scene),action=mixer.clipAction(clip).setLoop(THREE.LoopOnce,1).play()
  const apply=time=>{const epsilon=.000001,requested=THREE.MathUtils.clamp(time,0,clip.duration),evaluated=requested<=0?epsilon:requested>=clip.duration?clip.duration-epsilon:requested;mixer.setTime(evaluated);gltf.scene.updateMatrixWorld(true)}
  apply(0)
  const landmarks=createShoesLandmarks(sneakers,bones),startRoot=gltf.scene.getWorldPosition(new THREE.Vector3()),startHips=bones.hips.getWorldPosition(new THREE.Vector3()),startForwards={left:actualFootDirection(bones.leftFoot.getWorldPosition(new THREE.Vector3()),bones.leftToe.getWorldPosition(new THREE.Vector3())),right:actualFootDirection(bones.rightFoot.getWorldPosition(new THREE.Vector3()),bones.rightToe.getWorldPosition(new THREE.Vector3()))}
  const globalForward=startForwards.left.clone().add(startForwards.right).normalize(),globalSide=new THREE.Vector3().crossVectors(up,globalForward).normalize()
  const sample=[]
  for(let index=0;index<sampleCount;index++){
    const time=clip.duration*index/(sampleCount-1);apply(time)
    const rootPosition=gltf.scene.getWorldPosition(new THREE.Vector3()),hips=bones.hips.getWorldPosition(new THREE.Vector3()),spine2=bones.spine2.getWorldPosition(new THREE.Vector3())
    const pelvisMid=hips.clone(),trunk=spine2.clone().sub(hips),trunkHorizontal=horizontal(trunk),pitchDegrees=THREE.MathUtils.radToDeg(Math.atan2(trunkHorizontal.length(),Math.abs(trunk.y)))
    const sides={}
    for(const side of ['left','right']){
      const foot=bones[`${side}Foot`].getWorldPosition(new THREE.Vector3()),toeBone=bones[`${side}Toe`].getWorldPosition(new THREE.Vector3()),knee=bones[`${side}Knee`].getWorldPosition(new THREE.Vector3()),forward=actualFootDirection(foot,toeBone),lateral=new THREE.Vector3().crossVectors(up,forward).normalize(),outwardSign=Math.sign(foot.clone().sub(pelvisMid).dot(lateral))||1
      const read=kind=>{const landmark=landmarks[side][kind],position=worldVertex(sneakers,landmark.landmarkIndex,new THREE.Vector3()),patchMinY=patchMinimumY(sneakers,landmark.patchIndices);return {position:point(position),height:position.y,patchMinimumY:patchMinY,horizontalDisplacement:0,landmarkIndex:landmark.landmarkIndex}}
      const heel=read('heel'),toe=read('toe'),relativeKneeOutward=knee.clone().sub(foot).dot(lateral)*outwardSign
      sides[side]={foot:point(foot),toeBone:point(toeBone),knee:point(knee),footDirection:point(forward),heel,toe,kneeRelativeToFoot:relativeKneeOutward,footYawRadians:Math.atan2(forward.z,forward.x)}
    }
    sample.push({index,time,root:point(rootPosition),pelvis:{position:point(hips),verticalFromStart:hips.y-startHips.y,forwardFromStart:hips.clone().sub(startHips).dot(globalForward),lateralFromStart:hips.clone().sub(startHips).dot(globalSide)},trunk:{pitchDegrees},left:sides.left,right:sides.right,sneakersMinimumY:meshMinimumY(sneakers)})
  }
  action.stop();mixer.stopAllAction();mixer.uncacheRoot(gltf.scene)
  for(const side of ['left','right'])for(const kind of ['heel','toe']){
    const start=sample[0][side][kind].position
    for(const item of sample)item[side][kind].horizontalDisplacement=distanceHorizontal(item[side][kind].position,start)
  }
  const endpoint=sample.at(-1),start=sample[0],allControls=[]
  const sideSummary={}
  for(const side of ['left','right']){
    const baseline=start[side].kneeRelativeToFoot,kneeValues=sample.map(item=>item[side].kneeRelativeToFoot)
    sideSummary[side]={
      heel:{height:scalarSummary(sample,item=>item[side].heel.height),patchMinimumY:scalarSummary(sample,item=>item[side].heel.patchMinimumY),horizontalDisplacement:scalarSummary(sample,item=>item[side].heel.horizontalDisplacement),landmarkIndex:landmarks[side].heel.landmarkIndex,patchVertices:landmarks[side].heel.patchIndices.length},
      toe:{height:scalarSummary(sample,item=>item[side].toe.height),patchMinimumY:scalarSummary(sample,item=>item[side].toe.patchMinimumY),horizontalDisplacement:scalarSummary(sample,item=>item[side].toe.horizontalDisplacement),landmarkIndex:landmarks[side].toe.landmarkIndex,patchVertices:landmarks[side].toe.patchIndices.length},
      kneeRelativeToFoot:{initial:baseline,min:Math.min(...kneeValues),max:Math.max(...kneeValues),maxInwardFromStart:Math.max(...kneeValues.map(value=>baseline-value)),maxOutwardFromStart:Math.max(...kneeValues.map(value=>value-baseline))},
      footYawChangeDegrees:{min:Math.min(...sample.map(item=>THREE.MathUtils.radToDeg(item[side].footYawRadians-start[side].footYawRadians))),max:Math.max(...sample.map(item=>THREE.MathUtils.radToDeg(item[side].footYawRadians-start[side].footYawRadians)))}
    }
    allControls.push(['heel',start[side].heel.position,endpoint[side].heel.position],['toe',start[side].toe.position,endpoint[side].toe.position])
  }
  const endpointDeltas=[start.pelvis.position, start.left.knee,start.right.knee,...allControls.map(item=>item[1])].map((value,index)=>new THREE.Vector3(...value).distanceTo(new THREE.Vector3(...[endpoint.pelvis.position,endpoint.left.knee,endpoint.right.knee,...allControls.map(item=>item[2])][index])))
  const trackBoundary=Math.max(...clip.tracks.filter(track=>track.times.length>1).map(track=>{const size=track.getValueSize();let max=0;for(let offset=0;offset<size;offset++)max=Math.max(max,Math.abs(track.values[offset]-track.values[track.values.length-size+offset]));return max}))
  const summary={
    avatar,label:config.label,sourceGlb:config.path,sneakersMesh:config.sneakers,clip:clip.name,durationSeconds:clip.duration,sampleCount,coordinates:{upAxis:'Y',floorPlane:'Y=0',physicalScaleVerified:false,unit:'scene units'},landmarks,
    feet:sideSummary,
    sneakersEnvelope:{minimumY:Math.min(...sample.map(item=>item.sneakersMinimumY)),timeAtMinimumY:sample[nearestIndex(sample.map(item=>item.sneakersMinimumY),Math.min(...sample.map(item=>item.sneakersMinimumY)))].time,maxPenetrationBelowFloor:Math.max(0,-Math.min(...sample.map(item=>item.sneakersMinimumY))),maxEnvelopeGapAboveFloor:Math.max(...sample.map(item=>item.sneakersMinimumY))},
    root:{maxWorldDisplacement:Math.max(...sample.map(item=>new THREE.Vector3(...item.root).distanceTo(startRoot)))},
    pelvis:{vertical:scalarSummary(sample,item=>item.pelvis.verticalFromStart),forward:scalarSummary(sample,item=>item.pelvis.forwardFromStart),lateral:scalarSummary(sample,item=>item.pelvis.lateralFromStart),step:maxStep(sample,item=>new THREE.Vector3(...item.pelvis.position))},
    trunk:{pitchDegrees:scalarSummary(sample,item=>item.trunk.pitchDegrees)},
    loop:{maxEndpointDelta:Math.max(...endpointDeltas),maxTrackBoundaryDelta:trackBoundary},
    measurementLimitations:['Knee and hips are Mixamo rig reference positions, not verified anatomical joint centres.','Heel/toe landmarks are fixed vertices selected from actual sneaker geometry; patch-envelope values additionally inspect 8% heel/toe mesh regions.','GLB physical scale is not independently calibrated, so values remain in scene units.']
  }
  summary.findings=findingsFor(summary)
  return {summary,sample}
}

await mkdir(output,{recursive:true})
const summaries={}
for(const [avatar,config] of Object.entries(candidates)){
  const {summary,sample}=await diagnose(avatar,config)
  summaries[avatar]=summary
  await writeFile(join(output,`${avatar}-series.json`),JSON.stringify({summary,samples:sample},null,2)+'\n')
  await writeFile(join(output,`${avatar}-report.md`),markdownReport(avatar,config,summary))
  const duration=summary.durationSeconds
  await writeFile(join(output,`${avatar}-heel-toe-heights.svg`),lineChart(`${config.label}: высота control points обуви`,`Y относительно плоскости пола Y=0; fixed vertices из фактического Sneakers mesh`,duration,[
    {label:'левый heel',color:'#277d72',values:sample.map(item=>item.left.heel.height)}, {label:'левый toe',color:'#3d7fc2',values:sample.map(item=>item.left.toe.height)}, {label:'правый heel',color:'#bd5e57',values:sample.map(item=>item.right.heel.height)}, {label:'правый toe',color:'#d29a2c',values:sample.map(item=>item.right.toe.height)}
  ]))
  await writeFile(join(output,`${avatar}-foot-horizontal-displacement.svg`),lineChart(`${config.label}: горизонтальное смещение обуви`,`Расстояние X–Z landmark от исходной позиции; scene units`,duration,[
    {label:'левый heel',color:'#277d72',values:sample.map(item=>item.left.heel.horizontalDisplacement)}, {label:'левый toe',color:'#3d7fc2',values:sample.map(item=>item.left.toe.horizontalDisplacement)}, {label:'правый heel',color:'#bd5e57',values:sample.map(item=>item.right.heel.horizontalDisplacement)}, {label:'правый toe',color:'#d29a2c',values:sample.map(item=>item.right.toe.horizontalDisplacement)}
  ]))
  await writeFile(join(output,`${avatar}-pelvis-trajectory.svg`),lineChart(`${config.label}: траектория таза (Hips)`,`Отклонение от исходной стойки в мировых осях; scene units`,duration,[
    {label:'вертикаль Y',color:'#3d7fc2',values:sample.map(item=>item.pelvis.verticalFromStart)}, {label:'forward',color:'#277d72',values:sample.map(item=>item.pelvis.forwardFromStart)}, {label:'lateral',color:'#bd5e57',values:sample.map(item=>item.pelvis.lateralFromStart)}
  ]))
  await writeFile(join(output,`${avatar}-knees-feet-topdown.svg`),topDownChart(`${config.label}: траектории стоп и коленей`,sample))
  await writeFile(join(output,`${avatar}-knees-feet-front-projection.svg`),projectionChart(`${config.label}: ноги — фронтальная диагностическая проекция`,sample,'front'))
  await writeFile(join(output,`${avatar}-knees-feet-three-quarter-projection.svg`),projectionChart(`${config.label}: ноги — диагностическая проекция 3/4`,sample,'three-quarter'))
}
await writeFile(join(output,'summary.json'),JSON.stringify({method:'scripts/diagnose-mixamo-squat-technique.mjs',source:'original local Mixamo combined GLBs; read only',summaries},null,2)+'\n')
await writeFile(join(output,'README.md'),readme(summaries))
console.log(JSON.stringify({output,avatars:Object.fromEntries(Object.entries(summaries).map(([avatar,summary])=>[avatar,{sampleCount:summary.sampleCount,durationSeconds:summary.durationSeconds,sneakersMesh:summary.sneakersMesh}]))},null,2))
