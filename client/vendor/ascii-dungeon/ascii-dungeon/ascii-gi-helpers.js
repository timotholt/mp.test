const prefix = `#version 300 es
precision highp float;
precision highp int;
`;

// Size of each character tile in the font atlas (width, height)
const TILE_SIZE = [8, 8];

// Vertex Shader (shared by both passes)
const vertexShaderDefault = `${prefix}
in vec2 position;
out vec2 vUv;
void main() {
    vUv = 0.5 * (position + 1.0);
    gl_Position = vec4(position, 0.0, 1.0);
}`;

class Pass {
  constructor(w, quad, materialProperties) {
    const {fragmentShader, vertexShader, uniforms, name} = materialProperties;
    this.vertexShader = vertexShader ?? vertexShaderDefault;
    this.fragmentShader = fragmentShader;
    this.program = w.createProgram(
      this.vertexShader,
      `${prefix}${this.fragmentShader}`
    );
    this.uniforms = uniforms;
    this.quad = quad;
    this.name = name;
    w.programs.set(name, this.program);
    this.w = w;
  }

  updateFragmentShader(fragmentShader) {
    this.fragmentShader = fragmentShader;
    this.program = this.w.createProgram(
      this.vertexShader,
      `${prefix}${this.fragmentShader}`
    );
    this.w.programs.set(this.name, this.program);
  }

  set(updates) {
    Object.keys(updates).forEach((key) => {
      this.uniforms[key] = updates[key];
    });
  }

  render(overrides = {}) {
    this.w.render(
      this.name,
      {
        ...this.uniforms,
        ...overrides
      },
      {position: this.quad},
    );
  }
}

class Pipeline {
  constructor(w, quad) {
    this.w = w;
    this.quad = quad;
    this.passes = {};
  }

  createPass(materialProperties) {
    const {name} = materialProperties;
    const passName = `pass-${Object.keys(this.passes).length}:-${name ?? ""}`;
    const pass = new Pass(
      this.w,
      this.quad,
      {
        ...materialProperties,
        name: passName,
      },
    );
    this.passes[passName] = pass;
    return pass;
  }
}

class RenderTarget {
  constructor(gl, name, texture, framebuffer) {
    this.gl = gl;
    this.name = name;
    this.texture = texture;
    this.framebuffer = framebuffer;
  }

  updateFilters({minFilter, magFilter}) {
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, minFilter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, magFilter);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }
}

class WebGL2MicroLayer {
  constructor(canvas) {
    this.gl = canvas.getContext('webgl2', {antialiasing: false, alpha: false});
    if (!this.gl) {
      throw new Error('WebGL2 not supported');
    }
    const extF = this.gl.getExtension("EXT_color_buffer_float");
    const extHF = this.gl.getExtension("EXT_color_buffer_half_float");
    const extFL = this.gl.getExtension("OES_texture_float_linear");
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.BLEND);
    this.gl.disable(this.gl.SCISSOR_TEST);
    this.gl.clearDepth(1.0);
    this.gl.colorMask(true, true, true, true);

    this.programs = new Map();
    this.framebuffers = new Map();

