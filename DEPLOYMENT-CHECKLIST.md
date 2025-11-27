# Android Deployment Checklist

Use this checklist to track your progress deploying Polite Exam to Android.

## ✅ Phase 1: Preparation (10-15 minutes)

### Prerequisites
- [ ] Node.js installed (v16+)
  ```bash
  node --version
  ```
- [ ] Java JDK installed (11+)
  ```bash
  java -version
  ```
- [ ] Web app deployed on HTTPS
- [ ] Production URL ready (e.g., https://polite-exam.vercel.app)

### Icon Generation
- [ ] Visit https://www.pwabuilder.com/imageGenerator
- [ ] Upload 512x512 logo
- [ ] Download generated icons
- [ ] Copy 4 PNG files to `/icons/` folder:
  - [ ] icon-192.png
  - [ ] icon-512.png
  - [ ] icon-maskable-192.png
  - [ ] icon-maskable-512.png

### File Verification
- [ ] `manifest.json` exists in project root
- [ ] `sw.js` exists in project root
- [ ] `assetlinks.json` exists in project root
- [ ] `index.html` has PWA meta tags in `<head>`
- [ ] All 4 icon files exist in `/icons/`

---

## ✅ Phase 2: Bubblewrap Setup (15 minutes)

### Install Bubblewrap
- [ ] Install Bubblewrap CLI globally
  ```bash
  npm install -g @bubblewrap/cli
  ```
- [ ] Verify installation
  ```bash
  bubblewrap --version
  ```

### Initialize Android Project
- [ ] Navigate to project directory
  ```bash
  cd C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam
  ```
- [ ] Run Bubblewrap init
  ```bash
  bubblewrap init --manifest=https://YOUR-DOMAIN.com/manifest.json
  ```
- [ ] Answer configuration prompts:
  - [ ] App name: `Polite Exam Management`
  - [ ] Package name: `com.politecoaching.exam`
  - [ ] Host: Your production domain
  - [ ] Icon paths: Point to `/icons/icon-512.png`, etc.
  - [ ] Theme color: `#2c3e50`
  - [ ] Background color: `#ffffff`

### Verify Generated Files
- [ ] `twa-manifest.json` created
- [ ] `android.keystore` created (⚠️ BACKUP THIS FILE!)
- [ ] Keystore password saved securely

---

## ✅ Phase 3: Development Build (10 minutes)

### Build Development APK
- [ ] Run build command
  ```bash
  bubblewrap build
  ```
- [ ] Build completes successfully
- [ ] `app-release-unsigned.apk` file created

### Test on Device
- [ ] Enable USB debugging on Android phone
- [ ] Connect phone to computer
- [ ] Install APK
  ```bash
  adb install app-release-unsigned.apk
  ```
  OR drag APK to Android emulator

### Verify App Functionality
- [ ] App installs successfully
- [ ] App icon appears on home screen
- [ ] App launches without browser UI
- [ ] All features work correctly
- [ ] Theme color is correct (#2c3e50)
- [ ] Navigation works properly

---

## ✅ Phase 4: Digital Asset Links (15 minutes)

### Get SHA256 Fingerprint
- [ ] Extract SHA256 from keystore
  ```bash
  keytool -list -v -keystore ./android.keystore -alias android
  ```
- [ ] Copy the SHA256 fingerprint value
  (Format: AA:BB:CC:DD:EE:FF... 32 pairs)
- [ ] Save fingerprint in secure location

### Update assetlinks.json
- [ ] Open `assetlinks.json` in editor
- [ ] Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with actual value
- [ ] Remove colons from fingerprint (keep only hex characters)
- [ ] Verify package name is `com.politecoaching.exam`
- [ ] Save file

### Upload to Web Server
- [ ] Create `/.well-known/` directory on your web server
- [ ] Upload `assetlinks.json` to `/.well-known/assetlinks.json`
- [ ] Verify file is accessible:
  ```
  https://yourdomain.com/.well-known/assetlinks.json
  ```
- [ ] Test URL in browser (should show JSON content)

### Verify Asset Links
- [ ] Reinstall app on device
- [ ] App launches without "Open in Chrome" banner
- [ ] No browser UI visible
- [ ] Full-screen TWA experience confirmed

---

## ✅ Phase 5: Production Build (10 minutes)

### Build Release Version
- [ ] Run production build
  ```bash
  bubblewrap build --release
  ```
- [ ] Build completes successfully
- [ ] `app-release-bundle.aab` file created

### Test Production Build
- [ ] Install .aab on test device (via bundletool or Google Play internal testing)
- [ ] Verify all functionality works
- [ ] Check offline mode works
- [ ] Verify app performance

### Final Verification
- [ ] App size is reasonable (< 10MB typical)
- [ ] No console errors in app
- [ ] All pages load correctly
- [ ] Service worker caching works
- [ ] Theme color correct throughout

---

## ✅ Phase 6: Play Store Assets (30-45 minutes)

### Create Graphics
- [ ] **App Icon**: 512x512 PNG (hi-res icon for store)
- [ ] **Feature Graphic**: 1024x500 PNG (store banner)
- [ ] **Screenshots**: Minimum 2 screenshots
  - Phone: 16:9 or 9:16 ratio
  - Tablet (optional): Various sizes
  - Different screens showing key features

### Prepare Store Listing
- [ ] **App Title**: Polite Coaching Centre - Exam System
- [ ] **Short Description**: (Max 80 chars)
  ```
  Complete exam management system for students and administrators
  ```
- [ ] **Full Description**: Write detailed description
  - Key features
  - Benefits
  - How to use
  - Support information
- [ ] **Category**: Education
- [ ] **Tags/Keywords**: exam, education, test, student, coaching
- [ ] **Privacy Policy URL**: (Required!)
  - Create privacy policy page
  - Upload to your website
  - Get URL

### Content Rating
- [ ] Complete content rating questionnaire
- [ ] Verify age rating (likely Everyone)
- [ ] Review content guidelines

---

## ✅ Phase 7: Google Play Submission (20 minutes)

### Developer Account
- [ ] Go to https://play.google.com/console
- [ ] Sign in with Google account
- [ ] Pay $25 one-time registration fee (if first time)
- [ ] Complete developer profile

### Create App Listing
- [ ] Click "Create app"
- [ ] Select "App" (not Game)
- [ ] Choose "Free" (or Paid if applicable)
- [ ] Accept declarations
- [ ] Enter app name: `Polite Coaching Centre - Exam System`

### Upload Build
- [ ] Go to "Release" > "Production"
- [ ] Create new release
- [ ] Upload `app-release-bundle.aab`
- [ ] Release name: `1.0.0` (or your version)
- [ ] Release notes: Describe features

### Complete Store Listing
- [ ] Upload app icon (512x512)
- [ ] Upload feature graphic (1024x500)
- [ ] Upload screenshots (minimum 2)
- [ ] Enter short description
- [ ] Enter full description
- [ ] Select app category: Education
- [ ] Add contact email
- [ ] Add privacy policy URL
- [ ] Complete content rating questionnaire

### Pricing & Distribution
- [ ] Select countries (or "All countries")
- [ ] Confirm app is free (if applicable)
- [ ] Complete distribution agreements
- [ ] Set up in-app purchases (if any)

### Submit for Review
- [ ] Review all information
- [ ] Check all required fields completed
- [ ] Click "Submit for review"
- [ ] Wait 1-7 days for approval

---

## ✅ Phase 8: Post-Launch (Ongoing)

### Monitor Performance
- [ ] Check Google Play Console regularly
- [ ] Monitor crash reports
- [ ] Review user feedback/ratings
- [ ] Track download statistics

### Updates
- [ ] Plan update cycle
- [ ] Test updates before release
- [ ] Update version numbers
- [ ] Update service worker cache name
- [ ] Rebuild and resubmit

---

## 🎯 Success Criteria

Your deployment is complete when:
- [✓] App appears in Google Play Store
- [✓] Users can download and install
- [✓] App launches as full-screen TWA (no browser UI)
- [✓] All features work correctly
- [✓] Offline mode functions properly
- [✓] No critical bugs or crashes
- [✓] Good user ratings and reviews

---

## ⚠️ Important Reminders

### Security
- [ ] **BACKUP `android.keystore`** - You cannot update your app without it!
- [ ] Store keystore password securely
- [ ] Never commit keystore to Git
- [ ] Keep SHA256 fingerprint recorded

### Version Management
When updating:
1. Update version in `manifest.json`
2. Update cache name in `sw.js`
3. Run `bubblewrap update`
4. Run `bubblewrap build --release`
5. Upload new .aab to Play Store

### Common Issues Checklist
If app shows browser UI:
- [ ] Check assetlinks.json is at `/.well-known/assetlinks.json`
- [ ] Verify SHA256 fingerprint is correct
- [ ] Confirm package name matches everywhere

If offline mode doesn't work:
- [ ] Service worker registered successfully
- [ ] Cache name updated in sw.js
- [ ] HTTPS enabled on all pages

---

## 📊 Estimated Timeline

- **Phase 1**: 15 minutes
- **Phase 2**: 15 minutes
- **Phase 3**: 10 minutes
- **Phase 4**: 15 minutes
- **Phase 5**: 10 minutes
- **Phase 6**: 45 minutes
- **Phase 7**: 20 minutes
- **Review Wait**: 1-7 days

**Total Active Time**: ~2 hours  
**Total Calendar Time**: 1-7 days (including review)

---

## ✅ Ready to Submit?

Final check before submission:
- [ ] All phases completed above
- [ ] App tested on multiple devices
- [ ] All store assets prepared
- [ ] Privacy policy published
- [ ] Keystore backed up securely
- [ ] Team informed of launch timeline

**Good luck with your Android app launch! 🚀**

---

For detailed help, see:
- **ANDROID-DEPLOYMENT.md** - Complete guide
- **QUICK-START-ANDROID.md** - Fast-track version
- **FOLDER-STRUCTURE.md** - File organization
