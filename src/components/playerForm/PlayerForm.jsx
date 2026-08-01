import { useState, useEffect } from "react";
import "./playerform.css";
import {
  FaUserPlus,
  FaSearch,
  FaPlus,
} from "react-icons/fa";

export default function PlayerForm({
  onAddPlayer,
  existingPlayers = [],
  isDisabled = false
}) {
  const [name, setName] = useState("");
  const [skill, setSkill] = useState("");
  const [selectedPlayerId, setSelectedPlayerId] =
    useState(null);
  const [showSuggestions, setShowSuggestions] =
    useState(false);
  const [error, setError] = useState("");

  const skillLevels = [
    "Unknown",
    "Beginner",
    "Intermediate",
    "Expert",
    "Guest",
  ];

  const normalizedName =
    name.trim().toLowerCase();

  const returningMatches =
    normalizedName && !selectedPlayerId
      ? existingPlayers.filter((player) =>
          player.name
            .toLowerCase()
            .includes(normalizedName),
        )
      : [];

  function handleClear() {
    setName("");
    setSkill("");
    setSelectedPlayerId(null);
    setShowSuggestions(false);
    setError("");
  }

  useEffect(() => {
  if (isDisabled) {
    handleClear();
  }
  }, [isDisabled]);

  function handleNameChange(event) {
    const nextName = event.target.value;

    /*
     * Editing a selected returning player's name
     * changes the entry back into a new typed player.
     */
    if (selectedPlayerId) {
      setSkill("");
    }

    setName(nextName);
    setSelectedPlayerId(null);
    setShowSuggestions(true);
    setError("");
  }

  function handleSelectReturningPlayer(player) {
    setName(player.name);
    setSelectedPlayerId(player.id);
    setSkill(
      player.skillLevel || "Unknown",
    );
    setShowSuggestions(false);
    setError("");
  }

  async function handleAdd() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Player name is required.");
      return;
    }

    try {
      const playerWasAdded =
        await onAddPlayer?.({
          playerId: selectedPlayerId,
          name: trimmedName,
          skillLevel: skill || "Unknown",
        });

      if (!playerWasAdded) {
        return;
      }

      handleClear();
    } catch (addError) {
      setError(
        addError.message ||
          "Could not add the player.",
      );
    }
  }

  return (
    <div className="playerform-container">
      <div className="playerform-content">
        <div className="playerformHeader">
          <p>
            <FaUserPlus />
            Add player to queue
          </p>
        </div>

        <div className="playerform-fields">
          <p className="note">PLAYER NAME</p>

          <div className="search-wrapper">
            <div className="search">
              <input
                className="search-input"
                type="text"
                placeholder="Type a new or returning player's name..."
                value={name}
                autoComplete="off"
                disabled={isDisabled}
                onChange={handleNameChange}
                onFocus={() =>
                  setShowSuggestions(true)
                }
                onBlur={() =>
                  setShowSuggestions(false)
                }
              />

              <FaSearch className="search-icon" />
            </div>

            {showSuggestions &&
              returningMatches.length > 0 && (
                <ul className="search-results">
                  {returningMatches
                    .slice(0, 5)
                    .map((player) => (
                      <li key={player.id}>
                        <button
                          type="button"
                          className="search-result-item"
                          onMouseDown={(event) =>
                            event.preventDefault()
                          }
                          onClick={() =>
                            handleSelectReturningPlayer(
                              player,
                            )
                          }
                        >
                          <span>{player.name}</span>

                          <span className="search-result-skill">
                            {player.skillLevel}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
          </div>

          {selectedPlayerId && (
            <p className="returning-player-note">
              Returning player selected. Their saved
              skill level will be used.
            </p>
          )}

          <p className="note">SKILL LEVEL</p>

          <div className="skill-row">
            {skillLevels.map((level) => (
              <button
                key={level}
                type="button"
                disabled={
                  isDisabled ||
                  Boolean(selectedPlayerId)
                }
                aria-pressed={skill === level}
                className={`skill-btn skill-btn--${level} ${
                  skill === level
                    ? "skill-btn--active"
                    : ""
                }`}
                onClick={() =>
                  setSkill(level)
                }
              >
                {level}
              </button>
            ))}
          </div>

          {error && (
            <p className="form-error">
              {error}
            </p>
          )}

          <div className="action-row">
            <button
              className="add-btn"
              type="button"
              disabled={isDisabled}
              onClick={handleAdd}
            >
              <FaPlus />
              Add to Pool
            </button>

            <button
              className="clear-btn"
              type="button"
              onClick={handleClear}
              disabled={isDisabled}
            >
              Clear Name
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}