const MAX_PREPARED_MATCHES = 4;

const skillValues = {
  Unknown: 2,
  Beginner: 1,
  Intermediate: 2,
  Expert: 3,
};

export function createId(prefix) {
  const randomPart = Math.random().toString(16).slice(2);

  return `${prefix}-${Date.now()}-${randomPart}`;
}

export function getMatchPlayerIds(match) {
  return [...match.teamOne, ...match.teamTwo];
}

export function createPlayerMap(players) {
  return new Map(players.map((player) => [player.id, player]));
}

export function countPreviousPartnerships(playerOneId, playerTwoId, completedMatches) {
  return completedMatches.filter((match) => {
    const partneredOnTeamOne =
      match.teamOne.includes(playerOneId) &&
      match.teamOne.includes(playerTwoId);

    const partneredOnTeamTwo =
      match.teamTwo.includes(playerOneId) &&
      match.teamTwo.includes(playerTwoId);

    return partneredOnTeamOne || partneredOnTeamTwo;
  }).length;
}

export function calculatePairingScore(teamOne, teamTwo, players, completedMatches) {
  const playerMap = createPlayerMap(players);

  const teamOneSkill = teamOne.reduce((total, playerId) => {
    const player = playerMap.get(playerId);
    return total + (skillValues[player?.skillLevel] ?? 2);
  }, 0);

  const teamTwoSkill = teamTwo.reduce((total, playerId) => {
    const player = playerMap.get(playerId);
    return total + (skillValues[player?.skillLevel] ?? 2);
  }, 0);

  const skillDifference = Math.abs(teamOneSkill - teamTwoSkill);

  const repeatedPartnerCount =
    countPreviousPartnerships(teamOne[0], teamOne[1], completedMatches) +
    countPreviousPartnerships(teamTwo[0], teamTwo[1], completedMatches);

  return skillDifference * 100 + repeatedPartnerCount * 10;
}

export function createBalancedMatch(selectedPlayerIds, players, completedMatches) {
  const [playerA, playerB, playerC, playerD] = selectedPlayerIds;

  const possiblePairings = [
    {
      teamOne: [playerA, playerB],
      teamTwo: [playerC, playerD],
    },
    {
      teamOne: [playerA, playerC],
      teamTwo: [playerB, playerD],
    },
    {
      teamOne: [playerA, playerD],
      teamTwo: [playerB, playerC],
    },
  ];

  const bestPairing = possiblePairings.reduce(
    (currentBestPairing, pairingOption) => {
      const currentBestScore = calculatePairingScore(
        currentBestPairing.teamOne,
        currentBestPairing.teamTwo,
        players,
        completedMatches,
      );

      const optionScore = calculatePairingScore(
        pairingOption.teamOne,
        pairingOption.teamTwo,
        players,
        completedMatches,
      );

      return optionScore < currentBestScore
        ? pairingOption
        : currentBestPairing;
    },
  );

  return {
    id: createId("match"),
    teamOne: bestPairing.teamOne,
    teamTwo: bestPairing.teamTwo,
    createdAt: Date.now(),
  };
}

export function sortWaitingPlayers(waitingPlayerIds, players) {
  const playerMap = createPlayerMap(players);

  return [...waitingPlayerIds].sort((firstId, secondId) => {
    const firstPlayer = playerMap.get(firstId);
    const secondPlayer = playerMap.get(secondId);

    if (!firstPlayer || !secondPlayer) {
      return 0;
    }

    if (firstPlayer.totalTimePlayed !== secondPlayer.totalTimePlayed) {
      return firstPlayer.totalTimePlayed - secondPlayer.totalTimePlayed;
    }

    if (firstPlayer.gamesPlayed !== secondPlayer.gamesPlayed) {
      return firstPlayer.gamesPlayed - secondPlayer.gamesPlayed;
    }

    return firstPlayer.waitingSince - secondPlayer.waitingSince;
  });
}

export function fillPreparedMatchQueue(currentState) {
  const updatedQueue = [...currentState.matchQueue];
  let updatedWaitingPlayerIds = [...currentState.waitingPlayerIds];

  while (
    updatedQueue.length < MAX_PREPARED_MATCHES &&
    updatedWaitingPlayerIds.length >= 4
  ) {
    const orderedWaitingPlayers = sortWaitingPlayers(
      updatedWaitingPlayerIds,
      currentState.players,
    );

    const selectedPlayerIds = orderedWaitingPlayers.slice(0, 4);

    updatedWaitingPlayerIds = updatedWaitingPlayerIds.filter(
      (playerId) => !selectedPlayerIds.includes(playerId),
    );

    const preparedMatch = createBalancedMatch(
      selectedPlayerIds,
      currentState.players,
      currentState.completedMatches,
    );

    updatedQueue.push(preparedMatch);
  }

  return {
    ...currentState,
    waitingPlayerIds: updatedWaitingPlayerIds,
    matchQueue: updatedQueue,
  };
}