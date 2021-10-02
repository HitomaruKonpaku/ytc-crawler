import * as cheerio from 'cheerio'
import minimist from 'minimist'
import path from 'path'
import process from 'process'
import { config } from './config'
import logger from './logger'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CookieMap } = require('cookiefile')

const date = new Date()

export default {
  setTitle(title: string): void {
    const s = String.fromCharCode(27) + ']0;' + title + String.fromCharCode(7)
    process.stdout.write(s)
  },

  getProcessArguments(): Record<string, any> {
    const args = minimist(process.argv.slice(2))
    return args
  },

  getYouTubeVideoId(url: string): string {
    const pattern = /^(?:(?:https:\/\/youtu\.be\/)|(https:\/\/www\.youtube\.com\/watch\?v=)){0,1}[\w-]{11}$/g
    if (!pattern.test(url)) {
      throw new Error('Invalid YouTube URL')
    }
    const id = url.slice(-11)
    return id
  },

  getChatDir(): string {
    const value = path.join(__dirname, config.app.chatDir)
    return value
  },

  getChatFile(id: string): string {
    const name = [this.getFileTime(), id].join('_') + '.jsonl'
    const value = path.join(this.getChatDir(), name)
    return value
  },

  getSuperChatFile(id: string): string {
    const name = [this.getFileTime(), id, 'sc'].join('_') + '.jsonl'
    const value = path.join(this.getChatDir(), name)
    return value
  },

  getCookies(): any[] {
    const domains = ['youtube.com']
    const map = new CookieMap(this.getCookiesFile())
    const cookies: any[] = Array.from(map.values())
      .filter((cookie: any) => domains.some(v => cookie.domain.includes(v)))
    return cookies
  },

  getCookiesFile(): string {
    const value = path.join(__dirname, config.app.cookiesPath)
    return value
  },

  getFileTime(): string {
    const value = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(v => String(v).padStart(2, '0').slice(-2))
      .join('')
    return value
  },

  getYtInitialData(body: string): any {
    logger.info('getYtInitialData')
    const $ = cheerio.load(body)
    const node = Array.from($('script'))
      .map(v => Array.from(v.childNodes))
      .filter(v => v.length)
      .flat()
      .find((v: any) => v.data && v.data.includes('ytInitialData'))
    if (!node) {
      logger.warn('ytInitialData not found')
      return null
    }
    const rawData: string = node['data']
    const jsonData = rawData.substring(rawData.indexOf('{'), rawData.lastIndexOf('}') + 1)
    const obj = JSON.parse(jsonData)
    logger.info('ytInitialData found')
    return obj
  },

  makeYoutubeMessage(runs: any[]): string {
    if (!runs?.length) {
      return ''
    }
    const msg = runs.reduce((pv, cv) => [pv, cv.emoji && cv.emoji.shortcuts[0] || cv.text || ''].filter(v => v).join(' '), '')
    return msg
  },
}
