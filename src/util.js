const path = require('path')
const config = require('./config')
const logger = require('./logger')

const date = new Date()

module.exports = {
  getChatDir() {
    const value = path.join(__dirname, config.app.chatOutDir)
    logger.debug(value)
    return value
  },

  getVideoChatFile(id) {
    const time = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()]
      .map(v => String(v).padStart(2, '0').slice(-2))
      .join('')
    const name = [time, `${id}.jsonl`].join('_')
    const value = path.join(this.getChatDir(), name)
    logger.debug(value)
    return value
  },

  getYouTubeVideoId(url) {
    const pattern = /^(?:(?:https:\/\/youtu\.be\/)|(https:\/\/www\.youtube\.com\/watch\?v=)){0,1}[\w-]{11}$/g
    if (!pattern.test(url)) {
      return null
    }
    const id = url.slice(-11)
    return id
  },
}
