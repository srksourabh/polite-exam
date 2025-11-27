# Android Deployment - Quick Start

Fast-track guide to get your Polite Exam app on Android in under 30 minutes.

## ⚡ 5-Minute Checklist

### Before You Start
- [ ] Web app deployed on HTTPS
- [ ] Node.js installed
- [ ] JDK 11+ installed

### Step 1: Generate Icons (5 min)
1. Visit https://www.pwabuilder.com/imageGenerator
2. Upload a 512x512 logo
3. Download generated icons
4. Place in `/icons/` folder (4 files total)

### Step 2: Install Bubblewrap (1 min)
```bash
npm install -g @bubblewrap/cli
```

### Step 3: Initialize Project (3 min)
```bash
cd C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam
bubblewrap init --manifest=https://yourproductiondomain.com/manifest.json
```

Answer prompts:
- Package name: `com.politecoaching.exam`
- App name: `Polite Exam Management`
- Icons: Point to `/icons/icon-512.png` and others

### Step 4: Build & Test (5 min)
```bash
bubblewrap build
```

Install APK on your phone:
```bash
adb install app-release-unsigned.apk
```

### Step 5: Get SHA256 Fingerprint (2 min)
```bash
keytool -list -v -keystore ./android.keystore -alias android
```

Copy the SHA256 value.

### Step 6: Update Digital Asset Links (3 min)
1. Edit `assetlinks.json`
2. Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with actual value
3. Upload to: `https://yourdomain.com/.well-known/assetlinks.json`

### Step 7: Build Production Version (5 min)
```bash
bubblewrap build --release
```

Output: `app-release-bundle.aab` (ready for Play Store)

## 🎯 Play Store Upload (10 min)

1. Go to https://play.google.com/console
2. Create app listing
3. Upload `app-release-bundle.aab`
4. Add screenshots (minimum 2)
5. Add 512x512 app icon
6. Add 1024x500 feature graphic
7. Submit for review

## 🔄 Quick Update Process

When you update your web app:

```bash
# 1. Update version in manifest.json
# 2. Update cache name in sw.js (e.g., polite-exam-v2)

# 3. Rebuild
bubblewrap update
bubblewrap build --release

# 4. Upload new .aab to Play Store
```

## ⚠️ Common Issues

**Problem**: App won't verify  
**Solution**: Check assetlinks.json is at `/.well-known/assetlinks.json`

**Problem**: Shows browser UI  
**Solution**: SHA256 fingerprint mismatch - regenerate assetlinks.json

**Problem**: Offline doesn't work  
**Solution**: Clear app cache and reinstall

## 📱 Test Checklist

- [ ] App installs successfully
- [ ] Launches without browser UI
- [ ] Offline mode works
- [ ] Theme color matches (#2c3e50)
- [ ] All features functional

## 🚀 Ready to Go?

Total time: ~30 minutes  
Cost: $25 (Google Play Developer account, one-time)  
Review time: 1-7 days

---

For detailed instructions, see **ANDROID-DEPLOYMENT.md**
