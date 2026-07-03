import { useState } from "react";
import "./playerform.css";
import { FaUserPlus, FaSearch, FaPlay, FaPlus } from "react-icons/fa";

export default function PlayerForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [skill, setSkill] = useState("");
  const [search, setSearch] = useState("");

  const skillLevels = ["Unknown", "Beginner", "Intermediate", "Expert", "Guest"];

  const handleClear = () => {
    setFirstName("");
    setLastName("");
    setSkill("");
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

          {/* Actions */}
          <div className="action-row">
            <button className="add-btn" type="button">
              <FaPlus /> Add to Queue
            </button>
            <button className="clear-btn" type="button" onClick={handleClear}>
              Clear
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}