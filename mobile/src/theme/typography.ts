import { StyleSheet } from 'react-native';

export const typography = StyleSheet.create({
  h1: {
    fontSize: 34,
    fontWeight: 'bold',
    // fontFamily: 'System' // San Francisco is default on iOS
  },
  h2: {
    fontSize: 28,
    fontWeight: '600',
  },
  body: {
    fontSize: 17,
    fontWeight: 'normal',
  },
  caption: {
    fontSize: 13,
    fontWeight: 'normal',
  },
});
