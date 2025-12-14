# Environment Setup & Debugging Guide

## 🔧 Question Bank Loading Issue - Diagnostic Steps

### Issue Description
Question banks are not loading when clicking the "Question Bank" button in the admin panel.

---

## 📋 Required Environment Variables

Your application requires the following environment variables to be configured in **Vercel Dashboard**:

### Critical (Required for Question Bank):
1. **AIRTABLE_PERSONAL_ACCESS_TOKEN**
   - Get from: https://airtable.com/create/tokens
   - Required permissions: `data.records:read`, `data.records:write`, `schema.bases:read`
   - Example: `pat_XXXXXXXXXXXXXXXXXXXXX`

2. **AIRTABLE_BASE_ID**
   - Your base ID: `appYldhnqN8AdNgSF`
   - Find it in your Airtable URL: `https://airtable.com/appYldhnqN8AdNgSF/...`

### Optional (For Full Functionality):
3. **GEMINI_API_KEY** - For AI question generation
4. **SMTP_HOST**, **SMTP_PORT**, **SMTP_USER**, **SMTP_PASSWORD**, **SMTP_FROM** - For email
5. **APP_URL** - Your application URL (default: `https://polite-exam.vercel.app`)
6. **ADMIN_USERNAME**, **ADMIN_PASSWORD** - Admin credentials
7. **PASSWORD_SALT** - For password hashing

---

## 🔍 How to Configure Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard
1. Visit https://vercel.com/dashboard
2. Select your project: **polite-exam**
3. Click **Settings** tab
4. Click **Environment Variables** in the sidebar

### Step 2: Add Required Variables
For each variable:
1. Click **"Add New"**
2. Enter **Name**: `AIRTABLE_PERSONAL_ACCESS_TOKEN`
3. Enter **Value**: Your actual token
4. Select **Environment**: Production, Preview, Development (select all)
5. Click **Save**

### Step 3: Redeploy
After adding environment variables:
1. Go to **Deployments** tab
2. Click the **...** menu on the latest deployment
3. Click **Redeploy**
4. Check **"Use existing Build Cache"** (optional)
5. Click **Redeploy**

---

## 🐛 Debugging Steps

### 1. Check Browser Console (Frontend Logs)

Open your browser console (F12 or Cmd+Option+I) and click the "Question Bank" button.

**Expected logs:**
```
🔍 Environment: {protocol: "https:", hostname: "polite-exam.vercel.app", ...}
✅ API URL: /api
🔍 Loading questions from: /api/questions
📡 Response status: 200 OK
📦 Response data: {success: true, data: [...], count: X}
✅ Loaded X questions from database
```

**If you see errors:**
- ❌ `Failed to fetch` → Network error, API not responding
- ❌ `Response status: 500` → Server error, check environment variables
- ❌ `Response status: 404` → API endpoint not found
- ❌ `success: false` → Check the error message in the response

### 2. Check Vercel Function Logs (Backend Logs)

1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** tab
3. Click on the active deployment
4. Click **Functions** tab
5. Click on **api/index.js**
6. View the function logs

**Expected logs:**
```
🔍 GET /api/questions - Request received
📋 Environment check: {hasToken: true, hasBaseId: true, baseId: "appYldhn..."}
📡 Fetching questions from Airtable table: Questions
✅ Retrieved X records from Airtable
📦 Returning X questions
```

**If you see errors:**
- ❌ `hasToken: false` → AIRTABLE_PERSONAL_ACCESS_TOKEN not configured
- ❌ `hasBaseId: false` → AIRTABLE_BASE_ID not configured
- ❌ `INVALID_REQUEST_AUTHENTICATION` → Token is invalid or expired
- ❌ `NOT_FOUND` → Table name is wrong or doesn't exist
- ❌ `INVALID_PERMISSIONS` → Token doesn't have required permissions

### 3. Test API Endpoint Directly

Open this URL in your browser:
```
https://polite-exam.vercel.app/api/questions
```

**Expected response:**
```json
{
  "success": true,
  "data": [...],
  "count": 123
}
```

**If you see:**
- `{"success": false, "error": "..."}` → Read the error message
- `404 Not Found` → API is not deployed correctly
- `500 Internal Server Error` → Check function logs for details

### 4. Test Health Check Endpoint

Visit:
```
https://polite-exam.vercel.app/api/health
```

**Expected response:**
```json
{
  "status": "ok",
  "services": {
    "airtable": {
      "status": "connected",
      "message": "Database connected"
    },
    ...
  },
  "timestamp": "2025-12-14T..."
}
```

