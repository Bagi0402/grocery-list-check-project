import { Amplify } from 'aws-amplify';

// Values come from app/.env.local (generated from `terraform output`).
const env = import.meta.env;

const REQUIRED = [
  'VITE_AWS_REGION',
  'VITE_USER_POOL_ID',
  'VITE_USER_POOL_CLIENT_ID',
  'VITE_GRAPHQL_URL',
];

export function configureAmplify(): void {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing settings in app/.env.local: ${missing.join(', ')}`);
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: env.VITE_USER_POOL_ID,
        userPoolClientId: env.VITE_USER_POOL_CLIENT_ID,
        loginWith: { email: true },
        signUpVerificationMethod: 'code',
      },
    },
    API: {
      GraphQL: {
        endpoint: env.VITE_GRAPHQL_URL,
        region: env.VITE_AWS_REGION,
        defaultAuthMode: 'userPool',
      },
    },
  });
}
