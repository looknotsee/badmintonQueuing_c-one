import { useState } from "react";
import "./playerlist.css";

import { FaUsers } from "react-icons/fa";

export default function Playerlist() {
    
return (
    <div className="playerlist-container">
        <div className = "playerlist-content">
            <div className="playerlistHeader">
                <p>
                <FaUsers /> Player List
                </p>
            </div>
        </div>
    </div>
  );

}