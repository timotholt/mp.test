class JFA extends DungeonRenderer {
  innerInitialize() {
    // _should_ be ceil.
    this.passes = Math.ceil(Math.log2(Math.max(this.width, this.height))) + 1;

    const {
      stage: seedStage,
      uniforms: seedUniforms,
      render: seedRender,
      renderTargets: seedRenderTargets
    } = this.initWebGL2({
      renderTargetOverrides: (this.width > 1024 || this.height > 1024) && !isMobile
        ? {
          internalFormat: this.gl.RG32F,
          format: this.gl.RG,
          type: this.gl.FLOAT,
        } : {
          internalFormat: this.gl.RG16F,
          type: this.gl.HALF_FLOAT,
          format: this.gl.RG,
        },
      uniforms: {
        resolution: [this.width, this.height],
        surfaceTexture: null,
      },
      fragmentShader: `
        precision highp float;
        uniform sampler2D surfaceTexture;
        uniform vec2 resolution;
        out vec2 FragColor;

        in vec2 vUv;

        void main() {
          float alpha = texelFetch(surfaceTexture, ivec2(gl_FragCoord.x, gl_FragCoord.y), 0).a;
          FragColor = vUv * ceil(alpha);
        }`,
    });

    const {
      stage: jfaStage,
      uniforms: jfaUniforms,
      render: jfaRender,
      renderTargets: jfaRenderTargets
    } = this.initWebGL2({
      renderTargetOverrides: (this.width > 1024 || this.height > 1024) && !isMobile
        ? {
          internalFormat: this.gl.RG32F,
          format: this.gl.RG,
          type: this.gl.FLOAT,
        } : {
          internalFormat: this.gl.RG16F,
          type: this.gl.HALF_FLOAT,
          format: this.gl.RG,
        },
      uniforms: {
        inputTexture: null,
        resolution: [this.width, this.height],
        oneOverSize: [1.0 / this.width, 1.0 / this.height],
        uOffset: Math.pow(2, this.passes - 1),
        direction: 0,
        index: false,
        passes: this.passes,
        skip: true,
      },
      fragmentShader: `
precision highp float;
uniform vec2 oneOverSize;
uniform vec2 resolution;
uniform sampler2D inputTexture;
uniform float uOffset;
uniform int direction;
uniform bool skip;
uniform int index;
uniform int passes;

const int MAX_TILE_SIZE = 32;

const float SQRT_2 = 1.41;

in vec2 vUv;
out vec2 FragColor;

void classic() {
  if (skip) {
    FragColor = vUv;
  } else {
    vec2 nearestSeed = vec2(-1.0);
    float nearestDist = 999999.9;
    vec2 pre = uOffset * oneOverSize;

    // Start with the center to try to appeal to loading in a block
    vec2 sampleUV = vUv;

    // Check if the sample is within bounds
    vec2 sampleValue = texture(inputTexture, sampleUV).xy;
    vec2 sampleSeed = sampleValue.xy;

    if (sampleSeed.x > 0.0 || sampleSeed.y > 0.0) {
      vec2 diff = sampleSeed - vUv;
      float dist = dot(diff, diff);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestSeed.xy = sampleValue.xy;
      }
    }

    // Then do the rest
    for (float y = -1.0; y <= 1.0; y += 1.0) {
      for (float x = -1.0; x <= 1.0; x += 1.0) {
        if (x == 0.0 && y == 0.0) { continue; }
        vec2 sampleUV = vUv + vec2(x, y) * pre;

        // Check if the sample is within bounds
        if (sampleUV.x < 0.0 || sampleUV.x > 1.0 || sampleUV.y < 0.0 || sampleUV.y > 1.0) { continue; }

          vec2 sampleValue = texture(inputTexture, sampleUV).xy;
          vec2 sampleSeed = sampleValue.xy;

          if (sampleSeed.x > 0.0 || sampleSeed.y > 0.0) {
            vec2 diff = sampleSeed - vUv;
            float dist = dot(diff, diff);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestSeed.xy = sampleValue.xy;
            }
          }
      }
    }

    FragColor = nearestSeed;
  }
}

void main() {
  classic();
}
`
    });

    this.seedStage = seedStage;
    this.seedUniforms = seedUniforms;
    this.seedRender = seedRender;
    this.seedRenderTargets = seedRenderTargets;

    this.jfaStage = jfaStage;
    this.jfaUniforms = jfaUniforms;
    this.jfaRender = jfaRender;
    this.jfaRenderTargets = jfaRenderTargets;
  }

  seedPass(inputTexture) {
    this.seedUniforms.surfaceTexture = inputTexture;
    this.renderer.setRenderTarget(this.seedRenderTargets[0]);
    this.seedRender();
    return this.seedRenderTargets[0].texture;
  }

  jfaPass(inputTexture) {
    let currentInput = inputTexture;

    let [renderA, renderB] = this.jfaRenderTargets;
    let currentOutput = renderA;
    this.jfaUniforms.skip = true;
    let passes = this.passes;

    for (let i = 0; i < passes || (passes === 0 && i === 0); i++) {

      const offset = Math.pow(2, this.passes - i - 1);
      // if (offset < 2.0) continue;
      this.jfaUniforms.skip = passes === 0;
      this.jfaUniforms.inputTexture = currentInput;
      // This intentionally uses `this.passes` which is the true value
      // In order to properly show stages using the JFA slider.
      this.jfaUniforms.uOffset = offset;
      this.jfaUniforms.direction = 0;
      this.jfaUniforms.index = i;

      this.renderer.setRenderTarget(currentOutput);
      this.jfaRender();

      currentInput = currentOutput.texture;
      currentOutput = (currentOutput === renderA) ? renderB : renderA;
    }

    return currentInput;
  }

  clear() {
    if (this.initialized) {
      this.seedRenderTargets.concat(this.jfaRenderTargets).forEach((target) => {
        this.renderer.setRenderTarget(target);
        this.renderer.clear();
      });
    }
    super.clear();
  }

  renderPass() {
    let out = this.dungeonPass();
    out = this.seedPass(out);
    out = this.jfaPass(out);
    out = this.dfPass(out);
    this.renderer.setRenderTarget(null);
    this.dfRender();
  }
}
class DistanceField extends JFA {
  innerInitialize() {
    super.innerInitialize();

    const {stage: dfStage, uniforms: dfUniforms, render: dfRender, renderTargets: dfRenderTargets} = this.initWebGL2({
      uniforms: {
        resolution: [this.width, this.height],
        jfaTexture: null,
      },
      renderTargetOverrides: {
        minFilter: this.gl.NEAREST,
        magFilter: this.gl.NEAREST,
        internalFormat: this.gl.R16F,
        format: this.gl.RED,
        type: this.gl.HALF_FLOAT,
      },
      fragmentShader: `
        uniform sampler2D jfaTexture;
        uniform vec2 resolution;

        in vec2 vUv;
        out float FragColor;

        void main() {
          ivec2 texel = ivec2(vUv.x * resolution.x, vUv.y * resolution.y);
          vec2 nearestSeed = texelFetch(jfaTexture, texel, 0).xy;
          float dist = clamp(distance(vUv, nearestSeed), 0.0, 1.0);

          // Normalize and visualize the distance
          FragColor = dist;
        }`,
    });

    this.dfStage = dfStage;
    this.dfUniforms = dfUniforms;
    this.dfRender = dfRender;
    this.dfRenderTargets = dfRenderTargets;
    this.prev = 0;
    this.hasRendered = false;
  }

