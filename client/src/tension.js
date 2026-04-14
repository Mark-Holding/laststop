// Central tension escalation system
// All other systems query this for the current tension level (0-1)
// Based on timer remaining percentage and current car progress

let elapsed = 0;
let totalTime = 1800;
let currentCar = 1;

// Tension breakpoints (from game design):
// 75%+ remaining (0-25% elapsed) = level 0.0-0.25 (calm)
// 50-75% remaining (25-50% elapsed) = level 0.25-0.5 (uneasy)
// 25-50% remaining (50-75% elapsed) = level 0.5-0.75 (tense)
// Under 25% remaining (75-100% elapsed) = level 0.75-1.0 (critical)

export function updateTension(newElapsed, newTotalTime) {
  elapsed = newElapsed;
  if (newTotalTime) totalTime = newTotalTime;
}

export function setCurrentCar(car) {
  currentCar = car;
}

// Returns 0-1 tension level based on timer progress
export function getTensionLevel() {
  const progress = Math.min(elapsed / totalTime, 1);
  return progress;
}

// Returns true when in final 3 minutes
export function isFinalMinutes() {
  const remaining = totalTime - elapsed;
  return remaining <= 180;
}

// Returns remaining seconds
export function getRemainingTime() {
  return Math.max(0, totalTime - elapsed);
}

export function getElapsedTime() {
  return elapsed;
}

export function getCurrentCar() {
  return currentCar;
}

// Tension thresholds for system queries
export function getTensionPhase() {
  const level = getTensionLevel();
  if (level < 0.25) return 'calm';
  if (level < 0.5) return 'uneasy';
  if (level < 0.75) return 'tense';
  return 'critical';
}

// Get multiplier for effects (flicker rate, sway amplitude, etc.)
// Returns 1.0 at calm, up to 3.0 at critical
export function getIntensityMultiplier() {
  const level = getTensionLevel();
  return 1.0 + level * 2.0;
}
