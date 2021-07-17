module.exports = {
  debug(...args) {
    return
    console.debug(this.getTime(), this.getLevel('debug'), ...args)
  },
  log(...args) {
    // return
    console.log(this.getTime(), this.getLevel('log'), ...args)
  },
  warn(...args) {
    // return
    console.warn(this.getTime(), this.getLevel('warn'), ...args)
  },
  error(...args) {
    // return
    console.error(this.getTime(), this.getLevel('error'), ...args)
  },
  showLineSeparator() {
    console.log(Array(80).fill('=').join(''))
  },
  getTime() {
    const date = new Date()
    const time = [
      [date.getFullYear(), date.getMonth() + 1, date.getDate()].map(v => String(v).padStart(2, '0')).join('-'),
      [date.getHours(), date.getMinutes(), date.getSeconds()].map(v => String(v).padStart(2, '0')).join(':'),
    ].join(' ')
    return time
  },
  getLevel(level) {
    const value = String(level).toUpperCase().padEnd(5, ' ')
    return value
  },
}