  clear() {
    if (this.initialized) {
      this.dfRenderTargets.forEach((target) => {
        this.renderer.setRenderTarget(target);
        this.renderer.clear();
      });
    }
    super.clear();
  }

  dfPass(inputTexture) {
    this.dfUniforms.jfaTexture = inputTexture;

    this.renderer.setRenderTarget(this.dfRenderTargets[0]);
    this.dfRender();
    return this.dfRenderTargets[0].texture;
  }

  renderPass() {
    let out = this.dungeonPass();
    out = this.seedPass(out);
    out = this.jfaPass(out);
    out = this.dfPass(out);
    this.renderer.setRenderTarget(null);
    this.dfRender();
  }
}

const rcFragmentShader = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
  #else
precision mediump float;
  #endif
uniform vec2 resolution;
  uniform sampler2D sceneTexture;
  uniform sampler2D distanceTexture;
  uniform sampler2D gradientTexture;
  uniform sampler2D lastTexture;
  uniform vec2 cascadeExtent;
  uniform float cascadeCount;
  uniform float cascadeIndex;
  uniform float basePixelsBetweenProbes;
  uniform float cascadeInterval;
  uniform float rayInterval;
  uniform float intervalOverlap;
  uniform bool addNoise;
  uniform bool enableSun;
  uniform float sunAngle;
  uniform float srgb;
  uniform float firstCascadeIndex;
  uniform float lastCascadeIndex;
  uniform float baseRayCount;
  uniform bool bilinearFixEnabled;
  // Debug uniforms
  uniform float threshold;
  uniform float curve;

  in vec2 vUv;
  out vec3 FragColor;

  const float SQRT_2 = 1.41;
  const float PI = 3.14159265;
  const float TAU = 2.0 * PI;
  const float goldenAngle = PI * 0.7639320225;
  const float sunDistance = 1.0;

  const vec3 skyColor = vec3(0.2, 0.24, 0.35) * 4.0;
  const vec3 sunColor = vec3(0.95, 0.9, 0.8) * 3.0;

  vec3 sunAndSky(float rayAngle) {
    // Get the sun / ray relative angle
    float angleToSun = mod(rayAngle - sunAngle, TAU);

    // Sun falloff
    float sunIntensity = pow(max(0.0, cos(angleToSun)), 4.0 / sunDistance);

    return mix(sunColor * sunIntensity, skyColor, 0.3);
  }

  float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec4 colorSample(sampler2D tex, vec2 uv, bool srgbSample) {
    vec4 color = texture(tex, uv);
    if (!srgbSample) {
      return color;
    }
    return vec4(pow(color.rgb, vec3(srgb)), color.a);
  }

  vec4 raymarch(vec2 rayStart, vec2 rayEnd, float scale, vec2 oneOverSize, float minStepSize) {
    vec2 rayDir = normalize(rayEnd - rayStart);
    float rayLength = length(rayEnd - rayStart);
    vec2 ratio = normalize(oneOverSize);

    vec2 rayUv = rayStart * oneOverSize;

    for (float dist = 0.0; dist < rayLength;) {
      if (any(lessThan(rayUv, vec2(0.0))) || any(greaterThan(rayUv, vec2(1.0))))
      break;

      float df = textureLod(distanceTexture, rayUv, 0.0).r;

      if (df <= minStepSize) {
        vec4 sampleLight = textureLod(sceneTexture, rayUv, 0.0);
        sampleLight.rgb = pow(sampleLight.rgb, vec3(srgb));
        // Apply threshold/curve at sample time so it participates in accumulation
        if (threshold > 0.0) {
          vec3 shifted = max(sampleLight.rgb - vec3(threshold), vec3(0.0));
          vec3 normalized = shifted / max(1.0 - threshold, 1e-6);
          float c = max(curve, 1e-4);
          sampleLight.rgb = pow(normalized, vec3(c));
        }
        return sampleLight;
      }

      dist += df * scale;
      rayUv += rayDir * (df * scale * oneOverSize);
    }

    return vec4(0.0);
  }

  vec2 getUpperCascadeTextureUv(float index, vec2 offset, float spacingBase) {
    float upperSpacing = pow(spacingBase, cascadeIndex + 1.0);
    vec2 upperSize = floor(cascadeExtent / upperSpacing);
    vec2 upperPosition = vec2(
      mod(index, upperSpacing),
      floor(index / upperSpacing)
    ) * upperSize;

    vec2 clamped = clamp(offset, vec2(0.5), upperSize - 0.5);
    return (upperPosition + clamped) / cascadeExtent;
  }

  vec4 merge(vec4 currentRadiance, float index, vec2 position, float spacingBase, vec2 localOffset) {
    // Early return conditions
    if (currentRadiance.a > 0.0 || cascadeIndex >= max(1.0, cascadeCount - 1.0)) {
      return currentRadiance;
    }

    // Calculate the position within the upper cascade cell
    vec2 offset = (position + localOffset) / spacingBase;

    vec2 upperProbePosition = getUpperCascadeTextureUv(index, (offset), spacingBase);

    // Sample from the next cascade
    vec3 upperSample = vec3(0);

    upperSample = textureLod(
      lastTexture,
      upperProbePosition,
      basePixelsBetweenProbes == 1.0 ? 0.0 : log(basePixelsBetweenProbes) / log(2.0)
    ).rgb;

    // Apply threshold/curve to upper cascade contribution as well
    if (threshold > 0.0) {
      vec3 shiftedUp = max(upperSample - vec3(threshold), vec3(0.0));
      vec3 normalizedUp = shiftedUp / max(1.0 - threshold, 1e-6);
      float cUp = max(curve, 1e-4);
      upperSample = pow(normalizedUp, vec3(cUp));
    }

    return currentRadiance + vec4(upperSample, 1.0);
  }

  void main() {
    vec2 coord = floor(vUv * cascadeExtent);

    float base = baseRayCount;
    float rayCount = pow(base, cascadeIndex + 1.0);
    float spacingBase = sqrt(baseRayCount);
    float spacing = pow(spacingBase, cascadeIndex);

    // Hand-wavy rule that improved smoothing of other base ray counts
    float modifierHack = base < 16.0 ? pow(basePixelsBetweenProbes, 1.0) : spacingBase;

    vec2 size = floor(cascadeExtent / spacing);
    vec2 probeRelativePosition = mod(coord, size);
    vec2 rayPos = floor(coord / size);

    float modifiedInterval = 1.41 * modifierHack * rayInterval * cascadeInterval;

    float start = (1.0 + cascadeIndex == 0.0 ? 0.0 : pow(base, (cascadeIndex - 1.0))) * modifiedInterval;

    float end = ((1.0 + 3.0 * intervalOverlap) * (pow(base, cascadeIndex + 0.0)) - pow(cascadeIndex, 2.0)) * modifiedInterval;

    if (cascadeIndex == cascadeCount - 1.0) {
      end = ((1.0 + 3.0 * intervalOverlap) * (pow(base, cascadeIndex + 1.0)) - pow(cascadeIndex, 2.0)) * modifiedInterval;
    }

    vec2 interval = vec2(start, end);

    vec2 probeCenter = (probeRelativePosition + 0.5) * basePixelsBetweenProbes * spacing;

    float preAvgAmt = baseRayCount;

    // Calculate which set of rays we care about
    float baseIndex = (rayPos.x + (spacing * rayPos.y)) * preAvgAmt;
    // The angle delta (how much it changes per index / ray)
    float angleStep = TAU / rayCount;

    // Can we do this instead of length?
    float scale = min(resolution.x, resolution.y);
    vec2 oneOverSize = 1.0 / resolution;
    float minStepSize = min(oneOverSize.x, oneOverSize.y) * 0.5;
    float avgRecip = 1.0 / (preAvgAmt);

    vec2 normalizedProbeCenter = probeCenter * oneOverSize;

    vec4 totalRadiance = vec4(0.0);
    float noise = addNoise ? rand(vUv * (cascadeIndex + 1.0)) : 0.0;

    vec2 factor = fract(probeCenter / spacing);


    for (int i = 0; i < int(preAvgAmt); i++) {
      float index = baseIndex + float(i);
      float angle = (index + 0.5 + noise) * angleStep;
      vec2 rayDir = vec2(cos(angle), -sin(angle));
      vec2 rayStart = probeCenter + rayDir * interval.x;

      vec4 mergedRadiance = vec4(0);
      vec4 radiances[4] = vec4[4](vec4(0), vec4(0), vec4(0), vec4(0));

      if (bilinearFixEnabled) {
        for (int j = 0; j < 4; j++) {
          // scale by resolution ratio?
          vec2 jOffset = (vec2(j % 2, j / 2));

          radiances[j] = raymarch(
            probeCenter + rayDir * interval.x,
            (floor(probeCenter / spacing) + jOffset * spacingBase - 0.5) * spacing + rayDir * interval.y,
            scale, oneOverSize, minStepSize
          );

          radiances[j] = merge(
            radiances[j],
            index,
            probeRelativePosition,
            spacingBase,
            vec2(jOffset * spacingBase - 0.5)
          );
        }

        mergedRadiance = mix(
          mix(radiances[0], radiances[1], factor.x),
          mix(radiances[2], radiances[3], factor.x),
          factor.y
        );
      } else {

        vec2 rayEnd = rayStart + rayDir * interval.y;
        vec4 raymarched = raymarch(rayStart, rayEnd, scale, oneOverSize, minStepSize);

        mergedRadiance = merge(raymarched, index, probeRelativePosition, spacingBase, vec2(0.5));
      }

      if (enableSun && cascadeIndex == cascadeCount - 1.0) {
        mergedRadiance.rgb = max(sunAndSky(angle), mergedRadiance.rgb);
      }

      totalRadiance += mergedRadiance * avgRecip;
    }

    // Output: final gamma only; threshold/curve already applied in-situ
    vec3 outColor = totalRadiance.rgb;
    FragColor = (cascadeIndex > firstCascadeIndex)
    ? outColor
    : pow(outColor, vec3(1.0 / srgb));
  }`;

class RC extends DistanceField {
  innerInitialize() {
    this.lastRequest = Date.now();
    this.frame = 0;
    this.baseRayCount = 4.0;
    this.forceFullPass = true;
    super.innerInitialize();
    this.activelyDrawing = false;
    this.rawBasePixelsBetweenProbesExponent = 0.0;
    this.rawBasePixelsBetweenProbes = Math.pow(2, this.rawBasePixelsBetweenProbesExponent);

    this.animating = false;

    this.enableNearest = document.querySelector("#enable-nearest");
    this.bilinearFix = document.querySelector("#bilinear-fix");
    this.sunAngleSlider = document.querySelector("#rc-sun-angle-slider");
    // Guard: slider may not be present in our minimal UI integration
    if (this.sunAngleSlider) {
      this.sunAngleSlider.disabled = true;
    }

    this.falloffSlider = addSlider({
      id: "falloff-slider-container",
      name: "Falloff",
      onUpdate: (value) => {
        this.rcUniforms.srgb = value;
        this.renderPass();
        return value;
      },
      options: {min: 0.0, max: 3.0, value: 2.0, step: 0.1},
    });

    this.pixelsBetweenProbes = addSlider({
      id: "radius-slider-container",
      name: "Pixels Between Base Probes",
      onUpdate: (value) => {
        this.rawBasePixelsBetweenProbes = Math.pow(2, value);
        this.initializeParameters(true);
        this.renderPass();
        return Math.pow(2, value);
      },
      options: {min: 0, max: 4, value: this.rawBasePixelsBetweenProbesExponent, step: 1},
      initialSpanValue: this.rawBasePixelsBetweenProbes,
    });

    this.rayIntervalSlider = addSlider({
      id: "radius-slider-container", name: "Interval Length", onUpdate: (value) => {
        this.rcUniforms.rayInterval = value;
        this.renderPass();
        return value;
      },
      options: {min: 1.0, max: 512.0, step: 0.1, value: 1.0},
    });

    this.baseRayCountSlider = addSlider({
      id: "radius-slider-container", name: "Base Ray Count", onUpdate: (value) => {
        this.rcUniforms.baseRayCount = Math.pow(4.0, value);
        this.baseRayCount = Math.pow(4.0, value);
        this.initializeParameters();
        this.renderPass();
        return Math.pow(4.0, value);
      },
      options: {min: 1.0, max: 3.0, step: 1.0, value: 1.0},
    });

    this.intervalOverlapSlider = addSlider({
      id: "radius-slider-container", name: "Interval Overlap %", onUpdate: (value) => {
        this.rcUniforms.intervalOverlap = value;
        this.renderPass();
        return value;
      },
      options: {min: -1.0, max: 2.0, step: 0.01, value: 0.1},
    });

    this.initializeParameters();

    const {stage: rcStage, uniforms: rcUniforms, render: rcRender, renderTargets: rcRenderTargets} = this.initWebGL2({
      renderTargetOverrides: {
        minFilter: this.gl.LINEAR_MIPMAP_LINEAR,
        magFilter: this.gl.LINEAR,
        internalFormat: this.gl.R11F_G11F_B10F,
        format: this.gl.RGB,
        type: this.gl.HALF_FLOAT
      },
      uniforms: {
        resolution: [this.width, this.height],
        sceneTexture: null,
        distanceTexture: null,
        gradientTexture: null,
        lastTexture: null,
        cascadeExtent: [this.radianceWidth, this.radianceHeight],
        cascadeCount: this.radianceCascades,
        cascadeIndex: 0.0,
        basePixelsBetweenProbes: this.basePixelsBetweenProbes,
        cascadeInterval: this.radianceInterval,
        rayInterval: this.rayIntervalSlider.value,
        intervalOverlap: this.intervalOverlapSlider.value,
        baseRayCount: Math.pow(4.0, this.baseRayCountSlider.value),
        // If the sun angle slider isn't present, default to 0.0
        sunAngle: this.sunAngleSlider ? this.sunAngleSlider.value : 0.0,
        time: 0.1,
        srgb: this.falloffSlider.value,
        enableSun: false,
        firstCascadeIndex: 0,
        bilinearFixEnabled: this.bilinearFix ? this.bilinearFix.checked : false,
        // Debug defaults
        threshold: 0.0,
        curve: 1.0,
      },
      fragmentShader: rcFragmentShader,
    });

    this.baseRayCountSlider.setSpan(Math.pow(4.0, this.baseRayCountSlider.value));

    this.firstLayer = this.radianceCascades - 1;
    this.lastLayer = 0;

    this.lastLayerSlider = addSlider({
      id: "radius-slider-container",
      name: "(RC) Layer to Render",
      onUpdate: (value) => {
        this.rcUniforms.firstCascadeIndex = value;
        this.overlayUniforms.showSurface = value == 0;
        this.lastLayer = value;
        this.renderPass();
        return value;
      },
      options: {min: 0, max: this.radianceCascades - 1, value: 0, step: 1},
    });

    this.firstLayerSlider = addSlider({
      id: "radius-slider-container",
      name: "(RC) Layer Count",
      onUpdate: (value) => {
        this.rcUniforms.cascadeCount = value;
        this.firstLayer = value - 1;
        this.renderPass();
        return value;
      },
      options: {min: 1, max: this.radianceCascades, value: this.radianceCascades, step: 1},
    });

    this.stage = 3;
    this.stageToRender = addSlider({
      id: "radius-slider-container",
      name: "Stage To Render",
      onUpdate: (value) => {
        this.stage = value;
        this.renderPass();
        return value;
      },
      options: {min: 0, max: 3, value: 3, step: 1},
    });

    const {
      stage: overlayStage,
      uniforms: overlayUniforms,
      render: overlayRender,
      renderTargets: overlayRenderTargets
    } = this.initWebGL2({
      renderTargetOverrides: {
        minFilter: this.gl.LINEAR,
        magFilter: this.gl.LINEAR,
      },
      scale: true,
      uniforms: {
        inputTexture: null,
        drawPassTexture: null,
        resolution: [this.width, this.height],
        showSurface: true,
      },
      fragmentShader: `
        uniform sampler2D inputTexture;
        uniform sampler2D drawPassTexture;
        uniform vec2 resolution;
        uniform bool showSurface;

        in vec2 vUv;
        out vec4 FragColor;

        void main() {
          vec4 rc = texture(inputTexture, vUv);
          vec4 d = texture(drawPassTexture, vUv);

          FragColor = rc;
          // FragColor = vec4(d.a > 0.0 && showSurface ? d.rgb : rc.rgb, 1.0);
        }`
    });

    this.rcStage = rcStage;
    this.rcUniforms = rcUniforms;
    this.rcRender = rcRender;
    this.rcRenderTargets = rcRenderTargets;
    this.prev = 0;

    this.overlayStage = overlayStage;
    this.overlayUniforms = overlayUniforms;
    this.overlayRender = overlayRender;
    this.overlayRenderTargets = overlayRenderTargets;
  }

  // Key parameters we care about
  initializeParameters(setUniforms) {
    this.renderWidth = this.width;
    this.renderHeight = this.height;

    // Calculate radiance cascades
    const angularSize = Math.sqrt(
      this.renderWidth * this.renderWidth + this.renderHeight * this.renderHeight
    );
    this.radianceCascades = Math.ceil(
      Math.log(angularSize) / Math.log(this.baseRayCount)
    ) + 1.0;

    if (this.lastLayerSlider) {
      const wasMax = parseInt(this.lastLayerSlider.max) === parseInt(this.lastLayerSlider.value);
      this.lastLayerSlider.max = this.radianceCascades;
      let newValue = Math.min(parseInt(this.lastLayerSlider.value), this.radianceCascades);
      if (wasMax) {
        newValue = this.radianceCascades;
      }
      this.lastLayerSlider.value = newValue.toString();
      this.lastLayerSlider.onUpdate(newValue);
    }
    if (this.firstLayerSlider) {
      const wasMax = parseInt(this.firstLayerSlider.max) === parseInt(this.firstLayerSlider.value);
      this.firstLayerSlider.max = this.radianceCascades;
      let newValue = Math.min(parseInt(this.firstLayerSlider.value), this.radianceCascades);
      if (wasMax) {
        newValue = this.radianceCascades;
      }
      this.firstLayerSlider.value = newValue.toString();
      this.firstLayerSlider.onUpdate(newValue);
    }

    this.basePixelsBetweenProbes = this.rawBasePixelsBetweenProbes;
    this.radianceInterval = 1.0;

    this.radianceWidth = Math.floor(this.renderWidth / this.basePixelsBetweenProbes);
    this.radianceHeight = Math.floor(this.renderHeight / this.basePixelsBetweenProbes);

    if (setUniforms) {
      this.rcUniforms.basePixelsBetweenProbes = this.basePixelsBetweenProbes;
      this.rcUniforms.cascadeCount = this.radianceCascades;
      this.rcUniforms.cascadeInterval = this.radianceInterval;
      this.rcUniforms.cascadeExtent = (
        [this.radianceWidth, this.radianceHeight]
      );

    }
  }

  overlayPass(inputTexture, preRc) {
    this.overlayUniforms.drawPassTexture = this.dungeonPassTextureHigh;

    if (this.forceFullPass) {
      this.frame = 0;
    }
    const frame = this.forceFullPass ? 0 : 1 - this.frame;

    if (this.frame == 0 && !this.forceFullPass) {
      const input = this.overlayRenderTargets[0].texture ?? this.dungeonPassTextureHigh;
      this.overlayUniforms.inputTexture = input;
      this.renderer.setRenderTarget(this.overlayRenderTargets[1]);
      this.overlayRender();
    } else {
      this.overlayUniforms.inputTexture = inputTexture;
      this.renderer.setRenderTarget(this.overlayRenderTargets[0]);
      this.overlayRender();
    }

    // Render directly to screen
    this.renderer.setRenderTarget(null);
    this.overlayRender();
  }

  triggerDraw() {
    this.renderPass();
  }

  canvasModifications() {
    return {
      toggleSun: (e) => {
        if (e.currentTarget.getAttribute("selected") === "true") {
          e.currentTarget.removeAttribute("selected");
        } else {
          e.currentTarget.setAttribute("selected", "true");
        }
        const current = this.rcUniforms.enableSun;
        this.sunAngleSlider.disabled = current;
        this.rcUniforms.enableSun = !current;
        this.renderPass();
      },
      zoomIn: () => {
        this.panCamera(0, 0); // Update any subtile offsets first
        this.zoomCamera(1.25, 0.5, 0.5); // Zoom in at center
      },
      zoomOut: () => {
        this.panCamera(0, 0); // Update any subtile offsets first
        this.zoomCamera(0.8, 0.5, 0.5); // Zoom out at center
      },
      resetCamera: () => {
        this.resetCamera();
      },
      panCamera: (deltaX, deltaY) => {
        this.panCamera(deltaX, deltaY);
      },
      zoomCamera: (factor, centerX, centerY) => {
        this.zoomCamera(factor, centerX, centerY);
      }
    };
  }

  rcPass(distanceFieldTexture, dungeonTexture) {
    this.rcUniforms.distanceTexture = distanceFieldTexture;
    this.rcUniforms.sceneTexture = dungeonTexture;
    this.rcUniforms.cascadeIndex = 0;

    if (this.frame == 0) {
      this.rcUniforms.lastTexture = null;
    }

    const halfway = Math.floor((this.firstLayer - this.lastLayer) / 2);
    const last = this.frame == 0 && !this.forceFullPass ? halfway + 1 : this.lastLayer;
    this.rcPassCount = this.frame == 0 ? this.firstLayer : halfway;

    for (let i = this.firstLayer; i >= last; i--) {
      this.rcUniforms.cascadeIndex = i;

      this.renderer.setRenderTarget(this.rcRenderTargets[this.prev]);
      this.rcRender();
      this.rcUniforms.lastTexture = this.rcRenderTargets[this.prev].texture;
      this.prev = 1 - this.prev;
    }

    return this.rcRenderTargets[1 - this.prev].texture;
  }

  doRenderPass() {
    if (this.frame == 0) {
      if (this.stage == 0) {
        this.renderer.setRenderTarget(null);
        this.render();
        this.finishRenderPass();
        return;
      }

      let out = this.seedPass(this.dungeonPassTextureHigh);

      out = this.jfaPass(out);

      if (this.stage == 1) {
        this.finishRenderPass();
        this.renderer.setRenderTarget(null);
        this.jfaRender();
        return;
      }

      this.distanceFieldTexture = this.dfPass(out);

      if (this.stage == 2) {
        this.finishRenderPass();
        this.renderer.setRenderTarget(null);
        this.dfRender();
        return;
      }
    }

    let rcTexture = this.rcPass(this.distanceFieldTexture, this.dungeonPassTextureHigh);

    this.overlayPass(rcTexture, false);

    this.finishRenderPass();
  }

  finishRenderPass() {
    // Update timer and potentially print results

    if (!this.forceFullPass) {
      this.frame = 1 - this.frame;
    }
  }

  renderPass() {
    this.dungeonPassTextureHigh = this.dungeonPass();

    if (!this.animating) {
      this.animating = true;
      requestAnimationFrame(() => {
        this.animate();
      });
    }
  }

  animate() {
    this.animating = true;

    this.doRenderPass();
    this.desiredRenderPass = false;

    requestAnimationFrame(() => {
      if (Date.now() - this.lastRequest > 1000) {
        this.animating = false;
        return;
      }
      this.animate();
    });
  }

  clear() {
    this.lastFrame = null;
    if (this.initialized) {
      this.rcRenderTargets.forEach((target) => {
        this.renderer.setRenderTarget(target);
        this.renderer.clear();
      });
    }
    super.clear();
  }

  load() {
    if (this.bilinearFix) {
      this.bilinearFix.addEventListener("input", () => {
        this.rcUniforms.bilinearFixEnabled = this.bilinearFix.checked;
        this.renderPass();
      });
    }
    if (this.enableNearest) {
      this.enableNearest.addEventListener("input", () => {
        this.rcRenderTargets.forEach((r) => {
          if (this.enableNearest.checked) {
            r.updateFilters({
              minFilter: this.gl.NEAREST_MIPMAP_NEAREST,
              magFilter: this.gl.NEAREST,
            });
          } else {
            r.updateFilters({
              minFilter: this.gl.LINEAR_MIPMAP_LINEAR,
              magFilter: this.gl.LINEAR,
            });
          }
          this.renderPass();
        });
      });
    }
    if (this.sunAngleSlider) {
      this.sunAngleSlider.addEventListener("input", () => {
        this.rcUniforms.sunAngle = this.sunAngleSlider.value;
        this.renderPass();
      });
    }
    super.load();
  }
}
