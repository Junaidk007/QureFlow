# 🚀 QureFlow Deployment Guide

This guide provides end-to-end instructions for deploying the **QureFlow Backend to Render** and the **QureFlow Frontend to Vercel**, along with configuring **MongoDB Atlas** and **WebSockets**.

---

## 📋 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Database Setup (MongoDB Atlas)](#2-database-setup-mongodb-atlas)
3. [Backend Deployment (Render)](#3-backend-deployment-render)
4. [Frontend Deployment (Vercel)](#4-frontend-deployment-vercel)
5. [Database Seeding (Production)](#5-database-seeding-production)
6. [WebSocket Verification](#6-websocket-verification)
7. [Environment Variables Reference](#7-environment-variables-reference)

---

## 1. Prerequisites
- A GitHub repository with your latest project commits pushed.
- A free account on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
- A free account on [Render](https://render.com).
- A free account on [Vercel](https://vercel.com).

---

## 2. Database Setup (MongoDB Atlas)

Since local MongoDB (`mongodb://127.0.0.1:27017`) cannot be reached by cloud servers, you need a cloud-hosted MongoDB instance:

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com).
2. Click **Create a Deployment** and select the **M0 Free Tier** cluster.
3. Choose a cloud provider and region closest to your users.
4. **Create Database User**:
   - Go to **Security > Database Access**.
   - Click **Add New Database User**.
   - Set Authentication Method to **Password**.
   - Enter a username (e.g. `qureflow_admin`) and a secure password.
   - Set user privileges to **Read and write to any database**.
5. **Configure Network Access**:
   - Go to **Security > Network Access**.
   - Click **Add IP Address**.
   - Click **Allow Access from Anywhere** (`0.0.0.0/0`) so Render instances can connect.
   - Click **Confirm**.
6. **Obtain Connection String**:
   - Go to **Database > Clusters**.
   - Click **Connect** on your cluster.
   - Choose **Drivers** (Node.js).
   - Copy the SRV connection string:
     ```text
     mongodb+srv://<username>:<password>@cluster0.xxxx.mongodb.net/qureflow?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your actual credentials.

---

## 3. Backend Deployment (Render)

Render supports persistent Node.js HTTP servers and WebSockets out of the box.

### Step 3.1: Create Web Service on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** in the top right corner and select **Web Service**.
3. Connect your GitHub repository (`mediQ` or your repo name).
4. Fill in the deployment settings:
   - **Name**: `qureflow-backend` (or your preferred name)
   - **Region**: Select the region nearest to your MongoDB Atlas region (e.g., Frankfurt, Oregon, Singapore).
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `server` ⚠️ *(Critical: do not leave empty)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

### Step 3.2: Configure Environment Variables on Render
Under the **Environment Variables** section, add the following key-value pairs:

| Key | Value | Description |
|---|---|---|
| `NODE_ENV` | `production` | Enables production optimizations |
| `PORT` | `10000` | Render defaults to 10000 (handled automatically) |
| `MONGO_URI` | `mongodb+srv://<user>:<password>@cluster0.xxx.mongodb.net/qureflow?retryWrites=true&w=majority` | Your MongoDB Atlas connection URI |
| `JWT_SECRET` | `generate-a-strong-random-secret-string-here-min-32-chars` | Cryptographic secret for signing JWT tokens |

### Step 3.3: Deploy
1. Click **Create Web Service**.
2. Render will clone the repo, install packages, and launch `node src/server.js`.
3. When deployment finishes, your service URL will appear at the top:
   - Example: `https://qureflow-backend.onrender.com`
4. Test the health endpoint in your browser:
   - `https://qureflow-backend.onrender.com/api/v1/health`
   - You should see:
     ```json
     {
       "success": true,
       "message": "QureFlow backend service is healthy",
       "data": {
         "service": "QureFlow API",
         "database": "connected"
       }
     }
     ```

---

## 4. Frontend Deployment (Vercel)

Vercel is optimal for React + Vite single-page applications.

### Step 4.1: Import Project to Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New... > Project**.
3. Import your GitHub repository.
4. In the **Configure Project** screen:
   - **Project Name**: `qureflow` (or your preferred name)
   - **Framework Preset**: `Vite` (auto-detected)
   - **Root Directory**: Click **Edit** and select `client` ⚠️ *(Critical: set to `client`)*
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `dist` (auto-detected)

### Step 4.2: Configure Environment Variables on Vercel
Expand **Environment Variables** and add:

| Key | Value | Notes |
|---|---|---|
| `VITE_API_URL` | `https://your-backend-app.onrender.com/api/v1` | Point to your Render backend `/api/v1` URL (no trailing slash) |
| `VITE_WS_URL` | `wss://your-backend-app.onrender.com` | Use `wss://` (secure WebSocket) with your Render host name |

> 💡 **Important:** Replace `your-backend-app.onrender.com` with your real Render domain from Step 3.3.

### Step 4.3: Deploy
1. Click **Deploy**.
2. Vercel will install dependencies and compile the production bundle with Vite.
3. Once deployed, you will receive a production URL (e.g., `https://qureflow.vercel.app`).
4. The included `client/vercel.json` ensures that deep routes (`/appointments`, `/queue`, `/book`, `/dashboard`) do not return 404 upon browser refresh.

---

## 5. Database Seeding (Production)

To initialize sample clinics, doctors, and demo users in your production MongoDB Atlas database:

### Option A: From Render Shell
1. Go to your Render Web Service dashboard.
2. Click **Shell** in the left menu.
3. Run:
   ```bash
   npm run seed
   ```

### Option B: From Your Local Terminal
Point your local `.env` temporarily to your Atlas database:
1. In `server/.env`:
   ```env
   MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxx.mongodb.net/qureflow?retryWrites=true&w=majority
   ```
2. In terminal, navigate to `server`:
   ```bash
   cd server
   npm run seed
   ```
3. This creates:
   - Central Medical Hub Clinic
   - Dr. Sarah Jenkins (Cardiology)
   - Dr. Marcus Chen (Pediatrics)
   - Receptionist account (`reception@qureflow.com` / `Password123!`)
   - Doctor account (`sarah.jenkins@qureflow.com` / `Password123!`)
   - Test Patient account (`patient@qureflow.com` / `Password123!`)

---

## 6. WebSocket Verification

- **Protocol**: When accessed over HTTPS on Vercel, the browser will automatically establish a secure WebSocket over `wss://`.
- **Render Support**: Render Web Services support persistent WebSocket connections out of the box with zero additional configuration needed.
- **Connection Test**:
  1. Open your Vercel deployment URL in browser.
  2. Open DevTools (`F12`) > **Console** / **Network** > **WS**.
  3. Log in as a patient or doctor.
  4. Look for an established WebSocket handshake:
     `wss://your-backend.onrender.com/?token=...` with status `101 Switching Protocols`.
  5. The UI shows `Live Sync Active` with a green pulsing indicator.

---

## 7. Environment Variables Reference

### Backend (`server/.env` / Render Settings)
```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/qureflow?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
```

### Frontend (`client/.env` / Vercel Settings)
```env
VITE_API_URL=https://qureflow-backend.onrender.com/api/v1
VITE_WS_URL=wss://qureflow-backend.onrender.com
```
