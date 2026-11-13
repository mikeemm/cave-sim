import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DragControls } from 'three/addons/controls/DragControls.js';
import { TeapotGeometry } from 'three/addons/geometries/TeapotGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { XRButton } from 'three/addons/webxr/XRButton.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';


class DisplaySurface 
{
    constructor(name, origin, u_vector, v_vector) 
    {
        this.name = name;
        this.origin = origin;
        this.u = u_vector;
        this.v = v_vector;
    }

	viewMatrix(eye)
	{
        var zero = new THREE.Vector3(0,0,0);
        var target = new THREE.Vector3().copy(this.v).cross(this.u);
        //var normal = new THREE.Vector3().crossVectors(this.v, this.u);
        //var target = new THREE.Vector3().addVectors(eye, normal);
		var upVector = this.v;	
		var mat = new THREE.Matrix4();
		mat = mat.lookAt(zero, target, upVector); // this lookAt version creates only a rotation matrix
		var translate = new THREE.Matrix4().makeTranslation(-eye.x, -eye.y, -eye.z);
		mat = mat.multiplyMatrices(mat, translate);
		return mat;
	}
	
    projectionMatrix(eye, znear, zfar)
    {
        var uHalf = this.u.clone().multiplyScalar(0.5);
        var vHalf = this.v.clone().multiplyScalar(0.5);
        var uDist = uHalf.length();
        var vDist = vHalf.length();
        var uNorm = this.u.clone().normalize();
        var vNorm = this.v.clone().normalize();
        var center = this.origin.clone().add(uHalf).add(vHalf);

        var normal = new THREE.Vector3().crossVectors(this.u, this.v).normalize();
        var centerToEye = eye.clone().sub(center);
        var eyeDistanceToTarget = centerToEye.clone().dot(normal);
        var eyeToTarget = normal.clone().multiplyScalar(eyeDistanceToTarget);
        var relativeDistanceToSurface = znear / eyeDistanceToTarget;

        var lrd = uNorm.clone().dot(centerToEye)/uDist;
        var lr = uHalf.clone().multiplyScalar(lrd);
        var ll = uHalf.clone().negate();
        ll.sub(lr);
        var rr = uHalf.clone();
        rr.sub(lr);

		var btd = vNorm.clone().dot(centerToEye)/uDist;
        var bt = vHalf.clone().multiplyScalar(btd);
        var bb = vHalf.clone().negate();
        bb.sub(bt);
        var tt = vHalf.clone();
        tt.sub(bt);

        var left =   - ll.length() * relativeDistanceToSurface;
        var right =    rr.length() * relativeDistanceToSurface;
        var bottom = - bb.length() * relativeDistanceToSurface;
        var top =      tt.length() * relativeDistanceToSurface;
        return new THREE.Matrix4().makePerspective(left, right, top, bottom, znear, zfar);
    }
}


var renderer, scene, camera;
var displaySurfaces, displaySurfaceScene, displaySurfaceTargets;
var eyeCenter, eyeScene;
var headDirectionX, headDirectionY, headDirectionZ;
var orbitControl;
var showScene = true, showHead = true;
var clock = new THREE.Clock();
var deg2rad = Math.PI/180;
var currentEye = "";


function addDragControlToObjects()
{
    var objects = [];
    //objects.push(scene.getObjectByName("Teapot"));
    objects.push(scene.getObjectByName("Cactuar"));
    objects.push(eyeScene.getObjectByName("Head"));
    
	//console.log(objects); 
	
    var controls = new DragControls( objects, camera, renderer.domElement );
    controls.addEventListener( 'hoveron', function ( event ) 
		{
            orbitControl.enabled = false;
        } );
    controls.addEventListener( 'hoveroff', function ( event ) 
	{
            orbitControl.enabled = true;
    } );
	controls.addEventListener( 'dragstart', function ( event ) 
		{
            event.object.material.emissive.set( 0xaaaaaa );
        } );
    controls.addEventListener( 'dragend', function ( event ) 
		{
            event.object.material.emissive.set( 0x000000 );
    } );
}

var IPD = 6.8; 

