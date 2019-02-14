const { json } = require('micro')

module.exports = async req => {
  const { request, session, version } = await json(req)
  
  const response = {
    text: 'Hello!',
    end_session: false
  }
  
  return {
    version,
    session,
    response
  }
}