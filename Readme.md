# UCab Services

UCab Services is a lightweight ride-hailing demo (ride, courier and rental flows) built with a React frontend and an Express + MongoDB backend. It demonstrates real-map routing (OpenStreetMap + OSRM), address search (Nominatim), realtime driver matching (Socket.io), and a simple JWT-based auth system for riders and captains.

This repository is a working prototype intended for learning and local LAN testing — not for production use without reviewing security, scaling, and privacy considerations.

**Contents**
- `Frontend/` — React app (map UI, booking flows, courier, rentals, captain dashboard)
- `backend/` — Express API, Socket.io server, Mongoose models

**Live demo (local)**: runs frontend on `:3000` and backend on `:5000` by default.

---

**Quick Highlights**
- Rides: immediate booking, schedule booking, and "arrive-by" reverse calculator with optional breaks
- Courier: parcel delivery with vehicle selection (bike/auto/van) and dynamic pricing
- Rentals: hourly vehicle rental (self-drive or with driver)
- Captain dashboard: online/offline toggle, incoming ride queue, trip accept/complete flows, in-app trip history and earnings
- Real maps: OpenStreetMap tiles, Nominatim for geocoding, OSRM for routing/directions
- Realtime: Socket.io vehicle-type rooms and single-accept locking for rides
- Auth: JWT for captains and riders; tokens stored in `localStorage`

---

**Tech Stack**
- Frontend: React 19, react-router-dom, react-leaflet, Leaflet, axios, socket.io-client
- Backend: Node.js (Express 5), Socket.io, Mongoose (MongoDB), bcryptjs, jsonwebtoken
- Maps/Routing: OpenStreetMap (tiles), Nominatim (search), OSRM (routing)

---

**Getting started (local)**

Prerequisites: `node` (>=18), `npm`, and a running MongoDB instance (local or remote).

1. Clone the repository (you already have it locally):

   git clone https://github.com/UTPL-ICFAI/UCAB-Services.git

2. Backend: install and configure

   cd backend
   npm install

   Create a `.env` file (example below) and set values:

   ```env
   MONGO_URI=mongodb://localhost:27017/ucab
   JWT_SECRET=your_jwt_secret_here
   PORT=5000
   ```

   Start the backend:

   ```bash
   npm run start
   # or for development with nodemon if available:
   npm run dev
   ```

3. Frontend: install and run

   cd ../Frontend
   npm install

   The frontend uses `src/config.js` which by default points to the backend at:
   `http://${window.location.hostname}:5000`

   Start the frontend:

   ```bash
   npm start
   ```

4. Open your browser to `http://localhost:3000` (or your machine IP if testing on LAN).

---

API / Socket overview

REST (examples)
- `POST /api/auth/user/login` — user login (auto-register by phone)
- `POST /api/auth/captain/register` — captain registration
- `POST /api/auth/captain/login` — captain login
- `POST /api/auth/captain/complete-ride` — complete ride (server-side earnings update)

Socket events (frontend ↔ backend)
- Client emits: `new ride request` — { pickup, dropoff, fare, distKm, duration, rideType, paymentMethod, scheduledAt }
- Client emits: `accept ride` — { rideId, captainId, captainName }
- Client emits: `captain online` — { token }
- Server emits: `new ride` — broadcast to vehicle room
- Server emits: `ride accepted`, `ride completed` — ride lifecycle

The backend saves rides in a `Ride` model that includes fields such as `scheduledAt`, `paymentMethod`, `cancellationFee`, and `cancelledBy`.

---

Data models (summary)
- `User` — { name, phone, socketId }
- `Captain` — { name, phone, passwordHash, vehicle: { type, model, plate, color }, earnings, totalRides }
- `Ride` — { pickup, dropoff, fare, rideType, status, scheduledAt, paymentMethod, cancellationFee, cancelledBy }

---

Environment / deployment notes
- In production, do not use `router.project-osrm.org` for high volume; self-host OSRM or use a paid routing provider.
- Monitor rate-limits for public Nominatim (consider running your own instance or using a geocoding provider for production).
- Secure JWT secret and database credentials. Do not commit `.env` to git (see `.gitignore`).

---

Troubleshooting
- If captains don't receive ride notifications, ensure the frontend creates the Socket.io connection after login and emits `captain online` to join the vehicle room.
- If routes are missing, check OSRM responses and CORS from the router host.

---

Contributing
- This repo is a teaching/demo project — contributions welcome. Open a PR or issue on the GitHub repo.

---

License
- MIT
