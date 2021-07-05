let dragStartX;
let dragStartY;
let dragStarted = false;
let currentAngleX =  3*Math.PI/4;//2;
let currentAngleY =  Math.PI/7;//3;
let oldAngle = -100000; // てきとう
let scale = 1;

const width = window.innerWidth;
const height = window.innerHeight;

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector('#myCanvas')
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(width, height);
    
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);
camera.position.set(0, 0, 2000);

const canvas = document.getElementById("myCanvas");
canvas.addEventListener('mousedown', onMouseDown, false);
canvas.addEventListener('mousemove', onMouseMove, false);
canvas.addEventListener('mouseup'  , onMouseUp  , false);
canvas.addEventListener('mouseover', onMouseOver, false);
canvas.addEventListener('wheel'    , wheel      , false);

window.addEventListener('load', init);

//const light = new THREE.HemisphereLight(0xdddddd, 0x555555, 1.0);
const light = new THREE.PointLight(0xffffff, 1, 0);
scene.add(light);

//-------------------- analog clock -------------------------------------------------

class Gear{
    // x, y, z,
    // rotationX,rotationY,rotationZ,
    // N of tooth of gear,
    // holeRadius
    // deadtimeduty
    constructor(x,y,z,rx,ry,rz,tooths,holeRadius,dduty,period){
        this.x = x;
        this.y = y;
        this.z = z;
        this.rx = rx;
        this.ry = ry;
        this.rz = rz;
        this.tooths = tooths;
        this.r1 = holeRadius;
        this.r2 = 5 * tooths;
        this.r3 = this.r2 + 25;
        this.duty = 0.3;
        this.dduty = dduty;
        this.thick = 20;
        this.period = period;
        this.makeGearMesh();
    }
    makeGearMesh() {
        let extrude = { amount: this.thick, bevelEnabled: true, bevelSegments: 2, steps: 2 };
      
        let arcShape = new THREE.Shape();
        let t = 2*Math.PI / this.tooths;
        let ofs = (this.duty - this.dduty) * 0.5;
        let dx1 = 0;
        let dy1 = 0;
        arcShape.moveTo( 0, 0 );
        for(let i = 0; i < this.tooths; i++) {
            let dx2 = -this.r3 * Math.cos((i + this.duty - this.dduty-  ofs) * t);
            let dy2 = -this.r3 * Math.sin((i + this.duty - this.dduty - ofs) * t);
            arcShape.arc( dx1, dy1, this.r3, (i - ofs)*t, (i + this.duty - this.dduty-ofs) * t, false );
            arcShape.arc( dx2, dy2, this.r2, (i + this.duty - ofs) * t, (i + 1 - this.dduty-ofs) * t, false );
            dx1 = - this.r2 * Math.cos((i + 1 - this.dduty-ofs) * t);
            dy1 = - this.r2 * Math.sin((i + 1 - this.dduty-ofs) * t);
        }
        if ( this.r1 > 0 ) {
            let holePath = new THREE.Path();
            holePath.moveTo( 0, 0 );
            holePath.arc( 0, 0, this.r1, 0, 2*Math.PI, true );
            arcShape.holes.push( holePath );
        }
    
        let geometry = new THREE.ExtrudeGeometry( arcShape, extrude );
        let mat = new THREE.Matrix4().makeTranslation( 0,0,-this.thick/2 ); // 厚みを持たせた分の半分だけ移動させて原点へ中心をもってくる
        geometry.applyMatrix(mat);
        let material = new THREE.MeshPhongMaterial( { color: 0xd4af37, side: THREE.DoubleSide, shininess: 80, metal: true } );
        this.mesh = new THREE.Mesh( geometry, material );
        this.mesh.position.x = this.x;
        this.mesh.position.y = this.y;
        this.mesh.position.z = this.z;
        this.mesh.rotation.x = this.rx;
        this.mesh.rotation.y = this.ry;
        this.mesh.rotation.z = this.rz;
        scene.add(this.mesh);
    }
    draw(frameRate){
        this.mesh.rotation.z -= 2*Math.PI / this.period * frameRate;
    }
}

class Hand{
    constructor(x,y,z,rx,ry,rz,length,period){
        this.x = x;
        this.y = y;
        this.z = z;
        this.rx = rx;
        this.ry = ry;
        this.rz = rz;
        this.length = length;
        this.period = period;
        this.makeHandMesh();
    }
    makeHandMesh(){
        let geometry = new THREE.CylinderGeometry( 3, 3, this.length, 32 );
        let mat = new THREE.Matrix4().makeTranslation( 0,this.length/2,0 );
        geometry.applyMatrix(mat);
        let material = new THREE.MeshPhongMaterial( {color: 0xbdc3c9, metal: true} );
        this.mesh = new THREE.Mesh( geometry, material );
        this.mesh.position.x = this.x;
        this.mesh.position.y = this.y;
        this.mesh.position.z = this.z;
        this.mesh.rotation.x = this.rx;
        this.mesh.rotation.y = this.ry;
        this.mesh.rotation.z = this.rz;
        scene.add(this.mesh);
    }
    draw(frameRate){
        this.mesh.rotation.z -= 2*Math.PI / this.period * frameRate;
    }
}

