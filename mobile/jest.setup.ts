/* Simulações do que só existe no celular, para os testes das telas rodarem no computador. */
import { Alert } from 'react-native'

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))

jest.mock('@/lib/supabase', () => {
  const { fakeState } = require('@/test/fakeState')
  const { errorMessage } = jest.requireActual('@/lib/errorMessage')
  return {
    get supabase() {
      return fakeState.supabase.client
    },
    isConfigured: true,
    PHOTO_BUCKET: 'checkins',
    errorMessage,
  }
})

// Foto e cartão da semana usam o Skia (desenho nativo); aqui só devolvem um arquivo de mentira.
jest.mock('@/lib/image', () => ({
  prepareCheckinPhoto: jest.fn(() => ({ bytes: new Uint8Array([255, 216, 255]), uri: 'file:///foto-teste.jpg' })),
}))
jest.mock('@/lib/summaryCard', () => ({
  buildSummaryCard: jest.fn(async () => ({ uri: 'file:///semana-teste.jpg' })),
  shareImage: jest.fn(async () => true),
}))

jest.mock('expo-camera', () => {
  const React = require('react')
  const { View } = require('react-native')
  const CameraView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      takePictureAsync: async () => ({ base64: '/9j/', uri: 'file:///camera.jpg', width: 1920, height: 1440, format: 'jpg' }),
    }))
    React.useEffect(() => props.onCameraReady?.(), [])
    return React.createElement(View, { testID: 'camera' })
  })
  return {
    CameraView,
    useCameraPermissions: () => [{ granted: true, canAskAgain: true, status: 'granted' }, jest.fn()],
  }
})

jest.mock('expo-location', () => {
  const { fakeState } = require('@/test/fakeState')
  const loc = () => ({
    coords: { latitude: fakeState.position.lat, longitude: fakeState.position.lng, accuracy: fakeState.position.accuracy },
    timestamp: Date.now(),
  })
  return {
    Accuracy: { Highest: 5 },
    requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
    hasServicesEnabledAsync: async () => true,
    getCurrentPositionAsync: async () => loc(),
    watchPositionAsync: async (_opts: unknown, cb: (l: unknown) => void) => {
      cb(loc())
      return { remove: () => undefined }
    },
  }
})

jest.mock('react-native-maps', () => {
  const React = require('react')
  const { View } = require('react-native')
  const MapView = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ fitToCoordinates: jest.fn(), animateToRegion: jest.fn() }))
    React.useEffect(() => props.onMapReady?.(), [])
    return React.createElement(View, { testID: 'map' }, props.children)
  })
  const Stub = (props: any) => React.createElement(View, { testID: props.title ? `marker-${props.title}` : undefined })
  return { __esModule: true, default: MapView, Marker: Stub, Circle: Stub }
})

jest.mock('react-native-svg', () => {
  const React = require('react')
  const { View } = require('react-native')
  const Stub = (props: any) => React.createElement(View, null, props.children)
  return { __esModule: true, default: Stub, Svg: Stub, Path: Stub, Rect: Stub, Circle: Stub }
})

jest.mock('expo-clipboard', () => ({
  getStringAsync: async () => require('@/test/fakeState').fakeState.clipboard,
  setStringAsync: async (text: string) => {
    require('@/test/fakeState').fakeState.clipboard = text
    return true
  },
}))

let mockUuid = 0
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuid}` }))

// Confirmações (Alert) respondem "sim" sozinhas.
beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
    buttons?.[buttons.length - 1]?.onPress?.()
  })
})
