import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./App.css";
import Navbar from "./components/navbar/Navbar";
import CourtSection from "./components/courtsection/Courtsection";
import QueueSection from "./components/queuesection/Queuesection";
import { formatSeconds } from "./components/utils/Formatseconds";
import RegisterModal from "./components/registermodal/Registermodal";
import PlayerPoolModal from "./components/playerpool/PlayerPoolModal";
import FlyingMatchCard from "./components/flyingmatchcard/Flyingmatchcard";
import { sampleCourts, samplePlayers } from "./data/sampleData";
import PlayerPoolCard from "./components/playerpool/PlayerPoolCard";
import TeamBox from "./components/teambox/Teambox";

import {
createId,
getMatchPlayerIds,
fillPreparedMatchQueue
} from "./logic/matchmaking.js";

import {
  createInitialState,
} from "./logic/queueState.js";

import {
  moveQueuedMatchState,
  reorderQueuedMatchState,
} from "./logic/queueActions.js";

import {
  getInGamePlayerCount,
  getPreparedPlayerCount,
  getPlayerLocation
} from "./logic/selectors.js";

import {
  startMatchOnCourtState,
  endMatchOnCourtState,
  cancelMatchOnCourtState,
} from "./logic/courtActions.js"

import {
  addDirectoryPlayerToActiveSessionState,
  removePlayerState
} from "./logic/playerActions.js";

import {
  createDirectoryPlayer,
  createDirectoryPlayerWithId,
  fetchPlayerDirectory,
} from "./services/playerDirectoryRepository.js";

import {
  getManualMatchError,
  updateManualMatchState,
} from "./logic/matchSelectionValidation.js";

import {
  fetchCurrentSession,
  updateCurrentSession,
  subscribeToCurrentSession,
} from "./services/currentSessionRepository.js";

import {
  SESSION_STATUS,
  endCurrentSession
} from "./logic/sessionLifecycle.js";

function App() {

  const [systemState, setSystemState] = useState(
  () => createInitialState(),
  );

  const navigate = useNavigate();
  const currentSessionVersionRef = useRef(null);
  const currentSessionRef = useRef(null);
  const systemStateRef = useRef(systemState);

  // This causes active court timers to update every second.
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Drag-and-drop state: which queued match is being dragged,
  // and where it is currently hovering.
  const [draggedMatchId, setDraggedMatchId] = useState(null);
  const [dragOverQueueIndex, setDragOverQueueIndex] = useState(null);
  const [dragOverCourtId, setDragOverCourtId] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);

  // Simple page navigation without adding another dependency.
  const [activePage, setActivePage] = useState("queue");

  // Registration is now a modal rather than a page.
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isPlayerpoolModalOpen, setIsPlayerpoolModalOpen] = useState(false);

  // Player registration and player-pool controls.
  const [registrationForm, setRegistrationForm] = useState({
    name: "",
    skillLevel: "Beginner",
  });
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerStatusFilter, setPlayerStatusFilter] = useState("all");

  // Player removal
  const [pendingRemovalPlayerId, setPendingRemovalPlayerId] = useState(null);

  // Visual guide: the match currently animating from the queue to a court.
  const [flyingMatch, setFlyingMatch] = useState(null);

  // Manual match editor state.
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [manualTeams, setManualTeams] = useState({
    teamOne: ["", ""],
    teamTwo: ["", ""],
  });
  const [matchEditorError, setMatchEditorError] = useState("");

  const [draggedManualPlayerId, setDraggedManualPlayerId] =
  useState(null);

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
  const timerInterval = window.setInterval(() => {
    setCurrentTime(Date.now());
  }, 1000);

  return () => {
    window.clearInterval(timerInterval);
  };
  }, []);
  
  useEffect(() => {
  systemStateRef.current = systemState;
  }, [systemState]);

