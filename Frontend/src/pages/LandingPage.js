import React from "react";
import { useNavigate } from "react-router-dom";
import { THEME } from "../theme";

const ROLES = [
    {
        id: "rider",
        icon: "🚗",
        title: "I'm a Rider",
        subtitle: "Book rides, couriers & rentals",
        gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        accent: THEME.colors.info,
        glowColor: "rgba(0, 153, 255, 0.25)",
        features: ["Instant ride booking", "Real-time tracking", "Schedule in advance"],
        route: "/login/user",
    },
    {
        id: "captain",
        icon: "🚕",
        title: "I'm a Captain",
        subtitle: "Drive & earn on your schedule",
        gradient: "linear-gradient(135deg, #0d1117 0%, #1a2a1a 100%)",
        accent: THEME.colors.secondary,
        glowColor: `rgba(0, 208, 132, 0.25)`,
        features: ["Accept ride requests", "Real-time earnings", "Trip history & stats"],
        route: "/login/captain",
    },
    {
        id: "fleet",
        icon: "🚌",
        title: "I'm a Fleet Owner",
        subtitle: "Manage your vehicle fleet",
        gradient: "linear-gradient(135deg, #1a0d0d 0%, #2a1a0d 100%)",
        accent: THEME.colors.warning,
        glowColor: "rgba(255, 193, 7, 0.25)",
        features: ["Register & manage vehicles", "Handle bulk bookings", "Track availability"],
        route: "/login/fleet",
    },
    {
        id: "rental",
        icon: "🔑",
        title: "I'm a Rental Provider",
        subtitle: "List & rent your vehicles",
        gradient: "linear-gradient(135deg, #0d1a1a 0%, #1a2a1a 100%)",
        accent: THEME.colors.secondary,
        glowColor: `rgba(0, 208, 132, 0.25)`,
        features: ["Manage rental fleet", "Communicate with users", "Set meeting locations"],
        route: "/login/rental",
    },
    {
        id: "support",
        icon: "💬",
        title: "I'm in Support Team",
        subtitle: "Help manage & monitor rides",
        gradient: "linear-gradient(135deg, #1a1a0d 0%, #2a2a0d 100%)",
        accent: THEME.colors.warning,
        glowColor: "rgba(255, 193, 7, 0.25)",
        features: ["View support tickets", "Monitor live traffic", "Database insights"],
        route: "/login/support",
    },
];

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div style={styles.page}>
            {/* Background gradient elements */}
            <div style={styles.bgGradient1} />
            <div style={styles.bgGradient2} />

            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.logo}>
                    Uride <span style={styles.logoAccent}>Services</span>
                </h1>
                <p style={styles.tagline}>Your city, your way</p>
                <p style={styles.subtitle}>
                    The complete mobility platform for riders, drivers, and fleet operators
                </p>
            </div>

            {/* Role cards */}
            <div style={styles.cardsRow}>
                {ROLES.map((role) => (
                    <RoleCard key={role.id} role={role} onSelect={() => navigate(role.route)} />
                ))}
            </div>

            {/* Footer */}
            <div style={styles.footer}>
                🔒 Secure · 📡 Real-time · ⚡ Reliable · 🌍 Always Connected
            </div>

            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          background: linear-gradient(135deg, #080c10 0%, #0f1419 100%); 
          font-family: 'Inter', sans-serif; 
          min-height: 100vh;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,255,255,0.1); }
          50% { box-shadow: 0 0 40px rgba(255,255,255,0.2); }
        }
        
        .role-card-wrap {
          animation: slideIn 0.6s ease-out forwards;
        }
        
        .role-card-wrap:nth-child(1) { animation-delay: 0.1s; }
        .role-card-wrap:nth-child(2) { animation-delay: 0.2s; }
        .role-card-wrap:nth-child(3) { animation-delay: 0.3s; }
        .role-card-wrap:nth-child(4) { animation-delay: 0.4s; }
        
        .role-card-wrap:hover .role-card-inner {
          transform: translateY(-12px) scale(1.03);
          box-shadow: var(--glow);
        }
        .role-card-wrap:hover .role-btn {
          opacity: 1 !important;
          transform: translateY(0) !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .role-card-wrap:hover .role-icon {
          transform: scale(1.2) rotate(5deg);
          animation: float 2s ease-in-out infinite;
        }
        
        .role-card-wrap:hover .role-features li {
          opacity: 1;
          transform: translateX(0);
        }
        
        @media (max-width: 768px) {
          .role-card-wrap { 
            min-width: 100% !important; 
            max-width: none !important;
          }
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
                transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
            }}
            onClick={onSelect}
        >
            <div
                className="role-card-inner"
                style={{
                    background: role.gradient,
                    border: `1.5px solid ${role.accent}40`,
                    borderRadius: THEME.borderRadius.xl,
                    padding: THEME.spacing.lg,
                    transition: "transform 0.3s cubic-bezier(.4,0,.2,1), box-shadow 0.3s",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: THEME.spacing.md,
                    backdropFilter: "blur(10px)",
                    background: `linear-gradient(135deg, 
                      rgba(255,255,255,0.05) 0%, 
                      rgba(255,255,255,0.01) 100%), ${role.gradient}`,
                }}
            >
                {/* Icon */}
                <div
                    className="role-icon"
                    style={{
                        fontSize: 56,
                        lineHeight: 1,
                        transition: "transform 0.3s cubic-bezier(.4,0,.2,1)",
                        marginBottom: THEME.spacing.sm,
                        display: "inline-block",
                        width: "fit-content",
                    }}
                >
                    {role.icon}
                </div>

                {/* Badge */}
                <div style={{ 
                    color: role.accent, 
                    fontSize: THEME.typography.sizes.xs, 
                    fontWeight: THEME.typography.weights.bold, 
                    letterSpacing: 1.5, 
                    textTransform: "uppercase",
                    opacity: 0.8,
                }}>
                    {role.id}
                </div>

                {/* Title */}
                <div style={{ 
                    color: "#fff", 
                    fontSize: THEME.typography.sizes.h4, 
                    fontWeight: THEME.typography.weights.bold, 
                    lineHeight: 1.2,
                    marginTop: THEME.spacing.sm,
                }}>
                    {role.title}
                </div>

                {/* Subtitle */}
                <div style={{ 
                    color: "#bbb", 
                    fontSize: THEME.typography.sizes.body, 
                    lineHeight: 1.5,
                    opacity: 0.9,
                }}>
                    {role.subtitle}
                </div>

                {/* Feature list */}
                <ul className="role-features" style={{ 
                    listStyle: "none", 
                    marginTop: THEME.spacing.md, 
                    display: "flex", 
                    flexDirection: "column", 
                    gap: THEME.spacing.sm, 
                    flex: 1,
                }}>
                    {role.features.map((f, idx) => (
                        <li key={f} style={{ 
                            display: "flex", 
                            alignItems: "flex-start",
                            gap: THEME.spacing.sm, 
                            fontSize: THEME.typography.sizes.small, 
                            color: "#aaa",
                            opacity: 0.8,
                            transform: "translateX(-8px)",
                            transition: `all 0.3s ease ${0.05 * idx}s`,
                        }}>
                            <span style={{ 
                                color: role.accent, 
                                fontSize: THEME.typography.sizes.body,
                                marginTop: "2px",
                                flexShrink: 0,
                            }}>✓</span> 
                            <span>{f}</span>
                        </li>
                    ))}
                </ul>

                {/* CTA Button */}
                <button
                    className="role-btn"
                    style={{
                        marginTop: THEME.spacing.lg,
                        width: "100%",
                        padding: `${THEME.spacing.md} 0`,
                        background: `linear-gradient(135deg, ${role.accent}, ${role.accent}dd)`,
                        color: "#000",
                        fontWeight: THEME.typography.weights.bold,
                        fontSize: THEME.typography.sizes.body,
                        border: "none",
                        borderRadius: THEME.borderRadius.lg,
                        cursor: "pointer",
                        opacity: 0.9,
                        transform: "translateY(4px)",
                        transition: "opacity 0.3s, transform 0.3s, box-shadow 0.3s",
                        fontFamily: THEME.typography.fontFamily,
                        letterSpacing: 0.5,
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
        background: "linear-gradient(135deg, #080c10 0%, #0f1419 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: `${THEME.spacing.xxxl} ${THEME.spacing.lg} ${THEME.spacing.xxxl}`,
        gap: THEME.spacing.xxxl,
        position: "relative",
        overflow: "hidden",
    },
    bgGradient1: {
        position: "absolute",
        top: "-50%",
        left: "-50%",
        width: "200%",
        height: "200%",
        background: "radial-gradient(circle, rgba(0,208,132,0.08) 0%, transparent 70%)",
        animation: "float 20s ease-in-out infinite",
        pointerEvents: "none",
    },
    bgGradient2: {
        position: "absolute",
        top: "50%",
        right: "-30%",
        width: "200%",
        height: "200%",
        background: "radial-gradient(circle, rgba(0,153,255,0.05) 0%, transparent 70%)",
        animation: "float 15s ease-in-out infinite reverse",
        pointerEvents: "none",
    },
    header: { 
        textAlign: "center", 
        zIndex: 2,
        animation: "slideIn 0.8s ease-out",
    },
    logo: {
        fontSize: 48,
        fontWeight: 900,
        color: "#fff",
        letterSpacing: -1,
        fontFamily: THEME.typography.fontFamily,
        marginBottom: THEME.spacing.sm,
    },
    logoAccent: { 
        color: THEME.colors.secondary, 
        marginLeft: THEME.spacing.sm 
    },
    tagline: { 
        marginTop: THEME.spacing.md, 
        color: THEME.colors.secondary, 
        fontSize: THEME.typography.sizes.h5, 
        letterSpacing: 0.5,
        fontWeight: THEME.typography.weights.semibold,
    },
    subtitle: {
        marginTop: THEME.spacing.sm,
        color: "#999",
        fontSize: THEME.typography.sizes.body,
        maxWidth: "600px",
        lineHeight: 1.6,
    },
    cardsRow: {
        display: "flex",
        flexWrap: "wrap",
        gap: THEME.spacing.xl,
        justifyContent: "center",
        width: "100%",
        maxWidth: 1200,
        zIndex: 2,
    },
    footer: {
        color: "#555",
        fontSize: THEME.typography.sizes.small,
        textAlign: "center",
        letterSpacing: 0.5,
        marginTop: THEME.spacing.xl,
        zIndex: 2,
    },
};
