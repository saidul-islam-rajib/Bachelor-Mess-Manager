import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

jest.mock('expo-router', () => {
  const React = require('react');
  const passthrough = ({ children }: { children?: unknown }) => React.createElement(React.Fragment, null, children);
  return {
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({}),
    Redirect: () => null,
    Stack: Object.assign(passthrough, { Screen: () => null }),
    Tabs: Object.assign(passthrough, { Screen: () => null }),
    Link: passthrough,
  };
});

jest.mock('@/core/log', () => ({
  ...jest.requireActual('@/core/log'),
  log: jest.fn(),
  logError: jest.fn(),
}));