useEffect(() => {
  let requestWasCancelled = false;
  let unsubscribeFromCurrentSession = null;

  async function loadActiveSession() {
    try {
      const sessionRecord =
        await fetchCurrentSession();

      if (requestWasCancelled) {
        return;
      }

      if (
        sessionRecord.status !== SESSION_STATUS.ACTIVE ||
        !sessionRecord.state
      ) {
        navigate("/", { replace: true });
        return;
      }

      currentSessionVersionRef.current =
        sessionRecord.version;

      currentSessionRef.current =
        sessionRecord;

      systemStateRef.current =
        sessionRecord.state;

      setSystemState(sessionRecord.state);

      unsubscribeFromCurrentSession =
        subscribeToCurrentSession(
          (updatedSession) => {
            if (requestWasCancelled) {
              return;
            }

            const currentVersion =
              currentSessionVersionRef.current ?? 0;

            if (
              updatedSession.version <= currentVersion
            ) {
              return;
            }

            currentSessionVersionRef.current =
              updatedSession.version;

            currentSessionRef.current =
              updatedSession;

            /*
             * When the queuemaster ends the session,
             * every connected queue screen returns home.
             */
            if (
              updatedSession.status !==
                SESSION_STATUS.ACTIVE ||
              !updatedSession.state
            ) {
              navigate("/", { replace: true });
              return;
            }

            systemStateRef.current =
              updatedSession.state;

            setSystemState(updatedSession.state);
          },
        );
    } catch (error) {
      if (requestWasCancelled) {
        return;
      }

      console.error(
        "Could not load the active session.",
        error,
      );

      setSystemState((currentState) => ({
        ...currentState,
        statusMessage:
          `Backend connection failed: ${error.message}`,
      }));
    }
  }

  loadActiveSession();

  return () => {
    requestWasCancelled = true;
    unsubscribeFromCurrentSession?.();
  };
}, [navigate]);

async function commitSharedStateChange(
  stateTransition,
) {
  const currentVersion =
    currentSessionVersionRef.current;

  const currentSession =
    currentSessionRef.current;

  if (
    currentVersion === null ||
    !currentSession ||
    currentSession.status !== SESSION_STATUS.ACTIVE
  ) {
    console.error(
      "The active session has not finished loading.",
    );

    return null;
  }

  try {
    const currentState =
      systemStateRef.current;

    const nextState =
      stateTransition(currentState);

    const updatedSession =
      await updateCurrentSession(
        {
          ...currentSession,
          state: nextState,
        },
        currentVersion,
      );

    currentSessionVersionRef.current =
      updatedSession.version;

    currentSessionRef.current =
      updatedSession;

    systemStateRef.current =
      updatedSession.state;

    setSystemState(updatedSession.state);

    return updatedSession;
  } catch (error) {
    console.error(
      "Could not save the active session change.",
      error,
    );

    setSystemState((currentState) => ({
      ...currentState,
      statusMessage: error.message,
    }));

    return null;
  }
}

async function startMatchOnCourt(
  courtId,
  requestedMatchId = null,
) {
  const matchIdToStart = requestedMatchId ?? matchQueue[0]?.id;
  const matchToStart = matchQueue.find(
    (match) => match.id === matchIdToStart,
  );

  const queueCardElement = matchToStart
    ? document.querySelector(
        `[data-match-id="${matchToStart.id}"]`,
      )
    : null;

  const courtCardElement = document.querySelector(
    `[data-court-id="${courtId}"]`,
  );

  if (matchToStart && queueCardElement && courtCardElement) {
    setFlyingMatch({
      matchId: matchToStart.id,
      teamOne: matchToStart.teamOne,
      teamTwo: matchToStart.teamTwo,

      courtName:
        courts.find(
          (court) => court.id === courtId,
        )?.name ?? "Court",

      startRect:
        queueCardElement.getBoundingClientRect(),

      endRect:
        courtCardElement.getBoundingClientRect(),
    });
  }

  await commitSharedStateChange(
    (currentState) =>
      startMatchOnCourtState(
        currentState,
        courtId,
        requestedMatchId,
      ),
  );
}

