import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import io from "socket.io-client";
import MapView from "../components/MapView";
import LocationSearch from "../components/LocationSearch";
import BACKEND_URL from "../config";

/* ─── Constants ─────────────────────────────────────────────── */
const RIDE_TYPES = [
  { id: "go", name: "uride Go", icon: "🚗", time: "2 min", base: 30, perKm: 10 },
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

const SUPPORT_CATEGORIES = [
  { id: "driver_behavior", label: "Driver behavior" },
  { id: "overcharged", label: "Overcharged / wrong fare" },
  { id: "safety", label: "Safety concern" },
  { id: "wrong_route", label: "Wrong route taken" },
  { id: "ride_not_completed", label: "Ride not completed" },
  { id: "app_issue", label: "App / technical issue" },
  { id: "other", label: "Other" },
];

const RATING_TAGS = [
  "Great Driver", "Clean Vehicle", "On Time", "Safe Driving",
  "Friendly", "Good Navigation", "Smooth Ride",
];

const CANCEL_REASONS = [
  "Driver is too far away",
  "Changed my mind",
  "Wrong pickup location",
  "Took too long to find a driver",
  "Booked by mistake",
  "Found another option",
  "Other",
];

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
  const [serviceTab, setServiceTab] = useState("ride"); // ride | courier | rental | carpool

  /* ─── Nearby captains + loyalty ───────────────────────────── */
  const [nearbyCaptains, setNearbyCaptains] = useState([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);

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

  /* ─── Tip / surge state ────────────────────────────────────── */
  const [tipAmount, setTipAmount] = useState(0);
  const [displayFare, setDisplayFare] = useState(0); // tracks fare shown to user incl. tip
  const [searchElapsed, setSearchElapsed] = useState(0);
  const searchTimerRef = useRef(null);

  /* ─── Messaging / ride-started state ─────────────────────── */
  const [captainMessages, setCaptainMessages] = useState([]);
  const [rideStarted, setRideStarted] = useState(false);
  const [userMsgInput, setUserMsgInput] = useState("");

  /* ─── Account drawer ──────────────────────────────────────── */
  const [showAccount, setShowAccount] = useState(false);
  const [accountTab, setAccountTab] = useState("home"); // home | wallet | history

  /* ─── Wallet state ────────────────────────────────────────── */
  const [walletBalance, setWalletBalance] = useState(0);
  const [walletTxns, setWalletTxns] = useState([]);
  const [topupAmt, setTopupAmt] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoMsg, setPromoMsg] = useState("");
  const [useWallet, setUseWallet] = useState(false);

  /* ─── Ride history state ──────────────────────────────────── */
  const [rideHistory, setRideHistory] = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  /* ─── ETA / live captain location ────────────────────────── */
  const [captainEta, setCaptainEta] = useState(null);

  /* ─── Bid pricing state ───────────────────────────────────── */
  const [bidMode, setBidMode] = useState(false);
  const [bidPrice, setBidPrice] = useState("");
  const [bidStatus, setBidStatus] = useState(null);
  const [bidCounter, setBidCounter] = useState(null);

  /* ─── Support / complaint system ─────────────────────────── */
  const [supportModal, setSupportModal] = useState(false);
  const [supportRide, setSupportRide] = useState(null);
  const [supportCategory, setSupportCategory] = useState("driver_behavior");
  const [supportDesc, setSupportDesc] = useState("");
  const [supportMsg, setSupportMsg] = useState("");
  const [supportTickets, setSupportTickets] = useState([]);

  /* ─── Cancel reason modal ────────────────────────────────── */
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  /* ─── P0 new state ────────────────────────────────────────── */
  const [surgeMultiplier, setSurgeMultiplier] = useState(1);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [ratingTags, setRatingTags] = useState([]);
  const [captainArrivedBanner, setCaptainArrivedBanner] = useState(false);
  const [shareToken, setShareToken] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(
    () => JSON.parse(localStorage.getItem("ucab_recent_searches") || "[]")
  );
  const [showRecentSearches, setShowRecentSearches] = useState(false);

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

  /* ─── P0: Load saved places, emergency contacts, surge on mount ─ */
  useEffect(() => {
    if (!tkn) return;
    axios.get(`${BACKEND_URL}/api/auth/user/saved-places`, { headers: { Authorization: `Bearer ${tkn}` } })
      .then((r) => setSavedPlaces(r.data.savedPlaces || [])).catch(() => { });
    axios.get(`${BACKEND_URL}/api/auth/user/emergency-contacts`, { headers: { Authorization: `Bearer ${tkn}` } })
      .then((r) => setEmergencyContacts(r.data.contacts || [])).catch(() => { });
    axios.get(`${BACKEND_URL}/api/rides/surge`)
      .then((r) => setSurgeMultiplier(r.data.multiplier || 1)).catch(() => { });
  }, [tkn]);  // eslint-disable-line

  /* ─── P0: Socket listeners for captain:arrived + share token ── */
  useEffect(() => {
    socket.on("captain:arrived", ({ captainName }) => {
      setCaptainArrivedBanner(true);
      showToast(`📍 ${captainName || "Captain"} has arrived at your pickup!`);
      // Play a notification beep (Web Audio API — no file needed)
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        osc.start(); osc.stop(ctx.currentTime + 0.8);
      } catch (_) { }
      setTimeout(() => setCaptainArrivedBanner(false), 8000);
    });
    socket.on("ride:share_token", ({ shareToken: t }) => {
      setShareToken(t);
      const link = `${window.location.origin}/track/${t}`;
      navigator.clipboard?.writeText(link).catch(() => { });
      showToast("🔗 Tracking link copied! Share it with friends or family.");
    });
    return () => {
      socket.off("captain:arrived");
      socket.off("ride:share_token");
    };
  }, [socket]);  // eslint-disable-line

  /* ─── Load wallet + ride history on mount ─────────────────── */
  useEffect(() => {
    if (!tkn) return;
    axios.get(`${BACKEND_URL}/api/wallet/balance`, { headers: { Authorization: `Bearer ${tkn}` } })
      .then((r) => { setWalletBalance(r.data.balance || 0); setWalletTxns(r.data.transactions || []); })
      .catch(() => { });
  }, [tkn]);

  useEffect(() => {
    if (!user?._id) return;
    axios.get(`${BACKEND_URL}/api/auth/user/trips?userId=${user._id}&limit=50`)
      .then((r) => { setRideHistory(r.data.trips || []); setHistoryLoaded(true); })
      .catch(() => setHistoryLoaded(true));
  }, []);  // eslint-disable-line
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

  /* ─── Loyalty points fetch ────────────────────────────────── */
  useEffect(() => {
    if (!user?._id) return;
    axios.get(`${BACKEND_URL}/api/auth/user/loyalty?userId=${user._id}`)
      .then((r) => setLoyaltyPoints(r.data.loyaltyPoints || 0))
      .catch(() => { });
  }, []);  // eslint-disable-line

  /* ─── Loyalty points awarded socket ──────────────────────── */
  useEffect(() => {
    socket.on("loyalty:points_earned", ({ points, total }) => {
      setLoyaltyPoints(total);
      showToast(`🎁 You earned ${points} loyalty point${points !== 1 ? "s" : ""}! Total: ${total}`);
    });
    return () => socket.off("loyalty:points_earned");
  }, [socket]);  // eslint-disable-line

  /* ─── Nearby captains fetch ───────────────────────────────── */
  useEffect(() => {
    const loc = pickup || null;
    if (!loc?.lat || !loc?.lng) return;
    axios.get(`${BACKEND_URL}/api/auth/captains/nearby?lat=${loc.lat}&lng=${loc.lng}&radius=5`)
      .then((r) => setNearbyCaptains(r.data?.captains || []))
      .catch(() => { });
  }, [pickup]);

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

      const vehicleInfo = data.captain?.vehicle
        ? `${data.captain.vehicle.color} ${data.captain.vehicle.model} (${data.captain.vehicle.plate})`
        : "Your Captain";
      showToast(`🎉 ${vehicleInfo} is on the way!`);
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

  /* ─── Captain messages + ride:started ──────────────────── */
  useEffect(() => {
    socket.on("captain:message", (payload) => {
      setCaptainMessages((prev) => [...prev, payload]);
      showToast(`💬 Captain: ${payload.message}`);
    });
    socket.on("ride:started", () => {
      setRideStarted(true);
      setTimeout(() => setRideStarted(false), 4000);
    });

    // Live captain location → update map pin + compute rough ETA
    socket.on("captain:location", ({ lat, lng }) => {
      setCaptainPos({ lat, lng });
      if (pickup?.lat) {
        const R = 6371;
        const toR = (d) => (d * Math.PI) / 180;
        const dLat = toR(lat - pickup.lat);
        const dLon = toR(lng - pickup.lng);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toR(pickup.lat)) * Math.cos(toR(lat)) * Math.sin(dLon / 2) ** 2;
        const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        setCaptainEta(Math.max(1, Math.round(distKm / 0.3))); // ~18 km/h in city
      }
    });

    // Bid responses from captain
    socket.on("ride:bid_response", ({ action, bidStatus: bs, counterPrice }) => {
      setBidStatus(bs);
      if (bs === "accepted") showToast("✅ Captain accepted your bid price!");
      else if (bs === "countered") { setBidCounter(counterPrice); showToast(`💰 Captain countered with ₹${counterPrice}. Accept?`); }
      else if (bs === "rejected") showToast("❌ Captain rejected your bid. Try standard fare.");
    });

    return () => {
      socket.off("captain:message");
      socket.off("ride:started");
      socket.off("captain:location");
      socket.off("ride:bid_response");
    };
  }, [socket, pickup]);

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
    clearInterval(searchTimerRef.current);
    setSearchElapsed(0);
    setTipAmount(0);
    setDisplayFare(0);
    setCaptainMessages([]);
    setRideStarted(false);
    setUserMsgInput("");
    setCaptainEta(null);
    setBidMode(false);
    setBidPrice("");
    setBidStatus(null);
    setBidCounter(null);
    setPromoDiscount(0);
    setPromoCode("");
    setPromoMsg("");
    setSupportModal(false);
    setSupportMsg("");
    setShowCancelModal(false);
    setCancelReason("");
  };

  /* ─── Wallet helpers ───────────────────────────────────────── */
  const topupWallet = async () => {
    const amt = parseFloat(topupAmt);
    if (!amt || amt < 1 || amt > 10000) { showToast("⚠️ Enter amount between ₹1 and ₹10000"); return; }
    try {
      const r = await axios.post(`${BACKEND_URL}/api/wallet/add`, { amount: amt }, { headers: { Authorization: `Bearer ${tkn}` } });
      setWalletBalance(r.data.balance);
      setWalletTxns((prev) => [{ type: "credit", amount: amt, description: "Wallet top-up", created_at: new Date().toISOString() }, ...prev]);
      setTopupAmt("");
      showToast(`✅ ₹${amt} added to wallet!`);
    } catch (err) { showToast(`❌ ${err.response?.data?.message || "Top-up failed"}`); }
  };

  const applyPromo = async () => {
    if (!promoCode.trim()) { showToast("⚠️ Enter a promo code"); return; }
    try {
      const r = await axios.post(`${BACKEND_URL}/api/wallet/apply-promo`, { code: promoCode, rideAmount: fare }, { headers: { Authorization: `Bearer ${tkn}` } });
      setPromoDiscount(r.data.discount);
      setPromoMsg(r.data.message);
      showToast(r.data.message);
    } catch (err) { setPromoMsg(""); setPromoDiscount(0); showToast(`❌ ${err.response?.data?.message || "Invalid promo code"}`); }
  };

  /* ─── Bid helpers ───────────────────────────────────────────── */
  const submitBid = () => {
    const bp = parseFloat(bidPrice);
    if (!bp || bp < 10) { showToast("⚠️ Enter a valid bid (min ₹10)"); return; }
    if (!currentRideId.current) { showToast("⚠️ Search for a ride first"); return; }
    socket.emit("ride:bid", { rideId: currentRideId.current, bidPrice: bp });
    setBidStatus("pending");
    showToast(`💰 Bid of ₹${bp} submitted to captains!`);
  };

  const acceptCounterBid = () => {
    if (!bidCounter || !currentRideId.current) return;
    // Re-emit ride request with the counter price
    if (lastRideParamsRef.current) {
      const updatedParams = { ...lastRideParamsRef.current, fare: bidCounter };
      lastRideParamsRef.current = updatedParams;
      setDisplayFare(bidCounter);
      socket.emit("new ride request", updatedParams);
    }
    setBidStatus("accepted");
    showToast(`✅ Counter bid of ₹${bidCounter} accepted!`);
  };

  /* ─── Support helpers ────────────────────────────────── */
  const openSupportModal = (ride = null, cat = "driver_behavior") => {
    setSupportRide(ride);
    setSupportCategory(cat);
    setSupportDesc("");
    setSupportMsg("");
    setSupportModal(true);
    setShowAccount(false);
  };

  const submitSupportTicket = async () => {
    if (!supportDesc.trim()) { showToast("⚠️ Please describe your issue"); return; }
    try {
      const cat = SUPPORT_CATEGORIES.find((c) => c.id === supportCategory);
      await axios.post(
        `${BACKEND_URL}/api/support/ticket`,
        { rideId: supportRide?.id || null, category: supportCategory, subject: cat?.label || supportCategory, description: supportDesc },
        { headers: { Authorization: `Bearer ${tkn}` } }
      );
      setSupportMsg("✅ Complaint submitted! Our team will contact you within 24 hours.");
      setSupportDesc("");
      showToast("✅ Report submitted to uride support");
      // refresh ticket list
      axios.get(`${BACKEND_URL}/api/support/tickets`, { headers: { Authorization: `Bearer ${tkn}` } })
        .then((r) => setSupportTickets(r.data.tickets || [])).catch(() => { });
    } catch (err) {
      setSupportMsg(`❌ ${err.response?.data?.error || "Submission failed"}`);
    }
  };

  /* ─── P0 Helpers ─────────────────────────────────────────── */

  // GPS auto-detect pickup using browser geolocation + Nominatim reverse-geocode
  const detectGPS = () => {
    if (!navigator.geolocation) { showToast("⚠️ Geolocation not supported"); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await r.json();
          const address = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          const short = address.split(",").slice(0, 3).join(",").trim();
          setPickup({ lat, lng, address: short });
          showToast("📍 Location detected!");
        } catch {
          setPickup({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
        }
        setGpsLoading(false);
      },
      (err) => { setGpsLoading(false); showToast(`⚠️ ${err.message || "Could not get location"}`); },
      { timeout: 10000, maximumAge: 60000, enableHighAccuracy: true }
    );
  };

  // Save a search to localStorage recent history
  const saveRecentSearch = (location) => {
    if (!location?.address) return;
    const next = [location, ...recentSearches.filter((s) => s.address !== location.address)].slice(0, 5);
    setRecentSearches(next);
    localStorage.setItem("ucab_recent_searches", JSON.stringify(next));
  };

  // Save current pickup as a named place
  const saveCurrentPlace = async (label) => {
    if (!pickup) { showToast("⚠️ Set a pickup location first"); return; }
    try {
      const r = await axios.post(
        `${BACKEND_URL}/api/auth/user/saved-places`,
        { label, lat: pickup.lat, lng: pickup.lng, address: pickup.address },
        { headers: { Authorization: `Bearer ${tkn}` } }
      );
      setSavedPlaces(r.data.savedPlaces);
      showToast(`✅ Saved as "${label}"`);
    } catch { showToast("❌ Could not save place"); }
  };

  const deleteSavedPlace = async (idx) => {
    try {
      const r = await axios.delete(`${BACKEND_URL}/api/auth/user/saved-places/${idx}`, { headers: { Authorization: `Bearer ${tkn}` } });
      setSavedPlaces(r.data.savedPlaces);
    } catch { showToast("❌ Could not remove place"); }
  };

  const saveEmergencyContacts = async (contacts) => {
    try {
      const r = await axios.put(`${BACKEND_URL}/api/auth/user/emergency-contacts`, { contacts }, { headers: { Authorization: `Bearer ${tkn}` } });
      setEmergencyContacts(r.data.contacts);
      showToast("✅ Emergency contacts saved");
    } catch { showToast("❌ Could not save contacts"); }
  };

  const shareTrip = () => {
    if (!currentRideId.current) { showToast("⚠️ No active ride to share"); return; }
    if (shareToken) {
      const link = `${window.location.origin}/track/${shareToken}`;
      navigator.clipboard?.writeText(link).catch(() => { });
      showToast("🔗 Tracking link copied again!");
      return;
    }
    socket.emit("ride:share", { rideId: currentRideId.current });
  };

  /* ─── Searching timer ──────────────────────────────────── */
  useEffect(() => {
    if (rideStatus === "searching") {
      setSearchElapsed(0);
      searchTimerRef.current = setInterval(() => {
        setSearchElapsed((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(searchTimerRef.current);
      if (rideStatus !== "searching") setSearchElapsed(0);
    }
    return () => clearInterval(searchTimerRef.current);
  }, [rideStatus]);

  const submitRating = (stars) => {
    if (captainIdRef.current) {
      socket.emit("rate captain", {
        captainId: captainIdRef.current,
        rideId: currentRideId.current,
        rating: stars,
        tags: ratingTags,
      });
    }
    setRatingSubmitted(true);
    setRatingTags([]);
    showToast(`⭐ Thanks for rating ${stars} star${stars !== 1 ? "s" : ""} !`);
    setTimeout(resetAfterRide, 1500);
  };

  const skipRating = () => {
    showToast("Ride completed!");
    resetAfterRide();
  };

  /* ─── Book ride ───────────────────────────────────────────── */
  // Store last ride params so tip re-emit can re-use them
  const lastRideParamsRef = useRef(null);

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

    const effectiveFare = Math.max(10, fare - promoDiscount);
    const params = {
      pickup: { ...pickup }, dropoff: { ...dropoff },
      fare: effectiveFare, distKm: routeInfo?.distKm || 5,
      duration: routeInfo?.durationMin || 15,
      rideType: rideType.id, paymentMethod: useWallet ? "wallet" : payMethod, scheduledAt,
      userId: user._id || null,
    };
    // Store BOTH the params and the original base fare separately
    lastRideParamsRef.current = { ...params, _baseFare: effectiveFare };
    setTipAmount(0);
    setDisplayFare(effectiveFare);
    setBidStatus(null);

    socket.emit("new ride request", params);
    if (scheduledAt) {
      setSchedConfirmed(true);
      showToast(`📅 Scheduled for ${fmtTime(new Date(scheduledAt))}`);
    } else {
      setRideStatus("searching");
      setSheetH(PEEK);
      showToast("🔍 Finding your captain...");
    }
  };

  /* ─── Apply tip (re-emit ride request with updated fare) ──── */
  const applyTip = (newTip) => {
    if (!lastRideParamsRef.current) return;
    // Always compute from the original base fare to prevent accumulation
    const baseFare = lastRideParamsRef.current._baseFare ?? lastRideParamsRef.current.fare;
    const updatedParams = { ...lastRideParamsRef.current, fare: baseFare + newTip, _baseFare: baseFare };
    lastRideParamsRef.current = updatedParams;
    setTipAmount(newTip);
    setDisplayFare(baseFare + newTip);
    socket.emit("new ride request", updatedParams);
    showToast(newTip > 0 ? `💰 Tip added! Captains now see ₹${baseFare + newTip}` : "Tip removed. Searching…");
  };

  /* ─── Cancel ride ─────────────────────────────────────────── */
  const cancelRide = () => {
    setCancelReason("");
    setShowCancelModal(true);
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    const minsElapsed = acceptedAt.current ? (Date.now() - acceptedAt.current) / 60000 : 0;
    const fee = rideStatus === "accepted" && minsElapsed > CANCEL_FREE_MINS ? CANCEL_FEE : 0;
    setRideStatus("idle");
    setCurrentRide(null);
    setCaptainPos(null);
    acceptedAt.current = null;
    currentRideId.current = null;
    clearInterval(searchTimerRef.current);
    setSearchElapsed(0);
    setTipAmount(0);
    setDisplayFare(0);
    setUserMsgInput("");
    lastRideParamsRef.current = null;
    setSheetH(pickup && dropoff ? MID : PEEK);
    setCancelReason("");
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

    socket.emit("new ride request", {
      pickup: { ...cFrom },
      dropoff: { ...cTo },
      fare: courierFare,
      distKm: cRouteInfo?.distKm || 3,
      rideType: cVehicle,
      parcelWeight: cWeight,
      receiverName: cName,
      receiverPhone: cPhone,
      userId: user._id || null,
    });

    setCourierStatus("sent");
    setRideStatus("searching"); // Use the same searching UI
    setSheetH(PEEK);
    showToast("📦 Courier request sent! Finding a delivery partner…");
  };

  /* ─── Rental helpers ──────────────────────────────────────── */
  const rentalVehicle = RENTAL_VEHICLES.find((v) => v.id === rVehicle);
  const driverExtra = rWithDriver ? 100 : 0;
  const rentalFare = rentalVehicle.perHr * rHours + driverExtra;
  const [meetingLocation, setMeetingLocation] = useState(null);

  const confirmRental = async () => {
    if (!rLocation) { showToast("⚠️ Set your pickup location"); return; }
    try {
      const res = await axios.post(`${BACKEND_URL}/api/fleet/bookings/v2`, {
        bookingType: "VEHICLE_ONLY",
        clientName: user.name || "Rider",
        clientPhone: user.phone || "0000000000",
        clientEmail: user.email || "rider@ucab.com",
        clientType: "individual",
        vehicleType: rentalVehicle.name,
        pickupLocation: rLocation.address,
        dropLocation: rLocation.address, // Same for rental pickup
        date: new Date().toISOString(),
        durationDays: Math.ceil(rHours / 24) || 1, // API expects days for VEHICLE_ONLY
      });

      setRentalStatus("confirmed");
      showToast(`🚗 ${rentalVehicle.name} rental confirmed! Provider will contact you.`);

      // Notify parent/rental provider via socket if possible
      socket.emit("notify:rental_booked", {
        bookingId: res.data.booking._id,
        userId: user._id,
        location: rLocation,
      });

    } catch (err) {
      const serverMsg = err.response?.data?.message || "";
      if (serverMsg.toLowerCase().includes("no available") || serverMsg.toLowerCase().includes("no vehicle")) {
        showToast("🚗 No vehicle found — no rental vehicles of this type are registered with us yet. Please try a different type or check back later.");
      } else {
        showToast(`❌ ${serverMsg || "Failed to book rental. Please try again."}`);
      }
    }
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
          nearbyCaptains={rideStatus === "idle" ? nearbyCaptains : []}
          onRouteFound={serviceTab === "courier" ? setCRouteInfo : setRouteInfo}
          height="100%" />
      </div>

      {/* Top bar */}
      <div className="top-bar">
        <div className="top-bar-logo">uride <span className="logo-accent">services</span></div>
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
              <div style={{ flex: 1 }}>
                <div className="drawer-name">{user.name || "Rider"}</div>
                <div className="drawer-phone">{user.phone || ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#1db954" }}>₹{walletBalance.toFixed(0)}</div>
                <div style={{ fontSize: 10, color: "#666" }}>Wallet</div>
                {loyaltyPoints > 0 && (
                  <div style={{ fontSize: 11, color: "#f39c12", marginTop: 2 }}>🎁 {loyaltyPoints} pts</div>
                )}
              </div>
            </div>

            {/* Drawer tab bar */}
            <div className="drawer-tabs">
              {[
                { id: "home", label: "🏠 Home" },
                { id: "wallet", label: "💳 Wallet" },
                { id: "history", label: "🕐 History" },
                { id: "places", label: "📍 Places" },
              ].map((t) => (
                <button key={t.id}
                  className={`drawer-tab-btn ${accountTab === t.id ? "active" : ""}`}
                  onClick={() => setAccountTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Home tab ── */}
            {accountTab === "home" && (<>
              <div className="drawer-section-title">Payment Method</div>
              <div className="pay-method-row">
                {PAY_METHODS.map((p) => (
                  <div key={p.id}
                    className={`pay-method-card ${payMethod === p.id && !useWallet ? "selected" : ""}`}
                    onClick={() => { setPayMethod(p.id); setUseWallet(false); }}>
                    <span>{p.icon}</span> {p.label}
                  </div>
                ))}
                <div className={`pay-method-card ${useWallet ? "selected" : ""}`}
                  onClick={() => setUseWallet((v) => !v)}>
                  <span>👛</span> Wallet {walletBalance > 0 && <span style={{ fontSize: 10, color: "#1db954" }}>₹{walletBalance.toFixed(0)}</span>}
                </div>
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

              {/* ── Quick links ── */}
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
                <button onClick={() => openSupportModal(null, "app_issue")}
                  style={{ background: "#1a0000", border: "1px solid #e53935", borderRadius: 10, padding: "10px 14px", color: "#e53935", cursor: "pointer", textAlign: "left", fontSize: 14, fontWeight: 700 }}>
                  🆘 Help &amp; Support
                </button>
              </div>
            </>)}

            {/* ── Wallet tab ── */}
            {accountTab === "wallet" && (<>
              <div className="wallet-balance-card">
                <div style={{ fontSize: 12, color: "#888" }}>Available Balance</div>
                <div className="wallet-big-amt">₹{walletBalance.toFixed(2)}</div>
              </div>
              <div className="drawer-section-title">Add Money</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                {[100, 200, 500].map((a) => (
                  <button key={a} onClick={() => setTopupAmt(String(a))}
                    className={`tip-btn${topupAmt === String(a) ? " active" : ""}`}>₹{a}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input type="number" placeholder="Custom amount" value={topupAmt}
                  onChange={(e) => setTopupAmt(e.target.value)}
                  style={{ flex: 1, padding: "10px 12px", background: "#1a1a1a", border: "1.5px solid #333", borderRadius: 10, color: "#fff", fontSize: 14, outline: "none" }} />
                <button className="book-btn-inline" style={{ fontSize: 13 }} onClick={topupWallet}>Add</button>
              </div>
              <div className="drawer-section-title">Recent Transactions</div>
              {walletTxns.length === 0 ? <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: "12px 0" }}>No transactions yet</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {walletTxns.map((tx, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#161616", borderRadius: 10, border: "1px solid #222" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "#eee", fontWeight: 600 }}>{tx.description}</div>
                        <div style={{ fontSize: 11, color: "#666" }}>{new Date(tx.created_at).toLocaleDateString("en-IN")}</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: tx.type === "credit" || tx.type === "promo" ? "#1db954" : "#e53935" }}>
                        {tx.type === "credit" || tx.type === "promo" ? "+" : "-"}₹{parseFloat(tx.amount).toFixed(0)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>)}

            {/* ── History tab ── */}
            {accountTab === "history" && (<>
              <div className="drawer-section-title">My Rides ({rideHistory.length})</div>
              {!historyLoaded ? <div style={{ color: "#555", textAlign: "center", padding: "12px 0" }}>Loading…</div>
                : rideHistory.length === 0 ? (
                  <div className="empty-state" style={{ paddingTop: 20 }}>
                    <div className="empty-icon">🚗</div>
                    <p>No rides yet</p>
                    <span>Book your first ride!</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {rideHistory.map((t, i) => (
                      <div key={t.id || i} className="trip-history-card">
                        <div className="thc-top">
                          <div className="thc-fare">₹{parseFloat(t.fare).toFixed(0)}</div>
                          <div className="thc-meta">
                            <span className="thc-type">{t.rideType?.toUpperCase()}</span>
                            <span className={`thc-pay ${t.status === "cancelled" ? "red" : ""}`}>
                              {t.status === "cancelled" ? "Cancelled" : t.payment === "cash" ? "💵 Cash" : "📲 UPI"}
                            </span>
                          </div>
                          <div className="thc-time">{new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                        </div>
                        <div className="thc-route">
                          <div className="thc-row"><span className="trs-dot green" style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
                            <span className="thc-addr">{t.pickup?.address || "Pickup"}</span></div>
                          <div className="thc-row"><span className="trs-dot red" style={{ width: 8, height: 8, borderRadius: "50%", display: "inline-block", flexShrink: 0 }} />
                            <span className="thc-addr">{t.dropoff?.address || "Dropoff"}</span></div>
                        </div>
                        {t.captain && <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>👤 {t.captain.name} · ⭐ {parseFloat(t.captain.rating).toFixed(1)}</div>}
                        <button
                          onClick={() => openSupportModal(t, "driver_behavior")}
                          style={{ marginTop: 8, width: "100%", padding: "8px 0", background: "transparent", border: "1px solid #333", borderRadius: 8, color: "#888", cursor: "pointer", fontSize: 12 }}>
                          ⚠️ Had an issue? Report it
                        </button>
                      </div>
                    ))}
                  </div>
                )}
            </>)}

            {/* ── Places tab ── */}
            {accountTab === "places" && (<>
              {/* Saved Places */}
              <div className="drawer-section-title">⭐ Saved Places</div>
              {savedPlaces.length === 0
                ? <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: "10px 0" }}>No saved places yet</div>
                : savedPlaces.map((sp, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#161616", borderRadius: 10, border: "1px solid #222", marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>{sp.label.toLowerCase() === "home" ? "🏠" : sp.label.toLowerCase() === "work" ? "💼" : "📌"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#eee", fontSize: 14 }}>{sp.label}</div>
                      <div style={{ color: "#666", fontSize: 11 }}>{sp.address.slice(0, 40)}{sp.address.length > 40 ? "…" : ""}</div>
                    </div>
                    <button onClick={() => deleteSavedPlace(i)}
                      style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 16 }}>🗑️</button>
                  </div>
                ))
              }
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {["Home", "Work", "Gym", "Other"].map((lbl) => (
                  <button key={lbl} onClick={() => saveCurrentPlace(lbl)}
                    style={{ padding: "8px 14px", background: "#1a1a1a", border: "1px solid #333", borderRadius: 20, color: "#ccc", fontSize: 12, cursor: "pointer" }}>
                    + Save as {lbl}
                  </button>
                ))}
              </div>

              {/* Emergency Contacts */}
              <div className="drawer-section-title" style={{ marginTop: 20 }}>🆘 Emergency Contacts (SOS)</div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>People who can be contacted if you trigger SOS during a ride.</div>
              {emergencyContacts.length === 0
                ? <div style={{ color: "#555", fontSize: 13, textAlign: "center", padding: "10px 0" }}>No emergency contacts added</div>
                : emergencyContacts.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#161616", borderRadius: 10, border: "1px solid #222", marginBottom: 8 }}>
                    <span style={{ fontSize: 20 }}>👤</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#eee", fontSize: 14 }}>{c.name}</div>
                      <div style={{ color: "#666", fontSize: 12 }}>{c.phone}</div>
                    </div>
                    <a href={`tel:${c.phone}`}
                      style={{ background: "#0e2b1a", border: "1px solid #1db954", borderRadius: 8, padding: "6px 10px", color: "#1db954", fontSize: 12, textDecoration: "none" }}>
                      📞 Call
                    </a>
                  </div>
                ))
              }
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <input placeholder="Name" value={newContactName} onChange={(e) => setNewContactName(e.target.value)}
                  style={{ padding: "10px 12px", background: "#1a1a1a", border: "1.5px solid #333", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none" }} />
                <input placeholder="Phone number" value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} type="tel"
                  style={{ padding: "10px 12px", background: "#1a1a1a", border: "1.5px solid #333", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none" }} />
                <button onClick={() => {
                  if (!newContactName.trim() || !newContactPhone.trim()) { showToast("⚠️ Enter name and phone"); return; }
                  const updated = [...emergencyContacts, { name: newContactName.trim(), phone: newContactPhone.trim() }];
                  saveEmergencyContacts(updated);
                  setNewContactName(""); setNewContactPhone("");
                }}
                  style={{ padding: "11px", background: "#1db954", border: "none", borderRadius: 10, color: "#000", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>
                  + Add Contact
                </button>
                {emergencyContacts.length > 0 && (
                  <button onClick={() => {
                    const updated = emergencyContacts.slice(0, -1);
                    saveEmergencyContacts(updated);
                  }}
                    style={{ padding: "9px", background: "transparent", border: "1px solid #333", borderRadius: 10, color: "#888", cursor: "pointer", fontSize: 13 }}>
                    Remove Last Contact
                  </button>
                )}
              </div>
            </>)}

          </div>
        </div>
      )}
      {rideStatus === "searching" && (
        <div className="trip-sheet searching-sheet">
          <div className="trip-sheet-inner">
            <div className="searching-spinner-wrap">
              <div className="searching-pulse" />
              <div className="searching-pulse" />
              <div className="searching-pulse" />
              <div className="searching-spinner" />
            </div>
            <h2>Finding your captain…</h2>
            <p>
              Matching you with the nearest {rideType.name}
              {searchElapsed > 0 && (
                <> &middot; <span style={{ color: searchElapsed >= 15 ? "#f6ad55" : "#888" }}>
                  {searchElapsed}s
                </span></>
              )}
            </p>
            <div className="trip-route-summary">
              <div className="trs-row"><span className="trs-dot green" /><span>{pickup?.address || "Pickup"}</span></div>
              <div className="trs-line" />
              <div className="trs-row"><span className="trs-dot red" /><span>{dropoff?.address || "Dropoff"}</span></div>
            </div>
            <div className="trip-meta-row">
              <span>
                💰 ₹{displayFare > 0 ? displayFare : fare}
                {tipAmount > 0 && (
                  <span style={{ fontSize: 11, color: "#f6ad55", marginLeft: 5, fontWeight: 700 }}>
                    (₹{(displayFare || fare) - tipAmount} + ₹{tipAmount} tip)
                  </span>
                )}
              </span>
              <span>📍 {routeInfo?.distKm || "~"} km</span>
              <span>⏱ {routeInfo?.durationMin || "~"} min</span>
            </div>

            {/* Tip / surge section — appears after 15 s */}
            {searchElapsed >= 15 && (
              <div className="tip-surge-box">
                <div className="tip-surge-label">
                  ⚡ No captain yet — add a tip to boost priority
                </div>
                <div className="tip-surge-btns">
                  {[0, 10, 20, 30].map((t) => (
                    <button
                      key={t}
                      className={`tip-btn${tipAmount === t ? " active" : ""}`}
                      onClick={() => applyTip(t)}
                    >
                      {t === 0 ? "No tip" : `+₹${t}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button className="cancel-btn" onClick={cancelRide}>Cancel</button>
          </div>
        </div>
      )}

      {rideStatus === "accepted" && currentRide && (
        <div className="trip-sheet accepted-sheet">
          <div className="trip-sheet-inner">
            {/* Ride Started overlay */}
            {rideStarted && (
              <div style={{
                position: "fixed", inset: 0, zIndex: 9999,
                background: "rgba(0,0,0,0.93)",
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: "rideStartFade 0.4s ease",
              }}>
                <div style={{ textAlign: "center", animation: "rideStartBounce 0.5s cubic-bezier(0.34,1.56,0.64,1)" }}>
                  <div style={{ fontSize: 72 }}>🚗</div>
                  <h2 style={{ color: "#1db954", fontSize: 34, fontWeight: 800, margin: "16px 0 8px" }}>Ride Started!</h2>
                  <p style={{ color: "#888", fontSize: 15 }}>Your journey has begun. Enjoy the ride!</p>
                </div>
              </div>
            )}
            {/* ── Captain Arrived banner ── */}
            {captainArrivedBanner && (
              <div style={{ background: "#0d2818", border: "1.5px solid #1db954", borderRadius: 12, padding: "12px 14px", marginBottom: 10, display: "flex", alignItems: "center", gap: 10, animation: "rideStartFade 0.4s ease" }}>
                <span style={{ fontSize: 28 }}>📍</span>
                <div>
                  <div style={{ color: "#1db954", fontWeight: 800, fontSize: 15 }}>Captain has arrived!</div>
                  <div style={{ color: "#888", fontSize: 12 }}>Head to your pickup point with your OTP ready.</div>
                </div>
                <button onClick={() => setCaptainArrivedBanner(false)}
                  style={{ marginLeft: "auto", background: "none", border: "none", color: "#555", fontSize: 18, cursor: "pointer" }}>✕</button>
              </div>
            )}
            <div className="otp-banner">
              <span className="otp-label">Share OTP with captain</span>
              <span className="otp-code">{tripOtp}</span>
            </div>
            {/* ETA banner */}
            {captainEta && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 14px", background: "#0d2818", borderRadius: 10, marginBottom: 8, border: "1px solid #1db954" }}>
                <span style={{ fontSize: 18 }}>🚗</span>
                <span style={{ color: "#1db954", fontWeight: 700, fontSize: 14 }}>Captain arriving in ~{captainEta} min</span>
              </div>
            )}
            <div className="captain-card-uber">
              <div className="captain-avatar-big" style={{ position: "relative", overflow: "hidden", background: captainInfo?.photoUrl ? "transparent" : undefined }}>
                {captainInfo?.photoUrl
                  ? <img src={captainInfo.photoUrl} alt="captain" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
                  : captainInfo?.name?.[0]?.toUpperCase() || "C"
                }
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
                <button className="icon-btn sos-btn"
                  onClick={() => {
                    socket.emit("sos alert", {
                      rideId: currentRideId.current,
                      riderId: user._id,
                      captainId: captainIdRef.current,
                      location: pickup
                    });
                    showToast("🚨 SOS ALERT SENT! Help is on the way.");
                  }}>
                  🚨 SOS
                </button>
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
              <div className="vehicle-type-pill" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span title="Ride Insured (10L Death/Injury Cover)" style={{ color: "#1db954" }}>🛡️ Insured</span>
                <span>{(captainInfo?.vehicle?.type || rideType.id).toUpperCase()}</span>
              </div>
            </div>

            {/* ── Captain messages ── */}
            {captainMessages.length > 0 && (
              <div style={{ margin: "10px 0 2px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>
                  💬 Messages from Captain
                </div>
                {captainMessages.map((m, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#1a1f27", padding: "10px 12px", borderRadius: 12 }}>
                    <div style={{ width: 30, height: 30, background: "#2b6cb0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, color: "#fff", flexShrink: 0 }}>
                      {m.captainName?.[0]?.toUpperCase() || "C"}
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
            <div className="trip-route-summary">
              <div className="trs-row"><span className="trs-dot green" /><span>{pickup?.address || "Pickup"}</span></div>
              <div className="trs-line" />
              <div className="trs-row"><span className="trs-dot red" /><span>{dropoff?.address || "Dropoff"}</span></div>
            </div>
            <div className="trip-fare-row">
              <div>
                <div className="tfare-label">Estimated Fare</div>
                <div className="tfare-amount">₹{(displayFare > 0 ? displayFare : fare) + 1}</div>
                <div style={{ fontSize: 11, color: "#1db954", marginTop: 2 }}>
                  Includes ₹1 Insurance Fee
                  {tipAmount > 0 && <span style={{ marginLeft: 6, color: "#f6ad55" }}>+ ₹{tipAmount} tip</span>}
                </div>
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
            {/* ── Message Captain ── */}
            <div style={{ marginTop: 12, borderTop: "1px solid #1e1e1e", paddingTop: 12 }}>
              <div style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                💬 Message Captain
              </div>
              {/* Quick messages */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {["I'm waiting outside 🏠", "Take the left turn ⇰", "2 min away ⏱️", "Running late, please wait 🙏"].map((qm) => (
                  <button key={qm}
                    style={{ padding: "6px 11px", background: "#1a1f27", border: "1px solid #2a3040", borderRadius: 20, color: "#ccc", fontSize: 12, cursor: "pointer" }}
                    onClick={() => {
                      if (!currentRideId.current) return;
                      socket.emit("user:message", { rideId: currentRideId.current, message: qm });
                      showToast(`📤 Sent: "${qm}"`);
                    }}>
                    {qm}
                  </button>
                ))}
              </div>
              {/* Custom input */}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text" placeholder="Type a message…" value={userMsgInput} maxLength={200}
                  onChange={(e) => setUserMsgInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && userMsgInput.trim() && currentRideId.current) {
                      socket.emit("user:message", { rideId: currentRideId.current, message: userMsgInput.trim() });
                      showToast("📤 Message sent");
                      setUserMsgInput("");
                    }
                  }}
                  style={{ flex: 1, padding: "10px 12px", background: "#1a1a1a", border: "1.5px solid #333", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none" }}
                />
                <button
                  style={{ padding: "10px 14px", background: "#2b6cb0", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer" }}
                  onClick={() => {
                    if (!userMsgInput.trim() || !currentRideId.current) return;
                    socket.emit("user:message", { rideId: currentRideId.current, message: userMsgInput.trim() });
                    showToast("📤 Message sent");
                    setUserMsgInput("");
                  }}>
                  Send
                </button>
              </div>
            </div>
            {/* ── Share trip + actions row ── */}
            <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 4 }}>
              <button onClick={shareTrip}
                style={{ flex: 1, padding: "11px", background: "#0e2b1a", border: "1px solid #1db954", borderRadius: 12, color: "#1db954", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                🔗 Share Trip
              </button>
              <button onClick={() => openSupportModal({ id: currentRideId.current }, "safety")}
                style={{ flex: 1, padding: "11px", background: "#1a0000", border: "1px solid #e53935", borderRadius: 12, color: "#e53935", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
                🆘 Report Issue
              </button>
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

            {/* ── Feedback tags ── */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 16 }}>
              {RATING_TAGS.map((tag) => (
                <button key={tag}
                  onClick={() => setRatingTags((prev) =>
                    prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                  )}
                  style={{
                    padding: "7px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                    background: ratingTags.includes(tag) ? "#0e2b1a" : "#1a1a1a",
                    border: `1.5px solid ${ratingTags.includes(tag) ? "#1db954" : "#333"}`,
                    color: ratingTags.includes(tag) ? "#1db954" : "#888",
                    transition: "all 0.15s",
                  }}>
                  {ratingTags.includes(tag) ? "✓ " : ""}{tag}
                </button>
              ))}
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
            <button
              onClick={() => openSupportModal({ id: currentRideId.current }, "driver_behavior")}
              style={{ marginTop: 10, background: "transparent", border: "none", color: "#e53935", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
              ⚠️ Had an issue with this trip? Report it
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
              { id: "carpool", icon: "🤝", label: "Carpool" },
            ].map((t) => (
              <button key={t.id}
                className={`svc-tab ${serviceTab === t.id ? "active" : ""}`}
                onClick={() => {
                  if (t.id === "carpool") { navigate("/carpool"); return; }
                  setServiceTab(t.id);
                }}>
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

                {/* ── Saved places quick-select ── */}
                {savedPlaces.length > 0 && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                    {savedPlaces.map((sp, i) => (
                      <button key={i}
                        onClick={() => { setPickup({ lat: sp.lat, lng: sp.lng, address: sp.address }); setShowRecentSearches(false); }}
                        className="saved-place-chip">
                        {sp.label.toLowerCase() === "home" ? "🏠" : sp.label.toLowerCase() === "work" ? "💼" : "📌"} {sp.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="location-card" style={{ position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ flex: 1 }}>
                      <LocationSearch placeholder="📍 Pickup location" dotColor="green"
                        onSelect={(loc) => { setPickup(loc); saveRecentSearch(loc); setShowRecentSearches(false); }}
                        onFocus={() => setShowRecentSearches(true)}
                        value={pickup?.address || ""} />
                    </div>
                    <button onClick={detectGPS} disabled={gpsLoading}
                      title="Use my current location"
                      style={{ padding: "9px 11px", background: gpsLoading ? "#222" : "#1a2b1a", border: "1.5px solid #1db954", borderRadius: 10, color: "#1db954", cursor: gpsLoading ? "wait" : "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>
                      {gpsLoading ? "⏳" : "🎯"}
                    </button>
                  </div>

                  {/* Recent searches dropdown */}
                  {showRecentSearches && recentSearches.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100, background: "#111", border: "1px solid #333", borderRadius: 12, marginTop: 4, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,0.6)" }}>
                      <div style={{ fontSize: 11, color: "#666", padding: "8px 12px 4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Recent</div>
                      {recentSearches.map((s, i) => (
                        <div key={i}
                          onClick={() => { setPickup(s); setShowRecentSearches(false); }}
                          style={{ padding: "10px 14px", cursor: "pointer", borderTop: "1px solid #1e1e1e", display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#ccc" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "#1a1a1a"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                          <span style={{ color: "#555" }}>🕐</span> {s.address}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="location-divider" />
                  <LocationSearch placeholder="🏁 Destination" dotColor="red"
                    onSelect={(loc) => { setDropoff(loc); saveRecentSearch(loc); }}
                    value={dropoff?.address || ""} />
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

                    <div className="section-title">
                      Choose a ride
                      {surgeMultiplier > 1 && (
                        <span className="surge-badge">⚡ {surgeMultiplier}x Surge</span>
                      )}
                    </div>
                    <div className="ride-types">
                      {RIDE_TYPES.map((type) => {
                        const surgeFare = Math.round(calcFare(type, routeInfo?.distKm) * surgeMultiplier);
                        return (
                          <div key={type.id}
                            className={`ride-type-card ${selectedType === type.id ? "selected" : ""}`}
                            onClick={() => setSelectedType(type.id)}>
                            <div className="ride-type-icon">{type.icon}</div>
                            <div className="ride-type-name">{type.name}</div>
                            <div className="ride-type-time">{type.time}</div>
                            <div className="ride-type-fare" style={{ color: surgeMultiplier > 1 ? "#f6ad55" : undefined }}>
                              ₹{surgeFare}
                              {surgeMultiplier > 1 && <div style={{ fontSize: 9, color: "#888", textDecoration: "line-through" }}>₹{calcFare(type, routeInfo?.distKm)}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="fare-summary-row">
                      <div>
                        <div style={{ fontSize: 13, color: "#888" }}>Estimated fare</div>
                        <div className="fare-amount">
                          ₹{Math.max(10, fare - promoDiscount) + 1}
                          {promoDiscount > 0 && <span style={{ fontSize: 12, color: "#1db954", marginLeft: 6, textDecoration: "line-through", opacity: 0.6 }}>₹{fare + 1}</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
                          {routeInfo?.distKm} km · {routeInfo?.durationMin} min ·{" "}
                          {useWallet ? "👛 Wallet" : `${PAY_METHODS.find((p) => p.id === payMethod)?.icon} ${PAY_METHODS.find((p) => p.id === payMethod)?.label}`}
                        </div>
                        <div style={{ fontSize: 11, color: "#1db954", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                          🛡️ Includes ₹1 insurance fee
                        </div>
                        {promoMsg && <div style={{ fontSize: 11, color: "#f6ad55", marginTop: 2 }}>{promoMsg}</div>}
                      </div>
                      <button className="book-btn-inline" onClick={requestRide}>
                        {bookingMode === "now" ? `Book ${rideType.icon}` : "📅 Schedule"}
                      </button>
                    </div>

                    {/* ── Promo code ── */}
                    <div className="promo-row">
                      <input type="text" placeholder="🎁 Promo code" value={promoCode}
                        onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoDiscount(0); setPromoMsg(""); }}
                        style={{ flex: 1, padding: "9px 12px", background: "#1a1a1a", border: "1.5px solid #333", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none" }} />
                      <button onClick={applyPromo}
                        style={{ padding: "9px 14px", background: "#333", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                        Apply
                      </button>
                    </div>

                    {/* ── Bid pricing (Rapido-style) ── */}
                    <div className="bid-toggle-row" onClick={() => setBidMode((v) => !v)}>
                      <span>💰 Name your price (Bid)</span>
                      <span style={{ color: bidMode ? "#f6ad55" : "#888", fontSize: 13 }}>{bidMode ? "▲ Hide" : "▼ Show"}</span>
                    </div>
                    {bidMode && (
                      <div className="bid-box">
                        {bidStatus === "pending" && <div style={{ color: "#f6ad55", fontSize: 13, marginBottom: 8, textAlign: "center" }}>⏳ Waiting for captain to respond…</div>}
                        {bidStatus === "accepted" && <div style={{ color: "#1db954", fontSize: 13, marginBottom: 8, textAlign: "center" }}>✅ Bid accepted! Captain will arrive shortly.</div>}
                        {bidStatus === "rejected" && <div style={{ color: "#e53935", fontSize: 13, marginBottom: 8, textAlign: "center" }}>❌ Captain declined your bid. Try standard price.</div>}
                        {bidStatus === "countered" && bidCounter && (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ color: "#f6ad55", fontSize: 13, textAlign: "center", marginBottom: 6 }}>
                              Captain countered with <strong>₹{bidCounter}</strong>
                            </div>
                            <button onClick={acceptCounterBid} className="book-btn-inline" style={{ width: "100%", fontSize: 14 }}>
                              ✅ Accept ₹{bidCounter}
                            </button>
                          </div>
                        )}
                        {(!bidStatus || bidStatus === "rejected") && (
                          <div style={{ display: "flex", gap: 8 }}>
                            <input type="number" placeholder={`Min ₹10 · Suggest fare (est. ₹${fare})`}
                              value={bidPrice} onChange={(e) => setBidPrice(e.target.value)}
                              style={{ flex: 1, padding: "10px 12px", background: "#1a1a1a", border: "1.5px solid #f6ad55", borderRadius: 10, color: "#fff", fontSize: 13, outline: "none" }} />
                            <button onClick={submitBid}
                              style={{ padding: "10px 14px", background: "#f6ad55", border: "none", borderRadius: 10, color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                              Bid
                            </button>
                          </div>
                        )}
                      </div>
                    )}
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

                    <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                      <button className="btn-primary" style={{ flex: 1, background: "#1db954" }}
                        onClick={() => showToast("💬 Starting chat with provider...")}>
                        💬 Communicate
                      </button>
                      <button className="btn-primary" style={{ flex: 1, background: "#2b6cb0" }}
                        onClick={() => showToast("📍 Meeting point shared via app!")}>
                        📍 Meeting Point
                      </button>
                    </div>

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

      {/* ── Support / Complaint Modal ── */}
      {supportModal && (
        <div className="support-modal-overlay" onClick={() => { setSupportModal(false); setSupportMsg(""); }}>
          <div className="support-modal" onClick={(e) => e.stopPropagation()}>
            <div className="support-modal-header">
              <div className="support-modal-title">🆘 Report an Issue</div>
              <button onClick={() => { setSupportModal(false); setSupportMsg(""); }}
                style={{ background: "none", border: "none", color: "#888", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            {supportRide?.pickup?.address && (
              <div style={{ background: "#1a1a1a", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "#888" }}>
                📋 Ride: {supportRide.pickup.address.slice(0, 32)}{supportRide.pickup.address.length > 32 ? "…" : ""}
              </div>
            )}

            <div className="support-label">Category</div>
            <select value={supportCategory} onChange={(e) => setSupportCategory(e.target.value)} className="support-select">
              {SUPPORT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>

            <div className="support-label" style={{ marginTop: 14 }}>Describe your issue</div>
            <textarea
              value={supportDesc}
              onChange={(e) => setSupportDesc(e.target.value)}
              placeholder="Please describe what happened in detail…"
              rows={4}
              className="support-textarea"
              maxLength={1000}
            />
            <div style={{ fontSize: 11, color: "#555", textAlign: "right", marginTop: 2 }}>{supportDesc.length}/1000</div>

            {supportMsg && (
              <div style={{
                fontSize: 13, padding: "10px 12px", borderRadius: 10, marginTop: 10,
                background: supportMsg.startsWith("✅") ? "#0d2818" : "#1a0000",
                color: supportMsg.startsWith("✅") ? "#1db954" : "#e53935",
                border: `1px solid ${supportMsg.startsWith("✅") ? "#1db954" : "#e53935"}`,
              }}>{supportMsg}</div>
            )}

            {!supportMsg.startsWith("✅") && (
              <button onClick={submitSupportTicket} className="support-submit-btn">
                📤 Submit Report
              </button>
            )}

            {supportTickets.length > 0 && (
              <>
                <div className="support-label" style={{ marginTop: 20 }}>Your Previous Reports</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {supportTickets.slice(0, 5).map((tk, i) => (
                    <div key={tk.id || i} style={{ background: "#161616", borderRadius: 10, padding: "10px 12px", border: "1px solid #2a2a2a" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#eee", flex: 1, marginRight: 8 }}>{tk.subject}</div>
                        <span className={`support-status-pill ${tk.status}`}>{tk.status.replace("_", " ")}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "#666" }}>
                        {new Date(tk.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                      {tk.admin_note && (
                        <div style={{ fontSize: 12, color: "#f6ad55", marginTop: 6, borderTop: "1px solid #2a2a2a", paddingTop: 6 }}>
                          💬 Support: {tk.admin_note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Cancel Reason Modal ── */}
      {showCancelModal && (
        <div className="support-modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="support-modal" onClick={(e) => e.stopPropagation()}>
            <div className="support-modal-header">
              <div className="support-modal-title">Cancel Ride</div>
              <button onClick={() => setShowCancelModal(false)}
                style={{ background: "none", border: "none", color: "#888", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>✕</button>
            </div>

            {rideStatus === "accepted" && (() => {
              const minsElapsed = acceptedAt.current ? (Date.now() - acceptedAt.current) / 60000 : 0;
              const fee = minsElapsed > CANCEL_FREE_MINS ? CANCEL_FEE : 0;
              return fee > 0 ? (
                <div style={{ background: "#1a0a00", border: "1px solid #e53935", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13, color: "#e53935" }}>
                  ⚠️ A ₹{CANCEL_FEE} cancellation fee applies ({Math.round(minsElapsed)} min elapsed)
                </div>
              ) : (
                <div style={{ background: "#0d2818", borderRadius: 10, padding: "10px 12px", marginBottom: 12, fontSize: 13, color: "#1db954" }}>
                  ✅ Free cancellation — captain accepted less than {CANCEL_FREE_MINS} minutes ago
                </div>
              );
            })()}

            <div className="support-label">Why are you cancelling?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {CANCEL_REASONS.map((r) => (
                <button key={r} onClick={() => setCancelReason(r)}
                  style={{
                    padding: "12px 14px", borderRadius: 10, textAlign: "left", fontSize: 14, cursor: "pointer",
                    background: cancelReason === r ? "#0e2b1a" : "#1a1a1a",
                    border: `1.5px solid ${cancelReason === r ? "#1db954" : "#2a2a2a"}`,
                    color: cancelReason === r ? "#1db954" : "#ccc",
                    transition: "all 0.15s",
                  }}>
                  {cancelReason === r ? "✓ " : ""}{r}
                </button>
              ))}
            </div>

            <button onClick={cancelReason ? confirmCancel : undefined}
              style={{
                marginTop: 16, width: "100%", padding: "14px", borderRadius: 12, border: "none",
                background: cancelReason ? "#e53935" : "#2a2a2a",
                color: cancelReason ? "#fff" : "#555",
                fontWeight: 700, fontSize: 15, cursor: cancelReason ? "pointer" : "not-allowed",
                transition: "background 0.2s",
              }}>
              {cancelReason ? "Confirm Cancel" : "Select a reason to continue"}
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
};

export default UserPage;
