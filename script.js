/* global dat, requestAnimationFrame, alert, QwertyHancock, AudioContext */
'use strict'

var data = {
  x: 0,
  y: -200,
  z: 0,
  r: 0,
  velX: 0,
  velY: 0,
  cameraDistance: 500,
  lightX: 1,
  lightY: 1,
  lightZ: 1,
  animateSpeed: 0.0,
  fov: 1.0471975511965976,
  zNear: 1,
  zFar: 5000,
  fps: 0,
  oscillatorType1: 'sawtooth',
  oscillatorType2: 'triangle',
  oscillatorDetune1: -10,
  oscillatorDetune2: 10
}
var keyLeft = false
var keyRight = false
var keyUp = false
var gui = new dat.GUI()
gui.close()
var canvas = document.getElementById('glcanvas')
canvas.width = window.innerWidth
canvas.height = window.innerHeight
var gl = canvas.getContext('webgl')

// Audio stuff
var context = new AudioContext()
var masterVolume = context.createGain()
var oscillators = {}
var keyboard = new QwertyHancock({
  id: 'keyboard',
  width: window.innerWidth,
  height: 150,
  octaves: 2
})
masterVolume.gain.value = 0.3
masterVolume.connect(context.destination)

keyboard.keyDown = function (note, frequency) {
  console.log('Note', note, 'has been pressed. Its frequency is', frequency)
  var osc = context.createOscillator()
  var osc2 = context.createOscillator()

  osc.frequency.value = frequency
  osc.type = data.oscillatorType1

  osc2.frequency.value = frequency
  osc2.type = data.oscillatorType1

  osc.detune.value = data.oscillatorDetune1
  osc2.detune.value = data.oscillatorDetune2

  osc.connect(masterVolume)
  osc2.connect(masterVolume)

  masterVolume.connect(context.destination)

  oscillators[frequency] = [osc, osc2]

  osc.start(context.currentTime)
  osc2.start(context.currentTime)
}

keyboard.keyUp = function (note, frequency) {
  oscillators[frequency].forEach(function (oscillator) {
    oscillator.stop(context.currentTime)
  })
}

gui.remember(data)
gui.add(data, 'animateSpeed', 0, 1)
gui.add(data, 'x', -500, 500).listen()
gui.add(data, 'y', -2000, 2000).listen()
gui.add(data, 'z', -500, 500)
gui.add(data, 'r', 0, Math.PI * 2).listen()
gui.add(data, 'velX', 0, 20).listen()
gui.add(data, 'velY', 0, 20).listen()
gui.add(data, 'lightX', 0, 1)
gui.add(data, 'lightY', 0, 1)
gui.add(data, 'lightZ', 0, 1)
gui.add(data, 'cameraDistance', 0, 2000)
gui.add(data, 'fov', 0, Math.PI)
gui.add(data, 'zNear', 1, 1000)
gui.add(data, 'zFar', 0, 5000)
gui.add(data, 'oscillatorType1', { sawtooth: 'sawtooth', triangle: 'triangle', sine: 'sine', square: 'square' })
gui.add(data, 'oscillatorType2', { sawtooth: 'sawtooth', triangle: 'triangle', sine: 'sine', square: 'square' })
gui.add(data, 'oscillatorDetune1', -100, 100)
gui.add(data, 'oscillatorDetune2', -100, 100)
gui.add(data, 'fps').listen()

document.onkeydown = document.onkeyup = (e) => {
  switch (e.keyCode) {
    case 37:
      keyLeft = e.type === 'keydown'
      break
    case 39:
      keyRight = e.type === 'keydown'
      break
    case 38:
      keyUp = e.type === 'keydown'
      break
  // default:
  //   console.log(e.code, e.keyCode)
  }
}

var touchEvent = (e) => {
  keyLeft = keyRight = keyUp = false
  keyLeft = Array.from(e.touches).some(t => t.clientX < window.innerWidth / 2)
  keyRight = Array.from(e.touches).some(t => t.clientX > window.innerWidth / 2)
  keyUp = keyLeft && keyRight
}
document.addEventListener('touchstart', touchEvent, false)
document.addEventListener('touchmove', touchEvent, false)
document.addEventListener('touchend', touchEvent, false)

