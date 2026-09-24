import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { inspectWebmFrameTiming, retimeWebmFrames } from './webm-frame-timing.mjs'

test('real WebM frames retain their payload and source-clip timing for all eight views',async()=>{
  for(const avatar of ['male','female'])for(const angle of ['front','side','back','three-quarter']){
    const source=await readFile(`public/media/exercises/videos/squat-${avatar}-${angle}.webm`)
    const original=Buffer.from(source)
    const {bytes,timing}=retimeWebmFrames(source,{frameCount:72,durationSeconds:2.375})
    const inspected=inspectWebmFrameTiming(bytes)
    assert.deepEqual(source,original,'Input buffer must remain unchanged')
    assert.equal(bytes.length,source.length,'Offsets must remain valid')
    assert.equal(inspected.frameCount,72)
    assert.equal(inspected.durationSeconds,2.375)
    assert.equal(inspected.timestampsSeconds[0],0)
    for(const [index,time] of inspected.timestampsSeconds.entries()){
      assert.ok(Math.abs(time-index*2.375/72)<=.000501)
    }
    assert.equal(timing.fps,72/2.375)
    assert.deepEqual(retimeWebmFrames(bytes,{frameCount:72,durationSeconds:2.375}).bytes,bytes,'Retiming must be idempotent')
    assert.throws(()=>retimeWebmFrames(source,{frameCount:71,durationSeconds:2.375}),/expected exactly 71/)
    assert.throws(()=>retimeWebmFrames(source.subarray(0,source.length-10),{frameCount:72,durationSeconds:2.375}),/Truncated/)
  }
})

test('retiming rejects invalid timelines and unknown WebM layouts',async()=>{
  const bytes=await readFile('public/media/exercises/videos/squat-male-front.webm')
  for(const durationSeconds of [0,-1,NaN,Infinity])assert.throws(()=>retimeWebmFrames(bytes,{frameCount:72,durationSeconds}),/Invalid target/)
  assert.throws(()=>retimeWebmFrames(Buffer.from('not a webm'),{frameCount:72,durationSeconds:2.375}))
  // First top-level ID is no longer the EBML header: reject instead of silently
  // trying to repair an unsupported container.
  const unknown=Buffer.from(bytes);unknown[3]=0xa4
  assert.throws(()=>retimeWebmFrames(unknown,{frameCount:72,durationSeconds:2.375}),/Unsupported EBML/)
})
