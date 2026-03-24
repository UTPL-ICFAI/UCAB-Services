import React, { useState, useEffect } from "react";
import axios from "axios";
import BACKEND_URL from "../../config";
import { THEME } from "../../theme";

export default function RentalSettlement({ token }) {
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BACKEND_URL}/api/fixes/rental-providers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProviders(res.data.providers || []);
    } catch (err) {
      setMessage("❌ Failed to fetch providers");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProvider = async (provider) => {
    setSelectedProvider(provider);
    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/fixes/rental-earnings/${provider.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEarnings(res.data);
      setMessage("");
    } catch (err) {
      setMessage("❌ Failed to fetch earnings");
    }
  };

  const handleSettlement = async () => {
    if (!selectedProvider || !settleAmount || parseFloat(settleAmount) <= 0) {
      setMessage("⚠️ Please enter a valid amount");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(
        `${BACKEND_URL}/api/fixes/settle-rental-amount`,
        {
          ownerId: selectedProvider.id,
          amount: parseFloat(settleAmount),
          bookingIds: earnings?.bookings
            ?.filter(b => b.status === 'completed')
            ?.map(b => b.id) || [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMessage(`✅ ${res.data.message} - New balance: ₹${res.data.new_balance}`);
      setSettleAmount("");
      fetchProviders();
      handleSelectProvider(selectedProvider);
    } catch (err) {
      setMessage(`❌ ${err.response?.data?.error || "Settlement failed"}`);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      display: "grid",
      gridTemplateColumns: "1fr 1.5fr",
      gap: 24,
      padding: 24,
    },
    panel: {
      background: "rgba(255, 255, 255, 0.02)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      borderRadius: 12,
      padding: 20,
      backdropFilter: "blur(10px)",
    },
    title: {
      fontSize: 18,
      fontWeight: 700,
      color: "#fff",
      marginBottom: 16,
    },
    list: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      maxHeight: 400,
      overflowY: "auto",
    },
    providerItem: (isSelected) => ({
      padding: 12,
      background: isSelected ? "rgba(0, 208, 132, 0.1)" : "rgba(255, 255, 255, 0.02)",
      border: `1px solid ${isSelected ? "rgba(0, 208, 132, 0.3)" : "rgba(255, 255, 255, 0.1)"}`,
      borderRadius: 8,
      cursor: "pointer",
      transition: "all 0.3s",
    }),
    earningSummary: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      marginBottom: 20,
    },
    statBox: {
      background: "rgba(0, 208, 132, 0.1)",
      border: "1px solid rgba(0, 208, 132, 0.2)",
      borderRadius: 8,
      padding: 12,
    },
    statValue: {
      fontSize: 24,
      fontWeight: 700,
      color: "#00d084",
    },
    statLabel: {
      fontSize: 12,
      color: "rgba(255, 255, 255, 0.6)",
      marginTop: 4,
    },
    bookingsList: {
      maxHeight: 300,
      overflowY: "auto",
      marginBottom: 16,
    },
    bookingItem: {
      padding: 8,
      background: "rgba(255, 255, 255, 0.01)",
      borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
      fontSize: 12,
      color: "rgba(255, 255, 255, 0.7)",
    },
    settleSection: {
      marginTop: 20,
      paddingTop: 20,
      borderTop: "1px solid rgba(255, 255, 255, 0.1)",
    },
    input: {
      width: "100%",
      padding: "10px 12px",
      marginBottom: 12,
      background: "rgba(255, 255, 255, 0.05)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      borderRadius: 8,
      color: "#fff",
      fontSize: 14,
    },
    button: {
      width: "100%",
      padding: "12px",
      background: "linear-gradient(135deg, #00d084, #00b870)",
      border: "none",
      borderRadius: 8,
      color: "#fff",
      fontWeight: 700,
      cursor: "pointer",
      transition: "all 0.3s",
    },
    message: {
      padding: 12,
      borderRadius: 8,
      fontSize: 13,
      marginTop: 12,
      background: "rgba(255, 255, 255, 0.05)",
      color: "#fff",
    },
    empty: {
      textAlign: "center",
      padding: 40,
      color: "rgba(255, 255, 255, 0.5)",
    },
  };

  return (
    <div style={styles.container}>
      {/* Providers List */}
      <div style={styles.panel}>
        <div style={styles.title}>💰 Rental Providers</div>
        {loading && <div style={styles.empty}>Loading...</div>}
        {providers.length === 0 ? (
          <div style={styles.empty}>No rental providers</div>
        ) : (
          <div style={styles.list}>
            {providers.map((p) => (
              <div
                key={p.id}
                style={styles.providerItem(selectedProvider?.id === p.id)}
                onClick={() => handleSelectProvider(p)}
              >
                <div style={{ fontWeight: 600, color: "#fff" }}>
                  {p.owner_name}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)" }}>
                  {p.company_name || p.email}
                </div>
                <div style={{ fontSize: 12, color: "#00d084", marginTop: 4 }}>
                  Balance: ₹{parseFloat(p.wallet_balance || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Details & Settlement */}
      <div style={styles.panel}>
        {selectedProvider ? (
          <>
            <div style={styles.title}>Settlement for {selectedProvider.owner_name}</div>

            {earnings && (
              <>
                <div style={styles.earningSummary}>
                  <div style={styles.statBox}>
                    <div style={styles.statValue}>
                      {earnings.completed_bookings}
                    </div>
                    <div style={styles.statLabel}>Completed Bookings</div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statValue}>
                      ₹{earnings.total_earnings?.toFixed(0)}
                    </div>
                    <div style={styles.statLabel}>Total Earnings</div>
                  </div>
                </div>

                <div style={styles.bookingsList}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "rgba(255, 255, 255, 0.7)" }}>
                    Recent Bookings:
                  </div>
                  {earnings.bookings.slice(0, 5).map((b) => (
                    <div key={b.id} style={styles.bookingItem}>
                      Booking #{b.id?.substring(0, 8)}... - ₹{b.total_amount} - {b.status}
                    </div>
                  ))}
                </div>

                <div style={styles.settleSection}>
                  <label style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: 13, display: "block", marginBottom: 8 }}>
                    Settlement Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    placeholder={`Enter amount up to ₹${earnings.total_earnings?.toFixed(0)}`}
                    style={styles.input}
                    disabled={loading}
                  />
                  <button
                    onClick={handleSettlement}
                    style={styles.button}
                    disabled={loading}
                    onMouseEnter={(e) => {
                      if (!loading) e.target.style.opacity = "0.9";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.opacity = "1";
                    }}
                  >
                    {loading ? "Processing..." : "Settle Amount ✓"}
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <div style={styles.empty}>Select a provider to view details</div>
        )}

        {message && <div style={styles.message}>{message}</div>}
      </div>
    </div>
  );
}
