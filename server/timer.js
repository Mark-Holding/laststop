export const STATIONS = [
  'Gravesend', 'Neptune Ave', 'Bay Pkwy', 'New Utrecht', 'Fort Hamilton',
  '36th St', 'Pacific St', 'DeKalb Ave', 'Fulton St', 'CHAMBERS ST',
];

export const TOTAL_TIME = 1800; // 30 minutes in seconds

export function startTimer(room, io) {
  const startTime = Date.now();
  const stationCount = STATIONS.length;

  room.timerState = {
    startTime,
    totalTime: TOTAL_TIME,
    elapsed: 0,
    stationIndex: 0,
    stations: STATIONS,
  };

  room.timerInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(elapsed / TOTAL_TIME, 1);
    const stationIndex = Math.min(
      Math.floor(progress * (stationCount - 1)),
      stationCount - 1
    );

    room.timerState.elapsed = elapsed;
    room.timerState.stationIndex = stationIndex;

    io.to(room.code).emit('timer-update', {
      elapsed,
      stationIndex,
    });

    if (elapsed >= TOTAL_TIME) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
      room.state = 'finished';
      io.to(room.code).emit('game-over', { won: false });
    }
  }, 1000);
}

export function stopTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}
