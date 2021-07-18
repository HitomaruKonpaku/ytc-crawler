const httpServer = require('http').createServer()
const io = require('socket.io')(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  }
})

io.on('connection', (socket) => {
  // TODO: Do something on client connect
})

module.exports = {
  server: io,

  start() {
    httpServer.listen(3000)
  },

  stop() {
    httpServer.close()
  },
}
