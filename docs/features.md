# QureFlow: Features, APIs, and Architecture Blueprint

Based on the MVP scope, this document defines the database schema, API contracts, controller logic, and the complete request/response flow for the core functionalities of the QureFlow queue management system.

## 1. List of Features with their Importance (MVP Scope)

### Module A: User Auth & Profiles
| Feature | Importance | Description |
|---|---|---|
| Patient Registration / Login | MUST-HAVE | Core entry point for patients to use the system. |
| Doctor / Reception Login | MUST-HAVE | Core entry point for clinic staff. |

### Module B: Booking & Queue Management
| Feature | Importance | Description |
|---|---|---|
| View Available Doctors | MUST-HAVE | Required to select a doctor before booking. |
| Book Appointment | MUST-HAVE | Core transaction for the application. |
| Get Live Queue Status (Patient) | MUST-HAVE | Real-time queue position and ETA tracking. |

### Module C: Clinic Operations (Reception)
| Feature | Importance | Description |
|---|---|---|
| QR Check-in | MUST-HAVE | Transitions a booked appointment into the live physical queue. |
| Add Walk-in | SHOULD-HAVE | Exception handling for patients arriving without prior booking. |
| Mark No-Show | SHOULD-HAVE | Exception handling for missing patients. |
| Queue Correction | SHOULD-HAVE | Manual overrides by reception to fix queue inconsistencies. |

### Module D: Doctor Workflow
| Feature | Importance | Description |
|---|---|---|
| Start Consultation | MUST-HAVE | Moves patient from IN_QUEUE to CHECK_UP. Starts timer. |
| Complete Consultation & Add Vitals | MUST-HAVE | Moves patient to DONE. Ends timer. Records basic vitals. |
| Doctor State Management | MUST-HAVE | Update doctor availability (e.g. ON_BREAK). |

---

## 2. General Architecture Flow & Request Lifecycle

The following diagram illustrates the complete request/response lifecycle for any client request, from the UI down to the database and real-time syncing:

```mermaid
flowchart TD
    A["📱 Client Application<br/>(Patient/Doctor/Reception UI)"] -->|HTTP/REST / WebSocket| B["🔀 API Gateway / Router"]
    B --> C["🔐 Auth Middleware<br/>(Verifies JWT, extracts User/Role)"]
    C --> D["✅ Validation Middleware<br/>(Data schema validation)"]
    D --> E["⚙️ Controller Logic<br/>(Business rules, state updates, ETA)"]
    E --> F[("🗄️ Database Layer<br/>(Reads/Writes to DB)")]
    F --> G["⚡ Real-time Service<br/>(WebSockets - broadcasts to clients)"]
    G --> H["📨 Response<br/>(JSON Payload returned to Client)"]

    classDef client fill:#EFF6FF,stroke:#3B82F6,stroke-width:2px,color:#1E3A8A;
    classDef middleware fill:#F3E8FF,stroke:#8B5CF6,stroke-width:2px,color:#581C87;
    classDef logic fill:#ECFDF5,stroke:#10B981,stroke-width:2px,color:#064E3B;
    classDef db fill:#FEF3C7,stroke:#D97706,stroke-width:2px,color:#92400E;
    
    class A,H client;
    class B,C,D middleware;
    class E,G logic;
    class F db;
```

---

## 3. APIs List

