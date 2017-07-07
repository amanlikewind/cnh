//引入检查版本js模块
require('./check-versions')()

// 引入配置文件信息模块 
var config = require('../config')
// 判断开发环境
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = JSON.parse(config.dev.env.NODE_ENV)
}

// 可以指定打开指定的url使用指定的浏览器或者应用，详情可以去看一下
var opn = require('opn')
// 引入nodejs的path模块，进行一些路径的操作，详情可以查看node官方的api  
var path = require('path')
// 引入nodejs的一个框架express,可以帮助我们快速搭建一个node服务 github https://github.com/expressjs/express 
var express = require('express')
// 引入node为webpack提供的一个模块服务 github https://github.com/webpack/webpack  
var webpack = require('webpack')
// 一个可以设置帮助我们进行服务器转发代理的中间件 https://github.com/chimurai/http-proxy-middleware
var proxyMiddleware = require('http-proxy-middleware')
// 根据当前启动环境选择加载相应的配置文件，webpack.prod.conf与webpack.dev.conf文件的说明后面也有
var webpackConfig = require('./webpack.dev.conf')

// default port where dev server listens for incoming traffic
// 端口号的设置 
var port = process.env.PORT || config.dev.port
// automatically open browser, if not set will be false
var autoOpenBrowser = !!config.dev.autoOpenBrowser
// 获取需要代理的服务api  
// https://github.com/chimurai/http-proxy-middleware 
var proxyTable = config.dev.proxyTable

// 启动一个express服务
var app = express()
// 加载webpack配置 
var compiler = webpack(webpackConfig)
/*引入*/
var mongoose = require('mongoose')
//日志文件
var morgan = require('morgan')
//sesstion 存储
var bodyParser = require('body-parser')
var cookieParser = require('cookie-parser')
var session = require('cookie-session')
mongoose.Promise = require('bluebird')
global.db = mongoose.connect("mongodb://10.7.189.98/webchat")

//服务器提交的数据json化
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: true}))
//sesstion 存储
app.use(cookieParser())
app.use(session({
  secret: 'webchat',
  resave: false,
  saveUninitialized: true
}))

var env = process.env.NODE_ENV || 'development'
if ('development' === app.get('env')) {
  app.set('showStackError', true)
  app.use(morgan(':method :url :status'))
  app.locals.pretty = true
  mongoose.set('debug', true)
}

require('../config/routes')(app)
/*引入*/




var devMiddleware = require('webpack-dev-middleware')(compiler, {
  publicPath: webpackConfig.output.publicPath,
  quiet: true
})

var hotMiddleware = require('webpack-hot-middleware')(compiler, {
  log: () => {
  }
})
// force page reload when html-webpack-plugin template changes
compiler.plugin('compilation', function (compilation) {
  compilation.plugin('html-webpack-plugin-after-emit', function (data, cb) {
    hotMiddleware.publish({action: 'reload'})
    cb()
  })
})

// proxy api requests
Object.keys(proxyTable).forEach(function (context) {
  var options = proxyTable[context]
  if (typeof options === 'string') {
    options = {target: options}
  }
  app.use(proxyMiddleware(options.filter || context, options))
})

// handle fallback for HTML5 history API
app.use(require('connect-history-api-fallback')())

// serve webpack bundle output
app.use(devMiddleware)

// enable hot-reload and state-preserving
// compilation error display
app.use(hotMiddleware)

// serve pure static assets
var staticPath = path.posix.join(config.dev.assetsPublicPath, config.dev.assetsSubDirectory)
app.use(staticPath, express.static('./static'))

var uri = 'http://localhost:' + port

var _resolve
var readyPromise = new Promise(resolve => {
  _resolve = resolve
})

console.log('劳资正在启动服务器，小伙子别着急...')
devMiddleware.waitUntilValid(() => {
  console.log('正在偷窥的口口是： ' + uri + '\n')
  // when env is testing, don't need open it
  if (autoOpenBrowser && process.env.NODE_ENV !== 'testing') {
    opn(uri)
  }
  _resolve()
})

// http.listen(8080, function(){
//   console.log('listening on *:3000');
// });

var server = app.listen(port)

//websocket
// var http = require('http').Server(app);
var io = require('socket.io')(server);
var Message = require('../models/message')
global.users = {}

io.on('connection', function (socket) {
  //监听用户发布聊天内容
  socket.on('message', function (obj) {
    //向所有客户端广播发布的消息
    var mess = {
      username: obj.username,
      src:obj.src,
      msg: obj.msg,
      img: obj.img,
      roomid: obj.room
    }
    io.to(mess.roomid).emit('message', mess)
    console.log(obj.username + '对房' + mess.roomid+'说：'+ mess.msg)
    if (obj.img === '') {
      var message = new Message(mess)
      message.save(function (err, mess) {
        if (err) {
          console.log(err)
        }
        console.log(mess)
      })
    }
  })
  socket.on('login',function (obj) {
    socket.name = obj.name
    socket.room = obj.roomid
    if (!global.users[obj.roomid]) {
      global.users[obj.roomid] = {}
    }
    global.users[obj.roomid][obj.name] = obj
    socket.join(obj.roomid)
    io.to(obj.roomid).emit('login', global.users[obj.roomid])
    console.log(obj.name + '加入了' + obj.roomid)
  })
  socket.on('logout',function (obj) {
    delete  global.users[obj.roomid][obj.name]
    console.log(obj.name + '退出了' + obj.roomid)
    io.to(obj.roomid).emit('logout', global.users[obj.roomid])
  })

  socket.on('disconnect', function () {
    if (global.users[socket.room]) {
      delete global.users[socket.room][socket.name]
      // 用户监听用退出聊天室
      console.log(socket.name + '退出了' + socket.room)
      io.to(socket.room).emit('logout', global.users[socket.room])
    }
  })
})



module.exports = {
  ready: readyPromise,
  close: () => {
    server.close()
  }
}
