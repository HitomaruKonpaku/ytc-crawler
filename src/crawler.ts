import axios from 'axios'
import * as cheerio from 'cheerio'
import EventEmitter from 'events'
import puppeteer, { Browser, HTTPResponse, Page } from 'puppeteer'
import { filter, fromEvent, map, takeWhile, tap } from 'rxjs'
import { args } from './args'
import { config } from './config'
import { YoutubeVideoMeta } from './interfaces/meta/youtube-video-meta.interface'
import { YouTubeLiveChatContinuationData } from './interfaces/youtube-live-chat-continuation-data.interface'
import logger from './logger'
import util from './util'

export class Crawler extends EventEmitter {
  public videoId: string
  public videoMeta: YoutubeVideoMeta
  public isMembersOnly = false

  private browser: Browser

  private cacheUrl: string
  private cacheHeaders: Record<string, string>
  private cacheBoby: any

  constructor(videoId: string) {
    super()
    this.videoId = videoId
  }

  public async launch() {
    try {
      await this.launchBrowser()
      await this.openVideoPage()
    } catch (error) {
      logger.error({ id: this.videoId, context: 'crawler', error: error.message })
      debugger
    }
  }

  private getVideoUrl() {
    const url = new URL('https://www.youtube.com/watch')
    url.searchParams.append('v', this.videoId)
    const href = url.href
    return href
  }

