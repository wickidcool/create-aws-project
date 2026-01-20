import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useEffect } from "react";
import { useUserStore } from "./store/user-store";
import type { User } from "{{PACKAGE_SCOPE}}/common-types";
import { apiClient } from "./config/api";
import { ApiError } from "{{PACKAGE_SCOPE}}/api-client";

export default function App() {
  const {
    user,
    users,
    setUser,
    addUser,
    setUsers,
    isLoading,
    error,
    setLoading,
    setError,
    clearError,
  } = useUserStore();

  // Fetch users on mount
  useEffect(() => {
    handleFetchUsers();
  }, []);

  const handleLoadDemoUser = () => {
    const demoUser: User = {
      id: crypto.randomUUID(),
      email: "demo@example.com",
      name: "Demo User",
      createdAt: new Date().toISOString(),
    };
    setUser(demoUser);
    addUser(demoUser);
    Alert.alert("User loaded", "Demo user has been loaded successfully");
  };

  const handleClearUser = () => {
    setUser(null);
    Alert.alert("User cleared", "Current user has been cleared");
  };

  const handleFetchUsers = async () => {
    setLoading(true);
    clearError();
    try {
      const fetchedUsers = await apiClient.getUsers();
      setUsers(fetchedUsers);
      Alert.alert(
        "Users fetched",
        `Loaded ${fetchedUsers.length} users from API`
      );
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to fetch users";
      setError(message);
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    setLoading(true);
    clearError();
    try {
      const newUser = await apiClient.createUser({
        email: `user${Date.now()}@example.com`,
        name: `User ${Date.now()}`,
      });
      addUser(newUser);
      Alert.alert("User created", `Created ${newUser.name}`);
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to create user";
      setError(message);
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{{PROJECT_NAME_TITLE}}</Text>
        <Text style={styles.subtitle}>
          Nx Monorepo with React, AWS Lambda, and Shared Types
        </Text>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Welcome Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome to Mobile Client</Text>
          <Text style={styles.cardText}>
            This is a React Native application built with Expo and TypeScript,
            managed by Nx in a monorepo structure.
          </Text>
        </View>

        {/* Features Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Features:</Text>
          <View style={styles.featureList}>
            <Text style={styles.featureItem}>- React Native with Expo</Text>
            <Text style={styles.featureItem}>- TypeScript Support</Text>
            <Text style={styles.featureItem}>
              - Cross-platform (iOS & Android)
            </Text>
            <Text style={styles.featureItem}>
              - Zustand for state management
            </Text>
            <Text style={styles.featureItem}>- Jest for testing</Text>
            <Text style={styles.featureItem}>
              - Shared types from common-types library
            </Text>
            <Text style={styles.featureItem}>- Nx for monorepo management</Text>
            <Text style={styles.featureItem}>
              - Type-safe API client with Axios
            </Text>
            <Text style={styles.featureItem}>
              - AWS CDK infrastructure deployment
            </Text>
          </View>
        </View>

        {/* API Actions Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>API Actions:</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary]}
              onPress={handleFetchUsers}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Fetch Users</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.buttonSuccess]}
              onPress={handleCreateUser}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Test User</Text>
              )}
            </TouchableOpacity>
          </View>
          {error && <Text style={styles.errorText}>Error: {error}</Text>}
        </View>

        {/* Current User Card */}
        {user ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Current User:</Text>
            <View style={styles.userInfo}>
              <View style={styles.userInfoRow}>
                <Text style={styles.userInfoLabel}>ID:</Text>
                <Text style={styles.userInfoValue}>{user.id}</Text>
              </View>
              <View style={styles.userInfoRow}>
                <Text style={styles.userInfoLabel}>Email:</Text>
                <Text style={styles.userInfoValue}>{user.email}</Text>
              </View>
              <View style={styles.userInfoRow}>
                <Text style={styles.userInfoLabel}>Name:</Text>
                <Text style={styles.userInfoValue}>{user.name}</Text>
              </View>
              <View style={styles.userInfoRow}>
                <Text style={styles.userInfoLabel}>Created:</Text>
                <Text style={styles.userInfoValue}>
                  {new Date(user.createdAt).toLocaleString()}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.button, styles.buttonDanger]}
              onPress={handleClearUser}
            >
              <Text style={styles.buttonText}>Clear User</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.buttonPrimary]}
            onPress={handleLoadDemoUser}
          >
            <Text style={styles.buttonText}>Load Demo User</Text>
          </TouchableOpacity>
        )}

        {/* Users Count */}
        {users.length > 0 && (
          <View style={styles.statsCard}>
            <Text style={styles.statsText}>
              Total users in store: {users.length}
            </Text>
          </View>
        )}

        {/* Footer Spacer */}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Built with React Native, TypeScript, Expo, and Zustand
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  header: {
    backgroundColor: "#3B82F6",
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#e0e7ff",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  cardText: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
  },
  featureList: {
    gap: 8,
  },
  featureItem: {
    fontSize: 14,
    color: "#94a3b8",
    lineHeight: 20,
  },
  buttonGroup: {
    gap: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  buttonPrimary: {
    backgroundColor: "#8b5cf6",
  },
  buttonSuccess: {
    backgroundColor: "#10b981",
  },
  buttonDanger: {
    backgroundColor: "#ef4444",
    marginTop: 12,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorText: {
    color: "#f87171",
    fontSize: 14,
    marginTop: 8,
  },
  userInfo: {
    gap: 12,
    marginBottom: 12,
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  userInfoLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94a3b8",
    width: 80,
  },
  userInfoValue: {
    fontSize: 14,
    color: "#e2e8f0",
    flex: 1,
  },
  statsCard: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  statsText: {
    color: "#94a3b8",
    fontSize: 14,
  },
  footer: {
    backgroundColor: "#1e293b",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: "#374151",
  },
  footerText: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 12,
  },
});
