import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createAlignedBody, createBodyForGroup, createScaledTrimeshBody } from './physics.js';
import { handleBrickCollision } from './audio.js';
import { parkingSpaces } from './physics.js';

export let groundMesh = null;

export function setupWorld(scene, world, materials, objectsToUpdate, wallBodies, hittableBodies, loadingManager) {
    const loader = new GLTFLoader(loadingManager);

    return new Promise((resolve, reject) => {
        loader.load('./PortfolioWebsite.glb', (glb) => {
            scene.add(glb.scene);

            glb.scene.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }

                let body;
                if (child.name === "map") {
                    groundMesh = child;
                    body = createAlignedBody(child, 0, materials.defaultMaterial);
                    hittableBodies.push(body);
                    buildMapBoundary(child, world, wallBodies, materials.defaultMaterial);
                } else if (child.name.startsWith("rock")) {
                    body = createAlignedBody(child, 0, materials.defaultMaterial, new THREE.Vector3(0.7, 1, 0.7));
                    hittableBodies.push(body);
                } else if (child.name.startsWith("post")) {
                    const scale = new THREE.Vector3(0.3, 1, 0.3);
                    body = createAlignedBody(child, 0, materials.defaultMaterial, scale);
                    hittableBodies.push(body);
                } else if (child.name.startsWith("board")) {
                    const scale = new THREE.Vector3(0.2, 1, 1);
                    body = createBodyForGroup(child, 0, materials.defaultMaterial, scale);
                    hittableBodies.push(body);
                } else if (child.name.startsWith("tree") || child.name.startsWith("sign")) {
                    const scaleFactor = child.name.startsWith("tree") ? 0.7 : 0.1;
                    const physicsScale = new THREE.Vector3(scaleFactor, 1, scaleFactor);
                    if (child.isGroup) {
                        body = createBodyForGroup(child, 0, materials.defaultMaterial, physicsScale);
                    } else if (child.isMesh) {
                        body = createAlignedBody(child, 0, materials.defaultMaterial, physicsScale);
                    }
                    if (body) hittableBodies.push(body);
                } else if (child.name.startsWith("brick") || child.name.startsWith("letter")) {
                    body = createAlignedBody(child, 1, materials.brickMaterial);
                    body.sleepSpeedLimit = 0.1;
                    body.sleepTimeLimit = 0.5;
                    body.angularDamping = 0.25;
                    body.linearDamping = 0.01;
                    objectsToUpdate.push({ mesh: child, body });
                    body.addEventListener('collide', event => handleBrickCollision(event, child));
                } else if (child.name.startsWith('ramp')) {
                    body = createScaledTrimeshBody(child, 0, materials.defaultMaterial);
                } else if (child.name === 'parking_gmail' || child.name === 'parking_linkdin') {
                    const box = new THREE.Box3().setFromObject(child);
                    parkingSpaces[ child.name ].box = box;
                } else if (child.name.startsWith("contact")) {
                    body = createBodyForGroup(child, 0, materials.defaultMaterial, new THREE.Vector3(0.7, 1, 0.7));
                    hittableBodies.push(body);
                }
                
                if (body) world.addBody(body);
            });
            
            resolve(glb);
        }, undefined, reject);
    });
}

function buildMapBoundary(mapMesh, world, wallBodies, material) {
    const bb = new THREE.Box3().setFromObject(mapMesh);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bb.getSize(size);
    bb.getCenter(center);

    const wallH = 3, wallT = 0.5, wallOff = -60;
    const hx = size.x * 0.5 + wallOff;
    const hz = size.z * 0.5 + wallOff;
    const wallShape = new CANNON.Box(new CANNON.Vec3(wallT * 0.5, wallH * 0.5, hz));
    const yBottom = bb.min.y + wallH * 0.5;

    const addWall = (px, py, pz, rotY = 0) => {
        const body = new CANNON.Body({ mass: 0, material, position: new CANNON.Vec3(px, py, pz) });
        body.addShape(wallShape, new CANNON.Vec3(0,0,0), new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotY));
        world.addBody(body);
        wallBodies.push(body);
    };

    addWall(center.x + hx, yBottom, center.z, 0);
    addWall(center.x - hx, yBottom, center.z, 0);
    addWall(center.x, yBottom, center.z + hz, Math.PI / 2);
    addWall(center.x, yBottom, center.z - hz, Math.PI / 2);
}
