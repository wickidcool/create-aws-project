import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import type { Answers, PromptObject } from 'prompts';

// Create a mock function for prompts
const mockPrompts = jest.fn<(questions: PromptObject[], options?: { onCancel?: (prompt: PromptObject, answers: Answers<string>) => void }) => Promise<Answers<string>>>();

// Mock prompts module
jest.unstable_mockModule('prompts', () => ({
  __esModule: true,
  default: mockPrompts,
}));

// Mock picocolors to avoid console output issues
jest.unstable_mockModule('picocolors', () => ({
  __esModule: true,
  default: {
    red: (s: string) => s,
    green: (s: string) => s,
    blue: (s: string) => s,
    yellow: (s: string) => s,
    cyan: (s: string) => s,
    magenta: (s: string) => s,
    bold: (s: string) => s,
    dim: (s: string) => s,
  },
}));

// Dynamic import after mocking
const { runWizard } = await import('../wizard.js');

describe('runWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock process.exit to prevent test from exiting
    jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
  });

  describe('successful completion', () => {
    it('should return complete ProjectConfig when all prompts answered', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: 'my-test-app',
        platforms: ['web', 'api'],
        authProvider: 'none',
        authFeatures: [],
        features: ['github-actions'],
        awsRegion: 'us-east-1',
        brandColor: 'blue',
      } as Answers<string>);

      const result = await runWizard();

      expect(result).not.toBeNull();
      expect(result).toEqual({
        projectName: 'my-test-app',
        platforms: ['web', 'api'],
        features: ['github-actions'],
        awsRegion: 'us-east-1',
        brandColor: 'blue',
        auth: { provider: 'none', features: [] },
      });
    });

    it('should return config with all platforms selected', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: 'full-stack-app',
        platforms: ['web', 'mobile', 'api'],
        authProvider: 'none',
        authFeatures: [],
        features: ['github-actions', 'vscode-config'],
        awsRegion: 'eu-west-1',
        brandColor: 'purple',
      } as Answers<string>);

      const result = await runWizard();

      expect(result).not.toBeNull();
      expect(result?.platforms).toEqual(['web', 'mobile', 'api']);
      expect(result?.features).toEqual(['github-actions', 'vscode-config']);
    });

    it('should default features to empty array when none selected', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: 'minimal-app',
        platforms: ['api'],
        authProvider: 'none',
        authFeatures: [],
        features: undefined, // No features selected
        awsRegion: 'ap-southeast-1',
        brandColor: 'teal',
      } as Answers<string>);

      const result = await runWizard();

      expect(result).not.toBeNull();
      expect(result?.features).toEqual([]);
    });
  });

  describe('incomplete responses', () => {
    it('should return null when projectName is missing', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: undefined,
        platforms: ['web'],
        awsRegion: 'us-east-1',
        brandColor: 'blue',
      } as Answers<string>);

      const result = await runWizard();

      expect(result).toBeNull();
    });

    it('should return null when platforms is empty', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: 'my-app',
        platforms: [],
        awsRegion: 'us-east-1',
        brandColor: 'blue',
      } as Answers<string>);

      const result = await runWizard();

      expect(result).toBeNull();
    });

    it('should return null when awsRegion is missing', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: 'my-app',
        platforms: ['web'],
        awsRegion: undefined,
        brandColor: 'blue',
      } as Answers<string>);

      const result = await runWizard();

      expect(result).toBeNull();
    });

    it('should return null when brandColor is missing', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: 'my-app',
        platforms: ['web'],
        awsRegion: 'us-east-1',
        brandColor: undefined,
      } as Answers<string>);

      const result = await runWizard();

      expect(result).toBeNull();
    });
  });

  describe('cancellation', () => {
    it('should exit when user cancels via onCancel', async () => {
      // Simulate prompts calling onCancel by storing the callback and calling it
      let storedOnCancel: ((prompt: PromptObject, _answers: Answers<string>) => void) | undefined;

      mockPrompts.mockImplementationOnce(((_questions: unknown, options: { onCancel?: (prompt: PromptObject, answers: Answers<string>) => void }) => {
        storedOnCancel = options?.onCancel;
        // Trigger onCancel before returning
        if (storedOnCancel) {
          storedOnCancel({} as PromptObject, {} as Answers<string>);
        }
        return Promise.resolve({} as Answers<string>);
      }) as typeof mockPrompts);

      await expect(runWizard()).rejects.toThrow('process.exit called');
      expect(process.exit).toHaveBeenCalledWith(0);
    });
  });

  describe('config structure verification', () => {
    it('should return config with all expected fields', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: 'test-app',
        platforms: ['web'],
        authProvider: 'none',
        authFeatures: [],
        features: [],
        awsRegion: 'us-east-1',
        brandColor: 'green',
      } as Answers<string>);

      const result = await runWizard();

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('projectName');
      expect(result).toHaveProperty('platforms');
      expect(result).toHaveProperty('features');
      expect(result).toHaveProperty('awsRegion');
      expect(result).toHaveProperty('brandColor');
      expect(result).toHaveProperty('auth');
    });

    it('should pass correct prompts to prompts library', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: 'my-app',
        platforms: ['web'],
        authProvider: 'none',
        authFeatures: [],
        features: [],
        awsRegion: 'us-east-1',
        brandColor: 'orange',
      } as Answers<string>);

      await runWizard();

      expect(mockPrompts).toHaveBeenCalledTimes(1);
      const [promptsArg] = mockPrompts.mock.calls[0];

      // Verify 15 prompts are passed (projectName, platforms, authProvider, authFeatures, features, awsRegion,
      // enableOrg, orgName, orgEnvironments, devEmail, stageEmail, prodEmail, qaEmail, sandboxEmail, brandColor)
      expect(Array.isArray(promptsArg)).toBe(true);
      expect((promptsArg as PromptObject[]).length).toBe(15);
    });
  });

  describe('auth configuration', () => {
    it('should return ProjectConfig with Cognito auth and features', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: 'auth-test-app',
        platforms: ['web', 'api'],
        authProvider: 'cognito',
        authFeatures: ['social-login', 'mfa'],
        features: [],
        awsRegion: 'us-east-1',
        brandColor: 'blue',
      } as Answers<string>);

      const result = await runWizard();

      expect(result?.auth).toEqual({
        provider: 'cognito',
        features: ['social-login', 'mfa'],
      });
    });

    it('should return ProjectConfig with Auth0 auth and no features', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: 'auth0-app',
        platforms: ['web'],
        authProvider: 'auth0',
        authFeatures: [],
        features: ['github-actions'],
        awsRegion: 'eu-west-1',
        brandColor: 'purple',
      } as Answers<string>);

      const result = await runWizard();

      expect(result?.auth).toEqual({
        provider: 'auth0',
        features: [],
      });
    });

    it('should default auth to none when not selected', async () => {
      mockPrompts.mockResolvedValueOnce({
        projectName: 'no-auth-app',
        platforms: ['api'],
        authProvider: 'none',
        // authFeatures not returned when provider is 'none'
        features: [],
        awsRegion: 'us-west-2',
        brandColor: 'teal',
      } as Answers<string>);

      const result = await runWizard();

      expect(result?.auth).toEqual({
        provider: 'none',
        features: [],
      });
    });
  });
});
