import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>

      //if user is not authenticated, show login screen
      <Stack.Screen name='login' />
      //if user is authenticated, show tabs
      <Stack.Screen name='(tabs)' />
      
    </Stack>
  );
}