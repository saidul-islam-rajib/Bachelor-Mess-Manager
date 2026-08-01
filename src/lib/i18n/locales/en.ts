const en = {
  common: {
    appTagline: 'Manage groups, meals, expenses, and member dashboards in one place.',
    loading: 'Loading...',
    saving: 'Saving...',
    save: 'Save',
    saveChanges: 'Save changes',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    edit: 'Edit',
    delete: 'Delete',
    remove: 'Remove',
    add: 'Add',
    create: 'Create',
    creating: 'Creating...',
    search: 'Search',
    filter: 'Filter',
    filters: 'Filters',
    clearFilters: 'Clear filters',
    reset: 'Reset',
    apply: 'Apply',
    actions: 'Actions',
    status: 'Status',
    role: 'Role',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    date: 'Date',
    amount: 'Amount',
    note: 'Note',
    total: 'Total',
    optional: 'Optional',
    you: '(you)',
    none: 'None',
    yes: 'Yes',
    no: 'No',
    all: 'All',
    month: 'Month',
    group: 'Group',
    supervisor: 'Supervisor',
    member: 'Member',
    members: 'Members',
    admin: 'Admin',
    show: 'Show',
    hide: 'Hide',
    dismiss: 'Dismiss notification',
    retry: 'Try again',
    of: 'of',
    perPage: 'Per page'
  },
  nav: {
    dashboard: 'Dashboard',
    groups: 'Groups',
    meals: 'Meals',
    bazar: 'Bazar',
    bills: 'Bills',
    payments: 'Payments',
    members: 'Members',
    comments: 'Comments',
    admin: 'Admin',
    profile: 'Profile',
    login: 'Login',
    register: 'Register',
    logout: 'Log out',
    toggleMenu: 'Toggle menu'
  },
  auth: {
    login: {
      title: 'Login',
      subtitle: 'Sign in to manage your mess.',
      email: 'Email',
      password: 'Password',
      submit: 'Sign in',
      submitting: 'Signing in...',
      registerPrompt: "Don't have an account?",
      registerLink: 'Register'
    },
    register: {
      title: 'Register',
      subtitle: 'Create your account. We will email you a link to choose your password.',
      name: 'Name',
      email: 'Email',
      phone: 'Phone',
      password: 'Password',
      confirmPassword: 'Confirm password',
      submit: 'Create account',
      submitting: 'Creating account...',
      loginPrompt: 'Already have an account?',
      loginLink: 'Login',
      phonePlaceholder: '+8801XXXXXXXXX'
    },
    checkEmail: 'Check your email for a link to create your password.',
    checkEmailDevMode: 'Email is not configured, so use the link below to create your password.',
    mailFailed: 'Account created, but the email could not be sent. Ask an administrator for a setup link.',
    submitted: {
      title: 'Registration submitted',
      body: 'An admin will review your account. You can sign in once it has been approved.',
      backToLogin: 'Back to login'
    },
    passwordStrength: {
      label: 'Password strength',
      tooShort: 'Too short',
      weak: 'Weak',
      fair: 'Fair',
      good: 'Good',
      strong: 'Strong'
    },
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    setPassword: {
      title: 'Create your password',
      subtitle: (name: string) => `Welcome ${name}. Choose a password to finish setting up your account.`,
      submit: 'Create password',
      submitting: 'Saving...',
      checking: 'Checking your link...',
      invalidTitle: 'This link cannot be used',
      requestNew: 'Back to sign in',
      successSignedIn: 'Password created. You are signed in.',
      successPending: 'Password created. An administrator will review your account before you can sign in.'
    }
  },
  roleRequests: {
    title: 'Role requests',
    subtitle: 'Members asking to become supervisors.',
    yourRole: 'Your role',
    becomeSupervisor: 'Request supervisor access',
    becomeMember: 'Switch back to member',
    reasonLabel: 'Why do you need supervisor access?',
    reasonPlaceholder: 'I run the mess at Mirpur and need to manage bills.',
    submit: 'Send request',
    submitted: 'Request sent. An administrator will review it.',
    autoApproved: (role: string) => `You are now a ${role.toLowerCase()}. Sign in again to use the new permissions.`,
    pending: 'Your request is waiting for a decision.',
    cancel: 'Cancel request',
    cancelled: 'Request cancelled.',
    approve: 'Approve',
    reject: 'Reject',
    approvedMessage: (role: string) => `Approved. The member is now a ${role.toLowerCase()}.`,
    rejectedMessage: 'Request rejected.',
    noneP: 'No role requests waiting.',
    invalidRole: 'You can only request the supervisor or member role.',
    idRequired: 'Request ID is required.',
    notFound: 'Request not found.',
    notYours: 'That request is not yours.',
    alreadyDecided: 'That request has already been decided.',
    approveRequired: 'approve must be true or false.',
    switchNote: 'Changing your role signs you out of other devices.',
    requestedOn: (date: string) => `requested ${date}`,
    autoApproveLabel: 'Automatically approve supervisor requests',
    autoApproveHint: 'When on, a member becomes a supervisor immediately without admin review.',
    allowSelfSwitchLabel: 'Allow members to step down to member on their own',
    allowSelfSwitchHint: 'Supervisors who run no groups can switch themselves back to member.'
  },
  validation: {
    required: (field: string) => `${field} is required.`,
    nameRequired: 'Name is required.',
    nameTooShort: (min: number) => `Name must be at least ${min} characters.`,
    nameTooLong: (max: number) => `Name must be at most ${max} characters.`,
    emailRequired: 'Email is required.',
    emailInvalid: 'Enter a valid email address.',
    phoneInvalid: (min: number, max: number) =>
      `Enter a valid phone number (${min}-${max} digits, optionally starting with +).`,
    passwordRequired: 'Password is required.',
    passwordTooShort: (min: number) => `Password must be at least ${min} characters.`,
    passwordTooLong: (max: number) => `Password must be at most ${max} characters.`,
    passwordSpaces: 'Password cannot start or end with a space.',
    passwordCommon: 'That password is too common. Please choose a different one.',
    passwordRepeated: 'Password cannot be a single repeated character.',
    passwordMismatch: 'Passwords do not match.',
    passwordHint: (min: number) => `At least ${min} characters. A short phrase you'll remember beats a cryptic one.`,
    currentPasswordRequired: 'Enter your current password to set a new one.',
    currentPasswordWrong: 'Your current password is not correct.',
    amountPositive: 'Amount must be a positive number.',
    amountTooLarge: 'That amount looks wrong. Please check it.',
    dateRequired: 'A valid date (YYYY-MM-DD) is required.',
    nothingToUpdate: 'Nothing to update.',
    textTooLong: (max: number) => `Please keep this under ${max} characters.`
  },
  errors: {
    generic: 'Something went wrong. Please try again.',
    network: 'Could not reach the server. Check your connection and try again.',
    unauthorized: 'You must be signed in.',
    forbidden: 'You do not have permission to do that.',
    notFound: 'Not found.',
    methodNotAllowed: 'Method not allowed',
    invalidCredentials: 'Invalid email or password.',
    suspiciousInput: 'That input looks like a script injection attempt and was blocked.',
    disposableEmail: 'Temporary or disposable email addresses are not accepted. Please use a permanent address.',
    emailDomainUnreachable: 'That email domain cannot receive mail. Please check the address and try again.',
    accountPending: 'Your account is awaiting admin approval.',
    accountInactive: 'Your account is not active. Please contact an admin.',
    tooManyAttempts: (minutes: number) =>
      `Too many sign-in attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    tooManyRequests: 'Too many requests. Please slow down and try again shortly.',
    tooManySignups: 'Too many sign-up attempts. Please try again later.',
    payloadTooLarge: 'That request is too large.',
    emailTaken: 'That email is already registered. Try signing in instead.',
    emailInUse: 'That email is already in use.',
    nothingToUpdate: 'Nothing to update.',
    adminOnly: 'Only admins can perform this action.',
    supervisorOnly: "Only this group's supervisor can perform this action.",
    notGroupMember: 'You are not a member of this group.',
    loadFailed: (what: string) => `Could not load ${what}.`,
    saveFailed: (what: string) => `Could not save ${what}.`,
    deleteFailed: (what: string) => `Could not delete ${what}.`
  },
  success: {
    saved: 'Saved.',
    created: (what: string) => `${what} created.`,
    updated: (what: string) => `${what} updated.`,
    deleted: (what: string) => `${what} deleted.`,
    welcomeBack: (name: string) => `Welcome back, ${name}.`,
    registrationSubmitted: 'Registration submitted.',
    profileUpdated: 'Profile updated.',
    passwordChanged: 'Password changed. Other devices have been signed out.',
    photoUpdated: 'Photo updated.',
    photoRemoved: 'Photo removed.',
    loggedOut: 'Logged out'
  },
  confirm: {
    title: 'Are you sure?',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    deleteTitle: (what: string) => `Delete ${what}?`,
    irreversible: 'This cannot be undone.'
  },
  emptyState: {
    noResults: 'No results',
    noResultsHint: 'Try changing or clearing the filters.',
    noGroups: "You're not part of any group yet.",
    noMembers: 'No active members.',
    noData: 'Nothing here yet.'
  },
  pagination: {
    showing: (from: number, to: number, total: number) => `Showing ${from}-${to} of ${total}`,
    previous: 'Previous',
    next: 'Next',
    page: 'Page',
    empty: 'No records'
  },
  dashboard: {
    title: 'Dashboard',
    signedInAs: (name: string, role: string) => `Signed in as ${name} (${role})`,
    subtitle: 'Your mess at a glance.',
    pendingApprovals: 'Pending approvals',
    approvedMembers: 'Approved members',
    supervisors: 'Supervisors',
    activeGroups: 'Active groups',
    inactiveGroups: 'Inactive groups',
    activeMemberships: 'Active memberships',
    totalAccounts: 'Total accounts',
    adminTools: 'Admin tools',
    adminToolsHint: 'Approve registrations, manage users and groups, and edit site settings.',
    pendingRegistrations: (count: number) =>
      `${count} registration${count === 1 ? '' : 's'} waiting for a decision.`,
    openAdmin: 'Open admin dashboard',
    allGroups: 'All groups',
    system: 'System',
    yourGroups: 'Your groups',
    manage: 'Manage',
    noGroupsYet: "You haven't created a group yet. Head to Groups to create your first mess.",
    spentThisMonth: 'Spent this month',
    outstandingDues: 'Outstanding dues',
    whoOwes: 'Who still owes',
    allSettled: 'Everyone is settled up this month.',
    recordPayment: 'Record a payment',
    longestStaying: 'Longest staying members',
    yourMeals: 'Your meals',
    mealRate: 'Meal rate',
    yourTotalCost: 'Your total cost',
    youOwe: 'You owe',
    messOwesYou: 'Mess owes you',
    yourBalance: 'Your balance',
    mealShare: 'Meal share (bazar)',
    billsShare: 'Bills share',
    totalCost: 'Total cost',
    groceriesYouBought: 'Groceries you bought',
    cashYouPaid: 'Cash you paid',
    stillDue: 'Still due',
    refundOwed: 'Refund owed to you',
    enterMeals: 'Enter meals',
    lastMonth: (month: string) => `Last month (${month})`,
    whereMoneyWent: 'Where the money went',
    groupMeals: 'Group meals',
    groupSpend: 'Group spend',
    youveBeenHere: "You've been here",
    groupPage: 'Group page',
    noGroupYet:
      "You're not in a group yet. Once a supervisor invites you and you accept, your meals, costs, and dues will show up here.",
    pendingInvitations: (count: number) =>
      `You have ${count} pending invitation${count === 1 ? '' : 's'}.`,
    viewInvitations: 'View invitations',
    meals: 'Meals',
    cost: 'Cost',
    due: 'Due',
    spent: 'Spent',
    outstanding: 'Outstanding'
  },
  groups: {
    title: 'Groups',
    subtitle: 'The messes you supervise or belong to.',
    dragHint: 'Drag a card to change the order.',
    create: 'Create a group',
    namePlaceholder: 'Group (mess) name',
    limitUsed: (used: number, max: number) => `${used} of ${max} used`,
    limitReached: (max: number) =>
      `You have reached the limit of ${max} groups. Close or hand over an existing group before creating another.`,
    limitExceeded: (max: number, current: number) =>
      `A supervisor can manage at most ${max} groups. This supervisor already has ${current}.`,
    nameRequired: 'Group name is required.',
    nameTooLong: (max: number) => `Group name must be at most ${max} characters.`,
    notFound: 'Group not found.',
    notASupervisor: 'That user is not a supervisor. Promote them first from the admin panel.',
    supervisorEmailRequired: 'Supervisor email is required.',
    supervisorNotFound: 'Supervisor user not found.',
    noGroups: 'No groups yet.',
    memberCount: (count: number) => `${count} member${count === 1 ? '' : 's'}`,
    inactive: 'inactive',
    orderSaveFailed: 'Could not save the new order.',
    statusTitle: 'Group status',
    statusHint:
      'Deactivating closes the mess. Everything stays on record and you can bring it back at any time.',
    activate: 'Activate',
    deactivate: 'Deactivate',
    activateConfirm: (name: string) => `Activate "${name}" again?`,
    deactivateConfirm: (name: string) => `Deactivate "${name}"?`,
    activateMessage: 'The group goes back to normal for everyone in it.',
    deactivateMessage: 'Members, meals, bazar and bills stay on record. You can activate the group again later.',
    activated: (name: string) => `"${name}" is active again.`,
    deactivated: (name: string) => `"${name}" is now inactive.`,
    statusUpdateFailed: 'Could not update the group status.',
    onlySupervisorOrAdmin: 'Only this group\'s supervisor or an admin can update it.'
  },
  members: {
    title: 'Members',
    subtitle: 'Who is in the mess now, who has left, and how long everyone has stayed.',
    current: 'Current members',
    past: 'Past members',
    pastHint: 'Their meals and costs stay on record for the months they were here.',
    activeCount: 'Active members',
    pastCount: 'Past members',
    longestStay: 'Longest stay',
    leaveGroup: 'Leave this group',
    leaveConfirm: (group: string) => `Leave "${group}"? Your past meals and costs stay on record.`,
    leftGroup: 'You have left the group.',
    addBack: 'Add back',
    since: (date: string) => `since ${date}`,
    left: (date: string) => `left ${date}`,
    noLongerActive: 'no longer active',
    stay: (duration: string) => `${duration} stay`,
    reactivated: (name: string) => `${name} is active again.`,
    deactivated: (name: string) => `${name} marked as left.`,
    emailRequired: 'Member email is required.',
    userNotFound: 'No registered user found with that email.',
    notApproved: 'That user has not been approved yet.',
    alreadyMember: 'That user is already a member of this group.',
    neverAMember: 'That user has never been a member of this group.',
    notActiveMember: 'That user is not an active member of this group.',
    youAreNotActive: 'You are not an active member of this group.',
    supervisorCannotLeave:
      'You supervise this group, so you cannot leave it. Ask an admin to reassign or close the group first.',
    supervisorCannotBeRemoved: 'The group supervisor cannot be removed.',
    supervisorAlwaysMember: 'The group supervisor is always a member of their own group.',
    userIdRequired: 'User ID is required.',
    isActiveRequired: 'isActive must be true or false.',
    alreadyInGroup: (group: string) =>
      `Already an active member of "${group}". A member can only be in one group at a time — leave that group first.`,
    youAreAlreadyInGroup: (group: string) =>
      `You are already in "${group}". You can only be in one group at a time — leave it first, then accept this invitation.`,
    userGone: 'That user no longer exists.',
    onlyAdminCanAdd: 'Only admins can add members directly. Supervisors should invite members.'
  },
  invitations: {
    title: 'Invitations',
    subtitle: 'Messes that have invited you to join.',
    none: 'No pending invitations',
    noneHint: 'When a supervisor invites you to a mess, it shows up here and in the bell at the top.',
    pendingBadge: (count: number) => `${count} pending`,
    accept: 'Accept',
    decline: 'Decline',
    sent: (name: string) => `Invitation sent to ${name}.`,
    resent: (name: string) => `Invitation to ${name} was re-sent.`,
    accepted: 'Invitation accepted.',
    declined: 'Invitation declined.',
    cancelled: 'Invitation cancelled.',
    notFound: 'Invitation not found.',
    idRequired: 'Invitation ID is required.',
    notYours: 'This invitation is not addressed to you.',
    alreadyAnswered: 'This invitation has already been answered.',
    invalidStatus: 'Status must be ACCEPTED or REJECTED.',
    onlySenderCanCancel: 'Only the sender can cancel this invitation.',
    onlySupervisorCanManage: "Only this group's supervisor can manage invitations.",
    selfInvite: 'You are already part of this group.',
    inviteePlaceholder: "Member's registered email"
  },
  meals: {
    title: 'Meals',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    monthlySummary: 'Monthly summary',
    pastLocked: 'Past dates are locked. You can only edit today or upcoming days.',
    ownOnly: 'You can only edit your own meals.',
    notAMember: 'That user is not a member of this group.',
    perMealPrice: 'Per meal price',
    totalMeals: 'Total meals'
  },
  expenses: {
    title: 'Groceries (Bazar)',
    notFound: 'Expense not found.',
    idRequired: 'Expense ID is required.',
    ownOnly: 'You can only edit your own expenses.',
    itemsRequired: 'Add at least one item.',
    itemNameRequired: 'Every item needs a name.',
    itemAmountInvalid: 'Every item needs an amount greater than zero.',
    shoppingReport: 'Shopping report',
    changeHistory: 'Change history',
    label: 'purchase'
  },
  bills: {
    title: 'Bills & fixed costs',
    subtitle: 'Rent, electricity, water, waste, chef, Wi-Fi and anything else that is not day-to-day bazar.',
    record: 'Record a bill',
    recordCta: '+ Record a bill',
    edit: 'Edit bill',
    thisMonth: 'Bills this month',
    recorded: (count: number) => `${count} recorded`,
    none: 'No bills recorded for this month',
    noneSupervisor: 'No bills recorded for this month yet — add one above.',
    totalBills: 'Total bills',
    paid: 'Paid',
    unpaid: 'Unpaid',
    yourShare: 'Your share',
    costBreakdown: 'Cost breakdown',
    costType: 'Cost type',
    paidBy: 'Paid by',
    notRecorded: 'Not recorded',
    notePlaceholder: 'July electricity, meter reading 4821',
    howShared: 'How is this shared?',
    equalHint: 'Divided evenly across every active member of the group.',
    customHint: 'Pick the members this cost belongs to and set each amount.',
    assignToMembers: 'Assign to members',
    splitEvenlySelected: 'Split evenly between selected',
    assignedOf: (assigned: string, total: string) => `Assigned ${assigned} of ${total}`,
    alreadyPaid: 'Already paid to the landlord / provider',
    markPaid: 'Mark paid',
    markUnpaid: 'Mark unpaid',
    showSplit: (count: number) => `Show split (${count})`,
    hideSplit: (count: number) => `Hide split (${count})`,
    yourShareOf: (amount: string) => `your share ${amount}`,
    markedPaid: 'Marked as paid.',
    markedUnpaid: 'Marked as unpaid.',
    deleteConfirm: (type: string, amount: string) => `Delete this ${type} bill of ${amount}?`,
    notFound: 'Bill not found.',
    idRequired: 'Bill ID is required.',
    onlySupervisor: "Only this group's supervisor can record bills.",
    onlySupervisorEdit: "Only this group's supervisor can change bills.",
    invalidType: 'Choose a valid cost type.',
    invalidSplit: 'Split method must be EQUAL or CUSTOM.',
    noActiveMembers: 'This group has no active members to split the bill across.',
    selectMember: 'Select at least one member to assign this cost to.',
    shareNeedsMember: 'Each share needs a member.',
    shareNeedsAmount: 'Each share needs a member and an amount.',
    duplicateMember: 'The same member is listed twice.',
    shareNegative: 'Each share amount must be zero or more.',
    shareNotMember: 'One of the selected people is not an active member of this group.',
    sharesMismatch: (sum: string, total: string) =>
      `The shares add up to ${sum}, but the bill is ${total}. They must match.`,
    payerNotMember: 'The person who paid must be a member of this group.',
    label: 'bill'
  },
  payments: {
    title: 'Payments',
    subtitleManage: 'Who has paid, how much, and what is still due for the month.',
    subtitleMember: 'What your meals cost this month and what you still owe.',
    record: 'Record a payment',
    recorded: 'Payment recorded.',
    removed: 'Payment removed.',
    received: 'Payments received',
    memberBalances: 'Member balances',
    balanceFormula:
      'Due = meal share + bills share − groceries they bought − cash they paid. A negative due means the mess owes them.',
    bazar: 'Bazar',
    bills: 'Bills',
    collected: 'Collected',
    outstanding: 'Outstanding dues',
    toRefund: 'To refund',
    mealShare: 'Meal share',
    billsShare: 'Bills share',
    totalCost: 'Total cost',
    boughtGroceries: 'Bought groceries',
    cashPaid: 'Cash paid',
    due: 'Due',
    refund: 'refund',
    refundOwed: 'Refund owed',
    selectMember: 'Select the member who paid.',
    notInGroup: 'That member does not belong to this group.',
    onlySupervisor: 'Only the group supervisor can record payments.',
    notFound: 'Payment not found.',
    label: 'payment',
    countSummary: (count: number, total: string) => `${count} payments · ${total}`
  },
  comments: {
    title: 'Comments',
    placeholder: 'Write a message for your mess...',
    replyPlaceholder: 'Write a reply...',
    post: 'Post',
    reply: 'Reply',
    replies: (count: number) => `${count} ${count === 1 ? 'reply' : 'replies'}`,
    mentionHint: 'Type @ to mention someone.',
    deleted: 'This message was deleted.',
    empty: 'No messages yet. Start the conversation.',
    textRequired: 'Write something first.',
    notFound: 'Comment not found.',
    idRequired: 'Comment ID is required.',
    onlySupervisorCanDelete: 'Only the group supervisor can delete comments.',
    ownOrSupervisor: 'You can only delete your own messages.',
    label: 'message'
  },
  profile: {
    title: 'Profile',
    subtitle: 'Your details and anything waiting for you.',
    yourDetails: 'Your details',
    signInPrompt: 'Please sign in to view your profile.',
    photo: 'Profile photo',
    photoHint: (maxMb: number) => `PNG, JPEG, WebP, or GIF. Up to ${maxMb} MB.`,
    uploadPhoto: 'Upload photo',
    changePhoto: 'Change photo',
    removePhoto: 'Remove',
    working: 'Working...',
    changePassword: 'Change password',
    changePasswordHint: 'Changing your password signs you out everywhere else. This browser stays signed in.',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmNewPassword: 'Confirm new password',
    changing: 'Changing...',
    imageTooLarge: (maxMb: number) => `That image is larger than ${maxMb} MB. Please pick a smaller one.`,
    imageWrongType: 'Choose a PNG, JPEG, WebP, or GIF image.',
    imageUnreadable: 'Could not read that file.',
    imageInvalid: 'That file is not a valid image.',
    imageEmpty: 'Image is empty.',
    imageNotDataUrl: 'Image must be a base64 data URL.',
    imageUndecodable: 'Image could not be decoded.'
  },
  admin: {
    title: 'Admin dashboard',
    subtitle: 'Approve registrations, manage users, and run groups.',
    accessDenied: 'Only admins can access this page.',
    tabs: {
      registrations: 'Registrations',
      users: 'Users',
      groups: 'Groups',
      security: 'Security',
      settings: 'Settings'
    },
    registrations: {
      title: 'Pending registrations',
      empty: 'No registrations waiting for review.',
      approve: 'Approve',
      reject: 'Reject',
      approved: (name: string) => `${name} approved.`,
      rejected: (name: string) => `${name} rejected.`,
      policyTitle: 'Registration policy',
      autoApproveLabel: 'Automatically approve new registrations',
      autoApproveHint:
        'When on, a new member can sign in as soon as they set their password, and nothing appears in this queue. Turn it off if you want to review every account yourself.',
      autoApproveOnNotice: 'Auto-approval is on, so new registrations do not wait here.',
      autoApproveOffNotice: 'Auto-approval is off. Every new account waits for your decision.',
      recentTitle: 'Recent registrations',
      recentHint: 'Everyone who signed up lately, newest first, whatever their status.',
      recentEmpty: 'Nobody has registered yet.',
      registeredAt: 'Registered'
    },
    users: {
      title: 'Users',
      searchPlaceholder: 'Search by name, email, or phone',
      filterRole: 'Role',
      filterStatus: 'Status',
      filterGroup: 'Group',
      filterSupervisor: 'Supervisor',
      sortBy: 'Sort by',
      newestFirst: 'Newest first',
      oldestFirst: 'Oldest first',
      nameAsc: 'Name (A-Z)',
      nameDesc: 'Name (Z-A)',
      lastLogin: 'Last login',
      never: 'Never',
      joined: 'Joined',
      groups: 'Groups',
      noGroup: 'No group',
      updated: (name: string) => `${name} updated.`,
      roleChangeBlocked: 'The built-in admin account cannot be changed.',
      invalidRole: 'Role must be ADMIN, SUPERVISOR or MEMBER.',
      invalidStatus: 'Invalid status.',
      notFound: 'User not found.',
      idRequired: 'User ID is required.',
      cannotChangeSelf: 'You cannot change your own role or status.',
      newPassword: 'New password',
      newPasswordHint: 'Leave blank to keep the current password. Setting one signs the user out everywhere.',
      passwordChanged: (name: string) => `Password updated for ${name}.`
    },
    impersonation: {
      action: 'Sign in as',
      confirmTitle: 'Sign in as this user',
      confirmBody: (name: string) =>
        `You will browse as ${name} until you stop. Anything you do is recorded as them.`,
      started: (name: string) => `You are now signed in as ${name}.`,
      stopped: 'Impersonation ended.',
      banner: (name: string) => `Viewing as ${name}`,
      bannerBack: (name: string) => `Signed in as ${name}`,
      stop: 'Stop',
      cannotImpersonateSelf: 'You are already signed in as yourself.',
      cannotImpersonateAdmin: 'Administrators cannot be impersonated.',
      targetNotApproved: 'Only approved accounts can be impersonated.'
    },
    groups: {
      title: 'Groups',
      searchPlaceholder: 'Search by group name',
      filterSupervisor: 'Supervisor',
      filterStatus: 'Status',
      createForSupervisor: 'Create a group for a supervisor',
      supervisorEmail: 'Supervisor email',
      manageMembers: 'Manage members',
      addMember: 'Add member',
      memberEmail: "Member's registered email",
      removed: (name: string) => `${name} removed from the group.`,
      added: (name: string) => `${name} added to the group.`
    },
    security: {
      title: 'Security policy',
      subtitle: 'Controls how the app defends itself against brute force and abuse.',
      maxLoginAttempts: 'Max failed login attempts per account',
      maxLoginAttemptsHint: 'After this many failures the account is locked for the lockout window.',
      loginLockoutMinutes: 'Account lockout window (minutes)',
      maxLoginAttemptsPerIp: 'Max failed login attempts per IP',
      ipLockoutMinutes: 'IP lockout window (minutes)',
      maxRegistrationsPerIp: 'Max registrations per IP',
      registrationWindowMinutes: 'Registration window (minutes)',
      requireStrongPasswords: 'Require strong passwords',
      requireStrongPasswordsHint: 'Rejects passwords that score below "Good" on the strength meter.',
      lockedAccounts: 'Currently locked accounts',
      noLockedAccounts: 'No accounts are locked right now.',
      unlock: 'Unlock',
      unlocked: (email: string) => `${email} unlocked.`,
      attemptsRemaining: (count: number) =>
        `${count} attempt${count === 1 ? '' : 's'} remaining before the account is locked.`,
      accountLocked: (minutes: number) =>
        `Too many failed attempts. This account is locked for ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      recentFailures: 'Recent failed sign-ins',
      noRecentFailures: 'No failed sign-ins recorded.'
    },
    settings: {
      title: 'Website settings',
      companyName: 'Company name',
      tagline: 'Tagline',
      address: 'Address',
      contactEmail: 'Contact email',
      contactPhone: 'Contact phone',
      copyrightOwner: 'Copyright owner',
      facebookUrl: 'Facebook URL',
      twitterUrl: 'Twitter URL',
      newsletterEnabled: 'Newsletter signup enabled',
      saved: 'Settings saved.',
      onlyAdmin: 'Only admins can change site settings.'
    }
  },
  landing: {
    meta: {
      title: (appName: string) => `${appName} — meals, bazar and bills for shared messes`,
      description:
        'Track every meal, every bazar receipt and every bill in one place, then let the app work out exactly what each person owes at the end of the month.'
    },
    hero: {
      eyebrow: 'For bachelor messes, hostels and shared flats',
      title: 'Run your mess',
      titleAccent: 'without the month-end argument.',
      subtitle:
        'Everyone logs their meals. Whoever goes to the bazar records the receipt. The supervisor adds rent, electricity and Wi-Fi. Bachelor Point does the maths and shows each person exactly what they owe.',
      primary: 'Create your account',
      secondary: 'Sign in',
      dashboard: 'Go to dashboard',
      groups: 'View your groups',
      signedInAs: (name: string) => `You are signed in as ${name}.`,
      note: 'Free to use. Register with your email and set a password from the link we send you.',
      previewLabel: 'Preview of the member dashboard showing meals, meal rate and dues for the month',
      highlights: ['Fair, meal-based split', 'Bills divided automatically', 'Works on any phone']
    },
    problem: {
      title: 'The notebook on the fridge never adds up',
      subtitle: 'Every shared kitchen runs into the same three arguments. Bachelor Point removes all three.',
      items: [
        {
          title: '"How many meals did I actually eat?"',
          body: 'Someone was away for nine days, someone skips breakfast every morning. By the 30th nobody remembers, so the cost gets split evenly and half the mess feels cheated.'
        },
        {
          title: '"I paid for the bazar last week"',
          body: 'Receipts live in pockets and phone galleries. The person who spends the most on groceries is usually the one who gets paid back the least.'
        },
        {
          title: '"Who still has not paid?"',
          body: 'Rent, electricity, water, Wi-Fi and the chef all arrive at once, and chasing seven people for seven different amounts falls on one tired volunteer.'
        }
      ]
    },
    features: {
      title: 'What you can do here',
      subtitle: 'Everything a shared kitchen needs, and nothing it does not.',
      items: [
        {
          icon: 'meals',
          title: 'Daily meal sheet',
          body: 'Tick breakfast, lunch and dinner for each day. Breakfast counts as half a meal by default, so the totals stay fair. Past days lock automatically so nobody can edit history.'
        },
        {
          icon: 'bazar',
          title: 'Itemised bazar',
          body: 'Record a grocery run item by item — rice, chicken, vegetables, oil — with the amount for each. Every change is kept in a history trail, so an edited receipt is never a mystery.'
        },
        {
          icon: 'bills',
          title: 'Bills and fixed costs',
          body: 'Rent, electricity, water, waste, chef and Wi-Fi. Split them evenly across the mess or assign exact amounts to the people a cost actually belongs to.'
        },
        {
          icon: 'payments',
          title: 'Dues and payments',
          body: 'See who has paid, who still owes and who the mess owes money back to. Record cash as it comes in and the balances update straight away.'
        },
        {
          icon: 'groups',
          title: 'Groups and invitations',
          body: 'A supervisor creates the mess and invites members by email. People join, leave and rejoin over time, and the history of who stayed when is kept.'
        },
        {
          icon: 'comments',
          title: 'Notes for the house',
          body: 'Leave a message for everyone, mention a specific person with @ and get a notification when it is your turn to buy the bazar.'
        }
      ]
    },
    screens: {
      title: 'A look inside',
      subtitle: 'These are the three screens you will spend your month in.',
      meals: {
        tag: 'Meals',
        title: 'One tap per meal, per person',
        body: 'Open the day, tick who ate what and move on. Members record their own meals; the supervisor can fill in for anyone who forgot. Breakfast is weighted at half a meal, so a light eater is never charged like a heavy one.'
      },
      bazar: {
        tag: 'Bazar',
        title: 'Receipts that survive the month',
        body: 'Whoever shops enters the items and amounts. The total is credited to them immediately, so at settlement time the mess pays them back instead of arguing about it.'
      },
      balances: {
        tag: 'Payments',
        title: 'One table that ends the debate',
        body: 'Meal share, bills share, groceries bought and cash paid, per member, for the month. A negative figure means the mess owes that person a refund.'
      }
    },
    math: {
      title: 'The maths is not hidden from you',
      subtitle:
        'There is no secret formula and no rounding tricks. Every number on your dashboard comes from these two lines, and you can check them yourself.',
      rateCaption: 'The meal rate is simply what the month cost divided by how much the mess ate.',
      diagramLabel: 'Diagram: total bazar spend divided by total meals gives the meal rate per meal',
      balanceTitle: 'And what each person owes',
      totalBazar: 'Total bazar',
      totalMeals: 'Total meals',
      mealRate: 'Meal rate'
    },
    steps: {
      title: 'Getting started takes about five minutes',
      items: [
        { title: 'Create an account', body: 'Your name, email and a password. Nothing else.' },
        {
          title: 'Set your password',
          body: 'We email you a secure link. Choose a password and your account is ready to use.'
        },
        {
          title: 'Join or start a mess',
          body: 'Accept an invitation from your supervisor, or ask for supervisor access and create the group yourself.'
        },
        {
          title: 'Log meals and bazar',
          body: 'From the first day of the month. The rate, the shares and the dues are worked out for you.'
        }
      ]
    },
    roles: {
      title: 'Three kinds of people use it',
      items: [
        {
          role: 'MEMBER',
          body: 'Records their own meals, sees what the month is costing them, and knows exactly what is still due.'
        },
        {
          role: 'SUPERVISOR',
          body: 'Runs one or more messes: invites members, records bills, confirms payments and publishes the monthly report.'
        },
        {
          role: 'ADMIN',
          body: 'Approves new registrations, manages users and groups, and looks after site settings and security.'
        }
      ]
    },
    trust: {
      title: 'Built to be safe with your household money',
      items: [
        {
          icon: 'shield',
          title: 'Sign-ins are guarded',
          body: 'Repeated failed sign-ins lock an account before anyone can guess their way in, and an administrator can require every new registration to be approved by hand.'
        },
        {
          icon: 'history',
          title: 'Nothing changes quietly',
          body: 'Bazar entries keep a change history, and every record stores who created it and who last touched it.'
        },
        {
          icon: 'lock',
          title: 'Only your mess sees your mess',
          body: 'Meals, bills and balances are visible to the members of that group and nobody else.'
        }
      ]
    },
    cta: {
      title: 'Settle this month properly',
      subtitle: 'Set the mess up once and the arguing stops for good.',
      primary: 'Create your account',
      secondary: 'Sign in'
    }
  },
  footer: {
    newsletter: 'Newsletter',
    newsletterHint: 'Get occasional updates. No spam.',
    subscribe: 'Subscribe',
    subscribed: 'Thanks for subscribing.',
    alreadySubscribed: 'That email is already subscribed.',
    emailPlaceholder: 'you@example.com',
    builtBy: (author: string) => `Built by ${author}`,
    rights: 'All rights reserved.',
    licensed: (license: string) => `Released under the ${license} License.`
  },
  units: {
    days: (count: number) => `${count} day${count === 1 ? '' : 's'}`,
    months: (count: number) => `${count} month${count === 1 ? '' : 's'}`,
    years: (count: number) => `${count} year${count === 1 ? '' : 's'}`,
    yearsMonths: (years: number, months: number) => `${years}y ${months}m`
  },
  status: {
    UNVERIFIED: 'Unverified',
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    ACCEPTED: 'Accepted',
    PAID: 'Paid',
    PARTIAL: 'Partial'
  },
  roles: {
    ADMIN: 'Administrator',
    SUPERVISOR: 'Supervisor',
    MEMBER: 'Member'
  },
  expenseTypes: {
    BAZAR: 'Bazar',
    RENT: 'Rent',
    ELECTRICITY: 'Electricity',
    WATER: 'Water',
    WASTE: 'Waste',
    CHEF: 'Chef',
    WIFI: 'Wi-Fi',
    OTHER: 'Other'
  },
  splitMethods: {
    MEAL: 'By meals',
    EQUAL: 'Split equally',
    CUSTOM: 'Selected members'
  },
  paymentStatuses: {
    PAID: 'Settled',
    PARTIAL: 'Partly paid',
    PENDING: 'Unpaid',
    REFUND: 'Refund due'
  },
  mealRateModes: {
    MONTHLY: 'One rate for the month',
    DAILY: 'A rate for each day'
  },
  weekdays: {
    0: { label: 'Sunday', short: 'Sun' },
    1: { label: 'Monday', short: 'Mon' },
    2: { label: 'Tuesday', short: 'Tue' },
    3: { label: 'Wednesday', short: 'Wed' },
    4: { label: 'Thursday', short: 'Thu' },
    5: { label: 'Friday', short: 'Fri' },
    6: { label: 'Saturday', short: 'Sat' }
  }
} as const;

export type Messages = typeof en;

export default en;
