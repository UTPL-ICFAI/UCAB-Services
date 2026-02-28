import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import BACKEND_URL from "../config";

export default function NotificationsPage() {
    const stored = JSON.parse(localStorage.getItem("ucab_user") || "null");
    const userId = stored?._id;

    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchNotifications = useCallback(async () => {
        if (!userId) { setError("Not logged in"); setLoading(false); return; }
        try {
            const res = await axios.get(`${BACKEND_URL}/api/notifications?userId=${userId}&limit=50`);
            setNotifications(res.data.notifications);
            setUnreadCount(res.data.unreadCount);
        } catch (e) {
            setError(e.response?.data?.message || "Failed to load notifications");
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    const markRead = async (id) => {
        try {
            await axios.patch(`${BACKEND_URL}/api/notifications/${id}/read`);
            setNotifications((prev) =>
                prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
            );
            setUnreadCount((c) => Math.max(0, c - 1));
        } catch (_) { }
    };

    const markAllRead = async () => {
        try {
            await axios.patch(`${BACKEND_URL}/api/notifications/read-all?userId=${userId}`);
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (_) { }
    };

    const typeIcon = (type) => (type === "RIDE_BOOKED" ? "📍" : "✅");
    const timeAgo = (iso) => {
        const diff = (Date.now() - new Date(iso)) / 1000;
        if (diff < 60) return `${Math.floor(diff)}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        return `${Math.floor(diff / 3600)}h ago`;
    };

    return (
        <div className="notifications-page">
            <div className="notif-header">
                <h2>🔔 Notifications {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}</h2>
                {unreadCount > 0 && (
                    <button className="btn-link" onClick={markAllRead}>Mark all as read</button>
                )}
            </div>

            {loading && <p className="notif-loading">Loading…</p>}
            {error && <p className="notif-error">{error}</p>}

            {!loading && notifications.length === 0 && (
                <div className="notif-empty">
                    <span style={{ fontSize: 48 }}>📭</span>
                    <p>No notifications yet</p>
                </div>
            )}

            <div className="notif-list">
                {notifications.map((n) => (
                    <div
                        key={n._id}
                        className={`notif-item ${n.isRead ? "notif-read" : "notif-unread"}`}
                        onClick={() => !n.isRead && markRead(n._id)}
                    >
                        <span className="notif-icon">{typeIcon(n.type)}</span>
                        <div className="notif-body">
                            <p className="notif-message">{n.message}</p>
                            <span className="notif-time">{timeAgo(n.createdAt)}</span>
                        </div>
                        {!n.isRead && <span className="notif-dot" />}
                    </div>
                ))}
            </div>

            <style>{`
        .notifications-page { max-width: 600px; margin: 32px auto; padding: 0 16px; font-family: inherit; }
        .notif-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20px; }
        .notif-header h2 { margin:0; font-size:1.4rem; display:flex; align-items:center; gap:10px; }
        .notif-badge { background:#e53e3e; color:#fff; border-radius:999px; padding:2px 8px; font-size:0.75rem; }
        .btn-link { background:none; border:none; color:#3182ce; cursor:pointer; font-size:0.9rem; text-decoration:underline; }
        .notif-loading, .notif-error { text-align:center; padding:32px; color:#888; }
        .notif-error { color:#e53e3e; }
        .notif-empty { text-align:center; padding:48px; color:#aaa; }
        .notif-list { display:flex; flex-direction:column; gap:10px; }
        .notif-item { display:flex; align-items:flex-start; gap:12px; padding:14px 16px; border-radius:12px; cursor:pointer; transition:background .15s; position:relative; }
        .notif-unread { background:#ebf8ff; border:1px solid #bee3f8; }
        .notif-read   { background:#f7fafc; border:1px solid #e2e8f0; opacity:.8; cursor:default; }
        .notif-icon   { font-size:1.5rem; }
        .notif-body   { flex:1; }
        .notif-message{ margin:0 0 4px; font-size:0.95rem; color:#2d3748; }
        .notif-time   { font-size:0.78rem; color:#a0aec0; }
        .notif-dot    { width:8px; height:8px; border-radius:50%; background:#3182ce; align-self:center; flex-shrink:0; }
      `}</style>
        </div>
    );
}
