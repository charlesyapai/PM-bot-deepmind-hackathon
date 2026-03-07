import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { typography } from '../theme/typography';
import { colors } from '../theme/colors';

export const MeetingNotesScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={typography.h1}>Meeting Notes</Text>
      <Text style={typography.body}>Archive of meeting recordings.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.backgroundLight,
  },
});
