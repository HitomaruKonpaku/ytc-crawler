const fs = require('fs')
const logger = require('./logger')

module.exports = {
  makeDir(path) {
    if (!path) {
      logger.warn('path not found')
      return
    }
    if (fs.existsSync(path)) {
      return
    }
    fs.mkdirSync(path)
  },

  createFile(file) {
    if (!file) {
      logger.warn('file not found')
      return
    }
    if (fs.existsSync(file)) {
      return
    }
    fs.appendFileSync(file, '', { flag: 'as' })
  },

  appendFile(file, data) {
    if (!file) {
      logger.warn('file not found')
      return
    }
    if (!data) {
      logger.warn('data not found')
      return
    }
    try {
      fs.appendFileSync(file, data, { flag: 'as' })
    } catch (error) {
      logger.error(error.message)
      console.trace(error)
    }
  },
}
