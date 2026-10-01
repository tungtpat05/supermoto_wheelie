import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getBikeConfig } from './BikeConfigs';
import { createSupermotoBike, type SupermotoParts } from './SupermotoMesh';
import { createStickmanRider } from './StickmanRider';

// In-memory cache for raw loaded GLTF scenes to avoid re-fetching 26MB files
const gltfSceneCache = new Map<string, THREE.Group>();
const gltfLoader = new GLTFLoader();

/**
 * Creates a stylized 3D stickman motocross rider matching the bike's color theme
 */
export function createMotocrossRider(suitColor: string | number): THREE.Group {
  return createStickmanRider(suitColor);
}

/**
 * Loads a bike model by its configuration and packages it into SupermotoParts
 */
export async function loadBikeModel(
  bikeId: string,
  onProgress?: (percent: number) => void
): Promise<SupermotoParts> {
  const config = getBikeConfig(bikeId);

  // Fallback to procedural bike if requested or no GLB
  if (config.modelType === 'procedural' || !config.modelUrl) {
    if (onProgress) onProgress(100);
    return createSupermotoBike();
  }

  // Check cache or load asynchronously
  let rawGroup = gltfSceneCache.get(config.id);

  if (!rawGroup) {
    const gltf = await new Promise<any>((resolve, reject) => {
      gltfLoader.load(
        config.modelUrl!,
        (data) => resolve(data),
        (event) => {
          if (event.lengthComputable && onProgress) {
            const percent = Math.round((event.loaded / event.total) * 100);
            onProgress(percent);
          }
        },
        (error) => reject(error)
      );
    });

    rawGroup = gltf.scene as THREE.Group;

    // Optimize materials and enable realistic shadows
    rawGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (mesh.material) {
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial) {
              mat.roughness = Math.max(0.2, mat.roughness);
              mat.envMapIntensity = 1.0;
              // If emissive map exists, prevent excessive blinding
              if (mat.emissiveMap) {
                mat.emissiveIntensity = 0.35;
              }
            }
          });
        }
      }
    });

    gltfSceneCache.set(config.id, rawGroup);
  }

  if (onProgress) onProgress(100);

  // Clone cached model for independent scene placement
  const clonedModel = rawGroup.clone(true);

  // Setup hierarchical structure matching SupermotoParts
  const bikeGroup = new THREE.Group();
  const bodyGroup = new THREE.Group();
  bikeGroup.add(bodyGroup);

  // Transform container for model rotation, offset, and scale
  const transform = config.modelTransform || {
    scale: 1.0,
    rotationY: -Math.PI / 2,
    offsetY: 0.55,
    fenderTip: [0, 0.88, -1.08] as [number, number, number],
    riderOffset: [0, 0.88, -0.15] as [number, number, number],
  };

  clonedModel.position.set(0, transform.offsetY, 0);
  clonedModel.rotation.y = transform.rotationY;
  clonedModel.scale.setScalar(transform.scale);
  bodyGroup.add(clonedModel);

  // Stylized rider mannequin positioned on seat
  const riderGroup = createMotocrossRider(config.color);
  riderGroup.position.set(
    transform.riderOffset[0],
    transform.riderOffset[1],
    transform.riderOffset[2]
  );
  bodyGroup.add(riderGroup);

  // Fender Tip & Sparks emitter
  const fenderTip = new THREE.Vector3(
    transform.fenderTip[0],
    transform.fenderTip[1],
    transform.fenderTip[2]
  );
  const sparksEmitter = new THREE.Group();
  sparksEmitter.position.copy(fenderTip);
  bodyGroup.add(sparksEmitter);

  // Dummy wheel groups so GameCanvas physics / rotation won't break
  const frontWheel = new THREE.Group();
  frontWheel.position.set(0, 0.44, 0.85);
  bodyGroup.add(frontWheel);

  const rearWheel = new THREE.Group();
  rearWheel.position.set(0, 0.44, -0.85);
  bodyGroup.add(rearWheel);

  return {
    bikeGroup,
    bodyGroup,
    frontWheel,
    rearWheel,
    riderGroup,
    fenderTip,
    sparksEmitter,
  };
}
