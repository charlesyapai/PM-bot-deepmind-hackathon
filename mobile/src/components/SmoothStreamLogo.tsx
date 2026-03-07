import React from 'react';
import { View, StyleSheet } from 'react-native';

type SmoothStreamLogoProps = {
  size?: number;
};

export const SmoothStreamLogo = ({ size = 72 }: SmoothStreamLogoProps) => {
  const s = size / 72;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Top stream line */}
      <View
        style={[
          styles.streamLine,
          {
            width: 44 * s,
            height: 5 * s,
            borderRadius: 3 * s,
            top: 16 * s,
            left: 8 * s,
            backgroundColor: '#007AFF',
            transform: [{ rotate: '-8deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.streamLine,
          {
            width: 20 * s,
            height: 5 * s,
            borderRadius: 3 * s,
            top: 18 * s,
            left: 42 * s,
            backgroundColor: '#3AADFF',
            transform: [{ rotate: '12deg' }],
          },
        ]}
      />

      {/* Middle stream line — widest, main flow */}
      <View
        style={[
          styles.streamLine,
          {
            width: 52 * s,
            height: 7 * s,
            borderRadius: 4 * s,
            top: 32 * s,
            left: 6 * s,
            backgroundColor: '#007AFF',
            opacity: 0.85,
            transform: [{ rotate: '4deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.streamLine,
          {
            width: 16 * s,
            height: 7 * s,
            borderRadius: 4 * s,
            top: 30 * s,
            left: 48 * s,
            backgroundColor: '#5AC8FA',
            opacity: 0.85,
            transform: [{ rotate: '-10deg' }],
          },
        ]}
      />

      {/* Bottom stream line — thin accent */}
      <View
        style={[
          styles.streamLine,
          {
            width: 38 * s,
            height: 4 * s,
            borderRadius: 2 * s,
            top: 50 * s,
            left: 14 * s,
            backgroundColor: '#5AC8FA',
            opacity: 0.55,
            transform: [{ rotate: '-6deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.streamLine,
          {
            width: 14 * s,
            height: 4 * s,
            borderRadius: 2 * s,
            top: 51 * s,
            left: 44 * s,
            backgroundColor: '#007AFF',
            opacity: 0.45,
            transform: [{ rotate: '8deg' }],
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  streamLine: {
    position: 'absolute',
  },
});
