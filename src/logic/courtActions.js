import { formatSeconds } from "../components/utils/Formatseconds";

import {
  createId,
  createPlayerMap,
  fillPreparedMatchQueue,
  getMatchPlayerIds,
  rebuildProvisionalMatchQueue
} from "./matchmaking.js";

function validateMatchStart(
  currentState,
  selectedCourt,
  selectedMatch,
) {
  if (!selectedCourt) {
    return "The selected court does not exist.";
  }

  if (selectedCourt.status !== "available") {
    return `${selectedCourt.name} is already occupied.`;
  }

  if (!selectedMatch) {
    return "The selected queued match does not exist.";
  }

  const selectedPlayerIds = getMatchPlayerIds(selectedMatch);
  const playerMap = createPlayerMap(currentState.players);

  const activePlayerIds = new Set(
    currentState.activeMatches.flatMap(getMatchPlayerIds),
  );

  const allPlayersExist = selectedPlayerIds.every((playerId) =>
    playerMap.has(playerId),
  );

  if (!allPlayersExist) {
    return "One or more players in this match no longer exist.";
  }

  const allPlayersAreQueued = selectedPlayerIds.every(
    (playerId) => playerMap.get(playerId)?.status === "queued",
  );

  if (!allPlayersAreQueued) {
    return "One or more players are not currently queued.";
  }

  const playerAlreadyInGame = selectedPlayerIds.some((playerId) =>
    activePlayerIds.has(playerId),
  );

  if (playerAlreadyInGame) {
    return "One or more players are already in another active match.";
  }

  return null;
}

export function startMatchOnCourtState(
  currentState,
  courtId,
  requestedMatchId = null,
  startedAt = Date.now(),
) {
  const selectedCourt = currentState.courts.find(
    (court) => court.id === courtId,
  );

  const selectedMatchId =
    requestedMatchId ?? currentState.matchQueue[0]?.id;

  const selectedMatch = currentState.matchQueue.find(
    (match) => match.id === selectedMatchId,
  );

  const validationMessage = validateMatchStart(
    currentState,
    selectedCourt,
    selectedMatch,
  );

  if (validationMessage) {
    return {
      ...currentState,
      statusMessage: validationMessage,
    };
  }

  const selectedPlayerIds = getMatchPlayerIds(selectedMatch);

  const stateAfterStarting = {
    ...currentState,

    courts: currentState.courts.map((court) =>
      court.id === courtId
        ? {
            ...court,
            status: "occupied",
            currentMatchId: selectedMatch.id,
          }
        : court,
    ),

    players: currentState.players.map((player) =>
      selectedPlayerIds.includes(player.id)
        ? {
            ...player,
            status: "inGame",
          }
        : player,
    ),

    matchQueue: currentState.matchQueue.filter(
      (match) => match.id !== selectedMatch.id,
    ),

    activeMatches: [
      ...currentState.activeMatches,
      {
        ...selectedMatch,
        courtId,
        startedAt,
      },
    ],

    statusMessage: `${selectedCourt.name} started a match.`,
  };

  return fillPreparedMatchQueue(stateAfterStarting);
}

export function endMatchOnCourtState(
  currentState,
  courtId,
  endedAt = Date.now(),
) {
  const selectedCourt = currentState.courts.find(
    (court) => court.id === courtId,
  );

  const activeMatch = currentState.activeMatches.find(
    (match) => match.id === selectedCourt?.currentMatchId,
  );

  if (!selectedCourt || !activeMatch) {
    return {
      ...currentState,
      statusMessage: "No active match was found on that court.",
    };
  }

  const matchDuration = Math.max(
    1,
    Math.floor((endedAt - activeMatch.startedAt) / 1000),
  );

  const matchPlayerIds = getMatchPlayerIds(activeMatch);

  const completedMatch = {
    id: createId("completed"),
    sourceMatchId: activeMatch.id,
    courtId,
    teamOne: activeMatch.teamOne,
    teamTwo: activeMatch.teamTwo,
    startedAt: activeMatch.startedAt,
    endedAt,
    durationSeconds: matchDuration,
  };

  const stateAfterEnding = {
    ...currentState,

    players: currentState.players.map((player) =>
      matchPlayerIds.includes(player.id)
        ? {
            ...player,
            status: "available",
            gamesPlayed: player.gamesPlayed + 1,
            totalTimePlayed:
              player.totalTimePlayed + matchDuration,
            waitingSince: endedAt,
          }
        : player,
    ),

    courts: currentState.courts.map((court) =>
      court.id === courtId
        ? {
            ...court,
            status: "available",
            currentMatchId: null,
          }
        : court,
    ),

    waitingPlayerIds: [
      ...currentState.waitingPlayerIds,
      ...matchPlayerIds.filter(
        (playerId) =>
          !currentState.waitingPlayerIds.includes(playerId),
      ),
    ],

    activeMatches: currentState.activeMatches.filter(
      (match) => match.id !== activeMatch.id,
    ),

    completedMatches: [
      ...currentState.completedMatches,
      completedMatch,
    ],

    statusMessage:
      `${selectedCourt.name} ended the match after ` +
      `${formatSeconds(matchDuration)}. ` +
      "The players returned to the waiting pool.",
  };

  return rebuildProvisionalMatchQueue(stateAfterEnding);
}

export function cancelMatchOnCourtState(
  currentState,
  courtId,
  cancelledAt = Date.now(),
) {
  const selectedCourt = currentState.courts.find(
    (court) => court.id === courtId,
  );

  const activeMatch = currentState.activeMatches.find(
    (match) => match.id === selectedCourt?.currentMatchId,
  );

  if (!selectedCourt || !activeMatch) {
    return {
      ...currentState,
      statusMessage: "No active match was found to cancel.",
    };
  }

  const matchPlayerIds = getMatchPlayerIds(activeMatch);

  const stateAfterCancellation = {
    ...currentState,

    players: currentState.players.map((player) =>
      matchPlayerIds.includes(player.id)
        ? {
            ...player,
            status: "available",
            waitingSince: cancelledAt,
          }
        : player,
    ),

    courts: currentState.courts.map((court) =>
      court.id === courtId
        ? {
            ...court,
            status: "available",
            currentMatchId: null,
          }
        : court,
    ),

    waitingPlayerIds: [
      ...currentState.waitingPlayerIds,
      ...matchPlayerIds.filter(
        (playerId) =>
          !currentState.waitingPlayerIds.includes(playerId),
      ),
    ],

    activeMatches: currentState.activeMatches.filter(
      (match) => match.id !== activeMatch.id,
    ),

    statusMessage:
      `${selectedCourt.name}'s match was cancelled. ` +
      "No game or playing time was recorded.",
  };

  return rebuildProvisionalMatchQueue(
    stateAfterCancellation,
  );
}