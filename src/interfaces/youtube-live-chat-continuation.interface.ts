import { YouTubeLiveChatContinuationData } from './youtube-live-chat-continuation-data.interface'

export interface YouTubeLiveChatContinuation {
  liveChatReplayContinuationData?: YouTubeLiveChatContinuationData
  timedContinuationData?: YouTubeLiveChatContinuationData
  invalidationContinuationData?: YouTubeLiveChatContinuationData
  playerSeekContinuationData?: YouTubeLiveChatContinuationData
}