function clearFlyingMatch() {
  setFlyingMatch(null);
}

async function endMatchOnCourt(courtId) {
  const stateBeforeEnding =
    systemStateRef.current;

  const selectedCourt =
    stateBeforeEnding.courts.find(
      (court) => court.id === courtId,
    );

  const activeMatch =
    stateBeforeEnding.activeMatches.find(
      (match) =>
        match.id === selectedCourt?.currentMatchId,
    );

  if (!activeMatch) {
    await commitSharedStateChange(
      (currentState) =>
        endMatchOnCourtState(
          currentState,
          courtId,
        ),
    );

    return;
  }

  const matchPlayerIds =
    getMatchPlayerIds(activeMatch);

  /*
   * First save the completed match. This increments
   * gamesPlayed before directory promotion occurs.
   */
  const endedSession =
    await commitSharedStateChange(
      (currentState) =>
        endMatchOnCourtState(
          currentState,
          courtId,
        ),
    );

  if (!endedSession) {
    return;
  }

  const temporaryPlayersToPromote =
    endedSession.state.players.filter(
      (player) =>
        matchPlayerIds.includes(player.id) &&
        player.gamesPlayed >= 1 &&
        player.isDirectoryPlayer !== true,
    );

  if (
    temporaryPlayersToPromote.length === 0
  ) {
    return;
  }

  const promotionResults =
    await Promise.allSettled(
      temporaryPlayersToPromote.map(
        (player) =>
          createDirectoryPlayerWithId({
            id: player.id,
            name: player.name,
            skillLevel:
              player.skillLevel || "Guest",
          }),
      ),
    );

  const promotedPlayerIds = new Set();

  const failedPlayerNames = [];

  promotionResults.forEach(
    (result, resultIndex) => {
      const player =
        temporaryPlayersToPromote[
          resultIndex
        ];

      if (result.status === "fulfilled") {
        promotedPlayerIds.add(player.id);
        return;
      }

      console.error(
        `Could not promote ${player.name} to the player directory.`,
        result.reason,
      );

      failedPlayerNames.push(player.name);
    },
  );

  /*
   * Mark successfully promoted players so future
   * completed games do not attempt another insert.
   */
  if (promotedPlayerIds.size > 0) {
    await commitSharedStateChange(
      (currentState) => ({
        ...currentState,

        players: currentState.players.map(
          (player) =>
            promotedPlayerIds.has(player.id)
              ? {
                  ...player,
                  isDirectoryPlayer: true,
                }
              : player,
        ),

        statusMessage:
          failedPlayerNames.length > 0
            ? `${currentState.statusMessage} Some player profiles could not be saved: ${failedPlayerNames.join(", ")}.`
            : `${currentState.statusMessage} First-time players were added to the player directory.`,
      }),
    );

    return;
  }

  if (failedPlayerNames.length > 0) {
    setSystemState((currentState) => ({
      ...currentState,
      statusMessage:
        `${currentState.statusMessage} Could not save these player profiles: ${failedPlayerNames.join(", ")}.`,
    }));
  }
}

async function cancelMatchOnCourt(courtId) {
  await commitSharedStateChange(
    (currentState) =>
      cancelMatchOnCourtState(currentState, courtId),
  );
}

async function moveQueuedMatch(matchId, direction) {
  await commitSharedStateChange(
    (currentState) =>
      moveQueuedMatchState(
        currentState,
        matchId,
        direction,
      ),
  );
}

async function reorderQueuedMatchToIndex(
  matchId,
  destinationIndex,
) {
  await commitSharedStateChange(
    (currentState) =>
      reorderQueuedMatchState(
        currentState,
        matchId,
        destinationIndex,
      ),
  );
}

