import {createId, fillPreparedMatchQueue, getMatchPlayerIds} from "./matchmaking.js";

export function addPlayerToActiveSessionState(
  currentState,
  playerToAdd,
  joinedAt = Date.now(),
) {
  if (!playerToAdd?.id) {
    return {
      ...currentState,
      statusMessage:
        "The selected player could not be found.",
    };
  }

  const playerAlreadyInSession =
    currentState.players.some(
      (player) =>
        player.id === playerToAdd.id,
    );

  if (playerAlreadyInSession) {
    return {
      ...currentState,
      statusMessage:
        `${playerToAdd.name} is already in the current session.`,
    };
  }

  const sessionPlayer = {
    id: playerToAdd.id,
    name: playerToAdd.name,

    skillLevel:
      playerToAdd.skillLevel || "Guest",

    /*
     * Returning players = true.
     * Newly typed players = false.
     */
    isDirectoryPlayer:
      playerToAdd.isDirectoryPlayer === true,

    gamesPlayed: 0,
    totalTimePlayed: 0,

    status: "available",
    waitingSince: joinedAt,
  };

  const stateWithNewSessionPlayer = {
    ...currentState,

    players: [
      ...currentState.players,
      sessionPlayer,
    ],

    waitingPlayerIds: [
      ...currentState.waitingPlayerIds,
      sessionPlayer.id,
    ],

    statusMessage:
      `${sessionPlayer.name} has joined the session and entered the waiting pool.`,
  };

  return fillPreparedMatchQueue(
    stateWithNewSessionPlayer,
  );
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
                status: "available",
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