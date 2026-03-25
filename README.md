# Sokxay One Plus - Issue Tracker

ລະບົບຕິດຕາມ Issue ຂອງແອັບ Sokxay One Plus
Built with Next.js 14, TypeScript, Tailwind CSS, Firebase Firestore

## Getting Started

### 1. Clone & Install
```bash
npm install
```

### 2. Setup Firebase
Copy `.env.local.example` to `.env.local` and fill in your Firebase config values.

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Import Initial Data
Click **"Import ຂໍ້ມູນ Excel"** button on first load to seed 20 issues from Excel.

## Features
- ✅ Real-time sync with Firestore
- ✅ Add / Edit / Delete issues
- ✅ Filter by status & category
- ✅ Search issues
- ✅ One-click status update inline
- ✅ Import initial data from Excel
- ✅ Lao language UI (ພາສາລາວ)

## Project Structure
```
src/
├── app/          # Next.js App Router pages
├── components/   # React components
└── lib/          # Firebase config & services
```
