import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import MapView from "../components/MapView";
import BACKEND_URL from "../config";

const STATUS_LABELS = {
  pending: "🔍 Finding Captain…",
  accepted: "🚗 Captain is on the way",
  started: "🏁 Ride in progress",
  completed: "✅ Ride completed",
  cancelled: "❌ Ride cancelled",
};

export default function TrackingPage() {
  const { shareToken } = useParams();
  const [rideData, setRideData] = useState(null);
  const [error, setError] = useState("");
  const intervalRef = useRef(null);

  const fetchRide = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/api/rides/track/${shareToken}`);
      setRideData(res.data);
      setError("");
    } catch (e) {
      setError(e.response?.data?.error || "Could not load ride info.");
    }
  };

  useEffect(() => {
    fetchRide();
    intervalRef.current = setInterval(fetchRide, 5000);
    return () => clearInterval(intervalRef.current);
  }, [shareToken]);

  const captainLocation = rideData?.captainLocation
    ? { lat: rideData.captainLocation.lat, lng: rideData.captainLocation.lng, address: "Captain" }
    : null;

  const pickup = rideData?.ride?.pickup || null;
  const dropoff = rideData?.ride?.dropoff || null;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#eee", fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div style={{ padding: "16px 20px", background: "#111", borderBottom: "1px solid #222", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: -1, color: "#fff" }}>
          uride <span style={{ color: "#1db954" }}>services</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#888" }}>Live Tracking</div>
      </div>

      {error ? (
        <div style={{ textAlign: "center", padding: 60, color: "#e53935", fontSize: 15 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          {error}
        </div>
      ) : !rideData ? (
        <div style={{ textAlign: "center", padding: 80, color: "#555" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔄</div>
          Loading ride info…
        </div>
      ) : (
        <>
          {/* Map */}
          <div style={{ height: 300 }}>
            <MapView pickup={captainLocation || pickup} dropoff={dropoff} height="300px" />
          </div>

          {/* Ride info card */}
          <div style={{ padding: 20, maxWidth: 480, margin: "0 auto" }}>

            {/* Status banner */}
            <div style={{
              background: "#111", border: "1.5px solid #1db954", borderRadius: 14,
              padding: "14px 18px", marginBottom: 16, textAlign: "center",
              fontSize: 16, fontWeight: 700, color: "#1db954",
            }}>
              {STATUS_LABELS[rideData.ride?.status] || rideData.ride?.status || "—"}
            </div>

            {/* Captain info */}
            {rideData.captain && (
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "14px 18px", marginBottom: 14, display: "flex", alignItems: "center", gap: 14 }}>
                {rideData.captain.photoUrl ? (
                  <img src={rideData.captain.photoUrl} alt="captain" style={{ width: 54, height: 54, borderRadius: "50%", objectFit: "cover", border: "2px solid #1db954" }} />
                ) : (
                  <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#1db954", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#000" }}>
                    {rideData.captain.name?.[0]?.toUpperCase() || "C"}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#eee" }}>{rideData.captain.name}</div>
                  <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>
                    {rideData.captain.vehicle?.color} {rideData.captain.vehicle?.model} · {rideData.captain.vehicle?.plate}
                  </div>
                  {rideData.captain.rating && (
                    <div style={{ fontSize: 12, color: "#f6ad55", marginTop: 2 }}>⭐ {rideData.captain.rating} rating</div>
                  )}
                </div>
              </div>
            )}

            {/* Route */}
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "14px 18px", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#666", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Route</div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#1db954", flexShrink: 0, marginTop: 3 }} />
                <div style={{ fontSize: 14, color: "#ccc" }}>{pickup?.address || "Pickup"}</div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#e53935", flexShrink: 0, marginTop: 3 }} />
                <div style={{ fontSize: 14, color: "#ccc" }}>{dropoff?.address || "Dropoff"}</div>
              </div>
            </div>

            {/* Fare */}
            {rideData.ride?.fare && (
              <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, color: "#888" }}>Estimated Fare</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#1db954" }}>₹{rideData.ride.fare}</span>
              </div>
            )}

            <div style={{ textAlign: "center", fontSize: 12, color: "#444", marginTop: 20 }}>
              Updates every 5 seconds · Shared via uride services
            </div>
          </div>
        </>
      )}
    </div>
  );
}