function createEyeScene()
{
    eyeCenter = new THREE.Vector3(50, 20, 50);
    // eye positions relative to the head
    var eyeL = new THREE.Vector3( - IPD/2, 10, -6);
    var eyeR = new THREE.Vector3( + IPD/2, 10, -6);
    
    eyeScene = new THREE.Scene();

    // add sphere representing head
    var geometry = new THREE.SphereGeometry( 10, 32, 22 );
    var material = new THREE.MeshPhongMaterial( { color: 0xaaaaaa } );
    var head = new THREE.Mesh( geometry, material );
    head.name = "Head";
    head.position.set(eyeCenter.x, eyeCenter.y, eyeCenter.z);
    eyeScene.add(head);

    headDirectionX = headDirectionY = headDirectionZ = 0;

    // add spheres representing L/R eyes
    var geometry = new THREE.SphereGeometry( 3, 32, 22 );
    var material = new THREE.MeshPhongMaterial( { color: 0xff0000 } );
    var sphere = new THREE.Mesh( geometry, material );
    sphere.name = "EyeL";
    sphere.position.set(eyeL.x, eyeL.y, eyeL.z);
    head.add(sphere);
	
    var geometry = new THREE.SphereGeometry( 3, 32, 22 );
    var material = new THREE.MeshPhongMaterial( { color: 0x0000ff } );
    var sphere = new THREE.Mesh( geometry, material );
    sphere.name = "EyeR";
    sphere.position.set(eyeR.x, eyeR.y, eyeR.z);
	head.add(sphere);
    
    createLights(eyeScene);
}

function createRenderer()
{
    renderer = new THREE.WebGLRenderer({preserveDrawingBuffer: true, antialias: true});
    renderer.autoClear = false;
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.xr.enabled = true;
    renderer.xr.cameraAutoUpdate = false;
    document.body.appendChild(renderer.domElement);
    document.body.appendChild( XRButton.createButton( renderer ) );
    //document.body.appendChild( VRButton.createButton( renderer ) );
}

function onWindowResize()
{
    const width = window.innerWidth;
    const height = window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function enableOrbitCamera(cam, renderer)
{
    orbitControl = new OrbitControls(cam, renderer.domElement );
    orbitControl.minDistance = 0;
    orbitControl.maxDistance = 50000;
}

function createLights(scn)
{
    var ambientLight = new THREE.AmbientLight(0x888888, 0.7 * Math.PI);
    scn.add(ambientLight);

    // No distance attenuation: the simulator uses scene units at a large scale.
    var pointLight = new THREE.PointLight(0xffffff, 0.8 * Math.PI, 0, 0);
    pointLight.position.z += 200;
    scn.add(pointLight);
}

async function createScene()
{
    scene = new THREE.Scene();
    
    var geometry = new TeapotGeometry( 40, 15);
    var material = new THREE.MeshPhongMaterial( { color: 0xffffff } );
    var teapot = new THREE.Mesh(geometry, material);
    teapot.name = "Teapot";
    teapot.position.z-=70;
    //scene.add( teapot );
    
    const loader = new GLTFLoader();
    var cactuar_obj = await loader.loadAsync("models/cactuar_final_fantasy.glb");
    var cactuar = cactuar_obj.scene;
    cactuar.position.set(0, 0, -225);
    cactuar.scale.set(10, 10, 10);
    cactuar.name = "Cactuar";
    scene.add(cactuar);

    var desert_obj = await loader.loadAsync("models/desert.glb");
    var desert = desert_obj.scene;
    desert.position.set(0, -150, -20);
    scene.add(desert);

    createLights(scene);
}

// create a scene with 3D objects representing the display surfaces
function createDisplaySurfaceScene()
{
    displaySurfaceScene = new THREE.Scene();

    // add display surfaces
    for (var [index, displaySurface] of displaySurfaces.entries())
    {
        var origin = displaySurface.origin;
        var u = displaySurface.u;
        var v = displaySurface.v;
  
        var geometry = new THREE.BoxGeometry(u.length(), v.length(), 0.01);
        var material = new THREE.MeshBasicMaterial( {map: displaySurfaceTargets[index].texture} );
        var cube = new THREE.Mesh( geometry, material );
        cube.name = displaySurface.name;
        if (displaySurface.name == "Left")
            cube.rotation.y = Math.PI / 2;
       
		if (displaySurface.name == "Right")
            cube.rotation.y = - Math.PI / 2;
			
		if (displaySurface.name == "Floor")
		{
            cube.rotation.x =  Math.PI / 2;
			cube.rotation.z =  Math.PI ;
		}
       
	    var uHalf = u.clone().multiplyScalar(0.5);
		var vHalf = v.clone().multiplyScalar(0.5);
		var center = new THREE.Vector3().addVectors(origin, uHalf);
		center.add(vHalf);
		cube.position.set(center.x, center.y, center.z);
		
        displaySurfaceScene.add(cube);
    }
    
    createLights(displaySurfaceScene);
}

function createDisplaySurfaceTargets()
{
    const SIZE = 1024;  // texture resolution
    displaySurfaceTargets = [];
    
    for (var v of displaySurfaces)       
        displaySurfaceTargets.push(new THREE.WebGLRenderTarget(SIZE, SIZE));
}


function createCamera()
{
    camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 10000 );
    camera.position.set( 100, 100, 300 );
    camera.lookAt( 0, 0, 0 );
}

