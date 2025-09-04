# Fix for `npm run dev:all` Error

## Problem
When running `npm run dev:all`, the backend was crashing with the following error:
```
Error: Cannot find module './serviceAccountKey.json'
```

This error occurred because the backend server was trying to load a Firebase service account key file that didn't exist.

## Root Cause
The backend server.js file was configured to require the Firebase service account key file directly:
```javascript
const serviceAccount = require('./serviceAccountKey.json');
```

This approach works in production when you have the actual service account key file, but fails in development when the file doesn't exist.

## Solution
Updated the backend Firebase initialization to use a graceful fallback strategy:

### 1. Enhanced Firebase Initialization
The backend now tries multiple initialization methods in order:

1. **Service Account Key File** (if available)
2. **Environment Variables** (if configured)
3. **Application Default Credentials** (Google Cloud SDK)
4. **Graceful Degradation** (runs without Firebase)

### 2. Error Handling
Added comprehensive error handling for when Firebase is not available:
- API endpoints return appropriate error messages
- Server continues to run without crashing
- Clear logging indicates the Firebase status

### 3. Environment Variables Support
- Added `dotenv` configuration to load environment variables
- Created `.env` file for backend configuration
- Updated documentation for Firebase setup options

## Code Changes

### backend/server.js
- Added graceful Firebase initialization with try-catch blocks
- Added database availability checks in all routes
- Added proper error responses when Firebase is unavailable
- Added dotenv configuration

### backend/.env
- Created environment file for development configuration
- Added placeholders for Firebase credentials
- Added development-friendly defaults

## Current Status
✅ **Fixed**: `npm run dev:all` now runs successfully  
✅ **Backend**: Starts on http://localhost:3000  
✅ **Frontend**: Starts on http://localhost:8080  
✅ **Graceful**: Works without Firebase configuration  
✅ **Development**: Ready for local development  

## Development Modes

### 1. Without Firebase (Current State)
- Backend runs successfully
- API endpoints return "service unavailable" messages
- Frontend authentication will show Firebase config errors
- Good for frontend development without backend data

### 2. With Firebase Environment Variables
Set these in `backend/.env`:
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
```

### 3. With Service Account Key File
Place `serviceAccountKey.json` in the backend directory (production approach)

### 4. With Google Cloud SDK
Use `gcloud auth application-default login` for automatic authentication

## Testing the Fix

1. **Start the application:**
   ```bash
   npm run dev:all
   ```

2. **Verify both servers start:**
   - Frontend: http://localhost:8080
   - Backend: http://localhost:3000

3. **Test backend API:**
   ```bash
   curl http://localhost:3000/sessions
   ```
   Should return a service unavailable message (expected without Firebase)

## Next Steps

To fully enable the authentication system:

1. **Set up Firebase project** (see AUTHENTICATION_SETUP.md)
2. **Configure environment variables** in both `.env` files
3. **Test authentication flow** with real Firebase credentials

## Rollback Plan

If needed, you can rollback by reverting the server.js changes:
```bash
git checkout HEAD~1 backend/server.js
```

The original error will return, but you can temporarily disable the backend:
```bash
npm run dev  # Frontend only
```
