# Mess Management System Design

## Overview
This document describes the high-level system design for a dynamic mess management platform. The platform supports web and mobile clients, a Next.js frontend, a backend API, and a database to manage groups, members, meals, expenses, payments, and comments.

## Architecture

### 1. Client Layer
- **Web frontend**: built with Next.js and React.
- **Mobile frontend**: native or cross-platform (React Native / Flutter) connecting to the same backend API.
- **Authentication**: token-based authentication using JWT or session cookies.
- **API communication**: REST or GraphQL API endpoints.

### 2. Backend Layer
- **API server**: Node.js with Next.js API routes or a separate Express / Fastify service.
- **Authentication service**: NextAuth.js or custom JWT-based auth.
- **Authorization**: role-based access control for admin, supervisor, and member.
- **Business logic**:
  - group creation and membership management
  - meal entry and validation
  - expense and payment tracking
  - comment management
  - reporting and dashboards
  - user profile management

### 3. Database Layer
- **Relational database**: Microsoft SQL Server.
- **Schema design**:
  - `User`
  - `Group`
  - `Membership`
  - `MealEntry`
  - `ExpenseEntry`
  - `PaymentStatus`
  - `Comment`
  - `Room` or `Seat` (optional for rent seat/room charges)
- **ORM**: Prisma, TypeORM, or Sequelize for schema management and querying.

## Data Flow

### User registration and login
1. Member registers via web or mobile client.
2. Frontend sends registration request to backend.
3. Backend validates and stores user data in `User` table.
4. Authentication token is returned to the client.

### Group and membership management
1. Supervisor creates a group via frontend.
2. Backend checks supervisor quota (max 10 groups).
3. Group data is stored in `Group` table.
4. Supervisor adds registered users to the group.
5. `Membership` records are created for active group assignments.
6. If a member leaves, the `Membership` record is updated with `leftAt` and `isActive=false`.

### Meal entry flow
1. Member selects current or future date.
2. Frontend submits meal counts to backend.
3. Backend validates date constraints and active membership.
4. Meal records are stored in `MealEntry`.
5. Dashboard queries aggregate meal totals by group and user.

### Expense and payment flow
1. Supervisor adds expenses (rent, utilities, bazar, other costs).
2. Backend stores expense records in `ExpenseEntry`.
3. Payment share calculations run dynamically:
   - total expense
   - total meals
   - per-meal cost
   - rent and utility share
4. `PaymentStatus` stores member dues and receipt status.
5. Supervisor can mark payments as paid or pending.
6. Dashboard reports members who have not paid and how much due.

### Comment flow
1. Member posts a comment.
2. Backend stores it in `Comment` with group association.
3. Supervisor/admin can view comments, reply, or delete them.

## Frontend Design

### Web app (Next.js)
- **Pages**:
  - `/login`
  - `/register`
  - `/dashboard`
  - `/group/[id]`
  - `/meal-entry`
  - `/expense`
  - `/members`
  - `/reports`
  - `/profile`
  - `/comments`
- **Components**:
  - dashboard cards
  - meal entry table
  - group/member management forms
  - expense and payment tables
  - comment threads
  - profile editor
- **State management**: React context, Redux, or Zustand.
- **Data fetching**: `getServerSideProps`, `getStaticProps` where needed, or client-side data fetching with `SWR` / `React Query`.
- **UI library**: Tailwind CSS, Chakra UI, or Material UI.

### Mobile app
- **Platform**: React Native or Flutter.
- **Screens**:
  - Login/Register
  - Dashboard
  - Group overview
  - Meal entry
  - Expense summary
  - Payment status
  - Comments
  - Profile
- **API integration**:
  - use the same backend API endpoints as the web app
  - token-based auth for mobile sessions
- **Offline support**: optional caching for faster access.

## Backend Design

### API style
- **REST endpoints** example:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/users/me`
  - `PUT /api/users/me`
  - `GET /api/groups`
  - `POST /api/groups`
  - `POST /api/groups/:groupId/members`
  - `DELETE /api/groups/:groupId/members/:memberId`
  - `GET /api/groups/:groupId/dashboard`
  - `POST /api/meal-entries`
  - `GET /api/meal-entries?groupId=&date=`
  - `POST /api/expenses`
  - `GET /api/expenses?groupId=`
  - `POST /api/payments`
  - `GET /api/payments?groupId=`
  - `POST /api/comments`
  - `GET /api/comments?groupId=`
- **GraphQL alternative**: use if the app needs flexible queries for dashboards and mobile.

### Security
- **Authentication**: JWT, refresh tokens, or NextAuth.
- **Authorization**: protect routes based on roles.
- **Input validation**: use schema validation with Zod or Joi.
- **Rate limiting**: optional for API abuse protection.
- **Audit logging**: optionally record supervisor actions.

### Scalability
- **Horizontal scaling**: stateless backend servers behind load balancer.
- **Database**: separate application database and read replicas if needed.
- **Caching**: Redis for session storage and frequent dashboard queries.

## Database Design

### Recommended database
- Microsoft SQL Server as the primary database.

### Tables and relationships
- `users`:
  - id
  - name
  - email
  - phone
  - profile_image
  - password_hash
  - role
  - created_at
  - updated_at

- `groups`:
  - id
  - name
  - supervisor_id
  - created_at
  - updated_at
  - status

- `memberships`:
  - id
  - user_id
  - group_id
  - joined_at
  - left_at
  - is_active
  - role_in_group (optional)

- `meal_entries`:
  - id
  - user_id
  - group_id
  - date
  - breakfast_count
  - lunch_count
  - dinner_count
  - total_meals
  - created_at
  - updated_at

- `expense_entries`:
  - id
  - group_id
  - type
  - amount
  - date
  - payer_id
  - is_received
  - split_method
  - note
  - created_at
  - updated_at

- `payment_statuses`:
  - id
  - user_id
  - group_id
  - expense_id
  - amount_due
  - amount_paid
  - status
  - due_date
  - created_at
  - updated_at

- `comments`:
  - id
  - user_id
  - group_id
  - text
  - reply_text
  - created_at
  - updated_at
  - deleted_at

- `rent_charges` (optional):
  - id
  - group_id
  - user_id
  - amount
  - period
  - is_paid
  - due_date
  - created_at

### Indexing and performance
- Index on `group_id` and `user_id` in all join tables.
- Index `date` fields for meal and expense queries.
- Use materialized views or aggregated tables for dashboard performance if needed.

## Mobile Integration
- Mobile apps use the same backend APIs as the web app.
- Authentication is token-based (JWT + refresh token).
- Mobile client requests:
  - profile and group membership
  - meal entry submission
  - dashboard data
  - expense and payment history
  - comments
- The backend can serve both web and mobile clients from the same API layer.
- Optionally create a separate mobile API namespace:
  - `/api/mobile/...`

## Deployment
- **Frontend**: deploy Next.js app on Vercel, Netlify, or any Node hosting.
- **Backend**: host Node.js API on Vercel, AWS EC2, DigitalOcean, or similar.
- **Database**: managed Microsoft SQL Server (Azure SQL Database or similar).
- **Storage**: cloud storage for profile images (S3, Azure Blob Storage).
- **CI/CD**: GitHub Actions or similar for deploy automation.

## Summary
This system design supports a full mess management platform with:
- dynamic group and member management
- member dashboards and group reports
- meal tracking and expense settlement
- rent and utility billing
- role-based access for admin, supervisor, and member
- a shared backend for both web and mobile clients
- scalable architecture using Next.js, Node.js, and SQL Server