var program = gl.createProgram()
var newShader = function (id, type) {
  var shader = gl.createShader(type)

  // wire up the shader and compile
  gl.shaderSource(shader, document.getElementById(id).import.body.innerText)
  gl.compileShader(shader)

  // if things didn't go so well alert
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader))
    return null
  }
  gl.attachShader(program, shader)
}
newShader('vert', gl.VERTEX_SHADER)
newShader('frag', gl.FRAGMENT_SHADER)

gl.linkProgram(program)

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  alert('Could not initialise main shaders')
}

gl.useProgram(program)
gl.enable(gl.CULL_FACE)
gl.enable(gl.DEPTH_TEST)

// look up where the vertex data needs to go.
var positionLocation = gl.getAttribLocation(program, 'a_position')
var normalLocation = gl.getAttribLocation(program, 'a_normal')
var colorLocation = gl.getUniformLocation(program, 'u_color')
var reverseLightDirectionLocation = gl.getUniformLocation(program, 'u_reverseLightDirection')
var worldViewProjectionLocation = gl.getUniformLocation(program, 'u_worldViewProjection')
var worldLocation = gl.getUniformLocation(program, 'u_world')

// Create a buffer.
var geometryBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, geometryBuffer)
gl.enableVertexAttribArray(positionLocation)
gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0)

var geo = setGeometry(gl)

// Create a buffer for normals.
var buffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
gl.enableVertexAttribArray(normalLocation)
gl.vertexAttribPointer(normalLocation, 3, gl.FLOAT, false, 0, 0)

// Set normals.
setNormals(gl)

// Draw the scene.
var lastTimestamp = 0

// Generate stars
var stars = []
for (var i = 0; i < 100; i++) {
  stars.push([Math.random() * 1000, Math.random() * 1000, 0, Math.random() * Math.PI * 2, 'star'])
}

function drawScene (timestamp) {
  var dt = timestamp - lastTimestamp
  var thrust = 0.0
  lastTimestamp = timestamp
  data.fps = 1000 / dt

  // Clear the canvas AND the depth buffer.
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  // Move around the screen
  if (keyRight) data.r -= 0.005 * dt
  if (keyLeft) data.r += 0.005 * dt
  if (keyUp) thrust = 0.0001 * dt
  data.velX += Math.cos(data.r + Math.PI / 2) * thrust * dt
  data.velY += Math.sin(data.r + Math.PI / 2) * thrust * dt
  data.x -= data.velX
  data.y -= data.velY

  // Space limits
  data.y = data.y < -750 ? 100 : data.y
  data.y = data.y > 100 ? -750 : data.y
  data.x = data.x > 700 ? -700 : data.x
  data.x = data.x < -700 ? 700 : data.x

  // Compute the matrices
  var aspect = canvas.width / canvas.height
  var projectionMatrix = makePerspective(data.fov, aspect, data.zNear, data.zFar)

  // Use matrix math to compute a position on the circle.
  var cameraMatrix = makeTranslation(data.x, data.y + 50, data.z + data.cameraDistance)

  // Make a view matrix from the camera matrix.
  var viewMatrix = makeInverse(cameraMatrix)

  function drawShip (x, y, z, angle, type) {
    var translationMatrix = makeTranslation(x, y, z)
    var rotationMatrix = makeZRotation(angle)

    // Multiply the matrices.
    var matrix = translationMatrix
    matrix = matrixMultiply(translationMatrix, viewMatrix)
    matrix = matrixMultiply(matrix, rotationMatrix)

    var worldViewProjectionMatrix = matrixMultiply(matrix, projectionMatrix)

    // Set the matrix.
    gl.uniformMatrix4fv(worldViewProjectionLocation, false, worldViewProjectionMatrix)
    gl.uniformMatrix4fv(worldLocation, false, translationMatrix)

    // set the light direction.
    gl.uniform3fv(reverseLightDirectionLocation, normalize([ data.lightX, data.lightY, data.lightZ ]))

    // Draw the geometry.
    switch (type) {
      case 'ship':
        gl.uniform4fv(colorLocation, [ 0.7, 0.2, 0.2, 1 ]) // green
        gl.drawArrays(gl.TRIANGLES, 0, geo.ship)
        break
      case 'planet':
        gl.uniform4fv(colorLocation, [ 0.7, 0.2, 0.2, 1 ]) // green
        gl.drawArrays(gl.TRIANGLES, geo.ship, geo.planet)
        break
      case 'star':
        var r = Math.random()
        var b = 1 - r
        gl.uniform4fv(colorLocation, [ r, 0, b, 1 ]) // whiteish
        gl.drawArrays(gl.TRIANGLES, geo.ship + geo.planet, geo.star)
        break
      default:
        throw new Error('up')
    }
  }

  drawShip(data.x, data.y, data.z, data.r, 'ship')

  stars.forEach(s => drawShip.apply(this, s))

  drawShip(100, -60, 50, 0, 'planet')
  drawShip(-100, -250, -110, 0, 'planet')
  drawShip(150, -290, -210, 0, 'planet')
  drawShip(250, -400, -300, 0, 'planet')

  requestAnimationFrame(drawScene)
}

