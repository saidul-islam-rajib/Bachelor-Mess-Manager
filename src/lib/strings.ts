import { appConfig } from '@/config';
import { strings } from '@/lib/i18n';

export const STRINGS = {
  appName: appConfig.name,
  home: {
    title: appConfig.name,
    description: strings.common.appTagline,
    login: strings.nav.login,
    register: strings.nav.register
  },
  auth: {
    login: {
      title: strings.auth.login.title,
      email: strings.auth.login.email,
      password: strings.auth.login.password,
      submit: strings.auth.login.submit,
      registerLink: strings.auth.login.registerPrompt,
      register: strings.auth.login.registerLink
    },
    register: {
      title: strings.auth.register.title,
      name: strings.auth.register.name,
      email: strings.auth.register.email,
      password: strings.auth.register.password,
      submit: strings.auth.register.submit,
      loginLink: strings.auth.register.loginPrompt,
      login: strings.auth.register.loginLink
    }
  }
};

export { strings };
