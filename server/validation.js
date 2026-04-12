export function validatePuzzleAction(room, action, socketId) {
  const car = action.car || room.gameState.currentCar;
  if (car === 1) return validateCar1Action(room, action, socketId);
  return { valid: false, reason: 'Unknown car' };
}

function validateCar1Action(room, action, socketId) {
  const config = room.gameState.puzzleConfigs.car1;
  const state = room.gameState.carStates.car1;
  const events = [];

  switch (action.type) {
    case 'lift-seat': {
      if (state.phoneGrabbedBy) {
        return { valid: false, reason: 'Phone already found' };
      }
      const seatIdx = Number(action.seatIndex);
      if (!Number.isInteger(seatIdx) || seatIdx < 0 || seatIdx > 9) {
        return { valid: false, reason: 'Invalid seat' };
      }
      if (seatIdx !== config.phoneSeatIndex) {
        // Wrong seat — just a check, nothing underneath
        events.push({
          event: 'seat-checked',
          seatIndex: seatIdx,
          by: socketId,
          hasPhone: false,
        });
        return { valid: true, events };
      }
      // Correct seat
      if (state.seatLiftedBy && state.seatLiftedBy !== socketId) {
        return { valid: false, reason: 'Seat already held by another player' };
      }
      state.seatLiftedBy = socketId;
      events.push({
        event: 'seat-lifted',
        seatIndex: seatIdx,
        by: socketId,
        hasPhone: true,
      });
      return { valid: true, events };
    }

    case 'release-seat': {
      if (state.seatLiftedBy === socketId) {
        state.seatLiftedBy = null;
        events.push({
          event: 'seat-released',
          seatIndex: config.phoneSeatIndex,
        });
      }
      return { valid: true, events };
    }

    case 'grab-phone': {
      if (state.phoneGrabbedBy) {
        return { valid: false, reason: 'Phone already taken' };
      }
      if (!state.seatLiftedBy) {
        return { valid: false, reason: 'Seat not lifted' };
      }
      if (state.seatLiftedBy === socketId) {
        return {
          valid: false,
          reason: 'You are holding the seat — another player must grab the phone',
        };
      }
      state.phoneGrabbedBy = socketId;
      events.push({ event: 'phone-grabbed', by: socketId });
      return { valid: true, events };
    }

    case 'submit-pattern': {
      if (state.phoneGrabbedBy !== socketId) {
        return { valid: false, reason: "You don't have the phone" };
      }
      if (state.phoneUnlocked) {
        return { valid: false, reason: 'Phone already unlocked' };
      }
      const submitted = action.pattern;
      const correct = config.lockPattern;
      if (
        !Array.isArray(submitted) ||
        submitted.length !== correct.length ||
        !submitted.every((dot, i) => dot === correct[i])
      ) {
        events.push({ event: 'pattern-wrong', to: socketId });
        return { valid: true, events };
      }
      state.phoneUnlocked = true;
      // Send unlock data to the phone holder only
      events.push({
        event: 'phone-unlocked',
        to: socketId,
        phoneCodePart: config.phoneCodePart,
        compartmentSection: config.compartmentSection,
        compartmentSide: config.compartmentSide,
        targetTag: config.targetTag,
      });
      // Broadcast that the phone was unlocked (no secret data)
      events.push({ event: 'phone-unlocked-broadcast' });
      return { valid: true, events };
    }

    case 'enter-code': {
      if (!state.phoneUnlocked) {
        return { valid: false, reason: 'Phone not unlocked yet' };
      }
      if (state.compartmentOpen) {
        return { valid: false, reason: 'Compartment already open' };
      }
      const compIdx = Number(action.compartmentIndex);
      if (compIdx !== config.compartmentIndex) {
        events.push({ event: 'wrong-compartment', to: socketId });
        return { valid: true, events };
      }
      if (action.code !== config.code) {
        events.push({ event: 'code-wrong', to: socketId });
        return { valid: true, events };
      }
      state.compartmentOpen = true;
      events.push({
        event: 'compartment-opened',
        compartmentIndex: config.compartmentIndex,
      });
      return { valid: true, events };
    }

    case 'take-keycard': {
      if (!state.compartmentOpen) {
        return { valid: false, reason: 'Compartment not open' };
      }
      if (state.keycardTaken) {
        return { valid: false, reason: 'Keycard already taken' };
      }
      state.keycardTaken = true;
      state.keycardHolder = socketId;
      events.push({ event: 'keycard-taken', by: socketId });
      return { valid: true, events };
    }

    case 'swipe-keycard': {
      if (!state.keycardTaken) {
        return { valid: false, reason: 'No keycard' };
      }
      if (state.keycardHolder !== socketId) {
        return { valid: false, reason: "You don't have the keycard" };
      }
      if (state.doorSwiped) {
        return { valid: false, reason: 'Door already unlocked' };
      }
      state.doorSwiped = true;
      state.completed = true;
      events.push({ event: 'door-unlocked' });
      events.push({ event: 'car-completed', car: 1 });
      return { valid: true, events };
    }

    default:
      return { valid: false, reason: 'Unknown action type' };
  }
}

