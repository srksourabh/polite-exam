# Android PWA - Complete Folder Structure

This document shows the complete file structure for your Android PWA deployment.

## 📁 Project Root Structure

```
polite-exam/
│
├── index.html                          # ✅ Main app (already configured with PWA tags)
├── manifest.json                       # ✅ PWA manifest (NEW - created)
├── sw.js                               # ✅ Service worker (NEW - created)
├── assetlinks.json                     # ✅ Digital Asset Links (NEW - created)
│
├── icons/                              # ✅ PWA icons folder (NEW - created)
│   ├── ICON-INSTRUCTIONS.md           # Icon generation guide
│   ├── icon-192.png                   # ⚠️ TO CREATE - 192x192 standard
│   ├── icon-512.png                   # ⚠️ TO CREATE - 512x512 standard
│   ├── icon-maskable-192.png          # ⚠️ TO CREATE - 192x192 maskable
│   └── icon-maskable-512.png          # ⚠️ TO CREATE - 512x512 maskable
│
├── api/                                # Existing API folder
│   └── [your API files]
│
├── .well-known/                        # ⚠️ TO CREATE on web server
│   └── assetlinks.json                # Copy from root after SHA256 update
│
├── ANDROID-DEPLOYMENT.md               # ✅ Complete deployment guide (NEW)
├── QUICK-START-ANDROID.md              # ✅ Fast-track guide (NEW)
└── FOLDER-STRUCTURE.md                 # ✅ This file (NEW)
```

## 📋 File Status Legend

- ✅ **Already exists / Just created** - Ready to use
- ⚠️ **Action required** - You need to create/configure this

## 🔍 Key Files Explained

### Core PWA Files

**manifest.json**
- Location: `/manifest.json`
- Purpose: Defines app metadata (name, icons, colors, display mode)
- Status: ✅ Created and configured
- Package name: `com.politecoaching.exam`

**sw.js**
- Location: `/sw.js`
- Purpose: Service worker for offline functionality
- Status: ✅ Created with cache-first strategy
- Cache name: `polite-exam-v1`

**assetlinks.json**
- Location: `/assetlinks.json` (root) and `/.well-known/assetlinks.json` (server)
- Purpose: Verifies ownership of domain for TWA
- Status: ✅ Created (needs SHA256 fingerprint update)

**index.html**
- Location: `/index.html`
- Purpose: Main application
- Status: ✅ Already has PWA meta tags and service worker registration
- Modifications: None needed!

### Icon Files (To Be Created)

**icons/icon-192.png**
- Size: 192x192 pixels
- Type: Standard PWA icon
- Usage: App launcher, notifications

**icons/icon-512.png**
- Size: 512x512 pixels
- Type: High-res PWA icon
- Usage: Splash screen, Play Store

**icons/icon-maskable-192.png**
- Size: 192x192 pixels
- Type: Maskable safe zone icon
- Usage: Adaptive icons on Android

**icons/icon-maskable-512.png**
- Size: 512x512 pixels
- Type: Maskable safe zone icon
- Usage: High-res adaptive icons

### Documentation Files

**ANDROID-DEPLOYMENT.md**
- Complete step-by-step deployment guide
- Includes troubleshooting section
- Play Store submission checklist

**QUICK-START-ANDROID.md**
- 30-minute fast-track guide
- Condensed steps for experienced developers

**FOLDER-STRUCTURE.md**
- This file
- Overview of all files and their purposes

## 🎯 What You Need to Do Next

### 1. Generate Icons (Required)
Follow instructions in `/icons/ICON-INSTRUCTIONS.md`
- Use https://www.pwabuilder.com/imageGenerator
- Create all 4 PNG files
- Place in `/icons/` folder

### 2. Deploy to Production (Required)
- Deploy your web app to HTTPS domain
- Ensure all files are accessible
- Test that manifest.json loads at `https://yourdomain.com/manifest.json`

### 3. Install Bubblewrap (Required)
```bash
npm install -g @bubblewrap/cli
```

### 4. Initialize Android Project
```bash
bubblewrap init --manifest=https://yourdomain.com/manifest.json
```

### 5. Build & Test
```bash
bubblewrap build
```

### 6. Update Digital Asset Links
- Build app to generate keystore
- Get SHA256 fingerprint
- Update `assetlinks.json` with real fingerprint
- Upload to `/.well-known/assetlinks.json` on your server

### 7. Build Production Version
```bash
bubblewrap build --release
```

### 8. Submit to Play Store
- Upload `app-release-bundle.aab`
- Complete store listing
- Submit for review

## 📦 Generated Files (After Bubblewrap Init)

After running `bubblewrap init`, these files will be created:

```
twa-manifest.json              # TWA configuration
android.keystore               # App signing key (KEEP SECRET!)
app-release-unsigned.apk       # Development build
app-release-bundle.aab         # Production build (for Play Store)
```

## 🔐 Important Security Notes

**android.keystore**
- Never commit to Git
- Backup securely
- Required for app updates
- Loss = can't update app on Play Store

**SHA256 Fingerprint**
- Unique to your keystore
- Required for Digital Asset Links
- Must match between app and assetlinks.json

## 🌐 Server Requirements

Your web server must serve these files:

```
https://yourdomain.com/manifest.json
https://yourdomain.com/sw.js
https://yourdomain.com/icons/icon-192.png
https://yourdomain.com/icons/icon-512.png
https://yourdomain.com/icons/icon-maskable-192.png
https://yourdomain.com/icons/icon-maskable-512.png
https://yourdomain.com/.well-known/assetlinks.json
```

All must be accessible via HTTPS!

## ✅ Verification Checklist

Before building:
- [ ] All 4 icon files created in `/icons/`
- [ ] `manifest.json` configured correctly
- [ ] `sw.js` present in root
- [ ] `index.html` has PWA meta tags (already done!)
- [ ] Web app deployed on HTTPS
- [ ] All files accessible via HTTPS

After building:
- [ ] `assetlinks.json` updated with SHA256
- [ ] `.well-known/assetlinks.json` uploaded to server
- [ ] `android.keystore` backed up securely
- [ ] App installs on test device
- [ ] App launches without browser UI

## 📞 Need Help?

Refer to:
- **ANDROID-DEPLOYMENT.md** - Complete guide
- **QUICK-START-ANDROID.md** - Fast-track guide
- **icons/ICON-INSTRUCTIONS.md** - Icon generation help

---

**Your App Configuration**:
- Package: `com.politecoaching.exam`
- App Name: `Polite Coaching Centre - Exam System`
- Theme Color: `#2c3e50`
- Cache Name: `polite-exam-v1`
