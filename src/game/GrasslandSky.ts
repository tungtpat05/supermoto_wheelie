import * as THREE from 'three';
import { FIELD_NOISE } from './GrasslandMaterial';

export const SUN_DIRECTION = new THREE.Vector3(-.65, .42, .75).normalize();

export function createGrasslandSky(time: { value: number }) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2100, 32, 20), new THREE.ShaderMaterial({
    name: 'Blue atmosphere and layered procedural clouds',
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { fieldTime: time, sunDirection: { value: SUN_DIRECTION } },
    vertexShader: `varying vec3 vDirection;
      void main() { vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vDirection;
      uniform float fieldTime;
      uniform vec3 sunDirection;
      ${FIELD_NOISE}
      float clouds(vec2 p) {
        return fieldNoise(p)*.53 + fieldNoise(p*2.03+13.)*.28
          + fieldNoise(p*4.07-7.)*.13 + fieldNoise(p*8.11)*.06;
      }
      void main() {
        vec3 d=normalize(vDirection);
        float altitude=max(d.y,0.);
        vec3 sky=mix(vec3(.48,.65,.80),vec3(.035,.17,.43),pow(altitude,.32));
        float alignment=max(dot(d,sunDirection),0.);
        sky += vec3(.23,.16,.075)*pow(alignment,18.);
        sky += vec3(.30,.23,.13)*pow(alignment,180.);
        sky = mix(sky,vec3(4.5,3.9,2.9),smoothstep(.99980,.99994,alignment));
        // One inexpensive projected cloud layer; no volumes or screen passes.
        vec2 uv=d.xz/max(d.y+.12,.08)*1.45 + vec2(fieldTime*.0015,0.);
        uv += vec2(fieldNoise(uv*.7),fieldNoise(uv*.7+17.))*.8;
        float cloudNoise=clouds(uv);
        float cover=smoothstep(.49,.69,cloudNoise);
        cover *= smoothstep(.015,.12,altitude);
        vec3 cloud=mix(vec3(.53,.62,.72),vec3(1.25,1.25,1.20),smoothstep(.5,.76,cloudNoise));
        cloud += vec3(.15,.085,.025)*pow(alignment,6.);
        sky=mix(sky,cloud,cover*.94);
        gl_FragColor=vec4(sky,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.name = 'Grassland sky';
  // Draw behind populated depth: clouds are shaded only on visible sky pixels.
  sky.renderOrder = 2;
  return sky;
}

export function createGrasslandHills() {
  const group = new THREE.Group();
  group.name = 'Three atmospheric ridgelines';
  for (let layer = 0; layer < 3; layer++) {
    const geo = new THREE.PlaneGeometry(1, 1, 192, 16);
    const p = geo.attributes.position;
    const colors: number[] = [];
    const low = new THREE.Color([0x526b41,0x6b8180,0x889ca9][layer]);
    const high = new THREE.Color([0x86956b,0x93a69b,0xa4b5bf][layer]);
    const color = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const a = (i % 193) / 192 * Math.PI * 2;
      const v = Math.floor(i / 193) / 16;
      const r = 640 + layer*310 + v*290;
      const peaks = 26 + layer*19 + 26*Math.sin(a*3+layer)**2
        + 32*Math.sin(a*5-1.2+layer)**4 + 12*Math.sin(a*11+layer)**2;
      const y = -12 + Math.sin(v*Math.PI)*peaks;
      p.setXYZ(i,Math.cos(a)*r,y,Math.sin(a)*r);
      color.copy(low).lerp(high,.25 + .4*Math.sin(a*13+v*7)**2 + .15*v);
      colors.push(color.r,color.g,color.b);
    }
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    geo.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      vertexColors:true, roughness:1, side:THREE.DoubleSide,
    });
    material.onBeforeCompile = shader => {
      shader.vertexShader = 'varying vec3 vRidge;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvRidge = position;');
      shader.fragmentShader = `varying vec3 vRidge;\n${FIELD_NOISE}\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        float meadow = fieldNoise(vRidge.xz*.028)*.7 + fieldNoise(vRidge.xz*.11)*.3;
        diffuseColor.rgb *= mix(vec3(.76,.84,.69),vec3(1.13,1.1,.94),meadow);
      `);
    };
    const hills = new THREE.Mesh(geo,material);
    hills.name = `Distant ridge ${layer+1}`;
    group.add(hills);
  }
  return group;
}
