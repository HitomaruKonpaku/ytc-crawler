import * as cheerio from 'cheerio'
import fetch from 'node-fetch'
import puppeteer from 'puppeteer'
import { config } from './config'
import io from './io'
import logger from './logger'
import util from './util'

let videoId: string

main()
  .then(() => {
    // TODO
  })
  .catch((error) => {
    logger.error(error.message)
    console.trace(error)
    debugger
  })

async function main() {
  io.makeDir(util.getChatDir())
  const args = process.argv.slice(2)
  logger.debug({ args })
  const id = util.getYouTubeVideoId(args[0])
  logger.debug({ videoId: id })
  videoId = id
  const url = getVideoUrl(id)
  logger.info({ videoUrl: url })
  await launchBrowser(url)
}

function getVideoUrl(id: string): string {
  const url = 'https://www.youtube.com/watch?v=' + id
  return url
}

async function launchBrowser(videoUrl: string) {
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
  logger.silly({ videoId, puppeteer: { browser: { action: 'launch' } } })

  const page = await browser.newPage()
  logger.silly({ videoId, puppeteer: { browser: { page: { action: 'newPage' } } } })
  await page.setRequestInterception(true)

  if (config.app.useCookies) {
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
      logger.error(error.message)
      console.trace(error)
      debugger
    }
  }

  page.on('request', async (request) => {
    const url = request.url()
    if (['googleads'].some(v => url.includes(v))) {
      logger.silly({ videoId, request: { status: 'abort', url } })
      await request.abort()
      return
    }
    logger.silly({ videoId, request: { status: 'continue', url } })
    if (!url.includes('live_chat/get_live_chat')) {
      await request.continue()
      return
    }
    const bodyData = request.postData()
    if (!bodyData) {
      logger.warn('get_live_chat body not found', videoId)
      return
    }
    const headers = request.headers()
    const body = JSON.parse(bodyData)
    const continuation = body.continuation
    await browser.close()

    if (config.app.useCookies) {
      logger.info({ videoId, msg: 'Cookies enabled' })
      try {
        const baseCookies = util.getCookies()
        const cookie = baseCookies.map(v => {
          const s = [v.name, v.value].join('=')
          return s
        }).join(' ')
        Object.assign(headers, { cookie })
        logger.info({ videoId, msg: 'Cookies applied' })
      } catch (error) {
        logger.error(error.message)
        console.trace(error)
        debugger
      }
    }

    await fetchLiveChat(url, headers, body, continuation)
  })

  page.on('response', async (response) => {
    const url = response.url()
    logger.silly({ videoId, responseUrl: url })
    if (!url.includes('live_chat')) {
      return
    }
    const body = await response.text()
    const $ = cheerio.load(body)
    const scripts = $('script')
    if (!scripts) {
      return
    }
    const nodes = Array.from(scripts)
      .map(v => Array.from(v.childNodes))
      .filter(v => v.length)
      .flatMap(v => v)
    const dataNode: any = nodes.find((v: any) => v['data'] && v.data.includes('ytInitialData'))
    if (!dataNode) {
      return
    }
    const rawData = dataNode['data']
    const jsonData = rawData
      .replace('window["ytInitialData"] = ', '')
      .replace(/;$/, '')
    try {
      const data = JSON.parse(jsonData)
      const liveChatContinuation = data?.continuationContents?.liveChatContinuation
      handleLiveChatData(liveChatContinuation)
    } catch (error) {
      logger.error(error.message)
      console.trace(error)
      debugger
    }
  })

  await page.goto(videoUrl)
  logger.silly({ videoId, puppeteer: { browser: { page: { action: 'goto', url: videoUrl } } } })

  // await page.waitForSelector('video')
  // await page.evaluate(() => {
  //   const video = document.querySelector('video')
  //   if (!video) { return }
  //   video.onplay = () => video.pause()
  // })

  // const frameSelector = 'ytd-live-chat-frame'
  // const buttonSelector = '#show-hide-button ytd-toggle-button-renderer'
  // await page.waitForSelector(buttonSelector)
  // await page.evaluate((frameSelector, buttonSelector) => {
  //   const frame = document.querySelector(frameSelector)
  //   if (frame.getAttribute('collapsed') === null) {
  //     return
  //   }
  //   const button = document.querySelector(buttonSelector)
  //   button.click()
  // }, frameSelector, buttonSelector)

  // await page.evaluate(() => {
  //   const video = document.querySelector('video')
  //   if (!video) { return }
  //   video.onplay = null
  //   video.currentTime = 0
  // })
}

