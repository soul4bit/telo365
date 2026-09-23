import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

// GLTFExporter uses FileReader in browsers. This minimal implementation keeps
// the asset generator dependency-free when it runs under Node.
globalThis.FileReader ??= class NodeFileReader {
  result = null
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(value => {
      this.result = value
      this.onloadend?.()
    }).catch(error => {
      this.error = error
      this.onerror?.(error)
      this.onloadend?.()
    })
  }
}

const outputRoot = resolve('public/media/exercises')
const modelsDir = resolve(outputRoot, 'models')
const animationsDir = resolve(outputRoot, 'animations')

const skin = new THREE.MeshStandardMaterial({ color: '#d59f7f', roughness: .72 })
const top = new THREE.MeshStandardMaterial({ color: '#527d55', roughness: .78 })
const bottoms = new THREE.MeshStandardMaterial({ color: '#355b43', roughness: .8 })
const shoes = new THREE.MeshStandardMaterial({ color: '#f1f5ec', roughness: .85 })
const weight = new THREE.MeshStandardMaterial({ color: '#638f62', roughness: .62, metalness: .08 })

const addMesh = (parent, geometry, material, position, rotation = [0, 0, 0]) => {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  mesh.castShadow = true
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

const limb = (parent, material, length, radius, position) => addMesh(parent, new THREE.CapsuleGeometry(radius, Math.max(.04, length - radius * 2), 6, 10), material, position)
const joint = (parent, material, radius, position) => addMesh(parent, new THREE.SphereGeometry(radius, 12, 9), material, position)

function buildTrainer({ meshes = true } = {}) {
  const root = new THREE.Group()
  root.name = 'TeloTrainer'
  root.position.y = .138
  root.scale.setScalar(.92)
  const hips = new THREE.Group(); hips.name = 'Hips'; hips.position.set(0, 1.04, 0); root.add(hips)
  const spine = new THREE.Group(); spine.name = 'Spine'; spine.position.set(0, .12, 0); hips.add(spine)
  const chest = new THREE.Group(); chest.name = 'Chest'; chest.position.set(0, .5, 0); spine.add(chest)
  const head = new THREE.Group(); head.name = 'Head'; head.position.set(0, .43, 0); chest.add(head)

  const leftUpperArm = new THREE.Group(); leftUpperArm.name = 'LeftUpperArm'; leftUpperArm.position.set(-.38, .31, 0); chest.add(leftUpperArm)
  const leftLowerArm = new THREE.Group(); leftLowerArm.name = 'LeftLowerArm'; leftLowerArm.position.set(0, -.43, 0); leftUpperArm.add(leftLowerArm)
  const rightUpperArm = new THREE.Group(); rightUpperArm.name = 'RightUpperArm'; rightUpperArm.position.set(.38, .31, 0); chest.add(rightUpperArm)
  const rightLowerArm = new THREE.Group(); rightLowerArm.name = 'RightLowerArm'; rightLowerArm.position.set(0, -.43, 0); rightUpperArm.add(rightLowerArm)

  const leftUpperLeg = new THREE.Group(); leftUpperLeg.name = 'LeftUpperLeg'; leftUpperLeg.position.set(-.22, -.08, 0); hips.add(leftUpperLeg)
  const leftLowerLeg = new THREE.Group(); leftLowerLeg.name = 'LeftLowerLeg'; leftLowerLeg.position.set(0, -.58, 0); leftUpperLeg.add(leftLowerLeg)
  const leftFoot = new THREE.Group(); leftFoot.name = 'LeftFoot'; leftFoot.position.set(0, -.53, .02); leftLowerLeg.add(leftFoot)
  const rightUpperLeg = new THREE.Group(); rightUpperLeg.name = 'RightUpperLeg'; rightUpperLeg.position.set(.22, -.08, 0); hips.add(rightUpperLeg)
  const rightLowerLeg = new THREE.Group(); rightLowerLeg.name = 'RightLowerLeg'; rightLowerLeg.position.set(0, -.58, 0); rightUpperLeg.add(rightLowerLeg)
  const rightFoot = new THREE.Group(); rightFoot.name = 'RightFoot'; rightFoot.position.set(0, -.53, .02); rightLowerLeg.add(rightFoot)

  const leftDumbbell = new THREE.Group(); leftDumbbell.name = 'LeftDumbbell'; leftDumbbell.position.set(0, -.38, 0); leftDumbbell.scale.setScalar(0); leftLowerArm.add(leftDumbbell)
  const rightDumbbell = new THREE.Group(); rightDumbbell.name = 'RightDumbbell'; rightDumbbell.position.set(0, -.38, 0); rightDumbbell.scale.setScalar(0); rightLowerArm.add(rightDumbbell)

  if (meshes) {
    addMesh(hips, new THREE.BoxGeometry(.58, .26, .28), bottoms, [0, .02, 0])
    addMesh(spine, new THREE.CapsuleGeometry(.26, .4, 8, 12), top, [0, .26, 0])
    joint(head, skin, .19, [0, .19, 0])
    limb(leftUpperArm, skin, .48, .105, [0, -.23, 0]); limb(leftLowerArm, skin, .43, .09, [0, -.2, 0])
    limb(rightUpperArm, skin, .48, .105, [0, -.23, 0]); limb(rightLowerArm, skin, .43, .09, [0, -.2, 0])
    limb(leftUpperLeg, bottoms, .63, .145, [0, -.29, 0]); limb(leftLowerLeg, skin, .57, .115, [0, -.26, 0])
    limb(rightUpperLeg, bottoms, .63, .145, [0, -.29, 0]); limb(rightLowerLeg, skin, .57, .115, [0, -.26, 0])
    addMesh(leftFoot, new THREE.BoxGeometry(.24, .11, .42), shoes, [0, -.06, .15])
    addMesh(rightFoot, new THREE.BoxGeometry(.24, .11, .42), shoes, [0, -.06, .15])
    for (const dumbbell of [leftDumbbell, rightDumbbell]) {
      addMesh(dumbbell, new THREE.CylinderGeometry(.035, .035, .34, 8), weight, [0, -.05, 0], [0, 0, Math.PI / 2])
      addMesh(dumbbell, new THREE.CylinderGeometry(.11, .11, .065, 10), weight, [-.18, -.05, 0], [0, 0, Math.PI / 2])
      addMesh(dumbbell, new THREE.CylinderGeometry(.11, .11, .065, 10), weight, [.18, -.05, 0], [0, 0, Math.PI / 2])
    }
  }
  return root
}

const rotation = (name, times, angles) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, angles.flatMap(angle => new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0)).toArray()))
const v3 = (name, times, values) => new THREE.VectorKeyframeTrack(name, times, values.flat())
const repeat = values => [...values, values[0]]

