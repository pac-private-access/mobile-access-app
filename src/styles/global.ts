import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#1B39E8',
  primaryLight: '#E8ECFF',
  background: '#F2F4F8',
  surface: '#FFFFFF',
  text: '#0F1728',
  textSecondary: '#6B7280',
  success: '#10B981',
  danger: '#EF4444',
  border: '#E5E7EB',
};

export const globalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F4F8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0F1728',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 16,
  },
  empty: {
    color: '#6B7280',
    fontSize: 14,
  },
});