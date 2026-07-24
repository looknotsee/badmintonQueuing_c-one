import { useState, useRef, useEffect } from "react";
import "./navbar.css";
import logo from "../../assets/Logo.png";

import { FaHome } from "react-icons/fa";
import { FaUsers } from "react-icons/fa";

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // reference to the navbar
  const navRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        navRef.current &&
        !navRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  return (
    <>
      <button
        className="menuBtn"
        onClick={() => setOpen(!open)}
      >
        ☰
      </button>

      <nav
        ref={navRef}
        className={`navbar ${open ? "show" : ""}`}
      >
        <div className="logo">
          <img
            className="logoImg"
            src={logo}
            alt="C-ONE Logo"
          />
        </div>

        <div className="divider"></div>

        <a className="navBtn" href="/">
          <FaHome /> Home
        </a>

        <a className="navBtn" href="/session">
          <FaUsers /> Session
        </a>
      </nav>
    </>
  );
}