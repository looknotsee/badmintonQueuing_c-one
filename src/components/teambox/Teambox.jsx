import PlayerRow from "../playerRow/PlayerRow";
import "./teamBox.css"

function TeamBox({ playerIds, players }) {
  function findPlayerById(playerId) {
    return players.find((player) => player.id === playerId);
  }

  return (
    <div className="team-box">
      {playerIds.map((playerId) => (
        <PlayerRow key={playerId} player={findPlayerById(playerId)} />
      ))}
    </div>
  );
}

export default TeamBox;