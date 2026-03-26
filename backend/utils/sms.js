/**
 * backend/utils/sms.js
 * Twilio SMS integration for emergency alerts
 */

const twilio = require('twilio');
const pool = require('../config/db');

// Initialize Twilio client with environment variables
const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '+1234567890';

/**
 * Send SOS alert SMS to emergency contact
 */
async function sendSOSAlert(phoneNumber, contactName, riderName, location, rideId) {
    try {
        if (!phoneNumber) {
            console.warn('❌ No phone number provided for SOS alert');
            return { success: false, error: 'Invalid phone number' };
        }

        const message = `🚨 EMERGENCY ALERT: ${riderName} has activated SOS in Uride Services.
Location: https://maps.google.com/?q=${location.lat},${location.lng}
Ride ID: ${rideId}
Please contact authorities if needed.
Contact ${riderName} immediately: Check app for ride details.`;

        const response = await twilioClient.messages.create({
            body: message,
            from: TWILIO_FROM_NUMBER,
            to: phoneNumber
        });

        console.log(`✅ SOS SMS sent to ${phoneNumber} (SID: ${response.sid})`);

        // Log the notification
        await pool.query(
            `INSERT INTO sos_notifications (sos_alert_id, contact_phone, contact_name, message_text, sent_at, delivery_status)
             VALUES (DEFAULT, $1, $2, $3, NOW(), 'sent')`,
            [phoneNumber, contactName, message]
        );

        return { success: true, messageSid: response.sid };
    } catch (err) {
        console.error(`❌ Failed to send SOS SMS to ${phoneNumber}:`, err.message);

        // Log the failed notification
        try {
            await pool.query(
                `INSERT INTO sos_notifications (sos_alert_id, contact_phone, contact_name, message_text, delivery_status, error_message)
                 VALUES (DEFAULT, $1, $2, $3, 'failed', $4)`,
                [phoneNumber, contactName, '', err.message]
            );
        } catch (logErr) {
            console.error('Failed to log SOS notification:', logErr.message);
        }

        return { success: false, error: err.message };
    }
}

/**
 * Send bulk SOS alerts to all emergency contacts
 */
async function sendSOSAlertsToContacts(sosAlertId, riderName, emergencyContacts, location, rideId) {
    if (!emergencyContacts || emergencyContacts.length === 0) {
        console.warn('⚠️  No emergency contacts found');
        return { sent: 0, failed: 0, results: [] };
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const contact of emergencyContacts) {
        const result = await sendSOSAlert(
            contact.phone,
            contact.name,
            riderName,
            location,
            rideId
        );

        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }

        results.push({
            contact: contact.name,
            phone: contact.phone,
            ...result
        });
    }

    console.log(`📊 SOS Alert Summary: ${successCount} sent, ${failCount} failed`);
    return { sent: successCount, failed: failCount, results };
}

module.exports = {
    sendSOSAlert,
    sendSOSAlertsToContacts
};