const analogClock = [
    new Gear(   0, 0,   0,    0, 0, 0,          30, 30, 0.20, +   60 ),
    new Gear(   0, 0,  40,    0, 0, 0,           6, 30, 0.22, +   60 ),
    new Gear( 190, 0,  40,    0, 0, Math.PI/24, 24,  0, 0.20, -  240 ),
    new Gear( 520, 0,  40,    0, 0, 0,          36,  0, 0.20, +  360 ),
    new Gear( 520, 0,  80,    0, 0, 0,           6,  0, 0.22, +  360 ),
    new Gear( 400, 0,  80,    0, 0, Math.PI/12, 12,  0, 0.20, -  720 ),
    new Gear(   0, 0,  80,    0, 0, 0,          60, 30, 0.20, + 3600 ),
    new Gear(   0, 0, 120,    0, 0, 0,          10, 30, 0.20, + 3600 ),
    new Gear( 240, 0, 120,    0, 0, Math.PI/30, 30,  0, 0.20, -10800 ),
    new Gear( 240, 0, 160,    0, 0, Math.PI/8,   8,  0, 0.20, -10800 ),
    new Gear(   0, 0, 160,    0, 0, 0,          32, 30, 0.20, +43200 ),

    new Hand(   0, 0, 200,    0, 0, 0, 600,                       60 ),
    new Hand(   0, 0, 200,    0, 0, 0, 400,                     3600 ),
    new Hand(   0, 0, 200,    0, 0, 0, 200,                    43200 ),
];

//------------------------------- digital clock -------------------------------------------

const digitalClock = new THREE.Mesh(
    new THREE.TextGeometry(
        "",
        {
            font: 'helvetiker',
            size: 80,
            height: 5,
            curveSegments: 12,
            bevelEnabled: true,
            bevelThickness: 10,
            bevelSize: 8,
            bevelOffset: 0,
            bevelSegments: 5
        }
    ),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
);
digitalClock.position.x = -400;
digitalClock.position.y = 400;
digitalClock.position.z = 0;
scene.add(digitalClock);

//----------------------------------------------------------------------------------------

function init() {
    updateCameraPos();
    redraw();
    setInterval(timerFunc, 60);
}

function redraw() {
    renderer.render(scene, camera);
}


function timerFunc() {
    for(let i = 0; i < analogClock.length; i++){
        analogClock[i].draw(0.06);
    }
    let date = Date.now();
    digitalClock.geometry.text = date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds() + ':' + date.getMilliseconds();
    redraw();
}

function updateCameraPos() {
    let x = camera.position.x;
    let y = camera.position.y;
    let z = camera.position.z;
    let d = Math.sqrt(x*x + y*y + z*z);
    x = d * Math.cos(currentAngleY) * (Math.cos(currentAngleX));
    y = d * Math.sin(currentAngleY);
    z = d * Math.cos(currentAngleY) * (Math.sin(currentAngleX));
    camera.position.set(x, y, z);
    light.position.set(x, y, z);
    camera.lookAt(new THREE.Vector3(0, 100, 0));
}

function onMouseDown(e) {
    let rect = e.target.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    dragStartX = x;
    dragStartY = y;
    dragStarted = true;
}

function onMouseMove(e) {
    let rect = e.target.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    if (dragStarted) {
        let dx = x - dragStartX;
        let dy = y - dragStartY;
        currentAngleX += dx/50;
        currentAngleY += dy/50;
        if (currentAngleY > 0.45*Math.PI ) {
            currentAngleY = 0.45*Math.PI;
        }
        else if (currentAngleY < -0.45*Math.PI ){
            currentAngleY = -0.45*Math.PI;
        }
        dragStartX = x;
        dragStartY = y;

        updateCameraPos();
    }
}
function onMouseUp(e) {
    dragStarted = false;
}
function onMouseOver(e) {
    dragStarted = false;
}

function wheel(e) {
    let x = camera.position.x;
    let y = camera.position.y;
    let z = camera.position.z;
    let d = Math.sqrt(x*x + y*y + z*z);

    camera.position.x += e.deltaY * x / d;
    camera.position.y += e.deltaY * y / d;
    camera.position.z += e.deltaY * z / d;
    /*e.preventDefault();

    scale -= e.deltaY * 0.001;

    // Restrict scale
    scale = Math.min(Math.max(.125, scale), 4);

    // Apply scale transform
    canvas.style.transform = `scale(${scale})`;*/
}