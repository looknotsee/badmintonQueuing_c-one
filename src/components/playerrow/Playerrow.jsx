import { formatSeconds } from "../utils/formatSeconds";
import "./playerRow.css";

function PlayerRow({ player }) {
  if (!player) {
    return <div className="player-row">Unknown player</div>;
  }

  return (
    <div className="player-row">
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

export default PlayerRow;