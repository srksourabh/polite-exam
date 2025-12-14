# Stable Version Reference

## Current Stable Baseline: v3.1.1

**Commit SHA**: `f69b201b92de23f32c5de8445e8405990fa8c3cd`  
**Date**: December 14, 2025  
**Tag**: `v3.1.1-stable`

## To Restore This Version

### Option 1: Git Checkout
```bash
git checkout f69b201b92de23f32c5de8445e8405990fa8c3cd
```

### Option 2: Vercel Rollback
1. Go to Vercel Dashboard → polite-exam → Deployments
2. Find deployment from Dec 14, 2025 (commit f69b201)
3. Click ⋮ → Promote to Production

## What's Included
- ✅ Complete exam interface with radio button persistence
- ✅ Timer countdown functionality  
- ✅ Mobile floating timer
- ✅ Clean exam screen UI
- ✅ Submit redirects to dashboard with score notification
- ✅ Duplicate submission prevention
- ✅ Auto-submit on timer finish

## Branch Structure
| Branch | Purpose |
|--------|---------|
| `main` | Production (stable releases only) |
| `beta` | Development & testing |
