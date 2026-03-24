import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import BACKEND_URL from "../config";
import { THEME } from "../theme";
import RentalSettlement from "./components/RentalSettlement";

// Global animations
const animationStyles = `
    @keyframes slideUp {
        from {
            opacity: 0;
            transform: translateY(20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
`;

// Inject animations
if (!document.getElementById("support-dashboard-animations")) {
    const styleSheet = document.createElement("style");
    styleSheet.id = "support-dashboard-animations";
    styleSheet.textContent = animationStyles;
    document.head.appendChild(styleSheet);
}

export default function SupportTeamDashboard() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("tickets");
    const [stats, setStats] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [traffic, setTraffic] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [newStatus, setNewStatus] = useState("");
    const [adminNote, setAdminNote] = useState("");

    const token = localStorage.getItem("support_team_token");
    const team = JSON.parse(localStorage.getItem("support_team") || "{}");

    useEffect(() => {
        if (!token) navigate("/login/support");
        else loadDashboard();
    }, [token, navigate]);

    const loadDashboard = async () => {
        setLoading(true);
        try {
            const [statsRes, ticketsRes, trafficRes] = await Promise.all([
                axios.get(`${BACKEND_URL}/api/support-team/stats`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                axios.get(`${BACKEND_URL}/api/support-team/tickets?page=1&limit=20`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
                axios.get(`${BACKEND_URL}/api/support-team/live-rides`, {
                    headers: { Authorization: `Bearer ${token}` },
                }),
            ]);

            setStats(statsRes.data.stats);
            setTickets(ticketsRes.data.tickets);
            setTraffic(trafficRes.data.traffic);
        } catch (err) {
            console.error("Failed to load dashboard:", err);
            if (err.response?.status === 401) navigate("/login/support");
        } finally {
            setLoading(false);
        }
    };

    const handleTicketUpdate = async (ticketId) => {
        if (!newStatus) {
            alert("Please select a status");
            return;
        }

        try {
            const res = await axios.put(
                `${BACKEND_URL}/api/support-team/ticket/${ticketId}/status`,
                { status: newStatus, adminNote: adminNote.trim() || null },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedTicket(null);
            setNewStatus("");
            setAdminNote("");
            loadDashboard();
            alert("✅ Ticket updated");
        } catch (err) {
            alert("Failed to update ticket");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("support_team_token");
        localStorage.removeItem("support_team");
        navigate("/");
    };

    return (
        <div style={styles.page}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.headerContent}>
                    <h1 style={styles.title}>Support Center</h1>
                    <div style={styles.userInfo}>
                        <span>👤 {team.name || "Support"}</span>
                        <button 
                            onClick={handleLogout} 
                            style={styles.logoutBtn}
                            onMouseEnter={(e) => {
                                e.target.style.background = "rgba(244, 67, 54, 0.25)";
                                e.target.style.borderColor = "rgba(244, 67, 54, 0.5)";
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.background = "rgba(244, 67, 54, 0.15)";
                                e.target.style.borderColor = "rgba(244, 67, 54, 0.4)";
                            }}
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={styles.tabsContainer}>
                {["tickets", "settlement", "traffic", "stats"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            ...styles.tab,
                            borderBottomColor:
                                activeTab === tab
                                    ? THEME.colors.secondary
                                    : "transparent",
                            color:
                                activeTab === tab
                                    ? THEME.colors.secondary
                                    : "rgba(255, 255, 255, 0.6)",
                            backgroundColor: activeTab === tab ? "rgba(0, 208, 132, 0.05)" : "transparent",
                        }}
                        onMouseEnter={(e) => {
                            if (activeTab !== tab) {
                                e.target.style.color = "rgba(255, 255, 255, 0.8)";
                                e.target.style.backgroundColor = "rgba(255, 255, 255, 0.02)";
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeTab !== tab) {
                                e.target.style.color = "rgba(255, 255, 255, 0.6)";
                                e.target.style.backgroundColor = "transparent";
                            }
                        }}
                    >
                        {tab === "tickets" && "🎟️  Tickets"}
                        {tab === "settlement" && "💰 Settlement"}
                        {tab === "traffic" && "🚗  Live Traffic"}
                        {tab === "stats" && "📊  Stats"}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={styles.container}>
                {/* Tickets Tab */}
                {activeTab === "tickets" && (
                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>Support Tickets</h2>
                        {loading ? (
                            <div style={styles.loader}>Loading...</div>
                        ) : (
                            <div style={styles.ticketsList}>
                                {tickets.length === 0 ? (
                                    <div style={styles.empty}>No tickets found</div>
                                ) : (
                                    tickets.map((ticket) => (
                                        <div
                                            key={ticket.id}
                                            style={styles.ticketCard}
                                            onClick={() => setSelectedTicket(ticket)}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = "linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(0, 208, 132, 0.1) 100%)";
                                                e.currentTarget.style.borderColor = "rgba(0, 208, 132, 0.4)";
                                                e.currentTarget.style.transform = "translateY(-2px)";
                                                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0, 0, 0, 0.3)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = styles.ticketCard.background;
                                                e.currentTarget.style.borderColor = styles.ticketCard.border.split(" ")[1];
                                                e.currentTarget.style.transform = "translateY(0)";
                                                e.currentTarget.style.boxShadow = "none";
                                            }}
                                        >
                                            <div style={styles.ticketHeader}>
                                                <h3 style={styles.ticketSubject}>
                                                    {ticket.subject}
                                                </h3>
                                                <span
                                                    style={{
                                                        ...styles.statusBadge,
                                                        background:
                                                            ticket.status === "open"
                                                                ? "#ff6b6b"
                                                                : ticket.status ===
                                                                  "in_review"
                                                                ? "#ffc107"
                                                                : "#4caf50",
                                                    }}
                                                >
                                                    {ticket.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <p style={styles.ticketUser}>
                                                👤 {ticket.user_name || "Unknown"}
                                            </p>
                                            <p style={styles.ticketCategory}>
                                                📌 {ticket.category}
                                            </p>
                                            <p style={styles.ticketTime}>
                                                🕐{" "}
                                                {new Date(
                                                    ticket.created_at
                                                ).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Ticket Details Modal */}
                {selectedTicket && (
                    <div style={styles.modal}>
                        <div style={styles.modalContent}>
                            <button
                                onClick={() => setSelectedTicket(null)}
                                style={styles.closeBtn}
                            >
                                ✕
                            </button>

                            <h2 style={styles.modalTitle}>Ticket Details</h2>

                            <div style={styles.detailsGrid}>
                                <div>
                                    <label style={styles.detailLabel}>Subject</label>
                                    <p style={styles.detailValue}>
                                        {selectedTicket.subject}
                                    </p>
                                </div>
                                <div>
                                    <label style={styles.detailLabel}>User</label>
                                    <p style={styles.detailValue}>
                                        {selectedTicket.user_name} (
                                        {selectedTicket.user_phone})
                                    </p>
                                </div>
                                <div>
                                    <label style={styles.detailLabel}>Category</label>
                                    <p style={styles.detailValue}>
                                        {selectedTicket.category}
                                    </p>
                                </div>
                                <div>
                                    <label style={styles.detailLabel}>Status</label>
                                    <p style={styles.detailValue}>
                                        {selectedTicket.status}
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label style={styles.detailLabel}>Description</label>
                                <p style={styles.detailValue}>
                                    {selectedTicket.description || "No description"}
                                </p>
                            </div>

                            {/* Call User Feature */}
                            <div style={styles.callSection}>
                                <button
                                    onClick={() => {
                                        if (selectedTicket.user_phone) {
                                            window.location.href = `tel:${selectedTicket.user_phone}`;
                                        }
                                    }}
                                    style={styles.callButton}
                                >
                                    📞 Call User ({selectedTicket.user_phone || "N/A"})
                                </button>
                            </div>

                            <hr
                                style={{
                                    border: "none",
                                    borderTop: "1px solid rgba(255, 255, 255, 0.1)",
                                    margin: "20px 0",
                                }}
                            />

                            <div>
                                <label style={styles.detailLabel}>Update Status</label>
                                <select
                                    value={newStatus}
                                    onChange={(e) => setNewStatus(e.target.value)}
                                    style={styles.select}
                                >
                                    <option value="">Select status...</option>
                                    <option value="open">Open</option>
                                    <option value="in_review">In Review</option>
                                    <option value="resolved">Resolved</option>
                                    <option value="closed">Closed</option>
                                </select>
                            </div>

                            <div style={{ marginTop: "16px" }}>
                                <label style={styles.detailLabel}>Admin Note</label>
                                <textarea
                                    value={adminNote}
                                    onChange={(e) => setAdminNote(e.target.value)}
                                    placeholder="Add a note..."
                                    style={styles.textarea}
                                />
                            </div>

                            <div style={styles.modalActions}>
                                <button
                                    onClick={() => setSelectedTicket(null)}
                                    style={styles.cancelBtn}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() =>
                                        handleTicketUpdate(selectedTicket.id)
                                    }
                                    style={styles.submitBtn}
                                >
                                    Update Ticket
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Settlement Tab */}
                {activeTab === "settlement" && (
                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>💰 Rental Provider Settlement</h2>
                        <RentalSettlement token={token} />
                    </div>
                )}

                {/* Traffic Tab */}
                {activeTab === "traffic" && (
                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>Live Ride Traffic</h2>
                        {loading ? (
                            <div style={styles.loader}>Loading...</div>
                        ) : traffic ? (
                            <div style={styles.statsGrid}>
                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>📊</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>Total Rides (24h)</div>
                                        <div style={styles.statValue}>
                                            {traffic.total_rides || 0}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>🚗</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>Ongoing Rides</div>
                                        <div style={styles.statValue}>
                                            {traffic.ongoing_rides || 0}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>🔍</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>Searching</div>
                                        <div style={styles.statValue}>
                                            {traffic.searching_rides || 0}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>🚴</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>Carpool Rides</div>
                                        <div style={styles.statValue}>
                                            {traffic.carpool_rides || 0}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>📦</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>Courier Rides</div>
                                        <div style={styles.statValue}>
                                            {traffic.courier_rides || 0}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>💰</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>
                                            Avg Fare (Ongoing)
                                        </div>
                                        <div style={styles.statValue}>
                                            ₹
                                            {traffic.avg_fare_ongoing
                                                ? Math.round(
                                                    traffic.avg_fare_ongoing
                                                )
                                                : 0}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={styles.empty}>No traffic data</div>
                        )}
                    </div>
                )}

                {/* Stats Tab */}
                {activeTab === "stats" && (
                    <div style={styles.section}>
                        <h2 style={styles.sectionTitle}>Database Statistics</h2>
                        {loading ? (
                            <div style={styles.loader}>Loading...</div>
                        ) : stats ? (
                            <div style={styles.statsGrid}>
                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>👥</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>Total Users</div>
                                        <div style={styles.statValue}>
                                            {stats.totalUsers}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>🚕</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>Total Captains</div>
                                        <div style={styles.statValue}>
                                            {stats.totalCaptains}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>🚗</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>Registered Vehicles</div>
                                        <div style={styles.statValue}>
                                            {stats.totalVehicles}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>📅</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>Rides (30 days)</div>
                                        <div style={styles.statValue}>
                                            {stats.ridesLast30Days}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>🔔</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>Open Tickets</div>
                                        <div style={styles.statValue}>
                                            {stats.openTickets}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>🏢</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>Fleet Owners</div>
                                        <div style={styles.statValue}>
                                            {stats.fleetOwners}
                                        </div>
                                    </div>
                                </div>

                                <div style={styles.statCard}>
                                    <div style={styles.statIcon}>🔑</div>
                                    <div style={styles.statContent}>
                                        <div style={styles.statLabel}>
                                            Rental Providers
                                        </div>
                                        <div style={styles.statValue}>
                                            {stats.rentalProviders}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={styles.empty}>No stats available</div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', sans-serif; }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        background: "linear-gradient(135deg, #080c10 0%, #0f1419 100%)",
        color: "#fff",
        fontFamily: "'Inter', sans-serif",
    },
    header: {
        background: "linear-gradient(135deg, rgba(15, 20, 25, 0.95) 0%, rgba(0, 208, 132, 0.05) 100%)",
        borderBottom: "2px solid rgba(0, 208, 132, 0.3)",
        padding: "24px 30px",
        backdropFilter: "blur(10px)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
    },
    headerContent: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        maxWidth: "1400px",
        margin: "0 auto",
    },
    title: {
        fontSize: "28px",
        fontWeight: "700",
        background: "linear-gradient(135deg, #00d084 0%, #00a860 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        margin: 0,
    },
    userInfo: {
        display: "flex",
        alignItems: "center",
        gap: "24px",
        fontSize: "14px",
    },
    logoutBtn: {
        background: "rgba(244, 67, 54, 0.15)",
        border: "1px solid rgba(244, 67, 54, 0.4)",
        color: "#ff6b6b",
        padding: "10px 20px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "13px",
        fontWeight: "600",
        transition: "all 0.3s ease",
    },
    tabsContainer: {
        display: "flex",
        gap: "0",
        padding: "0 30px",
        maxWidth: "1400px",
        margin: "0 auto",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        background: "rgba(15, 20, 25, 0.4)",
    },
    tab: {
        background: "none",
        border: "none",
        color: "rgba(255, 255, 255, 0.6)",
        fontSize: "15px",
        fontWeight: "600",
        cursor: "pointer",
        padding: "16px 24px",
        borderBottom: "3px solid transparent",
        transition: "all 0.3s ease",
        position: "relative",
    },
    container: {
        maxWidth: "1400px",
        margin: "0 auto",
        padding: "32px 30px",
    },
    section: {
        animation: "slideUp 0.6s ease-out",
    },
    sectionTitle: {
        fontSize: "22px",
        fontWeight: "700",
        marginBottom: "24px",
        color: "#fff",
    },
    loader: {
        textAlign: "center",
        padding: "60px 20px",
        color: "rgba(255, 255, 255, 0.5)",
        fontSize: "16px",
    },
    empty: {
        textAlign: "center",
        padding: "80px 20px",
        color: "rgba(255, 255, 255, 0.3)",
        fontSize: "15px",
    },
    ticketsList: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: "16px",
    },
    ticketCard: {
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(0, 208, 132, 0.05) 100%)",
        border: "1px solid rgba(0, 208, 132, 0.2)",
        borderRadius: "12px",
        padding: "18px",
        cursor: "pointer",
        transition: "all 0.3s ease",
    },
    ticketHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "start",
        gap: "12px",
        marginBottom: "14px",
    },
    ticketSubject: {
        fontSize: "15px",
        fontWeight: "700",
        flex: 1,
        color: "#fff",
    },
    statusBadge: {
        fontSize: "10px",
        fontWeight: "700",
        padding: "6px 10px",
        borderRadius: "6px",
        color: "#fff",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        fontFamily: "'Inter', sans-serif",
    },
    ticketUser: {
        fontSize: "13px",
        color: "rgba(255, 255, 255, 0.7)",
        marginBottom: "8px",
    },
    ticketCategory: {
        fontSize: "12px",
        color: "rgba(255, 255, 255, 0.6)",
        marginBottom: "8px",
    },
    ticketTime: {
        fontSize: "11px",
        color: "rgba(255, 255, 255, 0.5)",
    },
    modal: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        animation: "slideInUp 0.3s ease",
        backdropFilter: "blur(5px)",
    },
    modalContent: {
        background: "linear-gradient(135deg, rgba(15, 20, 25, 0.98) 0%, rgba(20, 30, 40, 0.95) 100%)",
        border: "1px solid rgba(0, 208, 132, 0.2)",
        borderRadius: "16px",
        padding: "32px",
        maxWidth: "650px",
        width: "92%",
        maxHeight: "85vh",
        overflowY: "auto",
        backdropFilter: "blur(12px)",
        position: "relative",
        boxShadow: "0 20px 60px rgba(0, 0, 0, 0.4)",
    },
    closeBtn: {
        position: "absolute",
        top: "20px",
        right: "20px",
        background: "rgba(255, 255, 255, 0.1)",
        border: "none",
        color: "rgba(255, 255, 255, 0.7)",
        fontSize: "24px",
        cursor: "pointer",
        padding: "4px 8px",
        borderRadius: "6px",
        transition: "all 0.3s ease",
        lineHeight: 1,
    },
    modalTitle: {
        fontSize: "22px",
        fontWeight: "700",
        marginBottom: "24px",
        color: "#00d084",
    },
    detailsGrid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px",
        marginBottom: "24px",
    },
    detailLabel: {
        fontSize: "11px",
        fontWeight: "700",
        color: "rgba(255, 255, 255, 0.5)",
        textTransform: "uppercase",
        marginBottom: "8px",
        display: "block",
        letterSpacing: "0.5px",
    },
    detailValue: {
        fontSize: "15px",
        fontWeight: "500",
        color: "#fff",
    },
    callSection: {
        margin: "20px 0",
        padding: "16px",
        background: "linear-gradient(135deg, rgba(0, 153, 255, 0.1) 0%, rgba(0, 208, 132, 0.05) 100%)",
        borderRadius: "10px",
        border: "1px solid rgba(0, 153, 255, 0.2)",
    },
    callButton: {
        width: "100%",
        background: "linear-gradient(135deg, #0099ff 0%, #0077cc 100%)",
        border: "none",
        color: "#fff",
        padding: "14px",
        borderRadius: "8px",
        fontWeight: "700",
        cursor: "pointer",
        fontSize: "15px",
        transition: "all 0.3s ease",
        fontFamily: "'Inter', sans-serif",
    },
    select: {
        width: "100%",
        background: "rgba(30, 40, 50, 0.8)",
        border: "1px solid rgba(0, 208, 132, 0.2)",
        color: "#fff",
        padding: "12px 14px",
        borderRadius: "8px",
        fontSize: "14px",
        outline: "none",
        transition: "all 0.3s ease",
        fontFamily: "'Inter', sans-serif",
        fontWeight: "500",
    },
    textarea: {
        width: "100%",
        background: "rgba(30, 40, 50, 0.8)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        color: "#fff",
        padding: "12px 14px",
        borderRadius: "8px",
        fontSize: "14px",
        minHeight: "90px",
        resize: "vertical",
        fontFamily: "'Inter', sans-serif",
        outline: "none",
        transition: "all 0.3s ease",
    },
    modalActions: {
        display: "flex",
        gap: "12px",
        marginTop: "28px",
    },
    cancelBtn: {
        flex: 1,
        background: "rgba(255, 255, 255, 0.08)",
        border: "1px solid rgba(255, 255, 255, 0.15)",
        color: "#fff",
        padding: "12px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "600",
        transition: "all 0.3s ease",
        fontFamily: "'Inter', sans-serif",
    },
    submitBtn: {
        flex: 1,
        background: "linear-gradient(135deg, #00d084 0%, #00a860 100%)",
        border: "none",
        color: "#000",
        padding: "12px",
        borderRadius: "8px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "700",
        transition: "all 0.3s ease",
        fontFamily: "'Inter', sans-serif",
    },
    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: "18px",
    },
    statCard: {
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(0, 208, 132, 0.05) 100%)",
        border: "1px solid rgba(0, 208, 132, 0.2)",
        borderRadius: "14px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        transition: "all 0.3s ease",
    },
    statIcon: {
        fontSize: "40px",
        marginBottom: "12px",
    },
    statContent: {
        flex: 1,
        width: "100%",
    },
    statLabel: {
        fontSize: "12px",
        color: "rgba(255, 255, 255, 0.6)",
        fontWeight: "500",
        marginBottom: "8px",
        textTransform: "uppercase",
    },
    statValue: {
        fontSize: "28px",
        fontWeight: "700",
        color: "#00d084",
    },
};
