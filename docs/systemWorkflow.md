# QureFlow: Internal System Workflows & Request Lifecycles

This document defines the exact step-by-step internal system workflows for every core operation in the QureFlow platform. It details how requests travel from the Client UI through Middlewares, Controllers, Business Logic Engines, Database Transactions, and Real-Time WebSocket broadcasts.

---

## Architecture Flow Legend

* **Client:** Patient Web App, Reception Console, or Doctor Desk UI (React + React Router).
* **Gateway / Router:** Express.js HTTP Router + `ws` WebSocket Server.
* **Middleware:** `AuthMiddleware` (JWT verification), `RoleGuard` (role enforcement), `JoiValidation` (input schema validation via Joi).
* **Controllers:** `AuthController`, `AppointmentController`, `VisitController`, `QueueController`.
* **ODM:** Mongoose — Models: `User`, `Appointment`, `Visit`, `Clinic`.
* **Database (MongoDB):** Collections `users`, `appointments`, `visits`, `clinics`.
* **Real-Time Engine:** WebSocket Server (`ws`) broadcasting to scoped rooms (`clinic:{id}`, `doctor:{id}`, `visit:{id}`).
* **Auth Strategy:** Email + Password OR Username + Password → JWT (no OTP, no phone, no SMS).

---

## 1. Authentication & Role Gateway Workflows

> **Tech Stack Note:** Authentication uses email/username + password + JWT. There is NO OTP, NO SMS, and NO phone-based auth in this system. All passwords are hashed with bcrypt. JWTs are signed with `jsonwebtoken`. Validation uses `Joi`.

---

### 1.1 Patient Registration Flow (New Account)

```
Client (Screen 01 - Register Tab) → Enters name, username, email, password → Clicks "Create Account"
   │
   ▼
API: POST /api/v1/auth/register
Payload: { name: "Rahul Verma", username: "rahul_v", email: "rahul@gmail.com", password: "Secure#123" }
   │
   ▼
Joi Validation Middleware:
   * name: required, string, min 2 chars
   * username: required, string, alphanum + underscore, min 3 chars, max 30 chars
   * email: required, valid email format
   * password: required, min 8 chars
   │
   ├── Validation Fails
   │      → Returns 400 Bad Request: { error: "VALIDATION_ERROR", details: [...] }
   │      → Client renders inline field-level errors
   │
   └── Validation Passes
          │
          ▼
AuthController: Uniqueness Check
   DB Query 1: Users.findOne({ email: "rahul@gmail.com" })
   DB Query 2: Users.findOne({ username: "rahul_v" })
   │
   ├── Email Already Registered
   │      → Returns 409 Conflict: { error: "EMAIL_TAKEN" }
   │      → Client: "An account with this email already exists. Try logging in."
   │
   ├── Username Already Taken
   │      → Returns 409 Conflict: { error: "USERNAME_TAKEN" }
   │      → Client: "This username is unavailable. Please choose another."
   │
   └── Both Unique — Proceed
          │
          ▼
AuthController: Create User
   * passwordHash = await bcrypt.hash(password, 12)
   * new User({
       role: "PATIENT",
       name: "Rahul Verma",
       username: "rahul_v",
       email: "rahul@gmail.com",
       passwordHash,
       createdAt: Date.now()
     }).save()
          │
          ▼
Session Service:
   * Generates signed JWT:
     { sub: user._id, role: "PATIENT", username: user.username, email: user.email, iat, exp: "30d" }
          │
          ▼
API Returns 201 Created:
   {
     token: "eyJhbGciOi...",
     user: { id: user._id, name: "Rahul Verma", username: "rahul_v", role: "PATIENT", email: "rahul@gmail.com" }
   }
   │
   ▼
Client stores JWT in localStorage (key: "qureflow_token")
   │
   ▼
React Context API updates authState: { isAuthenticated: true, user: {...}, token: "..." }
   │
   ▼
React Router navigates to: /dashboard (Patient Home, patient-home.html)
```

---

### 1.2 Patient Login Flow (Returning User)

