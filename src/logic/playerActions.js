import {createId, fillPreparedMatchQueue, getMatchPlayerIds} from "./matchmaking.js";

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

  export function removePlayerState(
    currentState,
    playerId,
    removedAt = Date.now(),
  ) {
    const playerToRemove = currentState.players.find(
      (player) => player.id === playerId,
    );

    if (!playerToRemove) {
      return {
        ...currentState,
        statusMessage: "The selected player could not be found.",
      };
    }

    const playerHasActiveMatch = currentState.activeMatches.some(
      (match) => getMatchPlayerIds(match).includes(playerId),
    );

    if (playerHasActiveMatch || playerToRemove.status === "inGame") {
      return {
        ...currentState,
        statusMessage:
          `${playerToRemove.name} is currently playing. ` +
          "End or cancel the active match before removing this player.",
      };
    }

    const affectedPreparedMatches = currentState.matchQueue.filter(
      (match) => getMatchPlayerIds(match).includes(playerId),
    );

    /*
    * When one player is removed from a prepared match,
    * the whole prepared match is cancelled. The other
    * players return individually to the waiting pool.
    */
    const releasedPlayerIds = new Set(
      affectedPreparedMatches.flatMap(getMatchPlayerIds),
    );

    releasedPlayerIds.delete(playerId);

    const remainingMatchQueue = currentState.matchQueue.filter(
      (match) => !getMatchPlayerIds(match).includes(playerId),
    );

    const waitingWithoutRemovedPlayer =
     currentState.waitingPlayerIds.filter(
        (waitingPlayerId) => waitingPlayerId !== playerId,
      );

    const releasedPlayersNotAlreadyWaiting = [
      ...releasedPlayerIds,
    ].filter(
      (releasedPlayerId) =>
        !waitingWithoutRemovedPlayer.includes(releasedPlayerId),
    );

    const stateAfterRemoval = {
      ...currentState,

      players: currentState.players
        .filter((player) => player.id !== playerId)
        .map((player) =>
         releasedPlayerIds.has(player.id)
           ? {
                ...player,
                status: "queued",
                waitingSince: removedAt,
              }
           : player,
        ),

      waitingPlayerIds: [
       ...waitingWithoutRemovedPlayer,
       ...releasedPlayersNotAlreadyWaiting,
     ],

      matchQueue: remainingMatchQueue,

     statusMessage:
        affectedPreparedMatches.length > 0
         ? `${playerToRemove.name} was removed. ` +
           "Their prepared match was cancelled, and the other players " +
           "returned to the waiting pool."
         : `${playerToRemove.name} was removed from the player pool.`,
   };

   return fillPreparedMatchQueue(stateAfterRemoval);
  }