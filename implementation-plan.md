# Bachelor Point App Implementation Plan

## 1. Technology Stack
- Frontend: Next.js (React)
- Styling: Tailwind CSS
- State management: Jotai
- Backend API: Next.js API routes or separate Node.js service
- Database: Microsoft SQL Server
- ORM: Prisma
- Authentication: NextAuth.js or custom JWT auth
- Hosting / deployment: Vercel for frontend, Azure SQL Database or SQL Server hosting, optional backend on Vercel/Render

## 2. Application Structure

### Frontend
- `pages/`
  - `index.tsx` — landing or login redirect
  - `auth/login.tsx`
  - `auth/register.tsx`
  - `dashboard.tsx` — personal and group summary
  - `groups/[groupId].tsx` — group overview and reports
  - `meals.tsx` — meal entry and table view
  - `expenses.tsx` — expense management and history
  - `payments.tsx` — payment status and due reports
  - `members.tsx` — active members and member-specific overview
  - `profile.tsx` — update profile and image
  - `comments.tsx` — member comments and supervisor replies
  - `admin/*` — admin-only pages if needed
  - `supervisor/*` — supervisor controls for groups and membership

- `components/`
  - `DashboardCard.tsx`
  - `MealTable.tsx`
  - `MemberList.tsx`
  - `ExpenseTable.tsx`
  - `PaymentStatus.tsx`
  - `CommentThread.tsx`
  - `ProfileForm.tsx`
  - `GroupSelector.tsx`
  - `DatePicker.tsx`

- `store/`
  - `atoms/authAtoms.ts`
  - `atoms/dashboardAtoms.ts`
  - `atoms/groupAtoms.ts`
  - `atoms/mealAtoms.ts`
  - `atoms/expenseAtoms.ts`
  - `atoms/commentAtoms.ts`

- `lib/`
  - `api.ts` — API helpers
  - `auth.ts` — auth helpers and route guards
  - `validators.ts` — Zod schemas or runtime validation

### Backend
- `pages/api/`
  - `auth/register.ts`
  - `auth/login.ts`
  - `auth/me.ts`
  - `users/update.ts`
  - `groups/index.ts`
  - `groups/[id].ts`
  - `groups/[id]/members.ts`
  - `meal-entries/index.ts`
  - `expenses/index.ts`
  - `payments/index.ts`
  - `comments/index.ts`
  - `reports/dashboard.ts`
- `prisma/schema.prisma`
- `lib/prisma.ts`
- `middleware.ts` — auth middleware if needed

## 3. Feature Implementation Order

### Step 1: Foundation and setup
1. Initialize the Next.js app with TypeScript.
2. Install Tailwind CSS and configure styles.
3. Install Jotai for state management.
4. Add Prisma and set up SQL Server connection.
5. Implement authentication: registration, login, and protected routes.
6. Build global layout and navigation.

### Step 2: Data model and backend APIs
1. Define Prisma schema for User, Group, Membership, MealEntry, ExpenseEntry, PaymentStatus, and Comment.
2. Run migrations and seed sample data.
3. Implement backend API routes for users, groups, memberships, and meal entries.
4. Add API endpoints for expenses, payments, comments, and reports.

### Step 3: Core dashboards and meal tracking
1. Build member dashboard with personal stats and group summary.
2. Implement the meal entry UI with current/future date restrictions.
3. Add group dashboard for meal totals, payments, and summaries.
4. Implement supervisor controls for group and member management.

### Step 4: Expense, payment, and reporting
1. Add expense entry flows for bazar, rent, utilities, and other costs.
2. Implement payment tracking and due reports.
3. Add supervisor views for unpaid members, due amounts, and long-term stay reports.
4. Build monthly expense history and previous month reports.

### Step 5: Profile, comments, polish, and release
1. Add profile editing with image upload support.
2. Implement comment creation, supervisor reply, and delete actions.
3. Add member overview screens showing all members, meals, totals, and payment status.
4. Polish the UI for a best-in-class experience and ensure it works without any errors.
5. Test user flows, validate calculations, add tests where possible, and deploy the application.

## 4. State Management with Jotai
- Use Jotai atoms to manage authenticated user state, current group, dashboard data, and meal/expense forms.
- Keep local UI state in atoms for form values, selected date, member filters, and comments.
- Use fetch hooks or async atoms to load API data and sync with UI.

## 5. Styling with Tailwind CSS
- Configure Tailwind via `tailwind.config.js`.
- Build responsive layouts for dashboards, tables, and forms.
- Use utility classes for spacing, typography, colors, and grid layouts.
- Add custom theme tokens for brand colors and semantic styles.

## 6. Mobile app compatibility
- Use the same API layer for a future mobile app.
- Design API responses to support both web and mobile clients.
- Keep authentication tokens portable with JWT or secure cookies.
- Structure data models to allow efficient mobile sync.

## 7. Deployment strategy
- Deploy Next.js web app to Vercel.
- Use Azure SQL Database or another managed SQL Server provider.
- Store profile images in cloud storage (S3, Azure Blob Storage, or Vercel asset storage).
- Configure environment variables for database URL, JWT secret, auth settings.
- Use GitHub Actions or Vercel integration for continuous deployment.

## 8. Additional notes
- Ensure members cannot edit past meal dates.
- Enforce one active group per member at the backend.
- Provide supervisor reports for unpaid members and due amounts.
- Build dashboards that summarize group totals, meal totals, and member counts.
- Ensure the member entry table matches the expected attachment layout.
