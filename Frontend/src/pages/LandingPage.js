import React from "react";
import { useNavigate } from "react-router-dom";

const ROLES = [
    {
        id: "rider",
        icon: "🚗",
        title: "I'm a Rider",
        subtitle: "Book rides, couriers & rentals",
        gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        accent: "#4299e1",
        glowColor: "rgba(66,153,225,0.25)",
        features: ["Instant ride booking", "Real-time tracking", "Schedule in advance"],
        route: "/login/user",
    },
    {
        id: "captain",
        icon: "🚕",
        title: "I'm a Captain",
        subtitle: "Drive & earn on your schedule",
        gradient: "linear-gradient(135deg, #0d1117 0%, #1a2a1a 100%)",
        accent: "#1db954",
        glowColor: "rgba(29,185,84,0.25)",
        features: ["Accept ride requests", "Real-time earnings", "Trip history & stats"],
        route: "/login/captain",
    },
    {
        id: "fleet",
        icon: "🚌",
        title: "I'm a Fleet Owner",
        subtitle: "Manage your vehicle fleet",
        gradient: "linear-gradient(135deg, #1a0d0d 0%, #2a1a0d 100%)",
        accent: "#f6ad55",
        glowColor: "rgba(246,173,85,0.25)",
        features: ["Register & manage vehicles", "Handle bulk bookings", "Track availability"],
        route: "/login/fleet",
    },
];

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div style={styles.page}>
            {/* Header */}
            <div style={styles.header}>
                <div style={styles.logo}>
                    UCab <span style={styles.logoAccent}>Services</span>
                </div>
                <div style={styles.tagline}>Your city, your way</div>
            </div>

            {/* Role cards */}
            <div style={styles.cardsRow}>
                {ROLES.map((role) => (
                    <RoleCard key={role.id} role={role} onSelect={() => navigate(role.route)} />
                ))}
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                Powered by UCab Services · Secure · Real-time · Reliable
            </div>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080c10; font-family: 'Inter', sans-serif; }
        .role-card-wrap:hover .role-card-inner {
          transform: translateY(-8px) scale(1.02);
          box-shadow: var(--glow);
        }
        .role-card-wrap:hover .role-btn {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }
        .role-card-wrap:hover .role-icon {
          transform: scale(1.15);
        }
      `}</style>
        </div>
    );
}

function RoleCard({ role, onSelect }) {
    return (
        <div
            className="role-card-wrap"
            style={{
                "--glow": `0 20px 60px ${role.glowColor}, 0 0 0 1px ${role.accent}40`,
                flex: 1,
                minWidth: 260,
                maxWidth: 340,
                cursor: "pointer",
            }}
            onClick={onSelect}
        >
            <div
                className="role-card-inner"
                style={{
                    background: role.gradient,
                    border: `1px solid ${role.accent}30`,
                    borderRadius: 20,
                    padding: "36px 28px 28px",
                    transition: "transform 0.3s cubic-bezier(.4,0,.2,1), box-shadow 0.3s",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                }}
            >
                {/* Icon */}
                <div
                    className="role-icon"
                    style={{
                        fontSize: 56,
                        lineHeight: 1,
                        transition: "transform 0.25s",
                        marginBottom: 4,
                    }}
                >
                    {role.icon}
                </div>

                {/* Text */}
                <div style={{ color: role.accent, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
                    {role.id}
                </div>
                <div style={{ color: "#fff", fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>
                    {role.title}
                </div>
                <div style={{ color: "#888", fontSize: 14, lineHeight: 1.5 }}>
                    {role.subtitle}
                </div>

                {/* Feature list */}
                <ul style={{ listStyle: "none", marginTop: 8, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    {role.features.map((f) => (
                        <li key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#bbb" }}>
                            <span style={{ color: role.accent, fontSize: 16 }}>✓</span> {f}
                        </li>
                    ))}
                </ul>

                {/* CTA Button */}
                <button
                    className="role-btn"
                    style={{
                        marginTop: 20,
                        width: "100%",
                        padding: "13px 0",
                        background: `linear-gradient(135deg, ${role.accent}, ${role.accent}bb)`,
                        color: "#000",
                        fontWeight: 800,
                        fontSize: 15,
                        border: "none",
                        borderRadius: 12,
                        cursor: "pointer",
                        opacity: 0.85,
                        transform: "translateY(4px)",
                        transition: "opacity 0.2s, transform 0.2s",
                    }}
                >
                    Get Started →
                </button>
            </div>
        </div>
    );
}

const styles = {
    page: {
        minHeight: "100vh",
        background: "#080c10",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "40px 24px 32px",
        gap: 48,
    },
    header: { textAlign: "center" },
    logo: {
        fontSize: 36,
        fontWeight: 900,
        color: "#fff",
        letterSpacing: -1,
        fontFamily: "Inter, sans-serif",
    },
    logoAccent: { color: "#1db954", marginLeft: 6 },
    tagline: { marginTop: 8, color: "#555", fontSize: 15, letterSpacing: 1 },
    cardsRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: 20,
        justifyContent: "center",
        width: "100%",
        maxWidth: 1060,
    },
    footer: {
        color: "#333",
        fontSize: 12,
        textAlign: "center",
        letterSpacing: 0.5,
    },
};
