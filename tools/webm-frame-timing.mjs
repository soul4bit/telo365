/**
 * Retimes Chromium MediaRecorder's single-video WebM without re-encoding frames.
 * Only the explicitly supported EBML layout is accepted; byte lengths and file
 * offsets never change, so SeekHead/CueClusterPosition remain valid.
 */
const ID={header:0x1a45dfa3,segment:0x18538067,info:0x1549a966,tracks:0x1654ae6b,track:0xae,video:0xe0,cluster:0x1f43b675,cues:0x1c53bb6b,cue:0xbb,cuePositions:0xb7,scale:0x2ad7b1,duration:0x4489,time:0xe7,block:0xa3,cueTime:0xb3}
const allowed=new Map([
  [0,[ID.header,ID.segment]],
  [ID.header,[0x4286,0x42f7,0x42f2,0x42f3,0x4282,0x4287,0x4285]],
  [ID.segment,[0x114d9b74,0xec,ID.info,ID.tracks,ID.cluster,ID.cues]],
  [ID.info,[ID.scale,ID.duration,0x4d80,0x5741]],
  [ID.tracks,[ID.track]],
  [ID.track,[0xd7,0x73c5,0x83,0x55ee,0x86,ID.video,0x88,0xb9,0x9c]],
  [ID.video,[0xb0,0xba,0x53c0,0x55b0,0x54b0,0x54ba,0x54b2,0x53b8]],
  [ID.cluster,[ID.time,ID.block]],
  [ID.cues,[ID.cue]],
  [ID.cue,[ID.cueTime,ID.cuePositions]],
  [ID.cuePositions,[0xf7,0xf1,0xf0,0x5378]]
])