  private async launchBrowser() {
    logger.silly({ id: this.videoId, context: 'crawler', type: 'launchBrowser' })
    const browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      ignoreHTTPSErrors: true,
      args: ['--start-maximized'],
      defaultViewport: {
        width: config.puppeteer.width,
        height: config.puppeteer.height,
      },
      devtools: config.puppeteer.devtools,
    })
    this.browser = browser
  }


  private async openVideoPage() {
    logger.silly({ id: this.videoId, context: 'crawler', type: 'openVideoPage' })
    const browser = this.browser
    const pages = await browser.pages()
    const page = pages[0]
    await this.updateVideoPage(page)
    this.attachVideoPageEvents(page)

    const url = this.getVideoUrl()
    logger.info({ id: this.videoId, context: 'crawler', url })
    page.goto(url)
  }

  private async updateVideoPage(page: Page) {
    // Interception
    logger.debug({ id: this.videoId, context: 'crawler', type: 'updateVideoPage', action: 'setRequestInterception' })
    await page.setRequestInterception(true)

    // Cookie
    if (config.app.useCookies || args.cookies) {
      logger.debug({ id: this.videoId, context: 'crawler', type: 'updateVideoPage', action: 'setCookie' })
      try {
        const baseCookies = util.getCookies()
        const cookies = baseCookies.map(v => {
          const cookie = {
            name: v.name,
            value: v.value,
            domain: v.domain,
            path: v.path,
            secure: true,
            httpOnly: v.httpOnly,
            expires: v.expire,
          }
          return cookie
        })
        await page.setCookie(...cookies)
      } catch (error) {
        logger.error({ id: this.videoId, context: 'crawler', error: error.message })
        console.trace(error)
        debugger
      }
    }
  }

  private attachVideoPageEvents(page: Page) {
    const browser = page.browser()

    fromEvent(page, 'response')
      .pipe(
        map(response => response as HTTPResponse),
        filter(response => response.url() === this.getVideoUrl()),
        tap(async response => {
          const body = await response.text()
          if (body.includes('captcha-page')) {
            return
          }

          try {
            const meta = this.getVideoMeta(body)
            this.videoMeta = meta
            logger.info({ id: this.videoId, meta })
          } catch (error) {
            logger.error({ id: this.videoId, context: 'receiver', error: error.message })
            debugger
          }
          try {
            const data = this.getYtInitialData(body)
            this.isMembersOnly = JSON.stringify(data).includes('Members only')
            logger.info({ id: this.videoId, isMembersOnly: this.isMembersOnly })
          } catch (error) {
            logger.error({ id: this.videoId, context: 'receiver', error: error.message })
            debugger
          }
        }),
        takeWhile(() => !this.videoMeta),
      )
      .subscribe()

    page.on('request', async request => {
      const url = request.url()
      if (config.app.request.blockUrls.some(v => url.includes(v))) {
        logger.silly({ id: this.videoId, context: 'crawler', request: { action: 'abort', url } })
        await request.abort()
        return
      }

      if (!url.includes('live_chat/get_live_chat')) {
        logger.silly({ id: this.videoId, context: 'crawler', request: { action: 'continue', url } })
        await request.continue()
        return
      }

      logger.debug({ id: this.videoId, context: 'crawler', request: { action: 'execute', url } })
      const rawBody = request.postData()
      if (!rawBody) {
        logger.warn({ id: this.videoId, context: 'crawler', msg: 'request body not found' })
        debugger
        return
      }

      const headers = request.headers()
      const body = JSON.parse(rawBody)
      await browser.close()

      // Request Cookie
      if (config.app.useCookies || args.cookies) {
        logger.debug({ id: this.videoId, context: 'crawler', type: 'onPageRequest', action: 'setCookie' })
        try {
          const baseCookies = util.getCookies()
          const cookie = baseCookies.map(v => {
            const s = [v.name, v.value].join('=')
            return s
          }).join(' ')
          Object.assign(headers, { cookie })
        } catch (error) {
          logger.error({ id: this.videoId, context: 'crawler', error: error.message })
          console.trace(error)
          debugger
        }
      }

      this.cacheUrl = url
      this.cacheHeaders = headers
      this.cacheBoby = body
      this.getLiveChat()
    })

    page.on('response', async response => {
      const url = response.url()
      logger.silly({ id: this.videoId, context: 'crawler', response: { url } })

      if (!url.includes('live_chat') || ['live_chat_polymer'].some(v => url.includes(v))) {
        return
      }

      const body = await response.text()
      const data = this.getYtInitialData(body)
      const liveChatContinuation = data?.continuationContents?.liveChatContinuation
      if (!liveChatContinuation) {
        logger.warn({ id: this.videoId, context: 'crawler', msg: 'liveChatContinuation not found' })
        return
      }

      this.emitLiveChatContinuation(liveChatContinuation)
    })
  }

  private getVideoMeta(body: string) {
    const $ = cheerio.load(body)
    const baseNode = Array.from($('body *[itemid][itemtype]'))[0]
    if (!baseNode) {
      throw new Error('Meta node not found')
    }

    const getMeta = (node: any, meta = {}) => {
      node.childNodes.forEach((childNode: any) => {
        const attribs = childNode.attribs
        const key: string = attribs.itemprop
        if (!key) {
          return
        }
        if (childNode.childNodes.length) {
          meta[key] = {}
          getMeta(childNode, meta[key])
          return
        }
        const value: string = attribs.href || attribs.content
        meta[key] = value
      })
      return meta
    }

    const meta = getMeta(baseNode)
    return meta
  }

  private getYtInitialData(body: string) {
    const $ = cheerio.load(body)
    const node = Array.from($('script'))
      .map((v: any) => Array.from(v.childNodes) as any[])
      .filter(v => v.length)
      .flat()
      .find(v => v.data && v.data.includes('ytInitialData'))
    if (!node) {
      logger.info({ id: this.videoId, context: 'crawler', msg: 'ytInitialData not found' })
      return null
    }
    const rawData: string = node['data']
    const jsonData = rawData.substring(rawData.indexOf('{'), rawData.lastIndexOf('}') + 1)
    const obj = JSON.parse(jsonData)
    logger.info({ id: this.videoId, context: 'crawler', msg: 'ytInitialData found' })
    return obj
  }

  private getNewContinuation(liveChatContinuation: any) {
    if (!liveChatContinuation) {
      return
    }
    const continuations: any[] = liveChatContinuation.continuations
    if (!continuations) {
      return
    }
    const newContinuation = continuations[0]
    return newContinuation
  }

  private handleNewContinuation(newContinuation: any) {
    if (newContinuation.timedContinuationData) {
      this.getLiveChatByContinuationData(newContinuation.timedContinuationData)
    } else if (newContinuation.invalidationContinuationData) {
      this.getLiveChatByContinuationData(newContinuation.invalidationContinuationData)
    } else if (newContinuation.liveChatReplayContinuationData) {
      this.getLiveChatByContinuationData(newContinuation.liveChatReplayContinuationData)
    } else if (newContinuation.playerSeekContinuationData) {
      this.onVideoEnd()
      return
    } else {
      logger.warn({ id: this.videoId, context: 'crawler', handleNewContinuation: { msg: 'newContinuation unhandled' } })
      logger.warn(newContinuation)
      debugger
    }
  }

  private async getLiveChat(continuation?: string) {
    if (continuation) {
      Object.assign(this.cacheBoby, { continuation })
    }

    const url = this.cacheUrl
    const headers = this.cacheHeaders
    const body = this.cacheBoby

    try {
      logger.silly({ id: this.videoId, context: 'crawler', type: 'getLiveChat' })
      const res = await axios.request<any>({
        method: 'POST',
        url,
        headers,
        data: JSON.stringify(body),
      })

      const data = res.data
      const liveChatContinuation = data?.continuationContents?.liveChatContinuation
      if (!liveChatContinuation) {
        this.onStreamEnd()
        return
      }

      this.emitLiveChatContinuation(liveChatContinuation)
      const newContinuation = this.getNewContinuation(liveChatContinuation)
      this.handleNewContinuation(newContinuation)
    } catch (error) {
      logger.error({ id: this.videoId, context: 'crawler', error: error.message })
      debugger
      // Retry request
      const retryTimeout = 5000
      this.getLiveChatWithTimeout(continuation, retryTimeout)
    }
  }

  private getLiveChatWithTimeout(continuation: string, timeoutMs = 0) {
    logger.silly({ id: this.videoId, context: 'crawler', type: 'getLiveChatWithTimeout', timeoutMs })
    setTimeout(() => {
      this.getLiveChat(continuation)
    }, timeoutMs)
  }

  private getLiveChatByContinuationData(continuationData: YouTubeLiveChatContinuationData) {
    this.getLiveChatWithTimeout(continuationData.continuation, continuationData.timeoutMs)
  }

  private onVideoEnd() {
    logger.info({ id: this.videoId, context: 'crawler', msg: 'VIDEO END' })
    this.emitLiveChatEnd()
  }

  private onStreamEnd() {
    logger.info({ id: this.videoId, context: 'crawler', msg: 'STREAM END' })
    this.emitLiveChatEnd()
  }

  private emitLiveChatContinuation(liveChatContinuation: any) {
    this.emit('data', liveChatContinuation)
  }

  private emitLiveChatEnd() {
    this.emit('end')
  }
}
