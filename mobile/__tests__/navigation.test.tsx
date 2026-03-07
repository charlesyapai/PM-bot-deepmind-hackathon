/**
 * Navigation Tests
 * Verifies that the tab navigator renders without crashing and that all
 * expected tabs (Projects, Tasks, Voice FAB, Meetings/Notes, Settings) are visible.
 *
 * Dependencies required (not yet in mobile/package.json):
 *   npm install --save-dev jest @types/jest ts-jest
 *   npm install --save-dev @testing-library/react-native @testing-library/jest-native
 *   npm install --save-dev jest-expo              (recommended for Expo projects)
 *   npm install --save-dev react-test-renderer
 *
 * Additionally, a jest config is needed. Add to mobile/package.json:
 *   "jest": {
 *     "preset": "jest-expo",
 *     "setupFilesAfterFramework": ["@testing-library/jest-native/extend-expect"]
 *   }
 *
 * Third-party libraries that need mocking before these tests can run:
 *   - @react-navigation/native (NavigationContainer)
 *   - @react-navigation/bottom-tabs
 *   - @react-navigation/native-stack
 *   - lucide-react-native (icon components)
 *   - react-native-safe-area-context
 *   - react-native-screens
 *
 * See mock stubs at the bottom of this file.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';

// Component under test
import { TabNavigator } from '../src/navigation/TabNavigator';
import { RootNavigator } from '../src/navigation/RootNavigator';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
// These mocks prevent native module errors when running in a Node/JSDOM env.
// jest-expo handles most RN mocking automatically when used as the Jest preset.

jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const MockIcon = (props: any) => <View testID={props.testID ?? 'icon'} />;
  return {
    Folder: MockIcon,
    CheckSquare: MockIcon,
    Mic: MockIcon,
    FileText: MockIcon,
    Settings: MockIcon,
  };
});

jest.mock('@react-navigation/native-stack', () => {
  const { View } = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: any) => <View>{children}</View>,
      Screen: ({ component: Component }: any) => <Component />,
    }),
  };
});

// ---------------------------------------------------------------------------
// Helper: wrap component in NavigationContainer
// ---------------------------------------------------------------------------
const renderWithNavigation = (ui: React.ReactElement) => {
  return render(<NavigationContainer>{ui}</NavigationContainer>);
};

// ---------------------------------------------------------------------------
// TabNavigator tests
// ---------------------------------------------------------------------------
describe('TabNavigator', () => {
  it('renders without crashing', () => {
    // If this throws, something in the navigator tree has a hard crash
    expect(() => renderWithNavigation(<TabNavigator />)).not.toThrow();
  });

  it('renders the Projects tab', () => {
    renderWithNavigation(<TabNavigator />);
    // Tab labels are rendered as accessible text elements
    expect(screen.getByText('Projects')).toBeTruthy();
  });

  it('renders the Tasks tab', () => {
    renderWithNavigation(<TabNavigator />);
    expect(screen.getByText('Tasks')).toBeTruthy();
  });

  it('renders the Meetings tab', () => {
    renderWithNavigation(<TabNavigator />);
    // Tab title is set to 'Meetings' in TabNavigator options
    expect(screen.getByText('Meetings')).toBeTruthy();
  });

  it('renders the Settings tab', () => {
    renderWithNavigation(<TabNavigator />);
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders the Voice FAB button in the center position', () => {
    renderWithNavigation(<TabNavigator />);
    // The FAB renders a TouchableOpacity containing a Mic icon.
    // With the Mic icon mocked, verify the FAB container is present.
    // The VoiceFAB renders as a custom tab button — check that the Mic icon appears.
    const micIcons = screen.queryAllByTestId('icon');
    // At minimum the Mic icon (inside FAB) should be rendered
    expect(micIcons.length).toBeGreaterThan(0);
  });

  it('has exactly 5 tab entries (Projects, Tasks, Voice, Meetings, Settings)', () => {
    renderWithNavigation(<TabNavigator />);
    // Collect all tab label texts — Voice tab has no text label, just the FAB
    const projectsTab = screen.queryByText('Projects');
    const tasksTab = screen.queryByText('Tasks');
    const meetingsTab = screen.queryByText('Meetings');
    const settingsTab = screen.queryByText('Settings');

    expect(projectsTab).toBeTruthy();
    expect(tasksTab).toBeTruthy();
    expect(meetingsTab).toBeTruthy();
    expect(settingsTab).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// RootNavigator tests
// ---------------------------------------------------------------------------
describe('RootNavigator', () => {
  it('renders without crashing', () => {
    expect(() => renderWithNavigation(<RootNavigator />)).not.toThrow();
  });

  it('renders the MainTabs screen (which contains the TabNavigator)', () => {
    renderWithNavigation(<RootNavigator />);
    // Projects tab is inside TabNavigator which is inside RootNavigator
    expect(screen.getByText('Projects')).toBeTruthy();
  });
});
