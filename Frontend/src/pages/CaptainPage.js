import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import MapView from "../components/MapView";
import BACKEND_URL from "../config";

const CaptainPage = () => {
  const navigate = useNavigate();
  const user   = JSON.parse(localStorage.getItem("bolacabs_user") || "{}");
  const tkn    = localStorage.getItem("bolacabs_token");

  const socketRef = useRef(null);
  if (!socketRef.current) {
    socketRef.current = io(BACKEND_URL, { auth: { token: tkn } });
  }
  const socket = socketRef.current;

  const [isOnline,     setIsOnline]     = useState(false);
  const [connected,    setConnected]    = useState(false);
  const [rides,        setRides]        = useState([]);
  const [acceptedRide, setAcceptedRide] = useState(null);
  const [earnings,     setEarnings]     = useState(user.earnings   || 0);
  const [totalRides,   setTotalRides]   = useState(user.totalRides || 0);
  const [rating]                        = useState(user.rating     || 4.8);
  const [toast,        setToast]        = useState("");
  const [mapRide,      setMapRide]      = useState(null);

  /* ─── Account drawer + trip history ─────────────────────── */
  const [showAccount,  setShowAccount]  = useState(false);
  const [tripHistory,  setTripHistory]  = useState([]);   // completed trips this session

  /* ─── Panel tab inside drawer ────────────────────────────── */
  const [drawerTab, setDrawerTab] = useState("profile"); // profile | history | earnings

  const toastTimer = useRef(null);

  /* ─── Auto-connect + join vehicle room ───────────────────── */
  useEffect(() => {
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("captain online", { token: tkn });
    });
    socket.on("disconnect", () => setConnected(false));
    return () => { socket.off("connect"); socket.off("disconnect"); };
  }, [socket, tkn]);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  };

  const goOnline  = () => { setIsOnline(true);  showToast("You are now online 🟢"); };
  const goOffline = () => { setIsOnline(false); setMapRide(null); showToast("You are now offline ⚫"); };

  /* ─── Stats from server ───────────────────────────────────── */
  useEffect(() => {
    socket.on("stats updated", ({ earnings: e, totalRides: t }) => {
      setEarnings(e);
      setTotalRides(t);
    });
    return () => socket.off("stats updated");
  }, [socket]);

  /* ─── New ride broadcast ──────────────────────────────────── */
  useEffect(() => {
    socket.on("new ride", (ride) => {
      setRides((prev) => {
        if (prev.find((r) => r.rideId === ride.rideId)) return prev;
        return [ride, ...prev];
      });
      setMapRide(ride);
      setIsOnline((online) => {
        if (online) showToast("🔔 New ride request nearby!");
        return online;
      });
    });
    return () => socket.off("new ride");
  }, [socket]);

  /* ─── Someone else accepted ───────────────────────────────── */
  useEffect(() => {
    socket.on("ride accepted", (data) => {
      setRides((prev) => prev.filter((r) => r.rideId !== data.rideId));
      setMapRide((prev) => prev?.rideId === data.rideId ? null : prev);
    });
    return () => socket.off("ride accepted");
  }, [socket]);

  /* ─── Ride completed event ────────────────────────────────── */
  useEffect(() => {
    socket.on("ride completed", ({ rideId }) => {
      if (acceptedRide?.rideId === rideId) {
        setAcceptedRide(null);
        setMapRide(null);
      }
    });
    return () => socket.off("ride completed");
  }, [acceptedRide]);

  const acceptRide = (ride) => {
    socket.emit("accept ride", {
      rideId:      ride.rideId,
      captainId:   user._id,
      captainName: user.name
    });
    setAcceptedRide(ride);
    setMapRide(ride);
    setRides((prev) => prev.filter((r) => r.rideId !== ride.rideId));
    showToast("✅ Ride accepted! Head to pickup.");
  };

  const rejectRide = (rideId) => {
    setRides((prev) => prev.filter((r) => r.rideId !== rideId));
    setMapRide((prev) => prev?.rideId === rideId ? null : prev);
    showToast("Ride skipped");
  };

  const completeRide = () => {
    if (!acceptedRide) return;
    /* Save to local trip history */
    const tripRecord = {
      id:        acceptedRide.rideId,
      date:      new Date(),
      pickup:    acceptedRide.pickup?.address || "Pickup",
      dropoff:   acceptedRide.dropoff?.address || "Dropoff",
      fare:      acceptedRide.fare,
      distKm:    acceptedRide.distKm,
      rideType:  acceptedRide.rideType,
      payment:   acceptedRide.paymentMethod || "cash",
    };
    setTripHistory((prev) => [tripRecord, ...prev]);
    setTotalRides((n) => n + 1);
    setEarnings((e) => e + (acceptedRide.fare || 0));

    socket.emit("complete ride", {
      rideId:    acceptedRide.rideId,
      captainId: user._id,
      fare:      acceptedRide.fare
    });
    setAcceptedRide(null);
    setMapRide(null);
    showToast("🏁 Ride completed!");
  };

  const logout = () => {
    localStorage.removeItem("bolacabs_user");
    localStorage.removeItem("bolacabs_token");
    navigate("/");
  };

  const mapPickup  = mapRide?.pickup  || null;
  const mapDropoff = mapRide?.dropoff || null;

  const vehicleLabel = {
    go: "UCab Go 🚗", premier: "Premier 🚙",
    auto: "Auto 🛺",  bike: "Bike 🏍️"
  }[user.vehicle?.type] || "Captain";

  const vehicleIcon = {
    go: "🚗", premier: "🚙", auto: "🛺", bike: "🏍️"
  }[user.vehicle?.type] || "🚗";

  /* ─── Acceptance rate (session) ─────────────────────────── */
  const totalSeen = useRef(0);
  const acceptCount = useRef(0);
  const acceptRate = totalSeen.current > 0
    ? Math.round((acceptCount.current / totalSeen.current) * 100) : 100;

  /* ─── Today's earnings (session) ────────────────────────── */
  const todayEarnings = tripHistory.reduce((s, t) => s + t.fare, 0);

  return (
    <div className="uber-layout">

      {/* ── Full-screen map ── */}
      <div className="map-fullscreen">
        <MapView pickup={mapPickup} dropoff={mapDropoff} height="100%" />
      </div>

      {/* ── Top bar ── */}
      <div className="top-bar">
        <div className="top-bar-logo">UCab <span className="logo-accent">Services</span></div>
        <div className="top-bar-right">
          <div className="vehicle-badge">{vehicleLabel}</div>
          <button className="account-btn" onClick={() => setShowAccount(true)}>
            <div className="avatar cap-avatar">
              {user.name?.[0]?.toUpperCase() || "C"}
            </div>
          </button>
        </div>
      </div>

      {/* ── Captain Account Drawer ── */}
      {showAccount && (
        <div className="drawer-overlay" onClick={() => setShowAccount(false)}>
          <div className="account-drawer cap-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle" />

            {/* Profile header */}
            <div className="cap-drawer-header">
              <div className="cap-drawer-avatar">{user.name?.[0]?.toUpperCase() || "C"}</div>
              <div className="cap-drawer-info">
                <div className="drawer-name">{user.name || "Captain"}</div>
                <div className="drawer-phone">{user.phone || ""}</div>
                <div className="cap-status-pill">
                  {isOnline ? "🟢 Online" : "⚫ Offline"}
                </div>
              </div>
              <div className="cap-drawer-rating">
                <div className="big-rating">⭐ {rating}</div>
                <div style={{ fontSize: 11, color: "#888" }}>rating</div>
              </div>
            </div>

            {/* Drawer tab bar */}
            <div className="drawer-tabs">
              {[
                { id: "profile",  label: "Profile"  },
                { id: "history",  label: "Trips"     },
                { id: "earnings", label: "Earnings"  },
              ].map((t) => (
                <button key={t.id}
                  className={`drawer-tab-btn ${drawerTab === t.id ? "active" : ""}`}
                  onClick={() => setDrawerTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ─── Profile tab ─────────────────────────────────── */}
            {drawerTab === "profile" && (
              <>
                {/* Stats row — like Uber/Rapido dashboard */}
                <div className="cap-stats-grid">
                  <div className="cap-stat-box">
                    <div className="cap-stat-icon">💰</div>
                    <div className="cap-stat-val green">₹{earnings}</div>
                    <div className="cap-stat-lbl">Total Earned</div>
                  </div>
                  <div className="cap-stat-box">
                    <div className="cap-stat-icon">🚗</div>
                    <div className="cap-stat-val blue">{totalRides}</div>
                    <div className="cap-stat-lbl">Total Rides</div>
                  </div>
                  <div className="cap-stat-box">
                    <div className="cap-stat-icon">⭐</div>
                    <div className="cap-stat-val gold">{rating}</div>
                    <div className="cap-stat-lbl">Rating</div>
                  </div>
                  <div className="cap-stat-box">
                    <div className="cap-stat-icon">✅</div>
                    <div className="cap-stat-val green">{acceptRate}%</div>
                    <div className="cap-stat-lbl">Acceptance</div>
                  </div>
                </div>

                {/* Vehicle card */}
                {user.vehicle && (
                  <>
                    <div className="drawer-section-title">My Vehicle</div>
                    <div className="cap-vehicle-card">
                      <div className="cap-vehicle-icon">{vehicleIcon}</div>
                      <div className="cap-vehicle-info">
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#eee" }}>
                          {user.vehicle.color} {user.vehicle.model}
                        </div>
                        <div style={{ fontSize: 13, color: "#888", marginTop: 3 }}>
                          {user.vehicle.plate}
                        </div>
                        <div className="vehicle-type-pill" style={{ marginTop: 6, display: "inline-block" }}>
                          {user.vehicle.type?.toUpperCase()}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Today */}
                <div className="drawer-section-title">Today</div>
                <div className="cap-today-row">
                  <div className="cap-today-card">
                    <div className="cap-stat-val green">₹{todayEarnings}</div>
                    <div className="cap-stat-lbl">Earned</div>
                  </div>
                  <div className="cap-today-card">
                    <div className="cap-stat-val blue">{tripHistory.length}</div>
                    <div className="cap-stat-lbl">Trips</div>
                  </div>
                  <div className="cap-today-card">
                    <div className="cap-stat-val" style={{ color: "#f39c12" }}>{rides.length}</div>
                    <div className="cap-stat-lbl">Pending</div>
                  </div>
                </div>

                <button className="btn-primary" style={{ marginTop: 20, background: "#e74c3c" }}
                  onClick={logout}>🚪 Logout</button>
              </>
            )}

            {/* ─── Trip History tab ─────────────────────────────── */}
            {drawerTab === "history" && (
              <>
                <div className="drawer-section-title">
                  Trip History ({tripHistory.length} this session)
                </div>
                {tripHistory.length === 0 ? (
                  <div className="empty-state" style={{ paddingTop: 24 }}>
                    <div className="empty-icon">🕐</div>
                    <p>No completed trips yet</p>
                    <span>Complete rides to see history here</span>
                  </div>
                ) : (
                  <div className="trip-history-list">
                    {tripHistory.map((trip, i) => (
                      <div key={trip.id || i} className="trip-history-card">
                        <div className="thc-top">
                          <div className="thc-fare">₹{trip.fare}</div>
                          <div className="thc-meta">
                            <span className="thc-type">{trip.rideType?.toUpperCase()}</span>
                            <span className="thc-pay">{trip.payment === "cash" ? "💵 Cash" : "📲 UPI"}</span>
                          </div>
                          <div className="thc-time">
                            {trip.date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                          </div>
                        </div>
                        <div className="thc-route">
                          <div className="thc-row">
                            <span className="trs-dot green" style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
                            <span className="thc-addr">{trip.pickup}</span>
                          </div>
                          <div className="thc-row">
                            <span className="trs-dot red" style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
                            <span className="thc-addr">{trip.dropoff}</span>
                          </div>
                        </div>
                        {trip.distKm && (
                          <div className="thc-dist">📏 {trip.distKm} km</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ─── Earnings tab ────────────────────────────────── */}
            {drawerTab === "earnings" && (
              <>
                <div className="drawer-section-title">Earnings Breakdown</div>
                <div className="earnings-overview">
                  <div className="earn-big-card">
                    <div style={{ fontSize: 12, color: "#888" }}>Session Earnings</div>
                    <div className="earn-big-amt">₹{todayEarnings}</div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{tripHistory.length} trips completed</div>
                  </div>
                  <div className="earn-big-card">
                    <div style={{ fontSize: 12, color: "#888" }}>All-time Earnings</div>
                    <div className="earn-big-amt">₹{earnings}</div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{totalRides} total rides</div>
                  </div>
                </div>

                <div className="drawer-section-title">Per-trip breakdown</div>
                {tripHistory.length === 0 ? (
                  <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                    No trips yet this session
                  </div>
                ) : (
                  <div className="earn-breakdown-list">
                    {tripHistory.map((trip, i) => (
                      <div key={i} className="earn-row">
                        <div>
                          <div style={{ fontSize: 13, color: "#ccc", fontWeight: 600 }}>
                            {trip.dropoff.length > 28 ? trip.dropoff.slice(0, 28) + "…" : trip.dropoff}
                          </div>
                          <div style={{ fontSize: 11, color: "#666" }}>
                            {trip.date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} · {trip.rideType}
                          </div>
                        </div>
                        <div className="earn-row-fare">+₹{trip.fare}</div>
                      </div>
                    ))}
                    <div className="earn-total-row">
                      <span>Total</span>
                      <span className="earn-row-fare">₹{todayEarnings}</span>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      )}

      {/* ── Captain Bottom Panel ── */}
      <div className="captain-bottom-panel">

        <div className="online-toggle-section">
          <div className="online-info">
            <h3>
              {isOnline ? "🟢 You're Online" : "⚫ You're Offline"}
              {!connected && <span style={{ fontSize: 11, color: "#e74c3c", marginLeft: 8 }}>● reconnecting…</span>}
            </h3>
            <p style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
              {isOnline ? `Receiving ${user.vehicle?.type || ""} ride requests` : "Toggle to start earning"}
            </p>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={isOnline}
              onChange={(e) => e.target.checked ? goOnline() : goOffline()} />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="captain-info-row">
          <span className="captain-name-badge">👤 {user.name || "Captain"}</span>
          {user.vehicle && (
            <span className="plate-badge">
              {user.vehicle.color} {user.vehicle.model} · {user.vehicle.plate}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value green">₹{earnings}</div>
            <div className="stat-label">Earnings</div>
          </div>
          <div className="stat-card">
            <div className="stat-value blue">{totalRides}</div>
            <div className="stat-label">Rides</div>
          </div>
          <div className="stat-card">
            <div className="stat-value gold">⭐ {rating}</div>
            <div className="stat-label">Rating</div>
          </div>
          <div className="stat-card" onClick={() => { setShowAccount(true); setDrawerTab("history"); }}
            style={{ cursor: "pointer" }}>
            <div className="stat-value" style={{ color: "#f39c12" }}>{tripHistory.length}</div>
            <div className="stat-label">History</div>
          </div>
        </div>

        {/* Active ride */}
        {acceptedRide && (
          <div className="accepted-card" style={{ marginBottom: 12 }}>
            <h3>🚗 Ride in Progress</h3>
            <div className="route-info">
              <div className="route-row">
                <div className="route-dot green" />
                <div className="route-text">{acceptedRide.pickup?.address || "Pickup"}</div>
              </div>
              <div className="route-row">
                <div className="route-dot red" />
                <div className="route-text">{acceptedRide.dropoff?.address || "Dropoff"}</div>
              </div>
            </div>
            {acceptedRide.paymentMethod && (
              <div style={{ fontSize: 12, color: "#888", marginTop: 6 }}>
                {acceptedRide.paymentMethod === "cash" ? "💵 Cash" : "📲 UPI"} payment
                {acceptedRide.scheduledAt && (
                  <span style={{ marginLeft: 8 }}>
                    📅 {new Date(acceptedRide.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </span>
                )}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <span style={{ color: "#1db954", fontWeight: 800, fontSize: 20 }}>₹{acceptedRide.fare}</span>
              <button className="accept-btn" style={{ width: "auto", padding: "10px 20px" }} onClick={completeRide}>
                🏁 Complete
              </button>
            </div>
          </div>
        )}

        {/* Ride requests */}
        <div className="rides-section-title">
          Ride Requests
          {rides.length > 0 && <span className="badge">{rides.length}</span>}
        </div>

        {!isOnline ? (
          <div className="empty-state">
            <div className="empty-icon">🔌</div>
            <p>You're offline</p>
            <span>Toggle online to get rides</span>
          </div>
        ) : rides.length === 0 && !acceptedRide ? (
          <div className="empty-state">
            <div className="empty-icon">🕐</div>
            <p>No ride requests yet</p>
            <span>Waiting for {user.vehicle?.type || ""} riders…</span>
          </div>
        ) : (
          <div className="ride-requests-list">
            {rides.map((ride) => (
              <div key={ride.rideId}
                className={`ride-request-card ${mapRide?.rideId === ride.rideId ? "highlighted" : ""}`}
                onClick={() => setMapRide(ride)}>
                <div className="ride-card-header">
                  <div className="fare">₹{ride.fare}</div>
                  <div>
                    <div className="ride-distance">{ride.distKm ? `${ride.distKm} km` : "~5 km"}</div>
                    <div className="ride-time">Just now</div>
                  </div>
                </div>
                <div className="route-info">
                  <div className="route-row">
                    <div className="route-dot green" />
                    <div className="route-text">
                      {ride.pickup?.address || `${ride.pickup?.lat?.toFixed(4)}, ${ride.pickup?.lng?.toFixed(4)}`}
                    </div>
                  </div>
                  <div className="route-row">
                    <div className="route-dot red" />
                    <div className="route-text">
                      {ride.dropoff?.address || `${ride.dropoff?.lat?.toFixed(4)}, ${ride.dropoff?.lng?.toFixed(4)}`}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 12, display: "flex", gap: 8 }}>
                  <span>{ride.rideType}</span>
                  {ride.paymentMethod && <span>{ride.paymentMethod === "cash" ? "💵 Cash" : "📲 UPI"}</span>}
                  {ride.scheduledAt && <span>📅 Scheduled</span>}
                </div>
                <div className="ride-card-actions">
                  <button className="accept-btn" onClick={(e) => { e.stopPropagation(); acceptRide(ride); }}>
                    ✅ Accept
                  </button>
                  <button className="reject-btn" onClick={(e) => { e.stopPropagation(); rejectRide(ride.rideId); }}>
                    ✕ Skip
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
};

export default CaptainPage;
