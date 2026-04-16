import {
  generateCar1, getCar1Layout, createCar1State,
  generateCar2, getCar2Layout, createCar2State,
} from './puzzleGenerator.js';

export function createGameState(seed, opts = {}) {
  const car1Config = generateCar1(seed);
  const car2Config = generateCar2(seed);
  const soloMode = !!opts.soloMode;

  return {
    seed,
    soloMode,
    currentCar: 1,
    startTime: Date.now(),
    hintsUsed: {},
    totalHintPenalty: 0,
    puzzleConfigs: {
      car1: car1Config,
      car2: car2Config,
    },
    carStates: {
      car1: createCar1State(),
      car2: createCar2State(),
    },
    puzzleLayout: {
      car1: getCar1Layout(car1Config),
      car2: getCar2Layout(car2Config),
    },
  };
}
