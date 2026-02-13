import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { useUserStore } from '../store/user-store';
import App from '../App';
import theme from '../theme';
import { apiClient } from '../config/api';
import { ApiError } from '{{PACKAGE_SCOPE}}/api-client';

// Mock the apiClient
jest.mock('../config/api', () => ({
  apiClient: {
    getUsers: jest.fn(),
    createUser: jest.fn(),
  },
}));

// Mock useAuth hook to provide auth context for tests
const mockUseAuth = jest.fn();
jest.mock('../auth/use-auth', () => ({
  useAuth: (...args: unknown[]) => mockUseAuth(...args),
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const renderWithChakra = async (component: React.ReactElement) => {
  let result;
  await act(async () => {
    result = render(<ChakraProvider theme={theme}>{component}</ChakraProvider>);
  });
  // Wait for any pending async operations
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return result!;
};

describe('App', () => {
  beforeEach(() => {
    // Reset store before each test
    useUserStore.setState({
      user: null,
      users: [],
      isLoading: false,
      error: null,
    });
    // Reset mocks
    jest.clearAllMocks();
    // Default: not authenticated
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getAccessToken: jest.fn().mockResolvedValue(null),
    });
    // Default mock implementations
    mockApiClient.getUsers.mockResolvedValue([]);
  });

  afterEach(async () => {
    // Wait for any pending state updates to flush
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('should render the app title', async () => {
    await renderWithChakra(<App />);
    expect(screen.getByText('{{PROJECT_NAME_TITLE}}')).toBeInTheDocument();
  });

  it('should render welcome message', async () => {
    await renderWithChakra(<App />);
    expect(screen.getByText('Welcome to the Web Client')).toBeInTheDocument();
  });

  it('should render load demo user button initially', async () => {
    await renderWithChakra(<App />);
    expect(screen.getByText('Load Demo User')).toBeInTheDocument();
  });

  it('should display user info when demo user is loaded', async () => {
    await renderWithChakra(<App />);

    await act(async () => {
      const loadButton = screen.getByText('Load Demo User');
      fireEvent.click(loadButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Current User:')).toBeInTheDocument();
    });
    expect(screen.getByText('demo@example.com')).toBeInTheDocument();
    expect(screen.getByText('Demo User')).toBeInTheDocument();
  });

  it('should clear user when clear button is clicked', async () => {
    await renderWithChakra(<App />);

    // Load user
    await act(async () => {
      const loadButton = screen.getByText('Load Demo User');
      fireEvent.click(loadButton);
    });

    // Verify user is loaded
    await waitFor(() => {
      expect(screen.getByText('Current User:')).toBeInTheDocument();
    });

    // Clear user
    await act(async () => {
      const clearButton = screen.getByText('Clear User');
      fireEvent.click(clearButton);
    });

    // Should show load button again (user is null, but users array still has data)
    // So we check that "Current User:" is not visible anymore
    await waitFor(() => {
      expect(screen.queryByText('Current User:')).not.toBeInTheDocument();
    });
  });

  it('should list all features', async () => {
    await renderWithChakra(<App />);

    expect(screen.getByText(/React 18 with TypeScript/)).toBeInTheDocument();
    expect(screen.getByText(/Vite for fast development/)).toBeInTheDocument();
    expect(screen.getByText(/Chakra UI component library/)).toBeInTheDocument();
    expect(screen.getByText(/Zustand for state management/)).toBeInTheDocument();
    expect(screen.getByText(/Jest for testing/)).toBeInTheDocument();
  });

  it('should handle API error when fetching users', async () => {
    const apiError = new ApiError('Network error', 500, 'SERVER_ERROR');
    mockApiClient.getUsers.mockRejectedValue(apiError);

    await renderWithChakra(<App />);

    // Click fetch users button to trigger error
    await act(async () => {
      const fetchButton = screen.getByText('Fetch Users from API');
      fireEvent.click(fetchButton);
    });

    // Wait for error toast to appear (the App shows toast on error)
    await waitFor(() => {
      expect(mockApiClient.getUsers).toHaveBeenCalled();
    });
  });

  it('should handle generic error when fetching users', async () => {
    mockApiClient.getUsers.mockRejectedValue(new Error('Generic error'));

    await renderWithChakra(<App />);

    await act(async () => {
      const fetchButton = screen.getByText('Fetch Users from API');
      fireEvent.click(fetchButton);
    });

    await waitFor(() => {
      expect(mockApiClient.getUsers).toHaveBeenCalled();
    });
  });

  it('should create user successfully', async () => {
    const newUser = {
      id: 'new-id',
      email: 'new@example.com',
      name: 'New User',
      createdAt: new Date().toISOString(),
    };
    mockApiClient.createUser.mockResolvedValue(newUser);

    await renderWithChakra(<App />);

    await act(async () => {
      const createButton = screen.getByText('Create Test User');
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(mockApiClient.createUser).toHaveBeenCalled();
    });

    // Verify user was added to store
    expect(useUserStore.getState().users).toContainEqual(newUser);
  });

  it('should handle API error when creating user', async () => {
    const apiError = new ApiError('Validation error', 400, 'VALIDATION_ERROR');
    mockApiClient.createUser.mockRejectedValue(apiError);

    await renderWithChakra(<App />);

    await act(async () => {
      const createButton = screen.getByText('Create Test User');
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(mockApiClient.createUser).toHaveBeenCalled();
    });
  });

  it('should handle generic error when creating user', async () => {
    mockApiClient.createUser.mockRejectedValue(new Error('Generic error'));

    await renderWithChakra(<App />);

    await act(async () => {
      const createButton = screen.getByText('Create Test User');
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(mockApiClient.createUser).toHaveBeenCalled();
    });
  });

  it('should fetch users on mount when authenticated', async () => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      isAuthenticated: true,
      isLoading: false,
      signIn: jest.fn(),
      signOut: jest.fn(),
      getAccessToken: jest.fn().mockResolvedValue('token'),
    });

    const mockUsers = [
      { id: '1', email: 'user1@example.com', name: 'User 1', createdAt: '2024-01-01' },
      { id: '2', email: 'user2@example.com', name: 'User 2', createdAt: '2024-01-02' },
    ];
    mockApiClient.getUsers.mockResolvedValue(mockUsers);

    await renderWithChakra(<App />);

    await waitFor(() => {
      expect(mockApiClient.getUsers).toHaveBeenCalled();
    });

    // Verify users were loaded into store
    await waitFor(() => {
      expect(useUserStore.getState().users).toEqual(mockUsers);
    });
  });

  it('should not fetch users on mount when not authenticated', async () => {
    await renderWithChakra(<App />);

    expect(mockApiClient.getUsers).not.toHaveBeenCalled();
  });

  it('should display error message when error state is set', async () => {
    // Set error state before rendering
    useUserStore.setState({
      user: null,
      users: [],
      isLoading: false,
      error: 'Test error message',
    });

    await renderWithChakra(<App />);

    expect(screen.getByText(/Error: Test error message/)).toBeInTheDocument();
  });
});