    this.defaultRenderTargetProps = {
      minFilter: this.gl.NEAREST,
      magFilter: this.gl.NEAREST,
      internalFormat: this.gl.RGBA16F,
      format: this.gl.RGBA,
      type: this.gl.HALF_FLOAT
    };
    this.renderTargets = {};
  }

  createProgram(vertexShaderSource, fragmentShaderSource) {
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error('Unable to initialize the shader program: ' + this.gl.getProgramInfoLog(program));
    }

    return program;
  }

  addLineNumbers(source) {
    return source.split('\n').map((line, index) => `${index + 1}: ${line}`).join('\n');
  }

  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error('An error occurred compiling the shaders: ' + this.gl.getShaderInfoLog(shader) + `\n${this.addLineNumbers(source)}`);
    }

    return shader;
  }

  createTextureFromImage(path, optionsOrCb, maybeCb) {
    // Load the texture
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Fill the texture with a 1x1 black pixel as a placeholder
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

    // Back-compat signature: (path, cb) or (path, options, cb)
    let cb = null;
    let options = {};
    if (typeof optionsOrCb === 'function') {
      cb = optionsOrCb;
      options = {};
    } else {
      options = optionsOrCb || {};
      cb = (typeof maybeCb === 'function') ? maybeCb : null;
    }

    const flipY = (options.flipY !== undefined) ? !!options.flipY : true; // default matches previous behavior
    const flipX = !!options.flipX;

    // Asynchronously load an image
    const image = new Image();
    image.src = path;
    image.onload = function () {
      // Create a temporary canvas to allow optional flipping
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = image.width;
      tempCanvas.height = image.height;
      const tempCtx = tempCanvas.getContext('2d');

      // Apply optional flips
      const sx = flipX ? -1 : 1;
      const sy = flipY ? -1 : 1;
      const tx = flipX ? image.width : 0;
      const ty = flipY ? image.height : 0;
      tempCtx.setTransform(sx, 0, 0, sy, tx, ty);
      tempCtx.drawImage(image, 0, 0);

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tempCanvas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindTexture(gl.TEXTURE_2D, null);

      if (cb) {
        cb();
      }
    };

    return texture;
  }

  createRenderTarget(width, height, overrides = {}, name = undefined) {
    const {
      generateMipmaps,
      minFilter,
      magFilter,
      internalFormat,
      format,
      type
    } = {
      ...(this.defaultRenderTargetProps),
      ...overrides
    };
    const gl = this.gl;

    const renderTargetName = name ?? `rt-${Object.keys(this.renderTargets).length}`;

    const framebuffer = this.gl.createFramebuffer();
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);

    const texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);

    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, minFilter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, magFilter);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, texture, 0);
    //this.clear();

    const status = this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER);
    if (status !== this.gl.FRAMEBUFFER_COMPLETE) {
      throw new Error('Framebuffer is not complete: ' + status);
    }

    // Unbind the frame buffer and texture.
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);

    this.framebuffers.set(renderTargetName, {framebuffer, texture, width, height});
    this.renderTargets[renderTargetName] = new RenderTarget(
      this.gl, renderTargetName, texture, framebuffer
    );
    return this.renderTargets[renderTargetName];
  }

  setRenderTargetInternal(name, autoClear = true) {
    if (name === null) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    } else {
      const target = this.framebuffers.get(name);
      if (!target) {
        throw new Error(`Render target "${name}" not found`);
      }
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer);
      this.gl.viewport(0, 0, target.width, target.height);
    }
  }

  setRenderTarget(renderTarget, autoClear = true) {
    return this.setRenderTargetInternal(renderTarget?.name ?? null, autoClear);
  }

  clear() {
    // this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);
  }

  getRenderTargetTexture(name) {
    const target = this.framebuffers.get(name);
    if (!target) {
      throw new Error(`Render target "${name}" not found`);
    }
    return target.texture;
  }

  setUniform(gl, textureUnits, numUniforms, uniforms, program, name, value) {
    const location = gl.getUniformLocation(program, name);
    if (location === null) {
      // console.warn(`Uniform "${name}" not found in the shader program.`);
      return;
    }

    // Get uniform info
    let uniformInfo = null;
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info.name === name) {
        uniformInfo = info;
        break;
      }
    }

    if (!uniformInfo) {
      console.warn(`Unable to find uniform info for "${name}"`);
      return;
    }

    const {type, size} = uniformInfo;

    // Helper function to ensure array is of the correct type
    function ensureTypedArray(arr, Type) {
      return arr instanceof Type ? arr : new Type(arr);
    }

    switch (type) {
      // Scalars
      case gl.FLOAT:
        gl.uniform1f(location, value);
        break;
      case gl.INT:
      case gl.BOOL:
        gl.uniform1i(location, value);
        break;

      // Vectors
      case gl.FLOAT_VEC2:
        gl.uniform2fv(location, ensureTypedArray(value, Float32Array));
        break;
      case gl.FLOAT_VEC3:
        gl.uniform3fv(location, ensureTypedArray(value, Float32Array));
        break;
      case gl.FLOAT_VEC4:
        gl.uniform4fv(location, ensureTypedArray(value, Float32Array));
        break;
      case gl.INT_VEC2:
      case gl.BOOL_VEC2:
        gl.uniform2iv(location, ensureTypedArray(value, Int32Array));
        break;
      case gl.INT_VEC3:
      case gl.BOOL_VEC3:
        gl.uniform3iv(location, ensureTypedArray(value, Int32Array));
        break;
      case gl.INT_VEC4:
      case gl.BOOL_VEC4:
        gl.uniform4iv(location, ensureTypedArray(value, Int32Array));
        break;

      // Matrices
      case gl.FLOAT_MAT2:
        gl.uniformMatrix2fv(location, false, ensureTypedArray(value, Float32Array));
        break;
      case gl.FLOAT_MAT3:
        gl.uniformMatrix3fv(location, false, ensureTypedArray(value, Float32Array));
        break;
      case gl.FLOAT_MAT4:
        gl.uniformMatrix4fv(location, false, ensureTypedArray(value, Float32Array));
        break;

      // Sampler types
      case gl.SAMPLER_2D:
      case gl.SAMPLER_CUBE:
        const textureUnit = textureUnits.length;
        this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit);
        textureUnits.push(textureUnit);
        this.gl.bindTexture(this.gl.TEXTURE_2D, value);
        this.gl.uniform1i(location, textureUnit);


        // Can we disable this if not using mipmaps?
        // if (generateMipmaps) {
        if (value != null) {
          this.gl.generateMipmap(this.gl.TEXTURE_2D);
        }
        // }
        break;

      // Arrays
      default:
        if (type === gl.FLOAT && size > 1) {
          gl.uniform1fv(location, ensureTypedArray(value, Float32Array));
        } else if ((type === gl.INT || type === gl.BOOL) && size > 1) {
          gl.uniform1iv(location, ensureTypedArray(value, Int32Array));
        } else {
          console.warn(`Unsupported uniform type: ${type}`);
        }
        break;
    }
  }

  render(programName, uniforms = {}, attributes = {}) {
    const program = this.programs.get(programName);
    if (!program) {
      throw new Error(`Program "${programName}" not found`);
    }

    this.gl.useProgram(program);

    // Already has the font-image
    const textureUnits = [];

    const numUniforms = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS);

    for (const [name, value] of Object.entries(uniforms)) {
      this.setUniform(this.gl, textureUnits, numUniforms, uniforms, program, name, value);
    }

    for (const [name, value] of Object.entries(attributes)) {
      const location = this.gl.getAttribLocation(program, name);
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, value.buffer);
      this.gl.enableVertexAttribArray(location);
      this.gl.vertexAttribPointer(location, value.size, this.gl.FLOAT, false, 0, 0);
    }

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  createFullscreenQuad() {
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      this.gl.STATIC_DRAW
    );
    return {buffer, size: 2};
  }

  createPipeline() {
    // Create fullscreen quad
    const fullscreenQuad = this.createFullscreenQuad();

    return new Pipeline(this, fullscreenQuad);
  }
}

function webGlContext() {
  const canvas = document.createElement('canvas');
  const w = new WebGL2MicroLayer(canvas);
  const pipeline = w.createPipeline();
  return {w, canvas, pipeline};
}

