import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

type Vec3 = [number, number, number]
type Placement = { position: Vec3; rotation?: Vec3 }
const floorY = -1.06
const palette = { plaster: '#e3e2d9', sage: '#94a18e', green: '#354e40', metal: '#343d37', rubber: '#606960', oak: '#bbad95', upholstery: '#536857' }

function SoftBox({ size, position = [0, 0, 0], rotation = [0, 0, 0], color, radius = .012, metalness = 0, roughness = .7, map }: {
  size: Vec3; position?: Vec3; rotation?: Vec3; color: string; radius?: number; metalness?: number; roughness?: number; map?: THREE.Texture
}) {
  const geometry = useMemo(() => new RoundedBoxGeometry(...size, 2, radius), [size[0], size[1], size[2], radius])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={position} rotation={rotation} castShadow receiveShadow>
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} map={map}/>
  </mesh>
}

/** Deterministic, original material textures. No downloaded environment assets. */
function useSurfaceTexture(kind: 'rubber' | 'oak' | 'plaster') {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const ctx = canvas.getContext('2d')!
    let seed = 74921
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296 }
    ctx.fillStyle = kind === 'oak' ? '#e1d5bf' : '#e3e3df'
    ctx.fillRect(0, 0, 512, 512)
    if (kind === 'oak') {
      for (let i = 0; i < 450; i++) {
        const x = random() * 512
        ctx.strokeStyle = `rgba(103,87,62,${.025 + random() * .065})`
        ctx.lineWidth = .4 + random() * 1.2
        ctx.beginPath(); ctx.moveTo(x, 0)
        ctx.bezierCurveTo(x + random() * 9, 170, x - random() * 8, 340, x + random() * 5, 512)
        ctx.stroke()
      }
    } else {
      for (let i = 0; i < 28000; i++) {
        const shade = random() > .5 ? '255,255,250' : '35,42,35'
        ctx.fillStyle = `rgba(${shade},${random() * (kind === 'rubber' ? .18 : .025)})`
        const size = kind === 'rubber' ? .4 + random() * 1.2 : .6 + random() * 2
        ctx.fillRect(random() * 512, random() * 512, size, size)
      }
    }
    const result = new THREE.CanvasTexture(canvas)
    result.colorSpace = THREE.SRGBColorSpace
    result.wrapS = result.wrapT = THREE.RepeatWrapping
    result.repeat.set(kind === 'rubber' ? 9 : 1, kind === 'rubber' ? 9 : 1)
    result.anisotropy = 8
    return result
  }, [kind])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function Wall({ position, rotation = [0, 0, 0] }: Placement) {
  const plaster = useSurfaceTexture('plaster')
  return <group position={position} rotation={rotation}>
    <mesh position={[0, .74, 0]} receiveShadow><planeGeometry args={[9.6, 3.6]}/><meshStandardMaterial color={palette.plaster} map={plaster} roughness={.94}/></mesh>
    <SoftBox size={[9.6, .095, .035]} position={[0, floorY + .047, .025]} color="#939d8a" radius={.004}/>
    <SoftBox size={[9.6, .035, .025]} position={[0, 2.28, .025]} color="#c8ccbc" radius={.003}/>
  </group>
}

function OakPanel({ position, rotation = [0, 0, 0], width = 1.65 }: Placement & { width?: number }) {
  const oak = useSurfaceTexture('oak')
  const count = Math.round(width / .095)
  return <group position={position} rotation={rotation}>
    <SoftBox size={[width, 2.72, .045]} position={[0, .37, 0]} color="#777c69" radius={.005}/>
    {Array.from({ length: count }, (_, i) => <SoftBox key={i} size={[.062, 2.7, .052]} position={[-width / 2 + (i + .5) * width / count, .37, .045]} radius={.007} color={palette.oak} map={oak}/>) }
  </group>
}

function Brand({ position, rotation = [0, 0, 0], width = 1.75 }: Placement & { width?: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1536; canvas.height = 256
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, 1536, 256)
    ctx.font = '500 166px Arial, sans-serif'
    ctx.fillStyle = '#6c7968'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('TELO365.RU', 768, 140)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8
    return map
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  // Printed wall lettering obeys world lighting and perspective, with no screen overlay.
  return <mesh position={position} rotation={rotation} receiveShadow>
    <planeGeometry args={[width, width / 6]}/><meshStandardMaterial map={texture} transparent alphaTest={.1} roughness={.84} depthWrite={false}/>
  </mesh>
}

