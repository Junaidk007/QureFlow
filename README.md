# QureFlow — Real-Time Clinic Queue & Smart OPD Management System

> A modern, zero-ghost-queue outpatient department (OPD) platform providing real-time queue tracking, physical QR arrival validation, dynamic rolling ETAs, and cross-role synchronization across Patients, Doctors, and Receptionists.

---

## ❄️ Architecture & Highlights

- **Anti-Ghost Queue Integrity:** Pre-booked appointments never clog live queues. Tokens (`#A-1`, `#A-2`, etc.) are minted strictly upon physical clinic arrival (QR scan or reception manual override).
- **Sub-Second Synchronization:** Real-time state replication powered by native WebSockets (`ws`) partitioned into room channels (`clinic:{id}`, `doctor:{id}`, `patient:{id}`).
- **Adaptive Rolling ETA Engine:** Continuously recalculates estimated consultation ranges based on rolling 5-visit moving averages and active doctor break states.
- **Winter Arctic Frost Design System:** Built with pure Custom CSS tokens (`#071629`, `#17345C`, `#9DB7D5`, `#EAF4FF`, `#FFFFFF`), strict 8px unified border radius, Framer Motion micro-interactions, and WCAG AAA compliance.
- **Enterprise-Grade Backend Standards:** Centralized error handling (`ApiError`), standardized response envelope (`ApiResponse`), and unified controller wrappers (`wrapAsync`).

---

## 🛠️ Tech Stack

### Frontend (`client/`)
- **Core:** React 19, Vite
- **Styling:** Pure Custom CSS Design System (no Tailwind per project requirements)
- **Motion & Interactions:** Framer Motion
- **Icons & QR:** Lucide React, `html5-qrcode`
- **Routing & State:** React Router DOM v7, React Context (`AuthContext`), custom hooks (`useWebSocket`)

### Backend (`server/`)
- **Runtime & Framework:** Node.js, Express 5
- **Real-Time Layer:** Native WebSocket (`ws`) with heartbeat pings and auto-reconnect
- **Database & ODM:** MongoDB with Mongoose 9
- **Validation & Security:** Joi schema validation, JWT auth (30-day patient / 12-hour staff session expiration), Helmet, CORS, Express Rate Limit
- **Testing:** Custom zero-dependency automated verification test suites

---

## 📂 Project Structure

```
mediQ/
├── client/                     # React + Vite Frontend
│   ├── src/
│   │   ├── api/                # Standardized fetch wrapper with JWT interceptor
│   │   ├── components/         # ProtectedRoute, Modals, Shared UI
│   │   ├── context/            # AuthContext (cross-role session management)
│   │   ├── hooks/              # useWebSocket (auto-reconnect, room pub/sub)
│   │   ├── pages/
│   │   │   ├── Auth/           # Screen 01: Dual Patient / Staff Auth Gateway
│   │   │   ├── PatientHome/    # Screen 02: Dynamic Patient Home Dashboard
│   │   │   ├── Booking/        # Screen 03: Specialist Discovery & Slot Booking
│   │   │   ├── CheckIn/        # Screen 04: Arrival QR Scanner & PIN Check-In
│   │   │   ├── Queue/          # Screen 05: Real-Time Live Queue Tracker
│   │   │   ├── Reception/      # Screen 06: Reception Live Table & Walk-Ins
│   │   │   └── Doctor/         # Screen 07: Doctor Consultation & Vitals Desk
│   │   ├── index.css           # Global Arctic Frost design tokens & styles
│   │   └── App.jsx             # Role-based route definitions
│   └── package.json
│
├── server/                     # Node.js + Express Backend
│   ├── src/
│   │   ├── config/             # MongoDB connection (connectDB)
│   │   ├── controllers/        # auth, doctor, appointment, visit controllers
│   │   ├── middleware/         # authMiddleware, roleGuard, validate, errorHandler
│   │   ├── models/             # Clinic, User, Appointment, Visit Mongoose schemas
│   │   ├── routes/v1/          # REST API route endpoints
│   │   ├── services/           # etaEngine, tokenMinter, sessionService, wsService
│   │   ├── utils/              # ApiError, ApiResponse, wrapAsync
│   │   ├── validators/         # Joi validation schemas
│   │   └── scripts/            # Database seeders (seedClinic.js, seedUsers.js)
│   ├── tests/                  # Automated verification test suites (Phases 1–7)
│   └── package.json
│
├── design/                     # HTML/CSS interactive UI prototypes (Screens 1–7)
├── docs/                       # Architecture, style guide, API, and workflow docs
├── IMPLEMENTATION.md           # Phase-wise MVP delivery tracking
└── README.md                   # Project overview & documentation
```

---

## 🚀 Quick Start & Setup Guide

### 1. Prerequisites
- **Node.js** >= 18.0.0
- **MongoDB** running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas connection string.

---

### 2. Backend Setup (`server/`)

1. Open a terminal and navigate to `server/`:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `server/.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   MONGO_URI=mongodb://127.0.0.1:27017/qureflow
   JWT_SECRET=qureflow_super_secret_jwt_key_2026_dev_env
   CLIENT_URL=http://localhost:5173
   ```

4. Seed the database with the default clinic and demo accounts:
   ```bash
   npm run seed
   ```

5. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The server starts on `http://localhost:5000` with WebSocket listening on `ws://localhost:5000`.*

---

### 3. Frontend Setup (`client/`)

