# TeamTrack v2 Frontend

A production-ready full-stack React application for team tracking and analysis, featuring integrated Express server, authentication, and modern tooling.

## 🚀 Quick Start

```bash
# Install dependencies for both frontend and backend
npm run install:all

# Start development servers (frontend + backend)
npm run dev:all

# Or start individually
npm run dev          # Frontend only
npm run dev:backend  # Backend only
```

## 🏗️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Backend**: Express.js + Firebase Firestore
- **Authentication**: Firebase Auth
- **UI Components**: Radix UI + Lucide React icons
- **Testing**: Vitest
- **Deployment**: Netlify

## 📁 Project Structure

```
├── client/                   # React SPA frontend
│   ├── src/
│   │   ├── pages/           # Route components
│   │   ├── components/      # React components
│   │   │   └── ui/         # Pre-built UI component library
│   │   ├── contexts/       # React contexts (Auth, Theme, etc.)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/            # Utilities and configurations
│   │   └── services/       # API service layer
│   └── index.html
├── server/                  # Express API server
│   ├── routes/             # API route handlers
│   └── index.ts            # Server configuration
├── backend/                 # Legacy backend (Firebase integration)
├── shared/                  # Shared types between client/server
├── docs/                    # Documentation
├── public/                  # Static assets
└── netlify/                 # Netlify functions
```

## 🔧 Development

### Project Organization

The codebase has been organized for better maintainability:

- **Documentation**: Moved to `docs/` directory
- **Type Definitions**: Organized in `shared/types/` with clear exports
- **Configuration**: Kept at root level for tool compatibility
- **Build System**: Optimized for both development and production

Run `./organize.sh` to apply organization improvements to a fresh clone.

### Available Scripts

```bash
npm run dev              # Start frontend dev server
npm run dev:backend      # Start backend dev server  
npm run dev:all          # Start both servers concurrently
npm run build            # Build for production
npm run build:client     # Build client only
npm run build:server     # Build server only
npm run start            # Start production server
npm run test             # Run tests
npm run lint             # Lint code
npm run lint:fix         # Fix linting issues
npm run format           # Check formatting
npm run format:fix       # Fix formatting
npm run typecheck        # Type checking
npm run clean            # Lint + format + typecheck
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Configure Firebase credentials
3. Set up authentication settings

See [docs/AUTHENTICATION_SETUP.md](./docs/AUTHENTICATION_SETUP.md) for detailed setup instructions.

## 🚦 Features

- ✅ **Authentication**: Firebase Auth with protected routes
- ✅ **Real-time Data**: Firebase Firestore integration
- ✅ **Modern UI**: Radix UI components with TailwindCSS
- ✅ **Type Safety**: Full TypeScript support
- ✅ **Testing**: Vitest test setup
- ✅ **Development**: Hot reload for both frontend and backend
- ✅ **Production Ready**: Optimized build and deployment

## 📖 Documentation

- [Development Guide](./docs/AGENTS.md)
- [Authentication Setup](./docs/AUTHENTICATION_SETUP.md)
- [Migration Guide](./docs/MIGRATION_GUIDE.md)
- [Bug Fixes](./docs/BROWSER_ERROR_FIX.md)
- [Server Setup](./docs/DEV_SERVER_FIX.md)

## 🔗 API Endpoints

### Sessions API
- `GET /api/sessions` - Get all sessions
- `GET /api/sessions/:id` - Get session by ID
- `POST /api/sessions` - Create new session
- `PUT /api/sessions/:id` - Update session

### Other APIs
- `GET /api/ping` - Health check
- `GET /api/demo` - Demo endpoint

## 🛠️ Deployment

### Netlify (Recommended)

The project is configured for Netlify deployment with serverless functions.

```bash
npm run build
# Deploy dist/ folder to Netlify
```

### Manual Deployment

```bash
npm run build
npm run start
```

## 🤝 Contributing

1. Clone the repository
2. Install dependencies: `npm run install:all`
3. Start development: `npm run dev:all`
4. Make changes and test
5. Submit a pull request

## 📄 License

[Add your license here]
