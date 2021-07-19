import path from 'path'
import { config } from './config'
const { CookieMap } = require('cookiefile')

const date = new Date()

export default {
  setTitle(title: string) {
    const s = String.fromCharCode(27) + "]0;" + title + String.fromCharCode(7)
    process.stdout.write(s)
  },

  getYouTubeVideoId(url: string) {
    const pattern = /^(?:(?:https:\/\/youtu\.be\/)|(https:\/\/www\.youtube\.com\/watch\?v=)){0,1}[\w-]{11}$/g
    if (!pattern.test(url)) {
      throw new Error('Invalid YouTube URL')
    }
    const id = url.slice(-11)
    return id
  },

  getChatDir() {
    const value = path.join(__dirname, config.app.chatDir)
    return value
  },

  getChatFile(id: string) {
    const name = [this.getFileTime(), id].join('_') + '.jsonl'
    const value = path.join(this.getChatDir(), name)
    return value
  },

  getSuperChatFile(id: string) {
    const name = [this.getFileTime(), id, 'sc'].join('_') + '.jsonl'
    const value = path.join(this.getChatDir(), name)
    return value
  },

  getCookies() {
    const map = new CookieMap(this.getCookieFile())
    const cookies: any[] = Array.from(map.values())
      .filter((cookie: any) => ['youtube.com'].some(v => cookie.domain.includes(v)))
    return cookies
  },

  getCookieFile() {
    const value = path.join(__dirname, config.app.cookiePath)
    return value
  },

  getFileTime() {
    const value = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(v => String(v).padStart(2, '0').slice(-2))
      .join('')
    return value
  },
}
