# ESA MySQL → MongoDB Migration Notes

## What Changed

| Area | Before (MySQL) | After (MongoDB) |
|---|---|---|
| Database driver | `mysql2/promise` | `mongoose` |
| Connection | `mysql.createPool({...})` | `mongoose.connect(MONGODB_URI)` |
| Queries | Raw SQL strings | Mongoose model methods |
| Transactions | `conn.beginTransaction()` | `mongoose.startSession()` + `withTransaction()` |
| IDs | Integer AUTO_INCREMENT | ObjectId strings |
| Schema enforcement | MySQL DDL | Mongoose schemas with indexes |
| Duplicates (attendance) | `UNIQUE KEY (teacher_id, date)` | Mongoose unique compound index |
| Reports (names) | JSON string in TEXT column | Native MongoDB `[String]` array |

## Environment Setup

Replace your `.env` MySQL variables with:

```
MONGODB_URI=mongodb://localhost:27017/esa_db
```

### Local MongoDB
1. Install MongoDB Community Server: https://www.mongodb.com/try/download/community
2. Start: `mongod --dbpath C:\data\db`
3. Set `MONGODB_URI=mongodb://localhost:27017/esa_db`

### MongoDB Atlas (Cloud)
1. Create free cluster at https://cloud.mongodb.com
2. Set `MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/esa_db`

## Indexes Created Automatically

```
users:       { email: 1 } unique, { role: 1 }, { school_id: 1 }
teachers:    { user_id: 1 } unique, { school_id: 1 }
settings:    { school_id: 1 } unique
attendance:  { teacher_id: 1, date: 1 } unique, { school_id: 1, date: 1 }
logs:        { user_id: 1, timestamp: -1 }
reports:     { school_id: 1, report_date: -1 } unique
```

## ID Compatibility

- All `id` fields in API responses are now **ObjectId strings** (e.g. `"67efa3c1..."`) instead of integers.
- APIs return `{ id: "...", ... }` — the `id` virtual field is always present.
- JWT payload stores `id` and `school_id` as strings — fully compatible with existing frontend.

## API Compatibility — Unchanged Routes

All routes are 100% preserved:
- `POST /api/auth/login` ✅
- `GET /api/auth/me` ✅
- `GET /api/super/stats` ✅
- `POST /api/super/schools` ✅
- `GET /api/school/teachers` ✅
- `POST /api/attendance/checkin` ✅
- `POST /api/mobile/sync/bulk` ✅
- `GET /api/school/reports` ✅
- All route aliases preserved ✅

## Data Migration (Existing MySQL Data)

This migration does **not** auto-migrate existing MySQL data.
If you need to preserve existing records, run a one-time migration script using:
```bash
node migrate-from-mysql.js
```
(Script not included — request if needed)

## Starting the Server

```bash
cd web/backend
npm start
# or for development:
npm run dev
```

Expected output:
```
✅ Connected to MongoDB
ℹ️  Super Admin already exists  (or creates one on first boot)
✅ Mobile API routes registered
🚀 ESA Backend (MongoDB) running on port 3000
```
