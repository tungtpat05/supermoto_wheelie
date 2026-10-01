import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HELMETS_DATABASE } from './HelmetConfig';

const loader = new GLTFLoader();
// Scenes and their immutable geometry/materials are shared between rider instances.
const cache = new Map<string, Promise<THREE.Group>>();

export async function loadHelmet(helmetId: string): Promise<THREE.Group> {
  const config = HELMETS_DATABASE.find(helmet => helmet.id === helmetId);
  if (!config) throw new Error(`Unknown helmet: ${helmetId}`);
  let pending = cache.get(helmetId);
  if (!pending) {
    pending = loader.loadAsync(config.url).then(gltf => {
      gltf.scene.traverse(node => {
        if ((node as THREE.Mesh).isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      return gltf.scene;
    });
    cache.set(helmetId, pending);
    // A failed fetch can be retried on a later selection.
    void pending.catch(() => { cache.delete(helmetId); });
  }
  const scene = (await pending).clone(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || !Number.isFinite(size.y) || size.y <= 0) {
    throw new Error(`Helmet has invalid bounds: ${helmetId}`);
  }
  // Neutralize exporter origins/units without changing the asset or cached scene.
  const centered = new THREE.Group();
  scene.position.sub(center);
  centered.add(scene);
  centered.scale.setScalar(config.transform.targetHeight / size.y * config.transform.scale);
  const result = new THREE.Group();
  result.name = `Helmet:${helmetId}`;
  result.position.fromArray(config.transform.position);
  result.rotation.set(...config.transform.rotation);
  result.add(centered);
  return result;
}
