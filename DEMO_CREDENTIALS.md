# 🎯 UCAB Services - Demo Credentials & Setup Guide

## 📋 Demo Credentials

### 1. **Support Team Login** 
**Role:** Customer Support Dashboard

**Credentials:**
```
Username: test
Password: test
```

**Access:** 
- URL: `https://uride-services.vercel.app/login/support`
- Click "I'm in Support Team" on landing page
- Enter credentials above

**Features Available:**
- 🎟️ **Tickets Tab** - View and manage support tickets from riders/captains
  - Filter by status (open, in_review, resolved, closed)
  - Update ticket status with admin notes
  - Pagination support

- 📊 **Live Traffic Tab** - Real-time ride statistics
  - Total rides in last 24 hours
  - Ongoing rides count
  - Carpool/Courier breakdown
  - Average fares

- 📈 **Database Stats Tab** - System overview
  - Total registered users
  - Total registered captains
  - Total registered vehicles
  - Rides in last 30 days
  - Open support tickets
  - Fleet owners vs Rental providers

---

### 2. **Rental Owner Login**
**Role:** Fleet/Rental Provider

**Credentials:**
```
Email: rentalowner@demo.com
Password: demo123
Name: Demo Rental Provider
Phone: +91-98765-43210
Company: Demo Rentals
```

**Access:**
- URL: `https://uride-services.vercel.app/login/rental`
- Click "I'm a Rental Provider" on landing page
- Enter email/password above

**Available Vehicles:**
1. **Hatchback** (🚗)
   - Model: Hyundai i20
   - Rate: ₹150/hour
   - Features: AC, Power Steering, Airbags

2. **Sedan** (🚙)
   - Model: Maruti Swift
   - Rate: ₹200/hour
   - Features: AC, Bluetooth, Touchscreen

3. **SUV** (🚕)
   - Model: Mahindra XUV
   - Rate: ₹300/hour
   - Features: 4WD, Sunroof, Cruise Control

4. **Bike** (🏍️)
   - Model: Honda CB Shine
   - Rate: ₹80/hour
   - Features: Fuel Efficient, LED Lights

5. **Scooter** (🛵)
   - Model: Vespa
   - Rate: ₹60/hour
   - Features: Easy to Ride, Fuel Efficient

**Rental Owner Features:**
- View pending booking requests from riders
- Accept/reject rental bookings
- Set pickup location when accepting booking
- Communicate with riders
- Track rental bookings history

---

### 3. **Test User (Rider) Credentials**

**Credentials:**
```
Phone: 9876543210
Password: password123
```

**Access:**
- URL: `https://uride-services.vercel.app/login/user`
- Click "I'm a Rider" on landing page

**Available Services:**
- 🚗 Ride booking (carpool, regular rides)
- 📦 Courier delivery
- 🔑 Vehicle rental (uses demo rental provider above)
- 📱 Carpool rides

**Rental Booking Flow:**
1. Navigate to Rental tab
2. Select a vehicle from available rentals
3. Choose duration (1-24 hours)
4. Optionally add "With Driver" (+₹100)
5. Set your pickup location
6. Click "Rent" button
7. Wait for rental owner acceptance
8. After acceptance, set your return location
9. Booking confirmed with all locations visible

---

### 4. **Test Captain (Driver) Credentials**

**Credentials:**
```
Phone: 9876543211
Password: password123
```

**Access:**
- URL: `https://uride-services.vercel.app/login/captain`
- Click "I'm a Captain" on landing page

**Captain Features:**
- Accept ride requests
- Real-time earnings tracking
- Trip history & statistics
- Wallet management
- Rating & reviews

---

## 🌐 Render Deployment

**Live URL:** `https://uride-services.vercel.app`

**Backend API:** `https://ucab-services.onrender.com` (or configured BACKEND_URL)

### Configuration:
- Frontend: Deployed on Vercel
- Backend: Deployed on Render
- Database: PostgreSQL on Render