```
Client (Screen 01 - Login Tab) → Enters email OR username + password → Clicks "Sign In"
   │
   ▼
API: POST /api/v1/auth/login
Payload: { identifier: "rahul@gmail.com" OR "rahul_v", password: "Secure#123" }
   │
   ▼
Joi Validation Middleware:
   * identifier: required, string, min 3 chars (accepts email or username)
   * password: required, string, min 1 char
   │
   ├── Validation Fails
   │      → Returns 400 Bad Request: { error: "VALIDATION_ERROR" }
   │      → Client renders inline error: "All fields are required."
   │
   └── Validation Passes
          │
          ▼
AuthController: User Lookup
   * Determine identifier type:
     - if identifier contains "@" → treat as email
     - else → treat as username
   DB Query:
     Users.findOne({
       $or: [{ email: identifier }, { username: identifier }],
       role: "PATIENT"
     })
   │
   ├── User Not Found
   │      → Returns 401 Unauthorized: { error: "INVALID_CREDENTIALS" }
   │      → Client: "Invalid email/username or password."
   │      (Generic message — prevents user enumeration attacks)
   │
   └── User Found
          │
          ▼
Password Verification:
   bcrypt.compare(password, user.passwordHash)
   │
   ├── Password Mismatch
   │      → Returns 401 Unauthorized: { error: "INVALID_CREDENTIALS" }
   │      → Client: "Invalid email/username or password."
   │
   └── Password Matches
          │
          ▼
Session Service:
   * Generates signed JWT:
     { sub: user._id, role: "PATIENT", username: user.username, email: user.email, iat, exp: "30d" }
          │
          ▼
API Returns 200 OK:
   {
     token: "eyJhbGciOi...",
     user: { id: user._id, name: user.name, username: user.username, role: "PATIENT", email: user.email }
   }
   │
   ▼
Client stores JWT in localStorage (key: "qureflow_token")
   │
   ▼
React Context API updates authState: { isAuthenticated: true, user: {...}, token: "..." }
   │
   ▼
React Router navigates to: /dashboard (patient-home.html)
```

---

### 1.3 Clinic Staff Login Flow (Doctor & Receptionist)

```
Client (Screen 01 - Staff Tab) → Selects Clinic, selects Role, enters email + password → Clicks "Sign In"
   │
   ▼
API: POST /api/v1/auth/login
Payload: { identifier: "dr.sharma@apollo.com", password: "StaffPass#99", clinicId: "clinic_01", role: "DOCTOR" }
   │
   ▼
Joi Validation Middleware:
   * identifier: required, valid email
   * password: required, min 8 chars
   * clinicId: required, MongoDB ObjectId
   * role: required, one of ["DOCTOR", "RECEPTIONIST"]
   │
   ├── Validation Fails
   │      → Returns 400 Bad Request: { error: "VALIDATION_ERROR", details: [...] }
   │      → Client renders inline field-level errors
   │
   └── Validation Passes
          │
          ▼
AuthController: Staff Lookup
   DB Query:
     Users.findOne({
       $or: [{ email: identifier }, { username: identifier }],
       clinicId: ObjectId(clinicId),
       role: role
     })
   │
   ├── No User Found
   │      → Returns 401 Unauthorized: { error: "INVALID_CREDENTIALS" }
   │      → Client: "No matching staff record found. Check your clinic selection."
   │
   └── Staff Record Found
          │
          ▼
Password Verification:
   bcrypt.compare(password, user.passwordHash)
   │
   ├── Password Incorrect
   │      → Logs failed attempt (account lock after 5 consecutive failures)
   │      → Returns 401 Unauthorized: { error: "INVALID_CREDENTIALS" }
   │      → Client: "Incorrect credentials. Please try again."
   │
   └── Password Matches
          │
          ▼
Session Service:
   * Generates signed Staff JWT (shorter expiry):
     { sub: user._id, role: user.role, clinicId: user.clinicId, name: user.name, iat, exp: "12h" }
          │
          ▼
API Returns 200 OK:
   {
     token: "eyJhbGciOi...",
     user: { id: user._id, name: user.name, role: user.role, clinicId: user.clinicId }
   }
          │
          ├── role === "DOCTOR"
          │      → React Router navigates to: /doctor  (6-doctor.html)
          │
          └── role === "RECEPTIONIST"
                 → React Router navigates to: /reception  (5-reception.html)
```

---

## 2. Doctor Discovery & Appointment Slot Booking Workflow

