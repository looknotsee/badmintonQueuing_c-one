import { formatSeconds } from "../utils/Formatseconds";
import "./playerPool.css";

const GAME_FEE_PESOS = 15;

function PlayerPoolCard({
  player,
  playerLocation,
  pendingRemovalPlayerId,
  requestPlayerRemoval,
  cancelPlayerRemoval,
  confirmPlayerRemoval,
}) {
  const removalIsPending =
    pendingRemovalPlayerId === player.id;

  const playerCanBeRemoved =
    player.status !== "inGame";

  const gamesPlayed = Number(player.gamesPlayed) || 0;
  const amountDue = gamesPlayed * GAME_FEE_PESOS;

  return (
    <article
      className={`player-pool-item ${player.status.toLowerCase()}`}
    >
      <div className="player-pool-item-header">
        <div
          className="player-pool-avatar"
          aria-hidden="true"
        >
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
        >
          Remove
        </button>

        <span
          className={`pool-status-badge ${player.status.toLowerCase()}`}
        >
          {player.status === "inGame"
            ? "In game"
            : player.status}
        </span>
      </div>

      {removalIsPending && (
        <div className="remove-player-confirmation">
          <p>
            Remove <strong>{player.name}</strong> from the current
            player pool?
          </p>

          <div className="remove-player-confirmation-actions">
            <button
              className="secondary-button"
              onClick={cancelPlayerRemoval}
            >
              Cancel
            </button>

            <button
              className="danger-button"
              onClick={() =>
                confirmPlayerRemoval(player.id)
              }
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
          <strong>{gamesPlayed}</strong>
        </div>

        <div className="player-pool-stat">
          <span>Total playtime</span>
          <strong>
            {formatSeconds(player.totalTimePlayed)}
          </strong>
        </div>

        <div className="player-pool-stat payment-due">
        <span>Amount due</span>
          <strong>
            ₱{amountDue.toLocaleString("en-PH")}
          </strong>
        </div>
        
      </div>
    </article>
  );
}

export default PlayerPoolCard;