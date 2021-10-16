import fs from 'fs'
import { logger } from './logger'

export default {
  mkrdir(path: string): void {
    fs.mkdirSync(path, { recursive: true })
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
