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
  uniform float sceneGain;
  uniform float firstCascadeIndex;
  uniform float lastCascadeIndex;
  uniform float baseRayCount;
  uniform bool bilinearFixEnabled;
  // Debug uniforms
  uniform float threshold;
  uniform float curve;
  // New: distance attenuation for ray samples
  uniform float lightDecay; // per-screen-unit decay, applied as exp(-lightDecay * distance)

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
        // Distance-based attenuation (project extension). Skip work when disabled to match vendor performance.
        if (lightDecay > 0.0001) {
          // Use accumulated ray distance (already in pixel-ish units due to stepping by df*scale)
          float attenuation = exp(-lightDecay * dist);
          sampleLight.rgb *= attenuation;
        }
        // Enhanced-only brightness compensation for emission-based scene textures
        sampleLight.rgb *= sceneGain;
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

    // Clamp requested LOD to available mip levels to avoid invalid sampling on some drivers
    float desiredLod = basePixelsBetweenProbes == 1.0 ? 0.0 : log(basePixelsBetweenProbes) / log(2.0);
    float maxLod = floor(log2(min(resolution.x, resolution.y)));
    float lod = clamp(desiredLod, 0.0, maxLod);
    upperSample = textureLod(
      lastTexture,
      upperProbePosition,
      lod
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
    this.forceFullPass = true; // false;
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

    // Vendor Parity Mode: when enabled, we mimic the vendor pipeline and parameter behavior.
    // Toggle via window.__rcVendorParity or persisted localStorage '__vendor_parity_mode' (default: true)
    try {
      if (typeof window !== 'undefined' && window.__rcVendorParity != null) {
        this.vendorParity = !!window.__rcVendorParity;
      } else {
        let persisted = null;
        try { persisted = (localStorage && localStorage.getItem('__vendor_parity_mode')) || null; } catch (_) { persisted = null; }
        if (persisted === 'on') this.vendorParity = true;
        else if (persisted === 'off') this.vendorParity = false;
        else this.vendorParity = true;
      }
    } catch (_) { this.vendorParity = true; }

    // Enhanced Mode: when enabled, we ONLY change two things vs Normal:
    // 1) Occlusion/DF seeding uses ENTITIES only (no floor),
    // 2) RC sceneTexture uses a combined FLOOR+ENTITIES surface.
    // Everything else remains identical to Normal.
    try {
      if (typeof window !== 'undefined' && window.__rcEnhanced != null) {
        this.enhancedMode = !!window.__rcEnhanced;
      } else {
        let persisted = null;
        try { persisted = (localStorage && localStorage.getItem('rc_enhanced_mode')) || null; } catch (_) { persisted = null; }
        if (persisted === 'on') this.enhancedMode = true;
        else if (persisted === 'off') this.enhancedMode = false;
        else this.enhancedMode = false; // Default: Normal mode
      }
    } catch (_) { this.enhancedMode = false; }

    // Vendor debug sliders are disabled; values are controlled via app UI (Display->Debug)
    this.srgbFalloff = 2.0; // default, overridden by renderer via ui:rc-debug-changed
    // Enhanced-only gain applied to sceneTexture sampling in RC to match vendor brightness
    try {
      const g = parseFloat(localStorage.getItem('rc_enhanced_scene_gain'));
      this.enhancedSceneGain = Number.isFinite(g) ? Math.max(0.1, Math.min(4.0, g)) : 1.6;
    } catch (_) { this.enhancedSceneGain = 1.6; }

    // Base probe spacing exponent kept; no slider (controlled externally if needed)

    this.rayIntervalValue = 1.0;

    // Base ray count controlled by this.baseRayCount (default 4.0); no slider here

    this.intervalOverlapValue = 0.1;

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
        rayInterval: this.rayIntervalValue,
        intervalOverlap: this.intervalOverlapValue,
        baseRayCount: this.baseRayCount,
        // If the sun angle slider isn't present, default to 0.0
        sunAngle: this.sunAngleSlider ? this.sunAngleSlider.value : 0.0,
        time: 0.1,
        srgb: this.srgbFalloff,
        sceneGain: 1.0,
        // Keep identical visuals across modes unless explicitly changed via UI
        lightDecay: 0.0,
        enableSun: false,
        firstCascadeIndex: 0,
        bilinearFixEnabled: this.bilinearFix ? this.bilinearFix.checked : false,
        // Debug defaults
        threshold: this.vendorParity ? 0.0 : 0.0,
        curve: this.vendorParity ? 1.0 : 1.0,
      },
      fragmentShader: rcFragmentShader,
    });

    // No vendor slider: span display disabled

    this.firstLayer = this.radianceCascades - 1;
    this.lastLayer = 0;

    // Layer selection slider removed; keep defaults via firstLayer/lastLayer

    // Cascade count slider removed; defaults set in initializeParameters()

    this.stage = 3; // no vendor stage slider

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
        fogAmount: 0.8,
        overlayGain: 1.2,
      },
      fragmentShader: `
        uniform sampler2D inputTexture;
        uniform sampler2D drawPassTexture;
        uniform vec2 resolution;
        uniform bool showSurface;
        uniform float fogAmount; // 0..1, 0 = no fog (pure surface), 1 = full lighting on glyphs
        uniform float overlayGain; // scales radiance before compositing (haze intensity)

        in vec2 vUv;
        out vec4 FragColor;

        void main() {
          vec4 rc = texture(inputTexture, vUv);
          vec4 d = texture(drawPassTexture, vUv);

          // Screen-style fog: screen(surface, overlayGain*rc) gives additive "haze" feel
          vec3 surface = d.rgb;
          vec3 rcScaled = clamp(overlayGain * rc.rgb, 0.0, 1.0);
          vec3 screenC = 1.0 - (1.0 - surface) * (1.0 - rcScaled);
          vec3 fogged = mix(surface, screenC, clamp(fogAmount, 0.0, 1.0));
          FragColor = vec4(d.a > 0.0 && showSurface ? fogged : rc.rgb, 1.0);
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

    // Fog amount controlled by Display->Debug; no vendor slider
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

    // Clamp to avoid zero-size cascade textures at extreme PPP or small windows
    this.radianceWidth = Math.max(1, Math.floor(this.renderWidth / this.basePixelsBetweenProbes));
    this.radianceHeight = Math.max(1, Math.floor(this.renderHeight / this.basePixelsBetweenProbes));

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
    // Vendor parity path: render RC directly to screen; no fog/haze or entities overlay.
    if (this.vendorParity) {
      // Ensure both samplers are valid; disable surface show flag
      this.overlayUniforms.inputTexture = inputTexture;
      this.overlayUniforms.drawPassTexture = inputTexture;
      this.overlayUniforms.showSurface = false;
      this.renderer.setRenderTarget(null);
      this.overlayRender();
      return;
    }

    // Current enhanced path: fog on FLOOR, then overlay ENTITIES
    if (!this.surfaceRenderTarget) {
      this.surfaceRenderTarget = this.renderer.createRenderTarget(
        this.width * this.scaling,
        this.height * this.scaling,
        {
          minFilter: this.gl.NEAREST,
          magFilter: this.gl.NEAREST,
          internalFormat: this.gl.RGBA,
          format: this.gl.RGBA,
          type: this.gl.UNSIGNED_BYTE,
        }
      );
    }

    this.dungeonUniforms.useOcclusionAlpha = 0.0; // visual
    this.dungeonUniforms.asciiViewTexture = this.asciiViewTexture; // FLOOR
    this.renderer.setRenderTarget(this.surfaceRenderTarget);
    this.renderer.clear();
    this.render();

    this.overlayUniforms.drawPassTexture = this.surfaceRenderTarget.texture;

    if (this.forceFullPass) {
      this.frame = 0;
    }
    const frame = this.forceFullPass ? 0 : 1 - this.frame;

    if (this.frame == 0 && !this.forceFullPass) {
      // On the first frame, always use the fresh RC texture (avoid sampling an uninitialized buffer)
      this.overlayUniforms.inputTexture = inputTexture;
      this.renderer.setRenderTarget(this.overlayRenderTargets[1]);
      this.overlayRender();
    } else {
      this.overlayUniforms.inputTexture = inputTexture;
      this.renderer.setRenderTarget(this.overlayRenderTargets[0]);
      this.overlayRender();
    }

    this.renderer.setRenderTarget(null);
    this.overlayRender();

    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.dungeonUniforms.asciiViewTexture = this.entityViewTexture; // ENTITIES
    this.render();
    gl.disable(gl.BLEND);
  }

  // Build a combined high-res emission surface (FLOOR first, then overlay ENTITIES)
  // to be used as the GI sceneTexture. This lets non-blocking floor emitters glow.
  buildEmissionSurfaceTexture() {
    if (!this.surfaceRenderTarget) {
      this.surfaceRenderTarget = this.renderer.createRenderTarget(
        this.width * this.scaling,
        this.height * this.scaling,
        {
          minFilter: this.gl.NEAREST,
          magFilter: this.gl.NEAREST,
          internalFormat: this.gl.RGBA,
          format: this.gl.RGBA,
          type: this.gl.UNSIGNED_BYTE,
        }
      );
    }

    // Render FLOOR first (no occlusion alpha)
    this.dungeonUniforms.useOcclusionAlpha = 0.0;
    this.dungeonUniforms.asciiViewTexture = this.asciiViewTexture; // FLOOR
    this.renderer.setRenderTarget(this.surfaceRenderTarget);
    this.renderer.clear();
    this.render();

    // Overlay ENTITIES into the same target so both contribute emission
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.dungeonUniforms.asciiViewTexture = this.entityViewTexture; // ENTITIES
    this.render();
    gl.disable(gl.BLEND);

    return this.surfaceRenderTarget.texture;
  }

  // Build a high-res occlusion source using ENTITIES ONLY (no floor), used to seed JFA/DF.
  buildEntityOcclusionTexture() {
    if (!this.occlusionRenderTarget) {
      this.occlusionRenderTarget = this.renderer.createRenderTarget(
        this.width * this.scaling,
        this.height * this.scaling,
        {
          minFilter: this.gl.NEAREST,
          magFilter: this.gl.NEAREST,
          internalFormat: this.gl.RGBA,
          format: this.gl.RGBA,
          type: this.gl.UNSIGNED_BYTE,
        }
      );
    }

    // Offscreen occlusion render: entities only, seeded alpha.
    // Disable emission-based seeding so FLOOR cannot leak into occlusion.
    const prevEmissionThreshold = this.dungeonUniforms.emissionThreshold;
    this.dungeonUniforms.emissionThreshold = 2.0; // effectively disables emission seeds
    this.dungeonUniforms.useOcclusionAlpha = 1.0;
    this.dungeonUniforms.asciiViewTexture = this.entityViewTexture; // ENTITIES ONLY
    this.renderer.setRenderTarget(this.occlusionRenderTarget);
    this.renderer.clear();
    this.render();
    // Restore emission threshold
    this.dungeonUniforms.emissionThreshold = prevEmissionThreshold;

    return this.occlusionRenderTarget.texture;
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
    // Enforce vendor parity core params regardless of UI state
    if (this.vendorParity && this.rcUniforms) {
      this.rcUniforms.threshold = 0.0;
      this.rcUniforms.curve = 1.0;
      this.rcUniforms.lightDecay = 0.0;
    }
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

      // Seed JFA/DF from the appropriate source
      // Normal: seed from FLOOR map; Enhanced: seed from ENTITIES only
      let seedInputTexture = this.enhancedMode
        ? this.buildEntityOcclusionTexture()
        : this.dungeonPassTextureHigh;

      let out = this.seedPass(seedInputTexture);

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
    let rcTexture = null;
    // Scene texture selection is independent from vendor parity.
    // Normal: use FLOOR-only high-res draw. Enhanced: use combined FLOOR+ENTITIES surface.
    const sceneTexture = this.enhancedMode
      ? this.buildEmissionSurfaceTexture()
      : this.dungeonPassTextureHigh;
    // Apply enhanced scene gain only in Enhanced mode
    this.rcUniforms.sceneGain = this.enhancedMode ? (this.enhancedSceneGain || 1.0) : 1.0;
    rcTexture = this.rcPass(this.distanceFieldTexture, sceneTexture);

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
