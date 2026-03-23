import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BACKEND_URL from "../config";

const user = JSON.parse(localStorage.getItem("ucab_user") || "{}");
const tkn  = localStorage.getItem("ucab_token");
const AUTH  = tkn ? { headers: { Authorization: `Bearer ${tkn}` } } : {};

/* ─── Color Theme: uride (Purple & Green) ──────────────────── */
const COLORS = {
  primary: "#6f42c1",      // Deep purple
  secondary: "#00d084",    // Vibrant green
  accent: "#ffc107",       // Amber
  bg: "#1a1a2e",           // Dark navy
  bgLight: "#16213e",      // Slightly lighter
  text: "#ffffff",
  textSecondary: "#a8b5d1", // Muted blue
  border: "rgba(111, 66, 193, 0.2)",
  error: "#e74c3c",
};

/* ─── Helpers ──────────────────────────────────────────────── */
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const timeUntilDeparture = (iso) => {
  if (!iso) return "";
  const now = new Date();
  const departure = new Date(iso);
  const diff = departure - now;
  if (diff < 0) return "Departed";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m away`;
  return `${minutes}m away`;
};

/* ─── CarpoolPage ──────────────────────────────────────────── */
export default function CarpoolPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("browse");
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookingRideId, setBookingRideId] = useState(null);
  const [bookSeats, setBookSeats] = useState(1);
  const [bookMsg, setBookMsg] = useState("");
  const [offerOriginText, setOfferOriginText] = useState("");
  const [offerDestText, setOfferDestText] = useState("");
  const [offerDepart, setOfferDepart] = useState("");
  const [offerSeats, setOfferSeats] = useState(3);
  const [offerPrice, setOfferPrice] = useState(50);
  const [offerVehicle, setOfferVehicle] = useState("");
  const [offerMsg, setOfferMsg] = useState("");
  const [offerLoading, setOfferLoading] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [myLoading, setMyLoading] = useState(false);
  const [respondMsg, setRespondMsg] = useState("");

  const fetchRides = useCallback(() => {
    setLoading(true);
    axios.get(`${BACKEND_URL}/api/carpool`, AUTH)
      .then((r) => setRides(Array.isArray(r.data) ? r.data : (r.data?.carpools || r.data?.rides || [])))
      .catch(() => setRides([]))
      .finally(() => setLoading(false));
  }, []);

  const fetchMy = useCallback(() => {
    if (!user._id) return;
    setMyLoading(true);
    axios.get(`${BACKEND_URL}/api/carpool/my/${user._id}`, AUTH)
      .then((r) => {
        setMyBookings(r.data.bookings || []);
        setMyRides(r.data.rides || []);
      })
      .catch(() => {})
      .finally(() => setMyLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "browse") fetchRides();
    if (tab === "mybookings" || tab === "myrides") fetchMy();
  }, [tab, fetchRides, fetchMy]);

  const handleBook = async (rideId) => {
    setBookMsg("");
    if (!user._id) { setBookMsg("Please log in first."); return; }
    try {
      const payload = {
        riderId: user._id,
        riderName: user.name || "Rider",
        riderPhone: user.phone || "",
        seats: bookSeats,
      };
      await axios.post(`${BACKEND_URL}/api/carpool/${rideId}/book`, payload, AUTH);
      setBookMsg("✅ Booking request sent! Waiting for driver approval.");
      setBookingRideId(null);
      fetchRides();
    } catch (e) {
      setBookMsg(e.response?.data?.message || e.response?.data?.error || "Booking failed.");
    }
  };

  const handleOffer = async (e) => {
    e.preventDefault();
    setOfferMsg("");
    if (!user._id) { setOfferMsg("Please log in first."); return; }
    if (!offerOriginText || !offerDestText || !offerDepart) {
      setOfferMsg("Please fill all required fields.");
      return;
    }
    setOfferLoading(true);
    try {
      const payload = {
        driverId: user._id,
        driverName: user.name || "Driver",
        driverPhone: user.phone || "",
        vehicleDesc: offerVehicle,
        origin: { address: offerOriginText },
        destination: { address: offerDestText },
        departureTime: new Date(offerDepart).toISOString(),
        totalSeats: Number(offerSeats),
        pricePerSeat: Number(offerPrice),
      };
      await axios.post(`${BACKEND_URL}/api/carpool`, payload, AUTH);
      setOfferMsg("✅ Ride posted! Riders can now book it.");
      setOfferOriginText(""); setOfferDestText(""); setOfferDepart("");
      setOfferSeats(3); setOfferPrice(50); setOfferVehicle("");
    } catch (e) {
      setOfferMsg(e.response?.data?.message || "Failed to post ride.");
    } finally {
      setOfferLoading(false);
    }
  };

  const handleRespond = async (bookingId, action) => {
    setRespondMsg("");
    try {
      await axios.put(
        `${BACKEND_URL}/api/carpool/bookings/${bookingId}/respond`,
        { action, driverId: user._id },
        AUTH
      );
      setRespondMsg(`✅ Booking ${action === "accept" ? "accepted" : "rejected"}.`);
      fetchMy();
    } catch (e) {
      setRespondMsg(e.response?.data?.message || "Action failed.");
    }
  };

  const handleStartRide = async (rideId) => {
    if (!window.confirm("Start this ride now? No more bookings will be accepted.")) return;
    try {
      await axios.put(
        `${BACKEND_URL}/api/carpool/${rideId}/start`,
        { driverId: user._id },
        AUTH
      );
      fetchMy();
    } catch (e) {
      alert(e.response?.data?.message || "Failed to start ride.");
    }
  };

  const handleCancelRide = async (rideId) => {
    if (!window.confirm("Cancel this ride? All pending bookings will be rejected.")) return;
    try {
      await axios.delete(`${BACKEND_URL}/api/carpool/${rideId}`, {
        data: { driverId: user._id },
        ...AUTH,
      });
      fetchMy();
    } catch (e) {
      alert(e.response?.data?.message || "Cancel failed.");
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(135deg, ${COLORS.bg} 0%, ${COLORS.bgLight} 100%)`,
      color: COLORS.text,
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      paddingBottom: 20,
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.bgLight})`,
        borderBottom: `2px solid ${COLORS.secondary}`,
        boxShadow: "0 2px 8px rgba(111, 66, 193, 0.15)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: COLORS.text,
            fontSize: 24,
            cursor: "pointer",
            borderRadius: "50%",
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>🚗 Carpool</div>
          <div style={{ fontSize: 12, color: COLORS.textSecondary }}>Share rides, save money</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex",
        borderBottom: `2px solid ${COLORS.border}`,
        background: COLORS.bgLight,
        overflowX: "auto",
        position: "sticky",
        top: 60,
        zIndex: 99,
      }}>
        {[
          { id: "browse", label: "🔍 Browse" },
          { id: "offer", label: "➕ Offer" },
          { id: "mybookings", label: "🎫 Bookings" },
          { id: "myrides", label: "🚘 Rides" },
        ].map((t) => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: "0 0 auto",
              padding: "12px 14px",
              border: "none",
              cursor: "pointer",
              background: "none",
              fontSize: 13,
              fontWeight: 600,
              color: tab === t.id ? COLORS.secondary : COLORS.textSecondary,
              borderBottom: tab === t.id ? `3px solid ${COLORS.secondary}` : `3px solid transparent`,
              whiteSpace: "nowrap",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px" }}>
        {/* BROWSE */}
        {tab === "browse" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Available Rides</div>
              <button onClick={fetchRides} style={{ background: `linear-gradient(90deg, ${COLORS.secondary}, #00b872)`, border: "none", borderRadius: 20, padding: "8px 16px", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                🔄 Refresh
              </button>
            </div>

            {bookMsg && (
              <div style={{ background: bookMsg.startsWith("✅") ? `rgba(0, 208, 132, 0.15)` : `rgba(231,76,60,0.15)`, border: `1px solid ${bookMsg.startsWith("✅") ? COLORS.secondary : COLORS.error}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 14, color: bookMsg.startsWith("✅") ? COLORS.secondary : COLORS.error, fontWeight: 600 }}>
                {bookMsg}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>Loading rides…</div>
            ) : rides.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🚗</div>
                <div style={{ color: COLORS.textSecondary, fontSize: 16 }}>No rides available now.</div>
              </div>
            ) : (
              rides.map((ride) => {
                const canBook = ride.availableSeats > 0 && !ride.started && new Date(ride.departureTime) > new Date();
                return (
                  <div key={ride.id} style={{
                    background: `linear-gradient(135deg, rgba(111,66,193,0.1), rgba(0,208,132,0.05))`,
                    border: `1.5px solid ${COLORS.border}`,
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 14,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
                          {ride.origin?.address} <span style={{ color: COLORS.secondary }}>→</span> {ride.destination?.address}
                        </div>
                        <div style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 }}>👤 {ride.driverName}</div>
                        <div style={{ fontSize: 12, color: COLORS.textSecondary }}>🕐 {fmtDate(ride.departureTime)} <span style={{ color: COLORS.secondary }}>({timeUntilDeparture(ride.departureTime)})</span></div>
                        {ride.vehicleDesc && <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>🚗 {ride.vehicleDesc}</div>}
                        {ride.started && <div style={{ fontSize: 12, color: COLORS.accent, marginTop: 6, fontWeight: 600 }}>⏱️ Ride started</div>}
                      </div>
                      <div style={{ textAlign: "right", marginLeft: 12 }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.secondary }}>₹{ride.pricePerSeat}</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary }}>per seat</div>
                        <div style={{ fontSize: 11, color: COLORS.textSecondary, marginTop: 6 }}>{ride.availableSeats}/{ride.totalSeats}</div>
                      </div>
                    </div>

                    {bookingRideId === ride.id ? (
                      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <label style={{ fontSize: 12, color: COLORS.textSecondary, fontWeight: 600 }}>Seats:</label>
                        <select value={bookSeats} onChange={(e) => setBookSeats(Number(e.target.value))} style={{ background: COLORS.bgLight, color: COLORS.text, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 13 }}>
                          {Array.from({ length: ride.availableSeats }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>{n}</option>
                          ))}
                        </select>
                        <button onClick={() => handleBook(ride.id)} style={{ background: `linear-gradient(90deg, ${COLORS.secondary}, #00b872)`, border: "none", borderRadius: 8, padding: "8px 16px", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                          Confirm
                        </button>
                        <button onClick={() => setBookingRideId(null)} style={{ background: "none", border: `1.5px solid ${COLORS.border}`, borderRadius: 8, padding: "7px 14px", color: COLORS.textSecondary, cursor: "pointer", fontSize: 13 }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button disabled={!canBook} onClick={() => { setBookingRideId(ride.id); setBookSeats(1); }} style={{ marginTop: 12, width: "100%", background: !canBook ? `rgba(111,66,193,0.3)` : `linear-gradient(90deg, ${COLORS.secondary}, #00b872)`, border: "none", borderRadius: 10, padding: "12px 0", color: !canBook ? COLORS.textSecondary : "#000", fontWeight: 700, cursor: !canBook ? "not-allowed" : "pointer", fontSize: 15 }}>
                        {ride.started ? "🚫 Ride Started" : ride.availableSeats === 0 ? "✓ Full" : "Book Now"}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* OFFER */}
        {tab === "offer" && (
          <form onSubmit={handleOffer}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Offer a Ride</div>

            {offerMsg && (
              <div style={{ background: offerMsg.startsWith("✅") ? `rgba(0, 208, 132, 0.15)` : `rgba(231,76,60,0.15)`, border: `1px solid ${offerMsg.startsWith("✅") ? COLORS.secondary : COLORS.error}`, borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 14, color: offerMsg.startsWith("✅") ? COLORS.secondary : COLORS.error, fontWeight: 600 }}>
                {offerMsg}
              </div>
            )}

            {[
              { label: "From", value: offerOriginText, set: setOfferOriginText },
              { label: "To", value: offerDestText, set: setOfferDestText },
              { label: "Vehicle", value: offerVehicle, set: setOfferVehicle },
            ].map(({ label, value, set }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600 }}>{label}</label>
                <input value={value} onChange={(e) => set(e.target.value)} placeholder={label} style={{ width: "100%", background: `rgba(111,66,193,0.1)`, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", color: COLORS.text, fontSize: 14, boxSizing: "border-box" }} />
              </div>
            ))}

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600 }}>Departure Time</label>
              <input type="datetime-local" value={offerDepart} onChange={(e) => setOfferDepart(e.target.value)} min={new Date().toISOString().slice(0, 16)} style={{ width: "100%", background: `rgba(111,66,193,0.1)`, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", color: COLORS.text, fontSize: 14, boxSizing: "border-box", colorScheme: "dark" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600 }}>Seats</label>
                <input type="number" min={1} max={6} value={offerSeats} onChange={(e) => setOfferSeats(e.target.value)} style={{ width: "100%", background: `rgba(111,66,193,0.1)`, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", color: COLORS.text, fontSize: 14, boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: COLORS.textSecondary, marginBottom: 6, fontWeight: 600 }}>Price (₹)</label>
                <input type="number" min={1} value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} style={{ width: "100%", background: `rgba(111,66,193,0.1)`, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px", color: COLORS.text, fontSize: 14, boxSizing: "border-box" }} />
              </div>
            </div>

            <button type="submit" disabled={offerLoading} style={{ width: "100%", background: offerLoading ? `rgba(111,66,193,0.3)` : `linear-gradient(90deg, ${COLORS.secondary}, #00b872)`, border: "none", borderRadius: 10, padding: "14px 0", color: offerLoading ? COLORS.textSecondary : "#000", fontWeight: 800, fontSize: 15, cursor: offerLoading ? "not-allowed" : "pointer" }}>
              {offerLoading ? "Posting…" : "🚗 Post Ride"}
            </button>
          </form>
        )}

        {/* MY BOOKINGS */}
        {tab === "mybookings" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>My Bookings</div>
              <button onClick={fetchMy} style={{ background: `linear-gradient(90deg, ${COLORS.secondary}, #00b872)`, border: "none", borderRadius: 20, padding: "8px 16px", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                🔄 Refresh
              </button>
            </div>

            {myLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>Loading…</div>
            ) : myBookings.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎫</div>
                <div style={{ color: COLORS.textSecondary, fontSize: 16 }}>No bookings yet.</div>
              </div>
            ) : (
              myBookings.map((b) => (
                <div key={b.id} style={{ background: `linear-gradient(135deg, rgba(111,66,193,0.1), rgba(0,208,132,0.05))`, border: `1.5px solid ${COLORS.border}`, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{b.origin?.address} → {b.destination?.address}</div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 10 }}>{b.driverName} · 🕐 {fmtDate(b.departureTime)}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.secondary }}>₹{b.totalCost}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: b.status === "accepted" ? "rgba(0, 208, 132, 0.2)" : "rgba(255,193,7,0.2)", color: b.status === "accepted" ? COLORS.secondary : COLORS.accent }}>
                      {b.status?.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* MY RIDES */}
        {tab === "myrides" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>My Rides</div>
              <button onClick={fetchMy} style={{ background: `linear-gradient(90deg, ${COLORS.secondary}, #00b872)`, border: "none", borderRadius: 20, padding: "8px 16px", color: "#000", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                🔄 Refresh
              </button>
            </div>

            {respondMsg && (
              <div style={{ background: `rgba(0, 208, 132, 0.15)`, border: `1px solid ${COLORS.secondary}`, borderRadius: 10, padding: "12px 16px", marginBottom: 14, fontSize: 14, color: COLORS.secondary, fontWeight: 600 }}>
                {respondMsg}
              </div>
            )}

            {myLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: COLORS.textSecondary }}>Loading…</div>
            ) : myRides.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🚘</div>
                <div style={{ color: COLORS.textSecondary, fontSize: 16 }}>No rides posted yet.</div>
              </div>
            ) : (
              myRides.map((ride) => (
                <div key={ride.id} style={{ background: `linear-gradient(135deg, rgba(111,66,193,0.15), rgba(0,208,132,0.08))`, border: `1.5px solid ${COLORS.border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{ride.origin?.address} → {ride.destination?.address}</div>
                      <div style={{ fontSize: 12, color: COLORS.textSecondary }}>🕐 {fmtDate(ride.departureTime)} · {ride.availableSeats}/{ride.totalSeats} seats</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 20, marginLeft: 8, background: ride.started ? "rgba(231,76,60,0.2)" : "rgba(0, 208, 132, 0.2)", color: ride.started ? COLORS.error : COLORS.secondary }}>
                      {ride.started ? "🚀 STARTED" : ride.status?.toUpperCase()}
                    </span>
                  </div>

                  {ride.bookings && ride.bookings.length > 0 && (
                    <div style={{ marginBottom: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 10 }}>
                      <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 8, fontWeight: 700 }}>Booking Requests ({ride.bookings.length})</div>
                      {ride.bookings.map((bk) => (
                        <div key={bk.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>{bk.riderName}</div>
                            <div style={{ fontSize: 11, color: COLORS.textSecondary }}>{bk.seats} seat(s) · {bk.riderPhone}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: bk.status === "accepted" ? "rgba(0, 208, 132, 0.2)" : "rgba(255,193,7,0.2)", color: bk.status === "accepted" ? COLORS.secondary : COLORS.accent }}>
                              {bk.status?.toUpperCase()}
                            </span>
                            {bk.status === "pending" && !ride.started && (
                              <>
                                <button onClick={() => handleRespond(bk.id, "accept")} style={{ background: `linear-gradient(90deg, ${COLORS.secondary}, #00b872)`, border: "none", borderRadius: 6, padding: "5px 12px", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                                  ✓ Accept
                                </button>
                                <button onClick={() => handleRespond(bk.id, "reject")} style={{ background: `rgba(231,76,60,0.2)`, border: `1px solid ${COLORS.error}`, borderRadius: 6, padding: "5px 12px", color: COLORS.error, fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
                                  ✗ Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {ride.status === "active" && !ride.started && (
                      <button onClick={() => handleStartRide(ride.id)} style={{ flex: 1, minWidth: 120, background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.secondary})`, border: "none", borderRadius: 8, padding: "10px 16px", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                        🚀 Start Ride
                      </button>
                    )}
                    {ride.status === "active" && !ride.started && (
                      <button onClick={() => handleCancelRide(ride.id)} style={{ flex: 1, minWidth: 120, background: `rgba(231,76,60,0.2)`, border: `1.5px solid ${COLORS.error}`, borderRadius: 8, padding: "10px 16px", color: COLORS.error, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                        🚫 Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
