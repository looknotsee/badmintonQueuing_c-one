import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";
import Landing from "./landingpage/landing.jsx";
import App from "./App.jsx";

function AppRoot() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/session" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoot;