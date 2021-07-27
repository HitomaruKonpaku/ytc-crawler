import { YouTubeLiveChatAction } from './youtube-live-chat-action'
import { YouTubeLiveChatContinuation } from './youtube-live-chat-continuation'

export interface YouTubeContinuation {
  actions?: YouTubeLiveChatAction[]
  continuation?: YouTubeLiveChatContinuation[]
}
