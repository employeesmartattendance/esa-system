# 🧠 ESA v2.0 — Employee Smart Attendance System

A **production-ready, multi-tenant smart attendance platform** for schools.  
GPS geofencing · Wi-Fi validation · Real-time Socket.io · Dark mode · Mobile-first · Premium UI

---

## 🚀 Quick Start

### Prerequisites

| Tool    | Min Version |
| ------- | ----------- |
| Node.js | ≥ 18.x      |
| MySQL   | ≥ 8.0       |
| npm     | ≥ 9.x       |

---

## 🗄️ 1. Database Setup

```bash
# Log into MySQL
mysql -u root -p

# Run the schema (creates database + all tables)
SOURCE /path/to/esa-system/database/schema.sql;
exit;
```

---

## ⚙️ 2. Backend Setup

```bash
cd backend

# Copy and configure environment
cp .env.example .env
# Edit .env — set DB_PASSWORD and JWT_SECRET

# Install dependencies
npm install

# Start (development with auto-reload)
npm run dev

# Start (production)
npm start
```

Backend runs on → **https://esa-system.onrender.com**

> ✅ **Super Admin is auto-created on first run:**
>
> - Email: `superadmin@esa.com`
> - Password: `superadmin123`  
>   🔒 Change this password after first login!

---

## 🖥️ 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on → **https://esasystem.online**

---

## 🔑 First-Time Setup Workflow

1. **Login** as Super Admin → `superadmin@esa.com` / `superadmin123`
2. **Schools** → Create a school (fill school name + admin credentials)
3. **Login** as School Admin (with credentials just created)
4. **Settings** → Configure GPS coordinates, radius, Wi-Fi BSSID, time rules
5. **Teachers** → Add teachers with their login credentials
6. Teachers **login** and start checking in!

---

## 👤 Role-Based Routing

| Role            | Redirect             | Access                                          |
| --------------- | -------------------- | ----------------------------------------------- |
| 👑 Super Admin  | `/super/dashboard`   | All schools, system logs, platform stats        |
| 🏫 School Admin | `/school/dashboard`  | Teachers, attendance, settings for their school |
| 🧑‍🏫 Teacher      | `/teacher/dashboard` | Check-in/out, personal attendance history       |

---

## 🏗️ Project Structure

```
esa-system/
├── backend/
│   ├── app.js              ← ALL backend code (single file, ~1400 lines)
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── capacitor.config.json
│   ├── package.json
│   └── src/
│       ├── main.js
│       ├── App.vue
│       ├── api.js           ← Axios instance + interceptors
│       ├── socket.js        ← Socket.io client
│       │
│       ├── composables/
│       │   ├── useDark.js   ← Dark mode (persisted)
│       │   └── useToast.js  ← Toast injection
│       │
│       ├── stores/
│       │   └── auth.js      ← Pinia auth store (JWT)
│       │
│       ├── router/
│       │   └── index.js     ← Vue Router + role guards
│       │
│       ├── views/           ← Page-level components (route targets)
│       │   ├── LoginView.vue
│       │   ├── SuperAdminDashboard.vue
│       │   ├── SchoolAdminDashboard.vue
│       │   └── TeacherDashboard.vue
│       │
│       ├── components/
│       │   ├── ui/          ← Reusable UI library
│       │   │   ├── AppIcon.vue        (40+ SVG icons)
│       │   │   ├── AppModal.vue       (animated modal)
│       │   │   ├── AppBadge.vue       (status badges)
│       │   │   ├── StatCard.vue       (animated stat cards)
│       │   │   ├── DataTable.vue      (search/sort/paginate)
│       │   │   ├── EmptyState.vue
│       │   │   └── ToastNotification.vue
│       │   │
│       │   ├── layout/      ← Layout system
│       │   │   ├── AppSidebar.vue     (mobile hamburger + overlay)
│       │   │   ├── TopBar.vue         (live badge, theme toggle)
│       │   │   └── DashboardLayout.vue (wrapper with toast provider)
│       │   │
│       │   ├── super/       ← Super Admin features
│       │   │   ├── SuperOverview.vue  (donut chart, system status)
│       │   │   ├── SchoolsManager.vue (full CRUD)
│       │   │   └── SystemLogs.vue
│       │   │
│       │   ├── school/      ← School Admin features
│       │   │   ├── SchoolOverview.vue (live teacher status)
│       │   │   ├── TeachersManager.vue (full CRUD)
│       │   │   ├── AttendanceView.vue  (filters, CSV export)
│       │   │   └── SettingsPanel.vue   (GPS slider, WiFi, times)
│       │   │
│       │   └── teacher/     ← Teacher features
│       │       ├── CheckInCard.vue    (GPS check-in, validation)
│       │       └── AttendanceHistory.vue (monthly calendar)
│       │
│       └── assets/
│           └── main.css     ← Global styles (dark mode, glassmorphism)
│
└── database/
    └── schema.sql
```

---

## 📡 API Reference

### Auth

| Method | Path              | Auth     |
| ------ | ----------------- | -------- |
| POST   | `/api/auth/login` | Public   |
| GET    | `/api/auth/me`    | Any role |

### Super Admin

| Method              | Path                      |
| ------------------- | ------------------------- |
| GET                 | `/api/super/stats`        |
| GET/POST/PUT/DELETE | `/api/schools`            |
| PATCH               | `/api/schools/:id/status` |
| GET                 | `/api/logs`               |

### School Admin

| Method              | Path                |
| ------------------- | ------------------- |
| GET                 | `/api/school/stats` |
| GET/POST/PUT/DELETE | `/api/teachers`     |
| GET                 | `/api/attendance`   |
| GET/POST            | `/api/settings`     |

### Teacher

| Method | Path                       |
| ------ | -------------------------- |
| GET    | `/api/attendance/today`    |
| GET    | `/api/attendance/my`       |
| POST   | `/api/attendance/checkin`  |
| POST   | `/api/attendance/checkout` |
| GET    | `/api/school/info`         |

---

## ⚡ Real-Time Events (Socket.io)

| Event               | Trigger                  |
| ------------------- | ------------------------ |
| `attendance_marked` | Teacher checks in or out |
| `teacher_updated`   | Teacher CRUD             |
| `school_created`    | New school added         |

---

## 📱 Mobile (Capacitor)

```bash
cd frontend
npm run build
npx cap add android
npx cap sync
npx cap open android
```

Android permissions required:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.INTERNET" />
```

---

## 🚀 Production Deployment

```bash
# Backend (PM2)
npm install -g pm2
cd backend && pm2 start app.js --name esa-api

# Frontend (build + serve with Nginx)
cd frontend && npm run build
# Point Nginx root to frontend/dist/
# Proxy /api and /socket.io to localhost:3000
```

---

## 🔒 Security

- JWT (24h expiry, configurable)
- bcrypt password hashing (12 rounds)
- Rate limiting: 200 req/15min per IP
- Helmet.js security headers
- Parameterized queries (SQL injection proof)
- CORS locked to frontend origin

---

_ESA v2.0 · Vue 3 + Node.js + MySQL + Socket.io · Premium UI with 32 Components_