function createDisplaySurfaces()
{
    displaySurfaces = [];
    // FRONT SCREEN
    var frontScreen = new DisplaySurface("Front", 
        new THREE.Vector3(-150.0, -150.0, -150.0), 
        new THREE.Vector3(300.0, 0.0,   0.0), 
        new THREE.Vector3(0.0, 300.0,   0.0));
    displaySurfaces.push(frontScreen);

    // LEFT SCREEN
    var leftScreen = new DisplaySurface("Left",
        new THREE.Vector3(-150.0, -150.0, 150.0), 
        new THREE.Vector3(0.0, 0.0,  -300.0), 
        new THREE.Vector3(0.0, 300.0,   0.0));
    displaySurfaces.push(leftScreen);
	
	// RIGHT SCREEN
    var rightScreen = new DisplaySurface("Right",
        new THREE.Vector3(150.0, -150.0, -150.0), 
        new THREE.Vector3(0.0, 0.0,  300.0), 
        new THREE.Vector3(0.0, 300.0,   0.0));
    displaySurfaces.push(rightScreen);

    // FLOOR SCREEN
    var floorScreen = new DisplaySurface("Floor", 
        new THREE.Vector3(-150.0, -150.0, 150.0), 
        new THREE.Vector3(300.0, 0.0,   0.0), 
        new THREE.Vector3(0.0, 0.0,   -300.0));
    displaySurfaces.push(floorScreen);
}

function getLeftEyePosition()
{
    var eye = eyeScene.getObjectByName("EyeL");
    return eye.getWorldPosition(new THREE.Vector3());
}

function getRightEyePosition()
{
    var eye = eyeScene.getObjectByName("EyeR");
    return eye.getWorldPosition(new THREE.Vector3());
}

function cameraFromViewProj(view, proj)
{
	var cam = camera.clone();
    var inv = new THREE.Matrix4();
	inv.copy(view).invert();
	cam.position.set(inv.elements[12], inv.elements[13], inv.elements[14]);
	cam.setRotationFromMatrix(view);
	cam.projectionMatrix = proj.clone();
	return cam;
}