```
Client (Screen 03) → Selects Doctor, Visit Type ('NEW'|'FOLLOW-UP'), Date, and Slot Time
   │
   ▼
Client Clicks "Confirm & Book Slot"
   │
   ▼
API: POST /api/v1/appointments  (Headers: Authorization Bearer <JWT>)
Payload:
{
  doctorId: "doc_01",
  clinicId: "clinic_01",
  appointmentDate: "2026-09-27",
  appointmentTime: "10:30",
  type: "NEW"
}
   │
   ▼
AuthMiddleware: Verifies Patient JWT, extracts `patientId = req.user.sub`
   │
   ▼
ValidationMiddleware:
   * Checks appointmentDate >= today
   * Verifies appointmentTime matches valid clinic OPD slot schedule (HH:mm)
   * Validates type IN ['NEW', 'FOLLOW-UP']
   │
   ▼
AppointmentController: Slot Availability & Race Condition Check (Atomic Guard):
   DB Query: Appointments.findOne({
     doctorId: ObjectId(doctorId),
     clinicId: ObjectId(clinicId),
     appointmentDate: "2026-09-27",
     appointmentTime: "10:30",
     status: "BOOKED"
   })
   │
   ├── Slot Already Booked (Race condition: another patient booked moments prior)
   │      → Returns 409 Conflict:
   │        { 
   │          error: "SLOT_ALREADY_TAKEN", 
   │          message: "Selected slot was just booked by another patient.",
   │          nextAvailableSlot: "11:30"
   │        }
   │      → Client displays Toast: "Slot was just taken! Auto-selecting next available slot."
   │      → Client UI refreshes slot chips and selects 11:30 AM
   │
   └── Slot Is Free
          │
          ▼
Database Transaction (Insert):
   Appointments.create({
     patientId: ObjectId(patientId),
     doctorId: ObjectId(doctorId),
     clinicId: ObjectId(clinicId),
     appointmentDate: "2026-09-27",
     appointmentTime: "10:30",
     type: "NEW",
     status: "BOOKED",
     createdAt: ISODate()
   })
          │
          ▼
Clinics Collection Lookup: Read clinic check-in window parameters:
   Clinics.findById(clinicId, "checkInWindowStartMinutes checkInWindowEndMinutes")
   * Computes Arrival Window:
     windowStart = 10:30 minus 15m = "10:15"
     windowEnd   = 10:30 plus 15m  = "10:45"
          │
          ▼
API Returns 201 Created:
   {
     success: true,
     appointmentId: "appt_9042",
     status: "BOOKED",
     details: {
       doctorName: "Dr. Rajesh Sharma",
       appointmentDate: "2026-09-27",
       appointmentTime: "10:30",
       checkInWindow: { start: "10:15", end: "10:45" },
       room: "Cabin 02"
     }
   }
          │
          ▼
Client UI (Screen 03):
   * Launches "Slot Confirmed!" Modal Overlay
   * Displays Booking ID #BK-9042
   * Displays Check-in window reminder ("Arrive between 10:15 AM – 10:45 AM")
   * Primary Button: "Proceed to QR Check-in (Screen 04)" → Navigates to 3-checkin.html
```

---

## 3. Physical Arrival QR Check-In Workflow (The Anti-Ghost Queue Gate)

```
Client (Screen 04) → Opens camera viewfinder inside clinic lobby
   │
   ▼
Scans Clinic Standee QR Code:
QR Payload: { clinicId: "clinic_01", locationCode: "MAIN_OPD", nonce: "xyz987" }
   │
   ▼
API: POST /api/v1/visits/check-in  (Headers: Authorization Bearer <JWT>)
Payload:
{
  clinicId: "clinic_01",
  appointmentId: "appt_9042"
}
   │
   ▼
AuthMiddleware: Extracts `patientId` from JWT
   │
   ▼
Validation & Business Rule Verifier (Anti-Ghost Queue Engine):
   │
   ├── Check 1: Does appointment exist and belong to this patient?
   │      Appointments.findOne({ _id: appointmentId, patientId, status: "BOOKED" })
   │      ├── Not Found → Returns 404: { error: "APPOINTMENT_NOT_FOUND" }
   │      └── Found → Proceeds to Check 2
   │
   ├── Check 2: Has patient already checked in for this visit?
   │      Visits.findOne({ appointmentId: appointmentId, status: { $in: ["IN_QUEUE", "CHECK_UP", "DONE"] } })
   │      ├── Match Found → Returns 400: { error: "ALREADY_CHECKED_IN", tokenId: visit.tokenId }
   │      └── No Match → Proceeds to Check 3
   │
   ├── Check 3: Does QR clinic match appointment clinic?
   │      qr.clinicId === appt.clinicId
   │      ├── Mismatch → Returns 403 Forbidden: { error: "WRONG_CLINIC_QR" }
   │      └── Match → Proceeds to Check 4
   │
   └── Check 4: Physical Arrival Window Verification (±15 mins Rule)
          currentTime = NOW()  (e.g., 10:18 AM)
          slotTime    = "10:30 AM"
          windowStart = slotTime - 15m (10:15 AM)
          windowEnd   = slotTime + 15m (10:45 AM)
          │
          ├── Too Early (e.g., arrives at 09:45 AM)
          │      → Returns 400 Bad Request:
          │        { 
          │          error: "CHECKIN_TOO_EARLY", 
          │          windowStart: "10:15 AM", 
          │          minutesRemaining: 30 
          │        }
          │      → Client displays alert: "Check-in opens at 10:15 AM (15m before slot). Please wait."
          │      → Token IS NOT minted; live queue is unaffected
          │
          ├── Too Late / Expired (e.g., arrives at 11:05 AM)
          │      → Returns 400 Bad Request:
          │        { 
          │          error: "CHECKIN_WINDOW_EXPIRED", 
          │          windowEnd: "10:45 AM", 
          │          action: "APPROACH_RECEPTION_DESK" 
          │        }
          │      → Client displays alert: "Check-in window expired. Please approach Reception Desk."
          │      → Token IS NOT minted; prevents ghost late entries
          │
          └── Arrival Window Valid (10:15 AM <= 10:18 AM <= 10:45 AM)
                 │
                 ▼
Token Generation Engine:
   * Generates Daily Sequential Token for Doctor:
     Query count of Visits today for doctor: `count = Visits.countDocuments({ doctorId, visitDate: TODAY })`
     Generated Token ID = "A-" + String(count + 1).padStart(2, '0')  (e.g., "A-17")
                 │
                 ▼
Database Transaction (Atomic Insert):
   Visits.create({
     appointmentId: ObjectId(appointmentId),
     patientId: ObjectId(patientId),
     doctorId: ObjectId(appt.doctorId),
     clinicId: ObjectId(clinicId),
     visitDate: "2026-09-27",
     tokenId: "A-17",
     status: "IN_QUEUE",
     isUrgent: false,
     checkedInAt: ISODate(),
     consultStartedAt: null,
     consultEndedAt: null,
     vitals: { bp: null, sugar: null, weight: null }
   })
                 │
                 ▼
Queue Position & Dynamic ETA Calculation:
   * Patients Ahead = Visits.countDocuments({ doctorId, visitDate: TODAY, status: "IN_QUEUE", checkedInAt: { $lt: NOW() } })
   * Rolling Avg Duration = Doctor avg consult time (e.g., 12 mins)
   * Computed ETA = { minMinutes: (patientsAhead * 10), maxMinutes: (patientsAhead * 15) }
                 │
                 ▼
Real-Time WebSocket Emission:
   * Emits to Redis / WS Room `clinic:clinic_01`:
     Event: "QUEUE_UPDATED"
     Payload: { 
       type: "NEW_ARRIVAL", 
       tokenId: "A-17", 
       patientName: "Rahul Verma", 
       doctorId: "doc_01",
       status: "IN_QUEUE",
       checkedInAt: "10:18 AM"
     }
   * Reception Console (Screen 06) instantly appends row with green highlight
   * Doctor Desk (Screen 07) increments Up-Next queue counter
                 │
                 ▼
API Returns 201 Created:
   {
     success: true,
     visitId: "vis_1042",
     tokenId: "A-17",
     status: "IN_QUEUE",
     position: 3,
     patientsAhead: 2,
     ETA: { minMinutes: 20, maxMinutes: 30 },
     doctor: { name: "Dr. Rajesh Sharma", cabin: "Cabin 02" }
   }
                 │
                 ▼
Client UI (Screen 04):
   * Triggers haptic vibration & audio chime
   * Displays "Your Live Queue Token #A-17" Modal
   * Auto-navigates to Screen 05: Live Queue & ETA Tracker (4-queue.html) in 2 seconds
```

