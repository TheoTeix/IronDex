/* ════════════════════════════════════════════════════════════════════
   LiquidMetal — port VANILLA du composant RareUI
   Source : rareui.in/docs/components/liquid-metal (registre officiel
   https://rareui.in/r/LiquidMetal.json). Les DEUX shaders ci-dessous sont
   recopiés VERBATIM du composant original — c'est eux qui font l'effet :
   des bandes chrome (color1 blanc ↔ color2 noir) déformées par un bombé de
   lentille, décalées canal par canal (aberration chromatique = dispersion)
   et animées par un bruit simplex.

   Pourquoi un port vanilla plutôt que le .tsx : MiloDex n'a ni React, ni
   Tailwind, ni build. On garde donc l'API à l'identique
   (speed / dispersion / edge / patternBlur / liquify / patternScale / text)
   et on remplace les hooks par une petite classe.

   ⚠️ UN canvas WebGL par instance. Les navigateurs plafonnent à ~16 contextes
   vivants : ce composant est fait pour UNE pièce maîtresse (un mot, un logo),
   pas pour des centaines de boutons. Le matériau chrome des boutons est sa
   déclinaison CSS — voir liquid-metal.css, calée sur les MÊMES constantes.
   ════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  const VERT = `#version 300 es
precision mediump float;

in vec2 a_position;
out vec2 vUv;

void main() {
    vUv = .5 * (a_position + 1.);
    gl_Position = vec4(a_position, 0.0, 1.0);
}`;

  const FRAG = `#version 300 es
# ifdef GL_ES
precision highp float;
# else
precision mediump float;
# endif

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D u_image_texture;
uniform float u_time;
uniform float u_ratio;
uniform float u_img_ratio;
uniform float u_patternScale;
uniform float u_refraction;
uniform float u_edge;
uniform float u_patternBlur;
uniform float u_liquid;

#define PI 3.14159265358979323846

vec3 mod289(vec3 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec2 mod289(vec2 x) { return x - floor(x * (1. / 289.)) * 289.; }
vec3 permute(vec3 x) { return mod289(((x*34.)+1.)*x); }
float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1., 0.) : vec2(0., 1.);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.);
    m = m*m;
    m = m*m;
    vec3 x = 2. * fract(p * C.www) - 1.;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130. * dot(m, g);
}

vec2 get_img_uv() {
    vec2 img_uv = vUv;
    img_uv -= .5;
    if (u_ratio > u_img_ratio) {
        img_uv.x = img_uv.x * u_ratio / u_img_ratio;
    } else {
        img_uv.y = img_uv.y * u_img_ratio / u_ratio;
    }
    float scale_factor = 1.;
    img_uv *= scale_factor;
    img_uv += .5;
    img_uv.y = 1. - img_uv.y;
    return img_uv;
}

vec2 rotate(vec2 uv, float th) {
    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
}

float get_color_channel(float c1, float c2, float stripe_p, vec3 w, float extra_blur, float b) {
    float ch = c2;
    float border = 0.;
    float blur = u_patternBlur + extra_blur;

    ch = mix(ch, c1, smoothstep(.0, blur, stripe_p));

    border = w[0];
    ch = mix(ch, c2, smoothstep(border - blur, border + blur, stripe_p));

    b = smoothstep(.2, .8, b);
    border = w[0] + .4 * (1. - b) * w[1];
    ch = mix(ch, c1, smoothstep(border - blur, border + blur, stripe_p));

    border = w[0] + .5 * (1. - b) * w[1];
    ch = mix(ch, c2, smoothstep(border - blur, border + blur, stripe_p));

    border = w[0] + w[1];
    ch = mix(ch, c1, smoothstep(border - blur, border + blur, stripe_p));

    float gradient_t = (stripe_p - w[0] - w[1]) / w[2];
    float gradient = mix(c1, c2, smoothstep(0., 1., gradient_t));
    ch = mix(ch, gradient, smoothstep(border - blur, border + blur, stripe_p));

    return ch;
}

float get_img_frame_alpha(vec2 uv, float img_frame_width) {
    float img_frame_alpha = smoothstep(0., img_frame_width, uv.x) * smoothstep(1., 1. - img_frame_width, uv.x);
    img_frame_alpha *= smoothstep(0., img_frame_width, uv.y) * smoothstep(1., 1. - img_frame_width, uv.y);
    return img_frame_alpha;
}

void main() {
    vec2 uv = vUv;
    uv.y = 1. - uv.y;
    uv.x *= u_ratio;

    float diagonal = uv.x - uv.y;

    float t = .001 * mod(u_time, 10000.0);

    vec2 img_uv = get_img_uv();
    vec4 img = texture(u_image_texture, img_uv);

    vec3 color = vec3(0.);
    float opacity = 1.;

    vec3 color1 = vec3(.98, 0.98, 1.);
    vec3 color2 = vec3(.1, .1, .1 + .1 * smoothstep(.7, 1.3, uv.x + uv.y));

    float edge = img.r;

    vec2 grad_uv = uv;
    grad_uv -= .5;

    float dist = length(grad_uv + vec2(0., .2 * diagonal));
    grad_uv = rotate(grad_uv, (.25 - .2 * diagonal) * PI);

    float bulge = pow(1.8 * dist, 1.2);
    bulge = 1. - bulge;
    bulge *= pow(uv.y, .3);

    float cycle_width = u_patternScale;
    float thin_strip_1_ratio = .12 / cycle_width * (1. - .4 * bulge);
    float thin_strip_2_ratio = .07 / cycle_width * (1. + .4 * bulge);
    float wide_strip_ratio = (1. - thin_strip_1_ratio - thin_strip_2_ratio);

    float thin_strip_1_width = cycle_width * thin_strip_1_ratio;
    float thin_strip_2_width = cycle_width * thin_strip_2_ratio;

    opacity = 1. - smoothstep(.9 - .5 * u_edge, 1. - .5 * u_edge, edge);
    opacity *= get_img_frame_alpha(img_uv, 0.01);

    float noise = snoise(uv - t);
    edge += (1. - edge) * u_liquid * noise;

    float refr = 0.;
    refr += (1. - bulge);
    refr = clamp(refr, 0., 1.);

    float dir = grad_uv.x;
    dir += diagonal;
    dir -= 2. * noise * diagonal * (smoothstep(0., 1., edge) * smoothstep(1., 0., edge));

    bulge *= clamp(pow(uv.y, .1), .3, 1.);
    dir *= (.1 + (1.1 - edge) * bulge);
    dir *= smoothstep(1., .7, edge);
    dir += .18 * (smoothstep(.1, .2, uv.y) * smoothstep(.4, .2, uv.y));

    dir += .03 * (smoothstep(.1, .2, 1. - uv.y) * smoothstep(.4, .2, 1. - uv.y));
    dir *= (.5 + .5 * pow(uv.y, 2.));
    dir *= cycle_width;
    dir -= t;

    float refr_r = refr;
    refr_r += .03 * bulge * noise;
    float refr_b = 1.3 * refr;

    refr_r += 5. * (smoothstep(-.1, .2, uv.y) * smoothstep(.5, .1, uv.y)) * (smoothstep(.4, .6, bulge) * smoothstep(1., .4, bulge));
    refr_r -= diagonal;

    refr_b += (smoothstep(0., .4, uv.y) * smoothstep(.8, .1, uv.y)) * (smoothstep(.4, .6, bulge) * smoothstep(.8, .4, bulge));
    refr_b -= .2 * edge;

    refr_r *= u_refraction;
    refr_b *= u_refraction;

    vec3 w = vec3(thin_strip_1_width, thin_strip_2_width, wide_strip_ratio);
    w[1] -= .02 * smoothstep(.0, 1., edge + bulge);
    float stripe_r = mod(dir + refr_r, 1.);
    float r = get_color_channel(color1.r, color2.r, stripe_r, w, 0.02 + .03 * u_refraction * bulge, bulge);
    float stripe_g = mod(dir, 1.);
    float g = get_color_channel(color1.g, color2.g, stripe_g, w, 0.01 / (1. - diagonal), bulge);
    float stripe_b = mod(dir - refr_b, 1.);
    float b = get_color_channel(color1.b, color2.b, stripe_b, w, .01, bulge);

    color = vec3(r, g, b);
    color *= opacity;

    fragColor = vec4(color, opacity);
}
`;

  // ── Compilation ────────────────────────────────────────────────────
  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('LiquidMetal — shader:', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function buildProgram(gl) {
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.warn('LiquidMetal — link:', gl.getProgramInfoLog(p));
      return null;
    }
    // Quad plein écran
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, 'a_position');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(p);
    const uniforms = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      uniforms[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { program: p, uniforms };
  }

  // ── Champ de distance depuis une forme (texte ou image) ────────────
  // Le shader lit `img.r` comme distance au bord (0 = bord, 1 = cœur) :
  // c'est ce champ qui donne au chrome son épaisseur et son galbe.
  // L'original résout une équation de Poisson sur 300 itérations à 1000 px,
  // soit ~300 M d'opérations sur le thread principal (≈1–2 s de blocage).
  // On garde la même méthode mais bornée (voir `solveMax`/`iterations`) :
  // à l'échelle d'un mot le résultat est visuellement identique.
  function shapeToField(draw, w, h, iterations) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    draw(ctx, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;

    const N = w * h;
    const inside = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      // Transparent ou blanc pur = extérieur (même règle que l'original).
      const a = data[i * 4 + 3];
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      inside[i] = (a === 0 || (r === 255 && g === 255 && b === 255 && a === 255)) ? 0 : 1;
    }
    // Bord = pixel intérieur ayant au moins un voisin extérieur (8-voisinage).
    const boundary = new Uint8Array(N);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!inside[i]) continue;
        let edge = false;
        for (let ny = y - 1; ny <= y + 1 && !edge; ny++) {
          for (let nx = x - 1; nx <= x + 1 && !edge; nx++) {
            if (nx < 0 || nx >= w || ny < 0 || ny >= h || !inside[ny * w + nx]) edge = true;
          }
        }
        if (edge) boundary[i] = 1;
      }
    }
    // Poisson : ∇²u = -C à l'intérieur, u = 0 au bord → « colline » lissée.
    let u = new Float32Array(N), next = new Float32Array(N);
    const C = 0.01;
    const at = (arr, x, y) => (x < 0 || x >= w || y < 0 || y >= h || !inside[y * w + x]) ? 0 : arr[y * w + x];
    for (let it = 0; it < iterations; it++) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (!inside[i] || boundary[i]) { next[i] = 0; continue; }
          next[i] = (C + at(u, x + 1, y) + at(u, x - 1, y) + at(u, x, y + 1) + at(u, x, y - 1)) / 4;
        }
      }
      const t = u; u = next; next = t;
    }
    let max = 0;
    for (let i = 0; i < N; i++) if (u[i] > max) max = u[i];

    const out = ctx.createImageData(w, h);
    const alpha = 2;
    for (let i = 0; i < N; i++) {
      const v = max > 0 ? Math.pow(u[i] / max, alpha) : 0;
      const px = Math.round(255 * (1 - v));      // 0 au cœur, 255 au bord
      out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = px;
      out.data[i * 4 + 3] = inside[i] ? 255 : 0;
    }
    return out;
  }

  const DEFAULTS = {
    speed: 0.3,
    dispersion: 0.005,   // → u_refraction
    edge: 0.5,
    patternBlur: 0.005,
    liquify: 0.08,       // → u_liquid
    patternScale: 2,
    text: 'RareUI',
    imageSource: null,
    fontFamily: 'inherit',
    fontWeight: 900,
    fontSize: 180,
    solveMax: 420,       // côté max du champ de distance (coût du solveur)
    iterations: 140,     // itérations de Poisson (300 dans l'original)
    autoPause: true,     // met en pause hors écran / onglet caché
  };

  class LiquidMetal {
    constructor(target, opts) {
      this.o = Object.assign({}, DEFAULTS, opts || {});
      this.el = typeof target === 'string' ? document.querySelector(target) : target;
      if (!this.el) throw new Error('LiquidMetal : cible introuvable');
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'lm-canvas';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.el.appendChild(this.canvas);
      // Le texte reste dans le DOM pour les lecteurs d'écran et la copie :
      // le canvas n'est qu'un rendu.
      if (this.o.text && !this.el.getAttribute('aria-label')) {
        this.el.setAttribute('aria-label', this.o.text);
      }
      this._t = 0; this._last = 0; this._raf = 0; this._visible = true;
      this._init();
    }

    _init() {
      const gl = this.canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false });
      if (!gl) { this._fallback(); return; }
      const built = buildProgram(gl);
      if (!built) { this._fallback(); return; }
      this.gl = gl; this.program = built.program; this.u = built.uniforms;
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      this._resizeObs = new ResizeObserver(() => this._resize());
      this._resizeObs.observe(this.el);

      if (this.o.autoPause) {
        this._io = new IntersectionObserver(es => {
          this._visible = es.some(e => e.isIntersecting);
          this._visible ? this._wake() : this._sleep();
        }, { threshold: 0.01 });
        this._io.observe(this.el);
        this._onVis = () => (document.hidden ? this._sleep() : this._visible && this._wake());
        document.addEventListener('visibilitychange', this._onVis);
      }

      // Le champ de distance bloque le thread : on le calcule à l'inactivité.
      // MAIS `requestIdleCallback` ne se déclenche PAS dans un onglet throttlé
      // ou en arrière-plan : sans filet, le composant resterait un canvas vide
      // pour toujours. On garde donc le premier des deux qui arrive.
      let started = false;
      const start = () => {
        if (started || !this.gl) return;
        started = true;
        try { this._buildTexture(); } catch (e) { console.warn('LiquidMetal — champ de distance', e); }
        this._resize();
        this._paint();          // une image tout de suite, même onglet caché
        this._wake();           // puis l'animation, quand rAF veut bien tourner
      };
      if (window.requestIdleCallback) window.requestIdleCallback(start, { timeout: 400 });
      setTimeout(start, 300);
    }

    // Repli sans WebGL2 : on garde le texte lisible, stylé par le CSS chrome.
    _fallback() {
      this.canvas.remove();
      this.el.classList.add('lm-fallback');
      this.failed = true;
    }

    _drawShape(ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#000';
      if (this._img) {
        const r = Math.min(w / this._img.width, h / this._img.height);
        const dw = this._img.width * r, dh = this._img.height * r;
        ctx.drawImage(this._img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        return;
      }
      const fam = this.o.fontFamily === 'inherit'
        ? (getComputedStyle(this.el).fontFamily || 'sans-serif')
        : this.o.fontFamily;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Ajuste la taille pour que le mot tienne EN LARGEUR ET EN HAUTEUR.
      // L'ajustement ne portait que sur la largeur : sur un hôte très large
      // et bas, le champ de distance faisait 420×42 px pour un texte demandé
      // à 260 px — les glyphes étaient tronqués et le chrome se réduisait à
      // un moucheté magenta.
      const pad = 0.86;
      let size = Math.min(this.o.fontSize, Math.floor(h * 0.78));
      ctx.font = `${this.o.fontWeight} ${size}px ${fam}`;
      const m = ctx.measureText(this.o.text);
      if (m.width > w * pad) {
        size = Math.max(8, Math.floor(size * (w * pad) / m.width));
        ctx.font = `${this.o.fontWeight} ${size}px ${fam}`;
      }
      ctx.fillText(this.o.text, w / 2, h / 2);
    }

    _buildTexture() {
      const gl = this.gl; if (!gl) return;
      const r = this.el.getBoundingClientRect();
      // Un hôte qui n'a pas encore de mise en page (monté dans une vue
      // masquée) renvoie 0×0 : on note qu'il faudra refaire le champ, sinon
      // il resterait taillé pour un ratio arbitraire et le mot sortirait
      // écrasé — le ResizeObserver s'en charge (voir _resize).
      const ratio = (r.width && r.height) ? r.width / r.height : 3;
      this._fieldRatio = (r.width && r.height) ? ratio : 0;
      const max = this.o.solveMax;
      const w = Math.max(64, Math.min(max, Math.round(ratio >= 1 ? max : max * ratio)));
      const h = Math.max(64, Math.min(max, Math.round(ratio >= 1 ? max / ratio : max)));
      const field = shapeToField((c, cw, ch) => this._drawShape(c, cw, ch), w, h, this.o.iterations);
      this.imgRatio = w / h;

      const tex = this._tex || (this._tex = gl.createTexture());
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, field.width, field.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, field.data);
      if (this.u.u_image_texture) gl.uniform1i(this.u.u_image_texture, 0);
      this.ready = true;
    }

    _resize() {
      const gl = this.gl; if (!gl) return;
      const r = this.el.getBoundingClientRect();
      // Le champ de distance est taillé pour UN aspect. S'il a été construit
      // avant que l'hôte ait sa mise en page (ou si l'élément change de
      // proportions), il faut le refaire : le ResizeObserver n'appelait que
      // `_resize`, et le mot restait déformé pour toute la session.
      if (this.ready && r.width && r.height && !this._refielding) {
        const now = r.width / r.height;
        if (!this._fieldRatio || Math.abs(now - this._fieldRatio) / this._fieldRatio > .2) {
          this._refielding = true;
          try { this._buildTexture(); } finally { this._refielding = false; }
        }
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(r.width * dpr));
      const h = Math.max(1, Math.round(r.height * dpr));
      if (this.canvas.width === w && this.canvas.height === h) return;
      this.canvas.width = w; this.canvas.height = h;
      gl.viewport(0, 0, w, h);
      if (this.u.u_ratio) gl.uniform1f(this.u.u_ratio, w / h);
      if (this.u.u_img_ratio) gl.uniform1f(this.u.u_img_ratio, this.imgRatio || (w / h));
      // Redimensionner un canvas l'EFFACE : sans repeinture immédiate il reste
      // vide jusqu'à la prochaine frame rAF — c'est-à-dire pour toujours dans
      // un onglet caché, et le temps d'un clignotement partout ailleurs.
      this._paint();
    }

    _uniforms() {
      const gl = this.gl, u = this.u, o = this.o;
      if (u.u_edge) gl.uniform1f(u.u_edge, o.edge);
      if (u.u_patternBlur) gl.uniform1f(u.u_patternBlur, o.patternBlur);
      if (u.u_patternScale) gl.uniform1f(u.u_patternScale, o.patternScale);
      if (u.u_refraction) gl.uniform1f(u.u_refraction, o.dispersion);
      if (u.u_liquid) gl.uniform1f(u.u_liquid, o.liquify);
      if (u.u_img_ratio) gl.uniform1f(u.u_img_ratio, this.imgRatio || 3);
    }

    // Une frame, tout de suite et sans rAF. C'est ce qui permet de peindre la
    // PREMIÈRE image dès que la texture est prête : `requestAnimationFrame`
    // ne se déclenche pas dans un onglet caché (ni dans un pane d'aperçu
    // masqué), et le composant restait alors un canvas vide — le titre de
    // repli s'affichait pour toujours à la place du chrome.
    _paint() {
      const gl = this.gl; if (!gl || !this.ready) return;
      // Un canvas dégénéré ne compte PAS comme une frame peinte : l'hôte peut
      // être monté dans une vue encore en transition (largeur 0). Sans ce
      // garde-fou, `lm-painted` masquait le texte de repli et le titre
      // disparaissait purement et simplement.
      if (this.canvas.width < 8 || this.canvas.height < 8) return;
      gl.useProgram(this.program);
      this._uniforms();
      if (this.u.u_time) gl.uniform1f(this.u.u_time, this._t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // Le texte de repli ne s'effface qu'une fois une frame RÉELLEMENT peinte.
      // Sinon un shader qui n'aboutit pas (contexte perdu, GPU occupé) ferait
      // disparaître le titre : le contenu ne dépend jamais d'un effet.
      if (!this._painted) { this._painted = true; this.el.classList.add('lm-painted'); }
    }

    _frame = (now) => {
      this._raf = 0;
      if (!this.gl || !this.ready) return;   // pas de re-file : voir _wake()
      const dt = this._last ? now - this._last : 0;
      this._last = now;
      // Même intégration que l'original : le temps avance × speed.
      this._t += dt * this.o.speed;
      this._paint();
      this._wake();
    };

    // `ready` est requis : sans lui, _frame se rappelait en boucle sans jamais
    // rien dessiner (rAF qui tourne dans le vide si la texture a échoué).
    _wake() { if (!this._raf && this.ready && this._visible && !document.hidden && this.gl) this._raf = requestAnimationFrame(this._frame); }
    _sleep() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; } this._last = 0; }

    /** Met à jour les paramètres à chaud (même noms que les props RareUI). */
    set(opts) {
      const needsField = opts && (('text' in opts) || ('imageSource' in opts));
      Object.assign(this.o, opts || {});
      if (needsField && this.gl) this._buildTexture();
      this._wake();
      return this;
    }

    /** Libère le contexte GL et les observers. */
    destroy() {
      this._sleep();
      this._resizeObs && this._resizeObs.disconnect();
      this._io && this._io.disconnect();
      this._onVis && document.removeEventListener('visibilitychange', this._onVis);
      if (this.gl) {
        const lose = this.gl.getExtension('WEBGL_lose_context');
        lose && lose.loseContext();
      }
      this.canvas.remove();
      this.gl = null;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     BAKE — des PLAQUES de chrome rendues par LE MÊME shader
     ------------------------------------------------------------------
     Le problème : un canvas WebGL par bouton est impossible (les
     navigateurs plafonnent à ~16 contextes vivants et l'app affiche jusqu'à
     ~500 boutons sur une vue). La solution : rendre le shader UNE fois hors
     écran et en faire une IMAGE, que le CSS peut peindre autant de fois
     qu'il veut. Les pixels des boutons viennent donc bien du shader RareUI
     — bandes spéculaires, galbe de lentille, aberration chromatique — pour
     le prix d'un bitmap. C'est plus fidèle ET moins cher qu'un dégradé CSS
     qui essaierait de réimiter la recette.

     Ce qui est figé : le temps (u_time). Le métal d'un bouton au repos ne
     coule pas — il coule quand on le survole, et c'est la CSS qui s'en
     charge (un balayage spéculaire, cf. liquid-metal.css). Un chrome
     immobile reste du chrome ; 500 boucles rAF, non.
     ══════════════════════════════════════════════════════════════════ */

  const PLATE = {
    width: 512, height: 128,   // taille FINALE de la plaque (aspect du bouton visé)
    /* Cadre source CARRÉ, et ce n'est pas un détail : le shader fait
       `uv.x *= u_ratio`, si bien qu'au-delà du carré la moitié droite part
       très loin en uv.x — les canaux R et B s'y décalent d'une bande entière
       et le chrome devient MAGENTA. Mesuré sur un cadre 4:1 : tout le tiers
       droit était inutilisable. À ratio 1, plus aucune frange parasite. */
    srcWidth: 512, srcHeight: 512,
    /* ── POURQUOI UN RECADRAGE ──
       Ce shader est fait pour un TEXTE : le champ de distance y est une
       nervure fine, et le bombé de lentille (`bulge`, calculé sur la distance
       au CENTRE du cadre, pas sur le champ) suit la lettre. Sur une plaque
       plein cadre, ce même bombé devient un dôme géant : à l'écran, une
       tache d'huile avec des anneaux irisés concentriques — précisément ce
       qu'on ne veut pas sous un libellé. On rend donc large et on PRÉLÈVE la
       zone où les bandes sont franches et quasi parallèles (haut-droit du
       cadre), avant de l'étirer aux dimensions de la plaque. */
    /* La FORME donnée au champ de distance, en fractions du cadre source, et
       la fenêtre qu'on en prélève. Par défaut : une barre horizontale — la
       forme que ce shader sait le mieux traiter (c'est un jambage de lettre),
       et par chance exactement la forme d'un bouton. */
    shape: { x: .05, y: .40, w: .90, h: .20 },
    crop:  { x: .055, y: .395, w: .90, h: .21 },
    phase: 7000,               // u_time figé : on choisit une belle frame
    patternScale: 4,           // 2 (le défaut du composant) ne donne qu'une
                               // rampe : il faut monter pour qu'un ÉCLAT
                               // spéculaire franc traverse la barre.
    dispersion: 0.006,         // → u_refraction. Au-delà de ~.01 la frange
                               //   irisée tourne au magenta et salit le chrome.
    patternBlur: 0.004,
    edge: 0.3,
    liquify: 0,                // rendu statique : le bruit n'a rien à animer
    fieldMax: 176,             // côté max du champ de distance
    iterations: 90,
    inset: 0.02, radius: 0.5,  // la gélule qui porte le champ
    /* ── DEUX FAÇONS DE POSER LE CHROME ──
       'film'  : la plaque garde ses gris (remap lo→hi) et se pose en
                 semi-transparent. Parfait sur le verre sombre de l'acier.
       'sheen' : plaque SIGNÉE — blanc là où le chrome est clair, noir là où
                 il est sombre, TRANSPARENT au milieu. Sur un bouton coloré
                 (l'accent PRISME, le rouge du danger) c'est la seule forme
                 correcte : un film gris désaturerait la couleur et le doré
                 finirait beige. Là, la teinte du bouton traverse intacte et
                 le métal n'ajoute que de la lumière et de l'ombre.
       Les deux modes préservent la frange irisée : la couleur de sortie est
       la couleur du shader RENORMALISÉE, pas un gris neutre. */
    mode: 'film',
    lo: 0x0D, hi: 0xB0,        // 'film' : remap des niveaux
    dose: 0.6,                 // 'film' : alpha de la plaque
    /* Le pivot est HAUT : sur la plaque, la majorité des pixels est au-dessus
       de la mi-luminance, si bien qu'un pivot à 0,5 rendait presque toute la
       surface blanchâtre — le doré de l'accent finissait crème. À 0,60, seul
       l'éclat franchit le seuil : la couleur du bouton traverse. */
    pivot: 0.60,               // 'sheen' : la luminance qui ne change rien
    gain: 0.52,                // 'sheen' : force des hautes lumières
    /* Le côté SOMBRE du film signé est volontairement minuscule. Un bouton
       teinté porte un libellé SOMBRE (#08090C) : assombrir sa couleur, c'est
       attaquer directement son contraste. Mesuré : à shade .36 le pire pixel
       tombait à 2,98:1 (échec AA franc) — la profondeur du métal doit venir
       du biseau, pas d'une ombre étalée sous le texte. Sur l'acier, où le
       libellé est CLAIR, la plaque garde tous ses noirs (mode 'film'). */
    shade: 0.04,               // 'sheen' : force des ombres
    whiten: 0.62,              // 'sheen' : retour au blanc des hautes lumières
  };

  function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Rend une plaque et renvoie les pixels BRUTS du shader (RGBA prémultiplié,
  // rangées de bas en haut — c'est la convention de readPixels). Le contexte
  // GL est libéré aussitôt : on ne garde que le bitmap, donc aucun des ~16
  // contextes vivants n'est consommé durablement.
  function renderPlate(o) {
    const W = o.srcWidth || o.width, H = o.srcHeight || o.height;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const gl = cv.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) return null;
    const built = buildProgram(gl);
    if (!built) return null;
    const u = built.uniforms;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, W, H);

    // Le champ de distance d'une gélule plein cadre : c'est lui qui donne au
    // chrome son galbe (`bulge`) et sa retombée sur les bords. Résolu en
    // BASSE résolution — le champ est lisse et la texture est interpolée en
    // LINEAR, donc 176 px de côté suffisent là où l'original en prend 1000.
    const ratio = W / H;
    const fw = Math.max(48, Math.round(ratio >= 1 ? o.fieldMax : o.fieldMax * ratio));
    const fh = Math.max(48, Math.round(ratio >= 1 ? o.fieldMax / ratio : o.fieldMax));
    const field = shapeToField((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#000';
      const sh = o.shape || { x: o.inset, y: o.inset, w: 1 - 2 * o.inset, h: 1 - 2 * o.inset };
      roundRectPath(ctx, sh.x * w, sh.y * h, sh.w * w, sh.h * h, sh.h * h * o.radius);
      ctx.fill();
    }, fw, fh, o.iterations);

    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, field.width, field.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, field.data);

    gl.useProgram(built.program);
    if (u.u_image_texture) gl.uniform1i(u.u_image_texture, 0);
    if (u.u_ratio)        gl.uniform1f(u.u_ratio, ratio);
    if (u.u_img_ratio)    gl.uniform1f(u.u_img_ratio, fw / fh);
    if (u.u_patternScale) gl.uniform1f(u.u_patternScale, o.patternScale);
    if (u.u_refraction)   gl.uniform1f(u.u_refraction, o.dispersion);
    if (u.u_patternBlur)  gl.uniform1f(u.u_patternBlur, o.patternBlur);
    if (u.u_edge)         gl.uniform1f(u.u_edge, o.edge);
    if (u.u_liquid)       gl.uniform1f(u.u_liquid, o.liquify);
    if (u.u_time)         gl.uniform1f(u.u_time, o.phase);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const raw = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const lose = gl.getExtension('WEBGL_lose_context');
    lose && lose.loseContext();
    return { data: raw, width: W, height: H };
  }

  // Remap des niveaux + dose d'alpha → canvas 2D prêt à encoder.
  // Deux points de méthode :
  //  · les rangées de readPixels sont de bas en haut, on les remet d'aplomb ;
  //  · le shader écrit `color * opacity` (sortie PRÉMULTIPLIÉE) alors que le
  //    contexte est déclaré non prémultiplié — on dé-prémultiplie avant de
  //    remapper, sinon les bords translucides ressortent gris sale.
  // Le remap se fait canal par canal : la frange irisée (le décalage R/B du
  // shader) survit, seule la PLAGE est resserrée. C'est ce qui rend le film
  // utilisable sous un libellé : le chrome brut va de .10 à .98, ce qui
  // mettrait du texte à la fois sur du quasi-noir et du quasi-blanc.
  function tonePlate(shot, o) {
    const W = shot.width, H = shot.height, raw = shot.data;
    const full = document.createElement('canvas');
    full.width = W; full.height = H;
    const fctx = full.getContext('2d');
    const img = fctx.createImageData(W, H);
    const span = o.hi - o.lo, row = W * 4, sheen = o.mode === 'sheen';
    const rgb = [0, 0, 0];
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * row, dst = y * row;
      for (let x = 0; x < row; x += 4) {
        const a = raw[src + x + 3];
        const inv = a ? 255 / a : 0;
        for (let c = 0; c < 3; c++) rgb[c] = Math.min(255, raw[src + x + c] * inv);
        if (!sheen) {
          for (let c = 0; c < 3; c++) img.data[dst + x + c] = o.lo + span * (rgb[c] / 255);
          img.data[dst + x + 3] = a * o.dose;
          continue;
        }
        const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
        const t = lum - o.pivot;
        let alpha;
        if (t >= 0) {
          /* Haute lumière : on renormalise la couleur à pleine intensité pour
             garder la frange chaude/froide du shader, PUIS on la ramène vers
             le blanc. Sans ce dernier pas, une frange très saturée (un rouge
             pur, par exemple) est plus SOMBRE que la couleur du bouton : elle
             était comptée comme une lumière et assombrissait en fait le fond.
             Mesuré : le pire pixel tombait à 4,60:1 sur l'accent Psy alors que
             le côté « ombre » était pourtant réglé à 4 %. */
          const mx = Math.max(rgb[0], rgb[1], rgb[2]) || 1;
          const k = o.whiten;
          for (let c = 0; c < 3; c++) {
            const full = Math.min(255, rgb[c] * 255 / mx);
            img.data[dst + x + c] = full + (255 - full) * k;
          }
          alpha = o.gain * Math.min(1, t / Math.max(.001, 1 - o.pivot));
        } else {
          for (let c = 0; c < 3; c++) img.data[dst + x + c] = rgb[c] * .16;
          alpha = o.shade * Math.min(1, -t / Math.max(.001, o.pivot));
        }
        img.data[dst + x + 3] = a * alpha;
      }
    }
    fctx.putImageData(img, 0, 0);

    const c = o.crop || { x: 0, y: 0, w: 1, h: 1 };
    const cv = document.createElement('canvas');
    cv.width = o.width; cv.height = o.height;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(full, c.x * W, c.y * H, c.w * W, c.h * H, 0, 0, o.width, o.height);
    return cv;
  }

  /**
   * Cuit un jeu de plaques et renvoie une promesse de { nom: url }.
   * Les specs de MÊME géométrie partagent un seul rendu GL : les variantes de
   * ton (film sombre / film clair) ne coûtent qu'un remap sur le CPU.
   * Les URL sont des BLOBS et non des data URL : un data URL de 512×128
   * pèse ~30 ko de chaîne, six d'entre eux alourdiraient chaque lecture de
   * la propriété personnalisée par le moteur de style.
   */
  function bake(specs) {
    const canvases = {}, renders = new Map();
    for (const spec of specs || []) {
      const o = Object.assign({}, PLATE, spec);
      // Les specs qui partagent le rendu SOURCE ne paient qu'un remap CPU :
      // le recadrage et le ton, eux, sont propres à chaque plaque.
      const key = [o.srcWidth, o.srcHeight, o.phase, o.patternScale, o.dispersion,  // le rendu GL
                   o.patternBlur, o.edge, o.radius, JSON.stringify(o.shape)].join('/');
      if (!renders.has(key)) renders.set(key, renderPlate(o));
      const raw = renders.get(key);
      if (!raw) continue;                        // pas de WebGL2 : repli CSS
      canvases[o.name] = tonePlate(raw, o);
    }
    const urls = {};
    return Promise.all(Object.keys(canvases).map(n => new Promise(res => {
      canvases[n].toBlob(b => { if (b) urls[n] = URL.createObjectURL(b); res(); }, 'image/png');
    }))).then(() => urls);
  }

  /** Fabrique : `liquidMetal(el, { text:'MiloDex', patternScale: 2 })`. */
  function liquidMetal(target, opts) { return new LiquidMetal(target, opts); }

  LiquidMetal.bake = bake;
  LiquidMetal.PLATE = PLATE;
  // Réglage : voir le rendu du shader AVANT recadrage, pour choisir la zone.
  LiquidMetal._shoot = renderPlate;
  LiquidMetal._tone = tonePlate;
  global.LiquidMetal = LiquidMetal;
  global.liquidMetal = liquidMetal;
})(window);
