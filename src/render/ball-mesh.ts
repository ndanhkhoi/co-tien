import { Geometry, GlProgram, Mesh, Shader, type Texture, type UniformGroup } from 'pixi.js';
import type { BallStyle } from '../core/ball-styles';

const vertex = `#version 300 es
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

// The quad spans [-1, 1]; each fragment reconstructs the sphere normal (z toward the
// viewer), rotates it into the ball's own frame and decides the surface paint there.
const fragment = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 fragColor;
uniform sampler2D uNumbers;
uniform mat3 uRot;
uniform vec3 uColor;
uniform vec3 uCloth;
uniform float uStripe;
uniform float uNumber;
uniform float uDots;
uniform float uPx;
uniform float uAlpha;

const vec3 IVORY = vec3(0.965, 0.955, 0.915);
const float CIRCLE_COS = 0.86;   // number circle angular radius ~31°
const float STRIPE_Y = 0.56;     // stripe band half-height (sin of latitude)

void main() {
  vec2 p = vUV;
  float r = length(p);
  float edge = 1.0 - smoothstep(1.0 - 1.6 / uPx, 1.0, r);
  if (edge <= 0.0) discard;
  float z = sqrt(max(0.0, 1.0 - r * r));
  vec3 n = vec3(p, z);
  vec3 l = transpose(uRot) * n;

  vec3 base = uColor;
  if (uStripe > 0.5) {
    float band = smoothstep(STRIPE_Y + 0.012, STRIPE_Y - 0.012, abs(l.y));
    base = mix(IVORY, uColor, band);
  }
  if (uNumber > 0.5) {
    float cz = abs(l.z);
    float inCircle = smoothstep(CIRCLE_COS - 0.008, CIRCLE_COS + 0.008, cz);
    if (inCircle > 0.0) {
      vec2 g = l.xy / sqrt(1.0 - CIRCLE_COS * CIRCLE_COS);
      if (l.z < 0.0) g.x = -g.x;
      vec2 cell = vec2(mod(uNumber - 1.0, 4.0), floor((uNumber - 1.0) / 4.0));
      vec2 uv = (cell + clamp(g * 0.46 + 0.5, 0.0, 1.0)) / 4.0;
      float ink = texture(uNumbers, uv).a;
      vec3 disc = mix(IVORY, vec3(0.06), ink);
      base = mix(base, disc, inCircle);
    }
  }
  if (uDots > 0.5) {
    vec3 a = abs(l);
    float m = max(a.x, max(a.y, a.z));
    base = mix(base, vec3(0.78, 0.09, 0.12), smoothstep(0.978, 0.986, m));
  }

  vec3 L = normalize(vec3(-0.32, -0.5, 0.8));
  float diff = max(dot(n, L), 0.0);
  vec3 col = base * (0.26 + 0.82 * diff);
  // Cloth bounce light on the lower rim, and a darker terminator.
  float rim = 1.0 - z;
  col += uCloth * 0.22 * rim * max(0.0, p.y * 0.6 + p.x * 0.2 + 0.4);
  col *= mix(0.62, 1.0, smoothstep(0.0, 0.55, z));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float nh = max(dot(n, H), 0.0);
  col += vec3(1.0, 0.99, 0.95) * (pow(nh, 140.0) * 1.1 + pow(nh, 18.0) * 0.10);
  // Faint ceiling reflection (lamp window) for a lacquered look.
  vec2 win = p - vec2(-0.32, -0.42);
  col += vec3(0.25) * smoothstep(0.22, 0.12, length(win * vec2(1.0, 1.8))) * 0.5;

  float a = edge * uAlpha;
  fragColor = vec4(col * a, a);
}`;

let geometry: Geometry | null = null;

function quad(): Geometry {
  if (!geometry) {
    geometry = new Geometry({
      attributes: {
        aPosition: [-1, -1, 1, -1, 1, 1, -1, 1],
        aUV: [-1, -1, 1, -1, 1, 1, -1, 1],
      },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    });
  }
  return geometry;
}

let program: GlProgram | null = null;
/** One GL program for every ball: each mesh only carries its own uniforms, so it is linked once. */
function ballProgram(): GlProgram {
  return (program ??= GlProgram.from({ vertex, fragment, name: 'ball' }));
}

