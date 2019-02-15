const { json } = require('micro')
const PouchDB = require('pouchdb')

const db = new PouchDB('/tmp/dialogs', { createIfMissing: true })

const COLOR = [
  'Белый',
  'Черный',
  'Красный',
  'Оранжевый',
  'Желтый',
  'Зеленый',
  'Синий',
  'Фиолетовый'
]

module.exports = async req => {
  var response = {
    text: 'Что-то пошло не так. Попробуйте снова через пару минут. Если проблема не исчезла, значит я слегка приболела. Дайте пожалуйста знать моему лечащему врачу по адресу rescuerdiver@yandex.ru',
    end_session: false
  }

  const { request, session, version } = await json(req)

  if(session.new) response.text = 'Здравствуйте!'

  var user = {}

  try {
    user = await db.get(session.session_id)
  } catch (e) {
    let emptyUser = {
      _id: session.session_id,
      isNowPlaying: false,
      partySize: 2,
      now: 0,
      partyTimes: [0, 0],
      totalTime: 0,
      paused: false,
      flowPhase: 'start'
    }

    try {
      user = await db.put(emptyUser)
    } catch (e) {
      response.text = `К сожалению, я не смогла создать пользователя в базе. ${e.message}`
    }
  }

  console.log(`User`, user)

  if (user.flowPhase === 'start') {
    response.text = 'Начнем новую партию в шахматы? (да/нет)'
    response.tts = 'Начнем новую партию в шахматы?'
    user.flowPhase = 'startResponseWait'
    await db.put(user)

    return {
      version,
      session,
      response
    }
  }

  if (user.flowPhase === 'startResponseWait') {
    let positiveResponses = ['да', 'ок', 'давай']
    let negativeResponses = ['нет']

    if (request.nlu.tokens.some(value => positiveResponses.filter(token => (value === token)))) {
      user.flowPhase = 'partySize'
      await db.put(user)
      response.text = 'Сколько человек играет?'
    } else {
      user.flowPhase = 'start'
      response.end_session = true
      response.text = 'Ну нет, так нет.'
    }

    return {
      version,
      session,
      response
    }
  }

  if (user.flowPhase === 'partySize') {
    let partySize = +request.command
    if (Number.isInteger && partySize >= 2 && partySize <= 8) {
      response.text = 'Я начну отсчитывать время партии после команды "Ход". Далее по команде "Ход", ход будет переходить к следующему игроку. Партия заканчивается по команде "Стоп".'
      response.tts = response.text
      user.flowPhase = 'game'
      user.partySize = partySize
      user.now = 0
      user.partyTimes = new Array(partySize).fill(0)
      await db.put(user)
    } else {
      response.text = 'Вам нужно назвать цифру от 2 до 8.'
      response.tts = 'Вам нужно назвать цифру от двух до восьми'
    }

    return {
      version,
      session,
      response
    }
  }

  if (user.flowPhase === 'game') {
    if(request.nlu.tokens.some(token => (token === 'стоп'))) {
      const interval = Date.now() - user.turnStarted

      user.partyTimes[user.now] += +interval
      user.totalTime += +interval

      const TStoMIN = ts => (ts / 1000)

      response.text = user.partyTimes.map((time, i) => (`${COLOR[i]} - ${TStoMIN(time).toFixed(1)} секунд \n`))

      response.text += `Суммарное время: ${TStoMIN(user.totalTime).toFixed(1)} секунд`

      db.remove(user)
    }

    if(request.nlu.tokens.some(token => (token === 'ход'))) {
      if(!user.turnStarted) {
        user.turnStarted = Date.now()
        response.text = 'Ходит Белый'
        response.tts = response.text
      } else {
        const interval = Date.now() - user.turnStarted
        user.turnStarted = Date.now()
        const now = user.now

        user.partyTimes[now] += +interval
        user.totalTime += +interval

        if(now === user.partySize - 1) {
          user.now = 0
        } else {
          user.now += 1
        }

        response.text = `Ходит ${COLOR[user.now]}`
        response.tts = response.text
      }

      await db.put(user)
      return {
        version,
        session,
        response
      }
    } else {
      response.text = 'Если вы хотите передать ход следующему игроку, просто скажите "Ход".'
      return {
        version,
        session,
        response
      }
    }
  }

  return {
    version,
    session,
    response
  }
}
