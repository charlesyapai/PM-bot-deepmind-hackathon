import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { LayoutDashboard, CheckSquare, Mic, Calendar, Settings } from 'lucide-react-native';

import { DashboardScreen } from '../screens/DashboardScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { VoiceOverlay } from '../components/VoiceOverlay';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

const VoiceFAB = ({ onPress }: { onPress: () => void }) => {
  return (
    <View style={styles.fabContainer}>
      <TouchableOpacity style={styles.fabButton} onPress={onPress}>
        <Mic color="#fff" size={28} />
      </TouchableOpacity>
    </View>
  );
};

export const TabNavigator = () => {
  const [voiceVisible, setVoiceVisible] = useState(false);

  return (
    <>
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          borderTopColor: colors.border,
          backgroundColor: colors.cardBackground,
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          tabBarIcon: ({ color, size }) => <CheckSquare color={color} size={size} />,
        }}
      />

      {/* Invisible screen just for the FAB */}
      <Tab.Screen
        name="Voice"
        component={View}
        options={{
          tabBarButton: () => (
            <VoiceFAB onPress={() => setVoiceVisible(true)} />
          ),
        }}
      />

      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
    <VoiceOverlay visible={voiceVisible} onClose={() => setVoiceVisible(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  fabContainer: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
});
