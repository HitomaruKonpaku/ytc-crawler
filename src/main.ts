import { args } from './args'
import { Crawler } from './crawler'
import logger from './logger'
import { Receiver } from './receiver'
import util from './util'

async function bootstrap() {
  logger.debug({ args })
  const videoId = util.getYouTubeVideoId(args['_'][0])
  const crawler = new Crawler(videoId)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const receiver = new Receiver(crawler)
  await crawler.launch()
}

bootstrap()
