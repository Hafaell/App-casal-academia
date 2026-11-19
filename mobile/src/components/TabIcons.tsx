/** Ícones das abas (os mesmos desenhos do site). */
import type { ReactNode } from 'react'
import type { ColorValue } from 'react-native'
import Svg, { Circle, Path, Rect } from 'react-native-svg'

function Icon({ color, children }: { color: ColorValue; children: ReactNode }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </Svg>
  )
}

export function IconHome({ color }: { color: ColorValue }) {
  return (
    <Icon color={color}>
      <Path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </Icon>
  )
}

export function IconFeed({ color }: { color: ColorValue }) {
  return (
    <Icon color={color}>
      <Rect x={3} y={3} width={18} height={18} rx={3} />
      <Circle cx={9} cy={9} r={2} />
      <Path d="m21 15-4.5-4.5L6 21" />
    </Icon>
  )
}

export function IconCalendar({ color }: { color: ColorValue }) {
  return (
    <Icon color={color}>
      <Rect x={3} y={4.5} width={18} height={16.5} rx={2.5} />
      <Path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </Icon>
  )
}

export function IconCoin({ color }: { color: ColorValue }) {
  return (
    <Icon color={color}>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.6 0-2.8.8-2.8 2s1.2 1.6 2.8 2 2.8.8 2.8 2-1.2 2-2.8 2c-1.3 0-2.4-.5-2.9-1.3M12 6.5V8M12 16v1.5" />
    </Icon>
  )
}

export function IconMore({ color }: { color: ColorValue }) {
  return (
    <Icon color={color}>
      <Circle cx={5} cy={12} r={1.3} />
      <Circle cx={12} cy={12} r={1.3} />
      <Circle cx={19} cy={12} r={1.3} />
    </Icon>
  )
}
