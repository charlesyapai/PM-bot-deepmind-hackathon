import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { LoginScreen } from '../screens/LoginScreen';
import { ProjectDetailScreen } from '../screens/ProjectDetailScreen';
import { GoogleSettingsScreen } from '../screens/GoogleSettingsScreen';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  ProjectDetail: { projectId: string; projectTitle: string };
  GoogleSettings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const [session, setSession] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    // Check for an existing session on mount
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });

    // Listen for auth state changes (login / logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(!!newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (session === null) {
    // Still determining auth state -- show a spinner
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.backgroundLight }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {session ? (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          <Stack.Screen
            name="ProjectDetail"
            component={ProjectDetailScreen}
            options={{
              headerShown: true,
              headerBackTitle: 'Dashboard',
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.cardBackground },
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="GoogleSettings"
            component={GoogleSettingsScreen}
            options={{
              headerShown: true,
              title: 'Google Account',
              headerBackTitle: 'Settings',
              headerTintColor: colors.primary,
              headerStyle: { backgroundColor: colors.cardBackground },
              headerShadowVisible: false,
            }}
          />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
};
