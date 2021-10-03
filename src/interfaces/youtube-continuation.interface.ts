import { YouTubeLiveChatAction } from './youtube-live-chat-action.interface'
import { YouTubeLiveChatContinuation } from './youtube-live-chat-continuation.interface'

export interface YouTubeContinuation {
  actions?: YouTubeLiveChatAction[]
  continuation?: YouTubeLiveChatContinuation[]
}
