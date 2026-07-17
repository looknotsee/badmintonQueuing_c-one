import "./PlayerPool.css";
import PlayerPoolCard from "./PlayerPoolCard";

function PlayerPoolModal({
  isOpen,
  onClose,
  filteredPlayers,
  playerSearch,
  setPlayerSearch,
  playerStatusFilter,
  setPlayerStatusFilter,
  pendingRemovalPlayerId,
  requestPlayerRemoval,
  cancelPlayerRemoval,
  confirmPlayerRemoval,
  findPlayerLocation,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card wide"
        role="dialog"
      >
        <div className="management-heading">
          <div>
            <p className="management-kicker">
              Live attendance
            </p>

            <h1>Current player pool</h1>

            <p>
              Search the full pool and see where every
              registered player is currently assigned.
            </p>
          </div>

          <div className="management-heading-actions">
            <div className="management-count">
              <strong>{filteredPlayers.length}</strong>
              <span>shown</span>
            </div>

            <button
              className="match-editor-close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </div>

        <div className="player-pool-toolbar">
          <div className="form-field">
            <label>Search players</label>

            <input
              type="search"
              value={playerSearch}
              onChange={(e) =>
                setPlayerSearch(e.target.value)
              }
            />
          </div>

          <div className="form-field">
            <label>Status</label>

            <select
              value={playerStatusFilter}
              onChange={(e) =>
                setPlayerStatusFilter(e.target.value)
              }
            >
              <option value="all">
                All statuses
              </option>
              <option value="queued">
                Queued
              </option>
              <option value="inGame">
                In game
              </option>
              <option value="available">
                Available
              </option>
            </select>
          </div>
        </div>

        <div className="player-pool-grid">
          {filteredPlayers.map((player) => (
            <PlayerPoolCard
              key={player.id}
              player={player}
              playerLocation={findPlayerLocation(
                player.id
              )}
              pendingRemovalPlayerId={
                pendingRemovalPlayerId
              }
              requestPlayerRemoval={
                requestPlayerRemoval
              }
              cancelPlayerRemoval={
                cancelPlayerRemoval
              }
              confirmPlayerRemoval={
                confirmPlayerRemoval
              }
            />
          ))}

          {filteredPlayers.length === 0 && (
            <div className="player-pool-empty">
              No players match the current filters.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default PlayerPoolModal;