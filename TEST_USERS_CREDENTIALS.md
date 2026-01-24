# Test Users Credentials

This document contains login credentials for all test users created for testing different roles and permissions.

## Login URL
http://localhost:3000/login

## Test Users

### 1. Admin (מנהל מערכת)
**Email:** `admin@example.com`  
**Password:** `admin123`  
**Role:** `admin`  
**Permissions:**
- ✅ Can manage customers, workers, areas, sub-areas
- ❌ Cannot create monitoring or action reports

---

### 2. Customer Owner (בעל לקוח)
**Email:** `customer@example.com`  
**Password:** `customer123`  
**Role:** `customer_owner`  
**Permissions:**
- ✅ Can manage workers, areas, sub-areas for their customer
- ❌ Cannot create customers or reports

---

### 3. Inspector Worker (פקח יוסי)
**Email:** `inspector@example.com`  
**Password:** `inspector123`  
**Role:** `worker` (inspector)  
**Permissions:**
- ✅ Can create **Monitoring Reports** only
- ❌ Cannot create Action Reports

---

### 4. Spray Worker (רסס דני)
**Email:** `spray@example.com`  
**Password:** `spray123`  
**Role:** `worker` (action_worker)  
**Permissions:**
- ✅ Can create **Action Reports** only
- ❌ Cannot create Monitoring Reports

---

### 5. General Worker (עובד כללי שרה)
**Email:** `general@example.com`  
**Password:** `general123`  
**Role:** `worker` (general_worker)  
**Permissions:**
- ✅ Can create **both** Monitoring and Action Reports

---

## Quick Reference Table

| User | Email | Password | Can Create Monitoring | Can Create Action |
|------|-------|----------|----------------------|------------------|
| Admin | admin@example.com | admin123 | ❌ | ❌ |
| Customer Owner | customer@example.com | customer123 | ❌ | ❌ |
| Inspector | inspector@example.com | inspector123 | ✅ | ❌ |
| Spray Worker | spray@example.com | spray123 | ❌ | ✅ |
| General Worker | general@example.com | general123 | ✅ | ✅ |

## Recreating Test Users

To recreate all test users, run:

```bash
# Get service role key
npx supabase status --output json | grep SERVICE_ROLE_KEY

# Run the script
SUPABASE_SERVICE_ROLE_KEY=<your-key> npm run create-test-users
```

## Security Note

⚠️ **Important:** These are test credentials only! Change all passwords in production!
