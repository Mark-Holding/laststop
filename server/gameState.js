import { generateCar1, getCar1Layout, createCar1State } from './puzzleGenerator.js';

export function createGameState(seed) {
  const car1Config = generateCar1(seed);

  return {
    seed,
    currentCar: 1,
    startTime: Date.now(),
    hintsUsed: {},
    puzzleConfigs: {
      car1: car1Config,
    },
    carStates: {
      car1: createCar1State(),
    },
    puzzleLayout: {
      car1: getCar1Layout(car1Config),
    },
  };
}
