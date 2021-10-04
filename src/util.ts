import path from 'path'
import { config } from './config'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { CookieMap } = require('cookiefile')

const date = new Date()

export default {
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

  getYouTubeVideoId(url: string): string {
    const pattern = /^(?:(?:https:\/\/youtu\.be\/)|(https:\/\/www\.youtube\.com\/watch\?v=)){0,1}[\w-]{11}$/g
    if (!pattern.test(url)) {
      throw new Error('Invalid YouTube URL')
    }
    const id = url.slice(-11)
    return id
  },

  makeYoutubeMessage(runs: any[]): string {
    if (!runs?.length) {
      return ''
    }
    const msg = runs.reduce((pv, cv) => [pv, cv.emoji && cv.emoji.shortcuts[0] || cv.text || ''].filter(v => v).join(' '), '')
    return msg
  },
}