// refresh function
var animate = function () {
    var gl = renderer.getContext();
    requestAnimationFrame(animate);

    // 0. update
    var up = new THREE.Vector3(0, 1, 0);
    renderer.xr.updateCamera(camera);

    
    // update head
    if (isUpHeld) headDirectionX += clock.getDelta() * 2.5;
    if (isDownHeld) headDirectionX -= clock.getDelta() * 2.5;
    if (isLeftHeld) headDirectionY += clock.getDelta() * 2.5;
    if (isRightHeld) headDirectionY -= clock.getDelta() * 2.5;


    var head = eyeScene.getObjectByName("Head");
    head.rotation.set(0, 0, 0);
    head.rotateZ(headDirectionZ);
    head.rotateX(headDirectionX);
    head.rotateOnWorldAxis(up, headDirectionY);

    headDirectionX = Math.min(Math.max(-90 * deg2rad, headDirectionX), 90 * deg2rad);
    modifyEyes();
    if (cameraOnEye) {
        var eye = (currentEye == "L" ? getLeftEyePosition() : getRightEyePosition());
        camera.position.set(eye.x, eye.y, eye.z); 
        var head = eyeScene.getObjectByName("Head");
        camera.rotation.set(head.rotation.x, head.rotation.y, head.rotation.z);
    }

    // animate cactuar
    var totalTime = clock.getElapsedTime();
    var cactuar = scene.getObjectByName("Cactuar");
    var cacPos = new THREE.Vector3(0, 0, -75);
    cacPos.applyAxisAngle(up, -totalTime / 2);
    cacPos.add(new THREE.Vector3(0, 0, -150));
    cactuar.position.set(cacPos.x * 4, cacPos.y + Math.sin(totalTime * 10) * 10, cacPos.z);
    cactuar.rotation.set(0, Math.PI, 0);
    cactuar.rotateZ(Math.sin(totalTime * 10) * 22.5 * deg2rad);
    cactuar.rotateOnWorldAxis(up, -totalTime/2 - Math.sin(totalTime / 2) * deg2rad * 50);
    var scaleRate = Math.sin(totalTime * 10 + Math.PI/2);
    cactuar.scale.set(10 + scaleRate, 10 + scaleRate, 10 + scaleRate);

    // 1. render scene objects
	renderer.setClearColor(0x808080);
    renderer.clear();
    if (showScene)
        renderer.render(scene, camera);
    
    
    renderer.xr.enabled = false;
    // 2. render scene objects onto a texture, for each target
    for (let [index, displaySurface] of displaySurfaces.entries())
    {
        renderer.setRenderTarget(displaySurfaceTargets[index]);
        renderer.setClearColor(0x404040);
        renderer.clear();

		// left eye on RED channel
        gl.colorMask(1, 0, 0, 0); 
		var eye = getLeftEyePosition();
		var view = displaySurface.viewMatrix(eye);
		var proj = displaySurface.projectionMatrix(eye, 1, 10000);
        var leftCamera = cameraFromViewProj(view, proj);
        renderer.render(scene, leftCamera); 
    
		// right eye on GREEN, BLUE channels
		gl.colorMask(0, 1, 1, 0);
		var eye = getRightEyePosition();
		var view = displaySurface.viewMatrix(eye);
		var proj = displaySurface.projectionMatrix(eye, 1, 10000);
        var rightCamera = cameraFromViewProj(view, proj);
        renderer.clearDepth();
        renderer.render(scene, rightCamera); 
		
        gl.colorMask(1, 1, 1, 1);
    }
    // restore state
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000);

    renderer.xr.enabled = true;
  
    // 3. render display surfaces as (textured) quads
    renderer.render(displaySurfaceScene, camera);
	
	// 4. render eyes
    if (showHead)
        renderer.render(eyeScene, camera);
};

function modifyEyes() {
    var eyeL = eyeScene.getObjectByName("EyeL");
    var eyeR = eyeScene.getObjectByName("EyeR");

    // (0,10,0) + (cos(0), 0, sin(0))*(0.5, 0, -6/6.8)*6.8 = (3.4, 10, -6). This is the initial eyeR position relative to the head
    var newEyePos = new THREE.Vector3(0, 10, -6).add(new THREE.Vector3(Math.cos(eye_angle), 0, Math.sin(eye_angle)).multiply(new THREE.Vector3(1, 0, 1)).multiplyScalar(IPD/2));

    //console.log(newEyePos.x + " " + newEyePos.y + " " + newEyePos.z)

    eyeL.position.set( - newEyePos.x, newEyePos.y, newEyePos.z);
    eyeR.position.set( + newEyePos.x, newEyePos.y, newEyePos.z);

    //eyeL.position.set( - IPD/2, 10, -6);
    //eyeR.position.set( IPD/2, 10, -6);
    
}

var cameraGroup = new THREE.Group();
cameraGroup.position.set(50, 30, 44);

var vrActive = false;

