# 📝 Frontend Engineer — Working Notes

## Goal

Implement the core mobile UI (React Native Expo) for the Personal Bot, ensuring an iOS-first, native-quality feel with primary focus on a fluid voice UI and offline support.

## Dependencies & Sources

- **Architecture**: React Native Expo, Offline Storage with MMKV (`architecture_designer/notes.md`).
- **UX Specs**: San Francisco font, iOS System colors, Voice Interaction FAB, Template Flow (`ux_designer/ux_specification.md`).
- **Dependencies APIs**: REST API Contracts (`backend_engineer/api_contracts.md`).
- **Git Strategy**: Use `develop` branch (Currently active). Feature branches off develop (`senior_engineer/notes.md`).

## Action Plan

1. **Initialize Project**: Use `npx create-expo-app` to initialize the React Native Expo app inside `mobile/` directory.
2. **Setup Dependencies**: Install `@react-navigation/native`, `@react-navigation/bottom-tabs`, `react-native-mmkv` for offline storage, etc.
3. **Scaffold Navigation**: Implement the requested Tab Navigator: Projects, Tasks, Voice FAB (Center), Meeting Notes, Settings.
4. **Theme Configuration**: Implement the iOS-First Design System specified by the UX designer.
5. **Component Structuring**: Build components for Voice Button overlay + animations, Template Views (Kanban/Checklist), Offline Indicator (`☁️`).

## Current Status

- Initializing `mobile/` workspace folder with `create-expo-app`.
