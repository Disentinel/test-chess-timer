const { json } = require('micro')
const PouchDB = require('pouchdb')

const db = new PouchDB('dialogs')

module.exports = async req => {
  var response = {
    text: 'Что-то пошло не так. Попробуйте снова через пару минут. Если проблема не исчезла, значит я слегка приболела. Дайте пожалуйста знать моему лечащему врачу по адресу rescuerdiver@yandex.ru',
    end_session: false
  }
  
  const { request, session, version } = await json(req)
  
  var user

  try {
    user = await db.get(session.user_id)
  } catch(e) {
    let emptyUser = {
      _id: session.user_id,
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
    } catch(e) {
      response.text = `К сожалению, я не смогла создать пользователя в базе. ${e.message}`
    }
  }
  
  if(user.flowPhase === 'start') {
    response.text = 'Начнем новую партию в шахматы? (да\нет)'
    response.tts = 'Начнем новую партию в шахматы?'
    user.flowPhase = 'startResponseWait'
    await db.put(user)
  }

  if(user.flowPhase === 'startResponseWait') {
    let positiveResponses = ['да', 'ок', 'давай']
    let negativeResponses = ['нет']

    if(request.nlu.tokens.some(value => positiveResponses.filter(token => (value === token)))) {
      user.flowPhase = 'partySize'
      await db.put(user)
      response.text = 'Сколько человек играет?'      
    } else {
      user.flowPhrase = 'start'
      response.end_session = true
      response.text = 'Ну нет, так нет.'
    }
  }

  if(user.flowPhase === 'partySize') {
    response.text = +request.command
  }
  
 
  
  return {
    version,
    session,
    response
  }
}