function webGlInit(
  context,
  width,
  height,
  materialProperties,
  renderTargetOverrides = {},
  extra = {}
) {
  const {w, pipeline, canvas} = context;
  const dpr = extra.dpr || window.devicePixelRatio || 1;
  const scaling = dpr;
  const scale = extra.scale ? scaling : 1.0;
  const canvasScale = extra.canvasScale ?? 1.0;

  canvas.width = width * scaling;
  canvas.height = height * scaling;
  canvas.style.width = `${width * canvasScale}px`;
  canvas.style.height = `${height * canvasScale}px`;

  const renderTargetProps = {
    minFilter: w.gl.NEAREST,
    magFilter: w.gl.NEAREST,
    internalFormat: w.gl.RGBA16F,
    format: w.gl.RGBA,
    type: w.gl.HALF_FLOAT,
    ...renderTargetOverrides
  };

  const renderTargetCount = extra?.renderTargetCount ?? 2;
  const renderTargets = [];

  for (let i = 0; i < renderTargetCount; i++) {
    renderTargets.push(
      w.createRenderTarget(width * scale, height * scale, renderTargetProps)
    );
  }

  const pass = pipeline.createPass(materialProperties, renderTargetProps.generateMipmaps);

  return {
    canvas,
    render: (uniforms = {}) => {
      pass.render(uniforms);
    },
    renderTargets,
    renderer: w,
    scaling,
    uniforms: pass.uniforms,
    gl: pipeline.w.gl,
    stage: pass,
  };
}

class AsciiCanvas {
  constructor({width, height, initialColor = 'transparent'}) {
    this.isDrawing = false;
    this.currentMousePosition = {x: 0, y: 0};
    this.lastPoint = {x: 0, y: 0};
    this.currentPoint = {x: 0, y: 0};

    this.mouseMoved = false;
    this.currentColor = {r: 255, g: 255, b: 255, a: 255};
    this.width = width;
    this.height = height;

    this.initialColor = initialColor;
    this.dungeonMap = null;

    // Add color maps for character and position overrides
    this.characterColorMap = null;
    this.positionColorMap = null;

    this.onUpdateTextures = () => {
    };

    this.renderDungeon = (dungeonMap) => {
      throw new Error("Missing implementation");
    };
  }

  updateTexture() {
    this.texture.needsUpdate = true;
    this.onUpdateTextures();
  }

  setDungeonMap(dungeonMapString) {
    try {
      const lines = typeof dungeonMapString === 'string' ? dungeonMapString.split('\n').length : 0;
      console.log('[DEBUG renderer] setDungeonMap called', { chars: dungeonMapString?.length, lines, preview: (typeof dungeonMapString === 'string' ? dungeonMapString.slice(0, 80) : '') });
    } catch (_) {}
    this.dungeonMap = dungeonMapString;
    this.renderDungeon(this.dungeonMap);
  }

  // Simple utility method to get dimensions
  distance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  setColor(r, g, b, a) {
    this.currentColor = {r, g, b, a};
  }

  setCharacterColorMap(mapString) {
    try {
      this.characterColorMap = JSON.parse(mapString);
      // Only re-render if we have a dungeon map already
      if (typeof this.dungeonMap === 'string') {
        this.renderDungeon(this.dungeonMap);
      }
    } catch (error) {
      console.error("Invalid character color map JSON:", error);
    }
  }

  setPositionColorMap(mapString) {
    try {
      this.positionColorMap = JSON.parse(mapString);
      this.renderDungeon(this.dungeonMap);
    } catch (error) {
      console.error("Invalid position color map JSON:", error);
    }
  }

  clear() {
    this.dungeonMap = null;
    this.updateTexture();
  }
}

class BaseSurface {
  constructor({id, width, height, dpr, canvasScale}) {
    this.context = webGlContext();
    const {w, canvas} = this.context;
    this.w = w;
    this.gl = w.gl;
    this.renderer = w;
    this.canvas = canvas;

    this.alpha = 1.0;
    this.dpr = dpr || 1;
    this.canvasScale = canvasScale;
    this.width = width;
    this.height = height;
    // Create AsciiCanvas instance
    this.createSurface(this.width, this.height);
    this.id = id;
    this.initialized = false;
    this.initialize();
  }

  createSurface(width, height) {
    this.surface = new AsciiCanvas({width, height});
  }

  initialize() {
    // Child class should fill this out
  }

  load() {
    // Child class should fill this out
  }

  clear() {
    // Child class should fill this out
  }

  renderPass() {
    // Child class should fill this out
  }

  reset() {
    this.clear();
    this.renderPass();
    requestAnimationFrame(() => this.setHex("#fff6d3"));
  }

  buildCanvas() {
    return intializeCanvas({
      id: this.id,
      canvas: this.canvas,
      onSetColor: ({r, g, b, a}) => {
        const alpha = a == 0 ? a : this.alpha;
        this.surface.currentColor = {r, g, b, a: alpha};
        this.drawUniforms.color = [
          this.surface.currentColor.r / 255.0,
          this.surface.currentColor.g / 255.0,
          this.surface.currentColor.b / 255.0,
          alpha,
        ];
      },
      setDungeonMap: (dungeonMapString) => this.surface.setDungeonMap(dungeonMapString),
      clear: () => this.clear(),
      reset: () => this.reset(),
      ...this.canvasModifications()
    });
  }

  canvasModifications() {
    return {
      setPositionBlockMapFill: (v) => this.setPositionBlockMapFill(v),
      setBlockAt: (x, y, isBlocking) => this.setBlockAt(x, y, isBlocking),
      setEntities: (list) => this.setEntities(list),
    };
  }

  observe() {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting === true) {
        this.load();
        observer.disconnect(this.container);
      }
    });

    observer.observe(this.container);
  }

  initWebGL2({uniforms, fragmentShader, vertexShader, renderTargetOverrides, ...rest}) {
    return webGlInit(
      this.context,
      this.width,
      this.height,
      {
        uniforms,
        fragmentShader,
        vertexShader,
      },
      renderTargetOverrides ?? {}, {
        dpr: this.dpr, canvasScale: this.canvasScale || 1, ...rest,
      });
  }
}

