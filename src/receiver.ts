import { config } from './config'
import { Crawler } from './crawler'
import { YouTubeLiveChatAction } from './interfaces/youtube-live-chat-action.interface'
import io from './io'
import logger from './logger'
import util from './util'
import { WebhookRelay } from './webhook-relay'

export class Receiver {
  private crawler: Crawler
  private webhookRelays: WebhookRelay[] = []

  private dataCount = 0
  private actionCount = 0
  private actionDetailCount = 0

  constructor(crawler: Crawler) {
    this.crawler = crawler
    io.mkrdir(util.getChatDir())
    this.attachCrawlerEvents()
  }

  private get videoId() {
    return this.crawler.videoId
  }

  private get channelConfig() {
    return config.youtube.channels[this.crawler.videoMeta?.channelId]
  }

  private attachCrawlerEvents() {
    const crawler = this.crawler

    crawler.once('data', () => {
      this.initWebhookRelays()
    })

    crawler.on('data', data => {
      this.dataCount++
      this.handleData(data)
    })

    crawler.once('end', () => {
      this.clearWebhookRelays()
    })
  }

  private initWebhookRelays() {
    const webhookUrls: string[] = (this.crawler.isMembersOnly ? this.channelConfig?.membersWebhookUrls : this.channelConfig?.defaultWebhookUrls) || []
    this.webhookRelays = webhookUrls.map(url => new WebhookRelay(this.videoId, url))
  }

  private clearWebhookRelays() {
    const remainingWebhookRelays = this.webhookRelays.filter(v => v.hasContent())
    logger.info({ id: this.videoId, context: 'receiver', remainingWebhookRelayCount: remainingWebhookRelays.length })
    remainingWebhookRelays.forEach(v => v.send())

    if (remainingWebhookRelays.length) {
      setTimeout(() => {
        this.clearWebhookRelays()
      }, 5000)
    }
  }

  private handleData(data: any) {
    this.handleActions(data?.actions)
  }

  private handleActions(actions: any[]) {
    if (!actions?.length) {
      logger.info({
        id: this.videoId,
        context: 'receiver',
        dataCount: this.dataCount,
        actionCount: [0, this.actionCount],
        actionDetailCount: [0, this.actionDetailCount],
      })
      return
    }

    const actionDetails = actions
      .map(v => this.getActionDetail(v))
      .flat()
      .filter(v => v)
    this.actionCount += actions.length
    this.actionDetailCount += actionDetails.length
    logger.info({
      id: this.videoId,
      context: 'receiver',
      dataCount: this.dataCount,
      actionCount: [actions.length, this.actionCount],
      actionDetailCount: [actionDetails.length, this.actionDetailCount],
    })

    this.saveActionDetails(actionDetails)
    this.sendActionDetailsByChannelConfig(actionDetails)
  }

  private getActionDetail(action: YouTubeLiveChatAction) {
    if (action.replayChatItemAction) {
      const childActions = action.replayChatItemAction.actions || []
      if (childActions.length !== 1) {
        logger.warn({ id: this.videoId, context: 'receiver', type: 'getActionDetail', msg: 'childActions length different than 1' })
        logger.warn(childActions)
        debugger
      }
      const childActionDetails: any[] = childActions.map(v => this.getActionDetail(v))
      return childActionDetails
    }
    if (action.addChatItemAction) {
      return this.getAddChatItemActionDetail(action.addChatItemAction)
    }
    if (action.addBannerToLiveChatCommand) {
      const renderer = action.addBannerToLiveChatCommand.bannerRenderer
      logger.warn({ id: this.videoId, context: 'receiver', type: 'getActionDetail', msg: 'addBannerToLiveChatCommand' })
      logger.warn(renderer)
      debugger
      return [renderer]
    }
    if (action.addLiveChatTickerItemAction) {
      return null
    }
    if (action.markChatItemAsDeletedAction) {
      return null
    }
    if (action.markChatItemsByAuthorAsDeletedAction) {
      return null
    }
    if (action.replaceChatItemAction) {
      return null
    }
    if (action.replaceLiveChatRendererAction) {
      return null
    }
    if (action.showLiveChatTooltipCommand) {
      return null
    }
    if (action.clickTrackingParams) {
      return null
    }
    return null
  }

  private getAddChatItemActionDetail(actionData: any) {
    if (!actionData) {
      return
    }

    const item = actionData.item
    if (!item) {
      logger.warn({ id: this.videoId, context: 'receiver', type: 'getAddChatItemActionDetail', msg: 'item not found' })
      logger.warn(actionData)
      debugger
      return
    }

    const unusedKeys = ['contextMenuEndpoint', 'contextMenuAccessibility', 'trackingParams']
    const rendererKeys = Object.keys(item)
    rendererKeys.forEach(rendererKey => {
      const rendererValue = item[rendererKey]
      unusedKeys.forEach(key => {
        if (!rendererValue[key]) {
          return
        }
        delete rendererValue[key]
      })
    })
    return item
  }

  private buildContentFromActionDetails(actionDetails: any[]) {
    let content = Array.from(actionDetails || [])
      .map(v => JSON.stringify(v))
      .join('\r\n')
    if (content) {
      content += '\r\n'
    }
    return content
  }

  private saveActionDetails(actionDetails: any[]) {
    // Save all messages
    let content = this.buildContentFromActionDetails(actionDetails)
    if (content) {
      io.appendFile(util.getChatFile(this.videoId), content)
    }

    // Save SuperChat only
    content = this.buildContentFromActionDetails(actionDetails.filter(v => v.liveChatPaidMessageRenderer))
    if (content) {
      io.appendFile(util.getSuperChatFile(this.videoId), content)
    }
  }

  private sendActionDetailsByChannelConfig(actionDetails: any[]) {
    const channelConfig = this.channelConfig
    if (!channelConfig) {
      return
    }

    let content = ''
    actionDetails.forEach(action => {
      const renderer = action.liveChatTextMessageRenderer
      if (!renderer) {
        return
      }

      const authorId = renderer.authorExternalChannelId
      if (channelConfig.fromAuthorIds?.length && !channelConfig.fromAuthorIds.some(v => v === authorId)) {
        return
      }

      const authorName = renderer.authorName.simpleText
      if (channelConfig.fromAuthorNames?.length && !channelConfig.fromAuthorNames.some(v => v === authorName)) {
        return
      }

      const msg = util.makeYoutubeMessage(renderer.message.runs)
      if (!msg || (channelConfig.messageContains?.length && !channelConfig.messageContains.some(v => msg.includes(v)))) {
        return
      }

      content += `${msg}\r\n`
    })

    content = content.trim()
    this.webhookRelays.forEach(v => v.send(content))
  }
}
