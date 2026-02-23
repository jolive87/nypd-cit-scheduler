# CIT Actor Scheduler — Startup Guide

## Install Dependencies
```powershell
cd "E:\Wifes\NYPD Crisis Schedluer\cit-app"
npm install
```

## Run Development Server
```powershell
npm run dev
```
Opens at http://localhost:5173

## Build for Production
```powershell
npm run build
```
Output goes to `dist/` folder.

## Preview Production Build
```powershell
npm run preview
```
Opens at http://localhost:4173

## Deploy to Vercel

### Option A: Vercel CLI (Recommended)
```powershell
npm install -g vercel
vercel login
vercel deploy --prod
```

### Option B: GitHub + Vercel Dashboard
1. Push to a GitHub repo
2. Go to https://vercel.com
3. Import the repo
4. Vercel auto-detects Vite and deploys

### Option C: Drag and Drop
1. Run `npm run build`
2. Go to https://vercel.com/new
3. Drag the `dist/` folder onto the page
