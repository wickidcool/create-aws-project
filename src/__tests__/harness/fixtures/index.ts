export {
  createWebCognitoConfig,
  createWebAuth0Config,
  createMobileCognitoConfig,
  createMobileAuth0Config,
  createApiCognitoConfig,
  createApiAuth0Config,
  createWebMobileCognitoConfig,
  createWebMobileAuth0Config,
  createWebApiCognitoConfig,
  createWebApiAuth0Config,
  createMobileApiCognitoConfig,
  createMobileApiAuth0Config,
  createFullStackCognitoConfig,
  createFullStackAuth0Config,
} from './config-factories.js';

export {
  TEST_MATRIX,
  getConfigsByTier,
  getConfigByName,
  type TestTier,
  type TestConfiguration,
} from './matrix.js';
