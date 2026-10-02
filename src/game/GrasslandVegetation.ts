import * as THREE from 'three';
import { terrainHeight, terrainWear } from './SteppeTerrain';
import { QUALITY_PRESETS, type GraphicsQuality } from './GraphicsQuality';

const CHUNK = 32;
const GRID = 7;
const CAPACITY = 2400;

/** Interpolate the actual 6 x 4 m terrain triangles so short blades never sink. */
export function grassRootHeight(x: number, z: number) {
  const x0 = Math.floor(x / 6) * 6, z0 = Math.floor(z / 4) * 4;
  const u = (x-x0)/6, v = (z-z0)/4;
  const a = terrainHeight(x0,z0), b = terrainHeight(x0+6,z0);
  const c = terrainHeight(x0,z0+4), d = terrainHeight(x0+6,z0+4);
  return (u+v <= 1 ? a+(b-a)*u+(c-a)*v : d+(c-d)*(1-u)+(b-d)*(1-v)) + .004;
}

interface GrassChunk { mesh: THREE.InstancedMesh; x: number; z: number; count: number }

export class GrasslandVegetation {
  private chunks: GrassChunk[] = [];
  private quality: GraphicsQuality = 'High';
  private viewer = { value: new THREE.Vector2() };
  private distance = { value: QUALITY_PRESETS.High.grassDistance as number };
  private geometry = new THREE.BufferGeometry();
  private material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  private lastX = Infinity;
  private lastZ = Infinity;
  readonly group = new THREE.Group();

  constructor(wind: { value: number }) {
    this.group.name = 'Local grass chunks';
    const positions: number[] = [], normals: number[] = [], indices: number[] = [];
    for (let blade = 0; blade < 4; blade++) {
      const a = blade * 2.4, dx = Math.cos(a), dz = Math.sin(a);
      const base = positions.length / 3;
      // Root, broad middle and bent tip: 3 triangles, 11–27 cm in world space.
      for (const [w,h,bend] of [[-.025,0,0],[.025,0,0],[-.016,.55,.035],[.016,.55,.035],[0,1,.10]]) {
        positions.push(dx*w + dz*bend + dx*.025,h,-dz*w + dx*bend + dz*.025);
        normals.push(dz*.4,.85,dx*.4);
      }
      indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
    }
    this.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    this.geometry.setIndex(indices);
    this.material.name = 'Rooted short grass with distance fade';
    this.material.onBeforeCompile = shader => {
      shader.uniforms.fieldTime = wind;
      shader.uniforms.fieldViewer = this.viewer;
      shader.uniforms.grassDistance = this.distance;
      shader.vertexShader = `uniform float fieldTime; uniform vec2 fieldViewer;
        uniform float grassDistance; varying float vBladeHeight;\n` + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 root = (modelMatrix * instanceMatrix * vec4(0.,0.,0.,1.)).xyz;
        float distanceToRider = length(root.xz-fieldViewer);
        float fade = 1.-smoothstep(grassDistance*.55,grassDistance,distanceToRider);
        transformed *= fade;
        vBladeHeight = position.y;
        transformed.x += sin(fieldTime*1.4+root.x*.37+root.z*.23)*.055*position.y*position.y*fade;
      `);
      shader.fragmentShader = 'varying float vBladeHeight;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb *= mix(vec3(.56,.65,.43),vec3(1.15,1.13,.86),vBladeHeight);
      `);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
        #include <normal_fragment_begin>
        // Use the upward-biased blade normal on both sides; roots stay grounded
        // without alternating black triangles as the rider passes a tuft.
        normal *= gl_FrontFacing ? 1. : -1.;
      `);
    };
    for (let i = 0; i < GRID*GRID; i++) {
      const mesh = new THREE.InstancedMesh(this.geometry,this.material,CAPACITY);
      mesh.name = 'Short grass';
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.chunks.push({mesh,x:Infinity,z:Infinity,count:0});
      this.group.add(mesh);
    }
    this.update(0,0);
  }

  private place(chunk: GrassChunk, cx: number, cz: number) {
    chunk.x = cx; chunk.z = cz;
    let seed = (Math.imul(cx,73856093)^Math.imul(cz,19349663)^83492791) >>> 0;
    const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    let count = 0;
    chunk.mesh.position.set(cx*CHUNK,0,cz*CHUNK);
    for (let i = 0; i < CAPACITY; i++) {
      const x = random()*CHUNK, z = random()*CHUNK;
      const wx = x+cx*CHUNK, wz = z+cz*CHUNK;
      const wear = terrainWear(wx,wz);
      const clump = .66 + .22*Math.sin(wx*.17+Math.sin(wz*.11)*2)*Math.cos(wz*.21);
      if (random() > clump*(1-wear*.96)) continue;
      dummy.position.set(x,grassRootHeight(wx,wz),z);
      dummy.rotation.y = random()*Math.PI*2;
      const height = (.11+random()*.16)*(1-wear*.35);
      dummy.scale.set(.65+random()*.7,height,.65+random()*.7);
      dummy.updateMatrix();
      chunk.mesh.setMatrixAt(count,dummy.matrix);
      color.setHSL(.20+random()*.07,.29+random()*.18,.20+random()*.11);
      chunk.mesh.setColorAt(count++,color);
    }
    chunk.count = count;
    // Bounds cover all instances, including those hidden by the quality prefix.
    chunk.mesh.count = count;
    chunk.mesh.computeBoundingSphere();
    chunk.mesh.count = Math.floor(count*QUALITY_PRESETS[this.quality].grassDensity);
    chunk.mesh.instanceMatrix.needsUpdate = true;
    if (chunk.mesh.instanceColor) chunk.mesh.instanceColor.needsUpdate = true;
  }

  setQuality(quality: GraphicsQuality) {
    this.quality = quality;
    this.distance.value = QUALITY_PRESETS[quality].grassDistance;
    for (const chunk of this.chunks) chunk.mesh.count = Math.floor(chunk.count*QUALITY_PRESETS[quality].grassDensity);
  }

  update(x: number, z: number) {
    this.viewer.value.set(x,z);
    const cx = Math.floor(x/CHUNK), cz = Math.floor(z/CHUNK);
    if (cx !== this.lastX || cz !== this.lastZ) {
      // Stable toroidal pool: only the newly entered row/column is regenerated.
      for (let iz = cz-3; iz <= cz+3; iz++) {
        for (let ix = cx-3; ix <= cx+3; ix++) {
          const slot = ((iz%GRID+GRID)%GRID)*GRID + (ix%GRID+GRID)%GRID;
          const chunk = this.chunks[slot];
          if (chunk.x !== ix || chunk.z !== iz) this.place(chunk,ix,iz);
        }
      }
      this.lastX = cx; this.lastZ = cz;
    }
    for (const {mesh,x:gx,z:gz} of this.chunks) {
      const dx = Math.max(Math.abs((gx+.5)*CHUNK-x)-CHUNK*.5,0);
      const dz = Math.max(Math.abs((gz+.5)*CHUNK-z)-CHUNK*.5,0);
      mesh.visible = dx*dx+dz*dz < this.distance.value**2;
    }
  }

  dispose() {
    this.chunks.forEach(({mesh}) => mesh.dispose());
    this.geometry.dispose();
    this.material.dispose();
    this.group.removeFromParent();
  }
}
