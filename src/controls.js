import { currentParkingZone, parkingSpaces } from './physics.js';
import * as THREE from 'three';

export const keyState = {
    w: false, a: false, s: false, d: false, shift: false,
    arrowup: false, arrowleft: false, arrowdown: false, arrowright: false, ' ': false,
    enter: false
};

export const touchState = {
    active: false,
    target: new THREE.Vector3()
};

export function setupControls(resetCarOrientation, camera, groundMesh) {
    window.addEventListener("keydown", (event) => {
        const key = event.key.toLowerCase();
        if (key in keyState) {
            keyState[key] = true;
        }
        if (key === 'r') {
            resetCarOrientation();
        }
        if (key === 'enter' && currentParkingZone) {
            window.open(parkingSpaces[currentParkingZone].url, '_blank');
        }
    });
    window.addEventListener("keyup", (event) => {
        const key = event.key.toLowerCase();
        if (key in keyState) {
            keyState[key] = false;
        }
    });

    const raycaster = new THREE.Raycaster();
    const touchPoint = new THREE.Vector2();

    const handleTouch = (event) => {
        const touch = event.touches[0] || event.changedTouches[0];
        if (!touch) return;

        touchPoint.x = (touch.clientX / window.innerWidth) * 2 - 1;
        touchPoint.y = -(touch.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(touchPoint, camera);
        const intersects = raycaster.intersectObject(groundMesh);

        if (intersects.length > 0) {
            touchState.target.copy(intersects[0].point);
            touchState.active = true;
        }
    };

    const handleTouchEnd = () => {
        touchState.active = false;
    };

    window.addEventListener('touchstart', handleTouch, { passive: false });
    window.addEventListener('touchmove', handleTouch, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, false);
}
