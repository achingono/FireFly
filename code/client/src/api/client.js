import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

const createClient = ({
  appId,
  token,
  functionsVersion,
  serverUrl,
  requiresAuth,
  appBaseUrl
}) => {
  return {
    appId,
    token,
    functionsVersion,
    serverUrl,
    requiresAuth,
    appBaseUrl
  };
};

//Create a client with authentication required
export const client = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});
