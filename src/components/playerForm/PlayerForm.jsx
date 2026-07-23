import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./playerform.css"
import { FaUserPlus, FaSearch, FaPlay, FaPlus } from "react-icons/fa";

export default function PlayerForm({ onAddPlayer, existingPlayers = [] }) {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [skill, setSkill] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const skillLevels = ["Unknown", "Beginner", "Intermediate", "Expert", "Guest"];

  const handleClear = () => {
    setFirstName("");
    setLastName("");
    setSkill("");
    setSearch("");
    setError("");
  };

  const handleAdd = () => {
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst) {
      setError("First name is required.");
      return;
    }

    // The shared player list stores a single "name" field, so combine
    // first/last here before handing it off.
    const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(" ");

    onAddPlayer?.({
      name: fullName,
      skillLevel: skill || "Unknown",
    });

    setFirstName("");
    setLastName("");
    setSkill("");
    setError("");
  };

  const returningMatches = search.trim()
    ? existingPlayers.filter((player) =>
        player.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : [];

  const handleSelectReturningPlayer = (player) => {
    const [firstPart, ...restParts] = player.name.split(" ");
    setFirstName(firstPart ?? "");
    setLastName(restParts.join(" "));
    setSkill(player.skillLevel);
    setSearch("");
  };

  return (
    <div className="playerform-container">
      <div className="playerform-content">

        {/* Header */}
        <div className="playerformHeader">
          <p><FaUserPlus /> Add player to queue</p>
        </div>

        <div className="playerform-fields">

          {/* Search */}
          <div className="search-wrapper">
            <div className="search">
              <input
                className="search-input"
                type="text"
                placeholder="Search returning player by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <FaSearch className="search-icon" />
            </div>

            {returningMatches.length > 0 && (
              <ul className="search-results">
                {returningMatches.slice(0, 5).map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      className="search-result-item"
                      onClick={() => handleSelectReturningPlayer(player)}
                    >
                      {player.name}
                      <span className="search-result-skill">
                        {player.skillLevel}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Player Details */}
          <p className="note">PLAYER DETAILS</p>

          <div className="name-row">
            <div className="field-group">
              <label className="field-label">First Name</label>
              <input
                className="field-input"
                type="text"
                placeholder="e.g Maria"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Last Name</label>
              <input
                className="field-input"
                type="text"
                placeholder="e.g Santos"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
              />
            </div>
          </div>

          {/* Skill Level */}
          <p className="note">SKILL LEVEL</p>
          <div className="skill-row">
            {skillLevels.map(level => (
              <button
                key={level}
                className={`skill-btn skill-btn--${level} ${skill === level ? "skill-btn--active" : ""}`}
                onClick={() => setSkill(level)}
                type="button"
              >
                {level}
              </button>
            ))}
          </div>

          {error && <p className="form-error">{error}</p>}

          {/* Actions */}
          <div className="action-row">
            <button className="add-btn" type="button" onClick={handleAdd}>
              <FaPlus /> Add to Queue
            </button>
            <button className="clear-btn" type="button" onClick={handleClear}>
              Clear
            </button>
             <button className="start-btn" type="button" onClick={() => navigate("/session")}>
              Start Session
          </button>
          </div>

        </div>
      </div>
    </div>
  );
}