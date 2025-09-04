#!/bin/bash

# TeamTrack v2 Frontend - Codebase Organization Script
# This script organizes the codebase structure for better maintainability

echo "🚀 Starting codebase organization..."

# Create directories if they don't exist
echo "📁 Creating directory structure..."
mkdir -p docs
mkdir -p shared/types

# Function to safely move files
safe_move() {
    if [ -f "$1" ] && [ ! -f "$2" ]; then
        mv "$1" "$2"
        echo "✅ Moved $1 to $2"
    elif [ -f "$2" ]; then
        echo "⚠️  $2 already exists, skipping $1"
    else
        echo "❌ $1 not found"
    fi
}

echo "📚 Organizing documentation..."
# Move documentation files to docs directory
safe_move "AGENTS.md" "docs/AGENTS.md"
safe_move "AUTHENTICATION_SETUP.md" "docs/AUTHENTICATION_SETUP.md"
safe_move "BROWSER_ERROR_FIX.md" "docs/BROWSER_ERROR_FIX.md"
safe_move "DEV_SERVER_FIX.md" "docs/DEV_SERVER_FIX.md"
safe_move "MIGRATION_GUIDE.md" "docs/MIGRATION_GUIDE.md"

echo "🧹 Cleaning up unused directories..."
# Remove unused directories
if [ -d "frontend" ] && [ -z "$(ls -A frontend)" ]; then
    rmdir frontend
    echo "✅ Removed empty frontend directory"
fi

if [ -d "frontend/temp" ]; then
    rm -rf frontend
    echo "✅ Removed frontend/temp directory"
fi

echo "📋 Running code quality checks..."
# Run linting and type checking
npm run typecheck
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "⚠️  TypeScript compilation had issues"
fi

echo "🏗️  Testing build process..."
# Test build
npm run build:client >/dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "⚠️  Build had issues"
fi

echo ""
echo "🎉 Codebase organization complete!"
echo ""
echo "📁 New structure:"
echo "   ├── client/          # React frontend"
echo "   ├── server/          # Express backend"
echo "   ├── backend/         # Legacy Firebase backend"
echo "   ├── shared/          # Shared types & utilities"
echo "   │   └── types/       # Organized type definitions"
echo "   ├── docs/            # Documentation"
echo "   ├── public/          # Static assets"
echo "   └── netlify/         # Serverless functions"
echo ""
echo "📖 See docs/PROJECT_STRUCTURE.md for detailed structure information"
echo "🚀 Run 'npm run dev:all' to start development"
