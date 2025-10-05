import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import gsap from 'gsap';

export function createAlignedBody(mesh, mass, material, scale = new THREE.Vector3(1, 1, 1)) {
    const geom = mesh.geometry;
    geom.computeBoundingBox();
    const bbLocal = geom.boundingBox;

    const size = new THREE.Vector3();
    bbLocal.getSize(size);
    size.multiply(mesh.scale);
    size.multiply(scale);

    const centerLocal = new THREE.Vector3();
    bbLocal.getCenter(centerLocal).multiply(mesh.scale);
    const centerWorld = centerLocal.clone();
    mesh.localToWorld(centerWorld);

    const half = new CANNON.Vec3(size.x * 0.5, size.y * 0.5, size.z * 0.5);
    const boxShape = new CANNON.Box(half);

    const pivotWorld = new THREE.Vector3();
    mesh.getWorldPosition(pivotWorld);

    const body = new CANNON.Body({
        mass,
        material,
        position: new CANNON.Vec3(pivotWorld.x, pivotWorld.y, pivotWorld.z)
    });

    const offset = new CANNON.Vec3(
        centerWorld.x - pivotWorld.x,
        centerWorld.y - pivotWorld.y,
        centerWorld.z - pivotWorld.z
    );

    body.addShape(boxShape, offset);
    body.quaternion.copy(mesh.getWorldQuaternion(new THREE.Quaternion()));

    return body;
}

export function createBodyForGroup(group, mass, material, scale = new THREE.Vector3(1, 1, 1)) {
    const box3 = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box3.getSize(size);
    size.multiply(scale);

    const center = new THREE.Vector3();
    box3.getCenter(center);

    const halfExtents = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
    const boxShape = new CANNON.Box(halfExtents);

    const body = new CANNON.Body({
        mass,
        material,
        position: new CANNON.Vec3(center.x, center.y, center.z),
    });

    body.addShape(boxShape);
    return body;
}

export function createScaledTrimeshBody(mesh, mass, material) {
    const pivot = new THREE.Vector3();
    mesh.getWorldPosition(pivot);
    const body = new CANNON.Body({
        mass,
        material,
        position: new CANNON.Vec3(pivot.x, pivot.y, pivot.z),
    });
    body.quaternion.copy(mesh.getWorldQuaternion(new THREE.Quaternion()));

    const posAttr = mesh.geometry.attributes.position;
    const verts = new Float32Array(posAttr.count * 3);
    const sx = mesh.scale.x, sy = mesh.scale.y, sz = mesh.scale.z;
    for (let i = 0; i < posAttr.count; i++) {
        verts[3 * i] = posAttr.getX(i) * sx;
        verts[3 * i + 1] = posAttr.getY(i) * sy;
        verts[3 * i + 2] = posAttr.getZ(i) * sz;
    }
    const idx = mesh.geometry.index ? mesh.geometry.index.array.slice() : Uint32Array.from({ length: posAttr.count }, (_, k) => k);
    const trimeshShape = new CANNON.Trimesh(verts, idx);
    
    body.addShape(trimeshShape);
    
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);

    const wallHeight = 0.04;
    const wallThickness = 0.1;

    const sideWallShape = new CANNON.Box(new CANNON.Vec3(wallThickness / 6, wallHeight + 0.2, size.z / 6));
    const frontWallShape = new CANNON.Box(new CANNON.Vec3(size.x / 2, wallHeight + 0.65, wallThickness + 0.08));

    const yOffset = wallHeight / 2;
    const leftWallPos = new CANNON.Vec3(-size.x / 2, yOffset - 0.6, 1.25);
    const rightWallPos = new CANNON.Vec3(size.x / 2, yOffset - 0.6, 1.25);
    const frontWallPos = new CANNON.Vec3(0, yOffset, 2.3);

    body.addShape(sideWallShape, leftWallPos);
    body.addShape(sideWallShape, rightWallPos);
    body.addShape(frontWallShape, frontWallPos);

    if (mass === 0) {
        body.type = CANNON.Body.STATIC;
        body.updateMassProperties();
    }
    
    return body;
}

export const parkingSpaces = {
    parking_gmail:   { url: 'mailto:mohamedhakim0381@gmail.com@gmail.com',  box: null },
    parking_linkdin: { url: 'https://www.linkedin.com/in/mohamed-abdalla-80303a223', box: null }
  };
  
export let currentParkingZone = null;

let previousZone = null;

function insideXZ (p, box) {
    return (
      p.x >= box.min.x && p.x <= box.max.x &&
      p.z >= box.min.z && p.z <= box.max.z
    );
  }

  export function updateParkingZone(worldPos, enterSignMesh) {
    if (!enterSignMesh) return;

    let newZone = null;
    for (const name in parkingSpaces) {
        const zone = parkingSpaces[name];
        if (zone.box && insideXZ(worldPos, zone.box)) {
            newZone = name;
            break;
        }
    }
    
    currentParkingZone = newZone;

    if (newZone && newZone !== previousZone) {
        const zone = parkingSpaces[newZone];
        const center = new THREE.Vector3();
        zone.box.getCenter(center);
        
        enterSignMesh.visible = true;

        gsap.killTweensOf(enterSignMesh.position);
        gsap.killTweensOf(enterSignMesh.material);

        enterSignMesh.position.set(center.x, center.y, center.z);
        enterSignMesh.material.opacity = 0;

        gsap.to(enterSignMesh.position, {
            duration: 0.6,
            y: center.y + 2.5,
            ease: "power2.out"
        });
        gsap.to(enterSignMesh.material, {
            duration: 0.6,
            opacity: 0.85,
            ease: "power1.inOut"
        });

    } else if (!newZone && previousZone) {
        gsap.killTweensOf(enterSignMesh.position);
        gsap.killTweensOf(enterSignMesh.material);

        gsap.to(enterSignMesh.position, {
            duration: 0.4,
            y: enterSignMesh.position.y - 2.0,
            ease: "power2.in"
        });
        gsap.to(enterSignMesh.material, {
            duration: 0.4,
            opacity: 0,
            ease: "power1.in",
            onComplete: () => {
                enterSignMesh.visible = false;
            }
        });
    }

    previousZone = newZone;
}
