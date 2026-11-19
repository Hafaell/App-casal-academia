import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { alpha, colors } from '@/lib/theme'

// ---------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------

type TxtProps = TextProps & {
  size?: number
  weight?: TextStyle['fontWeight']
  color?: string
  muted?: boolean
  center?: boolean
  mono?: boolean
}

/** Texto com a cor e a fonte do app. */
export function Txt({ size = 15, weight, color, muted, center, mono, style, ...props }: TxtProps) {
  return (
    <Text
      {...props}
      style={[
        {
          color: color ?? (muted ? colors.muted : colors.ink),
          fontSize: size,
          fontWeight: weight,
          textAlign: center ? 'center' : undefined,
          fontFamily: mono ? Platform.select({ ios: 'Menlo', default: 'monospace' }) : undefined,
        },
        style,
      ]}
    />
  )
}

// ---------------------------------------------------------------------
// Carregando e mensagens
// ---------------------------------------------------------------------

export function Spinner({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <View
      style={fullScreen ? [styles.fill, styles.center, { backgroundColor: colors.bg }] : { paddingVertical: 40, alignItems: 'center' }}
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando"
    >
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  )
}

export function FullScreenMessage({ title, detail, action }: { title: string; detail?: ReactNode; action?: ReactNode }) {
  return (
    <View style={[styles.fill, styles.center, { backgroundColor: colors.bg, paddingHorizontal: 24, gap: 12 }]}>
      <Txt size={20} weight="600" center>
        {title}
      </Txt>
      {detail ? (
        <Txt size={14} muted center>
          {detail}
        </Txt>
      ) : null}
      {action}
    </View>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Txt size={14} muted center style={{ paddingHorizontal: 24, paddingVertical: 48 }}>
      {children}
    </Txt>
  )
}

// ---------------------------------------------------------------------
// Blocos
// ---------------------------------------------------------------------

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  onPress,
  loading,
  disabled,
  children,
  style,
  textStyle,
  accessibilityLabel,
}: {
  variant?: Variant
  onPress?: () => void
  loading?: boolean
  disabled?: boolean
  children: ReactNode
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  accessibilityLabel?: string
}) {
  const v = buttonVariants[variant]
  const off = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(off), busy: Boolean(loading) }}
      style={({ pressed }) => [styles.button, v.box, pressed && v.pressed, off && { opacity: 0.5 }, style]}
    >
      {loading ? <ActivityIndicator size="small" color={v.text.color} /> : null}
      {typeof children === 'string' ? <Text style={[styles.buttonText, v.text, textStyle]}>{children}</Text> : children}
    </Pressable>
  )
}

const buttonVariants: Record<Variant, { box: ViewStyle; pressed: ViewStyle; text: TextStyle & { color: string } }> = {
  primary: { box: { backgroundColor: colors.accent }, pressed: { opacity: 0.85 }, text: { color: colors.accentInk, fontWeight: '600' } },
  secondary: {
    box: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
    pressed: { backgroundColor: colors.line },
    text: { color: colors.ink },
  },
  ghost: { box: { backgroundColor: 'transparent' }, pressed: { opacity: 0.6 }, text: { color: colors.muted } },
  danger: {
    box: { backgroundColor: alpha(colors.danger, 0.15), borderWidth: 1, borderColor: alpha(colors.danger, 0.3) },
    pressed: { backgroundColor: alpha(colors.danger, 0.25) },
    text: { color: colors.danger },
  },
}

/** Botão pequeno em forma de pílula (filtros, tipos, motivos). */
export function Chip({
  label,
  active,
  onPress,
  disabled,
  style,
}: {
  label: string
  active: boolean
  onPress: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      style={[styles.chip, active ? { backgroundColor: colors.accent } : { backgroundColor: colors.surface2 }, disabled && { opacity: 0.3 }, style]}
    >
      <Txt size={14} color={active ? colors.accentInk : colors.muted} center>
        {label}
      </Txt>
    </Pressable>
  )
}

const MEMBER_COLORS = ['#c6f432', '#38bdf8', '#f472b6', '#fbbf24', '#a78bfa', '#34d399']

/** Cor do membro pela posição na lista. Quem saiu do grupo (índice -1) fica em cinza. */
export function memberColor(index: number): string {
  if (index < 0) return '#8b97a8'
  return MEMBER_COLORS[index % MEMBER_COLORS.length]
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ color: colors.bg, fontWeight: '700', fontSize: size * 0.42 }}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  )
}

