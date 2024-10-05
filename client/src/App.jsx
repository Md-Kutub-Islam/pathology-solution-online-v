import React from "react";
import "./App.css";
import UserLayOut from "./layout/UserLayOut";
import { RegistrationPage, LoginPage } from "./pages/user-pages";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import VerifyEmail from "./components/user-components/auth/VerifyEmail";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* Customer Routes with Nested Children */}
          <Route path="/user" element={<UserLayOut />}>
            <Route index element={<RegistrationPage />} />{" "}
            {/* Default to Dashboard */}
            <Route path="register" element={<RegistrationPage />} />{" "}
            <Route path="login" element={<LoginPage />} />
            {/* Nested Route */}
          </Route>

          {/* Route for Email Verification (direct access) */}
          <Route path="/emailVerify" element={<VerifyEmail />} />

          {/* Admin Routes with Nested Children */}
          {/* <Route path="/admin" element={<AdminLayout />}>
      <Route index element={<AdminDashboard />} />
      <Route path="users" element={<AdminUsers />} />
    </Route> */}
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