function clipFor(name) {
  const t = [0, .9, 1.8]
  if (name === 'squat') return new THREE.AnimationClip('squat', 1.8, [
    v3('Hips.position', t, [[0, 1.04, 0], [0, .73, .04], [0, 1.04, 0]]),
    rotation('Hips', t, [0, .22, 0]),
    rotation('LeftUpperLeg', t, [0, .82, 0]), rotation('RightUpperLeg', t, [0, .82, 0]),
    rotation('LeftLowerLeg', t, [0, -.86, 0]), rotation('RightLowerLeg', t, [0, -.86, 0]),
    rotation('LeftUpperArm', t, [0, -.25, 0]), rotation('RightUpperArm', t, [0, -.25, 0])
  ])
  if (name === 'pushup') return new THREE.AnimationClip('pushup', 2, [
    v3('Hips.position', [0, 1, 2], [[0, .49, -.18], [0, .37, -.18], [0, .49, -.18]]),
    rotation('Hips', [0, 1, 2], [Math.PI / 2, Math.PI / 2, Math.PI / 2]),
    rotation('Spine', [0, 1, 2], [-.1, .08, -.1]),
    rotation('LeftUpperArm', [0, 1, 2], [-1.33, -.95, -1.33]), rotation('RightUpperArm', [0, 1, 2], [-1.33, -.95, -1.33]),
    rotation('LeftLowerArm', [0, 1, 2], [-.25, -.82, -.25]), rotation('RightLowerArm', [0, 1, 2], [-.25, -.82, -.25]),
    rotation('LeftUpperLeg', [0, 1, 2], [-.55, -.55, -.55]), rotation('RightUpperLeg', [0, 1, 2], [-.55, -.55, -.55])
  ])
  if (name === 'plank') return new THREE.AnimationClip('plank', 2.4, [
    v3('Hips.position', [0, 1.2, 2.4], [[0, .47, -.2], [0, .49, -.2], [0, .47, -.2]]),
    rotation('Hips', [0, 1.2, 2.4], [Math.PI / 2, Math.PI / 2, Math.PI / 2]),
    rotation('Spine', [0, 1.2, 2.4], [0, -.035, 0]),
    rotation('LeftUpperArm', [0, 1.2, 2.4], [-1.62, -1.62, -1.62]), rotation('RightUpperArm', [0, 1.2, 2.4], [-1.62, -1.62, -1.62]),
    rotation('LeftLowerArm', [0, 1.2, 2.4], [-.28, -.28, -.28]), rotation('RightLowerArm', [0, 1.2, 2.4], [-.28, -.28, -.28]),
    rotation('LeftUpperLeg', [0, 1.2, 2.4], [-.58, -.58, -.58]), rotation('RightUpperLeg', [0, 1.2, 2.4], [-.58, -.58, -.58])
  ])
  if (name === 'dumbbell_row') return new THREE.AnimationClip('dumbbell_row', 2, [
    v3('Hips.position', [0, 1, 2], [[0, .87, .08], [0, .87, .08], [0, .87, .08]]),
    rotation('Hips', [0, 1, 2], [.62, .62, .62]), rotation('Spine', [0, 1, 2], [.1, .1, .1]),
    rotation('LeftUpperLeg', [0, 1, 2], [.18, .18, .18]), rotation('RightUpperLeg', [0, 1, 2], [.18, .18, .18]),
    rotation('LeftUpperArm', [0, 1, 2], [.1, .1, .1]), rotation('RightUpperArm', [0, 1, 2], [.22, -.63, .22]),
    rotation('RightLowerArm', [0, 1, 2], [-.12, -.55, -.12]),
    v3('RightDumbbell.scale', [0, 1, 2], [[1, 1, 1], [1, 1, 1], [1, 1, 1]])
  ])
  if (name === 'shoulder_press') return new THREE.AnimationClip('shoulder_press', 2, [
    rotation('LeftUpperArm', [0, 1, 2], [-.85, -2.45, -.85]), rotation('RightUpperArm', [0, 1, 2], [-.85, -2.45, -.85]),
    rotation('LeftLowerArm', [0, 1, 2], [-.3, -.05, -.3]), rotation('RightLowerArm', [0, 1, 2], [-.3, -.05, -.3]),
    v3('LeftDumbbell.scale', [0, 1, 2], [[1, 1, 1], [1, 1, 1], [1, 1, 1]]), v3('RightDumbbell.scale', [0, 1, 2], [[1, 1, 1], [1, 1, 1], [1, 1, 1]])
  ])
  throw new Error(`Unknown exercise animation: ${name}`)
}

async function exportGlb(scene, animations, path) {
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(scene, { binary: true, animations, onlyVisible: true })
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, Buffer.from(result))
}

await mkdir(modelsDir, { recursive: true })
await mkdir(animationsDir, { recursive: true })

const modelScene = new THREE.Scene()
modelScene.add(buildTrainer())
await exportGlb(modelScene, [], resolve(modelsDir, 'telo-trainer.glb'))

for (const name of ['squat', 'pushup', 'plank', 'dumbbell_row', 'shoulder_press']) {
  const animationScene = new THREE.Scene()
  animationScene.add(buildTrainer({ meshes: false }))
  await exportGlb(animationScene, [clipFor(name)], resolve(animationsDir, `${name}.glb`))
}

console.log('Generated TELO365 exercise GLBs in public/media/exercises/')
