import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import MapView from "../components/MapView";
import LocationSearch from "../components/LocationSearch";
import BACKEND_URL from "../config";

/* ─── Constants ─────────────────────────────────────────────── */
const RIDE_TYPES = [
  { id: "go", name: "UCab Go", icon: "🚗", time: "2 min", base: 30, perKm: 10 },
  { id: "premier", name: "Premier", icon: "🚙", time: "4 min", base: 60, perKm: 15 },
  { id: "auto", name: "Auto", icon: "🛺", time: "3 min", base: 20, perKm: 7 },
  { id: "bike", name: "Bike", icon: "🏍️", time: "1 min", base: 15, perKm: 5 },
];

const COURIER_VEHICLES = [
  { id: "bike", name: "Bike", icon: "🏍️", base: 25, perKm: 6, maxKg: 5 },
  { id: "auto", name: "Auto", icon: "🛺", base: 40, perKm: 8, maxKg: 15 },
  { id: "go", name: "Van", icon: "🚐", base: 80, perKm: 12, maxKg: 50 },
];

const RENTAL_VEHICLES = [
  { id: "hatch", name: "Hatchback", icon: "🚗", perHr: 80, desc: "Maruti, Hyundai i10" },
  { id: "sedan", name: "Sedan", icon: "🚘", perHr: 120, desc: "Honda City, Dzire" },
  { id: "suv", name: "SUV", icon: "🚙", perHr: 180, desc: "Innova, Ertiga" },
  { id: "bike", name: "Bike", icon: "🏍️", perHr: 40, desc: "Activa, Splendor" },
];

const PAY_METHODS = [
  { id: "cash", label: "Cash", icon: "💵" },
  { id: "upi", label: "UPI", icon: "📲" },
];

const CANCEL_FREE_MINS = 2;
const CANCEL_FEE = 50;

const calcFare = (type, km) => Math.round(type.base + type.perKm * (km || 5));
const calcCourier = (v, km, kg) => Math.round(v.base + v.perKm * (km || 3) + (kg > 2 ? (kg - 2) * 5 : 0));
const fmtTime = (date) =>
  date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

/* ─── Draggable sheet heights ──────────────────────────────── */
const PEEK = 160;  // collapsed
const MID = Math.round(window.innerHeight * 0.5);
const FULL = Math.round(window.innerHeight * 0.88);

const UserPage = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("ucab_user") || "{}");
  const tkn = localStorage.getItem("ucab_token");

  // Socket created once per component mount — useRef pattern prevents reconnect leaks
  const socketRef = useRef(null);
  if (!socketRef.current) {
    socketRef.current = io(BACKEND_URL, {
      auth: { token: tkn },                     // JWT sent in handshake for server-side userId
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      transports: ["websocket", "polling"],
    });
  }
  const socket = socketRef.current;

  // Re-register notification on every reconnect
  useEffect(() => {
    const onConnect = () => {
      if (user?._id) socket.emit("notification:register", { userId: user._id });
    };
    socket.on("connect", onConnect);
    if (socket.connected) onConnect();
    return () => { socket.off("connect", onConnect); };
  }, [socket]);

  /* ─── Service tab ─────────────────────────────────────────── */
  const [serviceTab, setServiceTab] = useState("ride"); // ride | courier | rental

  /* ─── Core ride state ─────────────────────────────────────── */
  const [pickup, setPickup] = useState(null);
  const [dropoff, setDropoff] = useState(null);
  const [selectedType, setSelectedType] = useState("go");
  const [routeInfo, setRouteInfo] = useState(null);
  const [rideStatus, setRideStatus] = useState("idle");
  const [currentRide, setCurrentRide] = useState(null);
  const [captainPos, setCaptainPos] = useState(null);
  const [captainInfo, setCaptainInfo] = useState(null);
  const [tripOtp, setTripOtp] = useState("");
  const [toast, setToast] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  /* ─── Schedule / arrival state ────────────────────────────── */
  const [bookingMode, setBookingMode] = useState("now");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const [schedConfirmed, setSchedConfirmed] = useState(false);
  const [arrivalTime, setArrivalTime] = useState("");
  const [breaks, setBreaks] = useState([{ label: "Lunch", mins: 30 }]);
  const [departureResult, setDepartureResult] = useState(null);

  /* ─── Account drawer ──────────────────────────────────────── */
  const [showAccount, setShowAccount] = useState(false);

  /* ─── Courier state ───────────────────────────────────────── */
  const [cFrom, setCFrom] = useState(null);
  const [cTo, setCTo] = useState(null);
  const [cVehicle, setCVehicle] = useState("bike");
  const [cWeight, setCWeight] = useState(1);
  const [cName, setCName] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cRouteInfo, setCRouteInfo] = useState(null);
  const [courierStatus, setCourierStatus] = useState("idle"); // idle | sent

  /* ─── Rental state ────────────────────────────────────────── */
  const [rVehicle, setRVehicle] = useState("hatch");
  const [rHours, setRHours] = useState(4);
  const [rWithDriver, setRWithDriver] = useState(false);
  const [rLocation, setRLocation] = useState(null);
  const [rentalStatus, setRentalStatus] = useState("idle"); // idle | confirmed

  /* ─── Draggable bottom sheet ──────────────────────────────── */
  const sheetRef = useRef(null);
  const dragState = useRef({ dragging: false, startY: 0, startH: 0 });
  const [sheetH, setSheetH] = useState(PEEK);

  const snapSheet = useCallback((currentH) => {
    const snaps = [PEEK, MID, FULL];
    const nearest = snaps.reduce((a, b) =>
      Math.abs(b - currentH) < Math.abs(a - currentH) ? b : a);
    setSheetH(nearest);
  }, []);

  const onDragStart = (e) => {
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current = { dragging: true, startY: clientY, startH: sheetH };
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragState.current.dragging) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const delta = dragState.current.startY - clientY;
      const newH = Math.min(FULL, Math.max(PEEK, dragState.current.startH + delta));
      setSheetH(newH);
    };
    const onEnd = () => {
      if (!dragState.current.dragging) return;
      dragState.current.dragging = false;
      setSheetH((h) => { snapSheet(h); return h; });
    };
    window.addEventListener("mousemove", onMove, { passive: false });
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [snapSheet]);

  /* Expand sheet when both locations set */
  useEffect(() => {
    if (pickup && dropoff && sheetH === PEEK) setSheetH(MID);
  }, [pickup, dropoff]);

  /* ─── Arrival calculator ──────────────────────────────────── */
  useEffect(() => {
    if (bookingMode !== "arrival" || !arrivalTime || !routeInfo) return;
    const tripMins = routeInfo.durationMin || 0;
    const breakMins = breaks.reduce((s, b) => s + (Number(b.mins) || 0), 0);
    const totalMins = tripMins + breakMins;
    const arrival = new Date();
    const [h, m] = arrivalTime.split(":").map(Number);
    arrival.setHours(h, m, 0, 0);
    const depart = new Date(arrival.getTime() - totalMins * 60000);
    setDepartureResult({ depart, tripMins, breakMins, totalMins });
  }, [arrivalTime, breaks, routeInfo, bookingMode]);

  /* ─── Socket events ───────────────────────────────────────── */
  const acceptedAt = useRef(null);
  const toastTimer = useRef(null);
  const currentRideId = useRef(null);   // tracks which rideId belongs to THIS rider
  const captainIdRef = useRef(null);    // DB id of the accepting captain (for rating)
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);
  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  };

  /* ── Notification events ─────────────────────────────────── */
  useEffect(() => {
    socket.on("notification:new", ({ notification }) => {
      if (notification?.message) showToast(`🔔 ${notification.message}`);
    });
    return () => socket.off("notification:new");
  }, [socket]);

  useEffect(() => {
    // Server confirms ride was created and gives us the rideId
    socket.on("ride requested", ({ rideId }) => {
      currentRideId.current = rideId;
    });

    socket.on("ride accepted", (data) => {
      // Only respond to acceptance of OUR ride
      if (currentRideId.current && data.rideId !== currentRideId.current) return;

      captainIdRef.current = data.captainId || null;
      setCurrentRide(data);
      setRideStatus("accepted");
      setCaptainInfo(data.captain || null);

      // Use server-generated OTP if provided, otherwise generate client-side
      const otp = data.otp || String(Math.floor(1000 + Math.random() * 9000));
      setTripOtp(otp);

      // Relay OTP to captain via server (backward compat + direct socket)
      socket.emit("rider:share_otp", {
        captainSocketId: data.captainSocketId,
        otp,
        rideId: data.rideId,
      });

      acceptedAt.current = Date.now();
      if (pickup) setCaptainPos({
        lat: pickup.lat + (Math.random() - 0.5) * 0.01,
        lng: pickup.lng + (Math.random() - 0.5) * 0.01,
      });
      showToast("🎉 Captain is on the way!");
    });

    socket.on("ride completed", () => {
      currentRideId.current = null;
      setRideStatus("rating");
      setRatingSubmitted(false);
      showToast("🏁 Trip completed! Please rate your captain.");
    });

    socket.on("ride error", ({ message }) => {
      setRideStatus("idle");
      showToast(`❌ ${message}`);
    });

    return () => {
      socket.off("ride requested");
      socket.off("ride accepted");
      socket.off("ride completed");
      socket.off("ride error");
    };
  }, [pickup, socket]);

  /* ─── Rating helpers ────────────────────────────────────── */
  const resetAfterRide = () => {
    setRideStatus("idle");
    setCurrentRide(null);
    setCaptainInfo(null);
    setCaptainPos(null);
    setPickup(null);
    setDropoff(null);
    setRouteInfo(null);
    setSchedConfirmed(false);
    setDepartureResult(null);
    setSheetH(PEEK);
    captainIdRef.current = null;
  };

  const submitRating = (stars) => {
    if (captainIdRef.current) {
      socket.emit("rate captain", {
        captainId: captainIdRef.current,
        rideId: currentRideId.current,
        rating: stars,
      });
    }
    setRatingSubmitted(true);
    showToast(`⭐ Thanks for rating ${stars} star${stars !== 1 ? "s" : ""} !`);
    setTimeout(resetAfterRide, 1500);
  };

  const skipRating = () => {
    showToast("Ride completed!");
    resetAfterRide();
  };

  /* ─── Book ride ───────────────────────────────────────────── */
  const requestRide = () => {
    if (!pickup || !dropoff) { showToast("⚠️ Please set pickup & dropoff"); return; }
    if (bookingMode === "schedule" && (!schedDate || !schedTime)) {
      showToast("⚠️ Please set schedule date & time"); return;
    }
    const scheduledAt = bookingMode === "schedule"
      ? new Date(`${schedDate}T${schedTime}`).toISOString()
      : bookingMode === "arrival" && departureResult
        ? departureResult.depart.toISOString()
        : null;

    socket.emit("new ride request", {
      pickup: { ...pickup }, dropoff: { ...dropoff },
      fare, distKm: routeInfo?.distKm || 5,
      duration: routeInfo?.durationMin || 15,
      rideType: rideType.id, paymentMethod: payMethod, scheduledAt,
      userId: user._id || null,   // send userId so server stores it in rides.rider_id
    });
    if (scheduledAt) {
      setSchedConfirmed(true);
      showToast(`📅 Scheduled for ${fmtTime(new Date(scheduledAt))}`);
    } else {
      setRideStatus("searching");
      setSheetH(PEEK);
      showToast("🔍 Finding your captain...");
    }
  };

  /* ─── Cancel ride ─────────────────────────────────────────── */
  const cancelRide = () => {
    const minsElapsed = acceptedAt.current ? (Date.now() - acceptedAt.current) / 60000 : 0;
    const fee = rideStatus === "accepted" && minsElapsed > CANCEL_FREE_MINS ? CANCEL_FEE : 0;
    if (fee > 0 && !window.confirm(`₹${fee} cancellation fee applies. Cancel anyway?`)) return;
    setRideStatus("idle");
    setCurrentRide(null);
    setCaptainPos(null);
    acceptedAt.current = null;
    currentRideId.current = null;
    setSheetH(pickup && dropoff ? MID : PEEK);
    showToast(fee > 0 ? `Cancelled · ₹${fee} fee applies` : "Ride cancelled");
  };

  const logout = () => {
    localStorage.removeItem("ucab_user");
    localStorage.removeItem("ucab_token");
    navigate("/login/user");
  };

  /* ─── Courier helpers ─────────────────────────────────────── */
  const courierVehicle = COURIER_VEHICLES.find((v) => v.id === cVehicle);
  const courierFare = calcCourier(courierVehicle, cRouteInfo?.distKm, cWeight);
  const sendCourier = () => {
    if (!cFrom || !cTo) { showToast("⚠️ Set pickup & delivery address"); return; }
    if (!cName || !cPhone) { showToast("⚠️ Enter receiver name & phone"); return; }
    setCourierStatus("sent");
    showToast("📦 Courier request sent! Finding a delivery partner…");
  };

  /* ─── Rental helpers ──────────────────────────────────────── */
  const rentalVehicle = RENTAL_VEHICLES.find((v) => v.id === rVehicle);
  const driverExtra = rWithDriver ? 100 : 0;
  const rentalFare = rentalVehicle.perHr * rHours + driverExtra;
  const confirmRental = () => {
    if (!rLocation) { showToast("⚠️ Set your pickup location"); return; }
    setRentalStatus("confirmed");
    showToast(`🚗 ${rentalVehicle.name} rental confirmed for ${rHours} hrs!`);
  };

  /* ─── Misc helpers ────────────────────────────────────────── */
  const addBreak = () => setBreaks((b) => [...b, { label: "Break", mins: 15 }]);
  const removeBreak = (i) => setBreaks((b) => b.filter((_, idx) => idx !== i));
  const updateBreak = (i, f, v) =>
    setBreaks((b) => b.map((br, idx) => idx === i ? { ...br, [f]: v } : br));

  const rideType = RIDE_TYPES.find((r) => r.id === selectedType);
  const fare = calcFare(rideType, routeInfo?.distKm);

  /* ─── Render ──────────────────────────────────────────────── */
  return (
    <div className="uber-layout">

      {/* Map */}
      <div className="map-fullscreen">
        <MapView
          pickup={serviceTab === "courier" ? cFrom : pickup}
          dropoff={serviceTab === "courier" ? cTo : dropoff}
          captain={captainPos}
          onRouteFound={serviceTab === "courier" ? setCRouteInfo : setRouteInfo}
          height="100%" />
      </div>

      {/* Top bar */}
      <div className="top-bar">
        <div className="top-bar-logo">UCab <span className="logo-accent">Services</span></div>
        <div className="top-bar-right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* ── New feature nav links ── */}
          <button
            title="Notifications"
            onClick={() => navigate("/notifications")}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
            🔔
          </button>
          <button
            title="Fleet Service"
            onClick={() => navigate("/fleet/book")}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 10, padding: "7px 10px", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
            🚌
          </button>
          <button className="account-btn" onClick={() => setShowAccount(true)}>
            <div className="avatar">{user.name?.[0]?.toUpperCase() || "U"}</div>
          </button>
        </div>
      </div>


      {/* ── Account Drawer ── */}
      {showAccount && (
        <div className="drawer-overlay" onClick={() => setShowAccount(false)}>
          <div className="account-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle" />
            <div className="drawer-header">
              <div className="drawer-avatar">{user.name?.[0]?.toUpperCase() || "U"}</div>
              <div>
                <div className="drawer-name">{user.name || "Rider"}</div>
                <div className="drawer-phone">{user.phone || ""}</div>
              </div>
            </div>
            <div className="drawer-section-title">Payment Method</div>
            <div className="pay-method-row">
              {PAY_METHODS.map((p) => (
                <div key={p.id}
                  className={`pay-method-card ${payMethod === p.id ? "selected" : ""}`}
                  onClick={() => setPayMethod(p.id)}>
                  <span>{p.icon}</span> {p.label}
                </div>
              ))}
            </div>
            <div className="drawer-section-title">Cancellation Policy</div>
            <div className="cancel-policy-box">
              <p>✅ Free cancellation within <strong>{CANCEL_FREE_MINS} min</strong> of captain accepting.</p>
              <p>💸 <strong>₹{CANCEL_FEE} fee</strong> applies after {CANCEL_FREE_MINS} min.</p>
              <p>🔄 No charge if captain cancels or none found.</p>
            </div>
            <div className="drawer-section-title">About Maps</div>
            <div className="cancel-policy-box" style={{ fontSize: 12, lineHeight: 1.7 }}>
              <p>🗺 <strong>OpenStreetMap</strong> — open-source tiles, no personal data.</p>
              <p>📍 <strong>Nominatim</strong> — only typed query sent, no tracking.</p>
              <p>🛣 <strong>OSRM</strong> — lat/lng sent for route only, MIT licensed.</p>
            </div>
            <button className="btn-primary" style={{ marginTop: 20, background: "#e74c3c" }}
              onClick={logout}>🚪 Logout</button>

            {/* ── Quick links to new features ── */}
            <div style={{ marginTop: 16, borderTop: "1px solid #333", paddingTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>More Services</div>
              <button onClick={() => { setShowAccount(false); navigate("/notifications"); }}
                style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "#eee", cursor: "pointer", textAlign: "left", fontSize: 14 }}>
                🔔 My Notifications
              </button>
              <button onClick={() => { setShowAccount(false); navigate("/fleet/book"); }}
                style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "#eee", cursor: "pointer", textAlign: "left", fontSize: 14 }}>
                🗓️ Book Fleet Vehicles
              </button>
              <button onClick={() => { setShowAccount(false); navigate("/fleet/register-owner"); }}
                style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "#eee", cursor: "pointer", textAlign: "left", fontSize: 14 }}>
                🚌 Register Fleet Owner
              </button>
              <button onClick={() => { setShowAccount(false); navigate("/fleet/add-vehicle"); }}
                style={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 10, padding: "10px 14px", color: "#eee", cursor: "pointer", textAlign: "left", fontSize: 14 }}>
                🚗 Add Fleet Vehicle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trip / status sheets (override bottom sheet when active) ── */}
      {rideStatus === "searching" && (
        <div className="trip-sheet searching-sheet">
          <div className="trip-sheet-inner">
            <div className="searching-spinner" />
            <h2>Finding your captain…</h2>
            <p>Matching you with the nearest {rideType.name}</p>
            <div className="trip-route-summary">
              <div className="trs-row"><span className="trs-dot green" /><span>{pickup?.address || "Pickup"}</span></div>
              <div className="trs-line" />
              <div className="trs-row"><span className="trs-dot red" /><span>{dropoff?.address || "Dropoff"}</span></div>
            </div>
            <div className="trip-meta-row">
              <span>💰 ₹{fare}</span>
              <span>�� {routeInfo?.distKm || "~"} km</span>
              <span>⏱ {routeInfo?.durationMin || "~"} min</span>
            </div>
            <button className="cancel-btn" onClick={cancelRide}>Cancel</button>
          </div>
        </div>
      )}

      {rideStatus === "accepted" && currentRide && (
        <div className="trip-sheet accepted-sheet">
          <div className="trip-sheet-inner">
            <div className="otp-banner">
              <span className="otp-label">Share OTP with captain</span>
              <span className="otp-code">{tripOtp}</span>
            </div>
            <div className="captain-card-uber">
              <div className="captain-avatar-big">
                {captainInfo?.name?.[0]?.toUpperCase() || "C"}
              </div>
              <div className="captain-details">
                <div className="captain-name-big">{captainInfo?.name || currentRide.captainName || "Your Captain"}</div>
                <div className="captain-rating-row">
                  <span className="star">⭐</span>
                  <span>{captainInfo?.rating || "4.8"}</span>
                  <span className="dot-sep">·</span>
                  <span>{captainInfo?.totalRides || "0"} trips</span>
                </div>
              </div>
              <div className="captain-actions">
                <button className="icon-btn">📞</button>
                <button className="icon-btn">💬</button>
              </div>
            </div>
            <div className="vehicle-info-strip">
              <div className="vehicle-icon-lg">{rideType.icon}</div>
              <div className="vehicle-details">
                <div className="vehicle-model">{captainInfo?.vehicle?.model || rideType.name}</div>
                <div className="vehicle-sub">
                  {captainInfo?.vehicle?.color && `${captainInfo.vehicle.color} · `}
                  <strong className="plate-number">{captainInfo?.vehicle?.plate || ""}</strong>
                </div>
              </div>
              <div className="vehicle-type-pill">
                {(captainInfo?.vehicle?.type || rideType.id).toUpperCase()}
              </div>
            </div>
            <div className="trip-route-summary">
              <div className="trs-row"><span className="trs-dot green" /><span>{pickup?.address || "Pickup"}</span></div>
              <div className="trs-line" />
              <div className="trs-row"><span className="trs-dot red" /><span>{dropoff?.address || "Dropoff"}</span></div>
            </div>
            <div className="trip-fare-row">
              <div>
                <div className="tfare-label">Estimated Fare</div>
                <div className="tfare-amount">₹{fare}</div>
              </div>
              <div className="tfare-right">
                <div>{routeInfo?.distKm || "~"} km · {routeInfo?.durationMin || "~"} min</div>
                <div className="payment-tag">
                  {PAY_METHODS.find((p) => p.id === payMethod)?.icon} Pay by {PAY_METHODS.find((p) => p.id === payMethod)?.label}
                </div>
                <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
                  Free cancel {CANCEL_FREE_MINS} min · ₹{CANCEL_FEE} after
                </div>
              </div>
            </div>
            <button className="cancel-btn" onClick={cancelRide}>Cancel Ride</button>
          </div>
        </div>
      )}

      {rideStatus === "rating" && (
        <div className="trip-sheet accepted-sheet">
          <div className="trip-sheet-inner" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🏁</div>
            <h2 style={{ color: "#1db954", marginBottom: 4 }}>Trip Completed!</h2>
            <p style={{ color: "#888", fontSize: 13, marginBottom: 20 }}>
              How was your ride with{" "}
              <strong style={{ color: "#eee" }}>
                {captainInfo?.name || currentRide?.captainName || "your captain"}
              </strong>
              ?
            </p>

            {/* ── Star rating row ── */}
            <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  onMouseEnter={() => setHoveredStar(star)}
                  onMouseLeave={() => setHoveredStar(0)}
                  onClick={() => submitRating(star)}
                  style={{
                    fontSize: 40,
                    cursor: "pointer",
                    transition: "transform 0.15s",
                    transform: hoveredStar >= star ? "scale(1.25)" : "scale(1)",
                    filter: hoveredStar >= star ? "brightness(1.4)" : "brightness(0.6)",
                  }}
                >
                  ⭐
                </span>
              ))}
            </div>

            <div style={{ color: "#666", fontSize: 12, marginBottom: 16 }}>
              Tap a star to rate · your feedback helps improve quality
            </div>

            {/* Fare summary */}
            <div className="tfare-amount" style={{ marginTop: 8 }}>₹{fare}</div>
            <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
              {PAY_METHODS.find((p) => p.id === payMethod)?.icon}{" "}
              Pay {PAY_METHODS.find((p) => p.id === payMethod)?.label} to captain
            </div>

            <button
              onClick={skipRating}
              style={{
                marginTop: 20,
                background: "transparent",
                border: "1px solid #444",
                borderRadius: 10,
                padding: "10px 24px",
                color: "#888",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Skip
            </button>
          </div>
        </div>
      )}


      {schedConfirmed && rideStatus === "idle" && (
        <div className="trip-sheet accepted-sheet">
          <div className="trip-sheet-inner" style={{ textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>📅</div>
            <h2 style={{ color: "#1db954" }}>Ride Scheduled!</h2>
            <p style={{ color: "#888", margin: "8px 0 20px" }}>
              {bookingMode === "schedule" && schedDate && schedTime
                ? `Booked for ${new Date(`${schedDate}T${schedTime}`).toLocaleString("en-IN", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}`
                : departureResult ? `Depart by ${fmtTime(departureResult.depart)}` : "Scheduled"}
            </p>
            <div className="trip-route-summary" style={{ textAlign: "left" }}>
              <div className="trs-row"><span className="trs-dot green" /><span>{pickup?.address}</span></div>
              <div className="trs-line" />
              <div className="trs-row"><span className="trs-dot red" /><span>{dropoff?.address}</span></div>
            </div>
            <div className="trip-meta-row" style={{ margin: "12px 0" }}>
              <span>💰 ₹{fare}</span>
              <span>{rideType.icon} {rideType.name}</span>
              <span>{PAY_METHODS.find((p) => p.id === payMethod)?.icon} {PAY_METHODS.find((p) => p.id === payMethod)?.label}</span>
            </div>
            <button className="cancel-btn" onClick={() => setSchedConfirmed(false)}>Modify / Cancel</button>
          </div>
        </div>
      )}

      {/* ── Draggable Bottom Sheet (idle state only) ── */}
      {rideStatus === "idle" && !schedConfirmed && (
        <div
          ref={sheetRef}
          className="bottom-sheet-drag"
          style={{ height: sheetH, transition: dragState.current.dragging ? "none" : "height .3s cubic-bezier(.4,0,.2,1)" }}>

          {/* Drag handle */}
          <div className="sheet-drag-handle"
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}>
            <div className="drag-pill" />
          </div>

          {/* Service tab bar */}
          <div className="service-tabs">
            {[
              { id: "ride", icon: "🚗", label: "Rides" },
              { id: "courier", icon: "📦", label: "Courier" },
              { id: "rental", icon: "🔑", label: "Rentals" },
            ].map((t) => (
              <button key={t.id}
                className={`svc-tab ${serviceTab === t.id ? "active" : ""}`}
                onClick={() => setServiceTab(t.id)}>
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="sheet-scroll-area">

            {/* ═══════════ RIDES TAB ═══════════ */}
            {serviceTab === "ride" && (
              <>
                <div className="sheet-greeting">
                  <h2>Where to, {user.name?.split(" ")[0] || "Rider"}?</h2>
                </div>
                <div className="location-card">
                  <LocationSearch placeholder="📍 Pickup location" dotColor="green"
                    onSelect={setPickup} value={pickup?.address || ""} />
                  <div className="location-divider" />
                  <LocationSearch placeholder="🏁 Destination" dotColor="red"
                    onSelect={setDropoff} value={dropoff?.address || ""} />
                </div>
                {routeInfo && (
                  <div className="route-badge">
                    <span>📏 {routeInfo.distKm} km</span>
                    <span>⏱ {routeInfo.durationMin} min</span>
                  </div>
                )}
                {pickup && dropoff && (
                  <>
                    <div className="booking-mode-row">
                      {[
                        { id: "now", icon: "⚡", label: "Ride Now" },
                        { id: "schedule", icon: "📅", label: "Schedule" },
                        { id: "arrival", icon: "🕐", label: "By Arrival" },
                      ].map((m) => (
                        <button key={m.id}
                          className={`mode-btn ${bookingMode === m.id ? "active" : ""}`}
                          onClick={() => setBookingMode(m.id)}>
                          {m.icon} {m.label}
                        </button>
                      ))}
                    </div>

                    {bookingMode === "schedule" && (
                      <div className="schedule-box">
                        <div className="schedule-row">
                          <div className="input-group" style={{ flex: 1 }}>
                            <label>📆 Date</label>
                            <input type="date" min={new Date().toISOString().split("T")[0]}
                              value={schedDate} onChange={(e) => setSchedDate(e.target.value)} />
                          </div>
                          <div className="input-group" style={{ flex: 1 }}>
                            <label>🕐 Time</label>
                            <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} />
                          </div>
                        </div>
                        {schedDate && schedTime && (
                          <div className="schedule-preview">
                            📅 Scheduled for <strong>
                              {new Date(`${schedDate}T${schedTime}`).toLocaleString("en-IN", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                            </strong>
                          </div>
                        )}
                      </div>
                    )}

                    {bookingMode === "arrival" && (
                      <div className="schedule-box">
                        <div className="input-group">
                          <label>🎯 Arrival Time (when you must reach)</label>
                          <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} />
                        </div>
                        <div className="breaks-header">
                          <span>☕ Breaks during journey</span>
                          <button className="add-break-btn" onClick={addBreak}>+ Add</button>
                        </div>
                        {breaks.map((br, i) => (
                          <div key={i} className="break-row">
                            <input type="text" placeholder="Break name" value={br.label}
                              onChange={(e) => updateBreak(i, "label", e.target.value)}
                              className="break-name-input" />
                            <input type="number" min="5" max="120" value={br.mins}
                              onChange={(e) => updateBreak(i, "mins", e.target.value)}
                              className="break-mins-input" />
                            <span style={{ color: "#888", fontSize: 12 }}>min</span>
                            <button className="remove-break-btn" onClick={() => removeBreak(i)}>✕</button>
                          </div>
                        ))}
                        {departureResult && (
                          <div className="departure-result">
                            <div className="dep-main">🚀 Depart by <strong>{fmtTime(departureResult.depart)}</strong></div>
                            <div className="dep-breakdown">
                              <span>🛣 Trip: {departureResult.tripMins} min</span>
                              <span>☕ Breaks: {departureResult.breakMins} min</span>
                              <span>⏱ Total: {departureResult.totalMins} min</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="section-title">Choose a ride</div>
                    <div className="ride-types">
                      {RIDE_TYPES.map((type) => (
                        <div key={type.id}
                          className={`ride-type-card ${selectedType === type.id ? "selected" : ""}`}
                          onClick={() => setSelectedType(type.id)}>
                          <div className="ride-type-icon">{type.icon}</div>
                          <div className="ride-type-name">{type.name}</div>
                          <div className="ride-type-time">{type.time}</div>
                          <div className="ride-type-fare">₹{calcFare(type, routeInfo?.distKm)}</div>
                        </div>
                      ))}
                    </div>

                    <div className="fare-summary-row">
                      <div>
                        <div style={{ fontSize: 13, color: "#888" }}>Estimated fare</div>
                        <div className="fare-amount">₹{fare}</div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                          {routeInfo?.distKm} km · {routeInfo?.durationMin} min ·{" "}
                          {PAY_METHODS.find((p) => p.id === payMethod)?.icon} {PAY_METHODS.find((p) => p.id === payMethod)?.label}
                        </div>
                      </div>
                      <button className="book-btn-inline" onClick={requestRide}>
                        {bookingMode === "now" ? `Book ${rideType.icon}` : "📅 Schedule"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ═══════════ COURIER TAB ═══════════ */}
            {serviceTab === "courier" && (
              <>
                {courierStatus === "sent" ? (
                  <div style={{ textAlign: "center", padding: "30px 20px" }}>
                    <div style={{ fontSize: 60 }}>📦</div>
                    <h2 style={{ color: "#1db954", margin: "12px 0 8px" }}>Parcel Booked!</h2>
                    <p style={{ color: "#888", fontSize: 13 }}>
                      A delivery partner ({courierVehicle.name}) will pick up your parcel shortly.
                    </p>
                    <div className="trip-route-summary" style={{ marginTop: 16, textAlign: "left" }}>
                      <div className="trs-row"><span className="trs-dot green" /><span>{cFrom?.address || "Pickup"}</span></div>
                      <div className="trs-line" />
                      <div className="trs-row"><span className="trs-dot red" /><span>{cTo?.address || "Delivery"}</span></div>
                    </div>
                    <div className="trip-meta-row" style={{ marginTop: 12 }}>
                      <span>📦 {cWeight} kg</span>
                      <span>💰 ₹{courierFare}</span>
                      <span>👤 {cName}</span>
                    </div>
                    <button className="cancel-btn" style={{ marginTop: 16 }} onClick={() => { setCourierStatus("idle"); setCFrom(null); setCTo(null); }}>
                      New Delivery
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="sheet-greeting"><h2>Send a Parcel</h2></div>

                    <div className="location-card">
                      <LocationSearch placeholder="📍 Pickup address" dotColor="green"
                        onSelect={setCFrom} value={cFrom?.address || ""} />
                      <div className="location-divider" />
                      <LocationSearch placeholder="🏁 Delivery address" dotColor="red"
                        onSelect={setCTo} value={cTo?.address || ""} />
                    </div>

                    {cRouteInfo && (
                      <div className="route-badge">
                        <span>📏 {cRouteInfo.distKm} km</span>
                        <span>⏱ ~{cRouteInfo.durationMin} min</span>
                      </div>
                    )}

                    <div className="section-title">Select vehicle</div>
                    <div className="courier-vehicles">
                      {COURIER_VEHICLES.map((v) => (
                        <div key={v.id}
                          className={`courier-vehicle-card ${cVehicle === v.id ? "selected" : ""}`}
                          onClick={() => setCVehicle(v.id)}>
                          <div style={{ fontSize: 28 }}>{v.icon}</div>
                          <div className="cv-name">{v.name}</div>
                          <div className="cv-cap">up to {v.maxKg} kg</div>
                          <div className="cv-fare">₹{calcCourier(v, cRouteInfo?.distKm, cWeight)}</div>
                        </div>
                      ))}
                    </div>

                    <div className="schedule-box" style={{ marginTop: 12 }}>
                      <div className="section-title" style={{ marginBottom: 10 }}>Parcel details</div>
                      <div className="input-group" style={{ marginBottom: 10 }}>
                        <label>⚖️ Weight (kg)</label>
                        <input type="number" min="0.1" max={courierVehicle.maxKg} step="0.5"
                          value={cWeight} onChange={(e) => setCWeight(Number(e.target.value))} />
                      </div>
                      <div className="input-group" style={{ marginBottom: 10 }}>
                        <label>👤 Receiver name</label>
                        <input type="text" placeholder="Enter receiver name"
                          value={cName} onChange={(e) => setCName(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label>📞 Receiver phone</label>
                        <input type="tel" placeholder="10-digit number"
                          value={cPhone} onChange={(e) => setCPhone(e.target.value)} />
                      </div>
                    </div>

                    <div className="fare-summary-row" style={{ marginTop: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#888" }}>Delivery cost</div>
                        <div className="fare-amount">₹{courierFare}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>{cRouteInfo?.distKm || "~"} km · {cWeight} kg · {courierVehicle.name}</div>
                      </div>
                      <button className="book-btn-inline" onClick={sendCourier}>📦 Send</button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ═══════════ RENTALS TAB ═══════════ */}
            {serviceTab === "rental" && (
              <>
                {rentalStatus === "confirmed" ? (
                  <div style={{ textAlign: "center", padding: "30px 20px" }}>
                    <div style={{ fontSize: 60 }}>{rentalVehicle.icon}</div>
                    <h2 style={{ color: "#1db954", margin: "12px 0 8px" }}>Rental Confirmed!</h2>
                    <p style={{ color: "#888", fontSize: 13 }}>
                      {rentalVehicle.name} · {rHours} hrs · {rWithDriver ? "With driver" : "Self-drive"}
                    </p>
                    <div className="tfare-amount" style={{ marginTop: 12 }}>₹{rentalFare}</div>
                    <p style={{ color: "#666", fontSize: 12, marginTop: 6 }}>
                      📍 Pickup: {rLocation?.address || "Your location"}
                    </p>
                    <button className="cancel-btn" style={{ marginTop: 16 }}
                      onClick={() => { setRentalStatus("idle"); setRLocation(null); }}>
                      New Rental
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="sheet-greeting"><h2>Rent a Vehicle</h2></div>

                    <div className="location-card">
                      <LocationSearch placeholder="📍 Your pickup location" dotColor="green"
                        onSelect={setRLocation} value={rLocation?.address || ""} />
                    </div>

                    <div className="section-title">Select vehicle</div>
                    <div className="rental-grid">
                      {RENTAL_VEHICLES.map((v) => (
                        <div key={v.id}
                          className={`rental-vehicle-card ${rVehicle === v.id ? "selected" : ""}`}
                          onClick={() => setRVehicle(v.id)}>
                          <div className="rv-icon">{v.icon}</div>
                          <div className="rv-name">{v.name}</div>
                          <div className="rv-desc">{v.desc}</div>
                          <div className="rv-rate">₹{v.perHr}/hr</div>
                        </div>
                      ))}
                    </div>

                    <div className="schedule-box" style={{ marginTop: 12 }}>
                      {/* Driver toggle */}
                      <div className="driver-toggle-row">
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#eee" }}>With Driver</div>
                          <div style={{ fontSize: 12, color: "#888" }}>+₹100 · driver included</div>
                        </div>
                        <label className="toggle">
                          <input type="checkbox" checked={rWithDriver}
                            onChange={(e) => setRWithDriver(e.target.checked)} />
                          <span className="toggle-slider" />
                        </label>
                      </div>

                      {/* Duration slider */}
                      <div className="input-group" style={{ marginTop: 14 }}>
                        <label>⏱ Duration: <strong style={{ color: "#1db954" }}>{rHours} hrs</strong></label>
                        <input type="range" min="1" max="24" step="1"
                          value={rHours} onChange={(e) => setRHours(Number(e.target.value))}
                          className="duration-slider" />
                        <div className="slider-labels">
                          <span>1 hr</span><span>12 hrs</span><span>24 hrs</span>
                        </div>
                      </div>
                    </div>

                    <div className="fare-summary-row" style={{ marginTop: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#888" }}>Rental total</div>
                        <div className="fare-amount">₹{rentalFare}</div>
                        <div style={{ fontSize: 12, color: "#666" }}>
                          {rentalVehicle.name} · {rHours} hrs{rWithDriver ? " · With driver" : ""}
                        </div>
                      </div>
                      <button className="book-btn-inline" onClick={confirmRental}>🔑 Rent</button>
                    </div>
                  </>
                )}
              </>
            )}

          </div>{/* end sheet-scroll-area */}
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
};

export default UserPage;
