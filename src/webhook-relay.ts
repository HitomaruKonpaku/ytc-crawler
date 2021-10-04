import axios from 'axios'
import logger from './logger'

export class WebhookRelay {
  private readonly CHAR_COUNT_MAX = 2000

  private videoId: string
  private webhookUrl: string
  private rateLimitResetMs: number
  private messages: string[] = []

  constructor(videoId: string, webhookUrl: string) {
    this.videoId = videoId
    this.webhookUrl = webhookUrl
  }

  public hasContent() {
    return this.messages && this.messages.length > 0
  }

  public async send(msg = '') {
    msg = (msg || '').trim()
    if (msg) {
      if (msg.length <= this.CHAR_COUNT_MAX) {
        this.messages.push(msg)
      }
    }
    if (!this.messages.length) {
      return
    }

    const now = Date.now()
    if (this.rateLimitResetMs) {
      logger.info({ id: this.videoId, context: 'webhook-relay', rateLimitResetMs: this.rateLimitResetMs, remainingTimeMs: this.rateLimitResetMs - now })
      if (this.rateLimitResetMs > now) {
        return
      }
    }

    const url = this.webhookUrl
    const body = { content: this.getContent() }
    logger.debug({ id: this.videoId, context: 'webhook-relay', body })

    try {
      const res = await axios.post(url, body)
      const headers = res.headers
      logger.info({ id: this.videoId, context: 'webhook-relay', response: { status: res.status, statusText: res.statusText, headers: this.getRateLimit(headers) } })
      this.rateLimitResetMs = null
    } catch (error) {
      const res = error.response
      const headers = res.headers
      logger.error({ id: this.videoId, context: 'webhook-relay', error: error.message, response: { status: res.status, statusText: res.statusText, headers: this.getRateLimit(headers) } })
      const rateLimit = this.getRateLimit(headers)
      this.rateLimitResetMs = [rateLimit['x-ratelimit-reset'], rateLimit['x-ratelimit-reset-after']]
        .map(v => Number(v))
        .reduce((pv, cv) => pv + cv, 0) * 1000
      this.messages.unshift(...body.content.split('\r\n'))
    }
  }

  private getContent() {
    for (let index = this.messages.length; index > 0; index--) {
      const arr = this.messages.slice(0, index)
      const content = arr.join('\r\n')
      if (content.length <= this.CHAR_COUNT_MAX) {
        this.messages = this.messages.filter((v, i) => i > index)
        return content
      }
    }
  }

  private getRateLimit(headers: Record<string, string>) {
    const keys = ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-RateLimit-Reset-After']
    const obj: any = keys
      .map(v => v.toLowerCase())
      .reduce((pv, cv) => Object.assign(pv, { [cv]: headers[cv] }), {})
    return obj
  }
}