function WindowWall({ position, rotation = [0, 0, 0] }: Placement) {
  return <group position={position} rotation={rotation}>
    <mesh position={[0, .49, 0]}><planeGeometry args={[2.35, 2.65]}/><meshStandardMaterial color="#e9eee4" emissive="#dbe5d6" emissiveIntensity={.35} roughness={.4}/></mesh>
    {[-1.2, 0, 1.2].map(x => <SoftBox key={x} size={[.045, 2.77, .055]} position={[x, .49, .045]} color="#737d70" radius={.004} metalness={.25}/>) }
    {[-.88, 1.86].map(y => <SoftBox key={y} size={[2.44, .045, .055]} position={[0, y, .045]} color="#737d70" radius={.004}/>) }
    <SoftBox size={[2.48, .045, .12]} position={[0, -.89, .06]} color="#c8caba"/>
  </group>
}

function Bar({ from, to, radius = .022, color = palette.metal }: { from: Vec3; to: Vec3; radius?: number; color?: string }) {
  const direction = new THREE.Vector3(...to).sub(new THREE.Vector3(...from))
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize())
  return <mesh position={new THREE.Vector3(...from).add(new THREE.Vector3(...to)).multiplyScalar(.5)} quaternion={quaternion} castShadow receiveShadow>
    <cylinderGeometry args={[radius, radius, direction.length(), 16]}/><meshStandardMaterial color={color} roughness={.5} metalness={.3}/>
  </mesh>
}

