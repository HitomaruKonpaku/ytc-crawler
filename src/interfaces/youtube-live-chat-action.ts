export interface YouTubeLiveChatAction {
  replayChatItemAction?: { actions?: YouTubeLiveChatAction[] }
  addChatItemAction?: any
  addLiveChatTickerItemAction?: any
  markChatItemAsDeletedAction?: any
  markChatItemsByAuthorAsDeletedAction?: any
  replaceChatItemAction?: any
  replaceLiveChatRendererAction?: any
  showLiveChatTooltipCommand?: any
  clickTrackingParams?: any
}
