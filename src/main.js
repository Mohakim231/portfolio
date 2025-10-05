import '../style.css'; 
import * as THREE from 'three';
import CannonDebugger from 'cannon-es-debugger'; 
import gsap from 'gsap';

import { setupSceneAndWorld } from './sceneSetup.js';
import { setupControls } from './controls.js';
import { setupWorld, groundMesh } from './world.js';
import { createVehicle, updateCarControls, car, resetCarOrientation } from './car.js';
import { initAudio, sounds } from './audio.js';
import { updateParkingZone } from './physics.js';

class App {
    constructor() {
        this.objectsToUpdate = [];
        this.wallBodies = [];
        this.hittableBodies = [];
        this.clock = new THREE.Clock();
        this.lastCarPos = new THREE.Vector3();
        this.enterSignMesh = null;
        this.init();
    }

    async createEnterSign(loadingManager) {
        const textureLoader = new THREE.TextureLoader(loadingManager);
        try {
            const texture = await textureLoader.loadAsync('./textures/keyboard-enter.webp');
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
            });
            const geometry = new THREE.PlaneGeometry(1, 1);
            const signMesh = new THREE.Mesh(geometry, material);

            return signMesh;
        } catch (error) {
            console.error("Could not load the enter-key'", error);
            return null;
        }
    }

    async init() {
        const progressBar = document.getElementById('progress-bar-inner');
        const progressText = document.getElementById('progress-text');
        const launchButton = document.getElementById('launch-button');

        const loadingManager = new THREE.LoadingManager();

        loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const progress = (itemsLoaded / itemsTotal);
            progressBar.style.width = `${progress * 100}%`;
            progressText.innerText = `Loading asset ${itemsLoaded} of ${itemsTotal}...`;
        };

        loadingManager.onLoad = () => {
            gsap.to([progressBar.parentElement, progressText], {
                duration: 0.5,
                opacity: 0,
                onComplete: () => {
                    progressBar.parentElement.style.display = 'none';
                    progressText.style.display = 'none';

                    launchButton.disabled = false;
                    launchButton.textContent = 'Start Engine';
                    launchButton.style.display = 'block';

                    gsap.fromTo(launchButton, { opacity: 0 }, { opacity: 1, duration: 0.5 });
                }
            });
        };

        loadingManager.onError = (url) => {
            console.error(`There was an error loading ${url}`);
            progressText.innerText = `Error loading. Check console.`;
        };
        const core = setupSceneAndWorld();
        this.scene = core.scene;
        this.world = core.world;
        this.renderer = core.renderer;
        this.camera = core.camera;
        this.controls = core.controls;
        this.materials = core.materials;

        this.cannonDebugger = new CannonDebugger(this.scene, this.world);
        
        try {
            this.enterSignMesh = await this.createEnterSign(loadingManager);
            if (this.enterSignMesh) {
                this.enterSignMesh.visible = false;
                this.scene.add(this.enterSignMesh);
            }

            const glb = await setupWorld(this.scene, this.world, this.materials, this.objectsToUpdate, this.wallBodies, this.hittableBodies);
            
            setupControls(resetCarOrientation, this.camera, groundMesh);

            createVehicle(this.scene, this.world, this.materials, glb, this.wallBodies, this.hittableBodies, this.objectsToUpdate);
            
            await initAudio(this.scene, this.camera.children[0], car.instance);

            car.instance.getWorldPosition(this.lastCarPos);
            this.controls.target.copy(this.lastCarPos);
            this.camera.position.set(-9, 8, -0.1);
            
            this.setupLaunchUI();

        } catch (error) {
            console.error("Failed to initialize the app:", error);
        }
    }

    setupLaunchUI() {
        const launchButton = document.getElementById('launch-button');
        const listener = this.camera.children[0];

        launchButton.disabled = false;
        launchButton.textContent = 'Start Engine';

        launchButton.addEventListener('click', () => {
            document.getElementById('launch-screen').style.display = 'none';
            if (listener.context.state === 'suspended') {
                listener.context.resume();
            }
            sounds.engine.play();
            sounds.accelStartThree.play();
            sounds.accelStartThree.setVolume(0);
            
            this.renderer.setAnimationLoop(() => this.animate());
        }, { once: true });
    }

    animate() {
        const deltaTime = Math.min(this.clock.getDelta(), 1 / 30);
        this.world.step(1 / 60, deltaTime, 10);
        
        updateCarControls();

        for (const object of this.objectsToUpdate) {
            object.mesh.position.copy(object.body.position);
            object.mesh.quaternion.copy(object.body.quaternion);
        }

        if (car.vehicle) {
            for (let i = 0; i < car.vehicle.wheelInfos.length; i++) {
                car.vehicle.updateWheelTransform(i);
                const transform = car.vehicle.wheelInfos[i].worldTransform;
                if (car.wheelMeshes[i]) {
                    car.wheelMeshes[i].position.copy(transform.position);
                    car.wheelMeshes[i].quaternion.copy(transform.quaternion);
                }
            }
        }

        if (car.instance) {
            const carWorldPos = new THREE.Vector3();
            car.instance.getWorldPosition(carWorldPos);
            updateParkingZone( carWorldPos, this.enterSignMesh);
            const delta = carWorldPos.clone().sub(this.lastCarPos);
            this.controls.target.add(delta);
            this.camera.position.add(delta);
            this.lastCarPos.copy(carWorldPos);
        }

        if (this.enterSignMesh && this.enterSignMesh.visible) {
            this.enterSignMesh.quaternion.copy(this.camera.quaternion);
        }

        this.controls.update();
        // this.cannonDebugger.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new App();
