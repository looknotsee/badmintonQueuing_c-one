import { FaUsers, FaTimes } from "react-icons/fa";
import "./playerlist.css";

const STATUS_LABELS = {
  available: "Available",
  queued: "Queued",
  inGame: "In game",
};

function sortPlayersByName(players) {
  return [...players].sort((a, b) => a.name.localeCompare(b.name));
}

export default function Playerlist({
  players = [],
  isLoading = false,
  pendingRemovalPlayerId,
  requestPlayerRemoval,
  cancelPlayerRemoval,
  confirmPlayerRemoval,
}) {
  const orderedPlayers = sortPlayersByName(players);

  const getInitials = (player) =>
    player.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  return (
    <div className="playerlist-container">
      <div className="playerlist-content">
        <div className="playerlistHeader">
          <p>
            <FaUsers /> Player List
          </p>
          {orderedPlayers.length > 0 && (
            <span className="playerlist-count">{orderedPlayers.length}</span>
          )}
        </div>

        {isLoading ? (
          <div className="playerlist-empty">
            <p>Loading players…</p>
          </div>
        ) : orderedPlayers.length === 0 ? (
          <div className="playerlist-empty">
            <FaUsers className="playerlist-empty-icon" />
            <p>No players added yet</p>
          </div>
        ) : (
          <ul className="playerlist-items">
            {orderedPlayers.map((player, index) => {
              const removalIsPending = pendingRemovalPlayerId === player.id;
              const playerCanBeRemoved = player.status !== "inGame";

              return (
                <li key={player.id} className="playerlist-item-wrapper">
                  <div className="playerlist-item">
                    <span className="playerlist-position">{index + 1}</span>

                    <div className="playerlist-avatar" aria-hidden="true">
                      {getInitials(player)}
                    </div>

                    <span className="playerlist-name">{player.name}</span>

                    <span
                      className={`playerlist-skill playerlist-skill--${player.skillLevel}`}
                    >
                      {player.skillLevel}
                    </span>

                    <span
                      className={`playerlist-status playerlist-status--${player.status}`}
                    >
                      {STATUS_LABELS[player.status] ?? player.status}
                    </span>

                    <button
                      type="button"
                      className="playerlist-remove"
                      onClick={() => requestPlayerRemoval?.(player.id)}
                      disabled={!playerCanBeRemoved}
                      title={
                        playerCanBeRemoved
                          ? `Remove ${player.name}`
                          : "Players cannot be removed during an active match."
                      }
                    >
                      <FaTimes />
                    </button>
                  </div>

                  {removalIsPending && (
                    <div className="playerlist-remove-confirmation">
                      <p>
                        Remove <strong>{player.name}</strong> from the player
                        list?
                      </p>
                      <div className="playerlist-remove-confirmation-actions">
                        <button
                          type="button"
                          className="playerlist-cancel-btn"
                          onClick={() => cancelPlayerRemoval?.()}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="playerlist-confirm-btn"
                          onClick={() => confirmPlayerRemoval?.(player.id)}
                        >
                          Confirm Remove
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}