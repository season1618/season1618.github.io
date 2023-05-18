const initVertSrc = `
attribute vec3 aPosition;

varying vec3 vPosition;

void main(){
    vPosition = aPosition;

    gl_Position = vec4(aPosition, 1.0);
    gl_PointSize = 2.0;
}
`;

const initFragSrc = `
precision mediump float;

varying vec3 vPosition;

void main(){
    gl_FragColor = vec4(vPosition, 1.0);
}
`;

const updateVertSrc = `
attribute vec3 aPosition;
attribute vec3 aAxis;
attribute float aSpeed;

uniform sampler2D uTexture;

varying vec3 vPosition;

void main(){
    vec3 pos = texture2D(uTexture, (aPosition.xy + 1.0) / 2.0).xyz;
    vPosition = normalize(pos + aSpeed * cross(aAxis, pos));
    
    gl_Position = vec4(aPosition, 1.0);
    gl_PointSize = 2.0;
}
`;

const updateFragSrc = `
precision mediump float;

varying vec3 vPosition;

void main(){
    gl_FragColor = vec4(vPosition, 1.0);
}
`;

const renderVertSrc = `
attribute vec3 aPosition;

uniform sampler2D uTexture;

void main(){
    gl_Position = texture2D(uTexture, (aPosition.xy + 1.0) / 2.0);
    gl_PointSize = 2.0;
}
`;

const renderFragSrc = `
precision mediump float;

void main(){
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}
`;

const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl');
canvas.width = window.innerHeight * 0.6;
canvas.height = window.innerHeight * 0.6;

gl.getExtension('OES_texture_float');
gl.getExtension('OES_texture_half_float');

const initVertexShader = createShader(initVertSrc, gl.VERTEX_SHADER);
const initFragmentShader = createShader(initFragSrc, gl.FRAGMENT_SHADER);
const updateVertexShader = createShader(updateVertSrc, gl.VERTEX_SHADER);
const updateFragmentShader = createShader(updateFragSrc, gl.FRAGMENT_SHADER);
const renderVertexShader = createShader(renderVertSrc, gl.VERTEX_SHADER);
const renderFragmentShader = createShader(renderFragSrc, gl.FRAGMENT_SHADER);

const initProgram = createProgram(initVertexShader, initFragmentShader);
const updateProgram = createProgram(updateVertexShader, updateFragmentShader);
const renderProgram = createProgram(renderVertexShader, renderFragmentShader);

const n = 1000;
const position = [];
const axis = [];
const speed = [];

for(let i = 0; i < n; i++){
    let x = 2 * Math.random() - 1;
    let y = 2 * Math.random() - 1;
    let z = 2 * Math.random() - 1;
    let r = Math.sqrt(x**2 + y**2 + z**2);
    x /= r; y /= r; z /= r;
    position.push(x, y, z);

    x = 2 * Math.random() - 1;
    y = 2 * Math.random() - 1;
    z = 2 * Math.random() - 1;
    r = Math.sqrt(x**2 + y**2 + z**2);
    x /= r; y /= r; z /= r;
    axis.push(x, y, z);

    speed.push(0.1 * Math.random());
}

const positionBuffer = createArrayBuffer(position);
const axisBuffer = createArrayBuffer(axis);
const speedBuffer = createArrayBuffer(speed);

const TEXTURE_WIDTH = canvas.width;
const TEXTURE_HEIGHT = canvas.height;
let [prevFrameBuffer, prevTexture] = createFrameBuffer(TEXTURE_WIDTH, TEXTURE_HEIGHT, gl.FLOAT);
let [nextFrameBuffer, nextTexture] = createFrameBuffer(TEXTURE_WIDTH, TEXTURE_HEIGHT, gl.FLOAT);

// initialize
gl.useProgram(initProgram);
gl.viewport(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
gl.bindFramebuffer(gl.FRAMEBUFFER, prevFrameBuffer);
gl.clear(gl.COLOR_BUFFER_BIT);

setAttribute(gl.getAttribLocation(initProgram, 'aPosition'), 3, positionBuffer);
// gl.uniform2fv(gl.getUniformLocation(initProgram, 'uResolution'), [TEXTURE_WIDTH, TEXTURE_HEIGHT]);
gl.drawArrays(gl.POINTS, 0, n);
gl.flush();

render();

function render(){
    // update
    gl.useProgram(updateProgram);
    gl.viewport(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT);
    gl.bindTexture(gl.TEXTURE_2D, prevTexture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, nextFrameBuffer);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT);

    setAttribute(gl.getAttribLocation(updateProgram, 'aPosition'), 3, positionBuffer);
    setAttribute(gl.getAttribLocation(updateProgram, 'aAxis'), 3, axisBuffer);
    setAttribute(gl.getAttribLocation(updateProgram, 'aSpeed'), 1, speedBuffer);
    // gl.uniform2fv(gl.getUniformLocation(updateProgram, 'uResolution'), [TEXTURE_WIDTH, TEXTURE_HEIGHT]);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.flush();
    // return;

    // render
    gl.useProgram(renderProgram);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, nextTexture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    setAttribute(gl.getAttribLocation(renderProgram, 'aPosition'), 3, positionBuffer);
    // gl.uniform2fv(gl.getUniformLocation(renderProgram, 'uResolution'), [TEXTURE_WIDTH, TEXTURE_HEIGHT]);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.flush();

    [prevFrameBuffer, nextFrameBuffer] = [nextFrameBuffer, prevFrameBuffer];
    [prevTexture, nextTexture] = [nextTexture, prevTexture];

    requestAnimationFrame(render)
}

// -----------------------------------------------------------------------------

function createShader(source, type){
    let shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
        alert('An error occurred compiling the shader: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }
    return shader;
}

function createProgram(vertexShader, fragmentShader){
    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
        throw new Error('Can not link program(' + gl.getProgramParameter(program) + ')');
    }
    return program;
}

function createArrayBuffer(array){
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(array), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return buffer;
}

function setAttribute(location, size, buffer){
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

function createFrameBuffer(width, height, type){
    const frameBuffer = gl.createFramebuffer();
    const texture = gl.createTexture();

    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return [frameBuffer, texture];
}