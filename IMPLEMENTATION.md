# QureFlow MVP — Project Implementation Plan

> **Platform:** Real-Time Clinic Queue Management System  
> **Stack:** React + shadcn/ui (Frontend) · Node.js + Express + `ws` (Backend) · MongoDB + Mongoose (Database)  
> **Auth:** Email/Username + Password → JWT (no OTP, no SMS)  
> **Deployment:** Vercel (Frontend) · Railway / Render (Backend) · MongoDB Atlas (Database)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT TIER                               │
│  Patient App (Mobile)   Reception Console   Doctor Desk         │
│  Screens 01–05          Screen 06            Screen 07          │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/REST + WebSocket (ws)
┌────────────────────────────▼────────────────────────────────────┐
│                     BACKEND TIER                                │
│  Express Router → AuthMiddleware → RoleGuard → JoiValidation   │
│        → Controllers → Mongoose ODM → MongoDB Atlas            │
│        → WebSocket Server (ws) → Room Broadcasts               │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    DATABASE TIER                                │
│  Collections: users · appointments · visits · clinics           │
└─────────────────────────────────────────────────────────────────┘
```

---

## State Machine (Core Loop)

```
[Patient Books]      → BOOKED
[QR Check-In]        → CHECKED_IN → IN_QUEUE  (token minted)
[Walk-In Added]      → IN_QUEUE               (token minted, appointmentId: null)
[Doctor Starts]      → CHECK_UP               (consultStartedAt recorded)
[Doctor Completes]   → DONE                   (vitals + consultEndedAt recorded)
[Reception Flags]    → NO_SHOW / CANCELLED
```

---

## Phase-Wise Implementation

---

## Phase 0 — Project Scaffolding & DevOps Setup
**Duration:** Day 1–2  
**Goal:** Establish a working monorepo with environment configs, linting, and CI pipeline.

### 0.1 Repository Structure
```
mediQ/
├── client/                  # React frontend (Vite)
│   ├── src/
│   │   ├── components/      # shadcn/ui base components
│   │   ├── contexts/        # AuthContext, QueueContext
│   │   ├── hooks/           # useWebSocket, useQueue, useAuth
│   │   ├── pages/           # One folder per screen
│   │   ├── lib/             # api.js, ws.js, utils.js
│   │   └── index.css        # CSS custom properties (Arctic Frost tokens)
│   └── .env                 # VITE_API_URL, VITE_WS_URL
├── server/                  # Node.js + Express backend
│   ├── src/
│   │   ├── controllers/     # auth, appointment, visit, queue, doctor
│   │   ├── middleware/       # auth.js, roleGuard.js, validate.js
│   │   ├── models/          # User, Appointment, Visit, Clinic
│   │   ├── routes/          # v1 router
│   │   ├── services/        # etaEngine.js, tokenMinter.js, wsService.js
│   │   └── app.js           # Express + ws bootstrap
│   └── .env                 # MONGO_URI, JWT_SECRET, PORT
├── docs/                    # (existing documentation)
├── design/                  # (existing HTML prototypes)
└── IMPLEMENTATION.md        # (this file)
```

### 0.2 Tooling
- [x] Initialize Vite React project (`npx create-vite@latest client --template react`)
- [x] Initialize Express project in `server/` with `nodemon`
- [x] Configure ESLint + Prettier for both workspaces
- [x] Set up MongoDB cluster and seed `clinics` collection with 1 test clinic
- [x] Set up `.env` files for both client and server

### 0.3 Design Token Setup
- [x] Copy Arctic Frost CSS custom properties from `style-guide.md` into `client/src/index.css`
- [x] Install Google Fonts: `Plus Jakarta Sans` + `Inter`
- [x] Install Lucide React icons
- [x] Configure Custom CSS with Arctic Frost tokens and Framer Motion ready

**Deliverables:**
- Running `npm run dev` on both client and server
- MongoDB Atlas connected and pingable
- Arctic Frost CSS tokens applied globally
- shadcn/ui components installed (Button, Card, Input, Badge, Dialog, Sheet, Tabs, Table, Select, Skeleton, Toast)

---

## Phase 1 — Database Models & Core Backend Infrastructure
**Duration:** Day 3–5  
**Goal:** All Mongoose models, JWT auth infrastructure, and WebSocket server running.

### 1.1 Mongoose Models

#### `Clinic` Model
```js
{
  name: String,
  address: String,
  checkInWindowStartMinutes: Number,  // default: 15
  checkInWindowEndMinutes: Number     // default: 15
}
```

#### `User` Model
```js
{
  role: { type: String, enum: ['PATIENT', 'DOCTOR', 'RECEPTIONIST'] },
  name: String,
  username: String,      // unique, patients only (alphanum + underscore)
  email: String,         // unique
  passwordHash: String,  // bcrypt, saltRounds: 12
  clinicId: ObjectId,    // ref: Clinic (staff only)
  specialization: String,// doctors only
  availability: {
    status: { type: String, enum: ['AVAILABLE', 'ON_BREAK'], default: 'AVAILABLE' },
    breakUntil: Date
  },
  createdAt: { type: Date, default: Date.now }
}
```

#### `Appointment` Model
```js
{
  patientId: ObjectId,       // ref: User
  doctorId: ObjectId,        // ref: User
  clinicId: ObjectId,        // ref: Clinic
  appointmentDate: String,   // YYYY-MM-DD
  appointmentTime: String,   // HH:mm
  type: { type: String, enum: ['NEW', 'FOLLOW-UP'] },
  status: { type: String, enum: ['BOOKED', 'CANCELLED'], default: 'BOOKED' },
  createdAt: { type: Date, default: Date.now }
}
```

#### `Visit` Model
```js
{
  appointmentId: ObjectId,   // ref: Appointment (nullable for walk-ins)
  patientId: ObjectId,       // ref: User
  doctorId: ObjectId,        // ref: User
  clinicId: ObjectId,        // ref: Clinic
  visitDate: String,         // YYYY-MM-DD
  tokenId: String,           // e.g. "A-17"
  status: {
    type: String,
    enum: ['CHECKED_IN', 'IN_QUEUE', 'CHECK_UP', 'DONE', 'NO_SHOW', 'CANCELLED']
  },
  isUrgent: { type: Boolean, default: false },
  checkedInAt: Date,
  consultStartedAt: Date,
  consultEndedAt: Date,
  vitals: { bp: String, sugar: Number, weight: Number },
  notes: String
}
```

### 1.2 Middleware Stack
- [ ] **`authMiddleware.js`** — Verifies JWT (`jsonwebtoken`), attaches `req.user = { sub, role, clinicId }`
- [ ] **`roleGuard.js`** — Factory: `roleGuard('DOCTOR')`, `roleGuard('RECEPTIONIST')`
- [ ] **`validate.js`** — Wraps Joi schemas, returns `400 VALIDATION_ERROR` with field-level details

### 1.3 Joi Validation Schemas
- [ ] `registerSchema` — `{ name, username, email, password }`
- [ ] `loginSchema` — `{ identifier, password, clinicId?, role? }`
- [ ] `appointmentSchema` — `{ doctorId, clinicId, appointmentDate, appointmentTime, type }`
- [ ] `checkInSchema` — `{ clinicId, appointmentId }`
- [ ] `walkInSchema` — `{ clinicId, patientName, phone, doctorId, type, isUrgent }`
- [ ] `completeSchema` — `{ vitals: { bp, sugar, weight }, notes? }`

### 1.4 WebSocket Server (`ws`)
- [ ] Attach `ws.Server` to the HTTP server
- [ ] Implement room-based pub/sub:
  - `clinic:{clinicId}` — reception + all patients in that clinic
  - `doctor:{doctorId}` — doctor desk + all patients of that doctor
  - `patient:{userId}` — individual patient targeted alerts
- [ ] JWT validation on WS handshake (`?token=<jwt>`)
- [ ] Helper: `wsService.emit(room, event, payload)`
- [ ] Event catalogue:
  - `QUEUE_UPDATED` — broadcasted on any queue change
  - `VISIT_CALLED` — targeted to individual patient on `CHECK_UP`
  - `VISIT_COMPLETED` — targeted to patient on `DONE`
  - `DOCTOR_STATUS_CHANGED` — broadcasted on break/resume

### 1.5 Core Services
- [ ] **`tokenMinter.js`** — `mintToken(doctorId, visitDate)` → counts today's visits → returns `"A-{n}"`
- [ ] **`etaEngine.js`** — `computeETA(doctorId, visitDate, visit)` → returns `{ minMinutes, maxMinutes }`
  - Fetches patients ahead count
  - Fetches rolling avg from last 5 `DONE` visits
  - Adds remaining active consult time
- [ ] **`sessionService.js`** — `signJWT(user)`, `verifyJWT(token)`

**Deliverables:**
- All 4 Mongoose models with indexes (email, username, doctorId+visitDate+status)
- Auth + role middleware tested via Postman/Thunder Client
- WebSocket server accepting connections and routing to rooms
- Token minter and ETA engine unit-tested with sample data

---

## Phase 2 — Authentication APIs & Screen 01 (Auth Gateway)
**Duration:** Day 6–8  
**Goal:** Full auth flow working end-to-end with Screen 01 (Auth Gateway) connected to live backend.

### 2.1 Backend — Auth Endpoints

#### `POST /api/v1/auth/register`
1. Joi validates `{ name, username, email, password }`
2. Uniqueness check: `Users.findOne({ $or: [{ email }, { username }] })`
3. `bcrypt.hash(password, 12)` → create User with `role: 'PATIENT'`
4. Sign JWT `{ sub: _id, role: 'PATIENT', exp: '30d' }`
5. Return `201 { token, user: { id, name, username, role, email } }`

**Error cases:** `409 EMAIL_TAKEN` | `409 USERNAME_TAKEN` | `400 VALIDATION_ERROR`

#### `POST /api/v1/auth/login` (Patient)
1. Joi validates `{ identifier, password }`
2. `identifier.includes('@')` → search by email, else by username
3. `Users.findOne({ $or: [{ email }, { username }], role: 'PATIENT' })`
4. `bcrypt.compare(password, user.passwordHash)`
5. Sign JWT `{ sub: _id, role: 'PATIENT', exp: '30d' }`
6. Return `200 { token, user }` | `401 INVALID_CREDENTIALS` (generic)

#### `POST /api/v1/auth/login` (Staff)
1. Joi validates `{ identifier, password, clinicId, role }`
2. `Users.findOne({ email: identifier, clinicId, role })`
3. `bcrypt.compare` → sign JWT `{ exp: '12h', clinicId }`
4. Return `200 { token, user }` | `401 INVALID_CREDENTIALS`

#### `GET /api/v1/clinics` (Public)
- Returns list of `{ _id, name }` for Clinic Selector dropdown on Staff login tab

### 2.2 Frontend — Screen 01: Auth Gateway

**Route:** `/` or `/auth`  
**Component:** `src/pages/Auth/AuthPage.jsx`

**UI Structure:**
```
<Tabs> Patient | Clinic Staff
  ├── Patient Tab
  │   <Tabs> Sign In | Create Account
  │   ├── Sign In Form
  │   │   - Email or Username input
  │   │   - Password input (eye toggle)
  │   │   - "Sign In" CTA (Primary: #17345C, text #FFFFFF)
  │   └── Register Form
  │       - Full Name, Username, Email, Password
  │       - Password strength bar (3-tier)
  │       - "Create Account" CTA
  └── Clinic Staff Tab
      - Clinic Selector <Select> (populated from GET /api/v1/clinics)
      - Role Pills: Doctor Console | Reception Desk
      - Email + Password inputs
      - "Sign In to Console" CTA
```

**State management:**
- `AuthContext` — stores `{ isAuthenticated, user, token }`
- On success → store JWT in `localStorage` (key: `qureflow_token`)
- React Router redirect: `PATIENT → /dashboard`, `DOCTOR → /doctor`, `RECEPTIONIST → /reception`

**Edge cases:**
- [ ] Disabled CTA until all fields valid (client-side Joi mirror)
- [ ] Inline field errors for format violations
- [ ] Generic error banner for `401 INVALID_CREDENTIALS`
- [ ] `409 EMAIL_TAKEN` / `409 USERNAME_TAKEN` alerts with Sign In links
- [ ] Loading spinner state on CTA during API call

**Deliverables:**
- Register and login working for all 3 role types
- JWT persisted and loaded into `AuthContext` on app mount
- Role-based redirect routing functional
- Screen 01 pixel-matched to `design/1-auth.html` prototype

---

## Phase 3 — Appointment Booking & Screens 02–03 (Patient Home + Slot Booking)
**Duration:** Day 9–12  
**Goal:** Patient can browse doctors, book a slot, and land on Patient Home Dashboard.

### 3.1 Backend — Booking Endpoints

#### `GET /api/v1/doctors/active` (Patient JWT required)
- Returns doctors with `role: 'DOCTOR'` for patient's target clinic
- Response: `[{ _id, name, specialization, availability.status }]`

#### `GET /api/v1/appointments/slots` (Patient JWT required)
- Query: `?doctorId=&date=YYYY-MM-DD`
- Fetches booked slots for that doctor on that date
- Returns available vs. booked slot grid

#### `POST /api/v1/appointments` (Patient JWT required)
1. Auth middleware extracts `patientId`
2. Joi validates payload
3. Validate `appointmentDate >= today`
4. Atomic slot check: `Appointments.findOne({ doctorId, appointmentDate, appointmentTime, status: 'BOOKED' })`
5. If slot free → `Appointments.create(...)` with `status: 'BOOKED'`
6. Lookup clinic check-in window → compute `{ windowStart, windowEnd }`
7. Return `201 { appointmentId, status, details: { doctorName, checkInWindow, room } }`

**Error cases:** `409 SLOT_ALREADY_TAKEN` (with `nextAvailableSlot`) | `400 VALIDATION_ERROR`

#### `GET /api/v1/appointments/my-upcoming` (Patient JWT required)
- Returns today's `BOOKED` appointment for the patient (if any)

### 3.2 Frontend — Screen 02: Patient Home Dashboard

**Route:** `/dashboard`  
**Component:** `src/pages/PatientHome/PatientHomePage.jsx`

**Dynamic Active Context Card** — renders based on visit state:
| State | Condition | Card Content |
|-------|-----------|--------------|
| **A** | `IN_QUEUE` or `CHECK_UP` active today | Token `#A-17`, position, ETA, "Track Live Queue →" |
| **B** | `BOOKED` appointment today | Doctor, slot time, visit type, "Scan QR Check-In →" |
| **C** | No visits/bookings today | "No appointments today", "Book an Appointment →" |

**Other sections:**
- Quick Actions Grid (4 tiles): Book Slot, Scan QR, Live Queue, Past Visits
- Specialists on Duty carousel (fetched from `GET /api/v1/doctors/active`)
- Clinic Operational Status banner

**State loading sequence:**
1. `GET /api/v1/visits/my-status` → check for active token
2. `GET /api/v1/appointments/my-upcoming` → check for today's booking
3. `GET /api/v1/doctors/active` → populate specialists carousel

### 3.3 Frontend — Screen 03: Doctor Discovery & Slot Booking

**Route:** `/book`  
**Component:** `src/pages/Booking/BookingPage.jsx`

**UI Flow:**
1. Doctor profile header (from `GET /api/v1/doctors/active`)
2. Visit Type selector (`NEW` vs `FOLLOW-UP`)
3. 7-day horizontal date carousel (swipeable)
4. Time slot grid grouped by Morning / Afternoon / Evening sessions
5. Sticky bottom booking summary bar
6. On "Confirm & Book Slot" → `POST /api/v1/appointments`
7. Success → Dialog with `appointmentId`, check-in window, "Proceed to QR Check-in" button

**Slot states:** Available · Selected (`#17345C` fill) · Booked (disabled, greyed)

**Deliverables:**
- Doctor list loaded from API
- Slot grid renders available/booked/selected states correctly
- Appointment created in DB on confirm
- Patient Home Dashboard dynamically reflects booking state
- Slot collision handled gracefully with auto-select next slot

---

## Phase 4 — QR Check-In & Live Queue Tracking (Screens 04–05)
**Duration:** Day 13–17  
**Goal:** Patient physically checks in via QR, receives token, and tracks live queue via WebSocket.

### 4.1 Backend — Check-In & Queue Endpoints

#### `POST /api/v1/visits/check-in` (Patient JWT required)
Anti-Ghost Queue Engine — validates in sequence:
1. Appointment exists and belongs to patient (`status: 'BOOKED'`)
2. Patient hasn't already checked in (no existing active Visit)
3. QR `clinicId` matches `appointment.clinicId`
4. Arrival time within window: `apptTime - 15m ≤ NOW ≤ apptTime + 15m`
5. `tokenMinter.mintToken(doctorId, today)` → sequential `"A-{n}"`
6. `Visits.create({ ..., status: 'IN_QUEUE', checkedInAt: NOW() })`
7. `etaEngine.computeETA(...)` → `{ minMinutes, maxMinutes }`
8. `wsService.emit('clinic:{clinicId}', 'QUEUE_UPDATED', { type: 'NEW_ARRIVAL', ... })`
9. Return `201 { visitId, tokenId, status, position, patientsAhead, ETA, doctor }`

**Error cases:**
- `404 APPOINTMENT_NOT_FOUND`
- `400 ALREADY_CHECKED_IN` (returns existing `tokenId`)
- `403 WRONG_CLINIC_QR`
- `400 CHECKIN_TOO_EARLY` (with `windowStart`, `minutesRemaining`)
- `400 CHECKIN_WINDOW_EXPIRED` (with `windowEnd`, `action: 'APPROACH_RECEPTION_DESK'`)

#### `GET /api/v1/visits/my-status` (Patient JWT required)
Queue position read for Screen 05:
1. Find patient's active visit for today
2. Count `IN_QUEUE` visits with `checkedInAt < this.checkedInAt` → `patientsAhead`
3. Find current `CHECK_UP` visit for the same doctor
4. `etaEngine.computeETA(...)` using rolling avg + remaining consult time
5. Return `{ tokenId, status, position, patientsAhead, currentlyServing, ETA, doctorStatus }`

### 4.2 Frontend — Screen 04: QR Check-In

**Route:** `/checkin`  
**Component:** `src/pages/CheckIn/CheckInPage.jsx`

**UI Structure:**
- Target booking card (Doctor, Slot Time, Clinic Name, Cabin)
- Arrival window badge (`Check-in Window: 10:15 AM – 10:45 AM`)
- Live camera viewfinder with corner guides, reticle, and scanning beam animation
- On successful QR decode → `POST /api/v1/visits/check-in`
- Manual fallback: 6-digit PIN input dialog
- Permission banner if camera access denied

**QR decode library:** `@zxing/browser` or `html5-qrcode`

**Success flow:**
1. Haptic vibration + chime sound
2. Token Issued Modal: `#A-17`, `Position: 4 Ahead`
3. Auto-navigate to Screen 05 after 2 seconds

**Error flows:**
- Too early → bottom sheet alert with `windowStart` time
- Too late → alert with `windowEnd` and reception desk instruction
- Wrong QR → "Invalid QR Code" inline alert

### 4.3 Frontend — Screen 05: Live Queue & ETA Tracker

**Route:** `/queue`  
**Component:** `src/pages/Queue/QueuePage.jsx`

**UI Structure:**
- Top nav: Clinic Name, Doctor Name, `● Live Sync` indicator
- Token Hero Card: Giant `#A-17` in Netflix Sans, `IN_QUEUE` badge
- 3-Metric cluster: Patients Ahead · Estimated Wait · Currently Serving
- 5-Step stepper: `BOOKED → CHECKED_IN → IN_QUEUE (active) → CHECK_UP → DONE`
- Doctor live status badge (`AVAILABLE` / `On 10m Break + ETA adjusted`)
- Proximity Alert Banner (animates when `patientsAhead <= 1`)
- `Leave Queue / Cancel Visit` ghost action with confirmation dialog

**WebSocket integration (`useWebSocket` hook):**
| Event | Action |
|-------|--------|
| `QUEUE_UPDATED` | Recalculate `patientsAhead`, ETA, `currentlyServing` |
| `DOCTOR_STATUS_CHANGED` | Update doctor status pill; adjust ETA if `ON_BREAK` |
| `VISIT_CALLED` (my token) | Show fullscreen Turn Notification Dialog + audio chime |
| `VISIT_COMPLETED` (my visit) | Render Visit Summary Card with vitals |

**Reconnection logic (`useWebSocket` hook):**
- Exponential backoff: 1s → 2s → 4s → 8s (jittered)
- On reconnect: REST re-sync via `GET /api/v1/visits/my-status`
- Disconnected >5s: amber banner `"Reconnecting to live queue..."`
- Disconnected >30s: manual retry button

**Deliverables:**
- QR scanning working (camera access + `zxing` decode)
- Check-in validation rules all enforced server-side
- Token minted and persisted in `Visits` collection
- Screen 05 updates in real-time on any doctor action (`< 500ms`)
- Proximity Alert animates in when 1 patient remains ahead
- Turn Notification Dialog plays audio and fills screen

---

## Phase 5 — Reception Console (Screen 06)
**Duration:** Day 18–21  
**Goal:** Full reception dashboard with live table, walk-in registration, no-show, and manual check-in.

### 5.1 Backend — Reception Endpoints

#### `GET /api/v1/visits` (Receptionist JWT required)
- Query: `?clinicId=&date=today`
- Returns all visits with patient + doctor details (populated)
- Sorted: urgent first, then by `checkedInAt` ascending

#### `POST /api/v1/visits/walk-in` (Receptionist JWT required)
1. Auth: `role === 'RECEPTIONIST'`
2. Joi validates `{ clinicId, patientName, phone, doctorId, type, isUrgent }`
3. Resolve or create stub patient: `Users.findOne({ phone, role: 'PATIENT' })` or create
4. Mint sequential token
5. If `isUrgent === true` → inject at position #1 (set `checkedInAt` with artificial priority)
6. `Visits.create({ ..., appointmentId: null, status: 'IN_QUEUE' })`
7. `wsService.emit('clinic:{id}', 'QUEUE_UPDATED', { type: 'WALK_IN_ADDED', isUrgent })`
8. Return `201 { visitId, tokenId, status, isUrgent, queuePosition }`

#### `PUT /api/v1/visits/:id/status` (Receptionist JWT required)
- Validates visit is in `IN_QUEUE` or `CHECKED_IN`
- Updates `status` to `NO_SHOW` or `CANCELLED`
- `wsService.emit('clinic:{id}', 'QUEUE_UPDATED', { type: 'STATUS_CHANGED', newStatus })`
- Returns `200 { success: true, updatedStatus }`

#### `POST /api/v1/visits/check-in/manual` (Receptionist JWT required)
- Same validation as QR check-in but `overrideReason` is recorded
- Used when patient camera fails or phone is dead

#### `GET /api/v1/appointments/search` (Receptionist JWT required)
- Query: `?phone=9876543210&date=today`
- Returns matching appointment for manual check-in lookup

#### `PUT /api/v1/visits/:id/priority` (Receptionist JWT required)
- Toggles `isUrgent` flag and reorders queue

### 5.2 Frontend — Screen 06: Reception Console

**Route:** `/reception`  
**Component:** `src/pages/Reception/ReceptionPage.jsx`

**UI Structure:**
- KPI strip (4 cards): Waiting in Lobby · In Consultation · Completed Today · No-Shows
- Doctor Filter Tabs (`All Doctors`, per-doctor pills)
- `+ Add Walk-In Patient` primary CTA → opens Sheet drawer
- `● Real-Time Feed Active` WebSocket indicator

**Live Queue Master Table columns:**
| Col | Content |
|-----|---------|
| Token ID | Bold chip `#A-14` |
| Patient Info | Name, Phone (masked) |
| Doctor Assigned | Name + Speciality |
| Visit Type | `NEW` / `FOLLOW-UP` badge |
| Arrival Time | `10:14 AM` |
| Wait Time | Running timer `18 mins` |
| Status Badge | `In Queue` (Blue) · `In Consult` (Green) · `No-Show` (Red) |
| Actions | Manual Check-In, Prioritize, Mark No-Show, Cancel |

**Walk-In Drawer (Sheet) fields:**
- Patient Full Name
- Mobile Phone
- Doctor Selector
- Visit Type (`NEW` vs `FOLLOW-UP`)
- Urgent Priority toggle (`isUrgent`)
- Auto-assigned next token preview

**WebSocket events handled:**
- `QUEUE_UPDATED` → insert/update row in table, update KPI counters
- `DOCTOR_STATUS_CHANGED` → update doctor tab badge

**Deliverables:**
- Live table updates without page reload on any event
- Walk-in correctly minted and injected (with urgent priority support)
- No-show flags propagate to Doctor Desk and Patient screens in `< 300ms`
- Manual check-in fallback working
- KPI counters accurate and live

---

## Phase 6 — Doctor Consultation Desk (Screen 07)
**Duration:** Day 22–25  
**Goal:** Doctor can call patients, log vitals, complete consultations, and manage break state.

### 6.1 Backend — Doctor Endpoints

#### `GET /api/v1/visits/my-queue` (Doctor JWT required)
- Returns `IN_QUEUE` visits for this doctor today, sorted by queue priority
- Populated with patient name, visit type, urgency flag, wait duration

#### `PUT /api/v1/visits/:id/start` (Doctor JWT required)
1. Concurrency guard: `Visits.findOne({ doctorId, status: 'CHECK_UP' })`
2. If active encounter found → `400 ACTIVE_ENCOUNTER_EXISTS`
3. Atomic update: `{ status: 'CHECK_UP', consultStartedAt: NOW() }`
4. `wsService.emit('patient:{patientId}', 'VISIT_CALLED', { tokenId, doctorName, cabin })`
5. `wsService.emit('clinic:{clinicId}', 'QUEUE_UPDATED', { ... })`
6. Return `200 { success, status, consultStartedAt, patient: { name, age, gender, visitType } }`

#### `PUT /api/v1/visits/:id/complete` (Doctor JWT required)
1. Joi validates `{ vitals: { bp, sugar, weight }, notes? }`
2. Validate BP regex: `^\d{2,3}\/\d{2,3}$`
3. Validate numeric bounds: `sugar: 40–600`, `weight: 1–300`
4. Compute `consultDurationMinutes`
5. Atomic update: `{ status: 'DONE', consultEndedAt: NOW(), vitals, notes }`
6. Recompute rolling avg from last 5 completed visits today
7. `wsService.emit('patient:{patientId}', 'VISIT_COMPLETED', { vitals, completedAt })`
8. `wsService.emit('clinic:{clinicId}' & 'doctor:{doctorId}', 'QUEUE_UPDATED', { ... })`
9. Return `200 { success, status, consultDurationMinutes, nextPatient }`

#### `PUT /api/v1/doctors/status` (Doctor JWT required)
- Payload: `{ status: 'ON_BREAK', breakDurationMinutes: 10 }`
- Updates `Users.availability.status` + `breakUntil`
- `wsService.emit('doctor:{id}' & 'clinic:{id}', 'DOCTOR_STATUS_CHANGED', { status, breakMinutes, breakUntil })`
- Return: `200 { success, status }`

### 6.2 Frontend — Screen 07: Doctor Consultation Desk

**Route:** `/doctor`  
**Component:** `src/pages/Doctor/DoctorPage.jsx`

**UI Structure:**
- Header: Doctor name, Cabin, Status Toggle (`Available` / `On 10m Break`)
- Active Encounter Hero Card:
  - Patient token badge `#A-14`
  - Patient demographics (Name, Age/Gender, Phone)
  - Visit Type tag (`NEW CONSULTATION` / `FOLLOW-UP`)
  - Urgency badge (red, if `isUrgent`)
- Live Consultation Timer: Count-up from `consultStartedAt` (amber if >20 mins)
- Rapid Vitals Logging Card:
  - Blood Pressure (mask: `120/80 mmHg`)
  - Blood Sugar (unit: `mg/dL`)
  - Body Weight (unit: `kg`)
- Up-Next Queue Strip (Sheet drawer): next 3 patients with wait times
- `Complete Consult & Call Next` primary CTA
- `Mark No-Show & Call Next` secondary action
- `Take 10m Break` secondary action

**States:**
| State | UI Behavior |
|-------|-------------|
| Idle (queue empty) | Standby card "Queue is clear · Doctor Ready" |
| Patient called | Active Encounter Card loads, timer starts |
| Vitals submitted | Form clears, timer resets, next patient auto-loads |

**WebSocket events emitted:** `VISIT_CALLED`, `VISIT_COMPLETED`, `QUEUE_UPDATED`, `DOCTOR_STATUS_CHANGED`

**Deliverables:**
- Consultation start/complete cycle working end-to-end
- Consultation timer accurate and color-coded
- Vitals persisted in `Visits.vitals`
- Rolling average ETA recalculated after each completed consult
- Break status propagates to Patient screens (ETA + 10m) in real time

---

## Phase 7 — Integration, Edge Cases & Resilience
**Duration:** Day 26–29  
**Goal:** All 7 screens working together with full WebSocket sync, all edge cases handled.

### 7.1 Cross-Role Integration Testing

| Scenario | Expected Behavior |
|----------|------------------|
| QR Check-in → Reception table | New row animates in with green highlight |
| Doctor starts consult → Patient Screen 05 | Fullscreen Turn Modal in < 500ms |
| Doctor completes consult → all patients | `patientsAhead` decrements; ETA shrinks |
| Reception marks No-Show → Doctor Desk | Token vanishes from Up-Next queue |
| Reception adds urgent walk-in → Doctor | Urgent badge flashes at position #1 |
| Doctor takes break → Patients | ETA + break duration added; amber pill shows |
| Doctor resumes → Patients | ETAs restore; green pill shows |

### 7.2 Edge Case Implementation

- [x] **Slot race condition** — `findOneAndUpdate` atomic on slot booking; return `409 SLOT_ALREADY_TAKEN` with `nextAvailableSlot`
- [x] **Double check-in guard** — `Visits.findOne({ appointmentId, status: { $in: [...] } })` before minting
- [x] **Concurrent `CHECK_UP`** — concurrency guard in `startConsultation` controller (`ACTIVE_ENCOUNTER_EXISTS`)
- [x] **Camera permission denied** — permission banner + manual 6-digit code fallback
- [x] **Patient phone dies** — token remains valid in DB; Reception/Doctor can call by token number
- [x] **Emergency walk-in** — `isUrgent: true` injects at position #1 with `checkedInAt` reordering
- [x] **WS disconnect** — exponential backoff reconnect; frozen ETA with timestamp; silent re-sync on reconnect

### 7.3 Anti-Ghost Queue Integrity Check

Verify at integration level:
- [x] A `BOOKED` appointment record does NOT appear in Reception table or Doctor Up-Next list
- [x] Only a `Visits` document with `status: IN_QUEUE` appears in live queues
- [x] Walk-in visits have `appointmentId: null` and are correctly handled everywhere

---

## Phase 8 — Polish, QA & Deployment
**Duration:** Day 30–35  
**Goal:** Production-ready app deployed on Vercel + Railway, meeting all acceptance criteria.

### 8.1 UI/UX Polish Checklist

- [x] Arctic Frost color tokens applied correctly on all 7 screens
- [x] WCAG AAA contrast: all text on `#17345C` or `#071629` is `#FFFFFF` or `#EAF4FF`
- [x] Dark mode toggle implemented (flipped ratio architecture from `style-guide.md`)
- [x] Unified `8px` border radius across all buttons, inputs, cards, badges, drawers
- [x] Button height `44px`, input height `44px`, badge height `24px` strictly enforced
- [x] `Inter` for body/numbers, heading font for display/titles
- [x] Skeleton placeholders on all loading states (no blank white screens)
- [x] Toast notifications for queue changes, no-shows, and network reconnects
- [x] Proximity Alert banner slide-in animation smooth
- [x] Turn Notification Dialog fullscreen with audio chime
- [x] Consultation timer color transitions (normal → amber >20 mins)

### 8.2 Functional Acceptance Criteria

| Criterion | Acceptance Test |
|-----------|----------------|
| **Anti-Ghost Queue** | `BOOKED` appointment never shows in live queue tables |
| **State Sync Speed** | Doctor action → Patient Screen 05 update in `< 500ms` |
| **Schema Fidelity** | All form fields map 1:1 to MongoDB schema definitions in `features.md` |
| **Color Contrast** | All `#17345C`/`#071629` backgrounds have `≥ 9.8:1` contrast foreground |
| **Component Standard** | All components use shadcn/ui with `8px` unified radius |
| **ETA Reliability** | ETA range narrows as queue advances; adjusts on doctor break/resume |
| **Token Uniqueness** | No two visits on same doctor+date share a token ID |

### 8.3 Performance & Security

- [ ] MongoDB indexes: `{ email: 1 }`, `{ username: 1 }`, `{ doctorId: 1, visitDate: 1, status: 1 }`, `{ appointmentDate: 1, appointmentTime: 1, doctorId: 1 }`
- [ ] Rate limiting on auth endpoints (`express-rate-limit`, 10 req/15min per IP)
- [ ] Staff account lockout after 5 consecutive failed login attempts
- [ ] JWT stored in `localStorage` key `qureflow_token`; cleared on logout
- [ ] Helmet.js headers on Express
- [ ] CORS configured to allow only frontend origin

### 8.4 Deployment

#### Backend (Railway or Render)
```bash
# Environment variables
MONGO_URI=mongodb+srv://...
JWT_SECRET=<32-char-random>
PORT=5000
CLIENT_ORIGIN=https://qureflow.vercel.app
```

#### Frontend (Vercel)
```bash
# Environment variables
VITE_API_URL=https://api.qureflow.railway.app/api/v1
VITE_WS_URL=wss://api.qureflow.railway.app
```

#### MongoDB Atlas
- Enable Network Access for Railway IP range
- Create DB user with `readWrite` on `qureflow` database
- Seed initial `clinics` and staff `users` documents

**Deliverables:**
- Both client and server deployed and publicly accessible
- All 7 screens functionally complete
- Real-time sync verified across all 3 role types simultaneously
- All acceptance criteria from `UI-UX.md §10` passing

---

## Implementation Summary

| Phase | Focus Area | Duration | Key Deliverable |
|-------|-----------|----------|----------------|
| **0** | Scaffolding & DevOps | Day 1–2 | Monorepo, Arctic Frost CSS, shadcn/ui |
| **1** | Database & Backend Core | Day 3–5 | Models, Auth middleware, WebSocket server, ETA engine |
| **2** | Auth APIs + Screen 01 | Day 6–8 | Register/Login for all 3 roles; Auth Gateway UI |
| **3** | Booking + Screens 02–03 | Day 9–12 | Slot booking flow; Patient Home + Booking screens |
| **4** | QR Check-In + Screens 04–05 | Day 13–17 | Token minting; real-time queue tracking via WS |
| **5** | Reception Console (Screen 06) | Day 18–21 | Walk-ins, no-show, manual check-in, live table |
| **6** | Doctor Desk (Screen 07) | Day 22–25 | Consult start/complete, vitals logging, break state |
| **7** | Integration & Edge Cases | Day 26–29 | Cross-role sync tests, resilience, anti-ghost validation |
| **8** | Polish, QA & Deploy | Day 30–35 | WCAG audit, acceptance criteria, Vercel + Railway deploy |

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auth method | Email/Username + Password + JWT | No OTP/SMS per product spec |
| Real-time layer | `ws` (native WebSocket) | Lightweight; no Redis needed for MVP |
| Queue calculation | Server-side on every query | Avoids stale cache; accurate per-request |
| Token ID format | `A-{padded sequential}` per doctor per day | Human-readable, collision-free per scope |
| ETA strategy | Rolling avg of last 5 `DONE` visits | Adaptive; degrades gracefully when no history |
| Dark mode | CSS `[data-theme="dark"]` flipped ratio | Matches Arctic Frost design spec exactly |
| State machine authority | Server is single source of truth | Prevents client-side queue manipulation |

---

*Document generated from:*  
- [`docs/problem.md`](docs/problem.md) — Core problem statement & QureFlow vision  
- [`docs/mvp-ideation.md`](docs/mvp-ideation.md) — MoSCoW scope, tech stack, auth strategy  
- [`docs/features.md`](docs/features.md) — API contracts, DB schema, module breakdown  
- [`docs/systemWorkflow.md`](docs/systemWorkflow.md) — Step-by-step request/response lifecycles  
- [`docs/UI-UX.md`](docs/UI-UX.md) — Screen specs, component definitions, state machine  
- [`docs/style-guide.md`](docs/style-guide.md) — Arctic Frost design tokens, WCAG rules  
- [`design/*.html`](design/) — Interactive UI prototypes for all 7 screens
