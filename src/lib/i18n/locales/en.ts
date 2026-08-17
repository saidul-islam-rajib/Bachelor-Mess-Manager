const en = {
  common: {
    appTagline: 'Manage groups, meals, expenses, and member dashboards in one place.',
    loading: 'Loading...',
    dash: '—',
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
    perPage: 'Per page',
    selected: 'Selected',
    skipToContent: 'Skip to main content',
    viewImage: 'View full image',
    pager: {
      previous: 'Previous',
      next: 'Next',
      pageOf: (current: number, total: number) => `Page ${current} of ${total}`
    }
  },
  nav: {
    dashboard: 'Dashboard',
    meals: 'Meals',
    bazar: 'Bazar',
    bills: 'Bills',
    payments: 'Payments',
    members: 'Members',
    admin: 'Admin',
    community: 'Community',
    guide: 'Guide',
    profile: 'Profile',
    login: 'Login',
    register: 'Register',
    logout: 'Log out',
    toggleMenu: 'Toggle menu',
    sectionMess: 'Your mess'
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
      registerLink: 'Register',
      forgotLink: 'Forgot your password?'
    },
    forgotPassword: {
      title: 'Forgot your password?',
      subtitle: 'Type the email you signed up with. If we know it, we will send you a link to choose a new password.',
      email: 'Email',
      submit: 'Send reset link',
      submitting: 'Sending...',
      backToLogin: 'Back to sign in',
      sentTitle: 'Check your email',
      sentBody: (email: string) =>
        `If an account exists for ${email}, a password reset link is on its way. It expires shortly, so use it soon.`,
      sentHint: 'Nothing arrived? Check your spam folder, or try again in a few minutes.',
      resend: 'Use a different email',
      devLinkNotice: 'Email is not configured on this server, so use the link below to reset the password.'
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
      requestAnother: 'Send me a new link',
      successSignedIn: 'Password created. You are signed in.',
      successPending: 'Password created. An administrator will review your account before you can sign in.',
      resetTitle: 'Choose a new password',
      resetSubtitle: (name: string) => `Hello ${name}. Pick a new password — this signs you out everywhere else.`,
      resetSubmit: 'Save new password',
      resetSuccessSignedIn: 'Password changed. You are signed in.',
      resetSuccessPending: 'Password changed. An administrator will review your account before you can sign in.'
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
    pendingBadge: 'Pending',
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
    invalidDate: 'A valid date (YYYY-MM-DD) is required.',
    groupIdRequired: 'Group ID is required.',
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
    permissionDenied: 'Your account does not have permission to do that. Ask an admin if you need it.',
    supervisorOnly: "Only this group's supervisor can perform this action.",
    notGroupMember: 'You are not a member of this group.',
    loadFailed: (what: string) => `Could not load ${what}.`,
    saveFailed: (what: string) => `Could not save ${what}.`,
    deleteFailed: (what: string) => `Could not delete ${what}.`,
    page: {
      notFoundTitle: 'This page does not exist',
      notFoundBody:
        'The link may be out of date, or the page may have been moved. Nothing is broken — pick a place to go from here.',
      serverTitle: 'Something went wrong on our side',
      serverBody:
        'The page could not be loaded. This one is on us, not you. Try again in a moment, and if it keeps happening let your admin know.',
      goDashboard: 'Go to dashboard',
      goHome: 'Back to home',
      goGuide: 'Read the guide',
      tryAgain: 'Try again'
    }
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
    quickActions: 'Quick actions',
    quickActionsHint: 'The things you do most, one tap away.',
    actions: {
      logBazar: 'Log bazar',
      logBazarHint: 'Add what was bought today',
      logBazarOwnHint: 'Groceries you bought',
      enterMeals: 'Enter meals',
      enterMealsHint: 'Tick who is eating',
      enterOwnMeals: 'Enter my meals',
      enterOwnMealsHint: 'Today and upcoming days',
      recordPayment: 'Record a payment',
      recordPaymentHint: 'Cash received from a member',
      ownPayments: 'My payments',
      ownPaymentsHint: 'What you have paid so far',
      inviteMember: 'Invite a member',
      inviteMemberHint: 'Add someone to the mess',
      messComments: 'Mess comments',
      messCommentsHint: 'Talk to your mess'
    },
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
    noGroupsYet: "You haven't created a group yet. Head to Members to create your first mess.",
    spentThisMonth: 'Spent this month',
    spentThisMonthAllGroups: 'Spent this month (all groups)',
    totalAmount: (amount: string) => `${amount} total`,
    outstandingDues: 'Outstanding dues',
    highestGroupRate: 'Highest group rate',
    lowestGroupRate: 'Lowest group rate',
    expandAll: 'Expand all',
    collapseAll: 'Collapse all',
    noMembersYet: 'No members yet.',
    groupCardSubtitle: (memberCount: number, rate: string) =>
      `${memberCount} member${memberCount === 1 ? '' : 's'} · ${rate} / meal`,
    outstandingSuffix: (amount: string) => ` · ${amount} outstanding`,
    openGroup: 'Open group',
    mealCostBazar: 'Meal cost (bazar)',
    frontedByMembers: 'Fronted by members',
    yetToRecover: 'Yet to recover',
    billsRentUtilities: 'Bills (rent, utilities & more)',
    additional: 'Additional',
    collected: 'Collected',
    thisMonthShort: 'This month',
    highestDay: 'Highest day',
    lowestDay: 'Lowest day',
    everyoneThisMonth: 'Everyone this month',
    todayMealsTitle: "Today's total meals",
    todayMealsHint: 'What the chef needs to cook today, across every member.',
    yourCost: 'Your cost',
    refund: 'Refund',
    memberCountHere: (count: number, stay: string) => `${count} member${count === 1 ? '' : 's'} · here ${stay}`,
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
    outstanding: 'Outstanding',
    signInPrompt: 'Please sign in.',
    nothingToShow: 'Nothing to show yet.'
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
    onlySupervisorOrAdmin: 'Only this group\'s supervisor or an admin can update it.',
    yourGroups: 'Your groups',
    yourGroupsHint: 'Every mess you supervise or belong to. The order here is the order they appear in every group picker.',
    created: (name: string) => `Group "${name}" created.`,
    createFailed: 'Could not create group.',
    moveUp: 'Move up',
    moveDown: 'Move down',
    mealWeightsTitle: 'Meal weights',
    mealWeightsHint: 'How much each meal counts toward the cost split (e.g. breakfast 0.5, lunch 1, dinner 1).',
    mealWeightsSaved: 'Meal weights updated.',
    mealWeightsFailed: 'Could not save meal weights.',
    costRulesTitle: 'How costs are worked out',
    costRulesHint:
      'These two settings decide how the meal rate is priced and what happens to unpaid balances at month end.',
    rateLabel: 'Meal rate',
    rateMonthly: 'One rate for the month (total bazar ÷ total meals)',
    rateDaily: 'Same month rate, plus each day\'s own price shown for reference',
    rateMonthlyHint:
      'One monthly rate is the simplest to explain and evens out days when bazar was unusually cheap or expensive. Every day in the meal table shows the same number.',
    rateDailyHint:
      'Everyone is still charged one flat rate for the month — total bazar ÷ total meals. This just adds each day\'s own price to the meal table, spread from the shopping trip that fed it, so you can see which days were expensive. A quiet day shows a higher price per meal than a busy one, but it never changes anyone\'s bill.',
    rateSaved: 'Meal rate updated.',
    carryLabel: 'Carry unpaid balances into the next month',
    carryHint:
      'When you close a month, whatever someone still owes (or is owed) opens the next month as their brought forward balance instead of being written off.',
    carrySaved: 'Carry-forward updated.',
    settingFailed: 'Could not save that setting.',
    pastMealsTitle: 'Changes to past meals',
    pastMealsHint:
      'A member unlocks past days from the meals page. This decides what happens next: the change either counts straight away, or it waits for you. The admin sets a site-wide default; you can override it for this mess.',
    pastMealsLabel: 'When a member changes a past day',
    pastMealsInherit: (current: string) => `Follow the site default — ${current.toLowerCase()}`,
    pastMealsRequired: 'It waits for my approval',
    pastMealsAuto: 'It counts straight away',
    pastMealsRequiredHint:
      'Changes land in "Meal changes waiting for you" on the meals page. Nothing moves the meal rate until you approve it.',
    pastMealsAutoHint:
      'Changes apply immediately and the whole mess is notified. Faster for a mess that trusts itself, but a back-dated edit shifts everyone else\'s share without a check.',
    pastMealsSaved: 'Past-meal approval updated.',
    handover: 'Make supervisor',
    handoverConfirm: (name: string) => `Hand supervision over to ${name}?`,
    handoverMessage:
      'They take over running this mess straight away. The current supervisor stays in the group as an ordinary member and loses the supervisor controls. A mess only ever has one main supervisor — to give somebody the same controls without handing over, add them as a second supervisor instead.',
    handoverDone: (name: string) => `${name} now supervises this mess.`,
    handoverFailed: 'Could not hand over supervision.',
    handoverOnlySupervisor: 'Only this group\'s supervisor or an admin can hand over supervision.',
    handoverSelf: 'That member already supervises this group.',
    handoverNotMember: 'Only an active member of this group can take it over.',
    handoverNotApproved: 'That account has not been approved yet.',
    handoverAtLimit: (name: string, max: number) =>
      `${name} already supervises ${max} group${max === 1 ? '' : 's'}, which is the limit.`,
    handoverNotice: (from: string, to: string, group: string) =>
      `${from} handed supervision of "${group}" over to ${to}.`,
    coSupervisor: 'Add as second supervisor',
    coSupervisorRemove: 'Remove as supervisor',
    coSupervisorConfirm: (name: string) => `Make ${name} a second supervisor of this mess?`,
    coSupervisorMessage:
      'They get the same controls as the supervisor: recording bazar, bills and payments, approving meal edits and managing members. The current supervisor keeps running the mess and stays the one who can hand it over.',
    coSupervisorRemoveConfirm: (name: string) => `Remove ${name} as a supervisor of this mess?`,
    coSupervisorRemoveMessage:
      'They stay in the mess as an ordinary member and lose the supervisor controls straight away.',
    coSupervisorAdded: (name: string) => `${name} is now a second supervisor.`,
    coSupervisorRemoved: (name: string) => `${name} is no longer a supervisor.`,
    coSupervisorFailed: 'Could not change the supervisors.',
    coSupervisorAlready: 'They already supervise this mess.',
    coSupervisorAlreadyPrimary: 'They already supervise this mess.',
    coSupervisorNotFound: 'That member is not a second supervisor of this mess.',
    coSupervisorCannotRemovePrimary:
      'That is the main supervisor. Hand supervision over to somebody else instead of removing them.',
    coSupervisorOnlySupervisor: 'Only this mess\'s supervisor or an admin can change the supervisors.',
    coSupervisorAtCap: (max: number) =>
      `This mess is limited to ${max} supervisor${max === 1 ? '' : 's'}. An admin can raise the limit in Admin → Settings.`,
    coSupervisorNotice: (actor: string, name: string, group: string) =>
      `${actor} made ${name} a second supervisor of "${group}".`
  },
  members: {
    title: 'Members',
    subtitle: 'Who is in the mess now, who runs it, and everything about the mess itself.',
    groupLabel: 'Group',
    showClosed: 'Show closed',
    noGroups: 'You are not part of any mess yet.',
    supervisedBy: (name: string, email: string) => `Supervisor: ${name} (${email})`,
    tabs: {
      roster: 'Roster',
      invites: 'Invitations',
      settings: 'Group settings',
      groups: 'Your groups'
    },
    inviteTitle: 'Invite a member',
    inviteHint: 'Enter the email of an approved user. They get an invitation to accept.',
    invite: 'Invite',
    inviting: 'Sending...',
    pendingInvites: 'Pending invitations',
    noPendingInvites: 'No invitations are waiting for an answer.',
    inviteFailed: 'Could not send invitation.',
    cancelInviteFailed: 'Could not cancel invitation.',
    loadFailed: 'Could not load members.',
    updateFailed: 'Could not update the member.',
    leaveFailed: 'Could not leave the group.',
    profile: {
      title: 'Member profile',
      loadFailed: 'Could not load that profile.',
      viewLabel: (name: string) => `View ${name}'s profile`,
      you: 'This is you',
      contact: 'Contact',
      email: 'Email',
      phone: 'Phone',
      phoneMissing: 'Not shared',
      memberSince: 'Joined Bachelor Point',
      role: 'Role',
      inMesses: 'In your messes',
      noSharedGroups: 'No shared mess to show.',
      supervisor: 'Supervisor',
      activeSince: (date: string) => `Active since ${date}`,
      leftOn: (date: string) => `Left ${date}`,
      photoTitle: (name: string) => `${name}'s photo`,
      editMine: 'Edit my profile'
    },
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
    pending: 'Pending',
    accept: 'Accept',
    decline: 'Decline',
    invitedYouToJoin: 'invited you to join',
    joinedGroup: (group: string) => `You joined "${group}".`,
    declinedGroup: (group: string) => `Invitation to "${group}" declined.`,
    updateFailed: 'Could not update invitation.',
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
    subtitle: 'Log your daily meals.',
    subtitleManage: 'Log meals for the mess. You can change any past day — everyone gets told when you do.',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    monthlySummary: 'Monthly summary',
    pastLocked: 'Past dates are locked. You can only edit today or upcoming days.',
    ownOnly: 'You can only edit your own meals.',
    notAMember: 'That user is not a member of this group.',
    perMealPrice: 'Per meal price',
    totalMeals: 'Total meals',
    today: 'Today',
    locked: 'Locked',
    awaitingApproval: 'Awaiting approval',
    mealCount: (count: number) => `${count} meal${count === 1 ? '' : 's'}`,
    perMealShort: (price: string) => `${price}/meal`,
    approvalNotice: 'Changes to this day go to your supervisor for approval before they count.',
    everyoneOnDay: (count: number) => `Everyone else (${count})`,
    hideEveryone: 'Hide everyone else',
    editingFor: (name: string) => `Editing ${name}`,
    dailyCostNote:
      "This group shows each day's own price for reference — a quiet day can look pricier per meal than a busy one, because the same bazar fed fewer people. It doesn't change your bill: your cost is always your meals times the month's rate above.",
    ratedThrough: (day: string) =>
      `The meal rate and everyone's cost are worked out from bazar and meals up to ${day}. Later days show planned meals only and are not priced yet.`,
    notStartedYet: 'This month has not started. The numbers below are planned meals only — nothing is priced yet.',
    window: {
      showingRange: (from: string, to: string) => `Showing ${from} – ${to}`,
      showingAll: (count: number) => `Showing all ${count} days`,
      showWholeMonth: (count: number) => `Show the whole month (${count} days)`,
      showAroundToday: 'Back to the days around today',
      hiddenNote: (count: number) => `${count} other day${count === 1 ? '' : 's'} this month are hidden.`
    },
    rate: {
      title: 'Your meal rate',
      todayLabel: "Today's rate",
      latestLabel: (day: string) => `Latest priced day · ${day}`,
      perMealUnit: 'per meal',
      noRateYet: 'No rate yet',
      noRateYetHint: 'A rate appears for a day once bazar has been recorded and someone has eaten.',
      monthLabel: 'This month so far',
      monthHintDaily: 'The rate shown is the running total — bazar so far ÷ meals so far.',
      monthHintMonthly: 'Total bazar divided by every meal eaten this month.',
      yourMealsToday: (count: number) => `You ate ${count} meal${count === 1 ? '' : 's'} today`,
      yourCostToday: 'Your cost today',
      yourMealsMonth: 'Your meals',
      yourCostMonth: 'Your meal cost',
      dayByDay: 'Day by day',
      showAll: (count: number) => `Show all ${count} days`,
      showLess: 'Show fewer days',
      colDay: 'Day',
      colYourMeals: 'You',
      colYourCost: 'Your cost',
      colGroupMeals: 'Mess',
      colRunningRate: 'Running',
      noPricedDays: 'No day has been priced yet this month.',
      modeDaily: 'Priced day by day for reference; charged at the month\'s flat rate',
      modeMonthly: 'Charged one flat rate for the whole month',
      runningRateColumn: 'Running rate',
      runningRateHint:
        "Total bazar spent so far ÷ total meals eaten so far, up to and including this day. It settles down as the month goes on and is for reference only — it is not what anyone is actually charged."
    },
    trend: {
      title: 'Daily meal rate trend',
      subtitle: 'The running rate, day by day this month',
      empty: 'Not enough priced days yet to show a trend.',
      highest: 'Highest',
      lowest: 'Lowest',
      highestWeekLabel: (range: string) => `Highest week: ${range}`,
      highestWeekRate: (rate: string) => `Average ${rate}/meal that week`,
      boughtBy: (list: string) => `Bazar bought by ${list}`,
      noBuyersThatWeek: 'No bazar was recorded that week — it rode on an earlier shopping trip.',
      firstPricedDay: 'First priced day this month',
      moreThanPriorDay: (amount: string) => `▲ ${amount} more than the day before`,
      lessThanPriorDay: (amount: string) => `▼ ${amount} less than the day before`,
      samePriorDay: 'Same as the day before'
    }
  },
  history: {
    title: 'Change history',
    subtitleExpense: 'Every edit to a grocery price is recorded here so the whole group can see it.',
    subtitleBill: 'Every edit to this bill is recorded here so the whole group can see it.',
    empty: 'No changes recorded yet.',
    unknownActor: 'Someone',
    actions: {
      CREATED: 'Added',
      UPDATED: 'Changed',
      DELETED: 'Deleted'
    } as Record<string, string>,
    added: (label: string, amount: string) => `added ${label}${amount ? ` for ${amount}` : ''}`,
    deleted: (label: string, amount: string) => `deleted ${label}${amount ? ` (${amount})` : ''}`,
    changed: (parts: string) => `changed ${parts}`,
    amountChange: (from: string, to: string) => `total ${from} → ${to}`,
    dateChange: (from: string, to: string) => `date ${from} → ${to}`,
    noteChange: (from: string, to: string) => `note "${from}" → "${to}"`,
    loading: 'Loading history…',
    failed: 'Could not load the change history.'
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
    label: 'purchase',
    byMember: 'Bazar by member',
    monthTotal: (amount: string) => `Month total ${amount}`,
    purchaseCount: (count: number) => `${count} purchase${count === 1 ? '' : 's'}`
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
    label: 'bill',
    manageCostTypes: (count: number) => `Manage cost types (${count})`,
    recordOpen: 'Close',
    recordCollapsedHint: 'Add rent, gas, electricity or any other fixed cost.',
    noCostTypes: 'No cost types yet.',
    partPayment: 'Part',
    ledger: {
      reverse: 'reverse',
      reversed: '· reversed',
      recordedBy: (name: string) => `by ${name}`
    },
    transfer: {
      intoCollection: 'Paid into the collection',
      paidTo: (name: string) => `Paid to ${name}`,
      getsBack: (amount: string) => `(gets back ${amount})`,
      amountFrom: (name: string) => `Amount received from ${name}`,
      whoDidPay: (name: string) => `Who did ${name} pay?`
    },
    paymentHistory: {
      title: 'Payment history',
      subtitle: (count: number) => `${count} payment${count === 1 ? '' : 's'} recorded this month`,
      fromAdvance: '· from advance'
    },
    advances: {
      title: 'Advances',
      balanceSummary: (amount: string, count: number) =>
        `${amount} on hand across ${count} member${count === 1 ? '' : 's'}`,
      noneYet: 'No advance collected yet',
      explanation:
        "Money members hand over ahead of a bill. New bills automatically pull from whatever balance a member has on file, so rent, wifi and electricity can be paid the moment they're due.",
      selectMember: 'Select member',
      noteLabel: 'Note (optional)',
      notePlaceholder: 'e.g. August advance',
      collectCta: 'Collect advance',
      historyTitle: 'History',
      appliedToBill: '· applied to a bill',
      reversalEntry: '· reversal',
      depositEntry: '· deposit',
      confirmReverse: 'Reverse this advance deposit?',
      recorded: 'Advance recorded.',
      reversedToast: 'Advance reversed.',
      loadFailed: 'Could not load advances.',
      recordFailed: 'Could not record that advance.',
      reverseFailed: 'Could not reverse that entry.'
    }
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
    title: 'Mess comments',
    subtitle:
      "Only your mess can read this. Anyone in it can post and reply, and mention someone with @. Once posted, a comment can't be edited — only the supervisor can remove it.",
    sectionDescription: "Private to this mess. Post, reply, and mention someone with @.",
    composeHeading: 'Say something',
    threadHeading: 'Thread',
    noGroup: "You're not part of any group yet.",
    placeholder: 'Write a message for your mess...',
    replyPlaceholder: 'Write a reply...',
    post: 'Post',
    postComment: 'Post comment',
    posting: 'Posting...',
    sendReply: 'Send reply',
    sending: 'Sending...',
    deleteComment: 'Delete comment',
    deleteReply: 'Delete reply',
    posted: 'Comment posted.',
    replyPosted: 'Reply posted.',
    commentDeleted: 'Comment deleted.',
    replyDeleted: 'Reply deleted.',
    postFailed: 'Could not post.',
    replyFailed: 'Could not reply.',
    deleteFailed: 'Could not delete.',
    loadFailed: 'Could not load comments.',
    reply: 'Reply',
    replies: (count: number) => `${count} ${count === 1 ? 'reply' : 'replies'}`,
    mentionHint: 'Type @ to mention someone, or @everyone to notify the whole mess.',
    mentionEveryone: 'Notify all members',
    tooLong: (max: number) => `Keep it under ${max} characters.`,
    tooManyImages: (max: number) => `You can attach up to ${max} photos per comment.`,
    addPhotos: 'Add photos',
    imageRemove: 'Remove photo',
    composerTitle: 'Write a mess comment',
    commentImageAlt: (name: string, index: number) => `Photo ${index + 1} from ${name}'s comment`,
    deleted: 'This message was deleted.',
    empty: 'No messages yet. Start the conversation.',
    textRequired: 'Write something or add a photo first.',
    notFound: 'Comment not found.',
    idRequired: 'Comment ID is required.',
    onlySupervisorCanDelete: 'Only the group supervisor can delete comments.',
    ownOrSupervisor: 'You can only delete your own messages.',
    label: 'message'
  },
  notifications: {
    fallbackActor: 'Someone',
    defaultAction: 'mentioned you',
    actions: {
      MENTION_COMMENT: 'mentioned you in a comment',
      MENTION_REPLY: 'mentioned you in a reply',
      MENTION_EXPENSE_COMMENT: 'mentioned you in a bazar note',
      MENTION_COMMUNITY: 'mentioned you in the community',
      SUPERVISOR_CHANGED: 'handed over supervision'
    },
    inGroup: 'in',
    title: 'Notifications',
    subtitle: 'Everything the mess has told you, newest first.',
    panelTitle: 'Notifications',
    newCount: (count: number) => `${count} new`,
    markAllRead: 'Mark all read',
    allRead: 'Everything is read.',
    caughtUp: "You're all caught up",
    caughtUpHint: 'Invitations and mentions will show up here.',
    seeAll: 'See all notifications',
    filterAll: 'All',
    filterUnread: 'Unread',
    emptyAll: 'Nothing here yet. Mentions, meal asks and decisions land here.',
    emptyUnread: 'Nothing unread. Switch to All to see the older ones.',
    pendingInvitations: (count: number) =>
      `${count} pending invitation${count === 1 ? '' : 's'} — open the bell or your profile to respond.`
  },
  community: {
    title: 'Community',
    subtitle: (app: string) =>
      `Everyone on ${app} can read this, not just your mess. Ask a question, share news, welcome new faces.`,
    placeholder: 'Write something for everyone...',
    post: 'Post',
    posting: 'Posting...',
    empty: 'No posts yet. Be the first to say hello.',
    loadingOlder: 'Loading older posts...',
    endOfFeed: "You're all caught up.",
    newMessages: (count: number) => `${count} new post${count === 1 ? '' : 's'}`,
    jumpToLatest: 'Jump to latest',
    markAllRead: 'Mark all as read',
    unreadBadge: (count: number) => `${count} unread`,
    formerMember: 'Former member',
    mentionHint: 'Type @ to mention someone.',
    everyoneAdminsOnly: 'Only admins can notify everyone here.',
    textRequired: 'Write something or add a photo first.',
    tooLong: (max: number) => `Keep it under ${max} characters.`,
    tooManyImages: (max: number) => `You can attach up to ${max} photos per post.`,
    addPhotos: 'Add photos',
    imageRemove: 'Remove photo',
    postImageAlt: (name: string, index: number) => `Photo ${index + 1} from ${name}'s post`,
    composerTitle: 'Create post',
    people: 'People',
    viewAllMembers: 'View all members',
    announcementsTitle: 'Announcements',
    posted: 'Posted to the community.',
    deleteAction: 'Delete message',
    deleteConfirmTitle: 'Delete this message?',
    deleteConfirmBody: 'It disappears for everyone in the community room.',
    deleted: 'Message deleted.',
    deleteNotAllowed: 'You can only delete your own messages.',
    notFound: 'Message not found.',
    idRequired: 'Message ID is required.',
    systemNotDeletable: 'System messages cannot be deleted.',
    signedOut: 'Sign in to join the community.',
    signedOutHint: 'Sign in to post, react, and get notified about new messages.',
    types: {
      MEMBER: 'Member',
      WELCOME: 'Welcome',
      ANNOUNCEMENT: "What's new",
      SYSTEM: 'System'
    },
    welcome: {
      title: 'New member',
      body: (name: string, app: string) => `${name} just joined ${app}. Say hello and help them settle in.`,
      selfTitle: (app: string) => `Welcome to ${app}`,
      selfBody: 'Everyone here shares meals, bazar and bills. Open the community room to meet the others.'
    },
    announcements: {
      communityRoom: {
        title: 'The community room is open',
        body: 'Everyone on the app shares this room. Ask a question, mention someone with @, and never miss an announcement.'
      },
      mealQuickReply: {
        title: 'Answer your meals in one tap',
        body: 'You now get a daily "are you eating today?" ask. Tap Yes or No from your phone and your meals are recorded, no sign-in needed.'
      }
    }
  },
  mealPrompt: {
    title: 'Quick meal reply',
    cardTitle: "We've got food for you! Are you eating?",
    question: (group: string, date: string) => `${group} · ${date}`,
    yes: 'Yes, count me in',
    no: 'No meals',
    choose: 'Choose meals',
    yesShort: 'Yes',
    noShort: 'No',
    usualHint: 'Counts your usual meals for that day.',
    noHint: 'Records zero meals for that day.',
    saved: 'Saved. Thank you!',
    savedDetail: (summary: string) => `Your meals are set: ${summary}.`,
    noneSummary: 'no meals',
    answeredYes: 'You said yes.',
    answeredNo: 'You said no.',
    answeredCustom: 'You picked your own counts.',
    changeAnswer: 'Change my answer',
    openApp: 'Open the app',
    invalidLink: 'This link is not valid.',
    expiredLink: 'This link has expired. Open the app to set your meals.',
    inactiveGroup: 'This mess is closed, so meals can no longer be changed.',
    notAMember: 'You are no longer a member of this mess.',
    invalidAnswer: 'Choose yes, no, or your own counts.',
    dateLocked: 'That day is already locked. Open the app to request a change.',
    dispatchForbidden: 'You cannot send meal reminders for this group.',
    dispatched: (count: number) => `Sent ${count} meal reminder${count === 1 ? '' : 's'}.`,
    nothingToSend: 'Everyone has already been asked.',
    sendNow: 'Ask everyone about meals',
    notificationTitle: (group: string, date: string) => `Are you eating in ${group} on ${date}?`,
    notificationBody: 'Tap yes or no to set your meals for that day.',
    emailSubject: (group: string, date: string) => `${group}: are you eating on ${date}?`,
    emailIntro: (name: string, group: string, date: string) =>
      `Hello ${name}, are you eating with ${group} on ${date}?`,
    emailFooter: 'One tap is all it takes. You can change your answer any time before the day starts.',
    counts: (breakfast: number, lunch: number, dinner: number) =>
      `breakfast ${breakfast}, lunch ${lunch}, dinner ${dinner}`
  },
  profile: {
    title: 'Profile',
    subtitle: 'Your details and anything waiting for you.',
    yourDetails: 'Your details',
    signInPrompt: 'Please sign in to view your profile.',
    photo: 'Profile photo',
    photoHint: (limit: string) => `PNG, JPEG, WebP, or GIF. Up to ${limit}.`,
    uploadPhoto: 'Upload photo',
    changePhoto: 'Change photo',
    removePhoto: 'Remove',
    working: 'Working...',
    cropTitle: 'Choose profile picture',
    cropZoomLabel: 'Zoom',
    cropZoomOut: 'Zoom out',
    cropZoomIn: 'Zoom in',
    changePassword: 'Change password',
    changePasswordHint: 'Changing your password signs you out everywhere else. This browser stays signed in.',
    currentPassword: 'Current password',
    newPassword: 'New password',
    confirmNewPassword: 'Confirm new password',
    changing: 'Changing...',
    photoUpdated: 'Photo updated.',
    photoRemoved: 'Photo removed.',
    photoUploadFailed: 'Could not upload that image.',
    photoRemoveFailed: 'Could not remove the photo.'
  },
  uploads: {
    imageTooLarge: (limit: string) => `That image is larger than ${limit}. Please pick a smaller one.`,
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
      permissions: 'Permissions',
      groups: 'Groups',
      activity: 'Activity',
      security: 'Security',
      settings: 'Settings'
    },
    permissions: {
      title: 'Roles & permissions',
      subtitle:
        'Every member starts with what their role allows. Give one person extra access, or take some away, without changing anybody else.',
      action: 'Permissions',
      modalTitle: (name: string) => `Permissions for ${name}`,
      roleBaseline: (role: string) => `Role baseline: ${role}`,
      roleBaselineHint:
        'Leave a permission on "Role default" and it follows the role. Change the role later and the member moves with it.',
      inherit: 'Role default',
      allow: 'Allow',
      deny: 'Block',
      allowedByRole: 'Allowed by role',
      blockedByRole: 'Not in role',
      effectiveAllowed: 'Allowed',
      effectiveBlocked: 'Blocked',
      overrideCount: (added: number, removed: number) =>
        `${added} added · ${removed} blocked`,
      noOverrides: 'No personal exceptions — this member follows their role exactly.',
      summary: (allowed: number, total: number) => `${allowed} of ${total} permissions allowed`,
      presetReadOnly: 'Read only',
      presetReadOnlyHint: 'Blocks every action that writes, keeps everything the role can view.',
      presetReset: 'Follow the role',
      presetResetHint: 'Clears every personal exception.',
      saved: (name: string) => `Permissions updated for ${name}.`,
      cannotChangeSelf: 'You cannot change your own permissions.',
      invalidPayload: 'Permissions must be sent as a list of codes and effects.',
      unknownPermission: (code: string) => `Unknown permission: ${code}.`,
      unknownEffect: (effect: string) => `Effect must be ALLOW or DENY, not ${effect}.`,
      searchPlaceholder: 'Filter permissions',
      customBadge: 'Custom',
      categories: {
        USERS: 'Users',
        GROUPS: 'Groups',
        MEMBERSHIPS: 'Members',
        MEALS: 'Meals',
        EXPENSES: 'Bazar',
        BILLS: 'Bills',
        PAYMENTS: 'Payments',
        COMMENTS: 'Comments',
        SETTINGS: 'Settings',
        REPORTS: 'Reports'
      }
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
      passwordChanged: (name: string) => `Password updated for ${name}.`,
      deletePermanently: 'Delete',
      deleteConfirmTitle: (name: string) => `Permanently delete ${name}?`,
      deleteConfirmBody:
        'This wipes the account and everything it owns in every mess: meals, meal plans, expense shares, payments, comments, invitations and notifications. Expenses they paid for stay, with the payer left blank. This cannot be undone.',
      deleted: (name: string) => `${name} deleted permanently.`,
      cannotDeleteSelf: 'You cannot delete your own account.',
      supervisesGroups: (names: string[]) =>
        `This user supervises ${names.join(', ')}. Hand those groups to another supervisor or delete them first.`
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
      added: (name: string) => `${name} added to the group.`,
      deletePermanently: 'Delete',
      deleteConfirmTitle: (name: string) => `Permanently delete ${name}?`,
      deleteConfirmBody:
        'This wipes the mess and everything in it: meals, bazar, bills, payments, comments, closings and memberships. Member accounts stay. This cannot be undone.',
      deleted: (name: string) => `${name} deleted permanently.`,
      deleteMemberAccount: 'Delete account'
    },
    activity: {
      title: 'Who is using the app',
      subtitle: (timeZone: string) =>
        `Every visit by a signed-in member, counted in ${timeZone}. A visit ends after 30 minutes without activity.`,
      period: 'Period',
      searchPlaceholder: 'Search name or email',
      rankBy: 'Rank by',
      ranges: {
        week: 'Last 7 days',
        month: 'Last 30 days',
        quarter: 'Last 90 days',
        all: 'All time'
      },
      sorts: {
        visits: 'Most visits',
        time: 'Most time on site',
        recent: 'Most recently seen'
      },
      stats: {
        visits: 'Visits',
        visitors: 'People who visited',
        totalTime: 'Total time on site',
        averageVisit: 'Average visit',
        onlineNow: 'Online now',
        visitsToday: 'Visits today',
        neverVisited: 'Never visited',
        rankedMembers: 'Ranked members',
        rankedOf: (count: number, cap: number) => `${count} of ${cap}+`
      },
      timeOfDay: { title: 'What time people come', subtitle: 'When a visit started, by local time of day.' },
      hourByHour: 'Hour by hour',
      hourTooltip: (hour: string, visits: number) => `${hour} — ${visits} visits`,
      weekdays: { title: 'Which days', subtitle: 'Visits by day of the week.' },
      trend: { title: 'Day by day', subtitle: 'Visits and how many different people made them.' },
      trendTooltip: (day: string, visits: number, visitors: number) =>
        `${day} — ${visits} visits from ${visitors} people`,
      devices: {
        title: 'Devices',
        empty: 'Nothing recorded yet.',
        openHint: (device: string) => `See who visited on ${device.toLowerCase()}`,
        modalTitle: (device: string) => `${device} visitors`,
        modalSubtitle: (visits: number, people: number, period: string) =>
          `${visits} visit${visits === 1 ? '' : 's'} from ${people} ${people === 1 ? 'person' : 'people'} · ${period}`,
        emptyTitle: 'Nobody used this device',
        emptyBody: 'No visit in this period came from that kind of device.',
        onlyDevice: 'Only device',
        alsoUses: (others: string) => `Also uses ${others}`,
        share: (percent: number) => `${percent}% of their visits`,
        unknownDevice: (allowed: string) => `Device must be one of: ${allowed}.`
      },
      leaderboard: {
        title: 'Top members',
        subtitle: (cap: number, truncated: boolean) =>
          `Ranked 1 to ${cap}${truncated ? ' — more members fell outside the top ' + cap : ''}.`,
        emptyTitle: 'Nobody has visited in this period',
        emptyBody: 'Try a longer period.'
      },
      columns: {
        rank: '#',
        member: 'Member',
        role: 'Role',
        visits: 'Visits',
        timeOnSite: 'Time on site',
        averageVisit: 'Average visit',
        lastSeen: 'Last seen',
        arrived: 'Arrived',
        stayed: 'Stayed',
        partOfDay: 'Part of day',
        device: 'Device',
        ended: 'Ended',
        firstSeen: 'First seen'
      },
      visitsAction: 'Visits',
      memberVisitsTitle: (name: string) => `${name} — visits`,
      memberVisitsSubtitle: (visits: number, time: string, firstSeen: string) =>
        `${visits} visits in the selected period · ${time} on site · first seen ${firstSeen}`,
      noVisitsTitle: 'No visits recorded',
      noVisitsBody: 'This account has not been seen since visit tracking started.',
      cardSummary: (visits: number, time: string, last: string) => `${visits} visits · ${time} on site · last ${last}`,
      online: 'online',
      stillOpen: 'Still open',
      signedOut: 'Signed out',
      wentIdle: 'Went idle',
      emptyTitle: 'No activity yet',
      emptyBody: 'Nothing has been recorded so far.',
      deletedAccount: 'Deleted account',
      justNow: 'just now',
      minutesAgo: (value: number) => `${value}m ago`,
      hoursAgo: (value: number) => `${value}h ago`,
      daysAgo: (value: number) => `${value}d ago`
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
      onlyAdmin: 'Only admins can change site settings.',
      uploadsTitle: 'Profile photos',
      uploadsHint:
        'The largest profile photo a member may upload. Bigger photos mean slower uploads on a phone connection.',
      maxProfileImage: 'Maximum photo size (KB)',
      maxProfileImageHint: (current: string, min: string, max: string) =>
        `Currently ${current}. Allowed between ${min} and ${max}.`,
      maxProfileImageInvalid: (min: string, max: string) => `Photo size must be between ${min} and ${max}.`,
      notificationsTitle: 'Notifications',
      notificationsHint:
        'Which events raise a bell notification and its email. Sign-in, registration and password emails are never affected by these — members can always get into their account.',
      notificationsMaster: 'Send notifications',
      notificationsMasterOff:
        'All notifications are switched off. Nothing below is sent until you turn this back on.',
      notificationsPerEvent: 'Events',
      notificationsAllOn: 'Turn all on',
      notificationsAllOff: 'Turn all off',
      notificationsCount: (on: number, total: number) => `${on} of ${total} events on`,
      notificationLabels: {
        MENTION_COMMENT: 'Someone is mentioned in a mess comment',
        MENTION_REPLY: 'Someone is mentioned in a reply',
        MENTION_EXPENSE_COMMENT: 'Someone is mentioned on a bazar entry',
        MENTION_COMMUNITY: 'Someone is mentioned in the community room',
        MEAL_CHANGED_BY_SUPERVISOR: 'A supervisor changes a member’s meals',
        MEAL_CHANGE_REQUESTED: 'A member asks to change a past meal',
        MEAL_CHANGE_APPROVED: 'A past-meal change is approved',
        MEAL_CHANGE_REJECTED: 'A past-meal change is rejected',
        MEAL_PROMPT: 'The daily "are you eating tomorrow?" prompt',
        MONTH_CLOSED: 'A month is closed',
        MONTH_REOPENED: 'A closed month is reopened',
        SUPERVISOR_CHANGED: 'Supervision is handed over or shared',
        COMMUNITY_ANNOUNCEMENT: 'An admin posts a community announcement',
        COMMUNITY_WELCOME: 'A new member is welcomed to the community room'
      } as Record<string, string>
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
      groups: 'Your mess',
      signedInAs: (name: string) => `You are signed in as ${name}.`,
      note: 'Free to use. Register with your email and set a password from the link we send you.',
      gatedTitle: 'That page is inside a mess',
      gatedBody:
        'The link you followed belongs to a private mess, so it needs a sign-in. Sign in and we will take you straight there.',
      gatedAction: 'Sign in and continue',
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
      subtitle: 'These are the screens you will spend your month in.',
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
      },
      community: {
        tag: 'Community',
        title: 'One room every mess shares',
        body: 'Announcements, questions and welcomes for new faces, in a single feed across every mess on the app. Anyone can read it without an account — sign in only when you want to post.'
      }
    },
    install: {
      heading: 'Add it to your home screen',
      action: (appName: string) => `Install ${appName}`,
      body: 'Opens full-screen, just like a normal app.',
      button: 'Install',
      step1: 'Tap the Share button',
      step2: 'Choose Add to Home Screen',
      step3: 'Tap Add — done'
    },
    explainer: {
      eyebrow: 'New here?',
      title: 'Watch how it works',
      subtitle: 'A guided, narrated walkthrough — read aloud in your browser, captioned the whole way through.',
      play: 'Play the walkthrough',
      pause: 'Pause',
      resume: 'Resume',
      restart: 'Watch again',
      mute: 'Mute narration',
      unmute: 'Turn narration on',
      previous: 'Previous',
      next: 'Next',
      sceneOf: (current: number, total: number) => `Scene ${current} of ${total}`,
      noSpeechNote: "Your browser can't read this aloud, so captions are shown on their own instead.",
      scenes: [
        {
          title: 'Welcome',
          script: (appName: string) =>
            `Hi, I'm Rakib, and this is Tanvir. If you share a mess, a hostel, or a flat, you already know the arguments: who ate how many meals this month, who bought the groceries on the ninth, and whether last month's electricity bill was ever actually settled. ${appName} ends all of that. One app, one shared record, and the maths is done the same way for everybody, automatically, down to the last paisa. Over the next few minutes, we'll walk you through exactly how it works, from creating your account all the way to settling up at the end of the month. Let's get started.`
        },
        {
          title: 'Creating your account',
          script: () =>
            "First things first: registering. Head to the Register page and enter your name, email and phone number, that's it, no long forms. We'll email you a link to choose your password. Depending on how your admin has set things up, your account is either ready to use straight away, or it waits briefly for an admin to approve it, just to keep the app free of spam accounts. Once you're in, you'll land on your Dashboard, though it'll look pretty empty until you join a mess, which is exactly what we cover next."
        },
        {
          title: 'Joining a mess, or running your own',
          script: () =>
            "Now you need a mess to join. Usually, a supervisor, the person running the house, invites you by email, and the invitation shows up in your notification bell. Accept it, and you're a member from that moment. Want to run your own mess instead of joining someone else's? Open Your role on your Profile page, request supervisor access, and once it's granted, create your own group in a few taps. As supervisor, you'll invite your housemates, record bills, and decide how the meal rate is worked out, everything a member can do, plus running the house."
        },
        {
          title: 'Logging your meals',
          script: () =>
            "Every day, each member logs their own meals on the Meals page: breakfast, lunch and dinner, with one tap each. Today and any upcoming day are always open to edit; once a day passes, it locks, so history can't quietly change. If you eat roughly the same way every week, set a meal plan once, say, lunch and dinner on weekdays, and the app fills your days in for you automatically. Forgot to log a day? A short window lets you unlock and fix past meals, with your supervisor approving the change."
        },
        {
          title: 'Recording the bazar',
          script: () =>
            "Whoever goes to the market records the shopping on the Bazar page: the items, what each one cost, and who paid for it. That part really matters, whoever paid is credited immediately, so at settlement time the mess simply pays them back instead of arguing over old receipts. Anyone in the mess can comment on an entry to ask about a price or add context, and mention a housemate directly with an at symbol. Every edit is kept in a visible history too, so a changed amount is never a quiet mystery a month later."
        },
        {
          title: 'Adding a bill',
          script: () =>
            "Rent, electricity, water, wifi, the cook's salary, anything that isn't day-to-day food goes on the Bills page. A supervisor records each one and chooses how it's split: evenly across everyone currently in the mess, or assigned to specific people, which is perfect for a shared room paying a bit more rent than a single. However a bill is split, that split is saved permanently with the bill, so somebody joining halfway through the month never reopens an argument that was already settled."
        },
        {
          title: 'Your dashboard',
          script: () =>
            "Sign in, and your Dashboard becomes your home base. As a member, it leads with today's meal rate, your meals so far, and exactly what you owe, big enough to read at a glance on your phone. Right below that, there's a whole-mess total of today's meals, so whoever's cooking always knows exactly how many plates to prepare, without opening the meals page and adding it up by hand. Supervisors see a different view entirely: every mess they run, its spend so far, and who still owes money."
        },
        {
          title: 'Payments and settling up',
          script: () =>
            "And finally, Payments, the page where the month adds up. Every member gets one row that reads like a sentence: this is what you owe, this is what you've already put in, this is what's left. A negative number means the mess actually owes that person money back. When everyone's settled, the supervisor closes the month, freezing every figure so an old bill can never be quietly rewritten later, and anything still unpaid simply carries forward as next month's opening balance."
        },
        {
          title: "That's Bachelor Point",
          script: (appName: string) =>
            `That's the whole month, start to finish, meals, bazar, bills and payments, all working out the same way, every single time. There's also a Community room where every mess on the app shares news and questions, and a full written Guide if you ever want the details in black and white. We're Rakib and Tanvir, and on behalf of every mess that's tired of doing this maths by hand, welcome to ${appName}. Ready to stop arguing about the electricity bill? Create your account below and invite your housemates today.`
        }
      ]
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
    roleGuide: {
      title: 'What you will actually be doing',
      subtitle:
        'Every mess has one supervisor and everyone else is a member. Pick the hat you will wear and see the job in full.',
      dailyLabel: 'Your day to day',
      limitLabel: 'What you cannot do',
      items: [
        {
          role: 'MEMBER',
          tagline: 'You eat, you log it, you pay your share. That is the whole job.',
          minutes: 'About 10 seconds a day',
          does: [
            'Tick the meals you ate — or set a meal plan once and let it fill your week in for you.',
            'Answer the daily "are you eating tomorrow?" message with one tap from your phone. No sign-in needed.',
            'Record the bazar when it is your turn to shop. What you spend is credited against what you owe, straight away.',
            'Watch your due update live as the month goes on. No waiting until the 30th to find out.',
            'Ask a question in mess comments and pull someone in with @.'
          ],
          cannot:
            'You cannot record bills, take payments, or close a month — those belong to your supervisor. Editing a day that has already passed sends a request for them to approve.'
        },
        {
          role: 'SUPERVISOR',
          tagline: 'You run the mess. The app does the arithmetic and the chasing.',
          minutes: 'A few minutes a week',
          does: [
            'Create the mess and invite members by email. People can join, leave and rejoin — the history is kept.',
            'Record rent, electricity, water, Wi-Fi and the cook. Split them evenly or name exact amounts per person.',
            'Choose how the meal rate is worked out and what a breakfast is worth against a dinner.',
            'Mark cash as it comes in. Everyone sees their balance move the moment you do.',
            'Approve or decline a member’s past-meal change, and log meals for anyone who forgot.',
            'Close the month. Anything unpaid carries forward into the next one instead of quietly vanishing.'
          ],
          cannot:
            'You cannot see another mess, approve new sign-ups to the site, or change anyone’s account role. That is the admin’s job.'
        },
        {
          role: 'ADMIN',
          tagline: 'You look after the site, not the cooking.',
          minutes: 'Only when something needs a decision',
          does: [
            'Approve new registrations before anyone can sign in.',
            'Grant or withdraw supervisor access when someone asks for it.',
            'Set how long a past-meal unlock stays open before it re-locks itself.',
            'Watch failed sign-ins and released lock-outs.',
            'Look after site-wide settings and keep an eye on every mess.'
          ],
          cannot:
            'Nothing is off limits, but the day-to-day of a mess is deliberately left to the people living in it.'
        }
      ]
    },
    faq: {
      title: 'The questions everyone asks first',
      subtitle: 'The short answers. The guide has the long ones.',
      more: 'Read the full guide',
      illustrationLabel:
        'Three housemates sharing a pot of food at a table, beside a phone showing the meal sheet and a settled receipt',
      items: [
        {
          question: 'Does it cost anything?',
          answer:
            'No. Register with your email, set a password from the link we send you, and start using it. There is no paid tier and no card to enter.'
        },
        {
          question: 'I was away for two weeks. Am I still charged for food?',
          answer:
            'No. You only pay for meals you actually logged. Bills like rent and Wi-Fi are a separate matter — those are usually split across everyone, because the flat is still yours while you are away.'
        },
        {
          question: 'I bought the groceries. Do I get that money back?',
          answer:
            'It is credited against what you owe the moment it is recorded. Spend more than your share and your due goes negative, which shows as a refund the mess owes you.'
        },
        {
          question: 'Can the supervisor change my meals without telling me?',
          answer:
            'No. Any change to a day that has already passed notifies every member of the mess, in the app and by email, naming the day and exactly what changed.'
        },
        {
          question: 'Do I need to install anything?',
          answer:
            'No. It runs in the browser on any phone or laptop. If you want it to feel like a real app, you can add it to your home screen in two taps and it opens without the address bar.'
        },
        {
          question: 'Who can see my mess’s numbers?',
          answer:
            'Only the people in it. Meals, bazar, bills and balances are visible to that mess and nobody else — not other messes, and not other users of the site.'
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
    newsletterFrom: (app: string) => `Get updates from ${app}.`,
    subscribe: 'Subscribe',
    subscribing: 'Subscribing...',
    unsubscribe: 'Unsubscribe',
    unsubscribing: 'Unsubscribing...',
    subscribed: 'Thanks for subscribing.',
    unsubscribed: 'You have been unsubscribed.',
    alreadySubscribed: 'That email is already subscribed.',
    subscribedAs: (email: string) => `Subscribed as ${email}.`,
    willUseAccountEmail: (email: string) => `We will use ${email}, the address on your account.`,
    emailLabel: 'Email for newsletter',
    emailRequired: 'A valid email address is required.',
    emailPlaceholder: 'you@example.com',
    subscribeFailed: 'Could not update your subscription.',
    unsubscribeSignedInOnly: 'Sign in to manage your subscription.',
    builtBy: (author: string) => `Built by ${author}`,
    builtByLabel: 'Built by',
    rights: 'All rights reserved.',
    licensed: (license: string) => `Released under the ${license} License.`
  },
  units: {
    days: (count: number) => `${count} day${count === 1 ? '' : 's'}`,
    months: (count: number) => `${count} month${count === 1 ? '' : 's'}`,
    years: (count: number) => `${count} year${count === 1 ? '' : 's'}`,
    yearsMonths: (years: number, months: number) => `${years}y ${months}m`,
    zeroMinutes: '0m',
    underAMinute: '<1m',
    minutesShort: (minutes: number) => `${minutes}m`,
    hoursShort: (hours: number) => `${hours}h`,
    hoursMinutesShort: (hours: number, minutes: number) => `${hours}h ${minutes}m`
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
  devices: {
    MOBILE: 'Mobile',
    TABLET: 'Tablet',
    DESKTOP: 'Desktop'
  },
  timeBuckets: {
    MORNING: 'Morning',
    MIDDAY: 'Midday',
    AFTERNOON: 'Afternoon',
    EVENING: 'Evening',
    NIGHT: 'Night'
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
