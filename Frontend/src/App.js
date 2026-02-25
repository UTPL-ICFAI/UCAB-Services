import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import UserLoginPage    from "./pages/UserLoginPage";
import CaptainLoginPage from "./pages/CaptainLoginPage";
import UserPage         from "./pages/UserPage";
import CaptainPage      from "./pages/CaptainPage";
import "./App.css";

const PrivateRoute = ({ children, expectedRole }) => {
  const token = localStorage.getItem("bolacabs_token");
  const user  = JSON.parse(localStorage.getItem("bolacabs_user") || "null");
  if (!token || !user) return <Navigate to="/login/user" replace />;
  if (expectedRole && user.role !== expectedRole) {
    return <Navigate to={user.role === "user" ? "/user" : "/captain"} replace />;
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default → rider login */}
        <Route path="/"               element={<Navigate to="/login/user" replace />} />
        <Route path="/login/user"     element={<UserLoginPage />} />
        <Route path="/login/captain"  element={<CaptainLoginPage />} />
        <Route path="/user"    element={<PrivateRoute expectedRole="user">   <UserPage />    </PrivateRoute>} />
        <Route path="/captain" element={<PrivateRoute expectedRole="captain"><CaptainPage /> </PrivateRoute>} />
        <Route path="*"        element={<Navigate to="/login/user" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;