const rgb = (c: number): [number, number, number] => [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];

export class BallMesh {
  readonly mesh: Mesh<Geometry, Shader>;
  /** Column-major rotation (ball frame → view frame). */
  readonly rot = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  private group: UniformGroup;
  private uniforms: { uRot: Float32Array; uPx: number; uAlpha: number; [k: string]: unknown };

  constructor(style: BallStyle, numbers: Texture, cloth: number, rng: () => number) {
    const shader = new Shader({
      glProgram: ballProgram(),
      resources: {
        uNumbers: numbers.source,
        ballUniforms: {
          uRot: { value: this.rot, type: 'mat3x3<f32>' },
          uColor: { value: rgb(style.color), type: 'vec3<f32>' },
          uCloth: { value: rgb(cloth), type: 'vec3<f32>' },
          uStripe: { value: style.stripe ? 1 : 0, type: 'f32' },
          uNumber: { value: style.number, type: 'f32' },
          uDots: { value: style.dots ? 1 : 0, type: 'f32' },
          uPx: { value: 10, type: 'f32' },
          uAlpha: { value: 1, type: 'f32' },
        },
      },
    });
    this.group = shader.resources.ballUniforms as UniformGroup;
    this.uniforms = this.group.uniforms as BallMesh['uniforms'];
    this.mesh = new Mesh({ geometry: quad(), shader });
    // Random starting orientation so racks don't look stamped.
    this.faceUp(rng);
  }

  setPixelRadius(px: number) {
    this.uniforms.uPx = px;
    this.group.update();
  }

  setAlpha(a: number) {
    this.uniforms.uAlpha = a;
    this.group.update();
  }

  /** Apply a rotation of `angle` radians about axis (x, y, z) in view space. */
  rotate(x: number, y: number, z: number, angle: number) {
    const len = Math.hypot(x, y, z);
    if (len < 1e-9 || angle === 0) return;
    x /= len; y /= len; z /= len;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const t = 1 - c;
    // Rodrigues matrix (row-major r00..r22).
    const r00 = t * x * x + c, r01 = t * x * y - s * z, r02 = t * x * z + s * y;
    const r10 = t * x * y + s * z, r11 = t * y * y + c, r12 = t * y * z - s * x;
    const r20 = t * x * z - s * y, r21 = t * y * z + s * x, r22 = t * z * z + c;
    const m = this.rot;
    // New = Rodrigues · Old (column-major storage: m[col*3 + row]).
    for (let col = 0; col < 3; col++) {
      const a0 = m[col * 3], a1 = m[col * 3 + 1], a2 = m[col * 3 + 2];
      m[col * 3] = r00 * a0 + r01 * a1 + r02 * a2;
      m[col * 3 + 1] = r10 * a0 + r11 * a1 + r12 * a2;
      m[col * 3 + 2] = r20 * a0 + r21 * a1 + r22 * a2;
    }
    this.orthonormalize();
    this.group.update();
  }

  private orthonormalize() {
    const m = this.rot;
    let l = Math.hypot(m[0], m[1], m[2]);
    m[0] /= l; m[1] /= l; m[2] /= l;
    const d = m[0] * m[3] + m[1] * m[4] + m[2] * m[5];
    m[3] -= d * m[0]; m[4] -= d * m[1]; m[5] -= d * m[2];
    l = Math.hypot(m[3], m[4], m[5]);
    m[3] /= l; m[4] /= l; m[5] /= l;
    m[6] = m[1] * m[5] - m[2] * m[4];
    m[7] = m[2] * m[3] - m[0] * m[5];
    m[8] = m[0] * m[4] - m[1] * m[3];
  }

  /** Point the number circle roughly up so a resting rack shows its numbers. */
  faceUp(rng: () => number) {
    this.rot.set([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    this.rotate(0, 0, 1, rng() * Math.PI * 2);
    this.rotate(1, 0, 0, (rng() - 0.5) * 0.9);
    this.rotate(0, 1, 0, (rng() - 0.5) * 0.9);
  }
}
