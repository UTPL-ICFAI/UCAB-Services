/// API Configuration Constants — all backend endpoints
library;

class ApiConstants {
  ApiConstants._();

  /// Backend URL — Render-hosted production server
  static const String baseUrl = 'https://ucab-services.onrender.com';

  // ── Auth ────────────────────────────────────────────────────
  static const String userLogin = '/api/auth/user/login';
  static const String userRegister = '/api/auth/user/register';
  static const String userSendOtp = '/api/auth/user/send-otp';
  static const String userVerifyOtp = '/api/auth/user/verify-otp';
  static const String captainLogin = '/api/auth/captain/login';
  static const String captainRegister = '/api/auth/captain/register';

  // ── Trips / History ─────────────────────────────────────────
  static const String userTrips = '/api/auth/user/trips';
  static const String captainTrips = '/api/auth/captain/trips';

  // ── Nearby Captains ─────────────────────────────────────────
  static const String nearbyCaptains = '/api/auth/captains/nearby';

  // ── Surge Pricing ───────────────────────────────────────────
  static const String surge = '/api/rides/surge';

  // ── Loyalty & Profile ───────────────────────────────────────
  static const String userLoyalty = '/api/auth/user/loyalty';
  static const String captainPhoto = '/api/auth/captain/photo';

  // ── Saved Places ────────────────────────────────────────────
  static const String savedPlaces = '/api/auth/user/saved-places';

  // ── Emergency Contacts ──────────────────────────────────────
  static const String emergencyContacts = '/api/auth/user/emergency-contacts';

  // ── Wallet ──────────────────────────────────────────────────
  static const String walletBalance = '/api/wallet/balance';
  static const String walletTopup = '/api/wallet/topup';
  static const String walletHistory = '/api/wallet/history';

  // ── SOS ─────────────────────────────────────────────────────
  static const String sosTrigger = '/api/sos/trigger';
  static const String sosHistory = '/api/sos/history';

  // ── Support ─────────────────────────────────────────────────
  static const String supportTicket = '/api/support/ticket';
  static const String supportTickets = '/api/support/tickets';

  // ── Carpool ─────────────────────────────────────────────────
  static const String carpoolOffers = '/api/carpool/offers';
  static const String carpoolCreate = '/api/carpool/offer';

  // ── Notifications ───────────────────────────────────────────
  static const String notifications = '/api/notifications';

  // ── Fleet / Rental ──────────────────────────────────────────
  static const String fleetBooking = '/api/fleet/booking';

  // ── Health ──────────────────────────────────────────────────
  static const String health = '/health';
}