requestAnimationFrame(drawScene)

function makeTranslation (tx, ty, tz) {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    tx, ty, tz, 1
  ]
}

function normalize (v) {
  var length = Math.sqrt(v[ 0 ] * v[ 0 ] + v[ 1 ] * v[ 1 ] + v[ 2 ] * v[ 2 ])
  // make sure we don't divide by 0.
  if (length > 0.00001) {
    return [ v[ 0 ] / length, v[ 1 ] / length, v[ 2 ] / length ]
  } else {
    return [ 0, 0, 0 ]
  }
}

function makeInverse (m) {
  var m00 = m[ 0 * 4 + 0 ]
  var m01 = m[ 0 * 4 + 1 ]
  var m02 = m[ 0 * 4 + 2 ]
  var m03 = m[ 0 * 4 + 3 ]
  var m10 = m[ 1 * 4 + 0 ]
  var m11 = m[ 1 * 4 + 1 ]
  var m12 = m[ 1 * 4 + 2 ]
  var m13 = m[ 1 * 4 + 3 ]
  var m20 = m[ 2 * 4 + 0 ]
  var m21 = m[ 2 * 4 + 1 ]
  var m22 = m[ 2 * 4 + 2 ]
  var m23 = m[ 2 * 4 + 3 ]
  var m30 = m[ 3 * 4 + 0 ]
  var m31 = m[ 3 * 4 + 1 ]
  var m32 = m[ 3 * 4 + 2 ]
  var m33 = m[ 3 * 4 + 3 ]
  var tmp0 = m22 * m33
  var tmp1 = m32 * m23
  var tmp2 = m12 * m33
  var tmp3 = m32 * m13
  var tmp4 = m12 * m23
  var tmp5 = m22 * m13
  var tmp6 = m02 * m33
  var tmp7 = m32 * m03
  var tmp8 = m02 * m23
  var tmp9 = m22 * m03
  var tmp10 = m02 * m13
  var tmp11 = m12 * m03
  var tmp12 = m20 * m31
  var tmp13 = m30 * m21
  var tmp14 = m10 * m31
  var tmp15 = m30 * m11
  var tmp16 = m10 * m21
  var tmp17 = m20 * m11
  var tmp18 = m00 * m31
  var tmp19 = m30 * m01
  var tmp20 = m00 * m21
  var tmp21 = m20 * m01
  var tmp22 = m00 * m11
  var tmp23 = m10 * m01

  var t0 = (tmp0 * m11 + tmp3 * m21 + tmp4 * m31) -
    (tmp1 * m11 + tmp2 * m21 + tmp5 * m31)
  var t1 = (tmp1 * m01 + tmp6 * m21 + tmp9 * m31) -
    (tmp0 * m01 + tmp7 * m21 + tmp8 * m31)
  var t2 = (tmp2 * m01 + tmp7 * m11 + tmp10 * m31) -
    (tmp3 * m01 + tmp6 * m11 + tmp11 * m31)
  var t3 = (tmp5 * m01 + tmp8 * m11 + tmp11 * m21) -
    (tmp4 * m01 + tmp9 * m11 + tmp10 * m21)

  var d = 1.0 / (m00 * t0 + m10 * t1 + m20 * t2 + m30 * t3)

  return [
    d * t0,
    d * t1,
    d * t2,
    d * t3,
    d * ((tmp1 * m10 + tmp2 * m20 + tmp5 * m30) -
    (tmp0 * m10 + tmp3 * m20 + tmp4 * m30)),
    d * ((tmp0 * m00 + tmp7 * m20 + tmp8 * m30) -
    (tmp1 * m00 + tmp6 * m20 + tmp9 * m30)),
    d * ((tmp3 * m00 + tmp6 * m10 + tmp11 * m30) -
    (tmp2 * m00 + tmp7 * m10 + tmp10 * m30)),
    d * ((tmp4 * m00 + tmp9 * m10 + tmp10 * m20) -
    (tmp5 * m00 + tmp8 * m10 + tmp11 * m20)),
    d * ((tmp12 * m13 + tmp15 * m23 + tmp16 * m33) -
    (tmp13 * m13 + tmp14 * m23 + tmp17 * m33)),
    d * ((tmp13 * m03 + tmp18 * m23 + tmp21 * m33) -
    (tmp12 * m03 + tmp19 * m23 + tmp20 * m33)),
    d * ((tmp14 * m03 + tmp19 * m13 + tmp22 * m33) -
    (tmp15 * m03 + tmp18 * m13 + tmp23 * m33)),
    d * ((tmp17 * m03 + tmp20 * m13 + tmp23 * m23) -
    (tmp16 * m03 + tmp21 * m13 + tmp22 * m23)),
    d * ((tmp14 * m22 + tmp17 * m32 + tmp13 * m12) -
    (tmp16 * m32 + tmp12 * m12 + tmp15 * m22)),
    d * ((tmp20 * m32 + tmp12 * m02 + tmp19 * m22) -
    (tmp18 * m22 + tmp21 * m32 + tmp13 * m02)),
    d * ((tmp18 * m12 + tmp23 * m32 + tmp15 * m02) -
    (tmp22 * m32 + tmp14 * m02 + tmp19 * m12)),
    d * ((tmp22 * m22 + tmp16 * m02 + tmp21 * m12) -
    (tmp20 * m12 + tmp23 * m22 + tmp17 * m02))
  ]
}