---

## 4. Real-Time Live Queue Tracking & ETA Engine Workflow

```
Client (Screen 05) → Mounts page & opens WebSocket connection
   │
   ▼
WS Handshake: GET /ws/queue?token=<JWT>&visitId=vis_1042
   │
   ▼
AuthMiddleware: Validates JWT token, attaches user session
   │
   ▼
WebSocket Server: Adds client socket to rooms:
   - `patient:usr_102` (User-specific direct alerts)
   - `doctor:doc_01` (Doctor-specific queue channel)
   - `clinic:clinic_01` (Clinic-wide channel)
   │
   ▼
Client fetches initial state via REST: GET /api/v1/visits/my-status
   │
   ▼
Backend QueueController:
   1. Fetches active Visit: Visits.findById(visitId)
   2. Counts earlier waiting visits:
      `ahead = Visits.countDocuments({ doctorId: visit.doctorId, status: "IN_QUEUE", checkedInAt: { $lt: visit.checkedInAt } })`
   3. Finds currently consulting visit:
      `current = Visits.findOne({ doctorId: visit.doctorId, status: "CHECK_UP" })`
   4. Computes Dynamic Elastic ETA Range:
      doctorAvg = 12 mins
      elapsedCurrent = current ? (NOW() - current.consultStartedAt) : 0
      remainingCurrent = Math.max(2, doctorAvg - elapsedCurrent)
      minWait = (ahead * 10) + remainingCurrent
      maxWait = (ahead * 15) + remainingCurrent + 5
   │
   ▼
API Returns 200 OK:
   {
     tokenId: "A-17",
     status: "IN_QUEUE",
     position: ahead + 1,
     patientsAhead: ahead,
     currentlyServing: current ? current.tokenId : "None",
     ETA: { minMinutes: minWait, maxMinutes: maxWait },
     doctorStatus: "AVAILABLE"
   }
   │
   ▼
Client UI (Screen 05):
   * Populates Token Hero Card with `#A-17`
   * Sets Patients Ahead metric (`2`)
   * Sets Estimated Wait Range (`20–30 mins`)
   * Sets Currently Serving metric (`#A-15`)
   * Sets State Stepper to Step 3: `IN_QUEUE` (Active blue ring)
```

```
[LIVE WEBSOCKET EVENT LIFECYCLE DURING WAITING]

