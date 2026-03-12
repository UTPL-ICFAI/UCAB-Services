import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import axios from "axios";
import MapView from "../components/MapView";
import BACKEND_URL from "../config";

const CaptainPage = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("ucab_user") || "{}");
  const tkn = localStorage.getItem("ucab_token");

  const socketRef = useRef(null);
  if (!socketRef.current) {
    socketRef.current = io(BACKEND_URL, { auth: { token: tkn } });
  }
  const socket = socketRef.current;

  const [isOnline, setIsOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const [rides, setRides] = useState([]);
  const [acceptedRide, setAcceptedRide] = useState(null);
  const [earnings, setEarnings] = useState(user.earnings || 0);
  const [totalRides, setTotalRides] = useState(user.totalRides || 0);
  const [rating] = useState(user.rating || 4.8);
  const [toast, setToast] = useState("");
  const [mapRide, setMapRide] = useState(null);

  // OTP verification state
  const [expectedOtp, setExpectedOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState(false);

  /* ─── Messaging state ────────────────────────────────────── */
  const [msgInput, setMsgInput] = useState("");
  const [rideStartedConfirmed, setRideStartedConfirmed] = useState(false);
  const [userMessages, setUserMessages] = useState([]); // messages received from rider

  /* ─── Account drawer + trip history ─────────────────────── */
  const [showAccount, setShowAccount] = useState(false);
  const [tripHistory, setTripHistory] = useState([]);   // completed trips this session

  /* ─── Panel tab inside drawer ────────────────────────────── */
  const [drawerTab, setDrawerTab] = useState("profile"); // profile | history | earnings

  /* ─── Wallet state ──────────────────────────────────────── */
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTxns, setWalletTxns] = useState([]);
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawMsg, setWithdrawMsg] = useState("");

  /* ─── Bid respond state ─────────────────────────────────── */
  const [bidRequests, setBidRequests] = useState({}); // rideId -> bidPrice
  const [counterInputs, setCounterInputs] = useState({}); // rideId -> counterVal

  /* ─── P0: Captain photo + arrived ───────────────────────── */
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || "");
  const [photoSaveMsg, setPhotoSaveMsg] = useState("");
  const [arrivedSent, setArrivedSent] = useState(false);

  /* ─── Rider rating modal ─────────────────────────────────── */
  const [showRiderRating, setShowRiderRating] = useState(false);
  const [completedRideData, setCompletedRideData] = useState(null);
  const [riderRatingValue, setRiderRatingValue] = useState(0);
  const [riderRatingHover, setRiderRatingHover] = useState(0);

  /* ─── Location broadcast (ETA for rider) ────────────────── */
  const locationIntervalRef = useRef(null);

  const toastTimer = useRef(null);

  /* ─── Load captain wallet on mount ──────────────────────── */
  useEffect(() => {
    if (!tkn) return;
    axios.get(`${BACKEND_URL}/api/wallet/captain-balance`, { headers: { Authorization: `Bearer ${tkn}` } })
      .then((res) => {
        setWalletBalance(res.data.balance || 0);
        setWalletTxns(res.data.transactions || []);
      })
      .catch(() => {});
  }, []);

  /* ─── Auto-connect + join vehicle room ───────────────────── */
  useEffect(() => {
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("captain online", { token: tkn });
      if (user?._id) socket.emit("notification:register", { userId: user._id });
    });
    socket.on("captain profile", (profile) => {
      setEarnings(profile.earnings || 0);
      setTotalRides(profile.totalRides || 0);
      const stored = JSON.parse(localStorage.getItem("ucab_user") || "{}");
      localStorage.setItem("ucab_user", JSON.stringify({
        ...stored,
        earnings: profile.earnings ?? stored.earnings,
        totalRides: profile.totalRides ?? stored.totalRides,
        rating: profile.rating ?? stored.rating,
      }));
    });
    socket.on("disconnect", () => setConnected(false));
    return () => { socket.off("connect"); socket.off("captain profile"); socket.off("disconnect"); };
  }, [socket, tkn]);

  /* ─── Load trip history from DB on mount ────────────────── */
  useEffect(() => {
    if (!user?._id) return;
    axios.get(`${BACKEND_URL}/api/auth/captain/trips?captainId=${user._id}&limit=100`)
      .then((res) => {
        const dbTrips = (res.data.trips || []).map((t) => ({
          id: t.id,
          date: new Date(t.date),
          pickup: t.pickup?.address || "Pickup",
          dropoff: t.dropoff?.address || "Dropoff",
          fare: t.fare,
          distKm: null,
          rideType: t.rideType,
          payment: t.payment,
          riderRating: t.riderRating,
        }));
        setTripHistory(dbTrips);
      })
      .catch(() => { }); // silently fail — in-session data still shown
  }, []);


  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  };

  /* ─── Real-time notifications ───────────────────────────── */
  useEffect(() => {
    socket.on("notification:new", ({ notification }) => {
      if (notification?.message) showToast(`🔔 ${notification.message}`);
    });
    // OTP relayed from rider (legacy path)
    socket.on("captain:receive_otp", ({ otp }) => {
      setExpectedOtp(otp);
      setOtpInput("");
      setOtpVerified(false);
      setOtpError(false);
      showToast("🔢 OTP received — ask rider for their code");
    });
    // Server-side OTP verification result
    socket.on("otp result", ({ valid, reason }) => {
      if (valid) {
        setOtpVerified(true);
        setOtpError(false);
        setRideStartedConfirmed(true);
        showToast("✅ OTP verified! Ride has started.");
      } else {
        setOtpVerified(false);
        setOtpError(true);
        showToast(`❌ ${reason || "Invalid OTP"}`);
      }
    });
    // Message from rider
    socket.on("user:message", (payload) => {
      setUserMessages((prev) => [...prev, payload]);
      showToast(`📩 Rider: ${payload.message}`);
    });
    // Bid request from rider
    socket.on("ride:bid_updated", ({ rideId, bidPrice }) => {
      setBidRequests((prev) => ({ ...prev, [rideId]: bidPrice }));
      showToast(`💰 Rider bid ₹${bidPrice} for ride`);
    });
    return () => {
      socket.off("notification:new");
      socket.off("captain:receive_otp");
      socket.off("otp result");
      socket.off("user:message");
      socket.off("ride:bid_updated");
    };
  }, [socket]);

  const goOnline = () => { setIsOnline(true); showToast("You are now online 🟢"); };
  const goOffline = () => { setIsOnline(false); setMapRide(null); showToast("You are now offline ⚫"); };

  /* ─── Stats from server ───────────────────────────────────── */
  useEffect(() => {
    socket.on("stats updated", ({ earnings: e, totalRides: t }) => {
      setEarnings(e);
      setTotalRides(t);
      // ── Sync to localStorage so these survive a page refresh ───
      const stored = JSON.parse(localStorage.getItem("ucab_user") || "{}");
      localStorage.setItem("ucab_user", JSON.stringify({ ...stored, earnings: e, totalRides: t }));
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
      // Remove this ride card from all captains' lists (the winner already accepted it)
      setRides((prev) => prev.filter((r) => r.rideId !== data.rideId));
      setMapRide((prev) => prev?.rideId === data.rideId ? null : prev);
    });
    return () => socket.off("ride accepted");
  }, [socket]);

  /* ─── Our own accept was rejected (race — another captain was faster) ── */
  useEffect(() => {
    socket.on("ride already taken", ({ rideId }) => {
      // Roll back the optimistic state set by acceptRide()
      setAcceptedRide((current) => {
        if (current?.rideId === rideId) return null;
        return current;
      });
      setMapRide((current) => (current?.rideId === rideId ? null : current));
      // Reset OTP state that was pre-cleared in acceptRide()
      setExpectedOtp("");
      setOtpInput("");
      setOtpVerified(false);
      setOtpError(false);
      showToast("⚠️ Ride already accepted by another captain");
    });
    return () => socket.off("ride already taken");
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
      rideId: ride.rideId,
      captainId: user._id,
      captainName: user.name
    });
    setAcceptedRide(ride);
    setMapRide(ride);
    setRides((prev) => prev.filter((r) => r.rideId !== ride.rideId));
    // Reset OTP state for new ride
    setExpectedOtp("");
    setOtpInput("");
    setOtpVerified(false);
    setOtpError(false);
    setMsgInput("");
    setRideStartedConfirmed(false);
    setUserMessages([]);
    setArrivedSent(false);
    showToast("✅ Ride accepted! Head to pickup.");
    // Begin broadcasting location to rider for ETA
    clearInterval(locationIntervalRef.current);
    if (navigator.geolocation) {
      locationIntervalRef.current = setInterval(() => {
        navigator.geolocation.getCurrentPosition((pos) => {
          socket.emit("captain:location", {
            rideId: ride.rideId,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        }, () => {});
      }, 5000);
    }
  };

  const respondBid = (rideId, action, counterPrice) => {
    socket.emit("ride:bid_respond", { rideId, action, counterPrice });
    setBidRequests((prev) => { const n = { ...prev }; delete n[rideId]; return n; });
    setCounterInputs((prev) => { const n = { ...prev }; delete n[rideId]; return n; });
    showToast(action === "accept" ? "✅ Bid accepted" : action === "counter" ? "↩️ Counter sent" : "❌ Bid rejected");
  };

  const requestWithdrawal = () => {
    const amt = parseFloat(withdrawAmt);
    if (!amt || amt < 100) { setWithdrawMsg("Minimum withdrawal is ₹100"); return; }
    if (amt > walletBalance) { setWithdrawMsg("Insufficient wallet balance"); return; }
    axios.post(`${BACKEND_URL}/api/wallet/withdrawal-request`, { amount: amt }, { headers: { Authorization: `Bearer ${tkn}` } })
      .then((res) => {
        setWalletBalance(res.data.newBalance || 0);
        setWalletTxns((prev) => [{ type: "withdrawal_request", amount: amt, description: "Withdrawal request", created_at: new Date().toISOString() }, ...prev]);
        setWithdrawAmt("");
        setWithdrawMsg("✅ Withdrawal request submitted!");
        showToast("✅ Withdrawal request submitted");
      })
      .catch((e) => setWithdrawMsg(e.response?.data?.error || "Request failed"));
  };

  const rejectRide = (rideId) => {
    setRides((prev) => prev.filter((r) => r.rideId !== rideId));
    setMapRide((prev) => prev?.rideId === rideId ? null : prev);
    showToast("Ride skipped");
  };

  const completeRide = () => {
    if (!acceptedRide) return;
    if (!otpVerified) {
      setOtpError(true);
      showToast("⚠️ Please verify the rider OTP first");
      return;
    }
    /* Save to local trip history */
    const tripRecord = {
      id: acceptedRide.rideId,
      date: new Date(),
      pickup: acceptedRide.pickup?.address || "Pickup",
      dropoff: acceptedRide.dropoff?.address || "Dropoff",
      fare: acceptedRide.fare,
      distKm: acceptedRide.distKm,
      rideType: acceptedRide.rideType,
      payment: acceptedRide.paymentMethod || "cash",
      riderRating: null,
    };
    setTripHistory((prev) => [tripRecord, ...prev]);
    setTotalRides((n) => n + 1);
    setEarnings((e) => e + (acceptedRide.fare || 0));

    clearInterval(locationIntervalRef.current);
    socket.emit("complete ride", {
      rideId: acceptedRide.rideId,
      captainId: user._id,
      fare: acceptedRide.fare
    });
    /* Save ride data for rating modal before clearing */
    setCompletedRideData({
      rideId: acceptedRide.rideId,
      riderId: acceptedRide.riderId,
      riderName: acceptedRide.riderName || acceptedRide.name || "Rider",
    });
    setRiderRatingValue(0);
    setShowRiderRating(true);
    setAcceptedRide(null);
    setMapRide(null);
    setMsgInput("");
    setRideStartedConfirmed(false);
    setUserMessages([]);
    showToast("🏁 Ride completed! Please rate the rider.");
  };

  const logout = () => {
    localStorage.removeItem("ucab_user");
    localStorage.removeItem("ucab_token");
    navigate("/");
  };

  const handleRateRider = (rating) => {
    if (!completedRideData?.riderId || !completedRideData?.rideId) {
      setShowRiderRating(false);
      return;
    }
    socket.emit("rate rider", {
      riderId: completedRideData.riderId,
      rideId:  completedRideData.rideId,
      rating,
    });
    setShowRiderRating(false);
    setCompletedRideData(null);
    showToast(`⭐ Rated rider ${rating}/5`);
  };

  const mapPickup = mapRide?.pickup || null;
  const mapDropoff = mapRide?.dropoff || null;

  const vehicleLabel = {
    go: "uride Go 🚗", premier: "Premier 🚙",
    auto: "Auto 🛺", bike: "Bike 🏍️"
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

      {/* ── Rider Rating Modal ── */}
      {showRiderRating && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#1a1a2e", borderRadius: 20, padding: "28px 24px",
            maxWidth: 340, width: "90%", textAlign: "center",
            border: "1px solid rgba(255,255,255,0.12)",
          }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⭐</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Rate your rider</div>
            <div style={{ fontSize: 13, color: "#aaa", marginBottom: 20 }}>
              {completedRideData?.riderName || "Rider"}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  onClick={() => setRiderRatingValue(star)}
                  onMouseEnter={() => setRiderRatingHover(star)}
                  onMouseLeave={() => setRiderRatingHover(0)}
                  style={{
                    fontSize: 36, cursor: "pointer",
                    color: star <= (riderRatingHover || riderRatingValue) ? "#f1c40f" : "#444",
                    transition: "color 0.15s",
                  }}>
                  ★
                </span>
              ))}
            </div>
            <button
              disabled={!riderRatingValue}
              onClick={() => handleRateRider(riderRatingValue)}
              style={{
                width: "100%", background: riderRatingValue ? "linear-gradient(90deg,#1db954,#17a44a)" : "#333",
                border: "none", borderRadius: 20, padding: "12px 0",
                color: riderRatingValue ? "#000" : "#666",
                fontWeight: 800, fontSize: 15, cursor: riderRatingValue ? "pointer" : "not-allowed",
                marginBottom: 10,
              }}>
              Submit Rating
            </button>
            <button
              onClick={() => { setShowRiderRating(false); setCompletedRideData(null); }}
              style={{
                width: "100%", background: "none", border: "1px solid #444",
                borderRadius: 20, padding: "10px 0", color: "#888",
                fontWeight: 600, fontSize: 14, cursor: "pointer",
              }}>
              Skip
            </button>
          </div>
        </div>
      )}

      {/* ── Full-screen map ── */}
      <div className="map-fullscreen">
        <MapView pickup={mapPickup} dropoff={mapDropoff} height="100%" />
      </div>

      {/* ── Top bar ── */}
      <div className="top-bar">
        <div className="top-bar-logo">uride <span className="logo-accent">services</span></div>
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

            {/* Captain photo in header */}
            {photoUrl && (
              <img src={photoUrl} alt="captain" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover", border: "2px solid #1db954", marginBottom: 8, display: "block", marginLeft: "auto", marginRight: "auto" }} />
            )}

            {/* Drawer tab bar */}
            <div className="drawer-tabs">
              {[
                { id: "profile", label: "Profile" },
                { id: "history", label: "Trips" },
                { id: "earnings", label: "Earnings" },
                { id: "wallet", label: "Wallet" },
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

                {/* Photo URL update */}
                <div className="drawer-section-title" style={{ marginTop: 16 }}>Profile Photo</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                  <input
                    type="url"
                    placeholder="Photo URL (https://...)"
                    value={photoUrl}
                    onChange={(e) => { setPhotoUrl(e.target.value); setPhotoSaveMsg(""); }}
                    style={{ flex: 1, padding: "10px 12px", background: "#1a1a1a", border: "1.5px solid #333", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none" }}
                  />
                  <button
                    onClick={() => {
                      if (!photoUrl.startsWith("https://")) { setPhotoSaveMsg("URL must start with https://"); return; }
                      axios.put(`${BACKEND_URL}/api/auth/captain/photo`, { photoUrl }, { headers: { Authorization: `Bearer ${tkn}` } })
                        .then(() => { setPhotoSaveMsg("✅ Photo saved!"); const s = JSON.parse(localStorage.getItem("ucab_user") || "{}"); localStorage.setItem("ucab_user", JSON.stringify({ ...s, photoUrl })); })
                        .catch(() => setPhotoSaveMsg("Failed to save"));
                    }}
                    style={{ padding: "10px 14px", background: "#1db954", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    Save
                  </button>
                </div>
                {photoSaveMsg && <div style={{ fontSize: 12, color: photoSaveMsg.startsWith("✅") ? "#1db954" : "#e53935", marginBottom: 10 }}>{photoSaveMsg}</div>}

                <button className="btn-primary" style={{ marginTop: 20, background: "#e74c3c" }}
                  onClick={logout}>🚪 Logout</button>
              </>
            )}

            {/* ─── Trip History tab ─────────────────────────────── */}
            {drawerTab === "history" && (
              <>
                <div className="drawer-section-title">
                  Trip History ({tripHistory.length} rides)
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
                        {trip.riderRating != null && (
                          <div className="thc-dist">⭐ Rider rated {trip.riderRating}/5</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ─── Earnings tab ────────────────────────────────── */}
            {drawerTab === "earnings" && (() => {
              // Build last-7-trips bar chart data
              const last7 = tripHistory.slice(0, 7).reverse();
              const maxFare = Math.max(...last7.map((t) => t.fare), 1);
              return (
                <>
                  <div className="drawer-section-title">Earnings Overview</div>
                  <div className="earnings-overview">
                    <div className="earn-big-card">
                      <div style={{ fontSize: 12, color: "#888" }}>Session Earnings</div>
                      <div className="earn-big-amt">₹{todayEarnings}</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{tripHistory.length} trips</div>
                    </div>
                    <div className="earn-big-card">
                      <div style={{ fontSize: 12, color: "#888" }}>All-time Earnings</div>
                      <div className="earn-big-amt">₹{earnings}</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{totalRides} total rides</div>
                    </div>
                  </div>

                  {last7.length > 0 && (
                    <>
                      <div className="drawer-section-title" style={{ marginTop: 16 }}>Last {last7.length} Trips — Bar Chart</div>
                      <div className="earnings-chart">
                        {last7.map((trip, i) => {
                          const heightPct = Math.round((trip.fare / maxFare) * 100);
                          return (
                            <div key={i} className="chart-bar-col">
                              <div className="chart-bar-label">₹{trip.fare}</div>
                              <div className="chart-bar-wrap">
                                <div className="chart-bar" style={{ height: `${heightPct}%` }} />
                              </div>
                              <div className="chart-bar-time">
                                {trip.date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  <div className="drawer-section-title" style={{ marginTop: 16 }}>Per-trip Breakdown</div>
                  {tripHistory.length === 0 ? (
                    <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: "20px 0" }}>No trips yet this session</div>
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
              );
            })()}

            {/* ─── Wallet tab ───────────────────────────────────── */}
            {drawerTab === "wallet" && (
              <>
                <div className="drawer-section-title">Captain Wallet</div>
                <div className="wallet-balance-card">
                  <div style={{ fontSize: 13, color: "#aaa" }}>Available Balance</div>
                  <div className="wallet-big-amt">₹{walletBalance}</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>Earnings credited after each ride</div>
                </div>

                <div className="drawer-section-title" style={{ marginTop: 16 }}>Request Withdrawal</div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input type="number" placeholder="Amount (min ₹100)"
                    value={withdrawAmt} onChange={(e) => { setWithdrawAmt(e.target.value); setWithdrawMsg(""); }}
                    style={{ flex: 1, padding: "10px 12px", background: "#1a1a1a", border: "1.5px solid #333", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none" }} />
                  <button onClick={requestWithdrawal}
                    style={{ padding: "10px 14px", background: "#1db954", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    Withdraw
                  </button>
                </div>
                {withdrawMsg && <div style={{ fontSize: 12, color: withdrawMsg.startsWith("✅") ? "#1db954" : "#e53935", marginBottom: 12, padding: "6px 10px", background: withdrawMsg.startsWith("✅") ? "#0d2818" : "#1a0000", borderRadius: 8 }}>{withdrawMsg}</div>}

                {walletTxns.length > 0 && (
                  <>
                    <div className="drawer-section-title" style={{ marginTop: 8 }}>Transaction History</div>
                    <div className="earn-breakdown-list">
                      {walletTxns.map((tx, i) => (
                        <div key={i} className="earn-row">
                          <div>
                            <div style={{ fontSize: 13, color: "#ccc" }}>{tx.description || tx.type}</div>
                            <div style={{ fontSize: 11, color: "#666" }}>
                              {new Date(tx.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
                            </div>
                          </div>
                          <div style={{ color: tx.type === "credit" ? "#1db954" : "#e53935", fontWeight: 700 }}>
                            {tx.type === "credit" ? "+" : "-"}₹{tx.amount}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
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
            {acceptedRide.parcelWeight && (
              <div style={{ background: "rgba(29,185,84,0.1)", padding: 10, borderRadius: 8, marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1db954", marginBottom: 4 }}>📦 PARCEL DETAILS</div>
                <div style={{ fontSize: 13, color: "#eee" }}>Weight: <strong>{acceptedRide.parcelWeight} kg</strong></div>
                <div style={{ fontSize: 13, color: "#eee" }}>Receiver: <strong>{acceptedRide.receiverName}</strong></div>
                <div style={{ fontSize: 13, color: "#eee" }}>Phone: <strong>{acceptedRide.receiverPhone}</strong></div>
              </div>
            )}
            {/* ── I've Arrived button (before OTP) ── */}
            {!otpVerified && (
              <button
                onClick={() => {
                  if (arrivedSent) return;
                  socket.emit("captain:arrived", { rideId: acceptedRide?.rideId });
                  setArrivedSent(true);
                  showToast("📍 Rider notified that you've arrived!");
                }}
                style={{
                  width: "100%", padding: "13px", marginTop: 12, marginBottom: 4,
                  background: arrivedSent ? "#0e2b1a" : "#0e2b1a",
                  border: `1.5px solid ${arrivedSent ? "#555" : "#1db954"}`,
                  borderRadius: 12, color: arrivedSent ? "#555" : "#1db954",
                  fontWeight: 800, fontSize: 15, cursor: arrivedSent ? "default" : "pointer",
                }}>
                {arrivedSent ? "✅ Arrived notification sent" : "📍 I've Arrived at Pickup"}
              </button>
            )}

            {/* ── OTP Verification (Uber-style) ── */}
            <div style={{
              marginTop: 14,
              padding: "14px 16px",
              background: otpVerified ? "rgba(29,185,84,0.12)" : "rgba(255,255,255,0.05)",
              borderRadius: 12,
              border: `1px solid ${otpVerified ? "#1db954" : otpError ? "#e74c3c" : "#333"}`,
              transition: "border 0.2s"
            }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                🔐 Rider OTP Verification
              </div>
              {otpVerified ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 28 }}>✅</span>
                  <div>
                    <div style={{ color: "#1db954", fontWeight: 700, fontSize: 15 }}>OTP Verified!</div>
                    <div style={{ color: "#888", fontSize: 12 }}>You may now complete the ride</div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: "#aaa", marginBottom: 10 }}>
                    Ask the rider for their 4-digit OTP and enter it below
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="_ _ _ _"
                      value={otpInput}
                      onChange={(e) => {
                        // allow only digits, max 4
                        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                        setOtpInput(v);
                        setOtpError(false);
                      }}
                      style={{
                        flex: 1,
                        padding: "11px 14px",
                        borderRadius: 10,
                        border: `1.5px solid ${otpError ? "#e74c3c" : "#444"}`,
                        background: "#1a1a1a",
                        color: "#fff",
                        fontSize: 20,
                        letterSpacing: 8,
                        fontWeight: 700,
                        textAlign: "center",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={() => {
                        const entered = String(otpInput).trim();
                        if (entered.length < 4) {
                          setOtpError(true);
                          showToast("⚠️ Enter all 4 digits");
                          return;
                        }
                        // Prefer server-side verification (rideId-bound)
                        if (acceptedRide?.rideId) {
                          socket.emit("verify otp", {
                            rideId: acceptedRide.rideId,
                            otp: entered,
                          });
                          // otp result event will set otpVerified
                          return;
                        }
                        // Fallback: client-side check (legacy)
                        const expected = String(expectedOtp).trim();
                        if (expected && entered === expected) {
                          setOtpVerified(true);
                          setOtpError(false);
                          showToast("✅ OTP verified! Tap Complete to finish.");
                        } else if (!expected) {
                          setOtpVerified(true);
                          setOtpError(false);
                          showToast("✅ OTP accepted");
                        } else {
                          setOtpError(true);
                          showToast("❌ Wrong OTP — check with rider");
                        }
                      }}
                      style={{
                        padding: "11px 18px",
                        background: "#2b6cb0",
                        color: "#fff",
                        border: "none",
                        borderRadius: 10,
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Verify →
                    </button>
                  </div>
                  {otpError && (
                    <div style={{ color: "#e74c3c", fontSize: 12, marginTop: 6 }}>
                      ✕ Incorrect OTP. Ask the rider again.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── Ride Started Banner + Navigate Button ── */}
            {rideStartedConfirmed && (
              <div style={{
                background: "rgba(29,185,84,0.15)", border: "1.5px solid #1db954",
                borderRadius: 12, padding: "12px 14px", marginTop: 12,
                animation: "fadeSlideUp 0.4s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 26 }}>🚗</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: "#1db954", fontWeight: 800, fontSize: 15 }}>Ride Started!</div>
                    <div style={{ color: "#888", fontSize: 12 }}>Drive safely to the destination.</div>
                  </div>
                </div>
                {/* Google Maps navigation button */}
                <a
                  href={`https://maps.google.com/maps?daddr=${acceptedRide.dropoff?.lat && acceptedRide.dropoff?.lng
                    ? `${acceptedRide.dropoff.lat},${acceptedRide.dropoff.lng}`
                    : encodeURIComponent(acceptedRide.dropoff?.address || acceptedRide.dropoff || "destination")}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    background: "#1a73e8", color: "#fff", fontWeight: 700, fontSize: 14,
                    padding: "11px 16px", borderRadius: 10, textDecoration: "none",
                    border: "none", width: "100%", boxSizing: "border-box",
                  }}
                >
                  📍 Navigate to Destination
                </a>
              </div>
            )}

            {/* ── Messages from Rider ── */}
            {userMessages.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                  📩 Messages from Rider
                </div>
                {userMessages.map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#1a2030", padding: "10px 12px", borderRadius: 12, marginBottom: 6 }}>
                    <div style={{ width: 28, height: 28, background: "#553c9a", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#fff", flexShrink: 0 }}>
                      R
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: "#eee" }}>{m.message}</div>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                        {new Date(m.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Message Rider Panel ── */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                💬 Message Rider
              </div>
              {/* Quick message chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {["I'm nearby 👋", "On my way 🚗", "2 min away ⏱️", `Look for ${user.vehicle?.color || ""} ${user.vehicle?.model || ""} 🔍`].map((quickMsg) => (
                  <button key={quickMsg}
                    style={{
                      padding: "6px 11px", background: "#1a1a2e",
                      border: "1px solid #2a3040", borderRadius: 20,
                      color: "#ccc", fontSize: 12, cursor: "pointer",
                    }}
                    onClick={() => {
                      if (!acceptedRide?.rideId) return;
                      socket.emit("captain:message", { rideId: acceptedRide.rideId, message: quickMsg });
                      showToast(`📤 Sent: "${quickMsg}"`);
                    }}>
                    {quickMsg}
                  </button>
                ))}
              </div>
              {/* Custom message input */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  placeholder="Type a message…"
                  value={msgInput}
                  maxLength={200}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && msgInput.trim() && acceptedRide?.rideId) {
                      socket.emit("captain:message", { rideId: acceptedRide.rideId, message: msgInput.trim() });
                      showToast("📤 Message sent");
                      setMsgInput("");
                    }
                  }}
                  style={{
                    flex: 1, padding: "10px 12px", background: "#1a1a1a",
                    border: "1.5px solid #333", borderRadius: 10,
                    color: "#fff", fontSize: 13, outline: "none",
                  }}
                />
                <button
                  style={{
                    padding: "10px 14px", background: "#2b6cb0",
                    border: "none", borderRadius: 10, color: "#fff",
                    fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}
                  onClick={() => {
                    if (!msgInput.trim() || !acceptedRide?.rideId) return;
                    socket.emit("captain:message", { rideId: acceptedRide.rideId, message: msgInput.trim() });
                    showToast("📤 Message sent");
                    setMsgInput("");
                  }}>
                  Send
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
              <span style={{ color: "#1db954", fontWeight: 800, fontSize: 20 }}>₹{acceptedRide.fare}</span>
              <button
                className="accept-btn"
                style={{
                  width: "auto",
                  padding: "10px 20px",
                  opacity: otpVerified ? 1 : 0.4,
                  cursor: otpVerified ? "pointer" : "not-allowed",
                }}
                onClick={completeRide}
              >
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
                <div style={{ fontSize: 12, color: "#888", marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span>{ride.rideType}</span>
                  {ride.paymentMethod && <span>{ride.paymentMethod === "cash" ? "💵 Cash" : "📲 UPI"}</span>}
                  {ride.scheduledAt && <span>📅 Scheduled</span>}
                  {ride.parcelWeight && (
                    <span style={{ color: "#1db954", fontWeight: 700 }}>📦 {ride.parcelWeight} kg Parcel</span>
                  )}
                  {bidRequests[ride.rideId] && (
                    <span style={{ color: "#f6ad55", fontWeight: 700 }}>💰 Rider bid ₹{bidRequests[ride.rideId]}</span>
                  )}
                </div>
                {/* Bid respond UI */}
                {bidRequests[ride.rideId] && (
                  <div style={{ background: "#1a1200", border: "1px solid #f6ad55", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                    <div style={{ fontSize: 13, color: "#f6ad55", fontWeight: 700, marginBottom: 8 }}>
                      Rider offered ₹{bidRequests[ride.rideId]} — respond:
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={(e) => { e.stopPropagation(); respondBid(ride.rideId, "accept"); }}
                        style={{ padding: "7px 12px", background: "#1db954", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>✅ Accept</button>
                      <button onClick={(e) => { e.stopPropagation(); respondBid(ride.rideId, "reject"); }}
                        style={{ padding: "7px 12px", background: "#e53935", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>❌ Decline</button>
                      <input type="number" placeholder="Counter ₹"
                        value={counterInputs[ride.rideId] || ""}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setCounterInputs((prev) => ({ ...prev, [ride.rideId]: e.target.value }))}
                        style={{ width: 90, padding: "7px 10px", background: "#1a1a1a", border: "1px solid #f6ad55", borderRadius: 8, color: "#fff", fontSize: 12, outline: "none" }} />
                      <button onClick={(e) => { e.stopPropagation(); respondBid(ride.rideId, "counter", counterInputs[ride.rideId]); }}
                        style={{ padding: "7px 12px", background: "#f6ad55", border: "none", borderRadius: 8, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>↩ Counter</button>
                    </div>
                  </div>
                )}
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
