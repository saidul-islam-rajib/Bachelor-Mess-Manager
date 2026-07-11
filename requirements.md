# Bachelor Point Website Requirements

## Overview
A dynamic mess management website built with Next.js for bachelor mess/flat living. The system must support:
- registered users
- supervisors who create and manage multiple groups (messes)
- members who join or leave groups over time
- one active group membership per member at a time
- meal entry for current and future dates only
- detailed dashboards and expense tracking
- profile editing and comments
- full rent/utilities/other cost handling

## User Roles

### Admin
- register users
- assign supervisors
- remove users
- view/reply/delete comments
- manage groups if needed

### Supervisor
- can create and manage up to 10 groups
- can add/remove registered members in their groups
- can manage meals, bazar, expenses, and all additional costs per group
- can configure active/inactive members
- can view all member comments and reply/delete them
- cannot edit member comments once posted
- can view payment status and member stay duration

### Member
- register once globally
- login and update own profile
- join and leave groups dynamically
- can be active in only one group at a time
- can add/edit own meal entries for current and future dates only
- can add comments
- can view personal and group dashboards

## Groups
- A group represents one mess or shared living arrangement.
- Supervisors can create up to 10 groups.
- Each group has:
  - group name
  - active members
  - meal entries
  - bazar/expense records
  - rent and utility charges
  - payment status tracking
- Groups are dynamic: members may move from one group to another later.
- A registered user may be in group A today, then leave and join group B later.
- A registered member cannot be active in more than one group simultaneously.

## Membership Management
- Supervisors manage group membership.
- Members are added from the registered user pool.
- Supervisors can enable or disable group members.
- Members can leave a group.
- Membership history may be tracked.
- Supervisors should be able to see which members are currently active, which left, and which are long-term residents.

## Dashboards

### Member Dashboard
Each member sees:
- total meals taken
- personal meal cost
- total individual expense balance
- rent and utility dues
- current meal rate
- current month expense summary
- previous months summary
- upcoming meal entry options
- group summary and balances
- payment status (paid/unpaid)

### Group Dashboard
Should show:
- group total cost
- total group meals
- meal rate
- current month expenses
- previous months expense history
- total rent collected
- total utility expenses
- bazar and other cost summaries
- list of members who have paid or not paid
- which members have been staying longest
- total active members in the group
- per-member meal summary and overall meal totals

### Supervisor Dashboard
Includes:
- group management controls
- member payment status
- pending payments report
- long-term member list
- cost breakdown by rent, utilities, bazar, and other charges
- comment review and reply controls
- due amount report showing which member owes how much

### Member Dashboard
Each member sees:
- total meals taken
- personal meal cost
- total individual expense balance
- rent and utility dues
- current meal rate
- current month expense summary
- previous months summary
- upcoming meal entry options
- group summary and balances
- payment status (paid/unpaid)
- overall group summary with all members, their meal totals, and total members in the group

## Meal Management
- Meal entries are per member, per group.
- Members can add or edit meal counts for:
  - current date
  - future dates
- Members cannot edit past dates.
- Meal types may include breakfast, lunch, and dinner or a simplified meal count.
- Supervisor/admin can adjust any entries if needed.
- The entry interface should feel like the attached meal table layout.

## Expense Management
- Expense tracking is group-specific.
- Types of costs:
  - bazar costs
  - rent per member or per room/seat
  - electricity bill
  - water bill
  - waste bill
  - chef bill
  - wifi bill
  - other costs
- Supervisor can record each cost as shared or assigned to specific members.
- Supervisor can record payment receipt status for each cost item.
- The system calculates:
  - total group expense
  - total meals
  - per-meal rate
  - member share
  - individual dues
  - remaining balance

## Payment Tracking
- Supervisors can mark payments as received or pending.
- Supervisors can see lists of:
  - members who have not paid yet
  - members who have paid
  - member stay duration and long-term members
- Payment tracking should include:
  - rent payments
  - utility payments
  - meal expense settlements
  - other collected costs

## Profile Management
Members can update:
- name
- email
- phone number
- profile image
- any other contact details

## Comments
- Registered members can add comments.
- Supervisor/admin can:
  - view comments
  - reply to comments
  - delete comments
- Supervisor cannot edit member comments.
- Comment history should be visible to authorized users in the group context.

## UI/UX Requirements
- Clean, responsive dashboard layout.
- Member dashboard and group dashboard accessible from the main menu.
- Meal entry table similar to the provided attachment.
- Supervisor panel for group and member management.
- Expense history pages for monthly reports.
- Profile page for member updates.
- Comment area for member feedback and supervisor/admin responses.

## Functional Constraints
- Only one active group per member at a time.
- Supervisor can create at most 10 groups.
- Members can edit only current/future meals.
- Member registration is global; group membership is separate.
- Group cost calculations should update dynamically.
- Regular members should not manage group membership.

## Suggested Data Models
- `User`
  - id
  - name
  - email
  - phone
  - profileImage
  - role (admin, supervisor, member)
  - registration date

- `Group`
  - id
  - name
  - supervisorId
  - createdAt
  - status

- `Membership`
  - id
  - userId
  - groupId
  - joinedAt
  - leftAt
  - isActive

- `MealEntry`
  - id
  - userId
  - groupId
  - date
  - breakfastCount
  - lunchCount
  - dinnerCount
  - totalMeals
  - createdAt
  - updatedAt

- `ExpenseEntry`
  - id
  - groupId
  - type (bazar, rent, electricity, water, waste, chef, wifi, other)
  - amount
  - date
  - payerId
  - isReceived
  - splitMethod
  - note

- `PaymentStatus`
  - id
  - userId
  - groupId
  - expenseId
  - amountDue
  - amountPaid
  - status (paid, pending, partial)
  - dueDate

- `Comment`
  - id
  - userId
  - groupId
  - text
  - replyText
  - createdAt
  - repliedAt
  - deletedAt

## Notes
This website must support the full lifecycle of bachelor mess management:
- registration and profile updates
- dynamic group creation and membership
- meal planning and live editing for future dates
- expense collection across rent, utilities, bazar, and more
- dashboards for members, supervisors, and admins
- comment-based communication with approval controls
- robust payment tracking and reporting
