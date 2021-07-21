import fs from 'fs'
import logger from './logger'

export default {
  makeDir(path: string): void {
    if (fs.existsSync(path)) {
      return
    }
    fs.mkdirSync(path)
  },

  writeFile(file: string, data: string): void {
    try {
      fs.writeFileSync(file, data)
    } catch (error) {
      logger.error(error.message)
      console.trace(error)
    }
  },

  appendFile(file: string, data: string): void {
    try {
      fs.appendFileSync(file, data, { flag: 'as' })
    } catch (error) {
      logger.error(error.message)
      console.trace(error)
    }
  },
}
