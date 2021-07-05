function setup() {
    createCanvas(850, windowHeight*2/3, WEBGL).parent("canvas");
}

function draw() {
    background(50);
    stroke(0.1);

    rotateY(- frameCount / 30);
    rotateX(PI/4);
    translate(-45, 0, 0);

    push();
    rotate(PI/8);
    torus(100, 50, 8);
    pop();

    push();
    rotateX(PI/2);
    rotateZ(-PI/8);
    translate(90 * cos(PI/8), 90 * sin(PI/8), 0);
    fill(100, 200, 200);
    torus(100, 50, 8);
    pop();
}