const dungeonShader = `uniform sampler2D asciiTexture;      // The ASCII font texture atlas
  uniform sampler2D asciiViewTexture;  // The texture mapping dungeon cells to ASCII codes
  uniform sampler2D positionBlockMap;  // Map-sized mask: 1.0 blocks, 0.0 does not
  uniform float useOcclusionAlpha;     // 1.0 for offscreen (GI/DF), 0.0 for on-screen
  uniform vec2 gridSize;               // Number of visible grid cells in x,y directions
  uniform vec2 tileSize;               // Size of each character tile in the atlas (e.g. 8x8)
  uniform vec2 atlasSize;              // Size of the atlas grid (e.g. 16x16)
  uniform vec2 subTileOffset;          // Fractional offset for smooth scrolling [0-1]
  uniform float flipRow;               // 1.0 flips atlas row indexing vertically, 0.0 leaves as-is
  uniform float flipTileY;             // 1.0 flips Y within each tile, 0.0 leaves as-is

  // Camera properties
  uniform vec2 viewportSize;           // Viewport size in pixels
  uniform vec2 mapSize;                // Map size in characters
  uniform vec2 cameraPosition;         // Camera position in world coordinates

  in vec2 vUv;
  out vec4 FragColor;

  void main() {
    // Apply subtile offset for smooth scrolling
    vec2 offsetUv = vUv - subTileOffset / gridSize;

    // Calculate the grid position in viewport space
    vec2 gridPos = vec2(
      floor(offsetUv.x * gridSize.x),
      floor(offsetUv.y * gridSize.y)
    );

    // Calculate the position within the character cell
    vec2 charPos = vec2(
      fract(offsetUv.x * gridSize.x) * tileSize.x,
      fract(offsetUv.y * gridSize.y) * tileSize.y
    );

    // Convert viewport grid position to map grid position
    vec2 mapGridPos = gridPos + cameraPosition / tileSize;

    // Check if the current position is within the map bounds
    if (mapGridPos.x < 0.0 || mapGridPos.x >= mapSize.x ||
        mapGridPos.y < 0.0 || mapGridPos.y >= mapSize.y) {
      // Outside the map bounds, render nothing (transparent)
      FragColor = vec4(0.0, 0.0, 0.0, 0.0);
      return;
    }

    // Normalize map grid position for texture lookup
    vec2 viewTexCoord = vec2(
      mapGridPos.x / mapSize.x,
      mapGridPos.y / mapSize.y
    );

    // Clamp to avoid sampling outside the texture
    viewTexCoord = clamp(viewTexCoord, vec2(0.0),
                    vec2(1.0 - 1.0/mapSize.x, 1.0 - 1.0/mapSize.y));

    // Sample the ASCII view texture to get character code and color
    vec4 asciiView = texture(asciiViewTexture, viewTexCoord);

    // Extract character code from alpha channel
    float charCode = asciiView.a * 255.0;

    // Calculate the atlas texture size in pixels
    vec2 atlasTextureSize = atlasSize * tileSize;

    // Compute atlas column/row and apply configurable flips
    float idx = floor(charCode + 0.5);
    float col = mod(idx, atlasSize.x);
    float row = floor(idx / atlasSize.x);
    float rowIndex = (flipRow > 0.5) ? (atlasSize.y - 1.0 - row) : row;
    float yInTile = (flipTileY > 0.5) ? (tileSize.y - 1.0 - charPos.y) : charPos.y;
    vec2 atlasUv = (vec2(col, rowIndex) * tileSize + vec2(charPos.x, yInTile)) / atlasTextureSize;

    // Sample the character from the atlas
    vec4 char = texture(asciiTexture, atlasUv);

    // Position-level blocking flag (tile granularity)
    float posBlock = texture(positionBlockMap, viewTexCoord).r; // 0..1
    // Pixel-accurate occlusion uses glyph alpha gated by position flag
    float occAlpha = char.a * posBlock;
    // On-screen visuals should remain opaque where glyph exists; GI uses occAlpha
    float outA = mix(char.a, occAlpha, clamp(useOcclusionAlpha, 0.0, 1.0));

    // Output the character with the color from asciiViewTexture
    if (char.a > 0.0 || outA > 0.0) {
      FragColor = vec4(char.rgb * asciiView.rgb, outA);
    } else {
      FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
  }`;

class DungeonRenderer extends BaseSurface {
  initializeDungeonSurface() {
    // Initialize camera with floating point positions
    this.camera = {
      x: 2.0,            // Camera position in dungeon coordinates (float)
      y: 2.0,
      zoomLevel: 2.0,    // Zoom level (1.0 = default view)
      isDragging: false, // Flag for drag state
      lastMouseX: 0,     // Last mouse position for drag calculation
      lastMouseY: 0,
      subtileOffsetX: 0.0, // Fractional offset for smooth scrolling [0-1)
      subtileOffsetY: 0.0  // Only used for shader sampling
    };

    const props = this.initWebGL2({
      uniforms: {
        asciiTexture: null,
        asciiViewTexture: null,
        positionBlockMap: null,
        useOcclusionAlpha: 1.0,
        gridSize: [0, 0],                           // Will be calculated based on camera and viewport
        tileSize: TILE_SIZE,
        atlasSize: [16, 16],
        subTileOffset: [0, 0],
        flipRow: 1.0,                               // Default to current behavior (row flip)
        flipTileY: 0.0,                             // Default: no flip within tile Y
        // Camera properties
        viewportSize: [this.width, this.height],    // Current viewport size in pixels
        mapSize: [0, 0],                            // Will be set in updateAsciiViewTexture
        cameraPosition: [0, 0],                     // Camera position
      },
      renderTargetOverrides: {
        minFilter: this.gl.NEAREST_MIPMAP_NEAREST,
        magFilter: this.gl.NEAREST,
        internalFormat: this.gl.RGBA,
        format: this.gl.RGBA,
        type: this.gl.UNSIGNED_BYTE
      },
      fragmentShader: dungeonShader,
      extra: {renderTargetCount: 2}
    });

    this.gl = props.gl;
    this.dungeonStage = props.stage;
    this.dungeonUniforms = props.uniforms;
    this.dungeonUniforms.asciiTexture = this.renderer.font;

    // Initialize a positionBlockMap texture (will be resized with the map)
    this.positionBlockMapTexture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.positionBlockMapTexture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    const initialPB = new Uint8Array(1); initialPB[0] = 255; // default block
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R8, 1, 1, 0, this.gl.RED, this.gl.UNSIGNED_BYTE, initialPB);
    this.dungeonUniforms.positionBlockMap = this.positionBlockMapTexture;

