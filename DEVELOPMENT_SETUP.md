# TeamTrack v2 - Development Setup & Runtime Issues Resolution

## Overview
This document provides a comprehensive guide to setting up the development environment and resolving common runtime issues.

## Prerequisites
- Node.js >= 18.x
- npm >= 9.x
- Firebase project (for authentication and database)

## Environment Setup

### 1. Install Dependencies
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install
```

### 2. Environment Configuration
1. Copy `.env.example` to `.env`
2. Configure Firebase credentials:
   - Go to your Firebase project settings
   - Get your web app configuration
   - Update the environment variables in `.env`

### 3. Firebase Setup
If you don't have Firebase configured:
1. Create a new Firebase project at https://console.firebase.google.com
2. Enable Authentication with Email/Password and Google providers
3. Create a Firestore database
4. Get your web app configuration and update `.env`

## Running the Application

### Development Mode
```bash
# Start both frontend and backend
npm run dev:all

# Or start individually
npm run dev              # Frontend only
npm run dev:backend      # Backend only
```

### Production Build
```bash
npm run build
npm run start
```

## Common Runtime Issues & Solutions

### 1. Firebase Configuration Errors
**Error**: Firebase not initialized or configuration errors
**Solution**: 
- Verify all Firebase environment variables are set correctly
- Check that Firebase project is properly configured
- The app will show warnings in development but continue to work with fallback values

### 2. API Connection Issues
**Error**: Failed to fetch sessions, network errors
**Solution**:
- Ensure backend server is running on port 3000
- Check VITE_API_URL in environment variables
- Verify CORS settings in backend server

### 3. WebSocket Connection Warnings
**Error**: WebSocket RSV1 compression errors
**Solution**: 
- These are handled automatically by the custom WebSocket plugin
- Warnings are suppressed in production
- No action needed - development continues normally

### 4. TypeScript Errors
**Error**: Type mismatches, missing types
**Solution**:
- Run `npm run typecheck` to identify issues
- All type errors have been resolved in the current codebase
- Use proper type assertions and error boundaries

### 5. Authentication Issues
**Error**: Login/signup failures
**Solution**:
- Verify Firebase authentication is enabled
- Check that Auth domain is configured correctly
- Ensure error handling is in place for network issues

## Code Quality Standards

### Linting and Formatting
```bash
npm run lint           # Check for issues
npm run lint:fix       # Auto-fix issues
npm run format:fix     # Format code with Prettier
npm run clean          # Run all quality checks
```

### Error Handling Best Practices
1. All API calls use safe error handling with try-catch blocks
2. Error boundaries catch React runtime errors
3. Console.log statements are conditionally shown based on NODE_ENV
4. User-friendly error messages are displayed to users

### Performance Considerations
1. Bundle size optimization with code splitting
2. Efficient re-rendering with proper React hooks usage
3. Safe API client with retry logic for network resilience
4. Environment-based logging to reduce production noise

## Troubleshooting

### Build Issues
1. Clear node_modules and reinstall dependencies
2. Clear Vite cache: `npx vite --force`
3. Check for conflicting global packages

### Runtime Performance
1. Use React DevTools for component analysis
2. Monitor network requests in browser dev tools
3. Check console for warnings (development mode only)

### Database Issues
1. Verify Firestore rules allow read/write access
2. Check that collections exist and have proper structure
3. Monitor Firebase console for quota limits

## Security Considerations
1. Environment variables are properly validated
2. API endpoints have proper error handling
3. User input is sanitized and validated
4. Firebase security rules should be configured appropriately

## Deployment
The application is configured for multiple deployment targets:
- Netlify (recommended)
- Static hosting providers
- Node.js servers

See deployment-specific documentation for platform-specific setup instructions.