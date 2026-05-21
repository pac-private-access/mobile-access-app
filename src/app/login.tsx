"use client";

import { useState } from "react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      setMessage("Introduceti o adresa de email");
      return;
    }
    if (!password) {
      setMessage("Introduceti parola.");
      return;
    }

    ////// Authentication logic


  };

  return (
    <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "2rem", background: "#f5f7fb" }}>
      <section style={{ width: "100%", maxWidth: "400px", padding: "2rem", borderRadius: "16px", boxShadow: "0 16px 40px rgba(0, 0, 0, 0.08)", background: "#ffffff" }}>
        <h1 style={{ marginBottom: "1rem", fontSize: "1.75rem", color: "#111827" }}>Login</h1>
        <p style={{ marginBottom: "1.5rem", color: "#4b5563" }}>Enter your email and password to continue.</p>
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151" }} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="adresa@email.com"
            style={{ width: "100%", padding: "0.75rem 1rem", marginBottom: "1rem", borderRadius: "0.75rem", border: "1px solid #d1d5db", fontSize: "1rem" }}
          />

          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151" }} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Introduceti parola"
            style={{ width: "100%", padding: "0.75rem 1rem", marginBottom: "1.5rem", borderRadius: "0.75rem", border: "1px solid #d1d5db", fontSize: "1rem" }}
          />

          <button
            type="submit"
            style={{ width: "100%", padding: "0.85rem 1rem", borderRadius: "0.75rem", border: "none", background: "#2563eb", color: "white", fontWeight: 700, fontSize: "1rem", cursor: "pointer" }}
          >
            Sign in
          </button>
        </form>
        {message && <p style={{ marginTop: "1rem", color: "#2563eb" }}>{message}</p>}
      </section>
    </main>
  );
}
