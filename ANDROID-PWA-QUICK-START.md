# Quick Start - Android PWA Deployment

## 5-Minute Setup Guide

### Prerequisites Check
```bash
# Check Node.js
node --version  # Should be v14+

# Check Java
java -version   # Should be v11+

# Install Bubblewrap
npm install -g @bubblewrap/cli
```

### Step-by-Step Build

#### 1. Create Icons (15 minutes)
Generate 4 PNG files and place in `/icons` folder:
- icon-192.png (192x192px)
- icon-512.png (512x512px)
- icon-maskable-192.png (192x192px with safe zone)
- icon-maskable-512.png (512x512px with safe zone)

**Quick Tool**: Use https://maskable.app/editor to create maskable icons

#### 2. Deploy Web Files (5 minutes)
Upload to your web server:
- ✅ manifest.json (root)
- ✅ sw.js (root)
- ✅ icons folder (root)
- ❗ assetlinks.json → `/.well-known/assetlinks.json` (upload after step 4)

#### 3. Initialize Project (2 minutes)
```bash
cd C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam
bubblewrap init --manifest=https://yourdomain.com/manifest.json
```

Answer prompts:
- Domain: **yourdomain.com** (your actual domain)
- Package: **com.politecoaching.exam**
- Name: **Polite Exam**
- Display: **standalone**
- Color: **#2c3e50**

#### 4. Get SHA256 Fingerprint (1 minute)
```bash
keytool -list -v -keystore ./android.keystore -alias android
```

Password: **android** (default)

Copy the SHA256 line (looks like: AA:BB:CC:DD:...)

#### 5. Update assetlinks.json (1 minute)
Edit `assetlinks.json` in your project:
```json
"sha256_cert_fingerprints": [
  "AA:BB:CC:DD:EE:FF:..." 
]
```

Upload to: `https://yourdomain.com/.well-known/assetlinks.json`

#### 6. Build APK (2 minutes)
```bash
# Development build
bubblewrap build

# Production build (for Play Store)
bubblewrap build --release
```

Output files:
- `app-release-unsigned.apk` (development)
- `app-release-bundle.aab` (production)

#### 7. Test (5 minutes)
```bash
# Install on connected device
bubblewrap install

# Or manually install APK
adb install app-release-unsigned.apk
```

### Verification Checklist

✅ App opens in fullscreen (no browser UI)  
✅ Status bar color is #2c3e50  
✅ App icon shows correctly  
✅ Works offline (after first load)  
✅ Can be added to home screen  

### Common Quick Fixes

**Problem**: Chrome UI still shows  
**Fix**: Wait 10 minutes after uploading assetlinks.json, then clear Chrome data

**Problem**: Build fails  
**Fix**: 
```bash
# Check Java version
java -version  # Must be 11+

# Reinstall Bubblewrap
npm uninstall -g @bubblewrap/cli
npm install -g @bubblewrap/cli
```

**Problem**: Icons not showing  
**Fix**: Verify files exist at `/icons/icon-*.png` and are valid PNG format

### Production Deployment Timeline

| Step | Time | When |
|------|------|------|
| Create icons | 15 min | Before build |
| Deploy web files | 5 min | Before init |
| Initialize & build | 5 min | Ready to build |
| Upload assetlinks.json | 2 min | After SHA256 |
| Test on device | 10 min | After build |
| Play Store assets | 1-2 hours | Before submission |
| Play Store submission | 30 min | When ready |
| **Review wait** | **1-7 days** | After submission |

### Emergency Contacts

- **Bubblewrap Issues**: https://github.com/GoogleChromeLabs/bubblewrap/issues
- **TWA Questions**: https://stackoverflow.com/questions/tagged/trusted-web-activity
- **Play Console Help**: https://support.google.com/googleplay/android-developer

### File Locations After Build

```
polite-exam/
├── android.keystore          ← KEEP SECURE! Required for updates
├── twa-manifest.json          ← Generated TWA config
├── app-release-unsigned.apk   ← Development APK
├── app-release-bundle.aab     ← Production bundle for Play Store
```

### Update Workflow (Future)

```bash
# 1. Update web app and deploy
# 2. Edit twa-manifest.json - increment version
# 3. Rebuild
bubblewrap build --release

# 4. Upload new .aab to Play Store
```

---

**Total Time**: ~30-45 minutes (excluding Play Store review)  
**Difficulty**: Beginner-friendly with CLI experience
