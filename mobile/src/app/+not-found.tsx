import { Redirect } from 'expo-router'

/** Endereço desconhecido: volta para o Início (como o "*" do site). */
export default function NotFound() {
  return <Redirect href="/" />
}
