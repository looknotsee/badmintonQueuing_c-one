import {createId, fillPreparedMatchQueue} from "./matchmaking.js";

export function getPlayerRegistrationError(players, playerName) {
  const trimmedName = playerName.trim();

  if (!trimmedName) {
    return "Enter a player name before registering.";
  }

  const duplicatePlayerExists = players.some(
    (player) =>
      player.name.trim().toLowerCase() === trimmedName.toLowerCase(),
  );

  if (duplicatePlayerExists) {
    return `${trimmedName} is already registered.`;
  }

  return null;
}

export function registerPlayerState(
  currentState,
  {
    name,
    skillLevel,
    registeredAt = Date.now(),
  },
) {
  const trimmedName = name.trim();

  const newPlayer = {
    id: createId("player"),
    name: trimmedName,
    skillLevel,
    gamesPlayed: 0,
    totalTimePlayed: 0,
    status: "queued",
    waitingSince: registeredAt,
  };

  const stateWithNewPlayer = {
    ...currentState,

    players: [
      ...currentState.players,
      newPlayer,
    ],

    waitingPlayerIds: [
      ...currentState.waitingPlayerIds,
      newPlayer.id,
    ],

    statusMessage:
      `${newPlayer.name} was registered and added to the waiting pool.`,
  };

  return fillPreparedMatchQueue(stateWithNewPlayer);
}