export function getCar1Hints(config, state, tier) {
  // Hints adapt to current puzzle progress
  if (!state.phoneGrabbedBy) {
    switch (tier) {
      case 1:
        return "Listen carefully... there's a buzzing sound somewhere in this car. Follow your ears.";
      case 2:
        return `Check under the seats on the ${config.phoneSide === 0 ? 'left' : 'right'} side. One player needs to lift the seat while another reaches underneath.`;
      case 3:
        return `The phone is under seat section ${config.phoneSection + 1} on the ${config.phoneSide === 0 ? 'left' : 'right'} side. One player presses E on the seat to lift it, then a DIFFERENT player presses E on the phone.`;
    }
  } else if (!state.phoneUnlocked) {
    switch (tier) {
      case 1:
        return 'Look at the windows on the opposite side of the car from where you found the phone. Something is scratched into the glass.';
      case 2:
        return `There are scratch marks on a window on the ${config.scratchSide === 0 ? 'left' : 'right'} side that form the unlock pattern. Have someone describe it to the phone holder.`;
      case 3:
        return `The pattern is: ${config.lockPattern.join(' -> ')} on the 3x3 grid (0=top-left, 2=top-right, 6=bottom-left, 8=bottom-right).`;
    }
  } else if (!state.compartmentOpen) {
    switch (tier) {
      case 1:
        return "The texts mention a compartment with a colored tag. Look for overhead compartments and find the one that matches. You'll need info from both the phone and the compartment sticker.";
      case 2:
        return `Find the overhead compartment with the ${config.targetTag} tag. Combine the first two digits from the phone (${config.phoneCodePart}__) with the last two digits on the compartment's sticker.`;
      case 3:
        return `Full code is ${config.code}. Enter it at the ${config.targetTag}-tagged compartment (section ${config.compartmentSection + 1}, ${config.compartmentSide === 0 ? 'left' : 'right'} side).`;
    }
  } else if (!state.doorSwiped) {
    switch (tier) {
      case 1:
        return 'Take what you found in the compartment to the front door of the car.';
      case 2:
        return 'Grab the keycard from the open compartment and swipe it on the card reader next to the front door.';
      case 3:
        return 'Pick up the keycard (press E on the compartment), then press E on the card reader by the front door.';
    }
  }
  return "You've completed this car's puzzle!";
}

export function handleCar1Disconnect(room, socketId, io, code) {
  const state = room.gameState.carStates.car1;
  const config = room.gameState.puzzleConfigs.car1;
  if (!state) return;

  if (state.seatLiftedBy === socketId) {
    state.seatLiftedBy = null;
    io.to(code).emit('puzzle-update', {
      car: 1,
      event: 'seat-released',
      seatIndex: config.phoneSeatIndex,
    });
  }
  if (state.phoneGrabbedBy === socketId && !state.phoneUnlocked) {
    state.phoneGrabbedBy = null;
    io.to(code).emit('puzzle-update', { car: 1, event: 'phone-dropped' });
  }
  if (state.keycardHolder === socketId && !state.doorSwiped) {
    state.keycardHolder = null;
    state.keycardTaken = false;
    io.to(code).emit('puzzle-update', { car: 1, event: 'keycard-dropped' });
  }
}
