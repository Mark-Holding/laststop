import * as THREE from 'three';

let audioListener = null;

export function getAudioListener(camera) {
  if (!audioListener) {
    audioListener = new THREE.AudioListener();
    camera.add(audioListener);
  }
  return audioListener;
}

export function resumeAudio() {
  if (audioListener && audioListener.context.state === 'suspended') {
    audioListener.context.resume();
  }
}