/** Cabeçalho das telas. `back` mostra "‹ Voltar" (volta para a tela anterior). */
export function PageHeader({ title, subtitle, back, right }: { title: string; subtitle?: ReactNode; back?: boolean; right?: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flexShrink: 1 }}>
          {back ? (
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/mais'))} accessibilityRole="link" hitSlop={8}>
              <Txt size={14} muted style={{ marginBottom: 4 }}>
                ‹ Voltar
              </Txt>
            </Pressable>
          ) : null}
          <Txt size={24} weight="700" numberOfLines={1}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt size={14} muted>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  )
}

/** Tela com rolagem, cabeçalho e o espaçamento padrão. */
export function Screen({ header, children, refreshControl }: { header?: ReactNode; children: ReactNode; refreshControl?: React.ReactElement<any> }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {header}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </View>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <View>
      <Txt size={14} weight="500" muted style={{ marginBottom: 6 }}>
        {label}
      </Txt>
      {children}
      {hint ? (
        <Txt size={12} muted style={{ marginTop: 4 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  )
}

export function Input({ style, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false)
  return (
    <TextInput
      placeholderTextColor={alpha(colors.muted, 0.7)}
      {...props}
      onFocus={(e) => {
        setFocused(true)
        props.onFocus?.(e)
      }}
      onBlur={(e) => {
        setFocused(false)
        props.onBlur?.(e)
      }}
      style={[styles.input, focused && { borderColor: colors.accent }, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, style]}
    />
  )
}

// ---------------------------------------------------------------------
// Janelas
// ---------------------------------------------------------------------

/** Folha que sobe de baixo. Toque fora fecha. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
          <View style={styles.grabber} />
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
      <ToastHost />
    </Modal>
  )
}

export function PhotoViewer({ url, caption, onClose }: { url: string | null; caption?: ReactNode; onClose: () => void }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={Boolean(url)} animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.black }} onPress={onClose}>
        <View style={{ paddingTop: Math.max(insets.top, 12), paddingHorizontal: 16, alignItems: 'flex-end' }}>
          <Pressable onPress={onClose} style={styles.closePill} accessibilityRole="button">
            <Txt size={14}>Fechar</Txt>
          </Pressable>
        </View>
        <View style={{ flex: 1, padding: 8 }}>
          {url ? <Image source={{ uri: url }} style={{ flex: 1, borderRadius: 8 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
        </View>
        {caption ? (
          <Txt size={14} color="rgba(255,255,255,0.8)" center style={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 8) + 8 }}>
            {caption}
          </Txt>
        ) : null}
      </Pressable>
      <ToastHost />
    </Modal>
  )
}

/** Pergunta de confirmação (substitui o confirm() do navegador). */
export function confirmAsync(message: string, ok = 'Confirmar', destructive = false): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert('Confirmar', message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) })
  })
}

// ---------------------------------------------------------------------
// Avisos rápidos
// ---------------------------------------------------------------------
interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}

interface ToastApi {
  show: (text: string, tone?: Toast['tone']) => void
  toasts: Toast[]
}

const ToastContext = createContext<ToastApi>({ show: () => {}, toasts: [] })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const show = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return (
    <ToastContext.Provider value={{ show, toasts }}>
      {children}
      <ToastHost />
    </ToastContext.Provider>
  )
}

/**
 * Mostra os avisos. Fica na raiz do app e também dentro de cada janela (Modal),
 * porque no celular a janela aberta cobre tudo o que está atrás dela.
 */
export function ToastHost() {
  const { toasts } = useContext(ToastContext)
  const insets = useSafeAreaInsets()
  if (toasts.length === 0) return null
  return (
    <View pointerEvents="none" style={[styles.toasts, { top: Math.max(insets.top, 12) }]}>
      {toasts.map((t) => (
        <View
          key={t.id}
          accessibilityLiveRegion="polite"
          style={[styles.toast, { backgroundColor: t.tone === 'ok' ? colors.accent : colors.danger }]}
        >
          <Txt size={14} weight="500" color={t.tone === 'ok' ? colors.accentInk : colors.white}>
            {t.text}
          </Txt>
        </View>
      ))}
    </View>
  )
}

export function useToast() {
  return useContext(ToastContext).show
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 16 },
  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: { fontSize: 14, textAlign: 'center' },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.line, 0.6),
    backgroundColor: colors.bg,
  },
  input: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 16,
  },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    marginTop: 'auto',
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 16,
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 12 },
  closePill: { borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 6 },
  toasts: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8, zIndex: 60 },
  toast: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
})
