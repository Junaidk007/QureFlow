# QureFlow: MVP Ideation & Scope

**QureFlow** solves unpredictable clinic waits by providing a real-time, synchronized queue management system.

**The Core Flow:** Register → Login → Book → Arrive → QR Check-in → Get Token → Track Live Queue → Consult → Done.

## MVP Scope (MoSCoW)
**🔴 MUST-HAVE (Core Loop):**
- Patient ID (Permanent) vs. Token ID (Visit-specific).
- User Registration & Login via Email + Username + Password (no OTP, no phone-based auth).
- Appointment Booking & QR-based Validation Check-in.
- Live Queue Generation based on actual arrivals, not just scheduled times.
- State Machine: `BOOKED` → `CHECKED_IN` → `IN_QUEUE` → `CHECK_UP` → `DONE`.
- Dynamic ETA Range (e.g., 25–40 mins) based on historical consultation averages.
- Dashboards for 3 Roles: Patient, Reception, Doctor.

**🟡 SHOULD-HAVE:**
- Exception states (`NO_SHOW`, `CANCELLED`).
- Queue corrections for Walk-ins.
- Basic visual notifications ("You're next").

**⚫ WON'T-HAVE (Out of Scope for MVP):**
- Payments, Full EMR, Advanced AI diagnostics, Telemedicine, Insurance, OTP/SMS auth.

---

## Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| **Framework** | React (latest) |
| **Component Library** | shadcn/ui (Radix primitives + CSS variables) |
| **Icons** | Font Awesome 6, Material UI (`@mui/icons-material`) |
| **Styling** | Custom CSS (CSS custom properties / design tokens) |
| **State Management** | React Context API |
| **Routing** | React Router (latest) |
| **Environment** | dotenv (`.env` files) |
| **Deployment** | Vercel |

### Backend
| Layer | Technology |
|---|---|
| **Runtime / Framework** | Node.js + Express (latest) |
| **Input Validation** | Joi |
| **ODM** | Mongoose |
| **Authentication** | JWT (jsonwebtoken) — email/username + password, no OTP |
| **Password Hashing** | bcrypt |
| **Real-Time** | WebSocket (`ws` library) |
| **Environment** | dotenv (`.env` files) |

### Database
| Layer | Technology |
|---|---|
| **Database** | MongoDB (Atlas or self-hosted) |
| **ODM** | Mongoose (schema + model layer) |

### Auth Strategy
- **Patient registration:** username + email + password (bcrypt hashed).
- **Patient login:** email OR username + password → JWT issued (30-day expiry).
- **Staff login:** email + password → JWT issued (12-hour expiry).
- **No OTP, no SMS, no phone-based auth anywhere in the system.**

---

## Key Technical & Product Mechanics

### 1. Booking vs. Live Queue
Booking secures a slot, but the **live queue** only includes patients who have physically arrived and checked in via QR. Queue position is derived dynamically from the list of `IN_QUEUE` patients.

### 2. State Ownership
- **Patient:** Triggers `BOOKED`.
- **System/Reception (via QR):** Validates and triggers `CHECKED_IN` → `IN_QUEUE`.
- **Doctor:** Triggers `CHECK_UP` (Starts timer) and `DONE` (Ends timer).
- **Reception:** Manages exceptions (`NO_SHOW`, Walk-ins).

### 3. Real-Time ETA Calculation
The ETA is always a range, calculated using the doctor's recent average consultation time multiplied by patients ahead, plus the remaining time of the current consultation.

## Success Metrics
- **Queue Position Accuracy:** Does the screen match reality?
- **ETA Usefulness:** Is the estimated range reliable?
- **Sync Reliability:** Do patient screens update instantly when the doctor clicks "Next"?
