// ペルソナプラグインのインターフェースと実装を再エクスポート
export type { PersonaPlugin } from "./persona/interface.js"
export { CooperativePersona } from "./persona/cooperative.js"
export { SelfishPersona } from "./persona/selfish.js"
export { RationalPersona } from "./persona/rational.js"
export { NeutralPersona } from "./persona/neutral.js"
export { ProviderPersona } from "./persona/provider.js"