---

## 🔑 Airtable Setup Checklist

### 1. Create Personal Access Token
1. Go to https://airtable.com/create/tokens
2. Click **"Create new token"**
3. Name it: "Polite Exam App"
4. Add scopes:
   - ✅ `data.records:read`
   - ✅ `data.records:write`
   - ✅ `schema.bases:read`
5. Add access to your base: `appYldhnqN8AdNgSF`
6. Click **Create token**
7. **Copy the token** (you won't see it again!)

### 2. Verify Airtable Base Structure
Your base should have these tables:
- ✅ **Questions** - All exam questions
- ✅ **Exams** - Exam configurations
- ✅ **Results** - Student exam results
- ✅ **Candidates** - Student accounts

### 3. Questions Table Required Fields
The Questions table should have these columns:
- `ID` (Single line text) - e.g., "Q001"
- `Subject` (Single select) - e.g., "Math", "English"
- `Question` (Long text) - Question text
- `Option A`, `Option B`, `Option C`, `Option D` (Single line text)
- `Correct` (Single select) - "A", "B", "C", or "D"
- `Difficulty` (Single select) - "Easy", "Medium", "Hard"
- `Question Type` (Single select) - "Standalone", "Parent-child"
- `Parent Question` (Link to another record) - For sub-questions
- `Sub Question Number` (Number) - For ordering sub-questions
- `Main Question Text` (Long text) - For parent questions (passage/preamble)

---

## 🚀 Quick Fix Steps

### Most Common Issue: Missing Environment Variables

**Solution:**
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Add `AIRTABLE_PERSONAL_ACCESS_TOKEN` with your token
3. Add `AIRTABLE_BASE_ID` with value: `appYldhnqN8AdNgSF`
4. Redeploy your application

### Second Most Common: Token Permissions

**Solution:**
1. Go to https://airtable.com/create/tokens
2. Find your token
3. Verify it has these scopes:
   - `data.records:read` ✅
   - `data.records:write` ✅
   - `schema.bases:read` ✅
4. Verify it has access to base `appYldhnqN8AdNgSF` ✅
5. If not, create a new token with correct permissions

### Third Most Common: Expired Token

**Solution:**
1. Create a new Personal Access Token
2. Update `AIRTABLE_PERSONAL_ACCESS_TOKEN` in Vercel
3. Redeploy

---

## 📞 Support & Troubleshooting

### Still Not Working?

1. **Clear your browser cache:**
   - Admin Panel → Click "Clear All Cache" button (red button)
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

2. **Check Vercel deployment:**
   - Ensure latest deployment is successful (green checkmark)
   - Check for any build errors
   - Verify function is deployed: `api/index.js`

3. **Test with sample API call:**
   ```javascript
   // Open browser console and run:
   fetch('/api/questions')
     .then(r => r.json())
     .then(d => console.log('API Response:', d))
     .catch(e => console.error('API Error:', e));
   ```

4. **Verify Airtable access:**
   - Open Airtable in browser
   - Verify you can see Questions table
   - Verify there are questions in the table
   - Check table name is exactly "Questions" (case-sensitive)

---

## ✅ Success Indicators

Your question bank is working correctly when you see:

1. **Browser Console:**
   ```
   ✅ Loaded 123 questions from database
   📋 Grouped 123 questions into 100 display items
   ```

2. **Question Bank Screen:**
   - Questions appear in a list
   - You can search and filter questions
   - You can edit/delete questions
   - No error messages

3. **API Response:**
   ```json
   {
     "success": true,
     "data": [...],
     "count": 123
   }
   ```

---

## 📝 Notes

- All console logs use emojis for easy identification:
  - 🔍 = Investigation/Debug
  - 📡 = Network/API call
  - 📦 = Data processing
  - ✅ = Success
  - ❌ = Error
  - 📋 = Configuration

- Logs appear in both:
  - **Browser Console** (frontend logs)
  - **Vercel Function Logs** (backend logs)

- After any configuration change in Vercel, always **redeploy** the application

---

## 🎯 Next Steps After Fixing

Once questions are loading:
1. Test creating new questions
2. Test editing questions
3. Test deleting questions
4. Test search and filter
5. Test exam creation with questions
6. Test parent-child question display
7. Test data interpretation questions

---

**Last Updated:** 2025-12-14
**Version:** 1.0
**For:** Polite Exam Platform
