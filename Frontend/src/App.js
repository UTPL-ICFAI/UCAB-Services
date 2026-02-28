import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import UserLoginPage from "./pages/UserLoginPage";
import CaptainLoginPage from "./pages/CaptainLoginPage";
import UserPage from "./pages/UserPage";
import CaptainPage from "./pages/CaptainPage";
import LandingPage from "./pages/LandingPage";

// ── Fleet & misc pages ────────────────────────────────────────
import NotificationsPage from "./pages/NotificationsPage";
import FleetOwnerLoginPage from "./pages/fleet/FleetOwnerLoginPage";
import FleetOwnerDashboard from "./pages/fleet/FleetOwnerDashboard";
import FleetOwnerRegister from "./pages/fleet/FleetOwnerRegister";
import FleetVehicleRegister from "./pages/fleet/FleetVehicleRegister";
import FleetBookingPage from "./pages/fleet/FleetBookingPage";

import "./App.css";

/* ── Rider / Captain guard ─────────────────────────────────── */
const PrivateRoute = ({ children, expectedRole }) => {
  const token = localStorage.getItem("ucab_token");
  const user = JSON.parse(localStorage.getItem("ucab_user") || "null");
  if (!token || !user) return <Navigate to="/" replace />;
  if (expectedRole && user.role !== expectedRole) {
    return <Navigate to={user.role === "user" ? "/user" : "/captain"} replace />;
  }
  return children;
};

/* ── Fleet Owner guard ─────────────────────────────────────── */
const FleetPrivateRoute = ({ children }) => {
  const owner = localStorage.getItem("fleet_owner");
  return owner ? children : <Navigate to="/login/fleet" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page — role picker */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth */}
        <Route path="/login/user" element={<UserLoginPage />} />
        <Route path="/login/captain" element={<CaptainLoginPage />} />
        <Route path="/login/fleet" element={<FleetOwnerLoginPage />} />

        {/* Protected dashboards */}
        <Route path="/user" element={<PrivateRoute expectedRole="user">   <UserPage />    </PrivateRoute>} />
        <Route path="/captain" element={<PrivateRoute expectedRole="captain"><CaptainPage /> </PrivateRoute>} />
        <Route path="/fleet/dashboard" element={<FleetPrivateRoute><FleetOwnerDashboard /></FleetPrivateRoute>} />

        {/* Misc / public pages */}
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/fleet/register-owner" element={<FleetOwnerRegister />} />
        <Route path="/fleet/add-vehicle" element={<FleetVehicleRegister />} />
        <Route path="/fleet/book" element={<FleetBookingPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;