### Environment Variables (Backend on Render):
```
DATABASE_URL=postgresql://...
JWT_SECRET=ucab_secret_2026
PORT=5000
NODE_ENV=production
```

---

## 🚀 Quick Start Demo Flow

### **Demo 1: Support Team Dashboard**
1. Go to home page
2. Click "I'm in Support Team"
3. Enter `test` / `test`
4. Explore three tabs:
   - View sample tickets
   - Check live traffic stats
   - See database metrics

### **Demo 2: Rental Booking**
1. Login as Rider (9876543210 / password123)
2. Go to Rental tab
3. Select vehicle (e.g., Hatchback)
4. Set pickup location
5. Observe pending acceptance status
6. Click "Simulate Accept" (demo feature)
7. Set return location
8. Confirm booking

### **Demo 3: Rental Owner Acceptance**
1. Future: Rental owner logs in (rentalowner@demo.com / demo123)
2. Views pending rental requests
3. Accepts booking and sets their pickup location
4. Rider gets notified and sets exit point
5. Both can track each other's locations

---

## 📱 Available Test Phones

For testing multiple roles, use these phone numbers:

```
Rider 1:     9876543210 (password123)
Rider 2:     9876543212 (password123)
Captain 1:   9876543211 (password123)
Captain 2:   9876543213 (password123)
```

All use same password: `password123`

---

## 🔒 Security Notes

- ✅ Demo credentials only work in demo environment
- ✅ All passwords hashed in database
- ✅ JWT tokens expire after 24 hours
- ✅ Support team routes protected by auth middleware
- ✅ Rental owner routes require fleet_owner token

---

## 📞 Support Team Dashboard Capabilities

### Ticket Management
- **Status Workflow:** Open → In Review → Resolved → Closed
- **Admin Notes:** Add notes to tickets visible to users
- **Categories:** General, Payment, Safety, Driver Quality, Vehicle Issues, etc.
- **Pagination:** View 20 tickets per page

### Live Traffic Stats (24-hour)
- Total active rides
- Ongoing vs searching rides
- Ride type breakdown
- Average fare calculations
- Minimal resource usage (just aggregates)

### Database Overview
- User/Captain/Vehicle counts
- Historical ride data (30 days)
- Business metrics
- Quick system health check

---

## 🎨 UI Features

Both dashboards feature:
- 🌙 Dark mode with glassmorphism effects
- 📊 Professional data visualization
- ⚡ Real-time updates
- 📱 Responsive design for mobile
- 🎯 Intuitive navigation
- 🔔 Toast notifications for actions

---

## 🐛 Troubleshooting

**Support Team Login shows "Invalid credentials":**
- ✅ FIXED: Now supports demo credentials (test/test) without database
- Ensure you're using exactly: `test` and `test`

**Rental booking not visible:**
- Try logging in as rider: 9876543210 / password123
- Navigate to "Rental" tab in UserPage
- Select vehicle and location

**API errors on Render:**
- Check BACKEND_URL in `Frontend/src/config.js`
- Ensure Render backend is running
- Check network connectivity

---

## 📚 API Endpoints

### Support Team
```
POST   /api/support-team/login
GET    /api/support-team/tickets
GET    /api/support-team/ticket/:id
PUT    /api/support-team/ticket/:id/status
GET    /api/support-team/live-rides
GET    /api/support-team/stats
GET    /api/support-team/demo-credentials
```

### Rental Bookings
```
POST   /api/rental/booking
GET    /api/rental/booking/:id
PUT    /api/rental/booking/:id/accept
PUT    /api/rental/booking/:id/reject
PUT    /api/rental/booking/:id/dropoff
GET    /api/rental/bookings
GET    /api/rental/demo-credentials
```

---

## ✅ Last Updated
- **Commit:** 0466573
- **Branch:** main
- **Date:** March 23, 2026
