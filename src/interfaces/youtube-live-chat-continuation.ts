import { YouTubeLiveChatContinuationData } from './youtube-live-chat-continuation-data'

export interface YouTubeLiveChatContinuation {
  liveChatReplayContinuationData?: YouTubeLiveChatContinuationData
  timedContinuationData?: YouTubeLiveChatContinuationData
  invalidationContinuationData?: YouTubeLiveChatContinuationData
  playerSeekContinuationData?: YouTubeLiveChatContinuationData
}
