const path = require('path')
const { CookieMap } = require('cookiefile')
const config = require('./config')
const logger = require('./logger')

const date = new Date()

module.exports = {
  getYouTubeVideoId(url) {
    const pattern = /^(?:(?:https:\/\/youtu\.be\/)|(https:\/\/www\.youtube\.com\/watch\?v=)){0,1}[\w-]{11}$/g
    if (!pattern.test(url)) {
      return null
    }
    const id = url.slice(-11)
    return id
  },

  getChatDir() {
    const value = path.join(__dirname, config.app.chatOutDir)
    logger.debug(value)
    return value
  },

  getChatFile(id) {
    const name = [this.getFileTime(), id].join('_') + '.jsonl'
    const value = path.join(this.getChatDir(), name)
    logger.debug(value)
    return value
  },

  getSuperChatFile(id) {
    const name = [this.getFileTime(), id, 'sc'].join('_') + '.jsonl'
    const value = path.join(this.getChatDir(), name)
    logger.debug(value)
    return value
  },

  getCookies() {
    const map = new CookieMap(this.getCookieFile())
    const cookies = Array.from(map.values())
      .filter(cookie => ['youtube.com'].some(v => cookie.domain.includes(v)))
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