function makePerspective (fieldOfViewInRadians, aspect, near, far) {
  var f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewInRadians)
  var rangeInv = 1.0 / (near - far)

  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * rangeInv, -1,
    0, 0, near * far * rangeInv * 2, 0
  ]
}

function matrixMultiply (a, b) {
  var a00 = a[ 0 * 4 + 0 ]
  var a01 = a[ 0 * 4 + 1 ]
  var a02 = a[ 0 * 4 + 2 ]
  var a03 = a[ 0 * 4 + 3 ]
  var a10 = a[ 1 * 4 + 0 ]
  var a11 = a[ 1 * 4 + 1 ]
  var a12 = a[ 1 * 4 + 2 ]
  var a13 = a[ 1 * 4 + 3 ]
  var a20 = a[ 2 * 4 + 0 ]
  var a21 = a[ 2 * 4 + 1 ]
  var a22 = a[ 2 * 4 + 2 ]
  var a23 = a[ 2 * 4 + 3 ]
  var a30 = a[ 3 * 4 + 0 ]
  var a31 = a[ 3 * 4 + 1 ]
  var a32 = a[ 3 * 4 + 2 ]
  var a33 = a[ 3 * 4 + 3 ]
  var b00 = b[ 0 * 4 + 0 ]
  var b01 = b[ 0 * 4 + 1 ]
  var b02 = b[ 0 * 4 + 2 ]
  var b03 = b[ 0 * 4 + 3 ]
  var b10 = b[ 1 * 4 + 0 ]
  var b11 = b[ 1 * 4 + 1 ]
  var b12 = b[ 1 * 4 + 2 ]
  var b13 = b[ 1 * 4 + 3 ]
  var b20 = b[ 2 * 4 + 0 ]
  var b21 = b[ 2 * 4 + 1 ]
  var b22 = b[ 2 * 4 + 2 ]
  var b23 = b[ 2 * 4 + 3 ]
  var b30 = b[ 3 * 4 + 0 ]
  var b31 = b[ 3 * 4 + 1 ]
  var b32 = b[ 3 * 4 + 2 ]
  var b33 = b[ 3 * 4 + 3 ]
  return [ a00 * b00 + a01 * b10 + a02 * b20 + a03 * b30,
    a00 * b01 + a01 * b11 + a02 * b21 + a03 * b31,
    a00 * b02 + a01 * b12 + a02 * b22 + a03 * b32,
    a00 * b03 + a01 * b13 + a02 * b23 + a03 * b33,
    a10 * b00 + a11 * b10 + a12 * b20 + a13 * b30,
    a10 * b01 + a11 * b11 + a12 * b21 + a13 * b31,
    a10 * b02 + a11 * b12 + a12 * b22 + a13 * b32,
    a10 * b03 + a11 * b13 + a12 * b23 + a13 * b33,
    a20 * b00 + a21 * b10 + a22 * b20 + a23 * b30,
    a20 * b01 + a21 * b11 + a22 * b21 + a23 * b31,
    a20 * b02 + a21 * b12 + a22 * b22 + a23 * b32,
    a20 * b03 + a21 * b13 + a22 * b23 + a23 * b33,
    a30 * b00 + a31 * b10 + a32 * b20 + a33 * b30,
    a30 * b01 + a31 * b11 + a32 * b21 + a33 * b31,
    a30 * b02 + a31 * b12 + a32 * b22 + a33 * b32,
    a30 * b03 + a31 * b13 + a32 * b23 + a33 * b33
  ]
}

