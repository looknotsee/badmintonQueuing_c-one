import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./landing.css";
import Navbar from "../components/navbar/Navbar";
import PlayerForm from "../components/playerForm/PlayerForm";
import Playerlist from "../components/playerlist/Playerlist";

import { createInitialState } from "../logic/queueState.js";
import {
  getPlayerRegistrationError,
  registerPlayerState,
  removePlayerState,
} from "../logic/playerActions.js";
import {
  initializeQueueState,
  updateQueueState,
  subscribeToQueueState,
} from "../services/queueRepository.js";

function Landing() {
  const navigate = useNavigate();

  const [systemState, setSystemState] = useState(() => createInitialState());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingRemovalPlayerId, setPendingRemovalPlayerId] = useState(null);

  const queueVersionRef = useRef(null);
  const systemStateRef = useRef(systemState);

  useEffect(() => {
    systemStateRef.current = systemState;
  }, [systemState]);

  // Load the shared queue state on mount, then stay in sync with any
  // other page (including /session) that changes it.
  useEffect(() => {
    let requestWasCancelled = false;
    let unsubscribeFromQueueState = null;

    async function loadSharedQueueState() {
      try {
        const initialState = createInitialState();
        const queueRecord = await initializeQueueState(initialState);

        if (requestWasCancelled) {
          return;
        }

        queueVersionRef.current = queueRecord.version;
        systemStateRef.current = queueRecord.state;
        setSystemState(queueRecord.state);
        setIsLoading(false);

        unsubscribeFromQueueState = subscribeToQueueState((updatedRecord) => {
          if (requestWasCancelled) {
            return;
          }

          const currentVersion = queueVersionRef.current ?? 0;

          if (updatedRecord.version <= currentVersion) {
            return;
          }

          queueVersionRef.current = updatedRecord.version;
          systemStateRef.current = updatedRecord.state;
          setSystemState(updatedRecord.state);
        });
      } catch (loadError) {
        if (requestWasCancelled) {
          return;
        }

        console.error("Could not initialize the shared queue.", loadError);
        setError(`Could not load the player list: ${loadError.message}`);
        setIsLoading(false);
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
      console.error("The shared queue has not finished loading yet.");
      setError("Still connecting to the player list — try again in a moment.");
      return null;
    }

    try {
      const currentState = systemStateRef.current;
      const nextState = stateTransition(currentState);

      const updatedRecord = await updateQueueState(nextState, currentVersion);

      queueVersionRef.current = updatedRecord.version;
      systemStateRef.current = updatedRecord.state;
      setSystemState(updatedRecord.state);

      return updatedRecord;
    } catch (commitError) {
      console.error("Could not save the shared queue change.", commitError);
      setError(commitError.message);
      return null;
    }
  }

  async function handleAddPlayer({ name, skillLevel }) {
    const currentPlayers = systemStateRef.current.players;

    const registrationError = getPlayerRegistrationError(currentPlayers, name);

    if (registrationError) {
      setError(registrationError);
      return;
    }

    const updatedRecord = await commitSharedStateChange((currentState) =>
      registerPlayerState(currentState, { name, skillLevel }),
    );

    if (updatedRecord) {
      setError("");
    }
  }

  function requestPlayerRemoval(playerId) {
    setPendingRemovalPlayerId(playerId);
  }

  function cancelPlayerRemoval() {
    setPendingRemovalPlayerId(null);
  }

  async function confirmPlayerRemoval(playerId) {
    const updatedRecord = await commitSharedStateChange((currentState) =>
      removePlayerState(currentState, playerId),
    );

    if (!updatedRecord) {
      return;
    }

    setPendingRemovalPlayerId(null);
  }

  const players = systemState.players ?? [];

  return (
    <div>
      <header className="top-bar">
              <Navbar />
    </header>

      <div className="container">
        <div className="leftPanel">
          <img src="src/assets/logo.png" alt="Description" />
          <div className="text">
            <div className="heading">Let's Start Playing!</div>
            <div className="paragraph">Add players and we'll do the rest.</div>
          </div>

          {error && <p className="landing-error">{error}</p>}

          <PlayerForm onAddPlayer={handleAddPlayer} existingPlayers={players} />
        </div>

        <Playerlist
          players={players}
          isLoading={isLoading}
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