import * as THREE from 'three';

// World-space sampling keeps recycled tiles continuous. These are render-only;
// the shared tire/camera height function remains in SteppeTerrain.
export const FIELD_NOISE = `
  float fieldHash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * .1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  float fieldNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(fieldHash(i), fieldHash(i + vec2(1,0)), f.x),
      mix(fieldHash(i + vec2(0,1)), fieldHash(i + 1.), f.x), f.y);
  }
`;

export function createGrasslandMaterial(texture: THREE.Texture) {
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .96 });
  material.name = 'World-space grass, dry turf and worn earth';
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 vEarth;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvEarth = (modelMatrix * vec4(position, 1.)).xyz;');
    shader.fragmentShader = `varying vec3 vEarth;\n${FIELD_NOISE}\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec2 p = vEarth.xz;
      float macro = fieldNoise(p * .025);
      float turfPatch = fieldNoise(p * .16 + macro * 2.);
      float track = p.x - sin(p.y*.008)*16. - sin(p.y*.023)*4.;
      float ruts = exp(-pow((abs(track)-1.5)/.85,2.));
      float clearing = max(0.,sin(p.x*.026+p.y*.016)*cos(p.y*.021-p.x*.013));
      float wear = max(ruts*.94,max(exp(-pow(track/6.,2.))*.62,pow(clearing,3.)));
      float bare = smoothstep(.25,.85,wear + (turfPatch-.5)*.26);

      // Two unrelated orientations/scales + broad color variation break tiling.
      vec3 texA = texture2D(map, p * .38).rgb;
      vec2 rotated = mat2(.8,-.6,.6,.8) * p;
      vec3 texB = texture2D(map, rotated * .213 + vec2(.37,.71)).rgb;
      float detail = dot(mix(texA,texB,.38), vec3(.299,.587,.114));
      float footprint = max(length(dFdx(p)),length(dFdy(p)));
      float closeDetail = 1. - smoothstep(.05,.32,footprint);
      float grain = mix(.5,fieldNoise(rotated*19.),closeDetail);
      vec3 living = mix(vec3(.082,.145,.031),vec3(.19,.235,.073),macro);
      vec3 dry = vec3(.29,.266,.123);
      vec3 turf = mix(living,dry,smoothstep(.52,.88,turfPatch)*.58);
      turf *= clamp(.62 + detail*5.4,.65,1.65);
      float soilVariation = fieldNoise(rotated*.73 + macro*3.)*.6 + fieldNoise(p*2.31)*.4;
      vec3 soil = mix(vec3(.27,.195,.128),vec3(.36,.271,.181),soilVariation);
      soil *= .88 + grain*.24;
      // Fine, intermittent tread traces inside the existing dirt ruts.
      float tread = (1.-smoothstep(.035,.11,abs(fract(p.y*3.4 + abs(track)*.5)-.5)))
        * ruts * closeDetail * (.35+.65*fieldNoise(p*.6));
      diffuseColor.rgb *= mix(turf,soil,bare) * (1.-tread*.13);
      float microHeight = mix(detail*.045,grain*.012,bare);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #include <normal_fragment_maps>
      // Derivative bump, limited to the near field to avoid horizon shimmer.
      vec3 dpX = dFdx(-vViewPosition), dpY = dFdy(-vViewPosition);
      vec3 rX = cross(dpY,normal), rY = cross(normal,dpX);
      float det = dot(dpX,rX);
      vec3 gradient = sign(det)*(dFdx(microHeight)*rX+dFdy(microHeight)*rY);
      normal = normalize(abs(det)*normal-gradient*closeDetail);
    `);
  };
  return material;
}
