import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./landing.css";
import Navbar from "../components/navbar/Navbar";
import PlayerForm from "../components/playerForm/PlayerForm";
import Playerlist from "../components/playerlist/Playerlist";
import logo from "../assets/Logo.png";

import {
  fetchCurrentSession,
  updateCurrentSession,
  subscribeToCurrentSession
} from "../services/currentSessionRepository.js";

import {
  fetchPlayerDirectory,
  subscribeToPlayerDirectory
} from "../services/playerDirectoryRepository.js";

import {
  SESSION_STATUS,
  addDraftPlayerToSession,
  removeDraftPlayerFromSession,
  beginSessionSetup,
  startCurrentSession,
  cancelSessionSetup
} from "../logic/sessionLifecycle.js";

function Landing() {
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [pendingRemovalPlayerId, setPendingRemovalPlayerId] = useState(null);

  const currentSessionVersionRef = useRef(null);

  const [currentSession, setCurrentSession] = useState(null);

  const [directoryPlayers, setDirectoryPlayers] = useState([]);

  const [isSessionLifecycleLoading, setIsSessionLifecycleLoading] = useState(true);

  useEffect(() => {
  let requestWasCancelled = false;

  let unsubscribeFromCurrentSession = null;
  let unsubscribeFromPlayerDirectory = null;

  async function refreshDirectory() {
    try {
      const latestDirectory =
        await fetchPlayerDirectory();

      if (!requestWasCancelled) {
        setDirectoryPlayers(latestDirectory);
      }
    } catch (directoryError) {
      if (!requestWasCancelled) {
        console.error(
          "Could not refresh the player directory.",
          directoryError,
        );

        setError(directoryError.message);
      }
    }
  }

  async function loadSessionArchitecture() {
    try {
      const [sessionRecord, playerDirectory] =
        await Promise.all([
          fetchCurrentSession(),
          fetchPlayerDirectory(),
        ]);

      if (requestWasCancelled) {
        return;
      }


      currentSessionVersionRef.current =
      sessionRecord.version;

      setCurrentSession(sessionRecord);
      setDirectoryPlayers(playerDirectory);
      setIsSessionLifecycleLoading(false);

      unsubscribeFromCurrentSession =
        subscribeToCurrentSession(
          (updatedSession) => {
          if (requestWasCancelled) {
            return;
          }

          const currentVersion =
            currentSessionVersionRef.current ?? 0;

          if (updatedSession.version <= currentVersion) {
            return;
          }

          currentSessionVersionRef.current =
          updatedSession.version;

          setCurrentSession(updatedSession);
          }
        );

      unsubscribeFromPlayerDirectory =
        subscribeToPlayerDirectory(() => {
          refreshDirectory();
        });
    } catch (loadError) {
      if (requestWasCancelled) {
        return;
      }

      console.error(
        "Could not load the session architecture.",
        loadError,
      );

      setError(loadError.message);
      setIsSessionLifecycleLoading(false);
    }
  }

  loadSessionArchitecture();

  return () => {
    requestWasCancelled = true;

    unsubscribeFromCurrentSession?.();
    unsubscribeFromPlayerDirectory?.();
  };
}, []);

async function commitCurrentSessionChange(
  sessionTransition,
) {
  const currentVersion =
    currentSessionVersionRef.current;

  if (
    currentVersion === null ||
    !currentSession
  ) {
    setError(
      "The session information is still loading.",
    );

    return null;
  }

  try {
    const nextSession =
      sessionTransition(currentSession);

    const updatedSession =
      await updateCurrentSession(
        nextSession,
        currentVersion,
      );

    currentSessionVersionRef.current =
      updatedSession.version;

    setCurrentSession(updatedSession);
    setError("");

    return updatedSession;
  } catch (sessionError) {
    console.error(
      "Could not save the session change.",
      sessionError,
    );

    setError(sessionError.message);
    return null;
  }
}   

  async function handleSessionAction() {
  if (!currentSession) {
    setError("The session information is still loading.");
    return;
  }

  if (currentSession.status === SESSION_STATUS.ACTIVE) {
    navigate("/session");
    return;
  }

  if (currentSession.status === SESSION_STATUS.IDLE) {
    await commitCurrentSessionChange(
      (latestSession) =>
        beginSessionSetup(latestSession),
    );

    return;
  }

  if (currentSession.status === SESSION_STATUS.SETUP) {
    const updatedSession =
      await commitCurrentSessionChange(
        (latestSession) =>
          startCurrentSession(
            latestSession,
            directoryPlayers,
          ),
      );

    if (updatedSession) {
      navigate("/session");
    }
  }
} 

async function handleCancelSessionSetup() {
  if (
    !currentSession ||
    currentSession.status !== SESSION_STATUS.SETUP
  ) {
    return;
  }

  const setupShouldBeCancelled = window.confirm(
    "Cancel this session setup? The current roster will be cleared, but saved player profiles will remain.",
  );

  if (!setupShouldBeCancelled) {
    return;
  }

  const updatedSession =
    await commitCurrentSessionChange(
      (latestSession) =>
        cancelSessionSetup(latestSession),
    );

  if (updatedSession) {
    setPendingRemovalPlayerId(null);
  }
}

async function handleAddPlayer({
  playerId = null,
  name,
  skillLevel,
}) {
  if (
    !currentSession ||
    currentSession.status !== SESSION_STATUS.SETUP
  ) {
    setError(
      "Create a new session before adding players.",
    );

    return false;
  }

  const trimmedName = name.trim();
  const normalizedName =
    trimmedName.toLowerCase();

  if (!trimmedName) {
    setError("Enter a player name.");
    return false;
  }

  try {
    let draftPlayer;

    /*
     * Returning players reuse their persistent
     * directory ID and saved skill level.
     */
    if (playerId) {
      const directoryPlayer =
        directoryPlayers.find(
          (player) => player.id === playerId,
        );

      if (!directoryPlayer) {
        setError(
          "The selected returning player could not be found.",
        );

        return false;
      }

      draftPlayer = {
        id: directoryPlayer.id,
        name: directoryPlayer.name,
        skillLevel:
          directoryPlayer.skillLevel || "Unknown",
        isDirectoryPlayer: true,
      };
    } else {
      /*
       * Prevent accidentally creating a temporary
       * duplicate of an existing directory player.
       */
      const matchingSavedPlayer =
        directoryPlayers.find(
          (player) =>
            player.name.trim().toLowerCase() ===
            normalizedName,
        );

      if (matchingSavedPlayer) {
        setError(
          `Player "${matchingSavedPlayer.name}" is already part of the directory. Select them from the suggestions.`,
        );

        return false;
      }

      /*
       * New players remain temporary during setup.
       * They are not inserted into player_directory.
       */
      draftPlayer = {
        id: crypto.randomUUID(),
        name: trimmedName,
        skillLevel: skillLevel || "Unknown",
        isDirectoryPlayer: false,
      };
    }

    const playerAlreadyInRoster =
      (currentSession.draftPlayers ?? []).some(
        (player) =>
          player.id === draftPlayer.id ||
          player.name.trim().toLowerCase() ===
            draftPlayer.name.trim().toLowerCase(),
      );

    if (playerAlreadyInRoster) {
      setError(
        `${draftPlayer.name} is already in the session pool.`,
      );

      return false;
    }

    const updatedSession =
      await commitCurrentSessionChange(
        (latestSession) =>
          addDraftPlayerToSession(
            latestSession,
            draftPlayer,
          ),
      );

    return Boolean(updatedSession);
  } catch (addError) {
    console.error(
      "Could not add the player to the roster.",
      addError,
    );

    setError(addError.message);
    return false;
  }
}

  function requestPlayerRemoval(playerId) {
    setPendingRemovalPlayerId(playerId);
  }

  function cancelPlayerRemoval() {
    setPendingRemovalPlayerId(null);
  }

async function confirmPlayerRemoval(playerId) {
  if (
    !currentSession ||
    currentSession.status !== SESSION_STATUS.SETUP
  ) {
    setError(
      "Players can only be removed while preparing a session.",
    );

    return;
  }

  const updatedSession =
    await commitCurrentSessionChange(
      (latestSession) =>
        removeDraftPlayerFromSession(
          latestSession,
          playerId,
        ),
    );

  if (!updatedSession) {
    return;
  }

  setPendingRemovalPlayerId(null);
}

 const draftRosterPlayers =
  (currentSession?.draftPlayers ?? [])
    .map((player) => ({
      ...player,
      status: "available",
    }));
    
  const setupHasEnoughPlayers =
    draftRosterPlayers.length >= 4;

  const sessionActionIsDisabled =
    isSessionLifecycleLoading ||
    !currentSession ||
  (
    currentSession?.status === SESSION_STATUS.SETUP &&
    !setupHasEnoughPlayers
  );

  const registrationIsDisabled =
  isSessionLifecycleLoading ||
  currentSession?.status !== SESSION_STATUS.SETUP;

  return (
    <div>
      <header className="top-bar">
              <Navbar />
    </header>

      <div className="container">
        <div className="leftPanel">
          <img src={logo} alt="C-ONE Logo" />
          <div className="text">
            <div className="heading">Let's Start Playing!</div>
            <div className="paragraph">Add players and we'll do the rest.</div>
          </div>

          {error && <p className="landing-error">{error}</p>}

          {registrationIsDisabled && (
            <p className="registration-disabled-note">
              Create a new session before adding players to the pool.
            </p>
          )}

          <PlayerForm
            onAddPlayer={handleAddPlayer}
            existingPlayers={directoryPlayers}
            isDisabled={registrationIsDisabled}
          />

  <section
  className={`session-control-panel ${
    currentSession?.status === SESSION_STATUS.IDLE
      ? "session-control-panel-idle"
      : currentSession?.status === SESSION_STATUS.SETUP
        ? "session-control-panel-setup"
        : "session-control-panel-active"
    }`}
  >
    <div className="session-status-content">
      {isSessionLifecycleLoading ? (
        <>
          <strong>Checking session status… </strong>
          <span>Please wait while session information loads.</span>
        </>
      ) : currentSession?.status === SESSION_STATUS.IDLE ? (
        <>
          <strong>No session is currently active. </strong>
            <span>
              Create a new session to add players to the pool.
            </span>
        </>
      ) : currentSession?.status === SESSION_STATUS.SETUP ? (
        <>
          <strong>Session setup in progress.</strong>
            <span>
              {draftRosterPlayers.length} player
              {draftRosterPlayers.length === 1 ? "" : "s"} added to the pool.
              At least four players are required.
            </span>
        </>
      ) : (
        <>
          <strong>A session is currently active.</strong>
          <span>
            Continue to main queueing screen.
          </span>
        </>
      )}
    </div>

    <div className="session-control-actions">
      {currentSession?.status === SESSION_STATUS.SETUP && (
        <button
          type="button"
          className="secondary-button"
          onClick={handleCancelSessionSetup}
        >
          Cancel Session
        </button>
      )}

    <button
      type="button"
      className={`session-primary-action ${
        currentSession?.status === SESSION_STATUS.SETUP
          ? setupHasEnoughPlayers
          ? "session-primary-action-ready"
          : "session-primary-action-waiting"
        : currentSession?.status === SESSION_STATUS.ACTIVE || currentSession?.status === SESSION_STATUS.IDLE
          ? "session-primary-action-ready"
          : ""
      }`}
      onClick={handleSessionAction}
      disabled={sessionActionIsDisabled}
    >
          {currentSession?.status === SESSION_STATUS.ACTIVE
            ? "Continue Session"
          : currentSession?.status === SESSION_STATUS.SETUP
            ? "Start Session"
            : "Create New Session"}
        </button>
    </div>
  </section>
</div>

        <Playerlist
          players={draftRosterPlayers}
          isLoading={isSessionLifecycleLoading}
          pendingRemovalPlayerId={pendingRemovalPlayerId}
          requestPlayerRemoval={requestPlayerRemoval}
          cancelPlayerRemoval={cancelPlayerRemoval}
          confirmPlayerRemoval={confirmPlayerRemoval}
        />
      </div>
    </div>
  );
}

export default Landing;