function handleQueueDragStart(event, matchId) {
  const match = systemStateRef.current.matchQueue.find(
    (currentMatch) => currentMatch.id === matchId,
  );

  const cardElement = event.currentTarget;

  if (!match || !cardElement) {
    return;
  }

  const cardRect =
    cardElement.getBoundingClientRect();

  setDraggedMatchId(matchId);

  setDragPreview({
    matchId,
    teamOne: match.teamOne,
    teamTwo: match.teamTwo,

    width: cardRect.width,
    height: cardRect.height,

    /*
     * Preserve where inside the card the user
     * originally grabbed it.
     */
    grabOffsetX:
      event.clientX - cardRect.left,

    grabOffsetY:
      event.clientY - cardRect.top,

    x: event.clientX,
    y: event.clientY,
  });

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(
    "text/plain",
    matchId,
  );

  /*
   * Hide the browser's native drag ghost.
   */
  const transparentDragImage =
    new Image();

  transparentDragImage.src =
    "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

  event.dataTransfer.setDragImage(
    transparentDragImage,
    0,
    0,
  );
}

function handleGlobalDragOver(event) {
  if (!dragPreview) {
    return;
  }

  setDragPreview((currentPreview) => {
    if (!currentPreview) {
      return null;
    }

    return {
      ...currentPreview,
      x: event.clientX,
      y: event.clientY,
    };
  });
}

  function handleQueueDragEnd() {
    setDraggedMatchId(null);
    setDragOverQueueIndex(null);
    setDragOverCourtId(null);
    setDragPreview(null);
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

async function registerPlayer(event) {
  event.preventDefault();

  const trimmedName =
    registrationForm.name.trim();

  if (!trimmedName) {
    setSystemState((currentState) => ({
      ...currentState,
      statusMessage:
        "Enter a player's name before registering.",
    }));

    return;
  }

  const normalizedName =
    trimmedName.toLowerCase();

  try {
    let directoryPlayers =
      await fetchPlayerDirectory();

    let directoryPlayer =
      directoryPlayers.find(
        (player) =>
          player.name.trim().toLowerCase() ===
          normalizedName,
      );

    /*
     * Create a persistent profile only when the
     * player does not already exist in the directory.
     */
    if (!directoryPlayer) {
      try {
        directoryPlayer =
          await createDirectoryPlayer({
            name: trimmedName,
            skillLevel:
              registrationForm.skillLevel ||
              "Guest",
          });
      } catch (createError) {
        /*
         * Another device may have created the same
         * player after our initial directory fetch.
         */
        directoryPlayers =
          await fetchPlayerDirectory();

        directoryPlayer =
          directoryPlayers.find(
            (player) =>
              player.name
                .trim()
                .toLowerCase() ===
              normalizedName,
          );

        if (!directoryPlayer) {
          throw createError;
        }
      }
    }

    const playerAlreadyInSession =
      systemStateRef.current.players.some(
        (player) =>
          player.id === directoryPlayer.id,
      );

    if (playerAlreadyInSession) {
      setSystemState((currentState) => ({
        ...currentState,
        statusMessage:
          `${directoryPlayer.name} is already in the current session.`,
      }));

      return;
    }

    const updatedSession =
      await commitSharedStateChange(
        (currentState) =>
          addDirectoryPlayerToActiveSessionState(
            currentState,
            directoryPlayer,
          ),
      );

    if (!updatedSession) {
      return;
    }

    setRegistrationForm({
      name: "",
      skillLevel: "Beginner",
    });
  } catch (error) {
    console.error(
      "Could not register the session player.",
      error,
    );

    setSystemState((currentState) => ({
      ...currentState,
      statusMessage: error.message,
    }));
  }
}

  function requestPlayerRemoval(playerId) {
  setPendingRemovalPlayerId(playerId);
  }

  function cancelPlayerRemoval() {
    setPendingRemovalPlayerId(null);
  }

  async function confirmPlayerRemoval(playerId) {
  const updatedRecord = await commitSharedStateChange(
    (currentState) =>
      removePlayerState(currentState, playerId),
  );

  if (!updatedRecord) {
    return;
  }

  setPendingRemovalPlayerId(null);
}

  function closePlayerPoolModal() {
    setIsPlayerpoolModalOpen(false);
    setPendingRemovalPlayerId(null);
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
    setDraggedManualPlayerId(null);
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

  function handleManualPlayerDragStart(event, playerId) {
  setDraggedManualPlayerId(playerId);

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(
    "application/x-manual-player",
    playerId,
  );
}

function handleManualPlayerDragEnd() {
  setDraggedManualPlayerId(null);
}

function handleManualSlotDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleManualSlotDrop(
  event,
  targetTeamName,
  targetPlayerIndex,
) {
  event.preventDefault();

  const droppedPlayerId =
    draggedManualPlayerId ||
    event.dataTransfer.getData(
      "application/x-manual-player",
    );

  if (!droppedPlayerId) {
    return;
  }

  setManualTeams((currentTeams) => {
    const updatedTeams = {
      teamOne: [...currentTeams.teamOne],
      teamTwo: [...currentTeams.teamTwo],
    };

    const targetPlayerId =
      updatedTeams[targetTeamName][targetPlayerIndex];

    let sourceTeamName = null;
    let sourcePlayerIndex = -1;

    for (const teamName of ["teamOne", "teamTwo"]) {
      const foundIndex =
        updatedTeams[teamName].indexOf(droppedPlayerId);

      if (foundIndex >= 0) {
        sourceTeamName = teamName;
        sourcePlayerIndex = foundIndex;
        break;
      }
    }

    /*
     * If the dragged player already occupies another match slot,
     * place the target player into the source slot. This creates
     * a proper swap between teammates or opposing teams.
     */
    if (sourceTeamName !== null) {
      updatedTeams[sourceTeamName][sourcePlayerIndex] =
        targetPlayerId;
    }

    /*
     * If the player came from the waiting pool, there is no source
     * match slot. The displaced target player simply disappears
     * from manualTeams and will return to the waiting pool when
     * the changes are saved.
     */
    updatedTeams[targetTeamName][targetPlayerIndex] =
      droppedPlayerId;

    return updatedTeams;
  });

  setDraggedManualPlayerId(null);
  setMatchEditorError("");
}

  async function saveManualMatchChanges() {
  const currentState = systemStateRef.current;

  const validationError = getManualMatchError(
    currentState,
    editingMatchId,
    manualTeams,
  );

  if (validationError) {
    setMatchEditorError(validationError);
    return;
  }

  const updatedRecord = await commitSharedStateChange(
    (latestState) =>
      updateManualMatchState(
        latestState,
        editingMatchId,
        manualTeams,
      ),
  );

  if (!updatedRecord) {
    return;
  }

  closeManualMatchEditor();
}

async function handleEndSession() {
  const currentSession =
    currentSessionRef.current;

  const currentVersion =
    currentSessionVersionRef.current;

  if (
    !currentSession ||
    currentVersion === null
  ) {
    return;
  }

  const currentState =
    systemStateRef.current;

  if (currentState.activeMatches.length > 0) {
    setSystemState((existingState) => ({
      ...existingState,
      statusMessage:
        "End or cancel all active matches before ending the session.",
    }));

    return;
  }

  const sessionShouldEnd = window.confirm(
    "End the current session? All match queues, game counts, playtime, and completed-match data from this session will be cleared.",
  );

  if (!sessionShouldEnd) {
    return;
  }

  try {
    const endedSession =
      await updateCurrentSession(
        endCurrentSession(currentSession),
        currentVersion,
      );

    currentSessionVersionRef.current =
      endedSession.version;

    currentSessionRef.current =
      endedSession;

    navigate("/", { replace: true });
  } catch (error) {
    console.error(
      "Could not end the session.",
      error,
    );

    setSystemState((existingState) => ({
      ...existingState,
      statusMessage: error.message,
    }));
  }
}

  const inGamePlayerCount = getInGamePlayerCount(players);

  const preparedPlayerCount = getPreparedPlayerCount(matchQueue);

  function findPlayerLocation(playerId) {
    return getPlayerLocation(
      playerId,
      courts,
      activeMatches,
      matchQueue,
      waitingPlayerIds
    );
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

  const manualEditorEligiblePlayerIds = new Set([
    ...waitingPlayerIds,
    ...editingMatchPlayerIds,
  ]);

  const manualEditorPoolPlayers = [...players].sort(
    (firstPlayer, secondPlayer) =>
      firstPlayer.name.localeCompare(secondPlayer.name),
  );

  const selectedManualPlayerIds = [
    ...manualTeams.teamOne,
    ...manualTeams.teamTwo,
  ].filter(Boolean);
    function renderManualPlayerSlot(
    teamName,
    playerIndex,
    label,
  ) {
    const playerId =
      manualTeams[teamName][playerIndex];

    const player = players.find(
      (currentPlayer) => currentPlayer.id === playerId,
  );

  return (
    <div className="match-editor-slot">
      <span className="match-editor-slot-label">
        {label}
      </span>

      <div
        className="manual-player-slot"
        onDragOver={handleManualSlotDragOver}
        onDrop={(event) =>
          handleManualSlotDrop(
            event,
            teamName,
            playerIndex,
          )
        }
      >
        {player ? (
          <article
            className={`manual-player-card ${
              draggedManualPlayerId === player.id
                ? "manual-player-card-dragging"
                : ""
            }`}
            draggable
            onDragStart={(event) =>
              handleManualPlayerDragStart(
                event,
                player.id,
              )
            }
            onDragEnd={handleManualPlayerDragEnd}
          >
            <div className="manual-player-card-avatar">
              {player.name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((namePart) => namePart[0])
                .join("")
                .toUpperCase()}
            </div>

            <div className="manual-player-card-details">
              <strong>{player.name}</strong>

              <span>
                {player.skillLevel} ·{" "}
                {player.gamesPlayed} games ·{" "}
                {formatSeconds(
                  player.totalTimePlayed,
                )}
              </span>
            </div>

            <span
              className="manual-player-drag-handle"
              aria-hidden="true"
            >
              ⠿
            </span>
          </article>
        ) : (
          <div className="manual-player-slot-empty">
            Drop a player here
          </div>
        )}
      </div>
    </div>
  );
}

  return (
    <main 
      className="app-shell"
      onDragOver={handleGlobalDragOver}
    >
      <header className="top-bar">
        <Navbar />

        <div className="top-actions">
          <nav className="view-navigation" aria-label="App pages">
            <button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
            >
              Register Player
            </button>

            <button
              type="button"
              onClick={() => setIsPlayerpoolModalOpen(true)}
            >
              Player Pool
            </button>
          </nav>

          <button
            type="button"
            className="danger-button"
            onClick={handleEndSession}
          >
            End Session
          </button>
        </div>
      </header>

      {activePage === "queue" && (
        <>
          <CourtSection
            courts={courts}
            activeMatches={activeMatches}
            players={players}
            currentTime={currentTime}
            draggedMatchId={draggedMatchId}
            dragOverCourtId={dragOverCourtId}
            matchQueueLength={matchQueue.length}
            onCourtDragOver={handleCourtDragOver}
            onCourtDragLeave={handleCourtDragLeave}
            onCourtDrop={handleCourtDrop}
            onStartMatch={startMatchOnCourt}
            onEndMatch={endMatchOnCourt}
            onCancelMatch={cancelMatchOnCourt}
          />

          <QueueSection
            matchQueue={matchQueue}
            players={players}
            statusMessage={statusMessage}
            totalPlayers={players.length}
            waitingPlayerCount={waitingPlayerIds.length}
            preparedPlayerCount={preparedPlayerCount}
            inGamePlayerCount={inGamePlayerCount}
            completedMatchCount={completedMatches.length}
            draggedMatchId={draggedMatchId}
            dragOverQueueIndex={dragOverQueueIndex}
            flyingMatchId={flyingMatch?.matchId ?? null}
            onQueueDragStart={handleQueueDragStart}
            onQueueDragEnd={handleQueueDragEnd}
            onQueueCardDragOver={handleQueueCardDragOver}
            onQueueCardDrop={handleQueueCardDrop}
            onMoveMatch={moveQueuedMatch}
            onOpenEditor={openManualMatchEditor}
          />
        </>
      )}

      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        registrationForm={registrationForm}
        setRegistrationForm={setRegistrationForm}
        registerPlayer={registerPlayer}
        statusMessage={statusMessage}
/>

      <PlayerPoolModal
        isOpen={isPlayerpoolModalOpen}
        onClose={closePlayerPoolModal}
        filteredPlayers={filteredPlayers}
        playerSearch={playerSearch}
        setPlayerSearch={setPlayerSearch}
        playerStatusFilter={playerStatusFilter}
        setPlayerStatusFilter={setPlayerStatusFilter}
        pendingRemovalPlayerId={pendingRemovalPlayerId}
        requestPlayerRemoval={requestPlayerRemoval}
        cancelPlayerRemoval={cancelPlayerRemoval}
        confirmPlayerRemoval={confirmPlayerRemoval}
        findPlayerLocation={findPlayerLocation}
      />

      {dragPreview && (
        <div
          className="queue-drag-preview"
          style={{
            left: Math.round(
              dragPreview.x -
              dragPreview.grabOffsetX,
            ),

            top: Math.round(
              dragPreview.y -
              dragPreview.grabOffsetY,
            ),

            width: dragPreview.width,
          }}
          aria-hidden="true"
        
        >

        <header className="queue-card-header">
          <strong>
            <span
              className="drag-handle"
              aria-hidden="true"
            >
              ⠿
            </span>{" "}
            Next Match
           </strong>
          </header>
          
        <TeamBox
          playerIds={dragPreview.teamOne}
          players={players}
        />

        <div className="vs-divider">
          <span>vs</span>
        </div>

        <TeamBox
          playerIds={dragPreview.teamTwo}
          players={players}
        />
     </div>
    )}

      {flyingMatch && (
        <FlyingMatchCard
          key={flyingMatch.matchId}
          flyingMatch={flyingMatch}
          players={players}
          onArrived={clearFlyingMatch}
        />
      )}

      {editingMatch && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeManualMatchEditor();
            }
          }}
        >
          <section
            className="modal-card"
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

<div className="manual-editor-layout">
  <div className="manual-team-grid">
    <div className="manual-team-card">
      <h3>Team One</h3>

      {renderManualPlayerSlot(
        "teamOne",
        0,
        "Player 1",
      )}

      {renderManualPlayerSlot(
        "teamOne",
        1,
        "Player 2",
      )}
    </div>

    <div className="manual-team-card">
      <h3>Team Two</h3>

      {renderManualPlayerSlot(
        "teamTwo",
        0,
        "Player 1",
      )}

      {renderManualPlayerSlot(
        "teamTwo",
        1,
        "Player 2",
      )}
    </div>
  </div>

  <aside
    className="manual-player-pool-panel"
    aria-labelledby="manual-player-pool-title"
  >
    <div className="manual-player-pool-heading">
      <div>
        <h3 id="manual-player-pool-title">
          Player Pool
        </h3>

        <p>
          Drag an available player into any team slot.
        </p>
      </div>

      <span>{players.length}</span>
    </div>

    <div className="manual-player-pool-grid">
      {manualEditorPoolPlayers.map((player) => {
        const playerIsEligible =
          manualEditorEligiblePlayerIds.has(player.id);

        const playerIsSelected =
          selectedManualPlayerIds.includes(player.id);

        return (
          <PlayerPoolCard
            key={player.id}
            player={player}
            playerLocation={findPlayerLocation(player.id)}
            draggable
            dragDisabled={!playerIsEligible}
            isSelected={playerIsSelected}
            showRemoveControls={false}
            onDragStart={handleManualPlayerDragStart}
            onDragEnd={handleManualPlayerDragEnd}
          />
        );
      })}
    </div>
  </aside>
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