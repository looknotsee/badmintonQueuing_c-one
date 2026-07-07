import { useEffect, useState } from "react";
import "./App.css";
import Navbar from "./components/navbar/Navbar";
import { sampleCourts, samplePlayers } from "./data/sampleData";

const STORAGE_KEY = "badminton-central-loop-v1";
const MAX_PREPARED_MATCHES = 4;

// Numerical values allow the matchmaking system to compare team strength.
const skillValues = {
  Unknown: 2,
  Beginner: 1,
  Intermediate: 2,
  Expert: 3,
};

function createId(prefix) {
  const randomPart = Math.random().toString(16).slice(2);

  return `${prefix}-${Date.now()}-${randomPart}`;
}

function getMatchPlayerIds(match) {
  return [...match.teamOne, ...match.teamTwo];
}

function createPlayerMap(players) {
  return new Map(players.map((player) => [player.id, player]));
}

function countPreviousPartnerships(playerOneId, playerTwoId, completedMatches) {
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

function calculatePairingScore(teamOne, teamTwo, players, completedMatches) {
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

  /*
   * A large penalty is given to unequal team skill.
   * Repeated partnerships are used as a secondary penalty.
   * The lowest score is considered the best pairing.
   */
  return skillDifference * 100 + repeatedPartnerCount * 10;
}

function createBalancedMatch(selectedPlayerIds, players, completedMatches) {
  const [playerA, playerB, playerC, playerD] = selectedPlayerIds;

  // Four players have three possible doubles team arrangements.
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

function sortWaitingPlayers(waitingPlayerIds, players) {
  const playerMap = createPlayerMap(players);

  return [...waitingPlayerIds].sort((firstId, secondId) => {
    const firstPlayer = playerMap.get(firstId);
    const secondPlayer = playerMap.get(secondId);

    if (!firstPlayer || !secondPlayer) {
      return 0;
    }

    // Primary priority: players with the least total playing time.
    if (firstPlayer.totalTimePlayed !== secondPlayer.totalTimePlayed) {
      return firstPlayer.totalTimePlayed - secondPlayer.totalTimePlayed;
    }

    // Secondary priority: players with fewer completed games.
    if (firstPlayer.gamesPlayed !== secondPlayer.gamesPlayed) {
      return firstPlayer.gamesPlayed - secondPlayer.gamesPlayed;
    }

    // Final tie-breaker: the player who has waited the longest.
    return firstPlayer.waitingSince - secondPlayer.waitingSince;
  });
}

function fillPreparedMatchQueue(currentState) {
  const updatedQueue = [...currentState.matchQueue];
  let updatedWaitingPlayerIds = [...currentState.waitingPlayerIds];

  /*
   * Keep preparing matches until:
   * - four matches are ready, or
   * - fewer than four unassigned players remain.
   */
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

function createInitialState() {
  const currentTime = Date.now();

  const playersWithWaitingTimes = samplePlayers.map((player, index) => ({
    ...player,
    status: "queued",

    /*
     * Earlier players receive an older waiting time so the
     * initial ordering is predictable.
     */
    waitingSince: currentTime - (samplePlayers.length - index) * 1000,
  }));

  const initialState = {
    players: playersWithWaitingTimes,
    courts: sampleCourts,
    waitingPlayerIds: playersWithWaitingTimes.map((player) => player.id),
    matchQueue: [],
    activeMatches: [],
    completedMatches: [],
    statusMessage: "The first four matches have been prepared.",
  };

  return fillPreparedMatchQueue(initialState);
}

function loadInitialState() {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);

    if (savedState) {
      return JSON.parse(savedState);
    }
  } catch (error) {
    console.error("Could not load the saved badminton state.", error);
  }

  return createInitialState();
}

function App() {
  const [systemState, setSystemState] = useState(loadInitialState);

  // This causes active court timers to update every second.
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Drag-and-drop state: which queued match is being dragged,
  // and where it is currently hovering.
  const [draggedMatchId, setDraggedMatchId] = useState(null);
  const [dragOverQueueIndex, setDragOverQueueIndex] = useState(null);
  const [dragOverCourtId, setDragOverCourtId] = useState(null);

  // Simple page navigation without adding another dependency.
  const [activePage, setActivePage] = useState("queue");

  // Player registration and player-pool controls.
  const [registrationForm, setRegistrationForm] = useState({
    name: "",
    skillLevel: "Beginner",
  });
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerStatusFilter, setPlayerStatusFilter] = useState("all");

  // Manual match editor state.
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [manualTeams, setManualTeams] = useState({
    teamOne: ["", ""],
    teamTwo: ["", ""],
  });
  const [matchEditorError, setMatchEditorError] = useState("");

  const {
    players,
    courts,
    waitingPlayerIds,
    matchQueue,
    activeMatches,
    completedMatches,
    statusMessage,
  } = systemState;

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  // Save the entire local prototype whenever its state changes.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(systemState));
    } catch (error) {
      console.error("Could not save the badminton state.", error);
    }
  }, [systemState]);

  function formatSeconds(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(
        2,
        "0",
      )}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function findPlayerById(playerId) {
    return players.find((player) => player.id === playerId);
  }

  function validateMatchStart(currentState, selectedCourt, selectedMatch) {
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

  function startMatchOnCourt(courtId, requestedMatchId = null) {
    setSystemState((currentState) => {
      const selectedCourt = currentState.courts.find(
        (court) => court.id === courtId,
      );

      /*
       * Without a requested ID, the first prepared match
       * is used.
       */
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

      const startedAt = Date.now();
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

      /*
       * Starting a match opens a queue slot, so the system
       * tries to prepare another match automatically.
       */
      return fillPreparedMatchQueue(stateAfterStarting);
    });
  }

  function endMatchOnCourt(courtId) {
    setSystemState((currentState) => {
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

      const endedAt = Date.now();

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
                status: "queued",
                gamesPlayed: player.gamesPlayed + 1,
                totalTimePlayed: player.totalTimePlayed + matchDuration,
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

        /*
         * Players return individually to the waiting pool.
         * Their previous teams are not preserved.
         */
        waitingPlayerIds: [
          ...currentState.waitingPlayerIds,
          ...matchPlayerIds.filter(
            (playerId) => !currentState.waitingPlayerIds.includes(playerId),
          ),
        ],

        activeMatches: currentState.activeMatches.filter(
          (match) => match.id !== activeMatch.id,
        ),

        completedMatches: [...currentState.completedMatches, completedMatch],

        statusMessage:
          `${selectedCourt.name} ended the match after ` +
          `${formatSeconds(matchDuration)}. ` +
          "The players returned to the waiting pool.",
      };

      return fillPreparedMatchQueue(stateAfterEnding);
    });
  }

  function cancelMatchOnCourt(courtId) {
    setSystemState((currentState) => {
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

      const cancelledAt = Date.now();

      const matchPlayerIds = getMatchPlayerIds(activeMatch);

      const stateAfterCancellation = {
        ...currentState,

        players: currentState.players.map((player) =>
          matchPlayerIds.includes(player.id)
            ? {
                ...player,
                status: "queued",
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
            (playerId) => !currentState.waitingPlayerIds.includes(playerId),
          ),
        ],

        activeMatches: currentState.activeMatches.filter(
          (match) => match.id !== activeMatch.id,
        ),

        statusMessage:
          `${selectedCourt.name}'s match was cancelled. ` +
          "No game or playing time was recorded.",
      };

      return fillPreparedMatchQueue(stateAfterCancellation);
    });
  }

  function moveQueuedMatch(matchId, direction) {
    setSystemState((currentState) => {
      const currentIndex = currentState.matchQueue.findIndex(
        (match) => match.id === matchId,
      );

      const destinationIndex = currentIndex + direction;

      if (
        currentIndex === -1 ||
        destinationIndex < 0 ||
        destinationIndex >= currentState.matchQueue.length
      ) {
        return currentState;
      }

      const reorderedQueue = [...currentState.matchQueue];

      const [movedMatch] = reorderedQueue.splice(currentIndex, 1);

      reorderedQueue.splice(destinationIndex, 0, movedMatch);

      return {
        ...currentState,
        matchQueue: reorderedQueue,
        statusMessage: "The prepared match order was updated.",
      };
    });
  }

  function reorderQueuedMatchToIndex(matchId, destinationIndex) {
    setSystemState((currentState) => {
      const currentIndex = currentState.matchQueue.findIndex(
        (match) => match.id === matchId,
      );

      if (currentIndex === -1) {
        return currentState;
      }

      const reorderedQueue = [...currentState.matchQueue];
      const [movedMatch] = reorderedQueue.splice(currentIndex, 1);

      /*
       * Removing the match may shift everything after it back
       * by one slot, so the requested destination is adjusted
       * to land in the spot the user actually dropped on.
       */
      let adjustedDestination =
        currentIndex < destinationIndex
          ? destinationIndex - 1
          : destinationIndex;

      adjustedDestination = Math.max(
        0,
        Math.min(adjustedDestination, reorderedQueue.length),
      );

      reorderedQueue.splice(adjustedDestination, 0, movedMatch);

      if (
        adjustedDestination === currentIndex &&
        destinationIndex === currentIndex
      ) {
        return currentState;
      }

      return {
        ...currentState,
        matchQueue: reorderedQueue,
        statusMessage: "The prepared match order was updated by drag and drop.",
      };
    });
  }

  function handleQueueDragStart(event, matchId) {
    setDraggedMatchId(matchId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", matchId);
  }

  function handleQueueDragEnd() {
    setDraggedMatchId(null);
    setDragOverQueueIndex(null);
    setDragOverCourtId(null);
  }

  function handleQueueCardDragOver(event, index) {
    if (!draggedMatchId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (dragOverQueueIndex !== index) {
      setDragOverQueueIndex(index);
    }
  }

  function handleQueueCardDrop(event, index) {
    event.preventDefault();

    const droppedMatchId =
      draggedMatchId || event.dataTransfer.getData("text/plain");

    if (droppedMatchId) {
      reorderQueuedMatchToIndex(droppedMatchId, index);
    }

    setDraggedMatchId(null);
    setDragOverQueueIndex(null);
  }

  function handleCourtDragOver(event, court) {
    if (!draggedMatchId || court.status !== "available") {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    if (dragOverCourtId !== court.id) {
      setDragOverCourtId(court.id);
    }
  }

  function handleCourtDragLeave(court) {
    setDragOverCourtId((current) => (current === court.id ? null : current));
  }

  function handleCourtDrop(event, court) {
    event.preventDefault();

    const droppedMatchId =
      draggedMatchId || event.dataTransfer.getData("text/plain");

    if (droppedMatchId && court.status === "available") {
      startMatchOnCourt(court.id, droppedMatchId);
    }

    setDraggedMatchId(null);
    setDragOverCourtId(null);
  }

  function registerPlayer(event) {
    event.preventDefault();

    const trimmedName = registrationForm.name.trim();

    if (!trimmedName) {
      setSystemState((currentState) => ({
        ...currentState,
        statusMessage: "Enter a player name before registering.",
      }));
      return;
    }

    const duplicatePlayerExists = players.some(
      (player) => player.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (duplicatePlayerExists) {
      setSystemState((currentState) => ({
        ...currentState,
        statusMessage: `${trimmedName} is already registered.`,
      }));
      return;
    }

    const registeredAt = Date.now();
    const newPlayer = {
      id: createId("player"),
      name: trimmedName,
      skillLevel: registrationForm.skillLevel,
      gamesPlayed: 0,
      totalTimePlayed: 0,
      status: "queued",
      waitingSince: registeredAt,
    };

    setSystemState((currentState) => {
      const stateWithNewPlayer = {
        ...currentState,
        players: [...currentState.players, newPlayer],
        waitingPlayerIds: [...currentState.waitingPlayerIds, newPlayer.id],
        statusMessage: `${newPlayer.name} was registered and added to the waiting pool.`,
      };

      return fillPreparedMatchQueue(stateWithNewPlayer);
    });

    setRegistrationForm({
      name: "",
      skillLevel: "Beginner",
    });
  }

  function openManualMatchEditor(matchId) {
    const matchToEdit = matchQueue.find((match) => match.id === matchId);

    if (!matchToEdit) {
      return;
    }

    setEditingMatchId(matchId);
    setManualTeams({
      teamOne: [...matchToEdit.teamOne],
      teamTwo: [...matchToEdit.teamTwo],
    });
    setMatchEditorError("");
  }

  function closeManualMatchEditor() {
    setEditingMatchId(null);
    setManualTeams({
      teamOne: ["", ""],
      teamTwo: ["", ""],
    });
    setMatchEditorError("");
  }

  function updateManualTeamPlayer(teamName, playerIndex, playerId) {
    setManualTeams((currentTeams) => ({
      ...currentTeams,
      [teamName]: currentTeams[teamName].map((currentPlayerId, index) =>
        index === playerIndex ? playerId : currentPlayerId,
      ),
    }));
    setMatchEditorError("");
  }

  function saveManualMatchChanges() {
    const selectedPlayerIds = [
      ...manualTeams.teamOne,
      ...manualTeams.teamTwo,
    ];

    if (selectedPlayerIds.some((playerId) => !playerId)) {
      setMatchEditorError("Select four players before saving the match.");
      return;
    }

    if (new Set(selectedPlayerIds).size !== 4) {
      setMatchEditorError("Each player can only appear once in the match.");
      return;
    }

    const matchBeingEdited = matchQueue.find(
      (match) => match.id === editingMatchId,
    );

    if (!matchBeingEdited) {
      setMatchEditorError("The queued match could not be found.");
      return;
    }

    const originalPlayerIds = getMatchPlayerIds(matchBeingEdited);
    const eligiblePlayerIds = new Set([
      ...waitingPlayerIds,
      ...originalPlayerIds,
    ]);

    const allPlayersAreEligible = selectedPlayerIds.every((playerId) =>
      eligiblePlayerIds.has(playerId),
    );

    if (!allPlayersAreEligible) {
      setMatchEditorError(
        "Only players from this match or the waiting pool can be selected.",
      );
      return;
    }

    const updatedAt = Date.now();
    const playersReturnedToPool = originalPlayerIds.filter(
      (playerId) => !selectedPlayerIds.includes(playerId),
    );

    setSystemState((currentState) => ({
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
          (playerId) => !currentState.waitingPlayerIds.includes(playerId),
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
    }));

    closeManualMatchEditor();
  }

  function prepareMoreMatches() {
    setSystemState((currentState) => {
      const updatedState = fillPreparedMatchQueue(currentState);

      const noMatchWasAdded =
        updatedState.matchQueue.length === currentState.matchQueue.length;

      if (noMatchWasAdded) {
        return {
          ...updatedState,
          statusMessage:
            "No additional match could be prepared. " +
            "At least four unassigned waiting players are required.",
        };
      }

      return {
        ...updatedState,
        statusMessage: "The prepared match queue was refilled.",
      };
    });
  }

  function resetPrototype() {
    localStorage.removeItem(STORAGE_KEY);
    setSystemState(createInitialState());
  }

  function renderPlayerRow(playerId) {
    const player = findPlayerById(playerId);

    if (!player) {
      return <div className="player-row">Unknown player</div>;
    }

    return (
      <div className="player-row" key={player.id}>
        <div className="player-main-info">
          <strong>{player.name}</strong>

          <span className={`skill-badge ${player.skillLevel.toLowerCase()}`}>
            {player.skillLevel}
          </span>
        </div>

        <div className="player-stats">
          <span>
            {player.gamesPlayed} {player.gamesPlayed === 1 ? "game" : "games"}
          </span>

          <span>{formatSeconds(player.totalTimePlayed)} total</span>
        </div>
      </div>
    );
  }

  function renderTeam(playerIds) {
    return (
      <div className="team-box">
        {playerIds.map((playerId) => renderPlayerRow(playerId))}
      </div>
    );
  }

  function renderMatch(match) {
    return (
      <>
        {renderTeam(match.teamOne)}
        <div className="vs-divider">
          <span>vs</span>
        </div>
        {renderTeam(match.teamTwo)}
      </>
    );
  }

  const inGamePlayerCount = players.filter(
    (player) => player.status === "inGame",
  ).length;

  const preparedPlayerCount = matchQueue.reduce(
    (total, match) => total + getMatchPlayerIds(match).length,
    0,
  );

  function getPlayerLocation(playerId) {
    const activeMatch = activeMatches.find((match) =>
      getMatchPlayerIds(match).includes(playerId),
    );

    if (activeMatch) {
      const court = courts.find((item) => item.id === activeMatch.courtId);
      return court?.name ?? "Active court";
    }

    const queuedMatchIndex = matchQueue.findIndex((match) =>
      getMatchPlayerIds(match).includes(playerId),
    );

    if (queuedMatchIndex >= 0) {
      return queuedMatchIndex === 0
        ? "Next match"
        : `Queue ${queuedMatchIndex + 1}`;
    }

    if (waitingPlayerIds.includes(playerId)) {
      return "Waiting pool";
    }

    return "Unassigned";
  }

  const filteredPlayers = players
    .filter((player) =>
      player.name.toLowerCase().includes(playerSearch.trim().toLowerCase()),
    )
    .filter(
      (player) =>
        playerStatusFilter === "all" ||
        player.status === playerStatusFilter,
    )
    .sort((firstPlayer, secondPlayer) =>
      firstPlayer.name.localeCompare(secondPlayer.name),
    );

  const editingMatch = matchQueue.find(
    (match) => match.id === editingMatchId,
  );

  const editingMatchPlayerIds = editingMatch
    ? getMatchPlayerIds(editingMatch)
    : [];

  const manualEditorPlayerIds = [
    ...new Set([...waitingPlayerIds, ...editingMatchPlayerIds]),
  ];

  const manualEditorPlayers = manualEditorPlayerIds
    .map((playerId) => players.find((player) => player.id === playerId))
    .filter(Boolean)
    .sort((firstPlayer, secondPlayer) =>
      firstPlayer.name.localeCompare(secondPlayer.name),
    );

  const selectedManualPlayerIds = [
    ...manualTeams.teamOne,
    ...manualTeams.teamTwo,
  ].filter(Boolean);

  function renderManualPlayerSelect(teamName, playerIndex, label) {
    const currentPlayerId = manualTeams[teamName][playerIndex];

    return (
      <div className="match-editor-slot">
        <label htmlFor={`${teamName}-${playerIndex}`}>{label}</label>

        <div className="match-editor-slot-controls">
          <select
            id={`${teamName}-${playerIndex}`}
            value={currentPlayerId}
            onChange={(event) =>
              updateManualTeamPlayer(
                teamName,
                playerIndex,
                event.target.value,
              )
            }
          >
            <option value="">Select player</option>

            {manualEditorPlayers.map((player) => {
              const selectedInAnotherSlot =
                selectedManualPlayerIds.includes(player.id) &&
                currentPlayerId !== player.id;

              return (
                <option
                  key={player.id}
                  value={player.id}
                  disabled={selectedInAnotherSlot}
                >
                  {player.name} — {player.skillLevel} —{" "}
                  {formatSeconds(player.totalTimePlayed)}
                </option>
              );
            })}
          </select>

          <button
            type="button"
            className="remove-slot-button"
            onClick={() => updateManualTeamPlayer(teamName, playerIndex, "")}
            disabled={!currentPlayerId}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <Navbar />

        <div className="top-actions">
          <nav className="view-navigation" aria-label="App pages">
            <button
              type="button"
              className={activePage === "queue" ? "active-view-button" : ""}
              onClick={() => setActivePage("queue")}
            >
              Queue
            </button>

            <button
              type="button"
              className={activePage === "register" ? "active-view-button" : ""}
              onClick={() => setActivePage("register")}
            >
              Register Player
            </button>

            <button
              type="button"
              className={activePage === "players" ? "active-view-button" : ""}
              onClick={() => setActivePage("players")}
            >
              Player Pool
            </button>
          </nav>

          <button type="button" onClick={prepareMoreMatches}>
            Prepare Matches
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={resetPrototype}
          >
            Reset Prototype
          </button>
        </div>
      </header>

      {activePage === "queue" && (
        <>
          <section className="courts-section" aria-labelledby="courts-title">
            <h1 id="courts-title" className="visually-hidden">
              Courts
            </h1>

            <div className="court-grid">
              {courts.map((court) => {
                const activeMatch = activeMatches.find(
                  (match) => match.id === court.currentMatchId,
                );

                const elapsedSeconds = activeMatch
                  ? Math.max(
                      0,
                      Math.floor(
                        (currentTime - activeMatch.startedAt) / 1000,
                      ),
                    )
                  : 0;

                const isOvertime = activeMatch && elapsedSeconds > 30 * 60;

                const isDropTarget =
                  !activeMatch &&
                  court.status === "available" &&
                  dragOverCourtId === court.id;

                return (
                  <article
                    className={`court-card ${
                      activeMatch ? "court-active" : ""
                    } ${isDropTarget ? "court-drop-target" : ""} ${
                      isOvertime ? "court-overtime" : ""
                    }`}
                    key={court.id}
                    onDragOver={(event) => handleCourtDragOver(event, court)}
                    onDragLeave={() => handleCourtDragLeave(court)}
                    onDrop={(event) => handleCourtDrop(event, court)}
                  >
                    <h2>{court.name}</h2>

                    <div className="court-content">
                      {activeMatch ? (
                        renderMatch(activeMatch)
                      ) : (
                        <div className="empty-court">
                          <strong>Available</strong>
                          <span>
                            {draggedMatchId
                              ? "Drop here to start this match."
                              : "The next prepared match can start here."}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="court-footer">
                      {activeMatch ? (
                        <div className="court-action-row">
                          <div className="court-timer">
                            {formatSeconds(elapsedSeconds)}
                          </div>

                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => endMatchOnCourt(court.id)}
                          >
                            End Match
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => cancelMatchOnCourt(court.id)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="court-start-button"
                          onClick={() => startMatchOnCourt(court.id)}
                          disabled={matchQueue.length === 0}
                        >
                          Start Next Match
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="queue-section" aria-labelledby="queue-title">
            <div className="queue-heading">
              <div>
                <h2 id="queue-title">Match Queue</h2>
                <p>{statusMessage}</p>
              </div>

              <div className="queue-summary">
                <span>
                  Total <strong>{players.length}</strong>
                </span>
                <span>
                  Waiting pool <strong>{waitingPlayerIds.length}</strong>
                </span>
                <span>
                  Prepared <strong>{preparedPlayerCount}</strong>
                </span>
                <span>
                  In game <strong>{inGamePlayerCount}</strong>
                </span>
                <span>
                  Completed <strong>{completedMatches.length}</strong>
                </span>
              </div>
            </div>

            {matchQueue.length === 0 ? (
              <div className="empty-queue">
                No match is prepared. At least four waiting players are
                required.
              </div>
            ) : (
              <div className="queue-grid">
                {matchQueue
                  .slice(0, MAX_PREPARED_MATCHES)
                  .map((match, index) => (
                    <article
                      className={`queue-card ${
                        index === 0 ? "next-match-card" : ""
                      } ${
                        draggedMatchId === match.id
                          ? "queue-card-dragging"
                          : ""
                      } ${
                        dragOverQueueIndex === index &&
                        draggedMatchId &&
                        draggedMatchId !== match.id
                          ? "queue-card-drag-over"
                          : ""
                      }`}
                      key={match.id}
                      draggable
                      onDragStart={(event) =>
                        handleQueueDragStart(event, match.id)
                      }
                      onDragEnd={handleQueueDragEnd}
                      onDragOver={(event) =>
                        handleQueueCardDragOver(event, index)
                      }
                      onDrop={(event) => handleQueueCardDrop(event, index)}
                    >
                      <header className="queue-card-header">
                        <strong>
                          <span className="drag-handle" aria-hidden="true">
                            ⠿
                          </span>{" "}
                          {index === 0
                            ? "Next Match"
                            : `Queue ${index + 1}`}
                        </strong>

                        <span>
                          {match.id.split("-").slice(0, 2).join("-")}
                        </span>
                      </header>

                      {renderMatch(match)}

                      <div className="queue-controls">
                        <div className="queue-control-buttons">
                          <button
                            type="button"
                            className="move-up-button"
                            onClick={() => moveQueuedMatch(match.id, -1)}
                            disabled={index === 0}
                          >
                            Move Up
                          </button>

                          <button
                            type="button"
                            className="move-down-button"
                            onClick={() => moveQueuedMatch(match.id, 1)}
                            disabled={index === matchQueue.length - 1}
                          >
                            Move Down
                          </button>
                        </div>

                        <button
                          type="button"
                          className="rebuild-button"
                          onClick={() => openManualMatchEditor(match.id)}
                        >
                          Rebuild
                        </button>
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
        </>
      )}

      {activePage === "register" && (
        <section className="management-page" aria-labelledby="register-title">
          <div className="management-card registration-card">
            <div className="management-heading">
              <div>
                <p className="management-kicker">Player entry</p>
                <h1 id="register-title">Register a player</h1>
                <p>
                  New players enter the waiting pool with zero games and zero
                  recorded playtime.
                </p>
              </div>

              <div className="management-count">
                <strong>{players.length}</strong>
                <span>current players</span>
              </div>
            </div>

            <form className="registration-form" onSubmit={registerPlayer}>
              <div className="form-field">
                <label htmlFor="player-name">Player name</label>
                <input
                  id="player-name"
                  type="text"
                  value={registrationForm.name}
                  onChange={(event) =>
                    setRegistrationForm((currentForm) => ({
                      ...currentForm,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Example: Cruz, A."
                  autoComplete="off"
                />
              </div>

              <div className="form-field">
                <label htmlFor="player-skill">Skill level</label>
                <select
                  id="player-skill"
                  value={registrationForm.skillLevel}
                  onChange={(event) =>
                    setRegistrationForm((currentForm) => ({
                      ...currentForm,
                      skillLevel: event.target.value,
                    }))
                  }
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Expert">Expert</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>

              <button type="submit" className="primary-management-button">
                Register and Queue Player
              </button>
            </form>

            <div className="management-status" role="status">
              {statusMessage}
            </div>
          </div>
        </section>
      )}

      {activePage === "players" && (
        <section className="management-page" aria-labelledby="players-title">
          <div className="management-card player-pool-card">
            <div className="management-heading">
              <div>
                <p className="management-kicker">Live attendance</p>
                <h1 id="players-title">Current player pool</h1>
                <p>
                  Search the full pool and see where every registered player is
                  currently assigned.
                </p>
              </div>

              <div className="management-count">
                <strong>{filteredPlayers.length}</strong>
                <span>shown</span>
              </div>
            </div>

            <div className="player-pool-toolbar">
              <div className="form-field">
                <label htmlFor="player-search">Search players</label>
                <input
                  id="player-search"
                  type="search"
                  value={playerSearch}
                  onChange={(event) => setPlayerSearch(event.target.value)}
                  placeholder="Search by name"
                />
              </div>

              <div className="form-field">
                <label htmlFor="player-status-filter">Status</label>
                <select
                  id="player-status-filter"
                  value={playerStatusFilter}
                  onChange={(event) =>
                    setPlayerStatusFilter(event.target.value)
                  }
                >
                  <option value="all">All statuses</option>
                  <option value="queued">Queued</option>
                  <option value="inGame">In game</option>
                  <option value="available">Available</option>
                </select>
              </div>
            </div>

            <div className="player-pool-table-wrapper">
              <table className="player-pool-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Skill</th>
                    <th>Status</th>
                    <th>Current location</th>
                    <th>Games</th>
                    <th>Total playtime</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPlayers.map((player) => (
                    <tr key={player.id}>
                      <td>
                        <strong>{player.name}</strong>
                      </td>
                      <td>
                        <span
                          className={`skill-badge ${player.skillLevel.toLowerCase()}`}
                        >
                          {player.skillLevel}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`pool-status-badge ${player.status.toLowerCase()}`}
                        >
                          {player.status === "inGame"
                            ? "In game"
                            : player.status}
                        </span>
                      </td>
                      <td>{getPlayerLocation(player.id)}</td>
                      <td>{player.gamesPlayed}</td>
                      <td>{formatSeconds(player.totalTimePlayed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredPlayers.length === 0 && (
                <div className="player-pool-empty">
                  No players match the current filters.
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {editingMatch && (
        <div
          className="match-editor-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeManualMatchEditor();
            }
          }}
        >
          <section
            className="match-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-editor-title"
          >
            <div className="match-editor-heading">
              <div>
                <p className="management-kicker">Manual queue control</p>
                <h2 id="match-editor-title">Rebuild queued match</h2>
                <p>
                  Choose four unique players from this match or from the
                  unassigned waiting pool.
                </p>
              </div>

              <button
                type="button"
                className="match-editor-close"
                onClick={closeManualMatchEditor}
                aria-label="Close match editor"
              >
                ×
              </button>
            </div>

            <div className="manual-team-grid">
              <div className="manual-team-card">
                <h3>Team One</h3>
                {renderManualPlayerSelect("teamOne", 0, "Player 1")}
                {renderManualPlayerSelect("teamOne", 1, "Player 2")}
              </div>

              <div className="manual-team-card">
                <h3>Team Two</h3>
                {renderManualPlayerSelect("teamTwo", 0, "Player 1")}
                {renderManualPlayerSelect("teamTwo", 1, "Player 2")}
              </div>
            </div>

            {matchEditorError && (
              <div className="match-editor-error" role="alert">
                {matchEditorError}
              </div>
            )}

            <div className="match-editor-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={closeManualMatchEditor}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-management-button"
                onClick={saveManualMatchChanges}
              >
                Save Match
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;