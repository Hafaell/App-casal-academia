/** Setas ‹ mês › para navegar entre meses (não passa do mês atual). */
import { Pressable, View } from 'react-native'
import { useGroup } from '@/providers/GroupProvider'
import { Txt } from '@/components/ui'
import { addMonths, firstOfMonth, monthLabel, type ISODate } from '@domain/dates'

export function MonthPicker({ month, onChange }: { month: ISODate; onChange: (m: ISODate) => void }) {
  const { today } = useGroup()
  const thisMonth = firstOfMonth(today)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Arrow label="‹" a11y="Mês anterior" onPress={() => onChange(addMonths(month, -1))} />
      <Txt size={18} weight="700">
        {monthLabel(month)}
      </Txt>
      <Arrow label="›" a11y="Próximo mês" disabled={month >= thisMonth} onPress={() => onChange(addMonths(month, 1))} />
    </View>
  )
}

function Arrow({ label, a11y, onPress, disabled }: { label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityState={{ disabled }}
      hitSlop={10}
      style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1 }}
    >
      <Txt size={28} weight="700">
        {label}
      </Txt>
    </Pressable>
  )
}
