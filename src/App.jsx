import { useEffect, useState } from "react";
import "./App.css";
import Navbar from "./components/navbar/Navbar";
import CourtSection from "./components/courtsection/Courtsection";
import QueueSection from "./components/queuesection/Queuesection";
import { formatSeconds } from "./components/utils/Formatseconds";
import { sampleCourts, samplePlayers } from "./data/sampleData";

import {
createId,
getMatchPlayerIds,
fillPreparedMatchQueue
} from "./logic/matchmaking.js";

import {
createInitialState,
loadInitialState,
STORAGE_KEY
} from "./logic/queueState.js";

import {
  moveQueuedMatchState,
  reorderQueuedMatchState,
  prepareMoreMatchesState
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

 function startMatchOnCourt(courtId, requestedMatchId = null) {
  setSystemState((currentState) =>
    startMatchOnCourtState(
      currentState,
      courtId,
      requestedMatchId,
      ),
    );
  }

  function endMatchOnCourt(courtId) {
    setSystemState((currentState) =>
      endMatchOnCourtState(currentState, courtId),
    );
  }

  function cancelMatchOnCourt(courtId) {
    setSystemState((currentState) =>
      cancelMatchOnCourtState(currentState, courtId),
    );
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

    const registrationError = getPlayerRegistrationError(
      players,
      registrationForm.name,
    );

    if (registrationError) {
      setSystemState((currentState) => ({
        ...currentState,
        statusMessage: registrationError,
      }));

      return;
    }

    setSystemState((currentState) =>
      registerPlayerState(
        currentState,
        registrationForm,
      ),
    );

    setRegistrationForm({
      name: "",
      skillLevel: "Beginner",
    });

    setIsRegisterModalOpen(false);
  }

  function requestPlayerRemoval(playerId) {
  setPendingRemovalPlayerId(playerId);
  }

  function cancelPlayerRemoval() {
    setPendingRemovalPlayerId(null);
  }

  function confirmPlayerRemoval(playerId) {
    setSystemState((currentState) =>
      removePlayerState(currentState, playerId),
   );

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

function saveManualMatchChanges() {
  const validationError = getManualMatchError(
    systemState,
    editingMatchId,
    manualTeams,
  );

  if (validationError) {
    setMatchEditorError(validationError);
    return;
  }

  setSystemState((currentState) =>
    updateManualMatchState(
      currentState,
      editingMatchId,
      manualTeams,
    ),
  );

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
              className={activePage === "queue" ? "secondary-button" : ""}
              onClick={() => setActivePage("queue")}
            >
              Queue
            </button>

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

      {isRegisterModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsRegisterModalOpen(false);
            }
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-title"
          >
            <div className="management-heading">
              <div>
                <p className="management-kicker">Player entry</p>
                <h1 id="register-title">Register a player</h1>
                <p>
                  New players enter the waiting pool with zero games and zero
                  recorded playtime.
                </p>
              </div>

              <button
                type="button"
                className="match-editor-close"
                onClick={() => setIsRegisterModalOpen(false)}
                aria-label="Close registration"
              >
                ×
              </button>
            </div>

            <form
              className="registration-form"
              onSubmit={registerPlayer}
            >
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
          </section>
        </div>
      )}

      {isPlayerpoolModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsPlayerpoolModalOpen(false);
            }
          }}
        >
          <section
            className="modal-card wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-title"
          >
            <div className="management-heading">
              <div>

                 <button
                type="button"
                className="match-editor-close"
                onClick={closePlayerPoolModal}
                aria-label="Close registration"
              >
                ×
              </button>
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

        <div className="player-pool-grid">
          {filteredPlayers.map((player) => {
            const playerLocation = findPlayerLocation(player.id);

            const removalIsPending =
            pendingRemovalPlayerId === player.id;

            const playerCanBeRemoved =
            player.status !== "inGame";

          return (  
            <article
              key={player.id}
                className={`player-pool-item ${player.status.toLowerCase()}`}
            >
              <div className="player-pool-item-header"> 
              <div className="player-pool-avatar" aria-hidden="true">
              {player.name.charAt(0).toUpperCase()}
          </div>

          <div className="player-pool-identity">
            <strong>{player.name}</strong>

            <span
              className={`skill-badge ${player.skillLevel.toLowerCase()}`}
            >
              {player.skillLevel}
            </span>
          </div>

          <button
            type="button"
            className="remove-player-button"
            onClick={() => requestPlayerRemoval(player.id)}
            disabled={!playerCanBeRemoved}
            title={
              playerCanBeRemoved
                ? `Remove ${player.name}`
                : "Players cannot be removed during an active match."
            }
            aria-label={`Remove ${player.name}`}
            >
            Remove
          </button>

          <span
            className={`pool-status-badge ${player.status.toLowerCase()}`}
          >
            {player.status === "inGame" ? "In game" : player.status}
          </span>
        </div>

        {removalIsPending && (
          <div className="remove-player-confirmation">
            <p>
              Remove <strong>{player.name}</strong> from the current player pool?
            </p>

          <div className="remove-player-confirmation-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={cancelPlayerRemoval}
            >
            Cancel
            </button>

            <button
              type="button"
              className="danger-button"
              onClick={() => confirmPlayerRemoval(player.id)}
            >
            Confirm Remove
            </button>
          </div>
        </div>
     )}

        <div className="player-pool-location">
          <span>Current location</span>
          <strong>{playerLocation}</strong>
        </div>

        <div className="player-pool-stat-grid">
          <div className="player-pool-stat">
            <span>Games</span>
            <strong>{player.gamesPlayed}</strong>
          </div>

          <div className="player-pool-stat">
            <span>Total playtime</span>
            <strong>{formatSeconds(player.totalTimePlayed)}</strong>
          </div>
        </div>
      </article>
    );
  })}

  {filteredPlayers.length === 0 && (
    <div className="player-pool-empty">
      No players match the current filters.
    </div>
  )}
</div>
        </section>
          </div>
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
            className="modal-card wide"
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