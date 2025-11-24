# 🔑 ENVIRONMENT VARIABLES - QUICK REFERENCE

## Copy-Paste These in Vercel Dashboard

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

---

## 📋 ALL 4 VARIABLES

### 1. Airtable Token
```
Name:  AIRTABLE_PERSONAL_ACCESS_TOKEN
Value: [Your token from https://airtable.com/create/tokens]
```

### 2. Airtable Base
```
Name:  AIRTABLE_BASE_ID
Value: appYldhnqN8AdNgSF
```

### 3. Gemini AI
```
Name:  GEMINI_API_KEY
Value: AIzaSyBRtCg_0CoovJq-muulJOE4tKxzzS-t0x4
```

### 4. OCR Service
```
Name:  OCR_SPACE_API_KEY
Value: K85624353188957
```

---

## ⚠️ IMPORTANT

**After adding all 4 variables:**
1. Click "Save" for each one
2. Go to "Deployments" tab
3. Click "⋯" on latest deployment
4. Click "Redeploy"
5. Wait for deployment to complete
6. Test your application!

---

## ✅ HOW TO VERIFY

### After Deployment:
1. Login as admin (password: politeadmin)
2. Check System Status panel:
   - Airtable Database: ✅ Connected
   - Gemini AI: ✅ Active
   - OCR Service: ✅ Ready

**All should show green checkmarks!**

---

## 🔒 SECURITY NOTES

- ✅ These variables are encrypted by Vercel
- ✅ Not visible in browser console
- ✅ Not accessible from frontend
- ✅ Only backend can access them
- ✅ Safe and secure!

---

## 📱 COPY VALUES

**Your Gemini API Key:**
```
AIzaSyBRtCg_0CoovJq-muulJOE4tKxzzS-t0x4
```

**Your OCR API Key:**
```
K85624353188957
```

**Your Airtable Base ID:**
```
appYldhnqN8AdNgSF
```

**Your Airtable Token:**
```
[Get from https://airtable.com/create/tokens]
```

---

## 🎯 QUICK STEPS

1. Open Vercel dashboard
2. Click your project
3. Click "Settings"
4. Click "Environment Variables"
5. Add each variable one by one
6. Click "Save" after each
7. Go to "Deployments"
8. Redeploy
9. Done! ✅

**Takes 2 minutes!**
