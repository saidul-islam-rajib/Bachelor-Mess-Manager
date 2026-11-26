export const en = {
  common: {
    appName: 'Bachelor Point',
    loading: 'Loading…',
    retry: 'Try again',
  },
  auth: {
    title: 'Welcome back',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in…',
    invalid: 'Email or password is wrong.',
    network: 'Cannot reach the server.',
    tooMany: 'Too many attempts. Try again later.',
    required: 'Enter your email and password.',
    server: 'Server: {address}',
    change: 'Change',
    serverLabel: 'Server address',
    checkAndSave: 'Check and save',
    cancel: 'Cancel',
    checking: 'Checking…',
    serverOk: 'Server saved.',
    serverBad: 'That server did not answer.',
    serverInvalid: 'Enter an address starting with http:// or https://',
  },
  home: {
    title: 'Home',
    welcome: 'Hello, {name}',
    signOut: 'Sign out',
  },
};

export const t = (template: string, vars: Record<string, string> = {}) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
