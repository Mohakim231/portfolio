import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { keyState, touchState } from './controls.js';
import { sounds, handleEngineAudio } from './audio.js';

let car = {
    instance: null, vehicle: null, chassisBody: null,
    wheelMeshes: [], originalFriction: { front: 6, rear: 4 }
};
let initialCarPosition, initialCarQuaternion;
let lastImpactTime = 0;
let lastSkidSoundTime = 0;
export let latestEngineForce = 0;
export let latestSteerValue = 0;

export function createVehicle(scene, world, materials, glb, wallBodies, hittableBodies, objectsToUpdate) {
    const carObject = glb.scene.getObjectByName('car');
    car.instance = carObject;
    
    ['frw', 'flw', 'brw', 'blw'].forEach((name, index) => {
        const wheel = glb.scene.getObjectByName(name);
        if (wheel) {
            scene.attach(wheel);
            wheel.position.set(0, 0, 0);
            car.wheelMeshes[index] = wheel;
        }
    });
    
    initialCarPosition = new THREE.Vector3();
    car.instance.getWorldPosition(initialCarPosition).add(new THREE.Vector3(0, 1, 0));
    initialCarQuaternion = new THREE.Quaternion();
    car.instance.getWorldQuaternion(initialCarQuaternion);
    const rotationQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4);
    initialCarQuaternion.multiply(rotationQuaternion);

    const chassisShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.23, 1.3));
    const chassisBody = new CANNON.Body({
        mass: 250, material: materials.defaultMaterial, linearDamping: 0.15,
        angularDamping: 0.25, sleepSpeedLimit: 0.1, sleepTimeLimit: 0.5
    });
    chassisBody.addShape(chassisShape);
    chassisBody.position.copy(initialCarPosition);
    chassisBody.quaternion.copy(initialCarQuaternion);
    world.addBody(chassisBody);
    car.chassisBody = chassisBody;
    
    chassisBody.addEventListener('collide', (event) => {
        const otherBody = event.body;
        const now = Date.now();
        const IMPACT_THRESHOLD = 1.5;
        const IMPACT_COOLDOWN = 500;

        if (hittableBodies.includes(otherBody) && sounds.impact && now - lastImpactTime > IMPACT_COOLDOWN) {
            const impactSpeed = Math.abs(event.contact.getImpactVelocityAlongNormal());
            if (impactSpeed > IMPACT_THRESHOLD) {
                if (sounds.impact.isPlaying) sounds.impact.stop();
                sounds.impact.play();
                lastImpactTime = now;
            }
        }
        if (wallBodies.includes(otherBody)) {
            resetCarToStart();
        }
    });

    car.vehicle = new CANNON.RaycastVehicle({
        chassisBody: chassisBody,
        indexRightAxis: 0, indexUpAxis: 1, indexForwardAxis: 2
    });

    const wheelOptions = {
        radius: 0.19, directionLocal: new CANNON.Vec3(0, -1, 0), suspensionStiffness: 45,
        suspensionRestLength: 0.2, dampingRelaxation: 4, dampingCompression: 4.5,
        maxSuspensionForce: 250000, rollInfluence: 0.05, axleLocal: new CANNON.Vec3(-1, 0, 0),
        chassisConnectionPointLocal: new CANNON.Vec3(), maxSuspensionTravel: 0.2,
    };
    const cY = -0.3, cX = 0.5, cZ = 0.8;
    const connectionPoints = [[cX, cY, cZ], [-cX, cY, cZ], [cX, cY, -cZ], [-cX, cY, -cZ]];
    connectionPoints.forEach(p => {
        wheelOptions.chassisConnectionPointLocal.set(p[0], p[1], p[2]);
        car.vehicle.addWheel(wheelOptions);
    });

    car.vehicle.wheelInfos.forEach((wheel, i) => {
        wheel.material = materials.wheelMaterial;
        wheel.frictionSlip = (i < 2) ? car.originalFriction.front : car.originalFriction.rear;
    });

    car.vehicle.addToWorld(world);
    objectsToUpdate.push({ mesh: car.instance, body: chassisBody });
}

