# Migration Guide: Adding Authentication to TeamTrack

## Overview

This guide explains how existing TeamTrack sessions can be migrated to the new user-based authentication system.

## Database Migration

### Option 1: Manual Migration (Recommended for Development)

If you have existing sessions in Firestore that don't have user associations:

1. **Backup your data first**
2. **Add user fields to existing sessions**:

```javascript
// Firebase Admin SDK script to migrate existing sessions
const admin = require('firebase-admin');

// Initialize admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountKey),
});

const db = admin.firestore();

async function migrateExistingSessions() {
  const sessionsRef = db.collection('sessions');
  const snapshot = await sessionsRef.get();
  
  const batch = db.batch();
  
  snapshot.forEach((doc) => {
    const data = doc.data();
    
    // Only update if userId doesn't exist
    if (!data.userId) {
      batch.update(doc.ref, {
        userId: 'admin', // or assign to a default user
        userEmail: 'admin@teamtrack.com', // or default email
        migratedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });
  
  await batch.commit();
  console.log('Migration completed');
}

migrateExistingSessions();
```

### Option 2: Clean Start

If you prefer to start fresh with the new authentication system:

1. **Export existing data** (optional backup)
2. **Clear sessions collection**
3. **Start with authenticated sessions only**

## User Experience

### For Existing Users

1. **First-time visitors** will see the login page
2. **Account creation** is required to access the app
3. **Session continuity**: Previous sessions won't be visible unless migrated

### For New Deployments

1. Users must create accounts before accessing features
2. All sessions are automatically user-associated
3. Data privacy is maintained per user

## Configuration Steps

### 1. Environment Setup

Ensure all Firebase environment variables are configured:

```bash
# Check these variables are set
echo $REACT_APP_FIREBASE_API_KEY
echo $REACT_APP_FIREBASE_PROJECT_ID
# ... etc
```

### 2. Firebase Rules Update

Update Firestore security rules to enforce user authentication:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Sessions are private to users
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

### 3. Testing Authentication

Test the authentication flow:

1. **Sign up** a new user
2. **Create a session** and verify it saves with userId
3. **Sign out** and verify redirect to login
4. **Sign in** and verify sessions load correctly

## Rollback Plan

If you need to rollback to the non-authenticated version:

### 1. Frontend Rollback

```bash
# Remove authentication from routes
git revert <auth-commit-hash>

# Or manually:
# - Remove AuthProvider from App.tsx
# - Remove ProtectedRoute wrappers
# - Remove user info from session saving
```

### 2. Backend Rollback

```bash
# Remove user fields from session creation
# Revert to original toSession() function
# Remove userId query parameter handling
```

### 3. Firebase Rules Rollback

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all reads/writes (original state)
    match /sessions/{sessionId} {
      allow read, write: if true;
    }
  }
}
```

## Deployment Checklist

### Pre-deployment

- [ ] Firebase project configured
- [ ] Environment variables set
- [ ] Authentication providers enabled
- [ ] Firestore rules updated
- [ ] Build passes all tests
- [ ] Migration script ready (if needed)

### Post-deployment

- [ ] Test user registration
- [ ] Test user login
- [ ] Test session creation
- [ ] Test session retrieval
- [ ] Test password reset
- [ ] Verify data isolation between users

## Support

### Common Issues

1. **Users can't access existing sessions**
   - Solution: Run migration script or associate sessions with users

2. **Authentication redirects not working**
   - Solution: Check ProtectedRoute implementation and routing

3. **Sessions not saving with user info**
   - Solution: Verify useAuth context in LivePreview component

4. **Firebase configuration errors**
   - Solution: Double-check environment variables and Firebase project settings

### Monitoring

Monitor these metrics after deployment:

- User registration rate
- Login success rate
- Session creation rate
- Authentication errors
- Firebase usage quotas

### Rollback Triggers

Consider rollback if:

- Authentication success rate < 95%
- Session creation drops significantly
- Critical Firebase errors occur
- User complaints about data loss

## Future Enhancements

The authentication system enables these future features:

1. **Team collaboration**: Share sessions between team members
2. **Analytics**: User-specific performance tracking
3. **Backup**: User data export/import
4. **Notifications**: Email alerts for session insights
5. **Mobile app**: Shared authentication with mobile client
