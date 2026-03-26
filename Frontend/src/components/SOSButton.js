/**
 * Frontend/src/components/SOSButton.js
 * Emergency SOS button with countdown timer
 */

import React, { useState, useRef } from 'react';
import axios from 'axios';

const BACKEND_URL = require('../config').default;

export function SOSButton({ rideId, onSOSTriggered, disabled = false }) {
    const [sosActive, setSosActive] = useState(false);
    const [countdown, setCountdown] = useState(null);
    const [message, setMessage] = useState('');
    const countdownRef = useRef(null);

    const handleSOSClick = async () => {
        if (!navigator.geolocation) {
            setMessage('❌ Geolocation not available');
            return;
        }

        // Get current location
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, lng } = pos.coords;
                
                setSosActive(true);
                setCountdown(3);

                // Start countdown
                countdownRef.current = setInterval(() => {
                    setCountdown(prev => {
                        if (prev <= 1) {
                            clearInterval(countdownRef.current);
                            triggerSOS(latitude, lng);
                            return null;
                        }
                        return prev - 1;
                    });
                }, 1000);
            },
            (err) => {
                const errorMsg = err.code === 1 
                    ? '❌ Location permission denied'
                    : err.code === 2
                    ? '❌ Location unavailable'
                    : '❌ Location timeout';
                setMessage(errorMsg);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const triggerSOS = async (lat, lng) => {
        try {
            const token = localStorage.getItem('ucab_token');
            const response = await axios.post(
                `${BACKEND_URL}/api/sos/trigger`,
                {
                    rideId,
                    lat,
                    lng,
                    address: 'Current location'
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setMessage(`🚨 SOS TRIGGERED! ${response.data.contactsNotified} contacts notified`);
            onSOSTriggered && onSOSTriggered(response.data);
            
            setTimeout(() => setSosActive(false), 2000);
        } catch (err) {
            setMessage(`❌ ${err.response?.data?.error || 'Failed to trigger SOS'}`);
            setSosActive(false);
        }
    };

    const handleCancel = () => {
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
        }
        setSosActive(false);
        setCountdown(null);
        setMessage('');
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 10
        }}>
            {message && (
                <div style={{
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    color: 'white',
                    padding: '12px 16px',
                    borderRadius: 8,
                    fontSize: 12,
                    maxWidth: 200,
                    textAlign: 'center'
                }}>
                    {message}
                </div>
            )}

            {!sosActive ? (
                <button
                    onClick={handleSOSClick}
                    disabled={disabled}
                    style={{
                        width: 70,
                        height: 70,
                        borderRadius: '50%',
                        backgroundColor: '#ff3333',
                        color: 'white',
                        fontSize: 32,
                        border: 'none',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 16px rgba(255,51,51,0.4)',
                        fontWeight: 'bold',
                        opacity: disabled ? 0.5 : 1,
                        transition: 'all 0.2s'
                    }}
                    title="Press to activate SOS"
                >
                    🚨
                </button>
            ) : (
                <div style={{
                    width: 90,
                    height: 90,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255,51,51,0.15)',
                    border: '3px solid #ff3333',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ff3333',
                    fontSize: 48,
                    fontWeight: 'bold',
                    position: 'relative',
                    animation: 'pulse 1s infinite'
                }}>
                    {countdown}
                    <button
                        onClick={handleCancel}
                        style={{
                            position: 'absolute',
                            bottom: -12,
                            fontSize: 11,
                            padding: '5px 12px',
                            backgroundColor: '#666',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        CANCEL
                    </button>
                </div>
            )}

            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
            `}</style>
        </div>
    );
}