async function fetchLiveChat(url: string, reqHeaders: Record<string, string>, reqBody: any, continuation: string) {
  try {
    logger.silly({ videoId, fetchLiveChat: { url } })
    const response = await fetch(url, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(Object.assign(reqBody, { continuation })),
    })
    if (!response.ok) {
      logger.error({ videoId, status: response.status, statusText: response.statusText })
      console.trace(response)
      debugger
      return
    }
    logger.silly({ videoId, status: response.status, statusText: response.statusText })
    const data = await response.json()
    const liveChatContinuation = data?.continuationContents?.liveChatContinuation
    if (liveChatContinuation) {
      handleLiveChatData(liveChatContinuation)
      const newContinuation = getNewContinuation(liveChatContinuation)
      handleNewContinuation(url, reqHeaders, reqBody, newContinuation)
    } else {
      logger.info({ videoId, msg: 'STREAM END' })
    }
  } catch (error) {
    logger.error(error.message)
    console.trace(error)
    debugger
    // Retry fetch request
    const retryTimeout = 5000
    logger.info({ videoId, fetchLiveChat: { retryTimeout } })
    fetchLiveChatWithTimeout(url, reqHeaders, reqBody, continuation, retryTimeout)
  }
}

function fetchLiveChatByContinuationData(url: string, reqHeaders: Record<string, string>, reqBody: any, continuationData: any) {
  fetchLiveChatWithTimeout(url, reqHeaders, reqBody, continuationData.continuation, continuationData.timeoutMs)
}

function fetchLiveChatWithTimeout(url: string, reqHeaders: Record<string, string>, reqBody: any, continuation: string, timeoutMs = 0) {
  logger.silly({ videoId, fetchLiveChatWithTimeout: { timeoutMs, continuation } })
  setTimeout(async () => {
    await fetchLiveChat(url, reqHeaders, reqBody, continuation)
  }, timeoutMs)
}

function getNewContinuation(liveChatContinuation: any) {
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

function handleNewContinuation(url: string, reqHeaders: Record<string, string>, reqBody: any, newContinuation: any) {
  if (newContinuation.timedContinuationData) {
    fetchLiveChatByContinuationData(url, reqHeaders, reqBody, newContinuation.timedContinuationData)
  } else if (newContinuation.invalidationContinuationData) {
    fetchLiveChatByContinuationData(url, reqHeaders, reqBody, newContinuation.invalidationContinuationData)
  } else if (newContinuation.liveChatReplayContinuationData) {
    fetchLiveChatByContinuationData(url, reqHeaders, reqBody, newContinuation.liveChatReplayContinuationData)
  } else if (newContinuation.playerSeekContinuationData) {
    logger.info({ videoId, msg: 'VIDEO END' })
    return
  } else {
    logger.warn({ videoId, handleNewContinuation: { msg: 'newContinuation unhandled' } })
    logger.warn(newContinuation)
    debugger
  }
}

function handleLiveChatData(liveChatContinuation: any) {
  if (!liveChatContinuation) {
    return
  }
  if (liveChatContinuation.actions) {
    handleLiveChatActions(liveChatContinuation.actions)
  } else {
    logger.info({ videoId, actionCount: 0 })
  }
}

function handleLiveChatActions(actions: any[]) {
  logger.info({ videoId, actionCount: actions.length })
  const renderers = actions.map(v => mapChatAction(v)).filter(v => v)

  // Save all messages
  let content = buildContentFromRenderers(renderers)
  if (content) {
    io.appendFile(util.getChatFile(videoId), content)
  }

  // Save SuperChat only
  content = buildContentFromRenderers(renderers.filter(v => v.liveChatPaidMessageRenderer))
  if (content) {
    io.appendFile(util.getSuperChatFile(videoId), content)
  }
}

function mapChatAction(action: any) {
  if (action.replayChatItemAction) {
    const replayActions = action.replayChatItemAction.actions
    if (replayActions.length !== 1) {
      logger.warn({ videoId, msg: 'replayActions different than 1' })
      logger.warn(replayActions)
      debugger
      return
    }
    action = replayActions[0]
  }
  if (action.addChatItemAction) {
    return handleAddChatItemAction(action.addChatItemAction)
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
  if (action.showLiveChatTooltipCommand) {
    return null
  }
  if (action.clickTrackingParams) {
    return null
  }
  logger.warn({ videoId, mapChatAction: { msg: 'action unhandled' } })
  logger.warn(action)
  debugger
  return null
}

function handleAddChatItemAction(data: any) {
  if (!data) {
    return
  }
  const item = data.item
  if (!item) {
    logger.warn({ videoId, handleAddChatItemAction: { msg: 'item not found' } })
    logger.warn(data)
    debugger
  }
  return item
}

function buildContentFromRenderers(renderers: any[]) {
  let content = Array.from(renderers || [])
    .map(v => JSON.stringify(v))
    .join('\r\n')
  if (content) {
    content += '\r\n'
  }
  return content
}
