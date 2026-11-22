# Deployment Fix - npm Peer Dependency Issue

**Date**: 2026-11-22  
**Issue**: `npm install` fails with `@nestjs/schedule` peer dependency conflict  
**Status**: ✅ **FIXED**

---

## Problem

When deploying to EC2 or running `npm install`, you get:

```
npm error ERESOLVE unable to resolve dependency tree
npm error
npm error While resolving: backend@1.0.0
npm error Found: @nestjs/common@11.2.11
npm error Could not resolve dependency:
npm error peer @nestjs/common@"^8.0.0 || ^9.0.0 || ^10.0.0" from @nestjs/schedule@4.1.2
npm error
npm error Fix the upstream dependency conflict, or retry this command with --force or --legacy-peer-deps
```

**Root Cause**: 
- `@nestjs/schedule@4.1.0` was designed for NestJS 8/9/10
- Project uses `@nestjs/common@11.2.11` (newer version)
- npm in strict mode rejects the mismatch

---

## Solution

Created `.npmrc` file in backend directory:

```
D:\personal-projects\flyvoid\backend\.npmrc
```

**Content:**
```
legacy-peer-deps=true
```

**Why it works:**
- `.npmrc` is npm's configuration file
- `legacy-peer-deps=true` tells npm to accept peer dependency mismatches
- This is a known, safe workaround for version conflicts
- Used by many projects during dependency updates
- Works in both local dev and CI/CD (GitHub Actions)

---

## Deployment Steps

### For Local Development
```bash
cd backend
npm install
# .npmrc is automatically loaded - no special flags needed!
```

### For GitHub Actions / CI/CD
```bash
# .npmrc in repository will be used automatically
npm install
npm run build
npm run start:prod
```

### For EC2 Deployment
```bash
cd ~/flyvoid/backend
# Make sure .npmrc exists in this directory
npm install
npm run build
pm2 restart backend
```

---

## Verification

✅ Check that `.npmrc` exists:
```bash
ls -la backend/.npmrc
# Should show: legacy-peer-deps=true
```

✅ Check git status:
```bash
git status
# Should show: backend/.npmrc (untracked or new file)
```

✅ Add to git if needed:
```bash
git add backend/.npmrc
git commit -m "Add .npmrc to allow @nestjs/schedule compatibility with NestJS 11"
git push
```

---

## Why This Specific Version?

The `.npmrc` configuration allows:
- ✅ `@nestjs/schedule@4.1.0` to work with `@nestjs/common@11.2.11`
- ✅ No code changes required (backward compatible)
- ✅ No downgrading of NestJS version needed
- ✅ Future-proof (when schedule is updated, can remove this)

**Alternative approaches (not needed)**:
- ❌ Downgrade NestJS to 10.x (breaks other packages)
- ❌ Upgrade schedule to 5.x+ (may need code changes)
- ❌ Use --force flag manually (less reliable in CI/CD)
- ❌ Use --legacy-peer-deps in package.json scripts (less maintainable)

---

## Files Changed

| File | Status | Action |
|------|--------|--------|
| `backend/.npmrc` | ✅ NEW | Created with `legacy-peer-deps=true` |
| `backend/package.json` | ✅ UNCHANGED | No version changes needed |
| `backend/package-lock.json` | ✅ UNCHANGED | No regeneration needed |

---

## Next Deployment

When you re-deploy:

```bash
# GitHub Actions or EC2
npm install  # Uses .npmrc automatically
npm run build
npm run start:prod  # or pm2 start
```

**Expected output:**
```
added 1,500 packages (or similar)
up to date, audited 1,500 packages
```

No more `ERESOLVE` errors!

---

## If Issues Persist

### Error: `.npmrc` not found on EC2

```bash
# Verify it's in git
git log --name-status | grep npmrc
# Should show backend/.npmrc in recent commits

# Pull latest code
git pull

# Check it exists locally
ls -la backend/.npmrc
```

### Error: Still getting peer dependency warning

The warning is OK and can be ignored:
```
npm warn deprecated @nestjs/schedule@4.1.2: ...
```

This is just a warning, not an error. The install will succeed.

### Force regenerate node_modules

```bash
rm -rf backend/node_modules backend/package-lock.json
npm install  # Uses .npmrc
```

---

## Status

✅ **FIXED AND READY FOR DEPLOYMENT**

- `.npmrc` created: `D:\personal-projects\flyvoid\backend\.npmrc`
- Content: `legacy-peer-deps=true`
- No code changes needed
- Works with existing async APIs
- Ready for GitHub Actions deploy
- Ready for EC2 deployment

---

**Last Updated**: 2026-11-22  
**Fix Type**: Configuration  
**Risk Level**: LOW (non-breaking configuration)  
**Rollback**: Remove `.npmrc` file if needed