function addXREventListeners() {
    renderer.xr.addEventListener('sessionstart', function () {
        //vrActive = true;
        //cameraOnEye = true;
        //showHead = false;
        //scene.add(cameraGroup);
        //renderer.setAnimationLoop(null);
        //renderer.xr.setAnimationLoop(animate);
        //cameraGroup.add(camera);
        
        //console.log("cameraGroup position: " + cameraGroup.position.x + " " + cameraGroup.position.y + " " + cameraGroup.position.z);

    });

    renderer.xr.addEventListener('sessionend', function () {
        //vrActive = false;
        //cameraOnEye = false;
        //showHead = true;
        //scene.remove(cameraGroup);
        //renderer.setAnimationLoop(animate);
        //renderer.xr.setAnimationLoop(null);
        //cameraGroup.remove(camera);
    });

    var hand1, hand2;

    hand1 = renderer.xr.getHand(0);
    hand2 = renderer.xr.getHand(1);

    hand1.addEventListener('squeezestart', function () {
        showScene = !showScene;
    });

    hand2.addEventListener('squeezestart', function () {
        showScene = !showScene;
    });
}

var IPD_increment = 0.5;
var eye_angle = 0;
var eye_angle_increment = Math.PI/16;

var cameraOnEye = false;
var isUpHeld = false;
var isDownHeld = false;
var isLeftHeld = false;
var isRightHeld = false;

(async () => {
    createRenderer();  			// create WebGL renderer
    createDisplaySurfaces();	// Display surfaces
    createDisplaySurfaceTargets(); // Textures for the display surfaces
    createDisplaySurfaceScene();	// 3D objects for the display surfaces
    createEyeScene();	// spheres representing head + eyes
    await createScene();		// some objects to test (teapot...)
    createCamera();		// a third-person camera
    addXREventListeners();
    window.addEventListener('resize', onWindowResize);
    window.addEventListener( 'keydown', function ( event ) 
    {
        //if (vrActive) return;  // ignore keyboard events when in VR mode
        switch ( event.code ) {
            case 'KeyL': 
                var eye = getLeftEyePosition();
                camera.position.set(eye.x, eye.y, eye.z);
                var head = eyeScene.getObjectByName("Head");
                camera.rotation.set(head.rotation.x, head.rotation.y, head.rotation.z);
                currentEye = "L";
                break;
                
            case 'KeyR': 
                var eye = getRightEyePosition();
                camera.position.set(eye.x, eye.y, eye.z); 
                var head = eyeScene.getObjectByName("Head");
                camera.rotation.set(head.rotation.x, head.rotation.y, head.rotation.z);
                currentEye = "R";
                break;
                
            case 'KeyS':
                showScene = !showScene;
                break;
                
            case 'KeyT':
                var viewF = displaySurfaces[0].viewMatrix(new THREE.Vector3(50,20,100));
                var viewL = displaySurfaces[1].viewMatrix(new THREE.Vector3(50,20,100));
                //var viewR = displaySurfaces[2].viewMatrix(new THREE.Vector3(50,20,100));
                //var viewB = displaySurfaces[3].viewMatrix(new THREE.Vector3(50,20,100));
                console.log("View matrices:");
                console.log(viewF);
                console.log(viewL);
                //console.log(viewR);
                //console.log(viewB);
                break;

            case 'KeyH':
                showHead = !showHead;
                break;
                
            case 'ArrowUp':
                isUpHeld = true;
                break;

            case 'ArrowDown':
                isDownHeld = true;
                break;

            case 'ArrowLeft':
                isLeftHeld = true;
                break;

            case 'ArrowRight':
                isRightHeld = true;
                break;
            case 'KeyE':
                IPD += IPD_increment;
                //cameraOnEye = true;
                break;
            
            case 'KeyQ': 
                IPD -= IPD_increment;
                //cameraOnEye = true;
                break;
                
            case 'KeyZ': 
                eye_angle -= eye_angle_increment;
                //cameraOnEye = true;
                break;
            
            case 'KeyC': 
                eye_angle += eye_angle_increment;
                //cameraOnEye = true;
                break;
            
            case 'KeyM':
                cameraOnEye = !cameraOnEye;
                break;
        }
    });

    window.addEventListener( 'keyup', function( event )
    {
        if (vrActive) return;  // ignore keyboard events when in VR mode
        switch ( event.code ) {
            case 'ArrowUp':
                isUpHeld = false;
                break;

            case 'ArrowDown':
                isDownHeld = false;
                break;

            case 'ArrowLeft':
                isLeftHeld = false;
                break;

            case 'ArrowRight':
                isRightHeld = false;
                break;
        }
    });
    enableOrbitCamera(camera, renderer);  // basic camera control
    addDragControlToObjects();	// allow some objects to be dragged
    renderer.setAnimationLoop(animate);
    animate();
})();