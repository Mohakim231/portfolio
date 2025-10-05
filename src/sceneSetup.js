import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function setupSceneAndWorld() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3F8363);

    const world = new CANNON.World({
        gravity: new CANNON.Vec3(0, -9.82, 0),
        allowSleep: true,
        sleepSpeedLimit: 0.1,
        solver: new CANNON.GSSolver()
    });
    world.broadphase = new CANNON.SAPBroadphase(world);
    
    const isMobile = window.innerWidth <= 800 && 'ontouchstart' in window;
    const pixelRatioCap = isMobile ? 1.5 : 2;
    const shadowMapSize = isMobile ? 1024 : 4096;
    const solverIterations = isMobile ? 10 : 15;
    const shadowMapType = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;

    world.solver.iterations = solverIterations;
    world.solver.tolerance = 0.01;

    const defaultMaterial = new CANNON.Material('default');
    const wheelMaterial = new CANNON.Material('wheel');
    const brickMaterial = new CANNON.Material('brick');
    const materials = { defaultMaterial, wheelMaterial, brickMaterial };
    
    world.addContactMaterial(new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, { friction: 0.4, restitution: 0.3 }));
    world.addContactMaterial(new CANNON.ContactMaterial(wheelMaterial, defaultMaterial, { friction: 0.4, restitution: 0, contactEquationStiffness: 1000 }));
    world.addContactMaterial(new CANNON.ContactMaterial(brickMaterial, brickMaterial, { friction: 0.1, restitution: 0.5 }));
    world.addContactMaterial(new CANNON.ContactMaterial(brickMaterial, defaultMaterial, { friction: 0.1, restitution: 0.4 }));

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, pixelRatioCap));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = shadowMapType;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    document.body.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 80);
    const listener = new THREE.AudioListener();
    camera.add(listener);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.target.set(0, 0.5, 0);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    const sun = new THREE.DirectionalLight(0xffffff, 0.6);
    sun.castShadow = true;
    sun.position.set(-50, 50, 10);

    sun.shadow.mapSize.width = shadowMapSize;
    sun.shadow.mapSize.height = shadowMapSize;

    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 120;
    const shadowFrustumSize = 60;
    sun.shadow.camera.left = -shadowFrustumSize;
    sun.shadow.camera.right = shadowFrustumSize;
    sun.shadow.camera.top = shadowFrustumSize;
    sun.shadow.camera.bottom = -shadowFrustumSize;
    
    sun.shadow.normalBias = 0.05;
    scene.add(sun);


    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, world, renderer, camera, controls, listener, materials };
}