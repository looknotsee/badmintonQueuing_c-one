import { getMatchPlayerIds } from "./matchmaking.js";

function getSelectedPlayerIds(manualTeams) {
  return [
    ...manualTeams.teamOne,
    ...manualTeams.teamTwo,
  ];
}

export function getManualMatchError(
  currentState,
  editingMatchId,
  manualTeams,
) {
  const selectedPlayerIds = getSelectedPlayerIds(manualTeams);

  if (selectedPlayerIds.some((playerId) => !playerId)) {
    return "Select four players before saving the match.";
  }

  if (new Set(selectedPlayerIds).size !== 4) {
    return "Each player can only appear once in the match.";
  }

  const matchBeingEdited = currentState.matchQueue.find(
    (match) => match.id === editingMatchId,
  );

  if (!matchBeingEdited) {
    return "The queued match could not be found.";
  }

  const originalPlayerIds = getMatchPlayerIds(matchBeingEdited);

  const eligiblePlayerIds = new Set([
    ...currentState.waitingPlayerIds,
    ...originalPlayerIds,
  ]);

  const allPlayersAreEligible = selectedPlayerIds.every(
    (playerId) => eligiblePlayerIds.has(playerId),
  );

  if (!allPlayersAreEligible) {
    return (
      "Only players from this match or the waiting pool " +
      "can be selected."
    );
  }

  return null;
}

export function updateManualMatchState(
  currentState,
  editingMatchId,
  manualTeams,
  updatedAt = Date.now(),
) {
  const matchBeingEdited = currentState.matchQueue.find(
    (match) => match.id === editingMatchId,
  );

  if (!matchBeingEdited) {
    return {
      ...currentState,
      statusMessage: "The queued match could not be found.",
    };
  }

  const selectedPlayerIds = getSelectedPlayerIds(manualTeams);
  const originalPlayerIds = getMatchPlayerIds(matchBeingEdited);

  const playersReturnedToPool = originalPlayerIds.filter(
    (playerId) => !selectedPlayerIds.includes(playerId),
  );

  return {
    ...currentState,

    matchQueue: currentState.matchQueue.map((match) =>
      match.id === editingMatchId
        ? {
            ...match,
            teamOne: [...manualTeams.teamOne],
            teamTwo: [...manualTeams.teamTwo],
            createdAt: updatedAt,
          }
        : match,
    ),

    waitingPlayerIds: [
      ...currentState.waitingPlayerIds.filter(
        (playerId) => !selectedPlayerIds.includes(playerId),
      ),

      ...playersReturnedToPool.filter(
        (playerId) =>
          !currentState.waitingPlayerIds.includes(playerId),
      ),
    ],

    players: currentState.players.map((player) =>
      playersReturnedToPool.includes(player.id)
        ? {
            ...player,
            status: "queued",
            waitingSince: updatedAt,
          }
        : player,
    ),

    statusMessage: "The queued match was manually updated.",
  };
}