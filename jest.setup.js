jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem:     jest.fn(),
  setItem:     jest.fn(),
  removeItem:  jest.fn(),
  multiRemove: jest.fn(),
  clear:       jest.fn(),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync:    jest.fn(),
  setItemAsync:    jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync:      jest.fn().mockResolvedValue('mockhash123'),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  randomUUID:            jest.fn().mockReturnValue('mock-uuid-1234'),
}));

jest.mock('expo-application', () => ({
  getAndroidId:           jest.fn().mockReturnValue('android-test-id'),
  getIosIdForVendorAsync: jest.fn().mockResolvedValue('ios-test-id'),
}));

jest.mock('react-native-ble-plx', () => ({
  BleManager: jest.fn().mockImplementation(() => ({
    onStateChange:   jest.fn(),
    startDeviceScan: jest.fn(),
    stopDeviceScan:  jest.fn(),
    destroy:         jest.fn(),
  })),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch:            jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
  addEventListener: jest.fn().mockReturnValue(() => {}),
}));