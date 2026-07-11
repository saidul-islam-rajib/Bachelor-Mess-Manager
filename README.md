# Mess Management App

## Overview
This is a Next.js-based mess management application designed for bachelor mess/shared flat living. It uses Tailwind CSS for styling, Jotai for state management, Prisma with Microsoft SQL Server for the database, and Next.js API routes for backend logic.

## What’s Included
- User registration and login
- Role-based access: admin, supervisor, member
- Group-based mess management
- Meal entry for current and future dates
- Expense tracking for bazar, rent, utilities, and more
- Payment due reporting and member status
- Comment system with supervisor/admin controls
- Profile editing with photo support
- Dashboards for members and supervisors

## Prerequisites
- Node.js 18+ installed
- npm or yarn
- Microsoft SQL Server database

## Setup Instructions

### 1. Clone the repository
```bash
git clone <repo-url> .
```

### 2. Install dependencies
```bash
npm install
# or
# yarn install
```

### 3. Configure environment variables
Create a `.env` file at the project root with:
```env
DATABASE_URL="sqlserver://USER:PASSWORD@HOST:PORT;database=DATABASE;encrypt=true;trustServerCertificate=true"
```

For local SQL Server Express, a sample connection string might look like:
```env
DATABASE_URL="sqlserver://sa:YourPassword@localhost:1433;database=mess_db;encrypt=true;trustServerCertificate=true"
```

### 4. Initialize Prisma
Generate the Prisma client and run migrations:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 5. Seed admin user and sample data
Create an admin user and sample data with:
```bash
npm run seed:db
```

The seed script creates these default accounts:
- admin@mess.local / Admin@123
- supervisor@mess.local / Supervisor@123
- member@mess.local / Member@123

After seeding, log in using the admin account at `/auth/login`.

### 5. Install Tailwind CSS
Install Tailwind and initialize config (if not preconfigured):
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Verify `tailwind.config.js` includes:
```js
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

Add Tailwind directives to `styles/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 6. Install Jotai
```bash
npm install jotai
```

### 7. Run the development server
```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

## Folder Structure
- `pages/` — Next.js pages and API routes
- `components/` — UI components and reusable elements
- `store/` — Jotai atoms and state logic
- `lib/` — API helpers, auth helpers, database client
- `prisma/` — Prisma schema and migrations
- `styles/` — global CSS and Tailwind styles

## Main Pages
- `/auth/login` — login page
- `/auth/register` — registration page
- `/dashboard` — personal and group dashboard
- `/groups/[groupId]` — group overview and management
- `/meals` — meal entry and table
- `/expenses` — expense management and history
- `/payments` — payment due status
- `/members` — member list and overview
- `/profile` — profile update page
- `/comments` — comments and replies

## Backend API Routes
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/me`
- `/api/users/update`
- `/api/groups`
- `/api/groups/[id]`
- `/api/groups/[id]/members`
- `/api/meal-entries`
- `/api/expenses`
- `/api/payments`
- `/api/comments`
- `/api/reports/dashboard`

## Running Production Build
```bash
npm run build
npm run start
```

## Database and Prisma
Use Prisma to manage schema changes and database migrations.
- `npx prisma migrate dev --name <migration-name>`
- `npx prisma studio` to view database records

## Mobile App Integration
- The same backend API can be used by a mobile app.
- Use token-based authentication (JWT or NextAuth session tokens).
- Keep endpoints consistent for web and mobile consumption.

## Deployment
- Deploy frontend using Vercel.
- Use Azure SQL Database or another managed SQL Server provider.
- Set environment variables in the deployment platform.
- Use GitHub Actions or Vercel auto-deploy for continuous delivery.

## Notes
- Enforce one active group per member in backend logic.
- Prevent members from editing past meal dates.
- Provide supervisor reports for unpaid members and due amounts.
- Build responsive UI using Tailwind utilities.

## Next Steps
1. Implement authentication and role-based guards.
2. Create Prisma models and database migrations.
3. Build the dashboard and meal entry flows.
4. Add expense/payment management and reporting.
5. Implement profile editing and comments.
6. Test all flows and deploy.
