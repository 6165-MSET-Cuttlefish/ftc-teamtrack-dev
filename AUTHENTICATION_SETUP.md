# TeamTrack Authentication System

This document provides setup instructions for the accounts system implemented in TeamTrack.

## Features

- **User Registration**: Sign up with email and password or Google OAuth
- **User Login**: Sign in with email/password or Google account
- **Password Reset**: Forgot password functionality via email
- **Protected Routes**: Authentication required for main app features
- **User Profile**: View and manage account information
- **User Sessions**: View personal training sessions
- **Session Management**: User-specific session data storage

## Firebase Setup

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" and follow the setup steps
3. Enable Authentication and Firestore Database

### 2. Configure Authentication

1. In Firebase Console, go to Authentication > Sign-in method
2. Enable the following providers:
   - Email/Password
   - Google (optional but recommended)

### 3. Configure Firestore Database

1. Go to Firestore Database
2. Create database in production mode
3. Set up the following security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow users to read/write their own sessions
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null && 
        (request.auth.uid == resource.data.userId || 
         request.auth.uid == request.resource.data.userId);
    }
    
    // Allow authenticated users to read all sessions (for admin view)
    match /sessions/{sessionId} {
      allow read: if request.auth != null;
    }
  }
}
```

### 4. Get Firebase Configuration

1. Go to Project Settings > General
2. In "Your apps" section, click "Web" to add a web app
3. Copy the Firebase configuration object

### 5. Update Environment Variables

Update your `.env` file with your Firebase configuration:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
```

## Backend Updates

The backend has been updated to support user-specific sessions:

### Session Data Structure

Sessions now include user information:
- `userId`: Firebase user ID
- `userEmail`: User's email address

### API Endpoints

- `GET /sessions?userId=<user_id>`: Get sessions for a specific user
- `POST /sessions`: Create a session (requires userId in body)
- `GET /sessions/:id`: Get specific session
- `GET /sessions/view/all`: Get all sessions (admin view)

## New Pages and Components

### Authentication Pages

- `/login`: User sign-in page
- `/signup`: User registration page
- `/forgot-password`: Password reset page
- `/profile`: User profile management
- `/sessions`: User's personal sessions

### Components

- `AuthContext`: Global authentication state management
- `ProtectedRoute`: Wrapper for authenticated-only routes
- `Header`: Updated with user authentication UI

## Usage

### User Flow

1. **New Users**: 
   - Visit `/signup` to create an account
   - Or use Google OAuth for quick signup

2. **Existing Users**:
   - Visit `/login` to sign in
   - Or use Google OAuth

3. **Authenticated Users**:
   - Access all app features
   - View personal sessions at `/sessions`
   - Manage profile at `/profile`
   - Sessions are automatically associated with user account

4. **Password Reset**:
   - Use "Forgot Password" link on login page
   - Receive reset email from Firebase

### Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables as described above

3. Start the development server:
   ```bash
   npm run dev:all
   ```

4. The app will redirect unauthenticated users to `/login`

## Security Notes

- Firebase handles all authentication security
- User sessions are isolated by userId
- Protected routes prevent unauthorized access
- Authentication state persists across browser sessions
- Secure password reset via Firebase Auth

## Customization

### Styling
The authentication components use your existing design system with Tailwind CSS and match the dark/light theme support.

### User Data
You can extend the user profile by:
1. Adding fields to the Firebase user profile
2. Updating the Profile component
3. Adding user preferences to Firestore

### Session Association
Sessions are automatically associated with the logged-in user. The `LivePreview` component includes user information when saving sessions.

## Troubleshooting

### Common Issues

1. **Firebase not initialized**: Check environment variables
2. **Authentication not working**: Verify Firebase project settings
3. **Sessions not saving**: Check Firestore security rules
4. **Redirect loops**: Ensure protected routes are properly configured

### Debug Mode

Add console logs in the AuthContext to debug authentication state:

```javascript
console.log('Auth state changed:', user);
```
