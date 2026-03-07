import React, { useState, useCallback } from 'react';
import { View } from 'react-native';
import { createBottomTabNavigator, BottomTabBarProps, BottomTabBar } from '@react-navigation/bottom-tabs';
import { LayoutDashboard, CheckSquare, Bot, Calendar, Settings } from 'lucide-react-native';

import { DashboardScreen } from '../screens/DashboardScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AiInputBar } from '../components/AiInputBar';
import { colors } from '../theme/colors';

const Tab = createBottomTabNavigator();

export const TabNavigator = () => {
  const [aiVisible, setAiVisible] = useState(false);

  const toggleAi = useCallback(() => {
    setAiVisible((prev) => !prev);
  }, []);

  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => (
      <View>
        <AiInputBar visible={aiVisible} />
        <BottomTabBar {...props} />
      </View>
    ),
    [aiVisible],
  );

  return (
    <Tab.Navigator
      tabBar={renderTabBar}
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
      <Tab.Screen
        name="AI"
        component={View}
        options={{
          tabBarIcon: ({ color, size }) => <Bot color={color} size={size} />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            toggleAi();
          },
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
  );
};
