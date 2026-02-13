import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
  HStack,
  Button,
  Card,
  CardHeader,
  CardBody,
  List,
  ListItem,
  ListIcon,
  Badge,
  useToast,
  Spinner,
} from '@chakra-ui/react';
import { CheckCircleIcon } from '@chakra-ui/icons';
import { useUserStore } from './store/user-store';
import type { User } from '{{PACKAGE_SCOPE}}/common-types';
import { apiClient } from './config/api';
import { ApiError } from '{{PACKAGE_SCOPE}}/api-client';
import { useEffect } from 'react';
// {{#if AUTH_COGNITO}}
import { useAuth } from './auth';
// {{/if AUTH_COGNITO}}
// {{#if AUTH_AUTH0}}
import { useAuth } from './auth';
// {{/if AUTH_AUTH0}}

function App() {
  const { user, users, setUser, addUser, setUsers, isLoading, error } = useUserStore();
  const toast = useToast();
  // {{#if AUTH_COGNITO}}
  const { user: authUser, isAuthenticated, isLoading: authLoading, signIn, signOut } = useAuth();
  // {{/if AUTH_COGNITO}}
  // {{#if AUTH_AUTH0}}
  const { user: authUser, isAuthenticated, isLoading: authLoading, signIn, signOut } = useAuth();
  // {{/if AUTH_AUTH0}}

  // Fetch users on mount
  useEffect(() => {
    if (isAuthenticated) {
      handleFetchUsers();
    }
  }, [isAuthenticated]);

  const handleLoadDemoUser = () => {
    const demoUser: User = {
      id: crypto.randomUUID(),
      email: 'demo@example.com',
      name: 'Demo User',
      createdAt: new Date().toISOString(),
    };
    setUser(demoUser);
    addUser(demoUser);
    toast({
      title: 'User loaded',
      description: 'Demo user has been loaded successfully',
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleClearUser = () => {
    setUser(null);
    toast({
      title: 'User cleared',
      description: 'Current user has been cleared',
      status: 'info',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleFetchUsers = async () => {
    try {
      const fetchedUsers = await apiClient.getUsers();
      setUsers(fetchedUsers);
      toast({
        title: 'Users fetched',
        description: `Loaded ${fetchedUsers.length} users from API`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch users';
      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleCreateUser = async () => {
    try {
      const newUser = await apiClient.createUser({
        email: `user${Date.now()}@example.com`,
        name: `User ${Date.now()}`,
      });
      addUser(newUser);
      toast({
        title: 'User created',
        description: `Created ${newUser.name}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to create user';
      toast({
        title: 'Error',
        description: message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <Box minH="100vh" display="flex" flexDirection="column">
      {/* Header */}
      <Box
        bgGradient="linear(to-r, brand.500, purple.500)"
        py={8}
        boxShadow="lg"
        position="relative"
      >
        {/* {{#if AUTH_COGNITO}} */}
        <HStack position="absolute" top={4} right={4}>
          {authLoading ? (
            <Spinner size="sm" />
          ) : isAuthenticated && authUser ? (
            <HStack>
              <Badge colorScheme="green">{authUser.email}</Badge>
              <Button size="sm" colorScheme="red" variant="outline" onClick={() => signOut()}>
                Sign Out
              </Button>
            </HStack>
          ) : (
            <Button size="sm" colorScheme="brand" onClick={() => signIn('', '')}>
              Sign In
            </Button>
          )}
        </HStack>
        {/* {{/if AUTH_COGNITO}} */}
        {/* {{#if AUTH_AUTH0}} */}
        <HStack position="absolute" top={4} right={4}>
          {authLoading ? (
            <Spinner size="sm" />
          ) : isAuthenticated && authUser ? (
            <HStack>
              <Badge colorScheme="green">{authUser.email}</Badge>
              <Button size="sm" colorScheme="red" variant="outline" onClick={() => signOut()}>
                Sign Out
              </Button>
            </HStack>
          ) : (
            <Button size="sm" colorScheme="brand" onClick={() => signIn('', '')}>
              Sign In
            </Button>
          )}
        </HStack>
        {/* {{/if AUTH_AUTH0}} */}
        <Container maxW="container.xl">
          <VStack spacing={2}>
            <Heading size="2xl">{{PROJECT_NAME_TITLE}}</Heading>
            <Text fontSize="lg" opacity={0.9}>
              Nx Monorepo with React, AWS Lambda, and Shared Types
            </Text>
          </VStack>
        </Container>
      </Box>

      {/* Main Content */}
      <Container maxW="container.xl" flex="1" py={8}>
        <Card>
          <CardHeader>
            <Heading size="lg">Welcome to the Web Client</Heading>
          </CardHeader>
          <CardBody>
            <VStack spacing={6} align="stretch">
              <Text color="gray.400">
                This is a React application built with Vite and TypeScript,
                managed by Nx in a monorepo structure.
              </Text>

              {/* Features */}
              <Box
                bg="rgba(59, 130, 246, 0.1)"
                p={6}
                borderRadius="lg"
                borderWidth="1px"
                borderColor="brand.700"
              >
                <Heading size="md" mb={4} color="brand.400">
                  Features:
                </Heading>
                <List spacing={3}>
                  <ListItem>
                    <ListIcon as={CheckCircleIcon} color="green.400" />
                    React 18 with TypeScript
                  </ListItem>
                  <ListItem>
                    <ListIcon as={CheckCircleIcon} color="green.400" />
                    Vite for fast development
                  </ListItem>
                  <ListItem>
                    <ListIcon as={CheckCircleIcon} color="green.400" />
                    Chakra UI component library
                  </ListItem>
                  <ListItem>
                    <ListIcon as={CheckCircleIcon} color="green.400" />
                    Zustand for state management
                  </ListItem>
                  <ListItem>
                    <ListIcon as={CheckCircleIcon} color="green.400" />
                    Jest for testing
                  </ListItem>
                  <ListItem>
                    <ListIcon as={CheckCircleIcon} color="green.400" />
                    Shared types from common-types library
                  </ListItem>
                  <ListItem>
                    <ListIcon as={CheckCircleIcon} color="green.400" />
                    Nx for monorepo management
                  </ListItem>
                  <ListItem>
                    <ListIcon as={CheckCircleIcon} color="green.400" />
                    Type-safe API client with Axios
                  </ListItem>
                  <ListItem>
                    <ListIcon as={CheckCircleIcon} color="green.400" />
                    AWS CDK infrastructure deployment
                  </ListItem>
                </List>
              </Box>

              {/* API Actions */}
              <Box
                bg="rgba(139, 92, 246, 0.1)"
                p={6}
                borderRadius="lg"
                borderWidth="1px"
                borderColor="purple.700"
              >
                <Heading size="md" mb={4} color="purple.400">
                  API Actions:
                </Heading>
                <HStack spacing={4}>
                  <Button
                    colorScheme="purple"
                    onClick={handleFetchUsers}
                    isLoading={isLoading}
                  >
                    Fetch Users from API
                  </Button>
                  <Button
                    colorScheme="green"
                    onClick={handleCreateUser}
                    isLoading={isLoading}
                  >
                    Create Test User
                  </Button>
                </HStack>
                {error && (
                  <Text color="red.400" mt={2} fontSize="sm">
                    Error: {error}
                  </Text>
                )}
              </Box>

              {/* User Info or Load Button */}
              {user ? (
                <Box
                  bg="rgba(16, 185, 129, 0.1)"
                  p={6}
                  borderRadius="lg"
                  borderWidth="1px"
                  borderColor="green.700"
                >
                  <Heading size="md" mb={4} color="green.400">
                    Current User:
                  </Heading>
                  <VStack align="start" spacing={2}>
                    <HStack>
                      <Badge colorScheme="green">ID</Badge>
                      <Text>{user.id}</Text>
                    </HStack>
                    <HStack>
                      <Badge colorScheme="blue">Email</Badge>
                      <Text>{user.email}</Text>
                    </HStack>
                    <HStack>
                      <Badge colorScheme="purple">Name</Badge>
                      <Text>{user.name}</Text>
                    </HStack>
                    <HStack>
                      <Badge colorScheme="orange">Created</Badge>
                      <Text>{new Date(user.createdAt).toLocaleString()}</Text>
                    </HStack>
                  </VStack>
                  <Button
                    mt={4}
                    colorScheme="red"
                    onClick={handleClearUser}
                    size="sm"
                  >
                    Clear User
                  </Button>
                </Box>
              ) : (
                <Button
                  colorScheme="brand"
                  size="lg"
                  onClick={handleLoadDemoUser}
                >
                  Load Demo User
                </Button>
              )}

              {/* Users Count */}
              {users.length > 0 && (
                <Box>
                  <Text color="gray.400">
                    Total users in store: <Badge ml={2}>{users.length}</Badge>
                  </Text>
                </Box>
              )}
            </VStack>
          </CardBody>
        </Card>
      </Container>

      {/* Footer */}
      <Box bg="gray.800" py={6} borderTop="1px" borderColor="gray.700">
        <Container maxW="container.xl">
          <Text textAlign="center" color="gray.400">
            Built with React, TypeScript, Chakra UI, and Zustand
          </Text>
        </Container>
      </Box>
    </Box>
  );
}

export default App;