Scenario A: Doctor finishes prior consultation (#A-15 completed)
   │
   ▼
Doctor Desk triggers consult complete → Server broadcasts "QUEUE_UPDATED"
   │
   ▼
Client Socket receives "QUEUE_UPDATED"
   │
   ▼
Client recalculates state:
   * Patients Ahead counter decrements: 2 → 1
   * Proximity Alert Triggered: Because patientsAhead <= 1:
     → Yellow Alert Bar slides in: "You're Next! Please remain near Cabin 02."
   * Estimated Wait Range shrinks: 20–30m → 10–15m
   * Currently Serving updates: #A-15 → #A-16

─────────────────────────────────────────────────────────────────────────────

Scenario B: Doctor calls patient's token (#A-17)
   │
   ▼
Doctor Desk triggers PUT /api/v1/visits/vis_1042/start
   │
   ▼
Server emits targeted WebSocket event to room `patient:usr_102`:
Event: "VISIT_CALLED"
Payload: { tokenId: "A-17", doctorName: "Dr. Rajesh Sharma", cabin: "Cabin 02" }
   │
   ▼
Client Socket (Screen 05) receives "VISIT_CALLED":
   * Triggers device audio chime & continuous vibration pattern
   * Displays Fullscreen Modal Overlay:
     "It's Your Turn! Please proceed inside Cabin 02 for Dr. Rajesh Sharma."
   * Advances Stepper from Step 3 (In Queue) to Step 4: `CHECK_UP` (Consulting)
   * Changes status badge from `IN QUEUE` to `IN CONSULTATION` (Green)
```

---

## 5. Reception Walk-In Patient Registration Workflow

```
Unscheduled patient arrives at clinic lobby → Receptionist opens Slide-Over Drawer
   │
   ▼
Receptionist enters: Patient Name, Mobile (+91), Assigns Doctor, Visit Type, and Urgency Toggle
   │
   ▼
Client (Screen 06) Clicks "+ Mint Token & Add to Live Queue"
   │
   ▼
API: POST /api/v1/visits/walk-in  (Headers: Authorization Bearer <Staff-JWT>)
Payload:
{
  clinicId: "clinic_01",
  patientName: "Aman Gupta",
  phone: "9812345678",
  doctorId: "doc_01",
  type: "NEW",
  isUrgent: true
}
   │
   ▼
AuthMiddleware: Verifies `role === 'RECEPTIONIST'`, extracts `staffId` and `clinicId`
   │
   ▼
ValidationMiddleware: Validates phone, patient name, doctor assignment
   │
   ▼
VisitController (Walk-In Handler):
   │
   ├── Step 1: Resolve Patient Record
   │      DB: Users.findOne({ phone: "9812345678", role: "PATIENT" })
   │      ├── Found → Uses existing `patient._id`
   │      └── Not Found → Creates stub user in `Users`:
   │            { role: "PATIENT", name: "Aman Gupta", phone: "9812345678", clinicId }
   │
   ├── Step 2: Auto-Mint Sequential Token ID
   │      DB: Counts visits today for doctor → Mints "A-18"
   │
   ├── Step 3: Handle Emergency Priority Triage Flag
   │      │
   │      ├── isUrgent === true (Emergency Walk-In)
   │      │      * Sets `isUrgent: true`
   │      │      * Assigns `checkedInAt = NOW()` with artificial priority weighting
   │      │      * Injects visit at Position #1 of `IN_QUEUE` (directly behind active consult)
   │      │
   │      └── isUrgent === false (Standard Walk-In)
   │             * Sets `isUrgent: false`
   │             * Assigns `checkedInAt = NOW()`
   │             * Placed at bottom of current waiting line
   │
   └── Step 4: Database Insert (Visits collection)
          Visits.create({
            appointmentId: null,      // Explicitly NULL for walk-ins
            patientId: patient._id,
            doctorId: ObjectId(doctorId),
            clinicId: ObjectId(clinicId),
            visitDate: "2026-09-27",
            tokenId: "A-18",
            status: "IN_QUEUE",
            isUrgent: isUrgent,
            checkedInAt: ISODate(),
            consultStartedAt: null,
            consultEndedAt: null,
            vitals: { bp: null, sugar: null, weight: null }
          })
   │
   ▼
Real-Time Broadcast (WebSocket to `clinic:clinic_01` & `doctor:doc_01`):
   Event: "QUEUE_UPDATED"
   Payload: { 
     type: "WALK_IN_ADDED", 
     tokenId: "A-18", 
     isUrgent: true, 
     affectedDoctor: "doc_01" 
   }
   │
   ├── Doctor Desk (Screen 07):
   │      → Urgent badge flashes red at top of Up-Next queue
   │
   └── All Waiting Patients (Screen 05):
          → ETAs automatically push back by 12–15 mins to account for priority walk-in
   │
   ▼
API Returns 201 Created:
   {
     success: true,
     visitId: "vis_1043",
     tokenId: "A-18",
     status: "IN_QUEUE",
     isUrgent: true,
     queuePosition: 1
   }
   │
   ▼
Reception Console (Screen 06):
   * Closes Slide-Over Drawer
   * Injects new row into Live Table with amber/red highlight
   * Increments "Waiting in Lobby" counter
   * Optional: Prints physical token paper slip with QR code for patient
```

---

## 6. Reception Exception Handling & Queue Override Workflows

### 6.1 Patient Absent / No-Show Marking Flow

```
Doctor calls Token #A-12 repeatedly → Patient does not enter room → Receptionist investigates lobby
   │
   ▼
Receptionist clicks "Mark No-Show" on Token #A-12 in Live Table (Screen 06)
   │
   ▼
Client displays confirmation modal: "Mark #A-12 as NO-SHOW? This removes them from queue."
   │
   ▼
Receptionist Confirms
   │
   ▼
API: PUT /api/v1/visits/vis_1038/status  (Headers: Staff JWT)
Payload: { status: "NO_SHOW" }
   │
   ▼
AuthMiddleware: Verifies `role === 'RECEPTIONIST'`
   │
   ▼
VisitController:
   * Validates target visit exists and is currently in `IN_QUEUE` or `CHECKED_IN`
   * Database Update:
     Visits.updateOne(
       { _id: ObjectId("vis_1038") },
       { $set: { status: "NO_SHOW", updatedAt: ISODate() } }
     )
   │
   ▼
Queue Recalculation Engine:
   * Re-evaluates queue order for doctor:
     Remaining waiting visits behind #A-12 advance 1 position immediately
   * Recalculates dynamic ETAs (decreases wait times by ~12 mins for subsequent patients)
   │
   ▼
Real-Time WebSocket Emission:
   * Emits "QUEUE_UPDATED" to `doctor:doc_01` & `clinic:clinic_01`:
     { 
       type: "STATUS_CHANGED", 
       visitId: "vis_1038", 
       tokenId: "A-12", 
       newStatus: "NO_SHOW" 
     }
   │
   ├── Patient Screens (Screen 05):
   │      → Patients behind #A-12 see "Patients Ahead" drop by 1 instantly
   │      → Wait times shrink without page reload
   │
   └── Doctor Desk (Screen 07):
          → Token #A-12 vanishes from Up-Next list; next patient moves into position #1
   │
   ▼
API Returns 200 OK: { success: true, updatedStatus: "NO_SHOW" }
   │
   ▼
Reception Console (Screen 06):
   * Row for #A-12 gets strike-through text and red badge
   * Increments "No-Shows / Cancelled" KPI counter
   * Decrements "Waiting in Lobby" counter
```

---

### 6.2 Manual Check-In Fallback Flow (Camera Failure / No Smartphone)

```
Patient arrives at desk: "My phone battery is dead / camera cannot scan QR code."
   │
   ▼
Receptionist searches patient booking by phone number (+91 9876543210)
   │
   ▼
API: GET /api/v1/appointments/search?phone=9876543210&date=today
   │
   ▼
Returns matching appointment: { appointmentId: "appt_9042", doctor: "Dr. Rajesh Sharma", slot: "10:30 AM" }
   │
   ▼
Receptionist clicks "Manual Check-In Override"
   │
   ▼
API: POST /api/v1/visits/check-in/manual  (Headers: Staff JWT)
Payload: { appointmentId: "appt_9042", clinicId: "clinic_01", overrideReason: "CAMERA_FAILURE" }
   │
   ▼
Backend validates arrival window and mints sequential token `#A-17`
   │
   ▼
Inserts `Visits` document (`status: 'IN_QUEUE'`, `checkedInAt: NOW()`)
   │
   ▼
Emits WebSocket "QUEUE_UPDATED"
   │
   ▼
API Returns 201 Created: { tokenId: "A-17", position: 3, ETA: "20-30 mins" }
   │
   ▼
Receptionist hands printed thermal slip or token card #A-17 to patient
```

---

## 7. Doctor Clinical Workflow: Consultation Encounter

### 7.1 Starting Consultation Encounter (`IN_QUEUE` → `CHECK_UP`)

```
Doctor Desk (Screen 07) → Doctor finishes previous patient and is ready for next
   │
   ▼
Doctor clicks primary button: "Call Next Patient (#A-14)"
   │
   ▼
API: PUT /api/v1/visits/vis_1040/start  (Headers: Doctor JWT)
   │
   ▼
AuthMiddleware: Verifies `role === 'DOCTOR'`, extracts `doctorId = req.user.sub`
   │
   ▼
VisitController (Consultation Start Handler):
   │
   ├── Concurrency Check: Is another visit already in CHECK_UP for this doctor?
   │      Visits.findOne({ doctorId: doctorId, status: "CHECK_UP" })
   │      │
   │      ├── Found Active Encounter
   │      │      → Returns 400 Bad Request: 
   │      │        { error: "ACTIVE_ENCOUNTER_EXISTS", activeVisitId: current._id }
   │      │      → Doctor Desk alerts: "Please complete or pause current consultation first."
   │      │
   │      └── No Active Encounter
   │             │
   │             ▼
   │      Database Update (Atomic):
   │         Visits.updateOne(
   │           { _id: ObjectId("vis_1040"), doctorId: doctorId, status: "IN_QUEUE" },
   │           { 
   │             $set: { 
   │               status: "CHECK_UP", 
   │               consultStartedAt: ISODate() 
   │             } 
   │           }
   │         )
   │
   ▼
Real-Time WebSocket Emission:
   * Targeted Event to `patient:patientId`:
     Event: "VISIT_CALLED" → Screen 05 launches Turn Alert Modal + audio chime
   * Broadcast Event to `clinic:clinic_01` & `doctor:doc_01`:
     Event: "QUEUE_UPDATED" → Reception updates row to `In Consult` (Green)
   │
   ▼
API Returns 200 OK:
   {
     success: true,
     status: "CHECK_UP",
     consultStartedAt: "2026-09-27T10:32:00.000Z",
     patient: {
       name: "Rahul Verma",
       age: 32,
       gender: "Male",
       phone: "9876543210",
       visitType: "NEW"
     }
   }
   │
   ▼
Doctor Desk UI (Screen 07):
   * Loads patient demographics into Active Encounter Card
   * Resets consultation digital timer to `00:00` and starts live second count-up
   * Prepares blank Vitals input fields (`BP`, `Sugar`, `Weight`)
   * Advances Up-Next drawer preview
```

---

### 7.2 Completing Consultation Encounter & Recording Vitals (`CHECK_UP` → `DONE`)

```
Doctor finishes clinical examination → Enters Vitals into form:
   * Blood Pressure: "120/80"
   * Blood Sugar: 98
   * Body Weight: 72.5
   * Consultation Notes: "Acute upper respiratory viral. Advised rest."
   │
   ▼
Doctor clicks primary CTA: "Complete Consult & Call Next (#A-15)"
   │
   ▼
API: PUT /api/v1/visits/vis_1040/complete  (Headers: Doctor JWT)
Payload:
{
  vitals: {
    bp: "120/80",
    sugar: 98,
    weight: 72.5
  },
  notes: "Acute upper respiratory viral. Advised rest."
}
   │
   ▼
AuthMiddleware: Verifies `role === 'DOCTOR'`
   │
   ▼
ValidationMiddleware:
   * Validates BP format (e.g., regex `^\d{2,3}\/\d{2,3}$`)
   * Validates numeric bounds: sugar (40–600), weight (1–300)
   │
   ▼
VisitController (Complete Handler):
   endTime = NOW()
   startTime = visit.consultStartedAt
   consultDurationMinutes = Math.round((endTime - startTime) / 60000)
   │
   ▼
Database Transaction (Atomic Update):
   Visits.updateOne(
     { _id: ObjectId("vis_1040"), doctorId: doctorId, status: "CHECK_UP" },
     {
       $set: {
         status: "DONE",
         consultEndedAt: endTime,
         vitals: {
           bp: "120/80",
           sugar: 98,
           weight: 72.5
         },
         notes: "Acute upper respiratory viral. Advised rest."
       }
     }
   )
   │
   ▼
Doctor Rolling Average Calculation:
   * Fetches doctor's last 5 completed visits today:
     Visits.find({ doctorId, status: "DONE" }).sort({ consultEndedAt: -1 }).limit(5)
   * Recomputes rolling average consult duration $\overline{T}_{\text{consult}}$
   * Updates cached doctor average in Redis / DB
   │
   ▼
Real-Time WebSocket Emission:
   * To Patient Socket (`patient:patientId`):
     Event: "VISIT_COMPLETED"
     Payload: { 
       tokenId: "A-14", 
       vitals: { bp: "120/80", sugar: 98, weight: 72.5 },
       completedAt: endTime 
     }
     → Patient Screen 05 renders Visit Summary Card & closes active queue
   * To Room `doctor:doc_01`:
     Event: "QUEUE_UPDATED"
     → All remaining patients decrement "Patients Ahead" by 1
     → Dynamic ETAs recalculate using new rolling average $\overline{T}_{\text{consult}}$
   * To Reception Desk (`clinic:clinic_01`):
     Event: "QUEUE_UPDATED"
     → Moves table row to `Done` (Grey/Green)
     → Increments "Completed Today" counter: 18 → 19
   │
   ▼
API Returns 200 OK:
   {
     success: true,
     status: "DONE",
     consultDurationMinutes: 11,
     nextPatient: {
       visitId: "vis_1041",
       tokenId: "A-15",
       patientName: "Kavita Mehra"
     }
   }
   │
   ▼
Doctor Desk UI (Screen 07):
   * Resets vitals form inputs
   * Automatically prepares next patient record (#A-15) for single-click start
```

---

## 8. Doctor Availability & Break State Propagation Workflow

```
Doctor needs a 10-minute tea break → Clicks "Take 10m Break" on Screen 07
   │
   ▼
API: PUT /api/v1/doctors/status  (Headers: Doctor JWT)
Payload: { status: "ON_BREAK", breakDurationMinutes: 10 }
   │
   ▼
AuthMiddleware: Verifies `role === 'DOCTOR'`
   │
   ▼
DoctorController:
   * Updates Doctor status in Users collection:
     Users.updateOne({ _id: doctorId }, { $set: { "availability.status": "ON_BREAK", "availability.breakUntil": NOW() + 10m } })
   │
   ▼
Real-Time WebSocket Emission:
   * Broadcasts to `doctor:doc_01` and `clinic:clinic_01`:
     Event: "DOCTOR_STATUS_CHANGED"
     Payload: { 
       doctorId: "doc_01", 
       status: "ON_BREAK", 
       breakMinutes: 10,
       breakUntil: "11:45 AM" 
     }
   │
   ├── Reception Console (Screen 06):
   │      → Doctor filter tab shows amber badge: "Dr. Sharma • On 10m Break"
   │
   └── All Waiting Patients of Doctor (Screen 05):
          → Doctor status pill changes to: "Doctor on 10m Break" (Amber)
          → Dynamic ETA ranges automatically add +10 minutes (e.g., 20–30m → 30–40m)
          → Reassures waiting patients that delays are scheduled, reducing lobby anxiety
   │
   ▼
API Returns 200 OK: { success: true, status: "ON_BREAK" }
   │
   ▼
[When Doctor Returns]
Doctor clicks "End Break / Resume Consultations" → PUT /api/v1/doctors/status { status: "AVAILABLE" }
   → Broadcasts "DOCTOR_STATUS_CHANGED" { status: "AVAILABLE" }
   → Waiting ETAs adjust back down; status pill turns green
```

---

## 9. WebSocket Disconnection & Resilience Recovery Workflow

```
Patient in waiting room encounters cellular signal drop / Wi-Fi blink
   │
   ▼
Client-side WebSocket connection triggers `onclose` / `onerror`
   │
   ▼
Client UI (Screen 05):
   * Sets top connection pill to amber: "Reconnecting to live queue..."
   * Locks dynamic position counters from disappearing
   * Freezes last verified ETA range with timestamp: "Cached wait: 20–30m (as of 10:22 AM)"
   │
   ▼
Client Exponential Backoff Retry Engine:
   * Attempts reconnect at 1s, 2s, 4s, 8s (jittered)
   │
   ├── Network Reconnect Successful
   │      │
   │      ▼
   │   WS `onopen` triggers
   │   Client sends REST Sync: GET /api/v1/visits/my-status
   │   Backend returns fresh live queue position, currently serving token, and current doctor state
   │   Client UI silently re-aligns counters to ground truth
   │   Connection pill pulses green: "● WebSocket Sync Active"
   │
   └── Network Stays Down > 30 seconds
          * Client reveals manual action button: "Tap to Retry Connection"
          * User can manually trigger REST re-sync without losing token state
```

---

## 10. Summary Matrix: Endpoints, Payloads, DB Impact & Events

| Endpoint | Method | Actor | Primary DB Collection | Document State Impact | WebSocket Event Emitted | Real-Time Consumer |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/auth/otp/send` | `POST` | Patient | Redis | Creates hashed OTP key (TTL 5m) | *None* | Client |
| `/api/v1/auth/otp/verify` | `POST` | Patient | `Users` | Resolves or creates `Users` doc | *None* | Client (JWT saved) |
| `/api/v1/auth/staff/login` | `POST` | Staff | `Users`, `Clinics` | Reads user and verifies bcrypt hash | *None* | Staff Client (JWT saved) |
| `/api/v1/appointments` | `POST` | Patient | `Appointments` | Inserts record (`status: BOOKED`) | *None* | Client (Confirmation) |
| `/api/v1/visits/check-in` | `POST` | Patient | `Visits`, `Appointments` | Inserts `Visits` (`status: IN_QUEUE`, mints `tokenId`) | `QUEUE_UPDATED` | Reception & Doctor Desks |
| `/api/v1/visits/my-status` | `GET` | Patient | `Visits` | Reads queue count & active encounters | *None* | Patient Live Screen |
| `/api/v1/visits/walk-in` | `POST` | Reception | `Visits`, `Users` | Inserts `Visits` (`appointmentId: null`, urgent flag) | `QUEUE_UPDATED` | Doctor & Patient Desks |
| `/api/v1/visits/:id/status`| `PUT` | Reception | `Visits` | Updates `status: NO_SHOW` or `CANCELLED` | `QUEUE_UPDATED` | Doctor & Patient Desks |
| `/api/v1/visits/:id/start` | `PUT` | Doctor | `Visits` | Updates `status: CHECK_UP`, `consultStartedAt` | `VISIT_CALLED` | Called Patient & Queue |
| `/api/v1/visits/:id/complete`| `PUT`| Doctor | `Visits`, `Users` | Updates `status: DONE`, logs `vitals`, updates avg | `VISIT_COMPLETED` & `QUEUE_UPDATED` | Completed Patient & Queue |
| `/api/v1/doctors/status` | `PUT` | Doctor | `Users` | Updates `availability.status` (`ON_BREAK`) | `DOCTOR_STATUS_CHANGED` | All Waiting Patients |