1. In a separate terminal, navigate to `client/`:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `client/.env`:
   ```env
   VITE_API_URL=http://localhost:5000/api/v1
   VITE_WS_URL=ws://localhost:5000
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   *The client will be running at `http://localhost:5173`.*

---

## 🔑 Demo Seed Accounts

After running `npm run seed` in `server/`, the following accounts are immediately available:

| Role | Name | Email / Username | Password | Notes / Context |
| :--- | :--- | :--- | :--- | :--- |
| **Doctor** | Dr. Sarah Jenkins | `doctor@qureflow.com` | `password123` | Cardiology & General Medicine (Cabin 02) |
| **Doctor** | Dr. Michael Chen | `chen@qureflow.com` | `password123` | Pediatrics & Family Medicine |
| **Receptionist** | Mark Davies | `reception@qureflow.com` | `password123` | City Central Health Clinic |
| **Patient** | John Doe | `john@example.com` or `johndoe` | `password123` | Registered Patient |

> *Tip: You can also register new patient accounts on the fly via Screen 01 (`/auth`).*

---

## 🖥️ Screen Overview & Core User Flows

```
[1. Auth Gateway]  ──(Login)──► [2. Patient Home] ──(Book)──► [3. Slot Booking]
                                       │
                                (Arrival QR Scan)
                                       ▼
 [6. Reception Console] ◄── [4. Check-In & Token] ──► [5. Live Queue Tracker]
            │                                                      ▲
      (Add Walk-In)                                         (Real-Time Sync)
            │                                                      │
            └────────────► [7. Doctor Clinical Desk] ──────────────┘
```

1. **Screen 01: Auth Gateway (`/auth`):**
   - Dual-tab interface for Patients (username or email login + registration) and Staff (email + clinic + role selection).
   - Password strength indicator, visibility toggles, auto-session persistence.

2. **Screen 02: Patient Home Dashboard (`/dashboard`):**
   - Context-aware Active State Card: adapts automatically between *No Visits*, *Upcoming Confirmed Appointment*, or *Live Queue Tracker* card.
   - Quick Actions: Book Appointment, QR Check-In, Emergency Hotline.
   - Specialists carousel and health tips.

3. **Screen 03: Specialist Discovery & Slot Booking (`/book`):**
   - 7-day horizontal calendar strip with real-time day selection.
   - Specialist picker with cabin tags and availability badges.
   - Morning/Afternoon slot grid with collision prevention (`409 SLOT_ALREADY_TAKEN`).
   - Sticky summary bar & booking confirmation modal.

4. **Screen 04: Physical QR Check-In (`/checkin`):**
   - Real-time video viewfinder with animated laser scan guide.
   - Anti-ghost arrival window validation (opens 15m before slot, closes 15m after).
   - Instant camera scanner + manual PIN check-in fallback.
   - Token minting modal displaying sequential token ID (e.g., `#A-17`).

5. **Screen 05: Live Queue Tracker (`/queue`):**
   - Token Hero card with pulse animation and doctor cabin info.
   - 3-metric live cluster: Patients Ahead, Estimated Wait Range, Currently Serving Token.
   - 5-step animated progress stepper.
   - Proximity Alert Banner (slides in when 1 patient remains ahead).
   - Fullscreen "It's Your Turn!" dialog with audio chime when called into cabin.

6. **Screen 06: Reception Desk Console (`/reception`):**
   - 4 live KPI aggregate cards (Waiting in Lobby, In Consultation, Completed Today, No-Shows).
   - Doctor filter tabs with active count badges.
   - Live Master Queue table with instant search and priority badges.
   - Walk-in registration modal (supports urgent triage injection at top of queue).
   - Instant actions: Toggle Priority, Mark No-Show, Cancel, Manual Check-In.

7. **Screen 07: Doctor Consultation & Vitals Desk (`/doctor`):**
   - Active encounter banner with live elapsed consultation timer (turns amber if >20 mins).
   - Concurrency Guard: Enforces strictly one active consultation at a time.
   - Rapid vitals entry grid: Blood Pressure (`mmHg`), Blood Sugar (`mg/dL`), Body Weight (`kg`), and consultation diagnosis notes.
   - Sticky Up-Next patient queue with urgent walk-in tags.
   - Primary action: *"Complete Consult & Call Next (#Token) →"*.
   - Doctor break mode toggle (`Available` vs `On 15m Break`).

---

## 🧪 Automated Testing

All phases include comprehensive end-to-end integration tests covering database schemas, validation guards, state transitions, and real-time WebSocket events.

To run the complete test suite:

```bash
cd server
npm test
```

The test runner will sequentially execute:
1. `tests/verifyPhase1.js` — Mongoose models, Joi validators, JWT sessions, ETA calculation, HTTP health, and WebSocket pub/sub.
2. `tests/verifyPhase2And3.js` — User registration, dual-role auth, doctor discovery, slot availability, and booking collision guard.
3. `tests/verifyPhase4And5.js` — QR check-in, token minting, anti-ghost arrival windows, reception walk-ins, priority toggle, and KPI aggregates.
4. `tests/verifyPhase6And7.js` — Doctor queue loading, consultation start, concurrency guard, vitals logging, doctor break toggle, and multi-role real-time synchronization.

---

## 📦 Production Build

To verify and build the frontend client:

```bash
cd client
npm run build
```

The production bundle will be generated in `client/dist` in under a second with zero lint errors or warnings.
