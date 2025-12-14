# Development Workflow Guide

## Branch Structure

| Branch | Purpose | Auto-Deploys To |
|--------|---------|-----------------|
| `main` | Production stable | polite-exam.vercel.app |
| `beta` | Development & testing | Preview URLs |

---

## 🔄 Daily Workflow

### For ALL New Updates:
```
Always sync to → beta (NOT main)
```

### Step-by-Step:

1. **Make changes locally**
2. **Push to `beta` branch**
   ```bash
   git checkout beta
   git add .
   git commit -m "your message"
   git push origin beta
   ```
3. **Test on Vercel preview URL**
4. **When stable → Create PR from `beta` to `main`**
5. **Merge PR → Production updated**

---

## 🚀 Deployment Flow

```
Your Code → beta branch → Preview URL (test here)
                ↓
         Create Pull Request
                ↓
         Merge to main → Production (polite-exam.vercel.app)
```

---

## 🔖 Current Stable Baseline

| Version | Commit | Date |
|---------|--------|------|
| v3.1.1-stable | `f69b201b92de23f32c5de8445e8405990fa8c3cd` | Dec 14, 2025 |

---

## 🔙 How to Rollback

### Option 1: Git Checkout
```bash
git checkout f69b201b92de23f32c5de8445e8405990fa8c3cd
```

### Option 2: Vercel Dashboard
1. Go to Vercel → polite-exam → Deployments
2. Find the stable deployment (Dec 14, 2025)
3. Click ⋮ → **Promote to Production**

### Option 3: Revert Main Branch
```bash
git checkout main
git revert HEAD --no-edit
git push origin main
```

---

## ⚠️ Rules

1. **NEVER push directly to `main`** - always use PR from beta
2. **Test thoroughly on beta** before merging to main
3. **Tag major releases** with version numbers
4. **Update STABLE_VERSION.md** when creating new baselines

---

## 📋 Quick Reference

| Action | Command/Step |
|--------|--------------|
| Switch to beta | `git checkout beta` |
| Push to beta | `git push origin beta` |
| Create PR | GitHub → Pull requests → New |
| View preview | Check Vercel deployment URL in PR |
| Merge to prod | Merge PR on GitHub |

---

## 🏷️ Version History

| Version | Date | Notes |
|---------|------|-------|
| v3.1.1-stable | Dec 14, 2025 | First stable baseline - exam interface complete |

---

*Last Updated: December 14, 2025*