function Rack({ position, rotation = [0, 0, 0] }: Placement) {
  return <group position={position} rotation={rotation}>
    {[-.58, .58].map(x => <group key={x}>
      <SoftBox size={[.07, 2.2, .07]} position={[x, 1.1, 0]} color={palette.metal} radius={.008} metalness={.35}/>
      <SoftBox size={[.12, .055, .78]} position={[x, .027, .26]} color={palette.metal}/>
      <SoftBox size={[.09, .12, .13]} position={[x, 1.12, .07]} color="#657965"/>
      {Array.from({ length: 10 }, (_, i) => <mesh key={i} position={[x, .38 + i * .13, .036]}><circleGeometry args={[.009, 10]}/><meshStandardMaterial color="#202d27"/></mesh>) }
    </group>) }
    <Bar from={[-.62, 2.13, .01]} to={[.62, 2.13, .01]} radius={.022}/>
    <Bar from={[-.83, 1.16, .13]} to={[.83, 1.16, .13]} radius={.018} color="#91998d"/>
    {[-.77, .77].map(x => <mesh key={x} position={[x, 1.16, .13]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow><cylinderGeometry args={[.19, .19, .047, 32]}/><meshStandardMaterial color={palette.green} roughness={.72}/></mesh>) }
  </group>
}

function Dumbbell({ position, radius = .085 }: { position: Vec3; radius?: number }) {
  return <group position={position}>
    <Bar from={[-.095, 0, 0]} to={[.095, 0, 0]} radius={.018} color="#9aa296"/>
    {[-.125, .125].map(x => <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow><cylinderGeometry args={[radius, radius, .07, 8]}/><meshStandardMaterial color="#3c4840" roughness={.79}/></mesh>) }
  </group>
}

function WeightsShelf({ position, rotation = [0, 0, 0] }: Placement) {
  return <group position={position} rotation={rotation}>
    {[-.74, .74].map(x => <group key={x}>
      <SoftBox size={[.055, .71, .055]} position={[x, .355, 0]} color={palette.metal}/>
      <SoftBox size={[.07, .04, .46]} position={[x, .02, 0]} color={palette.metal}/>
    </group>) }
    {[.28, .67].map(y => <group key={y}>
      <SoftBox size={[1.65, .055, .35]} position={[0, y, 0]} color={palette.metal}/>
      {[-.59, -.2, .2, .59].map((x, i) => <Dumbbell key={x} position={[x, y + .103, 0]} radius={.073 + i * .006}/>) }
    </group>) }
  </group>
}

function Kettlebell({ position, size = 1 }: { position: Vec3; size?: number }) {
  return <group position={position} scale={size}>
    <mesh position={[0, .105, 0]} scale={[1, .88, .85]} castShadow receiveShadow><sphereGeometry args={[.115, 24, 16]}/><meshStandardMaterial color={palette.green} roughness={.78} metalness={.1}/></mesh>
    <mesh position={[0, .24, 0]} castShadow><torusGeometry args={[.068, .017, 12, 24]}/><meshStandardMaterial color="#667b64" roughness={.55} metalness={.25}/></mesh>
    <SoftBox size={[.1, .027, .09]} position={[0, .014, 0]} color={palette.green}/>
  </group>
}

function Bench({ position, rotation = [0, 0, 0] }: Placement) {
  return <group position={position} rotation={rotation}>
    <SoftBox size={[1.28, .10, .40]} position={[0, .43, 0]} color={palette.upholstery} radius={.045} roughness={.91}/>
    <SoftBox size={[1.10, .065, .22]} position={[0, .35, 0]} color={palette.metal}/>
    {[-.47, .47].map(x => <group key={x}>
      <SoftBox size={[.08, .32, .08]} position={[x, .18, 0]} rotation={[0, 0, x > 0 ? -.14 : .14]} color={palette.metal}/>
      <SoftBox size={[.095, .05, .52]} position={[x, .028, 0]} color={palette.metal}/>
    </group>) }
  </group>
}

function WallBars({ position, rotation = [0, 0, 0] }: Placement) {
  const oak = useSurfaceTexture('oak')
  return <group position={position} rotation={rotation}>
    <SoftBox size={[1.58, 2.5, .06]} position={[0, 1.26, -.09]} color={palette.sage} radius={.045}/>
    {[-.48, .48].map(x => <SoftBox key={x} size={[.06, 2.22, .085]} position={[x, 1.17, .045]} color={palette.oak} map={oak}/>) }
    {Array.from({ length: 9 }, (_, i) => <Bar key={i} from={[-.51, .24 + i * .235, .10]} to={[.51, .24 + i * .235, .10]} radius={.025} color="#b1a086"/>) }
  </group>
}

function PlyoBox({ position, rotation = [0, 0, 0] }: Placement) {
  const oak = useSurfaceTexture('oak')
  return <group position={position} rotation={rotation}>
    <SoftBox size={[.58, .5, .5]} position={[0, .25, 0]} color="#c9b28b" map={oak} radius={.018}/>
    <SoftBox size={[.19, .036, .006]} position={[0, .37, .253]} color="#6c6f5b" radius={.017}/>
  </group>
}

function Plant({ position }: Placement) {
  return <group position={position}>
    <mesh position={[0, .19, 0]} castShadow receiveShadow><cylinderGeometry args={[.17, .14, .38, 32]}/><meshStandardMaterial color="#c6c1ad" roughness={.85}/></mesh>
    {Array.from({ length: 11 }, (_, i) => {
      const angle = i * 2.39996, height = .55 + (i % 4) * .15
      const tip: Vec3 = [Math.sin(angle) * .16, height, Math.cos(angle) * .16]
      return <group key={i}>
        <Bar from={[0, .35, 0]} to={tip} radius={.006} color="#738769"/>
        <mesh position={tip} rotation={[.3, angle, .5]} scale={[.055, .18, .022]} castShadow><sphereGeometry args={[1, 12, 10]}/><meshStandardMaterial color={i % 2 ? '#728663' : '#536d52'} roughness={.83}/></mesh>
      </group>
    }) }
  </group>
}

/** One fixed room: no avatar, view or exercise-dependent placement or lighting. */
export function FunctionalStudio() {
  const rubber = useSurfaceTexture('rubber')
  return <group name="TELO365-Functional-Studio-v3">
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0]} receiveShadow><planeGeometry args={[9.6, 9.6]}/><meshStandardMaterial color={palette.rubber} map={rubber} roughness={.96}/></mesh>
    {[-3.2, -1.6, 0, 1.6, 3.2].flatMap(value => [
      <mesh key={`x${value}`} rotation={[-Math.PI / 2, 0, 0]} position={[value, floorY + .001, 0]} receiveShadow><planeGeometry args={[.004, 9.6]}/><meshStandardMaterial color="#454e46" roughness={1}/></mesh>,
      <mesh key={`z${value}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY + .001, value]} receiveShadow><planeGeometry args={[9.6, .004]}/><meshStandardMaterial color="#454e46" roughness={1}/></mesh>
    ]) }
    <Wall position={[0, 0, -4.8]}/><Wall position={[0, 0, 4.8]} rotation={[0, Math.PI, 0]}/>
    <Wall position={[-4.8, 0, 0]} rotation={[0, Math.PI / 2, 0]}/><Wall position={[4.8, 0, 0]} rotation={[0, -Math.PI / 2, 0]}/>
    {/* Strength zone, visible from the front and across the 3/4 corner. */}
    <OakPanel position={[-2.1, 0, -4.73]} width={1.85}/>
    <Rack position={[-1.75, floorY, -4.2]}/>
    <WeightsShelf position={[1.53, floorY, -4.18]}/>
    <Brand position={[.45, 1.58, -4.79]} width={1.62}/>
    <SoftBox size={[2.0, 1.48, .035]} position={[1.54, -.17, -4.74]} color="#aab4a0" radius={.035}/>
    {/* Side zone: matching timber wall bars, low bench and kettlebell shelf. */}
    <WallBars position={[-4.64, floorY, -2.1]} rotation={[0, Math.PI / 2, 0]}/>
    <Bench position={[-4.03, floorY, -.95]} rotation={[0, Math.PI / 2, 0]}/>
    <WindowWall position={[-4.77, 0, 1.8]} rotation={[0, Math.PI / 2, 0]}/>
    <group position={[-4.2, floorY, .75]} rotation={[0, Math.PI / 2, 0]}>
      <SoftBox size={[1.07, .11, .38]} position={[0, .055, 0]} color={palette.metal}/>
      {[-.32, 0, .32].map((x, i) => <Kettlebell key={x} position={[x, .11, 0]} size={.88 + i * .1}/>) }
    </group>
    <Brand position={[-4.79, 1.60, -3.55]} rotation={[0, Math.PI / 2, 0]} width={1.28}/>
    {/* Opposite wall: recovery/bench zone, distinct rather than a mirrored copy. */}
    <OakPanel position={[1.6, 0, 4.73]} rotation={[0, Math.PI, 0]} width={1.45}/>
    <WallBars position={[-1.53, floorY, 4.62]} rotation={[0, Math.PI, 0]}/>
    <Bench position={[1.32, floorY, 4.03]} rotation={[0, Math.PI, 0]}/>
    <PlyoBox position={[2.4, floorY, 3.98]} rotation={[0, -.15, 0]}/>
    <Plant position={[-4.22, floorY, 3.33]}/>
    <Plant position={[2.45, floorY, -4.24]}/>
    {/* Matching wall finish closes the room; the light never follows the camera. */}
    <SoftBox size={[.035, 2.4, 1.65]} position={[4.74, .20, .7]} color={palette.sage} radius={.02}/>
  </group>
}

export function StudioLighting() {
  const { gl, scene, invalidate } = useThree()
  useEffect(() => {
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(gl)
    const target = pmrem.fromScene(room, .06)
    const previous = scene.environment, intensity = scene.environmentIntensity
    scene.environment = target.texture; scene.environmentIntensity = .08
    room.dispose(); pmrem.dispose(); invalidate()
    return () => { scene.environment = previous; scene.environmentIntensity = intensity; target.dispose() }
  }, [gl, scene, invalidate])
  return <>
    <hemisphereLight args={['#f5f1e6', '#b3baa7', 1.85]}/>
    <directionalLight position={[-3.8, 5.4, 2.0]} intensity={1.35} color="#fff1d9" castShadow
      shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-6} shadow-camera-right={6}
      shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-near={.1} shadow-camera-far={24}
      shadow-bias={-.00018} shadow-normalBias={.012} shadow-radius={8} shadow-blurSamples={8}/>
    <directionalLight position={[3, 3, -2.5]} intensity={.58} color="#eef3e8"/>
  </>
}
