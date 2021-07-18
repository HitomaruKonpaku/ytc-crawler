const process = require('process')
const puppeteer = require('puppeteer')
const fetch = require('node-fetch')
const config = require('./config')
const logger = require('./logger')
const io = require('./io')
const util = require('./util')

const args = process.argv.slice(2)
const videoId = util.getYouTubeVideoId(args[0])

let retryCount = 0

if (!videoId) {
  logger.error('VideoId invalid or not found')
  return
}

main()
  .then(() => {
  })
  .catch(error => {
    logger.error(error.message)
    console.trace(error)
    debugger
  })

async function main() {
  io.makeDir(util.getChatDir())

  const browser = await puppeteer.launch({
    headless: config.puppeteer.headless,
    ignoreHTTPSErrors: true,
    args: [`--window-size=${config.puppeteer.width},${config.puppeteer.height}`],
    defaultViewport: {
      width: config.puppeteer.width,
      height: config.puppeteer.height,
    }
  })

  const page = await browser.newPage()

  if (config.app.useCookie) {
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

  await page.setRequestInterception(true)

  page.on('request', async (request) => {
    const url = request.url()
    if (!url.includes('live_chat/get_live_chat')) {
      request.continue()
      return
    }

    const files = [util.getChatFile(videoId), util.getSuperChatFile(videoId)]
    files.forEach(file => {
      logger.log('File:', file)
      io.createFile(file)
    })
    logger.showLineSeparator()

    const headers = request.headers()
    const body = JSON.parse(request.postData())
    const continuation = body.continuation
    await browser.close()

    if (config.app.useCookie) {
      try {
        const baseCookies = util.getCookies()
        const cookie = baseCookies.map(v => {
          const s = [v.name, v.value].join('=')
          return s
        }).join(' ')
        Object.assign(headers, { cookie })
      } catch (error) {
        logger.error(error.message)
        console.trace(error)
        debugger
      }
    }

    await getLiveChat(url, headers, body, continuation)
  })

  const videoUrl = 'https://www.youtube.com/watch?v=' + videoId
  logger.log(`Source:`, videoUrl)
  await page.goto(videoUrl)
}

async function getLiveChat(url, reqHeaders, reqBody, continuation) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(Object.assign(reqBody, { continuation })),
    })
    if (!response.ok) {
      logger.error('STATUS', response.status)
      console.trace(response)
      // TODO: Loop request in case of network error
      getLiveChatWithTimeout(url, reqHeaders, reqBody, continuation, 5000)
      return
    } else {
      retryCount = 0
    }

    const body = await response.json()
    const newContinuation = handleLiveChatData(body)
    if (!newContinuation) {
      logger.showLineSeparator()
      logger.log('STREAM END')
      return
    }

    if (newContinuation.timedContinuationData) {
      getLiveChatByContinuationData(url, reqHeaders, reqBody, newContinuation.timedContinuationData)
    } else if (newContinuation.invalidationContinuationData) {
      getLiveChatByContinuationData(url, reqHeaders, reqBody, newContinuation.invalidationContinuationData)
    } else if (newContinuation.liveChatReplayContinuationData) {
      getLiveChatByContinuationData(url, reqHeaders, reqBody, newContinuation.liveChatReplayContinuationData)
    } else if (newContinuation.playerSeekContinuationData) {
      logger.showLineSeparator()
      logger.log('VIDEO END')
      return
    } else {
      logger.warn('newContinuation unhandle')
      logger.warn(JSON.stringify(newContinuation))
      debugger
    }
  } catch (error) {
    logger.error(error.message)
    console.trace(error)
    debugger
  }
}

function getLiveChatWithTimeout(url, reqHeaders, reqBody, continuation, timeoutMs) {
  setTimeout(async () => {
    await getLiveChat(url, reqHeaders, reqBody, continuation)
  }, timeoutMs)
}

function getLiveChatByContinuationData(url, reqHeaders, reqBody, continuationData) {
  getLiveChatWithTimeout(url, reqHeaders, reqBody, continuationData.continuation, continuationData.timeoutMs)
}

function handleLiveChatData(data) {
  if (!data.continuationContents) {
    logger.warn('continuationContents not found')
    return
  }
  if (!data.continuationContents.liveChatContinuation) {
    logger.warn('liveChatContinuation not found')
    return
  }

  const liveChatContinuation = data.continuationContents.liveChatContinuation
  if (liveChatContinuation.actions) {
    handleLiveChatActions(liveChatContinuation.actions)
  } else {
    logger.warn('actions not found')
  }

  const continuations = liveChatContinuation.continuations
  if (!continuations) {
    logger.warn('continuations not found')
    return
  }

  if (!continuations.length) {
    logger.warn('continuations lengh equals 0')
    return
  }

  const newContinuation = continuations[0]
  return newContinuation
}

function handleLiveChatActions(data) {
  const actions = Array.from(data)
  logger.log(`crawled ${actions.length} actions`)

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

function mapChatAction(action) {
  if (action.replayChatItemAction) {
    const replayActions = action.replayChatItemAction.actions
    if (replayActions.length !== 1) {
      logger.warn('replayActions different than 1')
      logger.warn(JSON.stringify(replayActions))
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

  console.warn('action unhandle')
  console.warn(JSON.stringify(action))
  debugger
  return null
}

function handleAddChatItemAction(data) {
  if (!data) {
    return
  }

  const item = data.item
  if (!item) {
    logger.warn('item not found')
    logger.warn(JSON.stringify(data))
    debugger
  }

  return item
}

function buildContentFromRenderers(renderers) {
  let content = Array.from(renderers || [])
    .map(v => JSON.stringify(v))
    .join('\r\n')
  if (content) {
    content += '\r\n'
  }
  return content
}
