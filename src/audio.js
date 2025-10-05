import * as THREE from 'three';

export const sounds = {
    engine: null, skid: null, impact: null,
    accelStart: null, accelStartTwo: null, accelStartThree: null, drift: null
};

const brickBuffers = [];
let brickAudio;

let wasAccelerating = false;
let wasShiftDown = false;
const STANDSTILL_SPEED = 0.3;

export function initAudio(scene, listener, carInstance) {
    const audioLoader = new THREE.AudioLoader();

    const loadSound = (path, loop, volume, property) => {
        return new Promise((resolve) => {
            audioLoader.load(path, (buffer) => {
                const sound = new THREE.PositionalAudio(listener);
                sound.setBuffer(buffer);
                sound.setLoop(loop);
                sound.setVolume(volume);
                sounds[property] = sound;
                carInstance.add(sound);
                resolve();
            });
        });
    };

    const soundPromises = [
        loadSound('./sounds/mustang_idle.wav', true, 0.3, 'engine'),
        loadSound('./sounds/static_sounds_car-hits_car-hit-1.wav', false, 0.8, 'impact'),
        loadSound('./sounds/static_sounds_screeches_screech-1.wav', false, 0.7, 'skid'),
        loadSound('./sounds/mustang_moving.wav', false, 0.8, 'accelStart'),
        loadSound('./sounds/mustang_moving_2.wav', false, 0.8, 'accelStartTwo'),
        loadSound('./sounds/mustang_moving-3.wav', true, 0.8, 'accelStartThree'),
        loadSound('./sounds/mustang_drift.wav', true, 0.8, 'drift')
    ];

    const brickSoundFiles = Array.from({ length: 8 }, (_, i) => `./sounds/static_sounds_bricks_brick-${i + 1}.wav`);
    brickSoundFiles.forEach(path => {
        soundPromises.push(new Promise(resolve => audioLoader.load(path, buffer => {
            brickBuffers.push(buffer);
            resolve();
        })));
    });

    brickAudio = new THREE.PositionalAudio(listener);
    brickAudio.setRefDistance(8);
    brickAudio.setVolume(0.2);
    scene.add(brickAudio);

    return Promise.all(soundPromises);
}

export function handleEngineAudio(carChassisBody, engineForce, isShiftDown) {
    if (!carChassisBody || !sounds.engine) return;

    const isAccelerating = engineForce !== 0;
    const speed = carChassisBody.velocity.length();
    
    if (isAccelerating && isShiftDown && !wasShiftDown) {
        if (sounds.accelStartTwo && !sounds.accelStartTwo.isPlaying && sounds.skid && !sounds.skid.isPlaying) {
            sounds.accelStartTwo.play();
            sounds.skid.play();
        }
    }
    
    if (isAccelerating && !wasAccelerating && speed < STANDSTILL_SPEED && sounds.skid && !sounds.skid.isPlaying) {
        if (sounds.accelStart && !sounds.accelStart.isPlaying) {
            sounds.accelStart.play();
            sounds.skid.play();
        }
    }

    if (isAccelerating && speed > STANDSTILL_SPEED) {
        const targetMovingVol = isShiftDown ? 0.7 : 0.5;
        if (sounds.accelStartThree) sounds.accelStartThree.setVolume(targetMovingVol);
        if (sounds.engine) sounds.engine.setVolume(0.1);
    } else {
        if (sounds.accelStartThree) sounds.accelStartThree.setVolume(0);
        if (sounds.engine) sounds.engine.setVolume(0.3);
    }

    wasAccelerating = isAccelerating;
    wasShiftDown = isShiftDown;
}

export function handleBrickCollision(event, mesh) {
    const BRICK_IMPACT_MIN_SPEED = 2;
    if (!brickAudio || brickAudio.isPlaying) return;

    let impactSpeed = Math.abs(event.contact.getImpactVelocityAlongNormal());
    if (impactSpeed < BRICK_IMPACT_MIN_SPEED || brickBuffers.length === 0) return;

    const buffer = brickBuffers[Math.floor(Math.random() * brickBuffers.length)];
    brickAudio.setBuffer(buffer);
    mesh.add(brickAudio);
    brickAudio.position.set(0, 0, 0);
    brickAudio.play();
}
