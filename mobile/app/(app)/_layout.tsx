import { Tabs } from 'expo-router';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAuth } from '../../lib/auth-context';
import { HEBREW } from '../../constants/hebrew';

export default function AppLayout() {
  const { signOut } = useAuth();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#16a34a',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          paddingBottom: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#ffffff',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
        },
        headerTitleStyle: {
          fontSize: 17,
          fontWeight: '600',
          color: '#111827',
        },
        headerRight: () => (
          <TouchableOpacity
            onPress={signOut}
            style={styles.logoutButton}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>{HEBREW.logout}</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="monitoring"
        options={{
          title: HEBREW.monitoring,
          tabBarLabel: HEBREW.monitoring,
        }}
      />
      <Tabs.Screen
        name="actions"
        options={{
          title: HEBREW.actions,
          tabBarLabel: HEBREW.actions,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  logoutButton: {
    marginEnd: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  logoutText: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '500',
  },
});