function vint(bytes,offset,end,isId=false){
  if(offset>=end)throw new Error('Truncated EBML variable-length integer')
  let length=1
  while(length<=8&&!(bytes[offset]&(1<<(8-length))))length++
  if(length>8||offset+length>end||(isId&&length>4))throw new Error('Invalid EBML variable-length integer')
  let value=BigInt(isId?bytes[offset]:bytes[offset]&((1<<(8-length))-1))
  for(let index=1;index<length;index++)value=(value<<8n)|BigInt(bytes[offset+index])
  const unknown=!isId&&value===(1n<<BigInt(length*7))-1n
  if(!unknown&&value>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Unsafe EBML integer')
  return {value:Number(value),length,unknown}
}

function elements(bytes,start,end,parent=0){
  const result=[]
  for(let cursor=start;cursor<end;){
    const id=vint(bytes,cursor,end,true),size=vint(bytes,cursor+id.length,end)
    if(!allowed.get(parent)?.includes(id.value))throw new Error(`Unsupported EBML element 0x${id.value.toString(16)} in 0x${parent.toString(16)}`)
    if(size.unknown&&id.value!==ID.segment)throw new Error('Only Segment may have unknown EBML size')
    const payload=cursor+id.length+size.length,limit=size.unknown?end:payload+size.value
    if(limit>end||limit<payload)throw new Error('Truncated EBML element')
    const element={id:id.value,start:payload,end:limit,children:[]}
    if(allowed.has(id.value))element.children=elements(bytes,payload,limit,id.value)
    result.push(element);cursor=limit
  }
  return result
}

const all=(parent,id)=>parent.children.filter(element=>element.id===id)
function one(parent,id){const values=all(parent,id);if(values.length!==1)throw new Error(`Expected one EBML element 0x${id.toString(16)}, got ${values.length}`);return values[0]}
function uint(bytes,element){const length=element.end-element.start;if(length<1||length>8)throw new Error('Invalid EBML unsigned integer');let value=0n;for(let p=element.start;p<element.end;p++)value=(value<<8n)|BigInt(bytes[p]);if(value>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Unsafe EBML unsigned integer');return Number(value)}
function writeUint(bytes,element,value){if(!Number.isSafeInteger(value)||value<0)throw new Error('Invalid EBML unsigned value');let rest=BigInt(value);for(let p=element.end-1;p>=element.start;p--){bytes[p]=Number(rest&255n);rest>>=8n}if(rest)throw new Error('Retimed value does not fit the existing EBML payload')}
function float(bytes,element){const length=element.end-element.start;if(length!==4&&length!==8)throw new Error('Unsupported EBML float');return length===4?bytes.readFloatBE(element.start):bytes.readDoubleBE(element.start)}
function writeFloat(bytes,element,value){const length=element.end-element.start;if(length===4)bytes.writeFloatBE(value,element.start);else if(length===8)bytes.writeDoubleBE(value,element.start);else throw new Error('Unsupported EBML float')}

function inspect(bytes){
  const root={children:elements(bytes,0,bytes.length)},header=one(root,ID.header),segment=one(root,ID.segment)
  const docType=one(header,0x4282)
  if(bytes.toString('utf8',docType.start,docType.end)!=='webm')throw new Error('Expected WebM document')
  const info=one(segment,ID.info),scaleElement=one(info,ID.scale),durationElement=one(info,ID.duration),scale=uint(bytes,scaleElement)
  if(!Number.isFinite(scale)||scale<=0)throw new Error('Invalid WebM timestamp scale')
  const tracks=one(segment,ID.tracks),track=one(tracks,ID.track),trackNumber=uint(bytes,one(track,0xd7)),codec=one(track,0x86)
  if(uint(bytes,one(track,0x83))!==1||!['V_VP9','V_VP8'].includes(bytes.toString('utf8',codec.start,codec.end)))throw new Error('Expected one VP8/VP9 video track, without audio')
  const clusters=all(segment,ID.cluster),blocks=[]
  if(!clusters.length)throw new Error('WebM has no clusters')
  for(const cluster of clusters){
    cluster.timeElement=one(cluster,ID.time);cluster.time=uint(bytes,cluster.timeElement);cluster.blocks=[]
    for(const element of all(cluster,ID.block)){
      const blockTrack=vint(bytes,element.start,element.end)
      if(blockTrack.unknown||blockTrack.value!==trackNumber||element.start+blockTrack.length+3>=element.end)throw new Error('Invalid SimpleBlock track or payload')
      const timeOffset=element.start+blockTrack.length,flags=bytes[timeOffset+2]
      if(flags&6)throw new Error('Laced SimpleBlock is not supported')
      if(flags&8)throw new Error('Invisible SimpleBlock is not supported')
      const block={element,timeOffset,time:cluster.time+bytes.readInt16BE(timeOffset),keyframe:!!(flags&128),payloadStart:timeOffset+3}
      if(blocks.length&&block.time<=blocks.at(-1).time)throw new Error('WebM frame timestamps are not strictly increasing')
      cluster.blocks.push(block);blocks.push(block)
    }
    if(!cluster.blocks.length)throw new Error('Empty WebM cluster')
  }
  const cueTimes=[]
  for(const cues of all(segment,ID.cues))for(const point of all(cues,ID.cue)){
    const timeElement=one(point,ID.cueTime),time=uint(bytes,timeElement)
    for(const positions of all(point,ID.cuePositions))if(uint(bytes,one(positions,0xf7))!==trackNumber)throw new Error('Cue refers to an unknown track')
    const frameIndex=blocks.findIndex(block=>block.time===time&&block.keyframe)
    if(frameIndex<0)throw new Error('Cue time does not identify an existing keyframe')
    cueTimes.push({element:timeElement,frameIndex})
  }
  return {scale,durationElement,durationSeconds:float(bytes,durationElement)*scale/1e9,clusters,blocks,cueTimes}
}

export function inspectWebmFrameTiming(input){
  const bytes=Buffer.from(input),data=inspect(bytes)
  return {durationSeconds:data.durationSeconds,frameCount:data.blocks.length,timestampScaleNanoseconds:data.scale,timestampsSeconds:data.blocks.map(block=>block.time*data.scale/1e9)}
}

export function retimeWebmFrames(input,{frameCount,durationSeconds}){
  if(!Number.isInteger(frameCount)||frameCount<2||!Number.isFinite(durationSeconds)||durationSeconds<=0)throw new Error('Invalid target video timeline')
  const bytes=Buffer.from(input),before=inspect(bytes)
  if(before.blocks.length!==frameCount)throw new Error(`WebM contains ${before.blocks.length} frames; expected exactly ${frameCount}. Refusing to invent or drop frames.`)
  const ticks=Array.from({length:frameCount},(_,index)=>Math.round(index*durationSeconds/frameCount*1e9/before.scale))
  if(ticks.some((tick,index)=>index>0&&tick<=ticks[index-1]))throw new Error('WebM timestamp scale is too coarse for the requested timeline')
  let frameIndex=0
  for(const cluster of before.clusters){
    const base=ticks[frameIndex]
    writeUint(bytes,cluster.timeElement,base)
    for(const block of cluster.blocks){
      const relative=ticks[frameIndex++]-base
      if(relative<-32768||relative>32767)throw new Error('Retimed frame exceeds the existing cluster timestamp range')
      bytes.writeInt16BE(relative,block.timeOffset)
    }
  }
  for(const cue of before.cueTimes)writeUint(bytes,cue.element,ticks[cue.frameIndex])
  writeFloat(bytes,before.durationElement,durationSeconds*1e9/before.scale)
  const after=inspect(bytes),toleranceSeconds=before.scale/1e9/2+1e-9
  if(after.blocks.length!==frameCount||Math.abs(after.durationSeconds-durationSeconds)>1e-6)throw new Error('WebM duration/frame-count verification failed after retiming')
  for(let index=0;index<frameCount;index++){
    const block=after.blocks[index],original=before.blocks[index]
    if(block.time!==ticks[index]||Math.abs(block.time*before.scale/1e9-index*durationSeconds/frameCount)>toleranceSeconds)throw new Error(`Frame ${index}: incorrect timestamp after retiming`)
    if(!bytes.subarray(block.payloadStart,block.element.end).equals(Buffer.from(input).subarray(original.payloadStart,original.element.end)))throw new Error(`Frame ${index}: encoded image unexpectedly changed`)
  }
  return {bytes,timing:{frameCount,durationSeconds:after.durationSeconds,fps:frameCount/durationSeconds,timestampScaleNanoseconds:after.scale,maxTimestampErrorSeconds:toleranceSeconds-1e-9,firstTimestampSeconds:after.blocks[0].time*after.scale/1e9,lastTimestampSeconds:after.blocks.at(-1).time*after.scale/1e9,recordedDurationSeconds:before.durationSeconds}}
}
