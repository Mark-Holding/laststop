// Post-processing pipeline: bloom + vignette + film grain
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const VignetteGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignetteIntensity: { value: 0.35 },
    grainIntensity: { value: 0.08 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float vignetteIntensity;
    uniform float grainIntensity;
    varying vec2 vUv;

    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Vignette — darken edges for claustrophobic subway feel
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float vignette = 1.0 - smoothstep(0.3, 0.75, dist) * vignetteIntensity;
      color.rgb *= vignette;

      // Film grain — crawling noise for gritty atmosphere
      float grain = hash(vUv * 1000.0 + time * 137.0) - 0.5;
      color.rgb += grain * grainIntensity;

      gl_FragColor = color;
    }
  `,
};

export function createPostProcessing(renderer, scene, camera) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  const composer = new EffectComposer(renderer);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new UnrealBloomPass(size, 0.5, 0.4, 0.82);
  composer.addPass(bloomPass);

  const vignetteGrainPass = new ShaderPass(VignetteGrainShader);
  composer.addPass(vignetteGrainPass);

  return {
    composer,
    bloomPass,
    vignetteGrainPass,

    update(dt) {
      vignetteGrainPass.uniforms.time.value += dt;
    },

    resize(width, height) {
      composer.setSize(width, height);
    },

    render() {
      composer.render();
    },

    setTension(tension) {
      bloomPass.strength = 0.5 + tension * 0.3;
      vignetteGrainPass.uniforms.vignetteIntensity.value = 0.35 + tension * 0.2;
      vignetteGrainPass.uniforms.grainIntensity.value = 0.08 + tension * 0.06;
    },
  };
}
