# Bachelor Point Solution Architecture

## Purpose
This document describes the best architecture for a modern mess management system. It is designed to be presentable to stakeholders and includes the main layers, technologies, data flows, and why SQL Server is the chosen database.

## Architecture Overview
The system is built as a web-first platform with a clean separation between:
- Presentation layer (frontend)
- Application layer (backend)
- Data layer (SQL Server)
- Integration layer (API/mobile)

## High-Level Components

### 1. Frontend
- Framework: **Next.js**
- Styling: **Tailwind CSS**
- State Management: **Jotai**
- Key responsibilities:
  - login and registration
  - member dashboards
  - group and meal management
  - expense and payment views
  - profile editing
  - comment threads
- Advantages:
  - server-side rendering for fast initial load
  - static and dynamic pages for dashboard and reports
  - reusable components for consistent UI

### 2. Backend
- Platform: **Next.js API routes** or separate **Node.js** service
- Runtime: **Node.js**
- Authentication: **NextAuth.js** or custom JWT
- Authorization: role-based access control
- Key responsibilities:
  - user and role management
  - group/membership lifecycle
  - meal entry validation
  - expense and payment processing
  - reporting and dashboard aggregation
  - comment moderation
- Advantages:
  - centralized business logic
  - scalable API endpoints
  - shared data models across web and mobile

### 3. Data Layer
- Database: **Microsoft SQL Server**
- Access: **Prisma ORM** or a SQL Server native client
- Key data models:
  - `User`
  - `Group`
  - `Membership`
  - `MealEntry`
  - `ExpenseEntry`
  - `PaymentStatus`
  - `Comment`
- Advantages of SQL Server:
  - strong ACID compliance for financial and meal data
  - reliable transaction support for payments and expense updates
  - industry-grade security and role management
  - advanced reporting capabilities with views and stored procedures
  - easy integration with enterprise deployment environments

### 4. API and Integration
- API style: **REST** (or **GraphQL** if flexible querying is required)
- Mobile integration: same API endpoints used by mobile clients
- Authentication tokens: **JWT** or secure **cookies**
- Benefits:
  - one backend serves multiple clients
  - mobile apps can reuse web data flows
  - API-first design improves maintainability

## Deployment Architecture

### Hosting
- Frontend: **Vercel**, **Azure Static Web Apps**, or similar
- Backend: **Azure App Service**, **Vercel**, or **Docker container**
- Database: **Azure SQL Database** or on-premises SQL Server
- Storage: cloud storage for profile images

### Infrastructure
- Load balancer in front of API servers
- Auto-scaling for peak usage
- Secure network access between backend and SQL Server
- Environment-specific configuration for staging and production

## Security and Compliance
- Authentication and authorization at API layer
- Encrypt sensitive data in transit (HTTPS)
- Protect SQL Server with firewall and identity-based access
- Role-based access control for admin, supervisor, and member
- Data retention and audit logging for payment and comment actions

## Data Flow Summary
1. User logs in and receives an auth token.
2. Member selects a group and enters meal data.
3. Backend validates membership and date rules.
4. Meal and expense records persist in SQL Server.
5. Reporting queries aggregate totals for dashboards.
6. Supervisor enters rent or utility charges.
7. Payment status updates and due reports are generated.
8. Comments and replies are stored and surfaced by group.

## Reporting and Dashboards
- Personal dashboard for each member
- Group dashboard for meal totals, costs, and member status
- Supervisor dashboard for dues, unpaid members, and long-term residents
- Monthly and historical expense reports

## Recommended Architecture Diagram
- Client: Next.js web app / future mobile app
- API: Node.js / Next.js backend
- Data store: SQL Server
- Authentication: NextAuth / JWT
- State: Jotai on the frontend
- Styling: Tailwind CSS

## Why this architecture is best
- **SQL Server** ensures robust transactional integrity for meal and payment records.
- **Next.js** provides fast rendering and a strong developer experience.
- **Jotai** keeps frontend state simple and scalable.
- **Tailwind CSS** enables a modern, responsive UI quickly.
- The design supports both web and mobile clients with a shared backend API.
- The system is easy to present as a professional architecture for stakeholders.

## Conclusion
This architecture is designed to deliver a stable, secure, and scalable mess management system. It provides a clear separation of concerns, enterprise-grade data management with SQL Server, and a modern frontend experience with Next.js, Tailwind, and Jotai.