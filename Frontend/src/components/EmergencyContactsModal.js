/**
 * Frontend/src/components/EmergencyContactsModal.js
 * Manage emergency contacts for SOS
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = require('../config').default;

export function EmergencyContactsModal({ userId, onClose }) {
    const [contacts, setContacts] = useState([]);
    const [newContact, setNewContact] = useState({ name: '', phone: '', relation: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async () => {
        try {
            const token = localStorage.getItem('ucab_token');
            const response = await axios.get(
                `${BACKEND_URL}/api/sos/emergency-contacts`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setContacts(response.data.contacts || []);
        } catch (err) {
            console.error('Failed to fetch contacts:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddContact = () => {
        if (!newContact.name || !newContact.phone) {
            setMessage('❌ Name and phone are required');
            return;
        }

        const updatedContacts = [...contacts, newContact];
        setContacts(updatedContacts);
        setNewContact({ name: '', phone: '', relation: '' });
        setMessage('✅ Contact added');
    };

    const handleRemoveContact = (index) => {
        setContacts(contacts.filter((_, i) => i !== index));
        setMessage('✅ Contact removed');
    };

    const handleSaveContacts = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('ucab_token');
            await axios.post(
                `${BACKEND_URL}/api/sos/emergency-contacts`,
                { contacts },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage('✅ Emergency contacts saved');
            setTimeout(onClose, 1500);
        } catch (err) {
            setMessage(`❌ ${err.response?.data?.error || 'Failed to save'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 24,
                maxWidth: 500,
                maxHeight: '80vh',
                overflow: 'auto',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}>
                <h3 style={{ marginTop: 0 }}>🚨 Emergency Contacts</h3>
                <p style={{ fontSize: 13, color: '#666' }}>
                    Add people to be notified when you trigger SOS
                </p>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>Loading...</div>
                ) : (
                    <>
                        {/* Existing Contacts */}
                        <div style={{ marginBottom: 20 }}>
                            {contacts.length === 0 ? (
                                <div style={{ 
                                    padding: 16, 
                                    backgroundColor: '#f0f0f0', 
                                    borderRadius: 8, 
                                    color: '#666', 
                                    fontSize: 13,
                                    textAlign: 'center'
                                }}>
                                    No emergency contacts yet
                                </div>
                            ) : (
                                contacts.map((contact, idx) => (
                                    <div key={idx} style={{
                                        backgroundColor: '#f9f9f9',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: 8,
                                        padding: 12,
                                        marginBottom: 8,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div>
                                            <strong style={{ fontSize: 14 }}>{contact.name}</strong>
                                            <br />
                                            <span style={{ fontSize: 12, color: '#666' }}>
                                                {contact.phone}
                                                {contact.relation && ` (${contact.relation})`}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveContact(idx)}
                                            style={{
                                                backgroundColor: '#ff6b6b',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: 4,
                                                padding: '6px 12px',
                                                cursor: 'pointer',
                                                fontSize: 12,
                                                fontWeight: 600
                                            }}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add New Contact */}
                        <div style={{
                            backgroundColor: '#f5f5f5',
                            borderRadius: 8,
                            padding: 16,
                            marginBottom: 16
                        }}>
                            <h4 style={{ marginTop: 0, fontSize: 14 }}>Add Contact</h4>
                            <input
                                type="text"
                                placeholder="Name"
                                value={newContact.name}
                                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 10,
                                    marginBottom: 8,
                                    borderRadius: 6,
                                    border: '1px solid #ddd',
                                    fontSize: 13,
                                    boxSizing: 'border-box'
                                }}
                            />
                            <input
                                type="tel"
                                placeholder="Phone (e.g., +919876543210)"
                                value={newContact.phone}
                                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 10,
                                    marginBottom: 8,
                                    borderRadius: 6,
                                    border: '1px solid #ddd',
                                    fontSize: 13,
                                    boxSizing: 'border-box'
                                }}
                            />
                            <input
                                type="text"
                                placeholder="Relation (e.g., Mother, Friend)"
                                value={newContact.relation}
                                onChange={(e) => setNewContact({ ...newContact, relation: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: 10,
                                    marginBottom: 8,
                                    borderRadius: 6,
                                    border: '1px solid #ddd',
                                    fontSize: 13,
                                    boxSizing: 'border-box'
                                }}
                            />
                            <button
                                onClick={handleAddContact}
                                style={{
                                    width: '100%',
                                    padding: 10,
                                    backgroundColor: '#4CAF50',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: 13
                                }}
                            >
                                ➕ Add Contact
                            </button>
                        </div>

                        {message && (
                            <div style={{
                                backgroundColor: message.includes('❌') ? '#ffebee' : '#e8f5e9',
                                color: message.includes('❌') ? '#c62828' : '#2e7d32',
                                padding: 12,
                                borderRadius: 6,
                                fontSize: 12,
                                marginBottom: 12,
                                textAlign: 'center'
                            }}>
                                {message}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button
                                onClick={handleSaveContacts}
                                disabled={saving || contacts.length === 0}
                                style={{
                                    flex: 1,
                                    padding: 12,
                                    backgroundColor: contacts.length === 0 ? '#ccc' : '#2196F3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: contacts.length === 0 ? 'not-allowed' : 'pointer',
                                    fontWeight: 600,
                                    fontSize: 13
                                }}
                            >
                                {saving ? 'Saving...' : '💾 Save Contacts'}
                            </button>
                            <button
                                onClick={onClose}
                                style={{
                                    flex: 1,
                                    padding: 12,
                                    backgroundColor: '#f0f0f0',
                                    color: '#333',
                                    border: 'none',
                                    borderRadius: 8,
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: 13
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