export function updateCarControls() {
    if (!car.vehicle || !car.chassisBody) return;

    car.chassisBody.wakeUp();

    const maxSteerVal = Math.PI / 16;
    const maxForce = 600;
    let engineForce = 0;
    let steerValue = 0;
    let isShiftDownForAudio = keyState.shift;

    if (touchState.active) {
        const carPosition = new THREE.Vector3().copy(car.chassisBody.position);
        const directionToTarget = touchState.target.clone().sub(carPosition);
        directionToTarget.y = 0;

        const distanceToTarget = directionToTarget.length();
        
        const STOPPING_DISTANCE = 1.5;
        if (distanceToTarget > STOPPING_DISTANCE) {
            const forwardVector = new THREE.Vector3(0, 0, 1);
            forwardVector.applyQuaternion(car.chassisBody.quaternion);
            forwardVector.y = 0;
            
            const dot = forwardVector.dot(directionToTarget.clone().normalize());

            const REVERSING_THRESHOLD = -0.3;

            if (dot > 0) {
                engineForce = -maxForce;
            } else if (dot < REVERSING_THRESHOLD) {
                engineForce = maxForce * 0.5;
            }

            const angleToTarget = forwardVector.angleTo(directionToTarget);

            if (angleToTarget > 0.1) {
                const cross = new THREE.Vector3().crossVectors(forwardVector, directionToTarget);
                const turnDirection = cross.y > 0 ? 1 : -1;
                steerValue = Math.min(angleToTarget, maxSteerVal) * turnDirection;
            }

            if (dot < 0) {
                 steerValue *= -1;
            }
        }
        
        isShiftDownForAudio = false;

    } else {
        if ((keyState.w || keyState.arrowup)) {
            engineForce = keyState.shift ? -maxForce * 1.5 : -maxForce;}
        else if (keyState.s || keyState.arrowdown) engineForce = maxForce;

        if (keyState.a || keyState.arrowleft) steerValue = maxSteerVal;
        else if (keyState.d || keyState.arrowright) steerValue = -maxSteerVal;
    }

    car.vehicle.applyEngineForce(engineForce, 2);
    car.vehicle.applyEngineForce(engineForce, 3);
    car.vehicle.setSteeringValue(steerValue, 0);
    car.vehicle.setSteeringValue(steerValue, 1);

    const speed = car.chassisBody.velocity.length();
    const now = Date.now();
    const SKID_COOLDOWN = 3000;
    const TURN_SKID_MIN_SPEED = 5;

    if (steerValue !== 0 && speed > TURN_SKID_MIN_SPEED && now - lastSkidSoundTime > SKID_COOLDOWN) {
        if (sounds.skid && !sounds.skid.isPlaying) {
            sounds.skid.play();
            lastSkidSoundTime = now;
        }
    }

    const brakeForce = 8, driftFriction = 1.3;
    if (keyState[' ']) {
        car.vehicle.setBrake(brakeForce, 0);
        car.vehicle.setBrake(brakeForce, 1);
        car.vehicle.wheelInfos[2].frictionSlip = car.vehicle.wheelInfos[3].frictionSlip = driftFriction;
        if (sounds.drift && !sounds.drift.isPlaying) sounds.drift.play();
    } else {
        car.vehicle.setBrake(0, 0);
        car.vehicle.setBrake(0, 1);
        car.vehicle.setBrake(0, 2);
        car.vehicle.setBrake(0, 3);
        car.vehicle.wheelInfos[2].frictionSlip = car.originalFriction.rear;
        car.vehicle.wheelInfos[3].frictionSlip = car.originalFriction.rear;
        if (sounds.drift && sounds.drift.isPlaying) sounds.drift.stop();
    }

    car.chassisBody.applyLocalForce(new CANNON.Vec3(0, -1000, 0), new CANNON.Vec3(0, 0, 0));
    
    handleEngineAudio(car.chassisBody, engineForce, isShiftDownForAudio);
}


export function resetCarToStart() {
    if (!car.chassisBody || !initialCarPosition) return;
    car.chassisBody.position.copy(initialCarPosition);
    car.chassisBody.quaternion.copy(initialCarQuaternion);
    car.chassisBody.velocity.set(0, 0, 0);
    car.chassisBody.angularVelocity.set(0, 0, 0);
    if(car.vehicle) car.vehicle.wheelInfos.forEach(w => w.raycastResult.reset());
    car.chassisBody.wakeUp();
}

export function resetCarOrientation() {
    if (!car.chassisBody) return;
    const euler = new CANNON.Vec3();
    car.chassisBody.quaternion.toEuler(euler);
    const uprightQuaternion = new CANNON.Quaternion().setFromEuler(0, euler.y, 0);
    car.chassisBody.position.y += 1.5;
    car.chassisBody.quaternion.copy(uprightQuaternion);
    car.chassisBody.velocity.set(0, 0, 0);
    car.chassisBody.angularVelocity.set(0, 0, 0);
    if(car.vehicle) car.vehicle.wheelInfos.forEach(w => w.raycastResult.reset());
    car.chassisBody.wakeUp();
}

export { car };