| Module | Endpoint | Method | Request Body | Response Body | Controller Logic | Complete Flow |
|---|---|---|---|---|---|---|
| **Auth** | `/api/v1/auth/register` | `POST` | `{ username, email, password }` | `{ token, user: { id, role } }` | Validate uniqueness -> Hash password -> Create User -> Generate JWT. | `Client -> Joi Validation -> AuthController -> DB -> Res` |
| **Auth** | `/api/v1/auth/login` | `POST` | `{ identifier, password }` (identifier = email OR username) | `{ token, user: { id, role } }` | Find user by email/username -> bcrypt.compare -> Generate JWT. | `Client -> Joi Validation -> AuthController -> DB -> Res` |
| **Booking** | `/api/v1/appointments` | `POST` | `{ doctorId, date, time, type }` | `{ appointmentId, status }` | Validate doctor -> Check slot -> Create record. | `Client -> Auth -> Validation -> ApptController -> DB -> Res` |
| **Check-in** | `/api/v1/visits/check-in` | `POST` | `{ clinicId, appointmentId }` | `{ visitId, tokenId, status, ETA }` | Validate time window -> Generate token -> Fire WS event. | `Client -> Auth -> CheckInValidator -> VisitController -> DB/WS -> Res` |
| **Queue** | `/api/v1/visits/my-status` | `GET` | *None* | `{ tokenId, position, patientsAhead, ETA, doctorStatus }` | Count earlier `IN_QUEUE` visits -> Calculate ETA. | `Client -> Auth -> QueueController -> DB -> Res` |
| **Doctor** | `/api/v1/visits/:id/start` | `PUT` | *None* | `{ success: true, status: "CHECK_UP" }` | Ensure no active `CHECK_UP` -> Update status -> Fire WS. | `Client -> Auth -> VisitController -> DB/WS -> Res` |
| **Doctor** | `/api/v1/visits/:id/complete`| `PUT` | `{ vitals: { bp, sugar, weight } }` | `{ success: true, status: "DONE" }` | Update status to `DONE` -> Save vitals -> Fire WS. | `Client -> Auth -> VisitController -> DB/WS -> Res` |
| **Reception**| `/api/v1/visits/:id/status` | `PUT` | `{ status: "NO_SHOW" }` | `{ success: true }` | Update visit status -> Trigger WS recalculation. | `Client -> Auth -> QueueController -> DB/WS -> Res` |

---

## 4. Database Schema (NoSQL / MongoDB approach)

### Users Collection
Stores all users including Patients, Doctors, and Receptionists.
```json
{
  "_id": "ObjectId",
  "role": "enum('PATIENT', 'DOCTOR', 'RECEPTIONIST')",
  "name": "String",
  "username": "String (Unique — used for login identifier)",
  "email": "String (Unique — used for login identifier)",
  "passwordHash": "String (bcrypt)",
  "clinicId": "ObjectId (for Doctors & Receptionists only)",
  "specialization": "String (for Doctors only)",
  "createdAt": "Timestamp"
}
```

> **Auth Note:** Patients register with `username + email + password`. Login accepts `email OR username` as the identifier field. No phone field or OTP in the system.

### Appointments Collection
Stores scheduled appointments.
```json
{
  "_id": "ObjectId",
  "patientId": "ObjectId (Ref: Users)",
  "doctorId": "ObjectId (Ref: Users)",
  "clinicId": "ObjectId (Ref: Clinics)",
  "appointmentDate": "Date (YYYY-MM-DD)",
  "appointmentTime": "String (HH:mm)",
  "type": "enum('NEW', 'FOLLOW-UP')",
  "status": "enum('BOOKED', 'CANCELLED')"
}
```

### Visits (Queue & Tokens) Collection
Stores the actual visits and live queue states.
```json
{
  "_id": "ObjectId",
  "appointmentId": "ObjectId (Ref: Appointments, nullable for walk-ins)",
  "patientId": "ObjectId (Ref: Users)",
  "doctorId": "ObjectId (Ref: Users)",
  "clinicId": "ObjectId (Ref: Clinics)",
  "visitDate": "Date (YYYY-MM-DD)",
  "tokenId": "String (e.g., A-17)",
  "status": "enum('CHECKED_IN', 'IN_QUEUE', 'CHECK_UP', 'DONE', 'NO_SHOW', 'CANCELLED')",
  "isUrgent": "Boolean",
  "checkedInAt": "Timestamp",
  "consultStartedAt": "Timestamp",
  "consultEndedAt": "Timestamp",
  "vitals": {
    "bp": "String",
    "sugar": "Number",
    "weight": "Number"
  }
}
```

### Clinics Collection
```json
{
  "_id": "ObjectId",
  "name": "String",
  "address": "String",
  "checkInWindowStartMinutes": "Number (e.g., 15)",
  "checkInWindowEndMinutes": "Number (e.g., 15)"
}
```
