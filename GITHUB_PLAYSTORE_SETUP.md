# 🚀 GitHub Pages Setup & Google Play Publishing Guide

## Part 1: GitHub Pages Setup (Host Your Documentation)

### Step 1: Create GitHub Repository

1. **Go to**: https://github.com
2. **Click**: "New Repository" (green button)
3. **Repository Name**: `polite-exam-docs`
4. **Description**: "Documentation for Polite Coaching Centre App"
5. **Visibility**: Public (required for GitHub Pages)
6. **Initialize**: ✅ Add README
7. **Click**: "Create Repository"

---

### Step 2: Upload Your Documentation Files

**Method A: Using GitHub Web Interface (Easiest)**

1. Click **"Add file"** > **"Upload files"**
2. Drag & drop ALL files from `docs` folder:
   - index.html
   - privacy-policy.html
   - terms-of-service.html
   - delete-account.html
3. **Commit message**: "Add app documentation"
4. Click **"Commit changes"**

**Method B: Using Git Command Line**

```bash
cd C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam
git init
git add docs/*
git commit -m "Add app documentation"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/polite-exam-docs.git
git push -u origin main
```

---

### Step 3: Enable GitHub Pages

1. **In your repository**, go to **Settings** (gear icon)
2. **Scroll down** to **"Pages"** (left sidebar)
3. **Source**: Select **"Deploy from a branch"**
4. **Branch**: Select **"main"** and **"/docs"** folder
5. **Click**: **"Save"**
6. **Wait 2-3 minutes** for deployment

---

### Step 4: Get Your URLs

After deployment (check green ✅ checkmark):

```
Main Site:        https://YOUR-USERNAME.github.io/polite-exam-docs/
Privacy Policy:   https://YOUR-USERNAME.github.io/polite-exam-docs/privacy-policy.html
Terms of Service: https://YOUR-USERNAME.github.io/polite-exam-docs/terms-of-service.html
Delete Account:   https://YOUR-USERNAME.github.io/polite-exam-docs/delete-account.html
```

**✅ Important**: Replace `YOUR-USERNAME` with your actual GitHub username

---

## Part 2: Google Play Console Setup

### Step 1: Complete Data Safety Form

1. **Go to**: Play Console > Your App > **Policy** > **App Content**
2. **Click**: **"Data safety"** > **"Start"**

**Fill out these sections:**

#### A. Data Collection & Sharing

**Personal Information:**
- ✅ Name
- ✅ Email address
- ✅ Phone number

**Usage:** Account management, app functionality
**Sharing:** ❌ Not shared with third parties

**App Activity:**
- ✅ In-app actions (exam attempts, scores)
- ✅ App interactions

**Usage:** Performance analytics, personalization
**Sharing:** ❌ Not shared

#### B. Data Security

- ✅ Data is encrypted in transit (HTTPS/TLS)
- ✅ Data is encrypted at rest (Airtable encryption)
- ❌ Users cannot request data deletion (SELECT "Yes" - you have delete account feature!)

#### C. Data Deletion

**CRITICAL SECTION - This is NEW requirement!**

1. **"Does your app allow users to create accounts?"** → **YES**

2. **"Can users request account deletion from within the app?"** → **YES**

3. **"Provide a web link where users can request account deletion"**
   ```
   https://YOUR-USERNAME.github.io/polite-exam-docs/delete-account.html
   ```

4. **"Can users request deletion of other data?"** → **NO** (or YES if applicable)

5. **"Do you retain data for legal/regulatory reasons?"** → **YES**
   - **Specify**: "Anonymized transaction logs retained for 7 years per Indian regulations"

---

### Step 2: Add Privacy Policy URL

1. **Go to**: **Policy** > **App Content** > **Privacy Policy**
2. **Click**: **"Start"**
3. **Privacy Policy URL**:
   ```
   https://YOUR-USERNAME.github.io/polite-exam-docs/privacy-policy.html
   ```
4. **Click**: **"Save"**

---

### Step 3: Complete App Content Declarations

#### A. Ads Declaration
- **Does your app contain ads?** → **NO** (or YES if applicable)

#### B. Target Audience
- **Age groups**: 13-17, 18-24, 25-34, 35-44, 45-64
- **Primary**: 18-64 (Adults)

#### C. Content Rating
1. Click **"Start questionnaire"**
2. **Category**: Education
3. Answer questions honestly:
   - Violence: None
   - Sexual content: None
   - Drugs/Alcohol: None
   - Language: None
4. Get rating (likely "Everyone" or "Teen")

#### D. App Access
- **Is your app fully accessible without login?** → **NO**
- **Provide test credentials:**
  ```
  Email: test@politecoaching.com
  Password: TestUser@123
  ```

---

### Step 4: Create Store Listing

#### A. App Details
- **App name**: Polite Coaching Centre
- **Short description** (80 chars max):
  ```
  Smart exam prep & performance tracking for students. Practice tests & analytics
  ```
- **Full description** (4000 chars max):
  ```
  🎓 Polite Coaching Centre - Your Complete Exam Preparation Companion

  Master your exams with our comprehensive exam management platform designed for students who want to excel.

  ✨ KEY FEATURES:

  📚 Unlimited Practice Exams
  Take unlimited practice tests across multiple subjects with instant scoring and detailed feedback.

  📊 Performance Analytics
  Track your progress with subject-wise analytics, improvement trends, and personalized insights.

  🎯 Targeted Learning
  Identify weak areas and get customized recommendations to improve your performance.

  📈 Progress Reports
  View comprehensive reports showing your journey from first attempt to mastery.

  🔐 Secure & Private
  Your data is encrypted and protected. You have full control over your account and information.

  📱 Offline Support
  Download exams and practice offline. Sync automatically when you're back online.

  WHY POLITE COACHING CENTRE?
  ✓ Developed by Ultimate Digital Solutions with 15+ years experience
  ✓ Trusted by hundreds of students
  ✓ Regular content updates
  ✓ Fast & reliable performance
  ✓ Responsive support team

  Perfect for students preparing for competitive exams, school tests, or skill assessments.

  Download now and start your journey to exam success!

  For support: support@politecoaching.com
  ```

#### B. Graphics Requirements

**App Icon** (512x512 PNG, required):
