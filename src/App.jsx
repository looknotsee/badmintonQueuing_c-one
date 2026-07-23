import { useEffect, useRef, useState } from "react";
import "./App.css";
import Navbar from "./components/navbar/Navbar";
import CourtSection from "./components/courtsection/Courtsection";
import QueueSection from "./components/queuesection/Queuesection";
import { formatSeconds } from "./components/utils/Formatseconds";
import RegisterModal from "./components/registermodal/Registermodal";
import PlayerPoolModal from "./components/playerpool/PlayerPoolModal";
import { sampleCourts, samplePlayers } from "./data/sampleData";

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
  getPlayerRegistrationError,
  registerPlayerState,
  removePlayerState
} from "./logic/playerActions.js";

import {
  getManualMatchError,
  updateManualMatchState,
} from "./logic/matchSelectionValidation.js";

import {
  initializeQueueState,
  updateQueueState,
  subscribeToQueueState
} from "./services/queueRepository.js";

function App() {

  const [systemState, setSystemState] = useState(
  () => createInitialState(),
  );

  const queueVersionRef = useRef(null);
  const systemStateRef = useRef(systemState);

  // This causes active court timers to update every second.
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Drag-and-drop state: which queued match is being dragged,
  // and where it is currently hovering.
  const [draggedMatchId, setDraggedMatchId] = useState(null);
  const [dragOverQueueIndex, setDragOverQueueIndex] = useState(null);
  const [dragOverCourtId, setDragOverCourtId] = useState(null);

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
  systemStateRef.current = systemState;
}, [systemState]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
  let requestWasCancelled = false;
  let unsubscribeFromQueueState = null;

  async function loadSharedQueueState() {
    try {
      const initialState = createInitialState();

      const queueRecord = await initializeQueueState(
        initialState,
      );

      if (requestWasCancelled) {
        return;
      }

      queueVersionRef.current = queueRecord.version;
      systemStateRef.current = queueRecord.state;
      setSystemState(queueRecord.state);

      unsubscribeFromQueueState =
        subscribeToQueueState((updatedRecord) => {
          if (requestWasCancelled) {
            return;
          }

          const currentVersion =
            queueVersionRef.current ?? 0;

          /*
           * Ignore duplicate or older events.
           * This also prevents our own completed update
           * from being unnecessarily applied twice.
           */
          if (updatedRecord.version <= currentVersion) {
            return;
          }

          queueVersionRef.current =
            updatedRecord.version;

          systemStateRef.current =
            updatedRecord.state;

          setSystemState(updatedRecord.state);
        });
    } catch (error) {
      if (requestWasCancelled) {
        return;
      }

      console.error(
        "Could not initialize the shared queue.",
        error,
      );

      setSystemState((currentState) => ({
        ...currentState,
        statusMessage:
          `Backend connection failed: ${error.message}`,
      }));
    }
  }

  loadSharedQueueState();

  return () => {
    requestWasCancelled = true;

    if (unsubscribeFromQueueState) {
      unsubscribeFromQueueState();
    }
  };
}, []);


  async function commitSharedStateChange(stateTransition) {
  const currentVersion = queueVersionRef.current;

  if (currentVersion === null) {
    console.error(
      "The shared queue has not finished loading yet.",
    );

    return null;
  }

  try {
    const currentState = systemStateRef.current;
    const nextState = stateTransition(currentState);

    const updatedRecord = await updateQueueState(
      nextState,
      currentVersion,
    );

    queueVersionRef.current = updatedRecord.version;
    systemStateRef.current = updatedRecord.state;
    setSystemState(updatedRecord.state);
    
    return updatedRecord;
  } catch (error) {
    console.error(
      "Could not save the shared queue change.",
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
  await commitSharedStateChange(
    (currentState) =>
      startMatchOnCourtState(
        currentState,
        courtId,
        requestedMatchId,
      ),
  );
}

async function endMatchOnCourt(courtId) {
  await commitSharedStateChange(
    (currentState) =>
      endMatchOnCourtState(currentState, courtId),
  );
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

  async function registerPlayer(event) {
  event.preventDefault();

  const currentPlayers =
    systemStateRef.current.players;

  const registrationError = getPlayerRegistrationError(
    currentPlayers,
    registrationForm.name,
  );

  if (registrationError) {
    setSystemState((currentState) => ({
      ...currentState,
      statusMessage: registrationError,
    }));

    return;
  }

  const updatedRecord = await commitSharedStateChange(
    (currentState) =>
      registerPlayerState(
        currentState,
        registrationForm,
      ),
  );

  if (!updatedRecord) {
    return;
  }

  setRegistrationForm({
    name: "",
    skillLevel: "Beginner",
  });
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

async function resetPrototype() {
  await commitSharedStateChange(
    () => createInitialState(),
  );
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
            className="secondary-button"
            onClick={resetPrototype}
          >
            Reset Prototype
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