    // Implement the render dungeon method
    this.surface.renderDungeon = (dungeonMapString) => {
      // Update the ASCII view texture
      this.updateAsciiViewTexture(dungeonMapString);
      this.renderPass();
    };

    return props;
  }

  // Add camera control methods
  panCamera(deltaX, deltaY) {
    // Scale the movement based on zoom level - move faster when zoomed out, slower when zoomed in
    const zoomScaledDeltaX = deltaX / this.camera.zoomLevel;
    const zoomScaledDeltaY = deltaY / this.camera.zoomLevel;

    // Apply movement directly to the camera coordinates as floating point values
    this.camera.x += zoomScaledDeltaX;
    this.camera.y -= zoomScaledDeltaY; // Y is flipped in the coordinate system

    // Calculate subtile offset from the fractional part of camera position
    // This is only for shader display purposes
    this.camera.subtileOffsetX = this.camera.x - Math.floor(this.camera.x);
    this.camera.subtileOffsetY = this.camera.y - Math.floor(this.camera.y);

    // Ensure subtile offsets are in [0,1) range
    if (this.camera.subtileOffsetX < 0) this.camera.subtileOffsetX += 1;
    if (this.camera.subtileOffsetY < 0) this.camera.subtileOffsetY += 1;

    this.updateCameraUniforms();
    this.renderPass();
  }

  zoomCamera(factor, centerX, centerY) {
    // Calculate world coordinates before zoom
    const worldX = this.camera.x + centerX * (this.width / this.camera.zoomLevel);
    const worldY = this.camera.y + centerY * (this.height / this.camera.zoomLevel);

    // Apply zoom
    this.camera.zoomLevel *= factor;

    // Clamp zoom level to reasonable values
    this.camera.zoomLevel = Math.max(0.1, Math.min(5.0, this.camera.zoomLevel));

    // Adjust camera position to keep the point under cursor at the same place
    this.camera.x = worldX - centerX * (this.width / this.camera.zoomLevel);
    this.camera.y = worldY - centerY * (this.height / this.camera.zoomLevel);

    this.updateCameraUniforms();
    this.renderPass();

    // Update zoom display if it exists
    const zoomLevelDisplay = document.getElementById('zoomLevel');
    if (zoomLevelDisplay) {
      zoomLevelDisplay.textContent = `Zoom: ${this.camera.zoomLevel.toFixed(1)}x`;
    }
  }

  resetCamera() {
    this.camera.x = 2.0;
    this.camera.y = 2.0;
    this.camera.zoomLevel = 2.0;
    this.camera.subtileOffsetX = 0.0;
    this.camera.subtileOffsetY = 0.0;

    this.updateCameraUniforms();
    this.renderPass();

    // Update zoom display if it exists
    const zoomLevelDisplay = document.getElementById('zoomLevel');
    if (zoomLevelDisplay) {
      zoomLevelDisplay.textContent = `Zoom: ${this.camera.zoomLevel.toFixed(1)}x`;
    }
  }

  updateCameraUniforms() {
    if (this.dungeonUniforms) {
      this.dungeonUniforms.cameraPosition = [this.camera.x, this.camera.y];
      // this.dungeonUniforms.subTileOffset = [
      //   this.camera.subtileOffsetX,
      //   this.camera.subtileOffsetY
      // ];
      this.updateGridSize();
    }
  }

  updateGridSize() {
    if (!this.dungeonUniforms) return;

    // Calculate visible area based on camera zoom and position
    const tileW = (this.dungeonUniforms.tileSize && this.dungeonUniforms.tileSize[0]) || TILE_SIZE[0];
    const tileH = (this.dungeonUniforms.tileSize && this.dungeonUniforms.tileSize[1]) || TILE_SIZE[1];
    const visibleCellsX = Math.ceil(this.width / (this.camera.zoomLevel * tileW));
    const visibleCellsY = Math.ceil(this.height / (this.camera.zoomLevel * tileH));

    // Update the grid size to reflect what's currently visible in the viewport
    this.dungeonUniforms.gridSize = [visibleCellsX, visibleCellsY];
  }

  updateAsciiViewTexture(dungeonMapString) {
    // Parse the dungeon map string into a 2D array
    const dungeonMap = dungeonMapString.split('\n');

    // Idk what i'm going wrong honestly, but windows has a bunch of weird issues (floating point?)
    // Adding padding around the edges fixes them...?
    const padding = 2;

    // Get map dimensions - these are the actual dimensions of the entire dungeon
    const mapHeight = dungeonMap.length + 2 * padding;
    const mapWidth = Math.max(...dungeonMap.map(row => row.length)) + 2 * padding;

    // Store complete map dimensions
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.dungeonUniforms.mapSize = [mapWidth, mapHeight];
    try {
      console.log('[DEBUG renderer] updateAsciiViewTexture', { mapWidth, mapHeight, padding });
    } catch (_) {}

    // Create a Uint8Array to hold RGBA data for each cell (FLOOR layer)
    const data = new Uint8Array(mapWidth * mapHeight * 4);

    // Fill the texture data for the entire map
    for (let y = 0; y < mapHeight; y++) {
      const row = dungeonMap[y - padding] || ' ';
      for (let x = 0; x < mapWidth; x++) {
        // Get the character at this position
        const char = row[x - padding] ? row[x - padding] : ' ';

        // Get ASCII code of the character
        const asciiCode = char.charCodeAt(0);

        // Check if we have a position override for this x,y coordinate
        const posKey = `${x - padding},${y - padding}`;

        // Get color for this character - first check position override, then character lookup, then default map
        let color;
        if (this.surface.positionColorMap && this.surface.positionColorMap[posKey]) {
          color = this.surface.positionColorMap[posKey];
        } else if (this.surface.characterColorMap && this.surface.characterColorMap[char]) {
          color = this.surface.characterColorMap[char];
        } else {
          color = [1.0, 1.0, 1.0]; // Default to white for visibility
        }

        // Calculate index in data array
        const idx = ((mapHeight - y - 1) * mapWidth + x) * 4;

        // Set RGBA values
        data[idx] = Math.floor(color[0] * 255);     // R
        data[idx + 1] = Math.floor(color[1] * 255); // G
        data[idx + 2] = Math.floor(color[2] * 255); // B
        data[idx + 3] = asciiCode;                  // A - ASCII code
      }
    }

    // Create and initialize the FLOOR texture if it doesn't exist
    if (!this.asciiViewTexture) {
      this.asciiViewTexture = this.gl.createTexture();
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.asciiViewTexture);

    // Set texture parameters
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);

    // Upload the data to the FLOOR texture
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA8, mapWidth, mapHeight, 0,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, data
    );

    // Ensure an ENTITIES layer exists (separate from FLOOR). This layer is used as the
    // occlusion source in offscreen passes so floors stay non-blocking.
    // Allocate or resize the entity buffer/texture to match the map.
    if (!this.entityViewTexture) {
      this.entityViewTexture = this.gl.createTexture();
    }
    const needsEntityResize = (!this._entityW || !this._entityH || this._entityW !== mapWidth || this._entityH !== mapHeight);
    if (!this.entityData || needsEntityResize) {
      this._entityW = mapWidth;
      this._entityH = mapHeight;
      // RGBA per cell: rgb=color, a=ASCII code for the glyph (0 means empty)
      this.entityData = new Uint8Array(this._entityW * this._entityH * 4);
      this.entityData.fill(0); // start with no entities
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.entityViewTexture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
    // Upload current (possibly empty) entity data
    this.gl.texImage2D(
      this.gl.TEXTURE_2D, 0, this.gl.RGBA8, this._entityW, this._entityH, 0,
      this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.entityData
    );

    let pbw = this._positionBlockWidth;
    let pbh = this._positionBlockHeight;
    if (!this.positionBlockData || pbw !== mapWidth || pbh !== mapHeight) {
      // Default to ALL BLOCKING (255) to preserve prior occlusion semantics
      // until higher layers or routes explicitly mark floors as non-blocking.
      this.positionBlockData = new Uint8Array(mapWidth * mapHeight);
      this.positionBlockData.fill(255);
      this._positionBlockWidth = mapWidth;
      this._positionBlockHeight = mapHeight;
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.positionBlockMapTexture);
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R8, mapWidth, mapHeight, 0, this.gl.RED, this.gl.UNSIGNED_BYTE, this.positionBlockData);
      this.dungeonUniforms.positionBlockMap = this.positionBlockMapTexture;
    }

    this.updateCameraUniforms();

    // The viewport size will be set separately from the map size
    // Set viewportSize to the container dimensions
    this.dungeonUniforms.viewportSize = [this.width, this.height];

    // Update the grid size based on camera properties
    this.updateGridSize();
  }

  clear() {
    if (this.initialized) {
      this.renderTargets.forEach((target) => {
        this.renderer.setRenderTarget(target);
        this.renderer.clear();
      });
      if (this.renderTargetsHigh) {
        this.renderTargetsHigh.forEach((target) => {
          this.renderer.setRenderTarget(target);
          this.renderer.clear();
        });
      }
    }
    this.renderer.setRenderTarget(null);
    this.renderPass();
  }

  initialize() {
    const {
      canvas, render, renderTargets, scaling
    } = this.initializeDungeonSurface();
    this.upscaleSurface = true;
    this.canvas = canvas;
    this.render = render;
    this.renderTargets = renderTargets;
    const {container, setHex, setDungeonMap, setPositionBlockMapFill, setBlockAt, setEntities} = this.buildCanvas();
    this.container = container;
    this.setHex = setHex;
    this.setDungeonMap = setDungeonMap;
    if (typeof setPositionBlockMapFill === 'function') this.setPositionBlockMapFill = setPositionBlockMapFill;
    if (typeof setBlockAt === 'function') this.setBlockAt = setBlockAt;
    if (typeof setEntities === 'function') this.setEntities = setEntities;
    this.renderIndex = 0;

    // Initial calculation of grid size
    this.updateGridSize();

    this.innerInitialize();

    this.scaling = scaling;

    // Create high-resolution render targets for upscaling
    this.drawRenderTargetHighA = this.renderer.createRenderTarget(this.width * scaling, this.height * scaling, {
      minFilter: this.gl.NEAREST_MIPMAP_NEAREST,
      magFilter: this.gl.NEAREST,
      internalFormat: this.gl.RGBA,
      format: this.gl.RGBA,
      type: this.gl.UNSIGNED_BYTE
    });

    this.drawRenderTargetHighB = this.renderer.createRenderTarget(this.width * scaling, this.height * scaling, {
      minFilter: this.gl.NEAREST_MIPMAP_NEAREST,
      magFilter: this.gl.NEAREST,
      internalFormat: this.gl.RGBA,
      format: this.gl.RGBA,
      type: this.gl.UNSIGNED_BYTE
    });

    this.renderTargetsHigh = [this.drawRenderTargetHighA, this.drawRenderTargetHighB];
    this.renderIndexHigh = 0;

    this.observe();
  }

  innerInitialize() {
    // Child class can override this
  }

  resize(width, height, dpr = this.dpr) {
    // Preserve camera state
    const prevCamera = this.camera ? {...this.camera} : null;

    // Update dimensions
    this.width = width;
    this.height = height;
    this.dpr = dpr || this.dpr;

    // Reinitialize the base dungeon stage and its render targets without touching DOM
    const {render, renderTargets, scaling} = this.initializeDungeonSurface();
    this.render = render;
    this.renderTargets = renderTargets;
    this.scaling = scaling;

    // Recreate high-resolution upscaling targets
    this.drawRenderTargetHighA = this.renderer.createRenderTarget(this.width * scaling, this.height * scaling, {
      minFilter: this.gl.NEAREST_MIPMAP_NEAREST,
      magFilter: this.gl.NEAREST,
      internalFormat: this.gl.RGBA,
      format: this.gl.RGBA,
      type: this.gl.UNSIGNED_BYTE
    });

    this.drawRenderTargetHighB = this.renderer.createRenderTarget(this.width * scaling, this.height * scaling, {
      minFilter: this.gl.NEAREST_MIPMAP_NEAREST,
      magFilter: this.gl.NEAREST,
      internalFormat: this.gl.RGBA,
      format: this.gl.RGBA,
      type: this.gl.UNSIGNED_BYTE
    });

    this.renderTargetsHigh = [this.drawRenderTargetHighA, this.drawRenderTargetHighB];
    this.renderIndexHigh = 0;

    // Restore camera and refresh uniforms
    if (prevCamera) this.camera = prevCamera;
    if (this.dungeonUniforms) {
      this.dungeonUniforms.viewportSize = [this.width, this.height];
      this.updateCameraUniforms();
      this.updateGridSize();
    }
  }

  load() {
    try { console.log('[DEBUG renderer] load() called'); } catch (_) {}
    this.renderer.font = this.renderer.createTextureFromImage(asciiBase64, () => {
      try { console.log('[DEBUG renderer] font texture loaded, initializing example dungeon'); } catch (_) {}
      this.dungeonUniforms.asciiTexture = this.renderer.font;

      // Example dungeon map
      const exampleDungeon =
`#############################################################################
#,,,,,,,,,###~~~~~~~###########,,,,,,,,,,,,,,,###########=================##
#,,,,,,,,,,##~~~~~~~#...#ooooo#,,,,,,,^,,,,,,,#...#...#+=======+========+.#
#,,^,,,,^,,,##~~≈~~~+...#o≈≈≈o#,,,,╔══╗,,,╔══╗+...+...+=======.========+..#
#,,,,,,,,,,,##~≈≈≈~~#...#o≈☠≈o+,,,╔╝..╚═══╝..╚╗#...########+==+========+..#
#####+#+#,,,,#~~~~~~#...#o≈≈≈o#,,,║...........]#...#∞....∞#=============..#
#...###!!#,,,########+###ooooo#,,,║...^...^...║#...#......##########+######
#..&..+!!#,,,#▲...┌────────┐..#,,,╚═══════════╝#...#..☠☠☠☠☠☠..☠#...#☼...☼#
#...###!!#,,,#....│..@.....│T.+,,,####+#########...#.*.*.*.*.*..#...+.....#
##+####+##,,,#....└────────┘..#~≈≈#!!!#≡≡≡≡≡≡≡≡#...##################+#####
#≈≈≈≈≈#,,,,,^#.............D.#~≈≈+!!!+≡≡≡≡≡≡≡≡+...#∞...∞#☠...☠#.....#...⚔#
#≈≈≈≈≈#,,,,,,#...⚱...⚱...⚱...#~≈≈#!!!#≡≡≡≡☠≡≡≡#...#.....+.....+.☠...+...⚔#
#~~~~~#,,,,,,#...............###~≈#!!!#≡≡≡≡≡≡≡≡#...#.....#.....#.....#...⚔#
#~~~~~#,,,,,,#........*......#...~#####+≡≡≡≡≡≡≡#...##################⚰⚰⚰⚰#
#~~~~~#,,,,,,#..?............#....~~~~~~≡≡≡≡≡≡≡≡≡#..∞####+#.....#...........#
######+############+####+#####...~~~~~~≡≡≡≡≡≡≡≡≡+....§...+..$..#...........#
#§....┌─┐....#%..$#☼...#⚱...#...~~~~~≡≡≡≡≡≡≡≡≡≡#....#####.....#.⚰⚰⚰⚰⚰⚰⚰⚰.#
#.....│ │....#....#....#....#....~~~~≡≡≡≡≡≡≡≡≡≡≡#............☠#.⚰........⚰.#
#..τ..└─┘....+....+....#..%.#.....~~~≡≡≡≡≡≡≡≡≡≡≡########+#####+.⚰.☠⚱☠⚱☠⚱.⚰.#
#...............#....#..../.#......~~≡≡≡≡≡≡≡≡≡≡≡#.*...#.∞...∞#...⚰........⚰.#
#∞...∞#.........#...*#....∞#.......~≡≡≡≡≡≡≡≡≡≡≡+.*...+.*.*.*#...⚰⚰⚰⚰⚰⚰⚰⚰.#
###############################......≡≡≡≡≡≡≡≡≡≡≡#.*...#.*.*.*#...............#
#▓░░░░#███████#░░░░░#▓▓▓▓▓▓▓▓#.....≡≡≡≡≡≡≡≡≡≡≡≡################............⚔#
#▓░▲░░#█.....█#░...░#▓..☠..▓▓+....≡≡≡≡≡≡≡≡≡≡≡≡≡#~~~~~~~~~~~~~~~~#══════════⚔#
#▓░░░░#█..%..█#░...░#▓.....▓▓#...≡≡≡≡≡≡≡≡≡≡≡≡≡≡+~~~~~~~~~~~~~~~~+║☠☠☠⚰☠☠☠║⚔#
#▓░░░░+█.....█+░...░+▓..⚔..▓▓#..≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡#~~~~~~~~~~~~~~~~#║☠⚰☠⚰☠⚰☠║.#
#▓░░░░#███████#░...░#▓▓▓▓▓▓▓▓#.≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡#~~~~~~~~~~~~~~~~#║☠☠☠⚰☠☠☠║.#
#▓▓▓▓▓#........#░░░░░#.......≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡#~~~~~~~~~~~~~~~~#══════════.#
########################........≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡#~~~~~~~~~~~~~~~~#............#
#☥.☥.☥.☥.☥.☥.☥.☥.☥.☥#.........≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡#~~~~~~~~~~~~~~~~#............#
#.....................#..........≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡#~~~~~~~~~~~~~~~~###+########
#☥.☥.☥.☥.☥.☥.☥.☥.☥.☥#...........≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡#☯.☯.☯.☯.☯.☯.☯.☯.#
#.....................#............≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡+.................#
#☥.☥.☥.☥.☥.☥.☥.☥.☥.☥#..............≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡#☯.☯.☯.☯.☯.☯.☯.☯.#
#.....................#................≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡#+#############
#############################################################################`;

      // Only set the example dungeon if no map has been set yet (e.g., by the server)
      if (!this.surface || !this.surface.dungeonMap) {
        this.setDungeonMap(exampleDungeon);
      } else {
        try { console.log('[DEBUG renderer] load(): map already present, skipping example'); } catch (_) {}
      }
      this.initialized = true;
      try { console.log('[DEBUG renderer] load() complete, initialized=true'); } catch (_) {}
      // Ensure we draw a frame now that the font texture is ready
      try { this.renderPass(); } catch (_) {}
    });
  }

  // This is the critical method that renders the dungeon
  dungeonPass() {
    // Make sure the ASCII texture and view texture are set
    this.dungeonUniforms.asciiTexture = this.renderer.font;
    // Offscreen (GI/DF): use ENTITIES layer for occlusion glyphs (fallback to FLOOR if missing).
    // This guarantees floors never act as occluders; only entities (e.g., walls) do.
    this.dungeonUniforms.asciiViewTexture = this.entityViewTexture || this.asciiViewTexture;
    // Use occlusion alpha when rendering offscreen for GI/DF
    this.dungeonUniforms.useOcclusionAlpha = 1.0;

    // Render to the target
    this.renderIndex = 1 - this.renderIndex;
    this.renderer.setRenderTarget(this.renderTargets[this.renderIndex]);
    this.render();

    let dungeonTexture = this.renderTargets[this.renderIndex].texture;

    // Handle upscaling if needed
    if (this.upscaleSurface) {
      this.renderIndexHigh = 1 - this.renderIndexHigh;
      this.renderer.setRenderTarget(this.renderTargetsHigh[this.renderIndexHigh]);
      this.render();
      this.dungeonPassTextureHigh = this.renderTargetsHigh[this.renderIndexHigh].texture;
    } else {
      this.dungeonPassTextureHigh = dungeonTexture;
    }

    return dungeonTexture;
  }

  renderPass() {
    // Run the dungeon render pass
    this.dungeonPass();

    // Render to screen
    this.renderer.setRenderTarget(null);
    // Visual pass: draw FLOOR first (no occlusion alpha), then overlay ENTITIES
    this.dungeonUniforms.useOcclusionAlpha = 0.0;
    this.dungeonUniforms.asciiViewTexture = this.asciiViewTexture;
    this.render();
    // Overlay entities
    this.dungeonUniforms.asciiViewTexture = this.entityViewTexture;
    this.render();
  }

  // API: Fill the entire PositionBlockMap with 0 or 255
  setPositionBlockMapFill(value) {
    const v = value ? 255 : 0;
    if (!this.positionBlockData) return;
    this.positionBlockData.fill(v);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.positionBlockMapTexture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R8, this._positionBlockWidth, this._positionBlockHeight, 0, this.gl.RED, this.gl.UNSIGNED_BYTE, this.positionBlockData);
    try { this.renderPass(); } catch(_) {}
  }

  // API: Set one cell blocking/non-blocking
  setBlockAt(x, y, isBlocking) {
    if (!this.positionBlockData) return;
    const padding = 2;
    const mx = x + padding;
    const my = y + padding;
    if (mx < 0 || my < 0 || mx >= this._positionBlockWidth || my >= this._positionBlockHeight) return;
    const idx = my * this._positionBlockWidth + mx;
    this.positionBlockData[idx] = isBlocking ? 255 : 0;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.positionBlockMapTexture);
    this.gl.texSubImage2D(this.gl.TEXTURE_2D, 0, mx, my, 1, 1, this.gl.RED, this.gl.UNSIGNED_BYTE, new Uint8Array([this.positionBlockData[idx]]));
    try { this.renderPass(); } catch(_) {}
  }

  // API: Draw entities over floor visually and optionally block light per cell
  setEntities(list) {
    if (!this.entityData) return;
    const padding = 2;
    const W = this._entityW, H = this._entityH;
    // Clear entity texture to empty
    this.entityData.fill(0);
    // We do not clear PositionBlockMap here; caller should set fill(0) first for floor semantics
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e) continue;
      const mx = (e.x|0) + padding;
      const my = (e.y|0) + padding;
      if (mx < 0 || my < 0 || mx >= W || my >= H) continue;
      const idx4 = ((H - my - 1) * W + mx) * 4;
      const color = e.color && e.color.length === 3 ? e.color : [0,0,0];
      this.entityData[idx4 + 0] = Math.max(0, Math.min(255, Math.floor(color[0] * 255)));
      this.entityData[idx4 + 1] = Math.max(0, Math.min(255, Math.floor(color[1] * 255)));
      this.entityData[idx4 + 2] = Math.max(0, Math.min(255, Math.floor(color[2] * 255)));
      const code = (typeof e.char === 'string' && e.char.length > 0) ? (e.char.codePointAt(0) & 0xFF) : 32;
      this.entityData[idx4 + 3] = code;
      if (e.blocking) {
        const bIdx = my * this._positionBlockWidth + mx;
        this.positionBlockData[bIdx] = 255;
      }
    }
    // Upload entity texture
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.entityViewTexture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA8, W, H, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.entityData);
    // Upload updated block map (full upload keeps it simple)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.positionBlockMapTexture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R8, this._positionBlockWidth, this._positionBlockHeight, 0, this.gl.RED, this.gl.UNSIGNED_BYTE, this.positionBlockData);
    try { this.renderPass(); } catch(_) {}
  }
}
