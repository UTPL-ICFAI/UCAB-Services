# 🚕 UCAB Services - Uber-like Ride Sharing Platform

> A comprehensive, production-ready ride-sharing application with real-time tracking, emergency SOS features, wallet management, and more.

![GitHub](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)
![React](https://img.shields.io/badge/React-18%2B-blue.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12%2B-336791.svg)

## 📋 Quick Navigation

- **[Quick Start Guide](./QUICK_START.md)** - Get running in 5 minutes
- **[API Documentation](./API_DOCUMENTATION.md)** - Complete API reference
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - Feature documentation
- **[Testing Guide](./TESTING_GUIDE.md)** - Test strategies
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Production deployment

---

## ✨ Key Features

### 🚗 Core Ride Services
- Multiple ride types (Go, Premier, Auto, Bike)
- Real-time driver tracking
- Scheduled rides with arrival calculator
- Bid pricing system
- Surge pricing during peak hours
- Route optimization

### 💰 Payment & Wallet
- Digital wallet with balance tracking
- Multiple payment methods (Cash, UPI, Wallet)
- Promo code integration
- Insurance add-on option
- Transaction history

### 🆘 Safety & Emergency (SOS)
- One-tap SOS emergency activation
- Emergency contact management
- SMS alerts via Twilio
- Real-time SOS alert dashboard
- Complete SOS incident history

### 🏪 Additional Services
- **Courier Service**: Package delivery with weight-based pricing
- **Rental Service**: Hourly vehicle rental with driver options
- **Support System**: Category-based complaint filing
- **Real-time Notifications**: Instant ride and support updates
- **Admin Dashboard**: Platform monitoring and control

### 🔐 Security & Admin
- JWT-based authentication
- Secure password hashing (bcrypt)
- Admin features for ride/SOS management
- Captain/driver management
- Analytics and monitoring

---

## 🚀 Quick Start
### Prerequisites
- Node.js v16+
- PostgreSQL 12+
- npm or yarn
- Twilio account (for SMS)
- Google Maps API key

### Installation (5 minutes)

```bash
# 1. Clone repository
cd UCAB-Services

# 2. Backend setup
cd backend
npm install
cat > .env << EOF
DATABASE_URL=postgresql://user:password@localhost:5432/ucab
JWT_SECRET=your_secret_key
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_FROM_NUMBER=+1234567890
NODE_ENV=development
BACKEND_PORT=4000
EOF

npm run migrate    # Run database migrations
npm start          # Start backend

# 3. Frontend setup (new terminal)
cd Frontend
npm install
cat > .env << EOF
REACT_APP_BACKEND_URL=http://localhost:4000
REACT_APP_GOOGLE_MAPS_KEY=your_maps_key
EOF

npm start          # Start frontend on port 3000
```

✅ **Application is ready at** `http://localhost:3000`

---

## 🏗️ Project Structure

```
backend/
  ├── routes/              # API endpoints
  ├── models/              # Data models
  ├── sos.routes.js        # SOS endpoints
  ├── fleet/               # Rental service
  ├── notifications/       # Real-time alerts
  ├── db/migrations/       # Database schemas
  └── server.js            # Main server

Frontend/
  ├── src/pages/           # Full pages
  ├── src/components/      # Reusable components
  └── src/config.js        # Configuration

Documentation/
  ├── QUICK_START.md       # 5-minute setup
  ├── API_DOCUMENTATION.md # Complete API reference
  ├── IMPLEMENTATION_SUMMARY.md
  ├── TESTING_GUIDE.md
  └── DEPLOYMENT_GUIDE.md
```

---

## 🛠️ Technology Stack

**Backend:**
- Node.js + Express
- PostgreSQL database
- Socket.io for real-time updates
- JWT authentication
- Twilio for SMS

**Frontend:**
- React 18
- Axios for API calls
- Socket.io-client
- Google Maps API
- CSS3 with responsive design

**DevOps:**
- Docker & Docker Compose
- Nginx
- GitHub Actions
- AWS/Cloud ready

---

## 📚 Complete Documentation

| Document | Purpose |
|----------|---------|
| [QUICK_START.md](./QUICK_START.md) | Get up and running |
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | API endpoint reference |
| [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | Feature breakdown |
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | Testing strategies |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Production deployment |

---

## 🔌 Key API Endpoints

```
Authentication
POST   /api/auth/register          Register user
POST   /api/auth/login             Login user

Rides
POST   /api/rides/book             Book a ride
GET    /api/rides/active           Get active rides
PATCH  /api/rides/:id/complete     Complete ride

Wallet
GET    /api/wallet/balance         Check balance
POST   /api/wallet/topup           Add money

SOS & Safety
GET    /api/sos/emergency-contacts Get emergency contacts
POST   /api/sos/trigger            Trigger SOS alert
GET    /api/sos/history            SOS history

Support
POST   /api/support/ticket         Create support ticket
GET    /api/support/tickets        Get tickets

Rental
POST   /api/fleet/booking          Create rental booking
PATCH  /api/fleet/booking/:id/complete Complete rental
```

Full documentation in [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

---

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test
npm run test:coverage

# Frontend tests
cd Frontend
npm test
```

See [TESTING_GUIDE.md](./TESTING_GUIDE.md) for detailed testing strategies.

---

## 🚀 Deployment

**Quick Docker deployment:**
```bash
docker-compose up -d
```

**AWS/Cloud deployment:**
See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for:
- EC2 setup
- RDS database
- Nginx configuration
- SSL certificates
- Automated backups
- CI/CD pipeline

---

## 🆘 SOS Emergency System

The application includes a comprehensive emergency SOS system:

### Features
- ✅ One-tap SOS activation during rides
- ✅ Manage up to 5 emergency contacts
- ✅ Automatic SMS alerts via Twilio
- ✅ Real-time admin SOS dashboard
- ✅ Complete incident history
- ✅ Live location sharing

### How it works
1. User adds emergency contacts in Settings
2. During a ride, user taps SOS button
3. SMS alerts sent to all emergency contacts
4. Admin receives real-time notification
5. User can cancel SOS anytime

---

## 💰 Wallet System

- Add funds with promo codes
- View transaction history
- Use wallet for ride payments
- Multiple payment methods
- Real-time balance updates

---

## 🔐 Security Features

✅ JWT authentication
✅ Password hashing (bcrypt)
✅ SQL injection prevention
✅ CORS protection
✅ Input validation
✅ Authorization checks
✅ HTTPS/TLS support
✅ SOS ownership verification

---

## 🐛 Troubleshooting

**SOS SMS not sending?**
- Check Twilio credentials in .env
- Verify phone format: +919876543210
- Check Twilio balance

**Backend won't start?**
- Verify PostgreSQL is running
- Check DATABASE_URL
- Run migrations: `npm run migrate`

**Frontend can't connect?**
- Verify backend running on port 4000
- Check REACT_APP_BACKEND_URL
- Check browser console errors

---

## 📊 Database Schema

Main tables:
- `users` - User accounts
- `rides` - Ride bookings
- `captains` - Driver profiles
- `sos_alerts` - Emergency alerts
- `support_tickets` - Support complaints
- `fleet_vehicles` - Rental inventory
- `wallet_transactions` - Payment history

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/YourFeature`)
3. Commit changes (`git commit -m 'Add YourFeature'`)
4. Push to branch (`git push origin feature/YourFeature`)
5. Open a Pull Request

**Code Standards:**
- Follow existing style
- Add tests for features
- Update documentation
- Ensure all tests pass

---

## 📄 License

MIT License - see LICENSE file for details.

---

## 📞 Support

- 📚 **Documentation**: See links above
- 🐛 **Issues**: GitHub Issues
- 💬 **Discussions**: GitHub Discussions
- 📧 **Email**: support@ucab.com

---

## 🎉 Status

**Production Ready** ✅

- Core features complete
- Security implemented
- Testing framework ready
- Deployment guides provided
- Documentation comprehensive

Last updated: January 2024

---

**Built with ❤️ for seamless ride-sharing** 🚀

---

Contributing
- This repo is a teaching/demo project — contributions welcome. Open a PR or issue on the GitHub repo.

---

License
- MIT
# Deployment trigger commit
