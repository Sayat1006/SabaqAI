export const paths = {
  home: '/',
  unt: '/unt',
  test: '/unt/test',
  result: '/unt/result',
  review: '/unt/review',
  pisa: '/pisa',
  modo: '/modo',
  profile: '/profile',
  onboarding: '/onboarding',
} as const;

export type ScreenKey = keyof typeof paths;
