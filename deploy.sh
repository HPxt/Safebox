#!/bin/bash

# SafeBox Deploy Script
# This script prepares the application for deployment

echo "🚀 Starting SafeBox deployment preparation..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Make sure you're in the project root."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the frontend
echo "🏗️ Building frontend..."
cd frontend
npm install
npm run build

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️ Warning: .env file not found in frontend directory"
    echo "📝 Please create a .env file with your Supabase credentials:"
    echo "REACT_APP_SUPABASE_URL=your_supabase_url"
    echo "REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key"
    exit 1
fi

cd ..

# Build the backend
echo "🔧 Building backend..."
cd backend
npm install
npm run build

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️ Warning: .env file not found in backend directory"
    echo "📝 Please copy env.example to .env and configure your environment variables"
    exit 1
fi

cd ..

echo "✅ Build completed successfully!"
echo "📋 Next steps:"
echo "1. Configure your environment variables in both frontend/.env and backend/.env"
echo "2. Deploy the frontend build to your hosting service (Vercel, Netlify, etc.)"
echo "3. Deploy the backend to your server or cloud platform"
echo "4. Update CORS settings in backend for your production domain" 