// Make the ship
function setGeometry (gl) {
  var MIDDLE_HEIGHT = 25
  var WING_LENGTH = 50
  var TOP_RIDGE_LENGTH = 100
  var REAR_RIDGE_LENGTH = 20
  var PLANET_WIDTH = 20
  var STAR_LONG = 20
  var STAR_SHORT = 10
  var STAR_DISTANCE = -1500
  var positions = new Float32Array([

    // front top right
    0, 0, 0, // tip
    0, TOP_RIDGE_LENGTH, -MIDDLE_HEIGHT, // bottom
    WING_LENGTH, TOP_RIDGE_LENGTH, 0, // right

    // front top left
    0, 0, 0, // tip
    -WING_LENGTH, TOP_RIDGE_LENGTH, 0, // left
    0, TOP_RIDGE_LENGTH, -MIDDLE_HEIGHT, // bottom

    // front back right
    0, 0, 0, // tip
    WING_LENGTH, TOP_RIDGE_LENGTH, 0, // right
    0, TOP_RIDGE_LENGTH, MIDDLE_HEIGHT, // bottom

    // front back left
    0, 0, 0, // tip
    0, TOP_RIDGE_LENGTH, MIDDLE_HEIGHT, // bottom
    -WING_LENGTH, TOP_RIDGE_LENGTH, 0, // left

    // --------rear----------
    // rear top right
    0, TOP_RIDGE_LENGTH, -MIDDLE_HEIGHT, // middle
    0, TOP_RIDGE_LENGTH + REAR_RIDGE_LENGTH, 0, // tip
    WING_LENGTH, TOP_RIDGE_LENGTH, 0, // right

    // rear top left
    0, TOP_RIDGE_LENGTH, -MIDDLE_HEIGHT, // middle
    -WING_LENGTH, TOP_RIDGE_LENGTH, 0, // right
    0, TOP_RIDGE_LENGTH + REAR_RIDGE_LENGTH, 0, // tip

    // rear back right
    0, TOP_RIDGE_LENGTH + REAR_RIDGE_LENGTH, 0, // tip
    0, TOP_RIDGE_LENGTH, MIDDLE_HEIGHT, // middle
    WING_LENGTH, TOP_RIDGE_LENGTH, 0, // right

    // rear back left
    0, TOP_RIDGE_LENGTH, MIDDLE_HEIGHT, // middle
    0, TOP_RIDGE_LENGTH + REAR_RIDGE_LENGTH, 0, // tip
    -WING_LENGTH, TOP_RIDGE_LENGTH, 0, // right

    -PLANET_WIDTH, -PLANET_WIDTH, -PLANET_WIDTH, // triangle 1 : begin
    -PLANET_WIDTH, -PLANET_WIDTH, PLANET_WIDTH,
    -PLANET_WIDTH, PLANET_WIDTH, PLANET_WIDTH, // triangle 1 : end
    PLANET_WIDTH, PLANET_WIDTH, -PLANET_WIDTH, // triangle 2 : begin
    -PLANET_WIDTH, -PLANET_WIDTH, -PLANET_WIDTH,
    -PLANET_WIDTH, PLANET_WIDTH, -PLANET_WIDTH, // triangle 2 : end
    PLANET_WIDTH, -PLANET_WIDTH, PLANET_WIDTH,
    -PLANET_WIDTH, -PLANET_WIDTH, -PLANET_WIDTH,
    PLANET_WIDTH, -PLANET_WIDTH, -PLANET_WIDTH,
    PLANET_WIDTH, PLANET_WIDTH, -PLANET_WIDTH,
    PLANET_WIDTH, -PLANET_WIDTH, -PLANET_WIDTH,
    -PLANET_WIDTH, -PLANET_WIDTH, -PLANET_WIDTH,
    -PLANET_WIDTH, -PLANET_WIDTH, -PLANET_WIDTH,
    -PLANET_WIDTH, PLANET_WIDTH, PLANET_WIDTH,
    -PLANET_WIDTH, PLANET_WIDTH, -PLANET_WIDTH,
    PLANET_WIDTH, -PLANET_WIDTH, PLANET_WIDTH,
    -PLANET_WIDTH, -PLANET_WIDTH, PLANET_WIDTH,
    -PLANET_WIDTH, -PLANET_WIDTH, -PLANET_WIDTH,
    -PLANET_WIDTH, PLANET_WIDTH, PLANET_WIDTH,
    -PLANET_WIDTH, -PLANET_WIDTH, PLANET_WIDTH,
    PLANET_WIDTH, -PLANET_WIDTH, PLANET_WIDTH,
    PLANET_WIDTH, PLANET_WIDTH, PLANET_WIDTH,
    PLANET_WIDTH, -PLANET_WIDTH, -PLANET_WIDTH,
    PLANET_WIDTH, PLANET_WIDTH, -PLANET_WIDTH,
    PLANET_WIDTH, -PLANET_WIDTH, -PLANET_WIDTH,
    PLANET_WIDTH, PLANET_WIDTH, PLANET_WIDTH,
    PLANET_WIDTH, -PLANET_WIDTH, PLANET_WIDTH,
    PLANET_WIDTH, PLANET_WIDTH, PLANET_WIDTH,
    PLANET_WIDTH, PLANET_WIDTH, -PLANET_WIDTH,
    -PLANET_WIDTH, PLANET_WIDTH, -PLANET_WIDTH,
    PLANET_WIDTH, PLANET_WIDTH, PLANET_WIDTH,
    -PLANET_WIDTH, PLANET_WIDTH, -PLANET_WIDTH,
    -PLANET_WIDTH, PLANET_WIDTH, PLANET_WIDTH,
    PLANET_WIDTH, PLANET_WIDTH, PLANET_WIDTH,
    -PLANET_WIDTH, PLANET_WIDTH, PLANET_WIDTH,
    PLANET_WIDTH, -PLANET_WIDTH, PLANET_WIDTH,

    // Star
    0, STAR_LONG, STAR_DISTANCE, // top
    -STAR_LONG, -STAR_SHORT, STAR_DISTANCE, // bottom left
    STAR_LONG, -STAR_SHORT, STAR_DISTANCE, // bottom right

    0, -STAR_LONG, STAR_DISTANCE, // bottom
    STAR_LONG, STAR_SHORT, STAR_DISTANCE, // top right
    -STAR_LONG, STAR_SHORT, STAR_DISTANCE, // top left
  ])

  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
  return {
    ship: 24,
    planet: 12 * 3,
    star: 2 * 3
  }
}

function setNormals (gl) {
  var normals = new Float32Array([
    // left column front
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,

    // top rung front
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,

    // middle rung front
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,

    // left column back
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,

    // top rung back
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,

    // middle rung back
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,
    0, 0, -1,

    // top
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,

    // top rung right
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,

    // under top rung
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,

    // between top rung and middle
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,

    // top of middle rung
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,

    // right of middle rung
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,

    // bottom of middle rung.
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,

    // right of bottom
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,
    1, 0, 0,

    // bottom
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,
    0, -1, 0,

    // left side
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0
  ])
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW)
}

function makeXRotation (angleInRadians) {
  var c = Math.cos(angleInRadians)
  var s = Math.sin(angleInRadians)

  return [
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1
  ]
}

function makeYRotation (angleInRadians) {
  var c = Math.cos(angleInRadians)
  var s = Math.sin(angleInRadians)

  return [
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1
  ]
}

function makeZRotation (angleInRadians) {
  var c = Math.cos(angleInRadians)
  var s = Math.sin(angleInRadians)
  return [
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]
}
